"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, Plus, Trash2, Maximize, Type, Image as ImageIcon, Printer, MapPin } from "lucide-react";
import { JourneyMap } from "../Blog/BlogClient";

interface PrintElement {
  id: string;
  type: "blog-entry" | "custom-text" | "custom-image" | "journey-map";
  content: any; // Task, map points, or custom strings/urls
  x: number;
  y: number;
  width: number;
  height?: number;
  rotation?: number;
  // Custom styles for elements
  fontSize?: "sm" | "base" | "lg" | "xl";
  imageDensity?: "compact" | "standard" | "thumbnail" | "hidden";
  paddingY?: "none" | "small" | "medium" | "large";
  hiddenImageIds?: string[];
  largeImageIds?: string[];
  imageSize?: "small" | "medium" | "large" | "original";
  themeStyle?: "clean" | "journal" | "magazine" | "travelbook";
  borderStyle?: "none" | "solid-accent" | "dashed-warm" | "double-vintage" | "solid-block";
  photoStyle?: "standard" | "polaroid" | "scrapbook" | "tilted" | "circle-oval";
  startParagraphIndex?: number;
  endParagraphIndex?: number;
}

interface PrintPage {
  elements: PrintElement[];
}

interface PrintEditorProps {
  folder: any;
  onClose: () => void;
}

interface PageConfig {
  startPara: number;
  endPara: number;
  shownImageIds: string[];
}

const paginateSubtask = (t: any, density: string = "standard"): PageConfig[] => {
  const getSentenceChunks = (text: string) => {
    if (!text) return [];
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z\u00C0-\u017F0-9])/).filter((s: string) => s.trim().length > 0);
    if (sentences.length < 2) return text ? [text] : []; 
    const chunks = [];
    for (let i = 0; i < sentences.length; i += 2) {
      chunks.push(sentences.slice(i, i + 2).join(" ").trim());
    }
    return chunks;
  };

  const allParas = getSentenceChunks(t.description || "");
  const allImages = t.attachments?.filter((a: any) => a.type === "image") || [];
  
  const N = allParas.length;
  const M = allImages.length;
  
  if (N === 0 && M === 0) {
    return [{ startPara: 0, endPara: 0, shownImageIds: [] }];
  }
  
  // Proportional distribution of images
  const imagesByParaIdx: Record<number, any[]> = {};
  for (let i = 0; i < N; i++) {
    imagesByParaIdx[i] = [];
  }
  allImages.forEach((img: any, idx: number) => {
    const paraIdx = N > 0 ? Math.min(N - 1, Math.floor((idx / M) * N)) : 0;
    if (!imagesByParaIdx[paraIdx]) imagesByParaIdx[paraIdx] = [];
    imagesByParaIdx[paraIdx].push(img);
  });

  const pages: PageConfig[] = [];
  let currentStart = 0;
  const imagesPerRow = density === "compact" ? 3 : density === "thumbnail" ? 4 : density === "hidden" ? 9999 : 2;
  
  while (currentStart < N || (currentStart === 0 && N === 0 && M > 0)) {
    if (N === 0) {
      const imagesPerPage = imagesPerRow * 2;
      let imgIdx = 0;
      while (imgIdx < M) {
        const chunk = allImages.slice(imgIdx, imgIdx + imagesPerPage);
        pages.push({
          startPara: 0,
          endPara: 0,
          shownImageIds: chunk.map((img: any) => img.id)
        });
        imgIdx += imagesPerPage;
      }
      break;
    }

    const isFirstPage = pages.length === 0;
    let currentEnd = currentStart;
    const shownImageIdsOnPage: string[] = [];

    while (currentEnd < N) {
      const nextParaImgs = imagesByParaIdx[currentEnd] || [];
      const candidateParagraphsCount = (currentEnd - currentStart) + 1;
      const candidateImagesCount = shownImageIdsOnPage.length + nextParaImgs.length;
      
      const numRows = density === "hidden" ? 0 : Math.ceil(candidateImagesCount / imagesPerRow);
      const paraWeight = candidateParagraphsCount * 12;
      const imgsWeight = numRows * 32;
      
      const baseWeight = isFirstPage ? 22 : 10;
      const totalWeight = baseWeight + paraWeight + imgsWeight;

      if (currentEnd > currentStart && totalWeight > 100) {
        break;
      }

      nextParaImgs.forEach((img: any) => shownImageIdsOnPage.push(img.id));
      currentEnd++;

      if (totalWeight >= 100) {
        break;
      }
    }

    pages.push({
      startPara: currentStart,
      endPara: currentEnd,
      shownImageIds: shownImageIdsOnPage
    });

    currentStart = currentEnd;
  }

  return pages;
};

export const PrintEditor: React.FC<PrintEditorProps> = ({ folder, onClose }) => {
  const [format, setFormat] = useState<"A4" | "A5">("A4");
  const [pages, setPages] = useState<PrintPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  
  const [savedVersions, setSavedVersions] = useState<any[]>([]);
  const [newVersionName, setNewVersionName] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState("");

  const pageRef = useRef<HTMLDivElement>(null);
  const [pageOverflows, setPageOverflows] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!pageRef.current) return;
    
    const checkOverflow = () => {
      const pageEl = pageRef.current;
      if (!pageEl) return;
      
      const elements = pageEl.querySelectorAll(".absolute-element-container");
      let overflows = false;
      
      elements.forEach((el: any) => {
        const rect = el.getBoundingClientRect();
        const pageRect = pageEl.getBoundingClientRect();
        const elementBottom = rect.bottom - pageRect.top;
        
        if (elementBottom > pageEl.clientHeight - 40) {
          overflows = true;
        }
      });
      
      setPageOverflows(prev => {
        if (prev[currentPageIndex] === overflows) return prev;
        return { ...prev, [currentPageIndex]: overflows };
      });
    };

    const timer = setTimeout(checkOverflow, 400);
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(pageRef.current);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [currentPageIndex, pages, format]);

  const template = folder.blogTemplate || "ADVENTURE";
  const isAdventure = template === "ADVENTURE";
  const isElegant = template === "ELEGANT";
  const accentColor = isAdventure ? "#d4a373" : "#ea580c";

  // Fetch saved versions from DB
  const fetchVersions = async () => {
    try {
      const res = await fetch(`/api/tasks/${folder.id}/print-versions`);
      if (res.ok) {
        const data = await res.json();
        setSavedVersions(data);
      }
    } catch (err) {
      console.error("Error fetching versions:", err);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, [folder.id]);

  // Calculate distance between coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Collect all unique images from all subtasks for picker
  const tripImages = useMemo(() => {
    if (!folder.subTasks) return [];
    const images: any[] = [];
    folder.subTasks.forEach((t: any) => {
      if (t.attachments) {
        t.attachments.forEach((a: any) => {
          if (a.type === "image" && !images.some(img => img.url === a.url)) {
            images.push({ ...a, taskId: t.id });
          }
        });
      }
    });
    return images;
  }, [folder]);

  // Initialize pages from tasks
  useEffect(() => {
    if (isLoaded || !folder.subTasks) return;
    
    const subTasks = [...folder.subTasks]
      .filter((t: any) => !t.isDeleted && t.taskType !== "GPS_LOG")
      .sort((a: any, b: any) => new Date(a.recordedAt || a.createdAt).getTime() - new Date(b.recordedAt || b.createdAt).getTime());

    // Compute journey map points & distances
    const mapPoints = subTasks
      .map((p: any) => {
        const loc = p.locations?.[0];
        if (loc && loc.latitude && loc.longitude) {
          return { 
            lat: loc.latitude, 
            lng: loc.longitude, 
            title: p.title 
          };
        }
        return null;
      })
      .filter(Boolean) as { lat: number, lng: number, title: string }[];

    let totalDist = 0;
    for (let i = 0; i < subTasks.length - 1; i++) {
      const current = subTasks[i];
      const next = subTasks[i+1];
      if (next.calculatedDistance !== null && next.calculatedDistance !== undefined) {
        totalDist += next.calculatedDistance;
      } else {
        const loc1 = current.locations?.[0];
        const loc2 = next.locations?.[0];
        if (loc1 && loc2 && loc1.latitude && loc1.longitude && loc2.latitude && loc2.longitude) {
          totalDist += calculateDistance(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude);
        }
      }
    }

    const paginated: PrintPage[] = [];

    // Add journey map page at the very beginning if points exist
    if (mapPoints.length > 0) {
      paginated.push({
        elements: [{
          id: "journey-map-cover",
          type: "journey-map",
          content: {
            title: folder.title,
            points: mapPoints,
            totalDistance: totalDist.toFixed(1)
          },
          x: 0,
          y: 0,
          width: 100
        }]
      });
    }
    
    const template = folder.blogTemplate || "ADVENTURE";
    const isAdventure = template === "ADVENTURE";
    const isElegant = template === "ELEGANT";
    
    const defaultThemeStyle = isAdventure ? "travelbook" : isElegant ? "magazine" : "journal";
    const defaultBorderStyle = isAdventure ? "double-vintage" : isElegant ? "solid-accent" : "dashed-warm";
    const defaultPhotoStyle = isAdventure ? "scrapbook" : isElegant ? "circle-oval" : "polaroid";

    // Flow each entry across pages based on capacity
    subTasks.forEach((t: any) => {
      const pageConfigs = paginateSubtask(t, "standard");
      const allImages = t.attachments?.filter((a: any) => a.type === "image") || [];
      
      pageConfigs.forEach((config, idx) => {
        const hiddenImageIds = allImages
          .filter((img: any) => !config.shownImageIds.includes(img.id))
          .map((img: any) => img.id);

        paginated.push({
          elements: [{
            id: idx === 0 ? `entry-${t.id}` : `entry-${t.id}-split-${idx}-${Date.now()}`,
            type: "blog-entry",
            content: { ...t },
            x: 0,
            y: 0,
            width: 100,
            fontSize: "base",
            imageDensity: "standard",
            paddingY: "medium",
            themeStyle: defaultThemeStyle,
            borderStyle: defaultBorderStyle,
            photoStyle: defaultPhotoStyle,
            startParagraphIndex: config.startPara,
            endParagraphIndex: config.endPara,
            hiddenImageIds: hiddenImageIds
          }]
        });
      });
    });

    setPages(paginated.length > 0 ? paginated : [{ elements: [] }]);
    setIsLoaded(true);
  }, [folder, isLoaded]);

  const handleUpdateElement = (id: string, data: Partial<PrintElement>) => {
    setPages(prev => prev.map(page => ({
      elements: page.elements.map(el => el.id === id ? { ...el, ...data } : el)
    })));
  };

  const handleDeleteElement = (id: string) => {
    setPages(prev => prev.map(page => ({
      elements: page.elements.filter(el => el.id !== id)
    })));
    setSelectedElementId(null);
  };

  // Page Operations
  const handleAddPage = () => {
    const newPage: PrintPage = { elements: [] };
    const updated = [...pages];
    updated.splice(currentPageIndex + 1, 0, newPage);
    setPages(updated);
    setCurrentPageIndex(currentPageIndex + 1);
    setSelectedElementId(null);
  };

  const handleDeletePage = () => {
    if (pages.length <= 1) {
      alert("Nemůžete smazat poslední stránku fotoknihy.");
      return;
    }
    if (!confirm(`Opravdu chcete smazat stranu ${currentPageIndex + 1}?`)) return;
    const updated = pages.filter((_, idx) => idx !== currentPageIndex);
    setPages(updated);
    setCurrentPageIndex(Math.max(0, currentPageIndex - 1));
    setSelectedElementId(null);
  };

  const handleMovePage = (direction: "up" | "down") => {
    const targetIndex = direction === "up" ? currentPageIndex - 1 : currentPageIndex + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;
    
    const updated = [...pages];
    const temp = updated[currentPageIndex];
    updated[currentPageIndex] = updated[targetIndex];
    updated[targetIndex] = temp;
    
    setPages(updated);
    setCurrentPageIndex(targetIndex);
    setSelectedElementId(null);
  };

  const handleSplitBlogEntry = (el: PrintElement) => {
    if (el.type !== "blog-entry") return;
    
    const post = el.content;
    const getSentenceChunks = (text: string) => {
      if (!text) return [];
      const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z\u00C0-\u017F0-9])/).filter((s: string) => s.trim().length > 0);
      if (sentences.length < 2) return [text]; 
      const chunks = [];
      for (let i = 0; i < sentences.length; i += 2) {
        chunks.push(sentences.slice(i, i + 2).join(" ").trim());
      }
      return chunks;
    };
    
    const allParas = getSentenceChunks(post.description || "");
    const totalParas = allParas.length;
    
    const allImages = post.attachments?.filter((a: any) => a.type === "image") || [];
    const totalImages = allImages.length;
    
    // We will split the paragraphs in half (or near half)
    const midPara = Math.max(1, Math.ceil(totalParas / 2));
    
    // Original element gets paragraphs 0 to midPara
    const startPara1 = el.startParagraphIndex !== undefined ? el.startParagraphIndex : 0;
    const endPara1 = midPara;
    
    // New element gets paragraphs midPara to totalParas
    const startPara2 = midPara;
    const endPara2 = el.endParagraphIndex !== undefined ? el.endParagraphIndex : totalParas;
    
    // We will also split the images in half
    const midImage = Math.ceil(totalImages / 2);
    
    const hiddenImages1 = [
      ...(el.hiddenImageIds || []),
      ...allImages.slice(midImage).map((img: any) => img.id)
    ];
    
    const hiddenImages2 = [
      ...(el.hiddenImageIds || []),
      ...allImages.slice(0, midImage).map((img: any) => img.id)
    ];

    // 1. Update the original element on the current page
    const updatedOriginal: PrintElement = {
      ...el,
      endParagraphIndex: endPara1,
      hiddenImageIds: hiddenImages1,
    };

    // 2. Create the second element for the next page
    const newElId = "entry-" + post.id + "-split-" + Date.now();
    const newElement: PrintElement = {
      ...el,
      id: newElId,
      startParagraphIndex: startPara2,
      endParagraphIndex: endPara2,
      hiddenImageIds: hiddenImages2,
    };

    // 3. Create a new page right after the current page and place the new element there
    const updatedPages = [...pages];
    const newPage: PrintPage = {
      elements: [newElement]
    };
    
    // Insert new page
    updatedPages.splice(currentPageIndex + 1, 0, newPage);
    
    // Replace original element in the current page
    updatedPages[currentPageIndex] = {
      elements: updatedPages[currentPageIndex].elements.map(item => item.id === el.id ? updatedOriginal : item)
    };

    setPages(updatedPages);
    setCurrentPageIndex(currentPageIndex + 1);
    setSelectedElementId(newElId);
  };

  // Insert Elements
  const handleAddCustomText = () => {
    const newEl: PrintElement = {
      id: "custom-text-" + Date.now(),
      type: "custom-text",
      content: "Klikněte pro přepsání vlastního textu...",
      x: 10,
      y: 20,
      width: 80,
      fontSize: "base"
    };
    setPages(prev => prev.map((page, idx) => idx === currentPageIndex ? {
      elements: [...page.elements, newEl]
    } : page));
    setSelectedElementId(newEl.id);
  };

  const handleAddCustomImage = (url: string) => {
    const newEl: PrintElement = {
      id: "custom-image-" + Date.now(),
      type: "custom-image",
      content: url,
      x: 10,
      y: 15,
      width: 80
    };
    setPages(prev => prev.map((page, idx) => idx === currentPageIndex ? {
      elements: [...page.elements, newEl]
    } : page));
    setSelectedElementId(newEl.id);
    setIsImagePickerOpen(false);
  };

  // Version Operations
  const handleSaveVersion = async () => {
    if (!newVersionName.trim()) {
      alert("Zadejte prosím název verze.");
      return;
    }
    try {
      const res = await fetch(`/api/tasks/${folder.id}/print-versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newVersionName,
          layout: pages,
          format: format
        })
      });
      if (res.ok) {
        setNewVersionName("");
        fetchVersions();
        alert("Verze byla úspěšně uložena!");
      } else {
        alert("Chyba při ukládání verze.");
      }
    } catch (err) {
      console.error("Error saving version:", err);
      alert("Nelze se připojit k serveru.");
    }
  };

  const handleLoadVersion = (version: any) => {
    try {
      const parsedPages = typeof version.layout === "string" ? JSON.parse(version.layout) : version.layout;
      setPages(parsedPages);
      setFormat(version.format as any);
      setCurrentPageIndex(0);
      setSelectedElementId(null);
      alert(`Načtena verze: ${version.name}`);
    } catch (err) {
      console.error("Error loading version:", err);
      alert("Nepodařilo se dekódovat uložené rozvržení.");
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!confirm("Opravdu chcete smazat tuto verzi?")) return;
    try {
      const res = await fetch(`/api/tasks/${folder.id}/print-versions?versionId=${versionId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchVersions();
      } else {
        alert("Nepodařilo se smazat verzi.");
      }
    } catch (err) {
      console.error("Error deleting version:", err);
    }
  };

  const handleApplyGlobalStyle = (styles: Partial<PrintElement>) => {
    setPages(prev => prev.map(page => ({
      elements: page.elements.map(el => 
        (el.type === "blog-entry" || el.type === "custom-text") 
          ? { ...el, ...styles } 
          : el
      )
    })));
  };

  const handlePropagateSelectedStyle = () => {
    if (!selectedElement) return;
    if (!confirm("Opravdu chcete použít vzhled tohoto prvku (šablonu, okraje, rámečky a vzhled fotek) pro všechny stránky v knize?")) return;
    
    handleApplyGlobalStyle({
      themeStyle: selectedElement.themeStyle,
      borderStyle: selectedElement.borderStyle,
      photoStyle: selectedElement.photoStyle,
      fontSize: selectedElement.fontSize,
      imageSize: selectedElement.imageSize,
      imageDensity: selectedElement.imageDensity,
      paddingY: selectedElement.paddingY
    });
    alert("Styl byl úspěšně aplikován na celou knihu!");
  };

  const handleAutoPaginateBook = () => {
    if (!confirm("Opravdu chcete automaticky přeorganizovat celou knihu? Všechny stránky s příspěvky budou rozděleny podle prostoru. Vaše vlastní styly a barevné rámečky zůstanou zachovány.")) return;

    if (!folder.subTasks) return;
    
    // 1. Gather all existing subtask customization styles so we can preserve them!
    const subtaskStyles: Record<string, Partial<PrintElement>> = {};
    pages.forEach(page => {
      page.elements.forEach(el => {
        if (el.type === "blog-entry" && el.content?.id) {
          subtaskStyles[el.content.id] = {
            fontSize: el.fontSize,
            imageDensity: el.imageDensity,
            paddingY: el.paddingY,
            themeStyle: el.themeStyle,
            borderStyle: el.borderStyle,
            photoStyle: el.photoStyle,
            imageSize: el.imageSize
          };
        }
      });
    });

    const subTasks = [...folder.subTasks]
      .filter((t: any) => !t.isDeleted && t.taskType !== "GPS_LOG")
      .sort((a: any, b: any) => new Date(a.recordedAt || a.createdAt).getTime() - new Date(b.recordedAt || b.createdAt).getTime());

    // 2. Re-compute journey map points & distances
    const mapPoints = subTasks
      .map((p: any) => {
        const loc = p.locations?.[0];
        if (loc && loc.latitude && loc.longitude) {
          return { 
            lat: loc.latitude, 
            lng: loc.longitude, 
            title: p.title 
          };
        }
        return null;
      })
      .filter(Boolean) as { lat: number, lng: number, title: string }[];

    let totalDist = 0;
    for (let i = 0; i < subTasks.length - 1; i++) {
      const current = subTasks[i];
      const next = subTasks[i+1];
      if (next.calculatedDistance !== null && next.calculatedDistance !== undefined) {
        totalDist += next.calculatedDistance;
      } else {
        const loc1 = current.locations?.[0];
        const loc2 = next.locations?.[0];
        if (loc1 && loc2 && loc1.latitude && loc1.longitude && loc2.latitude && loc2.longitude) {
          totalDist += calculateDistance(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude);
        }
      }
    }

    const paginated: PrintPage[] = [];

    // 3. Keep journey map page at index 0
    if (mapPoints.length > 0) {
      paginated.push({
        elements: [{
          id: "journey-map-cover",
          type: "journey-map",
          content: {
            title: folder.title,
            points: mapPoints,
            totalDistance: totalDist.toFixed(1)
          },
          x: 0,
          y: 0,
          width: 100
        }]
      });
    }

    // 4. Paginate all subtasks using the helper
    subTasks.forEach((t: any) => {
      const savedStyle = subtaskStyles[t.id] || {};
      const pageConfigs = paginateSubtask(t, savedStyle.imageDensity || "standard");
      const allImages = t.attachments?.filter((a: any) => a.type === "image") || [];

      pageConfigs.forEach((config, idx) => {
        const hiddenImageIds = allImages
          .filter((img: any) => !config.shownImageIds.includes(img.id))
          .map((img: any) => img.id);

        paginated.push({
          elements: [{
            id: idx === 0 ? `entry-${t.id}` : `entry-${t.id}-split-${idx}-${Date.now()}`,
            type: "blog-entry",
            content: { ...t },
            x: 0,
            y: 0,
            width: 100,
            fontSize: savedStyle.fontSize || "base",
            imageDensity: savedStyle.imageDensity || "standard",
            paddingY: savedStyle.paddingY || "medium",
            themeStyle: savedStyle.themeStyle,
            borderStyle: savedStyle.borderStyle,
            photoStyle: savedStyle.photoStyle,
            imageSize: savedStyle.imageSize,
            startParagraphIndex: config.startPara,
            endParagraphIndex: config.endPara,
            hiddenImageIds: hiddenImageIds
          }]
        });
      });
    });

    setPages(paginated.length > 0 ? paginated : [{ elements: [] }]);
    setCurrentPageIndex(0);
    setSelectedElementId(null);
    alert("Kniha byla úspěšně automaticky rozvržena!");
  };

  const handleExport = () => {
    window.print();
  };

  const selectedElement = useMemo(() => {
    if (!selectedElementId) return null;
    return pages[currentPageIndex]?.elements.find(el => el.id === selectedElementId) || null;
  }, [selectedElementId, pages, currentPageIndex]);

  const totalParas = useMemo(() => {
    if (!selectedElement || selectedElement.type !== "blog-entry") return 0;
    const text = selectedElement.content.description || "";
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z\u00C0-\u017F0-9])/).filter((s: string) => s.trim().length > 0);
    if (sentences.length < 2) return text ? 1 : 0; 
    const chunks = [];
    for (let i = 0; i < sentences.length; i += 2) {
      chunks.push(sentences.slice(i, i + 2).join(" ").trim());
    }
    return chunks.length;
  }, [selectedElement]);

  // Helper component to render the entry EXACTLY like the blog
  const BlogEntryRenderer = ({ post, el, isInteractive = true }: { post: any; el: PrintElement; isInteractive?: boolean }) => {
    const date = new Date(post.recordedAt || post.createdAt);
    
    // Select sizes based on element configuration
    const fontSizeClass = 
      el.fontSize === "sm" ? "text-sm leading-relaxed" :
      el.fontSize === "lg" ? "text-lg leading-relaxed" :
      el.fontSize === "xl" ? "text-xl leading-relaxed" : "text-base leading-relaxed";
      
    const paddingClass =
      el.paddingY === "none" ? "px-4 py-1" :
      el.paddingY === "small" ? "px-6 py-2" :
      el.paddingY === "large" ? "px-12 py-8" : "px-8 py-4"; // medium / standard

    const density = el.imageDensity || "standard";
    const hiddenImageIds = el.hiddenImageIds || [];
    const largeImageIds = el.largeImageIds || [];
    const imgSize = el.imageSize || "medium";

    let imgHeightClass = "h-[250px] w-auto max-w-full object-contain";
    if (imgSize === "small") imgHeightClass = "h-[160px] w-auto max-w-full object-contain";
    else if (imgSize === "large") imgHeightClass = "h-[360px] w-auto max-w-full object-contain";
    else if (imgSize === "original") imgHeightClass = "w-full h-auto object-contain";

    const images = post.attachments?.filter((a: any) => a.type === "image" && !hiddenImageIds.includes(a.id)) || [];
    
    // Blog logic for paragraphs
    const getSentenceChunks = (text: string) => {
      if (!text) return [];
      const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z\u00C0-\u017F0-9])/).filter((s: string) => s.trim().length > 0);
      if (sentences.length < 2) return [text]; 
      const chunks = [];
      for (let i = 0; i < sentences.length; i += 2) {
        chunks.push(sentences.slice(i, i + 2).join(" ").trim());
      }
      return chunks;
    };
    const allParagraphs = getSentenceChunks(post.description || "");
    const totalParasLocal = allParagraphs.length;

    // Slice paragraphs based on element configuration
    const startPara = el.startParagraphIndex !== undefined ? el.startParagraphIndex : 0;
    const endPara = el.endParagraphIndex !== undefined ? el.endParagraphIndex : totalParasLocal;
    const paragraphs = allParagraphs.slice(startPara, endPara);

    const showDropCap = el.fontSize !== "sm" && el.fontSize !== "base" && startPara === 0;

    const themeStyle = el.themeStyle || "clean";

    // Resolve border style based on borderStyle property or themeStyle defaults
    let border = el.borderStyle;
    if (!border) {
      if (themeStyle === "journal") border = "dashed-warm";
      else if (themeStyle === "travelbook") border = "double-vintage";
      else border = "none";
    }

    // Resolve photo style based on photoStyle property or themeStyle defaults
    let pStyle = el.photoStyle;
    if (!pStyle) {
      if (themeStyle === "journal") pStyle = "polaroid";
      else if (themeStyle === "travelbook") pStyle = "scrapbook";
      else if (themeStyle === "magazine") pStyle = "circle-oval";
      else pStyle = "standard";
    }

    const isSolidBlock = border === "solid-block";
    const customAccentColor = isAdventure ? "#d4a373" : "#ea580c";

    let articleClass = `blog-article-print transition-all duration-300 ${paddingClass} `;
    let styleObj: React.CSSProperties = {};

    if (border === "dashed-warm") {
      articleClass += "bg-[#FAF7F0] border-2 border-dashed border-[#E4DEC6] rounded-[24px] shadow-[0_8px_20px_rgba(180,170,140,0.15)] mx-2 my-3 relative overflow-hidden";
    } else if (border === "solid-accent") {
      articleClass += "bg-white border-[4px] rounded-none shadow-lg mx-2 my-3";
      styleObj = { borderColor: customAccentColor };
    } else if (border === "double-vintage") {
      articleClass += "bg-[#FCFAF2] border-[5px] border-double border-[#5C4D3C] rounded-[4px] shadow-[0_6px_22px_rgba(90,80,60,0.12)] mx-2 my-3";
    } else if (border === "solid-block") {
      const blockBg = isAdventure ? "#1E3E54" : "#853E2B"; // deep navy or terracotta block
      articleClass += "text-stone-50 rounded-[16px] shadow-[0_10px_25px_rgba(0,0,0,0.08)] mx-2 my-3 border border-transparent";
      styleObj = { backgroundColor: blockBg };
    } else {
      // none or default
      if (themeStyle === "magazine") {
        articleClass += "bg-gradient-to-br from-white to-stone-50/70 border border-stone-200/80 border-l-[6px] border-orange-500 shadow-[0_10px_25px_rgba(0,0,0,0.03)] rounded-r-3xl rounded-l-md mx-2 my-3";
      } else if (themeStyle === "travelbook") {
        articleClass += "bg-[#FCFAF2] border border-[#5C4D3C]/30 rounded-lg shadow-md mx-2 my-3";
      } else {
        articleClass += "bg-transparent border-none";
      }
    }

    // Adapt typography styling depending on themeStyle and dark block layout overrides
    const headerColorClass = isSolidBlock 
      ? "text-white" 
      : themeStyle === "journal" 
      ? "text-[#3C362A]" 
      : themeStyle === "travelbook"
      ? "text-[#4E3629]"
      : themeStyle === "magazine"
      ? "text-orange-600 font-extrabold uppercase tracking-tight"
      : "text-stone-950";

    const titleFontClass = 
      themeStyle === "journal" 
        ? "serif-font italic" 
        : themeStyle === "magazine" 
        ? "title-font font-black tracking-tight"
        : themeStyle === "travelbook"
        ? "serif-font font-black italic text-[#4E3629]"
        : isAdventure || isElegant ? 'serif-font italic' : 'title-font';

    const textFontClass = 
      themeStyle === "journal" 
        ? "text-[#4A4335] font-serif tracking-wide" 
        : themeStyle === "travelbook"
        ? "text-[#3E342F] font-serif tracking-wide leading-relaxed"
        : themeStyle === "magazine" 
        ? "text-stone-900 leading-relaxed pl-4 border-l-2 border-stone-200" 
        : "text-stone-800";

    const textColorClass = isSolidBlock ? "text-stone-100" : textFontClass;
    const metaColorClass = isSolidBlock ? "text-stone-300" : "text-stone-400";

    return (
      <article className={articleClass} style={styleObj}>
        <div className="w-full">
          {/* Metadata banner under Title to fully recover 100% horizontal space */}
          <header className={`mb-4 pb-3 border-b ${
            isSolidBlock
              ? "border-white/20"
              : themeStyle === "journal" 
              ? "border-[#E4DEC6]/60" 
              : "border-stone-200"
          }`}>
            <h2 
              contentEditable={isInteractive}
              suppressContentEditableWarning
              onBlur={(e) => {
                const newTitle = e.currentTarget.innerText;
                handleUpdateElement(el.id, { content: { ...post, title: newTitle } });
              }}
              className={`text-4xl font-black leading-tight mb-3 outline-none ${titleFontClass} ${headerColorClass}`}
            >
              {post.title}
            </h2>
            
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] font-black uppercase tracking-[0.2em] ${metaColorClass}`}>
              <span style={isSolidBlock ? {} : { color: customAccentColor }}>
                {date.toLocaleDateString("cs-CZ")} o {date.toLocaleTimeString("cs-CZ", { hour: '2-digit', minute: '2-digit' })}
              </span>
              {post.locations?.[0] && (
                <div className="flex items-center gap-1.5">
                  <span className="opacity-40">•</span>
                  <MapPin size={12} style={isSolidBlock ? {} : { color: customAccentColor }} />
                  <span>{post.locations[0].placeName || post.locations[0].address}</span>
                </div>
              )}
            </div>
          </header>

          <div className="flex flex-col gap-4">
            {paragraphs.map((para: string, pIdx: number) => {
              const imagesPerPara = Math.ceil(images.length / (paragraphs.length || 1));
              const paraImages = images.slice(pIdx * imagesPerPara, (pIdx + 1) * imagesPerPara);
              
              let columnClass = "columns-2 gap-4 my-4";
              let mbClass = "mb-4";
              if (density === "compact") {
                columnClass = "columns-3 gap-3 my-3";
                mbClass = "mb-3";
              } else if (density === "thumbnail") {
                columnClass = "columns-4 gap-2 my-2";
                mbClass = "mb-2";
              }

              return (
                <div key={pIdx} className="space-y-4">
                  <div className={`relative font-medium ${fontSizeClass} ${textColorClass}`}>
                    {pIdx === 0 && showDropCap && (
                      <span className={`drop-cap-print ${
                        themeStyle === "journal" 
                          ? "text-[#8C7A5F] opacity-50 font-serif" 
                          : themeStyle === "travelbook"
                          ? "text-[#5C4D3C] opacity-50 font-serif"
                          : themeStyle === "magazine" 
                          ? "text-orange-600 opacity-80" 
                          : ""
                      }`}>
                        {para.charAt(0)}
                      </span>
                    )}
                    <p 
                      contentEditable={isInteractive}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const updatedText = e.currentTarget.innerText;
                        const finalParaText = (pIdx === 0 && showDropCap) 
                          ? para.charAt(0) + updatedText 
                          : updatedText;
                        
                        const originalIdx = startPara + pIdx;
                        const newAllParagraphs = [...allParagraphs];
                        newAllParagraphs[originalIdx] = finalParaText;
                        const newDescription = newAllParagraphs.join("\n\n");
                        handleUpdateElement(el.id, { content: { ...post, description: newDescription } });
                      }}
                      className="whitespace-pre-wrap outline-none focus:bg-orange-500/5 p-1 rounded transition-colors"
                    >
                      {pIdx === 0 && showDropCap ? para.slice(1) : para}
                    </p>
                  </div>

                  {density !== "hidden" && paraImages.length > 0 && (
                    <div className={`${columnClass} w-full`}>
                      {paraImages.map((att: any, attIdx: number) => {
                        const isLarge = largeImageIds.includes(att.id);
                        
                        let wrapperStyle: React.CSSProperties = isLarge ? { columnSpan: "all" } : {};
                        let actualWrapperClass = "";
                        let showWashiTape = false;
                        let showPhotoCorners = false;

                        // Deterministic stable angle rotation computation
                        const hash = att.id.split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
                        
                        if (pStyle === "polaroid") {
                          const angle = (hash % 7) - 3; // -3 to +3
                          wrapperStyle = {
                            ...wrapperStyle,
                            transform: `rotate(${angle}deg)`,
                          };
                          actualWrapperClass = `break-inside-avoid block w-fit max-w-full mx-auto border-[8px] border-b-[28px] border-white bg-white p-0.5 shadow-md shadow-stone-500/20 rounded-sm relative group overflow-hidden ${mbClass}`;
                          showWashiTape = true;
                        } else if (pStyle === "scrapbook") {
                          const angle = (hash % 9) - 4; // -4 to +4
                          wrapperStyle = {
                            ...wrapperStyle,
                            transform: `rotate(${angle}deg)`,
                          };
                          actualWrapperClass = `break-inside-avoid block w-fit max-w-full mx-auto border-[6px] border-white bg-[#F4EFE6] p-0.5 shadow-[2px_4px_12px_rgba(0,0,0,0.12)] rounded-sm relative group ${mbClass}`;
                          showPhotoCorners = true;
                        } else if (pStyle === "tilted") {
                          const angle = attIdx % 2 === 0 ? -4 : 5;
                          wrapperStyle = {
                            ...wrapperStyle,
                            transform: `rotate(${angle}deg)`,
                          };
                          actualWrapperClass = `break-inside-avoid block w-fit max-w-full mx-auto border-[6px] border-white bg-white p-0.5 shadow-xl relative group ${mbClass}`;
                        } else if (pStyle === "circle-oval") {
                          actualWrapperClass = `break-inside-avoid block w-fit max-w-full mx-auto rounded-t-[100px] rounded-b-[20px] shadow-lg border border-stone-200/40 bg-white p-1 relative group overflow-hidden ${mbClass}`;
                        } else {
                          // standard
                          actualWrapperClass = isAdventure
                            ? `break-inside-avoid block w-fit max-w-full mx-auto border-[8px] border-white bg-white p-0.5 shadow-md shadow-stone-400/30 rounded-sm relative group overflow-hidden ${mbClass}`
                            : `break-inside-avoid block w-fit max-w-full mx-auto rounded-2xl shadow-xl bg-transparent relative group overflow-hidden ${mbClass}`;
                        }

                        return (
                          <div 
                            key={att.id} 
                            className={actualWrapperClass}
                            style={wrapperStyle}
                          >
                            {showWashiTape && (
                              // Semi-transparent washi tape holding the Polaroid in place!
                              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-10 h-3.5 bg-amber-100/40 border-l border-r border-amber-200/20 shadow-sm rotate-[-3deg] pointer-events-none select-none z-[10]" />
                            )}

                            {showPhotoCorners && (
                              <>
                                {/* Triangular leather corner overlays for authentic physical album scrapbooking */}
                                <div className="absolute top-0 left-0 w-4 h-4 bg-[#3E2723] z-10 pointer-events-none border-r border-b border-black/10 shadow-sm" style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />
                                <div className="absolute top-0 right-0 w-4 h-4 bg-[#3E2723] z-10 pointer-events-none border-l border-b border-black/10 shadow-sm" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }} />
                                <div className="absolute bottom-0 left-0 w-4 h-4 bg-[#3E2723] z-10 pointer-events-none border-r border-t border-black/10 shadow-sm" style={{ clipPath: "polygon(0 0, 0 100%, 100% 100%)" }} />
                                <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#3E2723] z-10 pointer-events-none border-l border-t border-black/10 shadow-sm" style={{ clipPath: "polygon(100% 0, 0 100%, 100% 100%)" }} />
                              </>
                            )}

                            <img src={att.url} className={`${imgHeightClass} block mx-auto transition-all`} />
                            
                            {isInteractive && (
                              <div className="no-print absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/75 backdrop-blur-sm p-1 rounded-lg z-[20]">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentLarge = [...largeImageIds];
                                    const idx = currentLarge.indexOf(att.id);
                                    if (idx > -1) currentLarge.splice(idx, 1);
                                    else currentLarge.push(att.id);
                                    handleUpdateElement(el.id, { largeImageIds: currentLarge });
                                  }}
                                  title="Zvětšit / Zmenšit"
                                  className="p-1 hover:text-orange-400 text-white transition-colors"
                                >
                                  <Maximize size={12} />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentHidden = [...hiddenImageIds, att.id];
                                    handleUpdateElement(el.id, { hiddenImageIds: currentHidden });
                                  }}
                                  title="Skrýt z knihy"
                                  className="p-1 hover:text-red-400 text-white transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Fallback for only images */}
            {paragraphs.length === 0 && density !== "hidden" && images.length > 0 && (
              <div className={density === "compact" ? "columns-3 gap-3 my-3 w-full" : density === "thumbnail" ? "columns-4 gap-2 my-2 w-full" : "columns-2 gap-4 my-4 w-full"}>
                {images.map((att: any, attIdx: number) => {
                  const isLarge = largeImageIds.includes(att.id);
                  const mbClass = density === "compact" ? "mb-3" : density === "thumbnail" ? "mb-2" : "mb-4";
                  
                  let wrapperStyle: React.CSSProperties = isLarge ? { columnSpan: "all" } : {};
                  let actualWrapperClass = "";
                  let showWashiTape = false;
                  let showPhotoCorners = false;

                  const hash = att.id.split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
                  
                  if (pStyle === "polaroid") {
                    const angle = (hash % 7) - 3; // -3 to +3
                    wrapperStyle = {
                      ...wrapperStyle,
                      transform: `rotate(${angle}deg)`,
                    };
                    actualWrapperClass = `break-inside-avoid block w-fit max-w-full mx-auto border-[8px] border-b-[28px] border-white bg-white p-0.5 shadow-md shadow-stone-500/20 rounded-sm relative group overflow-hidden ${mbClass}`;
                    showWashiTape = true;
                  } else if (pStyle === "scrapbook") {
                    const angle = (hash % 9) - 4; // -4 to +4
                    wrapperStyle = {
                      ...wrapperStyle,
                      transform: `rotate(${angle}deg)`,
                    };
                    actualWrapperClass = `break-inside-avoid block w-fit max-w-full mx-auto border-[6px] border-white bg-[#F4EFE6] p-0.5 shadow-[2px_4px_12px_rgba(0,0,0,0.12)] rounded-sm relative group ${mbClass}`;
                    showPhotoCorners = true;
                  } else if (pStyle === "tilted") {
                    const angle = attIdx % 2 === 0 ? -4 : 5;
                    wrapperStyle = {
                      ...wrapperStyle,
                      transform: `rotate(${angle}deg)`,
                    };
                    actualWrapperClass = `break-inside-avoid block w-fit max-w-full mx-auto border-[6px] border-white bg-white p-0.5 shadow-xl relative group ${mbClass}`;
                  } else if (pStyle === "circle-oval") {
                    actualWrapperClass = `break-inside-avoid block w-fit max-w-full mx-auto rounded-t-[100px] rounded-b-[20px] shadow-lg border border-stone-200/40 bg-white p-1 relative group overflow-hidden ${mbClass}`;
                  } else {
                    // standard
                    actualWrapperClass = isAdventure
                      ? `break-inside-avoid block w-fit max-w-full mx-auto border-[8px] border-white bg-white p-0.5 shadow-md shadow-stone-400/30 rounded-sm relative group overflow-hidden ${mbClass}`
                      : `break-inside-avoid block w-fit max-w-full mx-auto rounded-2xl shadow-xl bg-transparent relative group overflow-hidden ${mbClass}`;
                  }

                  return (
                    <div 
                      key={att.id} 
                      className={actualWrapperClass}
                      style={wrapperStyle}
                    >
                      {showWashiTape && (
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-10 h-3.5 bg-amber-100/40 border-l border-r border-amber-200/20 shadow-sm rotate-[-3deg] pointer-events-none select-none z-[10]" />
                      )}

                      {showPhotoCorners && (
                        <>
                          <div className="absolute top-0 left-0 w-4 h-4 bg-[#3E2723] z-10 pointer-events-none border-r border-b border-black/10 shadow-sm" style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />
                          <div className="absolute top-0 right-0 w-4 h-4 bg-[#3E2723] z-10 pointer-events-none border-l border-b border-black/10 shadow-sm" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }} />
                          <div className="absolute bottom-0 left-0 w-4 h-4 bg-[#3E2723] z-10 pointer-events-none border-r border-t border-black/10 shadow-sm" style={{ clipPath: "polygon(0 0, 0 100%, 100% 100%)" }} />
                          <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#3E2723] z-10 pointer-events-none border-l border-t border-black/10 shadow-sm" style={{ clipPath: "polygon(100% 0, 0 100%, 100% 100%)" }} />
                        </>
                      )}

                      <img src={att.url} className={`${imgHeightClass} block mx-auto transition-all`} />
                      
                      {isInteractive && (
                        <div className="no-print absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/75 backdrop-blur-sm p-1 rounded-lg z-[20]">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentLarge = [...largeImageIds];
                              const idx = currentLarge.indexOf(att.id);
                              if (idx > -1) currentLarge.splice(idx, 1);
                              else currentLarge.push(att.id);
                              handleUpdateElement(el.id, { largeImageIds: currentLarge });
                            }}
                            title="Zvětšit / Zmenšit"
                            className="p-1 hover:text-orange-400 text-white transition-colors"
                          >
                            <Maximize size={12} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentHidden = [...hiddenImageIds, att.id];
                              handleUpdateElement(el.id, { hiddenImageIds: currentHidden });
                            }}
                            title="Skrýt z knihy"
                            className="p-1 hover:text-red-400 text-white transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="fixed inset-0 z-[15000] bg-stone-900 flex flex-col font-sans select-none overflow-hidden text-white">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,900;1,900&family=Outfit:wght@300;400;700;900&display=swap');
        
        .paper-bg {
          background-color: #fcfaf7;
          background-image: url("https://www.transparenttextures.com/patterns/paper.png");
        }
        
        .drop-cap-print {
          float: left;
          font-family: 'Playfair Display', serif;
          font-weight: 900;
          line-height: 0.8;
          margin-right: 0.75rem;
          margin-top: 0.3rem;
          font-size: 5rem;
          color: ${accentColor};
          opacity: 0.35;
        }

        .title-font { font-family: 'Outfit', sans-serif; }
        .serif-font { font-family: 'Playfair Display', serif; }
        
        .print-only-container {
          position: absolute;
          left: -9999px;
          top: -9999px;
        }

        @media print {
          body, html { margin: 0; padding: 0; background: white !important; }
          .no-print { display: none !important; }
          .print-only-container {
            position: static !important;
            left: auto !important;
            top: auto !important;
            display: block !important;
          }
          .print-page { 
            display: block !important;
            position: relative !important;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            background: #fcfaf7 !important;
            color: #1c1917 !important;
          }
        }
      `}</style>

      {/* Header */}
      <header className="no-print h-16 bg-black text-white flex items-center justify-between px-6 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="hover:opacity-50 transition-opacity"><X size={24} /></button>
          <div className="h-6 w-px bg-white/10" />
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60">Fotokniha — {folder.title}</h2>
        </div>

        <div className="flex items-center gap-4 bg-white/5 p-1 rounded-xl">
           {["A4", "A5"].map(f => (
             <button key={f} onClick={() => setFormat(f as any)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${format === f ? 'bg-white text-black shadow-lg' : 'opacity-40 hover:opacity-100'}`}>{f}</button>
           ))}
        </div>

        <button onClick={handleExport} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
          <Printer size={14} /> PDF Tisk ({pages.length} stran)
        </button>
      </header>

      <div className="editor-container flex-1 flex overflow-hidden">
        {/* Left Professional Sidebar Panel */}
        <aside className="no-print w-80 bg-stone-950 border-r border-white/10 flex flex-col shrink-0 text-white overflow-y-auto divide-y divide-white/5 scrollbar-hide">
          {/* Section 1: Versions */}
          <div className="p-5 space-y-4">
             <h3 className="text-xs font-black uppercase tracking-wider text-orange-500">Verze knihy</h3>
             <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newVersionName}
                  onChange={(e) => setNewVersionName(e.target.value)}
                  placeholder="Název verze..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                />
                <button 
                  onClick={handleSaveVersion}
                  className="bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl transition-all shrink-0"
                >
                  Uložit
                </button>
             </div>
             
             {savedVersions.length > 0 ? (
               <div className="max-h-36 overflow-y-auto space-y-1.5 scrollbar-hide">
                  {savedVersions.map(ver => (
                    <div key={ver.id} className="flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-xl p-2 transition-all">
                       <button 
                         onClick={() => handleLoadVersion(ver)}
                         className="flex-1 text-left text-xs font-medium truncate pr-2 hover:text-orange-400 text-stone-300"
                       >
                         {ver.name}
                       </button>
                       <button 
                         onClick={() => handleDeleteVersion(ver.id)}
                         className="text-white/40 hover:text-red-400 transition-colors p-1"
                       >
                         <Trash2 size={12} />
                       </button>
                    </div>
                  ))}
               </div>
             ) : (
               <div className="text-[10px] font-bold text-white/30 italic text-center py-1">Žádné uložené verze</div>
             )}
          </div>

          {/* Section 2: Page Manager */}
          <div className="p-5 space-y-3">
             <h3 className="text-xs font-black uppercase tracking-wider text-orange-500">Správa stránek</h3>
             <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleAddPage}
                  className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white rounded-xl p-2.5 text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  <Plus size={14} /> Nová strana
                </button>
                <button 
                  onClick={handleDeletePage}
                  className="flex items-center justify-center gap-2 bg-red-950/20 hover:bg-red-900/20 text-red-400 rounded-xl p-2.5 text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  <Trash2 size={14} /> Smazat stranu
                </button>
             </div>
             <div className="grid grid-cols-2 gap-2 text-xs">
                <button 
                  onClick={() => handleMovePage("up")} 
                  disabled={currentPageIndex === 0}
                  className="bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-white/5 rounded-xl py-2 font-bold uppercase tracking-wider text-[9px] transition-all text-stone-300"
                >
                  Nahoru
                </button>
                <button 
                  onClick={() => handleMovePage("down")} 
                  disabled={currentPageIndex === pages.length - 1}
                  className="bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-white/5 rounded-xl py-2 font-bold uppercase tracking-wider text-[9px] transition-all text-stone-300"
                >
                  Dolů
                </button>
             </div>
             <button 
               onClick={handleAutoPaginateBook}
               className="w-full mt-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl p-2.5 text-[10px] font-black uppercase tracking-wider transition-all shadow-lg hover:shadow-orange-500/10"
             >
               ✨ Auto-rozvržení celé knihy
             </button>
          </div>

          {/* Section 3: Insert Custom Elements */}
          <div className="p-5 space-y-3">
             <h3 className="text-xs font-black uppercase tracking-wider text-orange-500">Vložit na stránku</h3>
             <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleAddCustomText}
                  className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white rounded-xl p-2.5 text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  <Type size={14} /> Vlastní text
                </button>
                <button 
                  onClick={() => setIsImagePickerOpen(true)}
                  className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white rounded-xl p-2.5 text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  <ImageIcon size={14} /> Obrázek
                </button>
             </div>
          </div>

          {/* Section 4: Selected Element Settings */}
          {selectedElement ? (
            <div className="p-5 space-y-4">
               <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-wider text-orange-500">Nastavení prvku</h3>
                  <button onClick={() => setSelectedElementId(null)} className="text-[9px] font-bold text-white/40 hover:text-white uppercase tracking-wider">Zavřít</button>
               </div>
               
               {/* Position Controls */}
               <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block">Pozice</span>
                  <div className="grid grid-cols-4 gap-1 text-center font-bold text-[10px] bg-white/5 p-1 rounded-xl">
                     <button onClick={() => handleUpdateElement(selectedElementId!, { y: Math.max(0, selectedElement.y - 2) })} className="hover:bg-white/10 py-1 rounded-lg">▲ S</button>
                     <button onClick={() => handleUpdateElement(selectedElementId!, { y: Math.min(100, selectedElement.y + 2) })} className="hover:bg-white/10 py-1 rounded-lg">▼ J</button>
                     <button onClick={() => handleUpdateElement(selectedElementId!, { x: Math.max(0, selectedElement.x - 2) })} className="hover:bg-white/10 py-1 rounded-lg">◀ Z</button>
                     <button onClick={() => handleUpdateElement(selectedElementId!, { x: Math.min(100, selectedElement.x + 2) })} className="hover:bg-white/10 py-1 rounded-lg">▶ V</button>
                  </div>
               </div>

               {/* Width & Rotation Controls */}
               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                     <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block">Šířka (%)</span>
                     <div className="flex bg-white/5 rounded-xl p-1 items-center justify-between text-xs">
                        <button onClick={() => handleUpdateElement(selectedElementId!, { width: Math.max(10, selectedElement.width - 5) })} className="px-2 py-0.5 font-black hover:bg-white/10 rounded">-</button>
                        <span>{selectedElement.width}%</span>
                        <button onClick={() => handleUpdateElement(selectedElementId!, { width: Math.min(100, selectedElement.width + 5) })} className="px-2 py-0.5 font-black hover:bg-white/10 rounded">+</button>
                     </div>
                  </div>
                  <div className="space-y-1">
                     <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block">Otočení</span>
                     <div className="flex bg-white/5 rounded-xl p-1 items-center justify-between text-xs">
                        <button onClick={() => handleUpdateElement(selectedElementId!, { rotation: (selectedElement.rotation || 0) - 5 })} className="px-2 py-0.5 font-black hover:bg-white/10 rounded">↺</button>
                        <span>{selectedElement.rotation || 0}°</span>
                        <button onClick={() => handleUpdateElement(selectedElementId!, { rotation: (selectedElement.rotation || 0) + 5 })} className="px-2 py-0.5 font-black hover:bg-white/10 rounded">↻</button>
                     </div>
                  </div>
               </div>

                {/* Theme / Style Selector - For custom-text and blog-entry */}
                {(selectedElement.type === "blog-entry" || selectedElement.type === "custom-text") && (
                  <div className="space-y-4">
                     <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block">Styl rozvržení</span>
                        <div className="grid grid-cols-2 gap-1 text-[8px] font-black uppercase tracking-wider text-center bg-white/5 p-1 rounded-xl">
                           {(["clean", "journal", "magazine", "travelbook"] as const).map(style => (
                              <button 
                                key={style} 
                                onClick={() => handleUpdateElement(selectedElementId!, { themeStyle: style })}
                                className={`py-1.5 rounded-lg transition-all ${selectedElement.themeStyle === style || (!selectedElement.themeStyle && style === "clean") ? 'bg-white text-black font-black shadow-md' : 'hover:bg-white/5 text-white/60'}`}
                              >
                                 {style === "clean" ? "Modern" : style === "journal" ? "Deník" : style === "magazine" ? "Editorial" : "Cestokniha"}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block">Ohraničení textu (Rámeček)</span>
                        <div className="grid grid-cols-2 gap-1 text-[8px] font-black uppercase tracking-wider text-center bg-white/5 p-1 rounded-xl">
                           {(["none", "solid-accent", "dashed-warm", "double-vintage", "solid-block"] as const).map(bStyle => (
                              <button 
                                key={bStyle} 
                                onClick={() => handleUpdateElement(selectedElementId!, { borderStyle: bStyle })}
                                className={`py-1.5 rounded-lg transition-all ${selectedElement.borderStyle === bStyle || (!selectedElement.borderStyle && bStyle === "none") ? 'bg-white text-black font-black shadow-md' : 'hover:bg-white/5 text-white/60'} ${bStyle === "solid-block" ? "col-span-2" : ""}`}
                              >
                                 {bStyle === "none" ? "Bez rámečku" : bStyle === "solid-accent" ? "Dolce Vita" : bStyle === "dashed-warm" ? "Deníkový" : bStyle === "double-vintage" ? "Retro dvojitý" : "Accent barevný blok"}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block">Styl a úhly fotek</span>
                        <div className="grid grid-cols-2 gap-1 text-[8px] font-black uppercase tracking-wider text-center bg-white/5 p-1 rounded-xl">
                           {(["standard", "polaroid", "scrapbook", "tilted", "circle-oval"] as const).map(pStyle => (
                              <button 
                                key={pStyle} 
                                onClick={() => handleUpdateElement(selectedElementId!, { photoStyle: pStyle })}
                                className={`py-1.5 rounded-lg transition-all ${selectedElement.photoStyle === pStyle || (!selectedElement.photoStyle && pStyle === "standard") ? 'bg-white text-black font-black shadow-md' : 'hover:bg-white/5 text-white/60'} ${pStyle === "circle-oval" ? "col-span-2" : ""}`}
                              >
                                 {pStyle === "standard" ? "Standard" : pStyle === "polaroid" ? "Polaroid" : pStyle === "scrapbook" ? "Scrapbook (rožky)" : pStyle === "tilted" ? "Koláž (úhly)" : "Magazínový oblouk"}
                              </button>
                           ))}
                        </div>
                     </div>
                  </div>
                )}

               {/* Typography - For custom-text and blog-entry */}
               {(selectedElement.type === "blog-entry" || selectedElement.type === "custom-text") && (
                 <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block">Velikost písma</span>
                    <div className="grid grid-cols-4 gap-1 text-[9px] font-black uppercase tracking-wider text-center bg-white/5 p-1 rounded-xl">
                       {(["sm", "base", "lg", "xl"] as const).map(sz => (
                          <button 
                            key={sz} 
                            onClick={() => handleUpdateElement(selectedElementId!, { fontSize: sz })}
                            className={`py-1 rounded-lg transition-all ${selectedElement.fontSize === sz || (!selectedElement.fontSize && sz === "base") ? 'bg-white text-black' : 'hover:bg-white/5 text-white/60'}`}
                          >
                             {sz}
                          </button>
                       ))}
                    </div>
                 </div>
               )}

                {/* Image Size - For blog-entry */}
                {selectedElement.type === "blog-entry" && selectedElement.imageDensity !== "hidden" && (
                  <div className="space-y-2 mb-4">
                     <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block">Velikost fotek</span>
                     <div className="grid grid-cols-4 gap-1 text-[8px] font-black uppercase tracking-wider text-center bg-white/5 p-1 rounded-xl">
                        {(["small", "medium", "large", "original"] as const).map(sz => (
                           <button 
                             key={sz} 
                             onClick={() => handleUpdateElement(selectedElementId!, { imageSize: sz })}
                             className={`py-1 rounded transition-all ${selectedElement.imageSize === sz || (!selectedElement.imageSize && sz === "medium") ? 'bg-white text-black font-black' : 'hover:bg-white/5 text-white/60'}`}
                           >
                              {sz === "small" ? "Malé" : sz === "medium" ? "Střed" : sz === "large" ? "Velké" : "Pův."}
                           </button>
                        ))}
                     </div>
                  </div>
                )}

               {/* Image Density - For blog-entry */}
               {selectedElement.type === "blog-entry" && (
                 <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block">Hustota obrázků</span>
                    <div className="grid grid-cols-2 gap-1 text-[8px] font-black uppercase tracking-wider text-center bg-white/5 p-1 rounded-xl">
                       {(["standard", "compact", "thumbnail", "hidden"] as const).map(ds => (
                          <button 
                            key={ds} 
                            onClick={() => handleUpdateElement(selectedElementId!, { imageDensity: ds })}
                            className={`py-1 rounded transition-all ${selectedElement.imageDensity === ds || (!selectedElement.imageDensity && ds === "standard") ? 'bg-white text-black font-black' : 'hover:bg-white/5 text-white/60'}`}
                          >
                             {ds === "standard" ? "Standard" : ds === "compact" ? "Kompakt" : ds === "thumbnail" ? "Collage" : "Skrýt"}
                          </button>
                       ))}
                    </div>
                 </div>
               )}

               {/* Split / Paragraph Pagination Controls - For blog-entry */}
               {selectedElement.type === "blog-entry" && (
                 <div className="space-y-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-orange-500 block">Rozdělení a stránkování</span>
                    
                    <button
                      onClick={() => handleSplitBlogEntry(selectedElement)}
                      className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black text-[9px] uppercase tracking-wider py-2 rounded-xl transition-all"
                    >
                      Rozdělit příspěvek na 2 strany
                    </button>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-[10px] text-stone-300 font-bold">
                        <span>Zobrazené odstavce:</span>
                        <span className="text-orange-400">
                          {(selectedElement.startParagraphIndex !== undefined ? selectedElement.startParagraphIndex : 0) + 1} 
                          – 
                          {selectedElement.endParagraphIndex !== undefined ? selectedElement.endParagraphIndex : totalParas}
                          / {totalParas}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-[9px] uppercase font-black tracking-wider text-center">
                        <div className="space-y-1">
                          <span className="text-[8px] text-white/40 block">Začátek</span>
                          <div className="flex bg-white/5 rounded-lg p-0.5 justify-between items-center">
                            <button 
                              onClick={() => handleUpdateElement(selectedElementId!, { 
                                startParagraphIndex: Math.max(0, (selectedElement.startParagraphIndex ?? 0) - 1) 
                              })}
                              className="px-1.5 py-0.5 hover:bg-white/10 rounded"
                            >
                              -
                            </button>
                            <span className="font-bold text-stone-200">{selectedElement.startParagraphIndex ?? 0}</span>
                            <button 
                              onClick={() => handleUpdateElement(selectedElementId!, { 
                                startParagraphIndex: Math.min(totalParas - 1, (selectedElement.startParagraphIndex ?? 0) + 1) 
                              })}
                              className="px-1.5 py-0.5 hover:bg-white/10 rounded"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[8px] text-white/40 block">Konec</span>
                          <div className="flex bg-white/5 rounded-lg p-0.5 justify-between items-center">
                            <button 
                              onClick={() => handleUpdateElement(selectedElementId!, { 
                                endParagraphIndex: Math.max(1, (selectedElement.endParagraphIndex ?? totalParas) - 1) 
                              })}
                              className="px-1.5 py-0.5 hover:bg-white/10 rounded"
                            >
                              -
                            </button>
                            <span className="font-bold text-stone-200">{selectedElement.endParagraphIndex ?? totalParas}</span>
                            <button 
                              onClick={() => handleUpdateElement(selectedElementId!, { 
                                endParagraphIndex: Math.min(totalParas, (selectedElement.endParagraphIndex ?? totalParas) + 1) 
                              })}
                              className="px-1.5 py-0.5 hover:bg-white/10 rounded"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {(selectedElement.startParagraphIndex !== undefined || selectedElement.endParagraphIndex !== undefined) && (
                        <button
                          onClick={() => handleUpdateElement(selectedElementId!, { 
                            startParagraphIndex: undefined,
                            endParagraphIndex: undefined
                          })}
                          className="w-full bg-white/5 hover:bg-white/10 text-stone-300 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all"
                        >
                          Zobrazit všechny odstavce
                        </button>
                      )}
                    </div>
                 </div>
               )}

               {/* Padding Y - For blog-entry and custom-text */}
               <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block">Vnitřní okraje</span>
                  <div className="grid grid-cols-4 gap-1 text-[8px] font-black uppercase tracking-wider text-center bg-white/5 p-1 rounded-xl">
                     {(["none", "small", "medium", "large"] as const).map(pd => (
                        <button 
                          key={pd} 
                          onClick={() => handleUpdateElement(selectedElementId!, { paddingY: pd })}
                          className={`py-1 rounded transition-all ${selectedElement.paddingY === pd || (!selectedElement.paddingY && pd === "medium") ? 'bg-white text-black font-black' : 'hover:bg-white/5 text-white/60'}`}
                        >
                           {pd === "none" ? "Bez" : pd === "small" ? "Malé" : pd === "medium" ? "Střed" : "Velké"}
                        </button>
                     ))}
                  </div>
               </div>

               {/* Propagate Style to All Pages */}
               <button 
                 onClick={handlePropagateSelectedStyle}
                 className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl py-2.5 text-[10px] font-black uppercase tracking-wider transition-all mb-2"
               >
                 ✨ Použít tento vzhled pro celou knihu
               </button>

               {/* Delete Element Button */}
               <button 
                 onClick={() => handleDeleteElement(selectedElementId!)}
                 className="w-full flex items-center justify-center gap-2 bg-red-950/20 hover:bg-red-900/20 text-red-400 rounded-xl py-2.5 text-[10px] font-black uppercase tracking-wider transition-all"
               >
                 <Trash2 size={12} /> Odstranit prvek
               </button>
            </div>
          ) : (
            <div className="p-5 space-y-5">
               <div className="bg-gradient-to-r from-orange-600/10 to-amber-600/10 border border-orange-500/20 rounded-2xl p-4 space-y-2">
                 <h3 className="text-xs font-black uppercase tracking-wider text-orange-500">Globální vzhled knihy</h3>
                 <p className="text-[10px] text-stone-300 font-medium leading-relaxed">
                   Zde můžete nastavit výchozí vzhled a rámečky pro všechny stránky v knize najednou. Kliknutím na libovolný prvek jej můžete upravit individuálně.
                 </p>
               </div>

               {/* Global Theme Style */}
               <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block">Globální šablona</span>
                  <div className="grid grid-cols-2 gap-1 text-[8px] font-black uppercase tracking-wider text-center bg-white/5 p-1 rounded-xl">
                     {(["clean", "journal", "magazine", "travelbook"] as const).map(style => (
                        <button 
                          key={style} 
                          onClick={() => handleApplyGlobalStyle({ themeStyle: style })}
                          className="py-1.5 rounded-lg transition-all hover:bg-white/5 text-white/60"
                        >
                           {style === "clean" ? "Modern" : style === "journal" ? "Deník" : style === "magazine" ? "Editorial" : "Cestokniha"}
                        </button>
                     ))}
                  </div>
               </div>

               {/* Global Border Style */}
               <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block">Globální ohraničení (Rámeček)</span>
                  <div className="grid grid-cols-2 gap-1 text-[8px] font-black uppercase tracking-wider text-center bg-white/5 p-1 rounded-xl">
                     {(["none", "solid-accent", "dashed-warm", "double-vintage", "solid-block"] as const).map(bStyle => (
                        <button 
                          key={bStyle} 
                          onClick={() => handleApplyGlobalStyle({ borderStyle: bStyle })}
                          className={`py-1.5 rounded-lg transition-all hover:bg-white/5 text-white/60 ${bStyle === "solid-block" ? "col-span-2" : ""}`}
                        >
                           {bStyle === "none" ? "Bez rámečku" : bStyle === "solid-accent" ? "Dolce Vita" : bStyle === "dashed-warm" ? "Deníkový" : bStyle === "double-vintage" ? "Retro dvojitý" : "Accent barevný blok"}
                        </button>
                     ))}
                  </div>
               </div>

               {/* Global Photo Style */}
               <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block">Globální styl a úhly fotek</span>
                  <div className="grid grid-cols-2 gap-1 text-[8px] font-black uppercase tracking-wider text-center bg-white/5 p-1 rounded-xl">
                     {(["standard", "polaroid", "scrapbook", "tilted", "circle-oval"] as const).map(pStyle => (
                        <button 
                          key={pStyle} 
                          onClick={() => handleApplyGlobalStyle({ photoStyle: pStyle })}
                          className={`py-1.5 rounded-lg transition-all hover:bg-white/5 text-white/60 ${pStyle === "circle-oval" ? "col-span-2" : ""}`}
                        >
                           {pStyle === "standard" ? "Standard" : pStyle === "polaroid" ? "Polaroid" : pStyle === "scrapbook" ? "Scrapbook" : pStyle === "tilted" ? "Koláž" : "Magazínový oblouk"}
                        </button>
                     ))}
                  </div>
               </div>

               {/* Global Image Density */}
               <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block">Globální hustota obrázků</span>
                  <div className="grid grid-cols-2 gap-1 text-[8px] font-black uppercase tracking-wider text-center bg-white/5 p-1 rounded-xl">
                     {(["standard", "compact", "thumbnail", "hidden"] as const).map(ds => (
                        <button 
                          key={ds} 
                          onClick={() => handleApplyGlobalStyle({ imageDensity: ds })}
                          className="py-1 rounded transition-all hover:bg-white/5 text-white/60"
                        >
                           {ds === "standard" ? "Standard" : ds === "compact" ? "Kompakt" : ds === "thumbnail" ? "Collage" : "Skrýt"}
                        </button>
                     ))}
                  </div>
               </div>

               {/* Global Padding */}
               <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block">Globální vnitřní okraje</span>
                  <div className="grid grid-cols-4 gap-1 text-[8px] font-black uppercase tracking-wider text-center bg-white/5 p-1 rounded-xl">
                     {(["none", "small", "medium", "large"] as const).map(pd => (
                        <button 
                          key={pd} 
                          onClick={() => handleApplyGlobalStyle({ paddingY: pd })}
                          className="py-1 rounded transition-all hover:bg-white/5 text-white/60"
                        >
                           {pd === "none" ? "Bez" : pd === "small" ? "Malé" : pd === "medium" ? "Střed" : "Velké"}
                        </button>
                     ))}
                  </div>
               </div>
            </div>
          )}
        </aside>

        {/* Editor Board Area */}
        <div className="flex-1 overflow-auto p-12 flex flex-col items-center gap-6 bg-stone-950/50 scrollbar-hide no-print">
           <div className="text-white/40 text-[10px] font-black uppercase tracking-widest">
              NÁHLED STRÁNKY — {currentPageIndex + 1} Z {pages.length}
           </div>

           {/* The Interactive Page Canvas */}
           <div 
             ref={pageRef}
             className={`print-page relative paper-bg shadow-2xl flex-shrink-0 transition-all duration-500 overflow-hidden text-stone-950 ${format === 'A4' ? 'w-[794px] h-[1123px]' : 'w-[559px] h-[794px]'}`}
             onClick={() => setSelectedElementId(null)}
           >
              {pages[currentPageIndex]?.elements.map((el) => (
                <div 
                  key={el.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedElementId(el.id); }}
                  className={`absolute group transition-all absolute-element-container ${selectedElementId === el.id ? 'border border-orange-500 bg-orange-500/5 z-[100]' : 'border border-transparent hover:border-orange-500/10'}`}
                  style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`, transform: el.rotation ? `rotate(${el.rotation}deg)` : 'none' }}
                >
                  {el.type === 'blog-entry' ? (
                    <BlogEntryRenderer post={el.content} el={el} isInteractive={true} />
                  ) : el.type === 'custom-text' ? (
                    <textarea 
                      className={`w-full bg-transparent outline-none resize-none serif-font p-4 text-stone-900 border border-dashed border-stone-300 focus:border-stone-500 rounded-lg ${
                        el.fontSize === "sm" ? "text-sm" : 
                        el.fontSize === "lg" ? "text-lg" : 
                        el.fontSize === "xl" ? "text-xl" : "text-base"
                      }`} 
                      value={el.content} 
                      onChange={(e) => handleUpdateElement(el.id, { content: e.target.value })} 
                    />
                  ) : el.type === 'custom-image' ? (
                    <div className="relative w-full h-full flex justify-center items-center group/img">
                      <img src={el.content} className="max-w-full max-h-[500px] object-contain rounded-lg shadow-md border border-stone-200/40 p-1" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteElement(el.id); }}
                        className="no-print absolute top-2 right-2 bg-black/80 hover:bg-red-600 text-white rounded-lg p-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity"
                      >
                         <Trash2 size={12} />
                      </button>
                    </div>
                  ) : el.type === 'journey-map' ? (
                    <div className={`px-12 py-12 flex flex-col justify-start items-center text-stone-900 w-full ${format === "A4" ? "h-[1000px]" : "h-[680px]"}`}>
                      <div className="w-full text-center space-y-2 mt-4 mb-2">
                         <span className="text-[11px] font-black uppercase tracking-[0.4em] text-orange-600 block">Expedice</span>
                         <h1 className="text-5xl font-black tracking-tight leading-none text-stone-950 serif-font italic">
                            {el.content.title}
                         </h1>
                         <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-2">
                            {el.content.totalDistance} km • {el.content.points.length} zastávek
                         </div>
                         <div className="h-0.5 w-16 bg-orange-600/30 mx-auto mt-2" />
                      </div>
                      
                      <div className={`w-full mt-4 flex-1 ${format === "A4" ? "h-[740px] min-h-[660px]" : "h-[460px] min-h-[400px]"} relative rounded-3xl overflow-hidden border border-stone-200 shadow-xl bg-white p-2`}>
                         <JourneyMap points={el.content.points} id={`editor-print-map-${el.id}`} className="w-full h-full rounded-2xl" />
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
              
              <div className="absolute bottom-10 left-0 w-full text-center text-[10px] font-black uppercase tracking-widest opacity-30">— {currentPageIndex + 1} —</div>
           </div>

           {/* Page Navigation Controls */}
           <div className="no-print flex flex-col items-center gap-4 mt-2">
              {pageOverflows[currentPageIndex] && (
                <div className="bg-red-950/60 border border-red-500/30 text-red-200 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 max-w-lg shadow-xl animate-pulse no-print select-none">
                  <span className="text-sm">⚠️</span>
                  <span>Obsah této strany přesahuje tiskovou plochu. Zkuste snížit hustotu fotek, jejich velikost nebo zmenšit písmo.</span>
                </div>
              )}

              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setCurrentPageIndex(p => Math.max(0, p-1))}
                  disabled={currentPageIndex === 0}
                  className="p-3 bg-stone-850 text-white rounded-2xl hover:bg-stone-800 disabled:opacity-20 disabled:hover:bg-stone-850 transition-all border border-white/5 shadow-xl"
                >
                   <ChevronLeft size={20} />
                </button>
                
                <div className="text-white/80 text-xs font-black uppercase tracking-widest bg-stone-850 px-6 py-3 rounded-2xl border border-white/10 shadow-xl">
                   Strana {currentPageIndex + 1} z {pages.length}
                </div>

                <button 
                  onClick={() => setCurrentPageIndex(p => Math.min(pages.length-1, p+1))}
                  disabled={currentPageIndex === pages.length - 1}
                  className="p-3 bg-stone-850 text-white rounded-2xl hover:bg-stone-800 disabled:opacity-20 disabled:hover:bg-stone-850 transition-all border border-white/5 shadow-xl"
                >
                   <ChevronRight size={20} />
                </button>
              </div>
           </div>
        </div>
      </div>

      {/* OFF-SCREEN COMPILATION FOR PERFECT ALL-PAGES PDF PRINTING */}
      <div className="print-only-container">
         {pages.map((page, pageIdx) => (
           <div 
             key={pageIdx} 
             className={`print-page relative paper-bg overflow-hidden text-stone-950 ${format === 'A4' ? 'w-[794px] h-[1123px]' : 'w-[559px] h-[794px]'}`}
           >
              {page.elements.map((el) => (
                <div 
                  key={el.id}
                  className="absolute"
                  style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`, transform: el.rotation ? `rotate(${el.rotation}deg)` : 'none' }}
                >
                  {el.type === 'blog-entry' ? (
                    <BlogEntryRenderer post={el.content} el={el} isInteractive={false} />
                  ) : el.type === 'custom-text' ? (
                    <p 
                      className={`w-full bg-transparent serif-font p-4 text-stone-900 whitespace-pre-wrap ${
                        el.fontSize === "sm" ? "text-sm" : 
                        el.fontSize === "lg" ? "text-lg" : 
                        el.fontSize === "xl" ? "text-xl" : "text-base"
                      }`}
                    >
                      {el.content}
                    </p>
                  ) : el.type === 'custom-image' ? (
                    <div className="relative w-full h-full flex justify-center items-center">
                      <img src={el.content} className="max-w-full max-h-[600px] object-contain rounded-lg shadow-md" />
                    </div>
                  ) : el.type === 'journey-map' ? (
                    <div className={`px-12 py-12 flex flex-col justify-start items-center text-stone-900 w-full ${format === "A4" ? "h-[1000px]" : "h-[680px]"}`}>
                      <div className="w-full text-center space-y-2 mt-4 mb-2">
                         <span className="text-[11px] font-black uppercase tracking-[0.4em] text-orange-600 block">Expedice</span>
                         <h1 className="text-5xl font-black tracking-tight leading-none text-stone-950 serif-font italic">
                            {el.content.title}
                         </h1>
                         <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-2">
                            {el.content.totalDistance} km • {el.content.points.length} zastávek
                         </div>
                         <div className="h-0.5 w-16 bg-orange-600/30 mx-auto mt-2" />
                      </div>
                      
                      <div className={`w-full mt-4 flex-1 ${format === "A4" ? "h-[740px] min-h-[660px]" : "h-[460px] min-h-[400px]"} relative rounded-3xl overflow-hidden border border-stone-200 shadow-xl bg-white p-2`}>
                         <JourneyMap points={el.content.points} id={`print-map-${el.id}`} className="w-full h-full rounded-2xl" />
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
              <div className="absolute bottom-10 left-0 w-full text-center text-[10px] font-black uppercase tracking-widest opacity-30">— {pageIdx + 1} —</div>
           </div>
         ))}
      </div>

      {/* Image Picker Modal for inserting images */}
      {isImagePickerOpen && (
        <div className="fixed inset-0 z-[16000] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 no-print">
           <div className="bg-stone-900 border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                 <div>
                    <h3 className="font-black text-sm uppercase tracking-wider text-orange-500">Vložit obrázek</h3>
                    <p className="text-[10px] text-white/50 mt-1">Vyberte fotografii z expedice nebo zadejte externí URL</p>
                 </div>
                 <button onClick={() => setIsImagePickerOpen(false)} className="text-white/40 hover:text-white transition-colors">
                    <X size={20} />
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                 {/* Custom URL Input */}
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block">Vložit externí URL obrázku</label>
                    <div className="flex gap-2">
                       <input 
                         type="text"
                         value={customImageUrl}
                         onChange={(e) => setCustomImageUrl(e.target.value)}
                         placeholder="https://example.com/photo.jpg"
                         className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-orange-500 text-white"
                       />
                       <button 
                         onClick={() => {
                           if (customImageUrl.trim()) {
                             handleAddCustomImage(customImageUrl.trim());
                             setCustomImageUrl("");
                           }
                         }}
                         className="bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black uppercase px-5 py-2 rounded-xl transition-all"
                       >
                          Vložit
                       </button>
                    </div>
                 </div>

                 <div className="h-px bg-white/5" />

                 {/* Expedition Images Grid */}
                 <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block">Fotografie z expedice ({tripImages.length})</label>
                    {tripImages.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3">
                         {tripImages.map((img: any) => (
                           <div 
                             key={img.id} 
                             onClick={() => handleAddCustomImage(img.url)}
                             className="relative aspect-video group cursor-pointer overflow-hidden rounded-xl border border-white/5 hover:border-orange-500 transition-all bg-stone-950"
                           >
                              <img src={img.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] font-black uppercase tracking-widest">
                                 Vložit do knihy
                              </div>
                           </div>
                         ))}
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-white/30 italic py-6 text-center">Tato expedice neobsahuje žádné nahrané fotografie.</div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
