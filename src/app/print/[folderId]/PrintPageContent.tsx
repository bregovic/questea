"use client";

import React, { useEffect, useState, useMemo } from "react";
import { MapPin, Navigation, Calendar } from "lucide-react";
import { JourneyMap } from "@/components/Blog/BlogClient";

interface PrintElement {
  id: string;
  type: "blog-entry" | "custom-text" | "custom-image" | "journey-map";
  content: any;
  x: number;
  y: number;
  width: number;
  height?: number;
  rotation?: number;
  fontSize?: "sm" | "base" | "lg" | "xl";
  imageDensity?: "compact" | "standard" | "thumbnail" | "hidden";
  paddingY?: "none" | "small" | "medium" | "large";
  hiddenImageIds?: string[];
  largeImageIds?: string[];
  imageSize?: "small" | "medium" | "large" | "original";
  themeStyle?: "clean" | "journal" | "magazine" | "travelbook" | "modern" | "editorial";
  borderStyle?: "none" | "solid-accent" | "dashed-warm" | "double-vintage" | "solid-block" | "glassmorphic" | "minimal-thin" | "shadow-floating" | "neo-brutalist";
  photoStyle?: "standard" | "polaroid" | "scrapbook" | "tilted" | "circle-oval" | "modern-glow" | "art-gallery" | "rounded-soft" | "duotone-filter";
  fontFamily?: "default" | "editorial-serif" | "clean-sans" | "avant-garde" | "handwritten";
  blockColor?: "default" | "terracotta" | "navy" | "sage" | "charcoal" | "plum" | "sand" | "rose" | "emerald" | "violet" | "sunset" | "ocean";
  startParagraphIndex?: number;
  endParagraphIndex?: number;
  isContinuation?: boolean;
  customImageHeights?: Record<string, number>;
  customImageFits?: Record<string, "cover" | "contain">;
  customImageZooms?: Record<string, number>;
  customImageOffsets?: Record<string, { x: number; y: number }>;
}

interface PrintPage {
  elements: PrintElement[];
}

interface PrintPageContentProps {
  folder: any;
  posts: any[];
  format: "A4" | "A5";
  style: string;
  startDate: string;
  endDate: string;
}

const splitCzechSentences = (text: string): string[] => {
  if (!text) return [];
  const abbrevs = new Set([
    "st", "sv", "např", "tzv", "tj", "t.j", "zn", "ul", "č", "str", "r", 
    "popř", "cca", "atd", "apod", "bc", "mgr", "ing", "mudr", "phdr", "doc", "prof",
    "vol", "tel", "př", "čl", "tzn", "odd", "odst", "napřiklad", "nást", "nám", "ks"
  ]);

  const sentences: string[] = [];
  const boundaryRegex = /([.!?])(\s+)/g;
  let match;
  let lastIndex = 0;
  
  while ((match = boundaryRegex.exec(text)) !== null) {
    const punctuation = match[1];
    const whitespace = match[2];
    const matchIndex = match.index;
    const textBefore = text.slice(0, matchIndex).trim();
    const parts = textBefore.split(/\s+/);
    const lastWord = parts[parts.length - 1] || "";
    const word = lastWord.replace(/^[^a-zA-Z0-9\u00C0-\u017F]+|[^a-zA-Z0-9\u00C0-\u017F.-]+$/g, "");
    
    let shouldSplit = true;
    
    if (punctuation === ".") {
      const lowerWord = word.toLowerCase().replace(/\.$/, "");
      if (abbrevs.has(lowerWord)) {
        shouldSplit = false;
      }
      else if (/^[A-Z\u00C0-\u017F]$/.test(word)) {
        shouldSplit = false;
      }
      else if (/^\d+$/.test(word)) {
        const nextIndex = matchIndex + punctuation.length + whitespace.length;
        const nextChar = text.charAt(nextIndex);
        if (nextChar && nextChar === nextChar.toLowerCase() && nextChar !== nextChar.toUpperCase()) {
          shouldSplit = false;
        } else {
          if (parseInt(word, 10) <= 120) {
            shouldSplit = false;
          }
        }
      }
    }
    
    if (shouldSplit) {
      const sentence = text.slice(lastIndex, matchIndex + punctuation.length).trim();
      if (sentence) {
        sentences.push(sentence);
      }
      lastIndex = matchIndex + punctuation.length + whitespace.length;
    }
  }
  
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) {
      sentences.push(remaining);
    }
  }
  
  return sentences;
};

const minifySubTask = (t: any) => {
  if (!t) return t;
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    recordedAt: t.recordedAt,
    createdAt: t.createdAt,
    date: t.date,
    locations: t.locations?.map((l: any) => ({
      id: l.id,
      placeName: l.placeName,
      address: l.address,
      latitude: l.latitude,
      longitude: l.longitude
    })) || [],
    attachments: t.attachments?.map((a: any) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      url: a.url,
      aspect: a.aspect
    })) || []
  };
};

const paginateAllSubtasks = (
  subTasks: any[],
  subtaskStyles: Record<string, any>,
  defaultThemeStyle: string,
  defaultBorderStyle: string,
  defaultPhotoStyle: string
): PrintPage[] => {
  const getSentenceChunks = (text: string) => {
    if (!text) return [];
    const sentences = splitCzechSentences(text);
    if (sentences.length < 2) return text ? [text] : []; 
    const chunks = [];
    for (let i = 0; i < sentences.length; i += 2) {
      chunks.push(sentences.slice(i, i + 2).join(" ").trim());
    }
    return chunks;
  };

  const getElementWeight = (el: PrintElement, density: string = "standard") => {
    const isFirstPage = el.startParagraphIndex === 0 && !el.isContinuation;
    const headerWeight = isFirstPage ? 8 : 0;
    
    // Character-based accurate text weight calculation
    const allParas = getSentenceChunks(el.content.description || "");
    const start = el.startParagraphIndex || 0;
    const end = el.endParagraphIndex || 0;
    const paragraphs = allParas.slice(start, end);
    
    const fontSize = el.fontSize || "base";
    let sizeFactor = 1.0;
    if (fontSize === "sm") sizeFactor = 0.85;
    else if (fontSize === "lg") sizeFactor = 1.25;
    else if (fontSize === "xl") sizeFactor = 1.5;
    
    let paraWeight = 0;
    paragraphs.forEach((p: string) => {
      const charCount = p.length;
      const lines = Math.ceil(charCount / 75);
      paraWeight += (lines * 2.5 + 1.5) * sizeFactor;
    });
    
    const shownImages = el.content.attachments?.filter((a: any) => 
      a.type === "image" && !(el.hiddenImageIds || []).includes(a.id)
    ) || [];
    
    let imagesWeight = 0;
    if (density !== "hidden" && shownImages.length > 0) {
      const imagesPerRow = density === "compact" ? 3 : density === "thumbnail" ? 4 : 2;
      let densityFactor = 1.0;
      if (density === "compact") densityFactor = 0.85;
      else if (density === "thumbnail") densityFactor = 0.75;
      
      const imgSize = el.imageSize || "medium";
      
      for (let i = 0; i < shownImages.length; i += imagesPerRow) {
        const rowImages = shownImages.slice(i, i + imagesPerRow);
        let maxRowWeight = 0;
        
        rowImages.forEach((img: any) => {
          const isPortrait = img.aspect ? img.aspect < 0.95 : false;
          let imgWeight = 28; 
          
          if (isPortrait) {
            if (imgSize === "small") imgWeight = 26;
            else if (imgSize === "large") imgWeight = 56;
            else if (imgSize === "original") imgWeight = 42;
            else imgWeight = 42; 
          } else {
            if (imgSize === "small") imgWeight = 18;
            else if (imgSize === "large") imgWeight = 40;
            else if (imgSize === "original") imgWeight = 30;
            else imgWeight = 28; 
          }
          
          if (imgWeight > maxRowWeight) {
            maxRowWeight = imgWeight;
          }
        });
        
        imagesWeight += Math.ceil(maxRowWeight * densityFactor);
      }
    }
    
    return headerWeight + paraWeight + imagesWeight;
  };

  const paginated: PrintPage[] = [];

  subTasks.forEach((rawT: any) => {
    const t = minifySubTask(rawT);
    const savedStyle = subtaskStyles[t.id] || {};
    const density = savedStyle.imageDensity || "standard";
    const allImages = t.attachments?.filter((a: any) => a.type === "image") || [];
    
    const allParas = getSentenceChunks(t.description || "");
    const N = allParas.length;
    const M = allImages.length;
    
    const getCandidateWeight = (start: number, end: number, shownImageIds: string[]) => {
      const tempEl: PrintElement = {
        id: "temp",
        type: "blog-entry",
        content: { ...t, attachments: allImages },
        x: 0,
        y: 0,
        width: 100,
        fontSize: savedStyle.fontSize || "base",
        imageDensity: density,
        paddingY: savedStyle.paddingY || "medium",
        themeStyle: savedStyle.themeStyle || defaultThemeStyle,
        borderStyle: savedStyle.borderStyle || defaultBorderStyle,
        photoStyle: savedStyle.photoStyle || defaultPhotoStyle,
        blockColor: savedStyle.blockColor || "default",
        imageSize: savedStyle.imageSize || "medium",
        startParagraphIndex: start,
        endParagraphIndex: end,
        isContinuation: start > 0,
        hiddenImageIds: allImages
          .filter((img: any) => !shownImageIds.includes(img.id))
          .map((img: any) => img.id)
      };
      return getElementWeight(tempEl, density);
    };

    if (N === 0 && M === 0) {
      let added = false;
      if (paginated.length > 0) {
        const lastPage = paginated[paginated.length - 1];
        const isMap = lastPage.elements.some(el => el.type === "journey-map");
        if (!isMap) {
          let lastPageWeight = 0;
          lastPage.elements.forEach(el => {
            lastPageWeight += getElementWeight(el, el.imageDensity || "standard");
          });
          if (lastPageWeight <= 40 && lastPageWeight + 8 <= 100) {
            lastPage.elements.push({
              id: `entry-${t.id}`,
              type: "blog-entry",
              content: { ...t },
              x: 0,
              y: 0,
              width: 100,
              fontSize: savedStyle.fontSize || "base",
              imageDensity: density,
              paddingY: savedStyle.paddingY || "medium",
              themeStyle: savedStyle.themeStyle || defaultThemeStyle,
              borderStyle: savedStyle.borderStyle || defaultBorderStyle,
              photoStyle: savedStyle.photoStyle || defaultPhotoStyle,
              blockColor: savedStyle.blockColor || "default",
              imageSize: savedStyle.imageSize || "medium",
              startParagraphIndex: 0,
              endParagraphIndex: 0,
              hiddenImageIds: [],
              isContinuation: false
            });
            added = true;
          }
        }
      }
      if (!added) {
        paginated.push({
          elements: [{
            id: `entry-${t.id}`,
            type: "blog-entry",
            content: { ...t },
            x: 0,
            y: 0,
            width: 100,
            fontSize: savedStyle.fontSize || "base",
            imageDensity: density,
            paddingY: savedStyle.paddingY || "medium",
            themeStyle: savedStyle.themeStyle || defaultThemeStyle,
            borderStyle: savedStyle.borderStyle || defaultBorderStyle,
            photoStyle: savedStyle.photoStyle || defaultPhotoStyle,
            blockColor: savedStyle.blockColor || "default",
            imageSize: savedStyle.imageSize || "medium",
            startParagraphIndex: 0,
            endParagraphIndex: 0,
            hiddenImageIds: [],
            isContinuation: false
          }]
        });
      }
      return;
    }
    
    const imagesByParaIdx: Record<number, any[]> = {};
    for (let i = 0; i < N; i++) {
      imagesByParaIdx[i] = [];
    }
    allImages.forEach((img: any, idx: number) => {
      const paraIdx = N > 0 ? Math.min(N - 1, Math.floor((idx / M) * N)) : 0;
      if (!imagesByParaIdx[paraIdx]) imagesByParaIdx[paraIdx] = [];
      imagesByParaIdx[paraIdx].push(img);
    });
    
    let currentStart = 0;
    
    while (currentStart < N || (currentStart === 0 && N === 0 && M > 0)) {
      if (N === 0) {
        const imagesPerRow = density === "compact" ? 3 : density === "thumbnail" ? 4 : 2;
        const imagesPerPage = imagesPerRow * 2;
        let imgIdx = 0;
        while (imgIdx < M) {
          const chunk = allImages.slice(imgIdx, imgIdx + imagesPerPage);
          const chunkImageIds = chunk.map((img: any) => img.id);
          const hiddenImageIds = allImages
            .filter((img: any) => !chunkImageIds.includes(img.id))
            .map((img: any) => img.id);
            
          let added = false;
          if (paginated.length > 0) {
            const lastPage = paginated[paginated.length - 1];
            const isMap = lastPage.elements.some(el => el.type === "journey-map");
            if (!isMap) {
              let lastPageWeight = 0;
              lastPage.elements.forEach(el => {
                lastPageWeight += getElementWeight(el, el.imageDensity || "standard");
              });
              
              let canFit = false;
              if (imgIdx > 0) {
                canFit = true;
              } else {
                const totalSubTaskWeight = getCandidateWeight(0, 0, allImages.map((img: any) => img.id));
                const fitsEntirely = lastPageWeight + totalSubTaskWeight <= 100;
                canFit = fitsEntirely || (lastPageWeight <= 30);
              }
              
              if (canFit) {
                const itemWeight = getCandidateWeight(0, 0, chunkImageIds);
                if (lastPageWeight + itemWeight <= 100) {
                  lastPage.elements.push({
                    id: `entry-${t.id}-img-${imgIdx}`,
                    type: "blog-entry",
                    content: { ...t },
                    x: 0,
                    y: 0,
                    width: 100,
                    fontSize: savedStyle.fontSize || "base",
                    imageDensity: density,
                    paddingY: savedStyle.paddingY || "medium",
                    themeStyle: savedStyle.themeStyle || defaultThemeStyle,
                    borderStyle: savedStyle.borderStyle || defaultBorderStyle,
                    photoStyle: savedStyle.photoStyle || defaultPhotoStyle,
                    blockColor: savedStyle.blockColor || "default",
                    imageSize: savedStyle.imageSize || "medium",
                    startParagraphIndex: 0,
                    endParagraphIndex: 0,
                    hiddenImageIds: hiddenImageIds,
                    isContinuation: imgIdx > 0
                  });
                  added = true;
                }
              }
            }
          }
          if (!added) {
            paginated.push({
              elements: [{
                id: `entry-${t.id}-img-${imgIdx}`,
                type: "blog-entry",
                content: { ...t },
                x: 0,
                y: 0,
                width: 100,
                fontSize: savedStyle.fontSize || "base",
                imageDensity: density,
                paddingY: savedStyle.paddingY || "medium",
                themeStyle: savedStyle.themeStyle || defaultThemeStyle,
                borderStyle: savedStyle.borderStyle || defaultBorderStyle,
                photoStyle: savedStyle.photoStyle || defaultPhotoStyle,
                blockColor: savedStyle.blockColor || "default",
                imageSize: savedStyle.imageSize || "medium",
                startParagraphIndex: 0,
                endParagraphIndex: 0,
                hiddenImageIds: hiddenImageIds,
                isContinuation: imgIdx > 0
              }]
            });
          }
          imgIdx += imagesPerPage;
        }
        break;
      }
      
      let bestEnd = currentStart;
      let fitsOnLastPage = false;
      let useNewPage = false;
      
      if (paginated.length > 0) {
        const lastPage = paginated[paginated.length - 1];
        const isMap = lastPage.elements.some(el => el.type === "journey-map");
        
        if (!isMap) {
          let lastPageWeight = 0;
          lastPage.elements.forEach(el => {
            lastPageWeight += getElementWeight(el, el.imageDensity || "standard");
          });
          
          let canFit = false;
          if (currentStart > 0) {
            canFit = true;
          } else {
            const totalSubTaskWeight = getCandidateWeight(0, N, allImages.map((img: any) => img.id));
            const fitsEntirely = lastPageWeight + totalSubTaskWeight <= 100;
            canFit = fitsEntirely || (lastPageWeight <= 30);
          }
          
          if (canFit) {
            for (let endCandidate = currentStart + 1; endCandidate <= N; endCandidate++) {
              const shownImageIdsOnPage: string[] = [];
              for (let p = currentStart; p < endCandidate; p++) {
                const paraImgs = imagesByParaIdx[p] || [];
                paraImgs.forEach((img: any) => shownImageIdsOnPage.push(img.id));
              }
              
              const itemWeight = getCandidateWeight(currentStart, endCandidate, shownImageIdsOnPage);
              if (lastPageWeight + itemWeight <= 100) {
                bestEnd = endCandidate;
                fitsOnLastPage = true;
              } else {
                break;
              }
            }
          }
        }
      }
      
      if (!fitsOnLastPage) {
        bestEnd = currentStart + 1;
        
        for (let endCandidate = currentStart + 1; endCandidate <= N; endCandidate++) {
          const shownImageIdsOnPage: string[] = [];
          for (let p = currentStart; p < endCandidate; p++) {
            const paraImgs = imagesByParaIdx[p] || [];
            paraImgs.forEach((img: any) => shownImageIdsOnPage.push(img.id));
          }
          
          const itemWeight = getCandidateWeight(currentStart, endCandidate, shownImageIdsOnPage);
          if (itemWeight <= 100) {
            bestEnd = endCandidate;
          } else {
            break;
          }
        }
        useNewPage = true;
      }
      
      const shownImageIdsOnPage: string[] = [];
      for (let p = currentStart; p < bestEnd; p++) {
        const paraImgs = imagesByParaIdx[p] || [];
        paraImgs.forEach((img: any) => shownImageIdsOnPage.push(img.id));
      }
      const hiddenImageIds = allImages
        .filter((img: any) => !shownImageIdsOnPage.includes(img.id))
        .map((img: any) => img.id);
        
      const isFirstPageOfEntry = (currentStart === 0);
      const elementId = isFirstPageOfEntry 
        ? `entry-${t.id}` 
        : `entry-${t.id}-split-${currentStart}-${Date.now()}`;
        
      const newElement: PrintElement = {
        id: elementId,
        type: "blog-entry",
        content: { ...t },
        x: 0,
        y: 0,
        width: 100,
        fontSize: savedStyle.fontSize || "base",
        imageDensity: density,
        paddingY: savedStyle.paddingY || "medium",
        themeStyle: savedStyle.themeStyle || defaultThemeStyle,
        borderStyle: savedStyle.borderStyle || defaultBorderStyle,
        photoStyle: savedStyle.photoStyle || defaultPhotoStyle,
        blockColor: savedStyle.blockColor || "default",
        imageSize: savedStyle.imageSize || "medium",
        startParagraphIndex: currentStart,
        endParagraphIndex: bestEnd,
        hiddenImageIds: hiddenImageIds,
        isContinuation: !isFirstPageOfEntry
      };
      
      if (useNewPage || paginated.length === 0) {
        paginated.push({
          elements: [newElement]
        });
      } else {
        paginated[paginated.length - 1].elements.push(newElement);
      }
      
      currentStart = bestEnd;
    }
  });

  return paginated;
};

export function PrintPageContent({
  folder,
  posts,
  format,
  style,
  startDate,
  endDate,
}: PrintPageContentProps) {
  const [mounted, setMounted] = useState(false);
  const [pages, setPages] = useState<PrintPage[] | null>(null);
  const [formatState, setFormatState] = useState<"A4" | "A5">(format);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => {
      setReady(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const saved = localStorage.getItem(`questea-print-layout-${folder.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.pages && parsed.pages.length > 0) {
          setPages(parsed.pages);
        }
        if (parsed.format) {
          setFormatState(parsed.format);
        }
        if (parsed.template) {
          setTemplateState(parsed.template);
        }
      } catch (e) {
        console.error("Failed to parse custom print layout:", e);
      }
    }
  }, [mounted, folder.id]);

  const [templateState, setTemplateState] = useState<string>(folder.blogTemplate || "ADVENTURE");
  const isAdventure = templateState === "ADVENTURE";
  const isElegant = templateState === "ELEGANT";
  const defaultThemeStyle = isAdventure ? "travelbook" : isElegant ? "magazine" : "journal";
  const defaultBorderStyle = isAdventure ? "double-vintage" : isElegant ? "solid-accent" : "dashed-warm";
  const defaultPhotoStyle = isAdventure ? "scrapbook" : isElegant ? "circle-oval" : "polaroid";

  const autogeneratedPages = useMemo(() => {
    return paginateAllSubtasks(posts, {}, defaultThemeStyle, defaultBorderStyle, defaultPhotoStyle);
  }, [posts, defaultThemeStyle, defaultBorderStyle, defaultPhotoStyle]);

  const activePages = pages || autogeneratedPages;
  const accentColor = isAdventure ? "#d4a373" : "#ea580c";

  const handlePrint = () => {
    window.print();
  };

  const hexToRgb = (hex: string): string => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : "128, 128, 128";
  };

  const BlogEntryRenderer = ({ post, el }: { post: any; el: PrintElement }) => {
    const date = new Date(post.recordedAt || post.createdAt);
    
    const fontSizeClass = 
      el.fontSize === "sm" ? "text-sm leading-relaxed" :
      el.fontSize === "lg" ? "text-lg leading-relaxed" :
      el.fontSize === "xl" ? "text-xl leading-relaxed" : "text-base leading-relaxed";

    const cardFontSizeClass = 
      el.fontSize === "sm" ? "text-lg leading-relaxed font-semibold" :
      el.fontSize === "lg" ? "text-2xl leading-relaxed font-semibold" :
      el.fontSize === "xl" ? "text-3xl leading-relaxed font-semibold" : "text-xl leading-relaxed font-semibold";
      
    const paddingClass =
      el.paddingY === "none" ? "px-1 py-0.5" :
      el.paddingY === "small" ? "px-2 py-1" :
      el.paddingY === "large" ? "px-6 py-4" : "px-4 py-2";

    const density = el.imageDensity || "standard";
    const hiddenImageIds = el.hiddenImageIds || [];
    const largeImageIds = el.largeImageIds || [];
    const imgSize = el.imageSize || "medium";

    let imgHeightClass = "h-[250px] w-auto max-w-full object-contain";
    if (imgSize === "small") imgHeightClass = "h-[160px] w-auto max-w-full object-contain";
    else if (imgSize === "large") imgHeightClass = "h-[360px] w-auto max-w-full object-contain";
    else if (imgSize === "original") imgHeightClass = "w-full h-auto object-contain";

    const images = post.attachments?.filter((a: any) => a.type === "image" && !hiddenImageIds.includes(a.id)) || [];
    
    const getSentenceChunks = (text: string) => {
      if (!text) return [];
      const sentences = splitCzechSentences(text);
      if (sentences.length < 2) return [text]; 
      const chunks = [];
      for (let i = 0; i < sentences.length; i += 2) {
        chunks.push(sentences.slice(i, i + 2).join(" ").trim());
      }
      return chunks;
    };
    const allParagraphs = getSentenceChunks(post.description || "");
    const totalParasLocal = allParagraphs.length;

    const startPara = el.startParagraphIndex !== undefined ? el.startParagraphIndex : 0;
    const endPara = el.endParagraphIndex !== undefined ? el.endParagraphIndex : totalParasLocal;
    const paragraphs = allParagraphs.slice(startPara, endPara);

    const showDropCap = el.fontSize !== "sm" && el.fontSize !== "base" && startPara === 0;

    const themeStyle = el.themeStyle || "clean";

    let border = el.borderStyle;
    if (!border) {
      if (themeStyle === "journal") border = "dashed-warm";
      else if (themeStyle === "travelbook") border = "double-vintage";
      else border = "none";
    }

    let pStyle = el.photoStyle;
    if (!pStyle) {
      if (themeStyle === "journal") pStyle = "polaroid";
      else if (themeStyle === "travelbook") pStyle = "scrapbook";
      else if (themeStyle === "magazine") pStyle = "circle-oval";
      else if (themeStyle === "editorial") pStyle = "art-gallery";
      else if (themeStyle === "modern") pStyle = "modern-glow";
      else pStyle = "standard";
    }

    const isSolidBlock = border === "solid-block";
    const baseAccentColor = isAdventure ? "#d4a373" : "#ea580c";
    
    const bColor = el.blockColor || "default";
    let accentColorTheme = baseAccentColor;
    if (bColor === "terracotta") accentColorTheme = "#B85C43";
    else if (bColor === "navy") accentColorTheme = "#2C4E65";
    else if (bColor === "sage") accentColorTheme = "#526E5B";
    else if (bColor === "charcoal") accentColorTheme = "#3D3A36";
    else if (bColor === "plum") accentColorTheme = "#5E3E52";
    else if (bColor === "sand") accentColorTheme = "#A89B85";
    else if (bColor === "rose") accentColorTheme = "#A87C7C";
    else if (bColor === "emerald") accentColorTheme = "#059669";
    else if (bColor === "violet") accentColorTheme = "#7C3AED";
    else if (bColor === "sunset") accentColorTheme = "#F43F5E";
    else if (bColor === "ocean") accentColorTheme = "#0284C7";

    let blockBg = accentColorTheme;
    if (bColor === "default") {
      blockBg = isAdventure ? "#1E3E54" : "#853E2B";
      accentColorTheme = isAdventure ? "#1E3E54" : "#853E2B";
    }

    const rgb = hexToRgb(accentColorTheme);

    let articleClass = `blog-article-print transition-all duration-300 ${paddingClass} `;
    let styleObj: React.CSSProperties = {};

    if (border === "dashed-warm") {
      articleClass += "bg-[#FAF7F0] border-2 border-dashed border-[#E4DEC6] rounded-[24px] shadow-[0_8px_20px_rgba(180,170,140,0.15)] mx-0.5 my-1 relative overflow-hidden";
    } else if (border === "solid-accent") {
      articleClass += "bg-white border-[4px] rounded-none shadow-lg mx-0.5 my-1";
      styleObj = { borderColor: accentColorTheme };
    } else if (border === "double-vintage") {
      articleClass += "bg-[#FCFAF2] border-[5px] border-double border-[#5C4D3C] rounded-[4px] shadow-[0_6px_22px_rgba(90,80,60,0.12)] mx-0.5 my-1";
    } else if (border === "solid-block") {
      articleClass += "text-stone-50 rounded-[16px] shadow-[0_10px_25px_rgba(0,0,0,0.08)] mx-0.5 my-1 border border-transparent";
      styleObj = { backgroundColor: blockBg };
    } else if (border === "glassmorphic") {
      articleClass += "bg-white/70 backdrop-blur-md border border-white/40 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.06)] mx-0.5 my-1 relative overflow-hidden";
    } else if (border === "minimal-thin") {
      articleClass += "bg-white border border-stone-300 rounded-2xl mx-0.5 my-1";
    } else if (border === "shadow-floating") {
      articleClass += "bg-white rounded-3xl mx-0.5 my-1 border-0";
      styleObj = { boxShadow: `0 20px 60px rgba(${rgb}, 0.18), 0 4px 20px rgba(${rgb}, 0.10)` };
    } else if (border === "neo-brutalist") {
      articleClass += "bg-white border-[3px] border-stone-900 rounded-none mx-0.5 my-1";
      styleObj = { boxShadow: `5px 5px 0px ${accentColorTheme}` };
    } else {
      if (themeStyle === "magazine") {
        articleClass += "bg-gradient-to-br from-white to-stone-50/70 border border-stone-200/80 border-l-[6px] shadow-[0_10px_25px_rgba(0,0,0,0.03)] rounded-r-3xl rounded-l-md mx-0.5 my-1";
        styleObj = { borderLeftColor: accentColorTheme };
      } else if (themeStyle === "editorial") {
        articleClass += "bg-white border-l-[4px] border border-stone-100 rounded-r-2xl rounded-l-none mx-0.5 my-1 shadow-[0_2px_16px_rgba(0,0,0,0.04)]";
        styleObj = { borderLeftColor: accentColorTheme };
      } else if (themeStyle === "travelbook") {
        articleClass += "bg-[#FCFAF2] border border-[#5C4D3C]/30 rounded-lg shadow-md mx-0.5 my-1";
      } else if (themeStyle === "modern") {
        articleClass += "bg-white/40 backdrop-blur-sm border border-stone-100/50 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] mx-0.5 my-1";
      } else {
        articleClass += "bg-transparent border-none";
      }
    }

    const headerColorClass = isSolidBlock 
      ? "text-white" 
      : themeStyle === "journal" 
      ? "text-[#3C362A]" 
      : themeStyle === "travelbook"
      ? "text-[#4E3629]"
      : themeStyle === "magazine"
      ? "font-extrabold uppercase tracking-tight"
      : themeStyle === "modern"
      ? "text-stone-950 font-black"
      : "text-stone-950";

    const ff = el.fontFamily || "default";
    const titleFontClass = 
      ff === "editorial-serif" ? "editorial-serif-title" :
      ff === "clean-sans" ? "clean-sans-title" :
      ff === "avant-garde" ? "avant-garde-title" :
      ff === "handwritten" ? "handwritten-title" :
      themeStyle === "journal" 
        ? "serif-font italic" 
        : themeStyle === "magazine" 
        ? "title-font font-black tracking-tight"
        : themeStyle === "travelbook"
        ? "serif-font font-black italic text-[#4E3629]"
        : themeStyle === "editorial"
        ? "editorial-serif-title"
        : themeStyle === "modern"
        ? "font-sans font-black tracking-tighter uppercase text-stone-900"
        : isAdventure || isElegant ? 'serif-font italic' : 'title-font';

    const textFontClass = 
      ff === "editorial-serif" ? "editorial-serif-body text-stone-800" :
      ff === "clean-sans" ? "clean-sans-body text-stone-700" :
      ff === "avant-garde" ? "avant-garde-body text-stone-800" :
      ff === "handwritten" ? "handwritten-body text-stone-800" :
      themeStyle === "journal" 
        ? "text-[#4A4335] font-serif tracking-wide" 
        : themeStyle === "travelbook"
        ? "text-[#3E342F] font-serif tracking-wide leading-relaxed"
        : themeStyle === "magazine" 
        ? "text-stone-900 leading-relaxed pl-4 border-l-2 border-stone-200" 
        : themeStyle === "editorial"
        ? "editorial-serif-body text-stone-800 pl-4"
        : themeStyle === "modern"
        ? "text-stone-700 font-sans tracking-normal leading-relaxed font-light"
        : "text-stone-800";

    const textColorClass = isSolidBlock ? "text-stone-100" : textFontClass;
    const metaColorClass = isSolidBlock ? "text-stone-300" : "text-stone-400";

    return (
      <article className={articleClass} style={styleObj}>
        <div className="w-full">
          {startPara === 0 && !el.isContinuation && (
            <header 
              className={`flex flex-row items-center justify-between mb-3 pb-1 border-b gap-4 w-full flex-nowrap ${
                isSolidBlock
                  ? "border-white/20"
                  : themeStyle === "journal" 
                  ? "border-[#E4DEC6]/60" 
                  : themeStyle === "modern"
                  ? "border-transparent"
                  : "border-stone-200"
              }`}
              style={themeStyle === "modern" ? { borderBottom: `2px solid ${accentColorTheme}` } : {}}
            >
              <h2 
                className={`text-xl font-bold leading-tight outline-none truncate shrink ${titleFontClass} ${headerColorClass}`}
                style={(!isSolidBlock && (themeStyle === "magazine" || themeStyle === "modern")) ? { color: accentColorTheme } : {}}
              >
                {post.title}
              </h2>
              
              <div className={`flex items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-wider shrink-0 font-bold ${metaColorClass}`}>
                <span style={isSolidBlock ? {} : { color: accentColorTheme }}>
                  {date.toLocaleDateString("cs-CZ")} {date.toLocaleTimeString("cs-CZ", { hour: '2-digit', minute: '2-digit' })}
                </span>
                {post.locations?.[0] && (
                  <div className="flex items-center gap-1">
                    <span className="opacity-40">•</span>
                    <MapPin size={10} style={isSolidBlock ? {} : { color: accentColorTheme }} />
                    <span className="truncate max-w-[120px] sm:max-w-[180px]">{post.locations[0].placeName || post.locations[0].address}</span>
                  </div>
                )}
              </div>
            </header>
          )}

          <div className="flex flex-col gap-4">
            {paragraphs.map((para: string, pIdx: number) => {
              const imagesPerPara = Math.ceil(images.length / (paragraphs.length || 1));
              const paraImages = images.slice(pIdx * imagesPerPara, (pIdx + 1) * imagesPerPara);
              
              let columnClass = "columns-2 gap-1 my-1";
              let mbClass = "mb-1";
              if (density === "compact") {
                columnClass = "columns-3 gap-0.5 my-0.5";
                mbClass = "mb-0.5";
              } else if (density === "thumbnail") {
                columnClass = "columns-4 gap-0.5 my-0.5";
                mbClass = "mb-0.5";
              }

              const isOddImages = density !== "hidden" && paraImages.length > 0 && (paraImages.length % 2 !== 0);

              const renderParagraphText = (isInCard: boolean) => {
                const dropCapSpan = pIdx === 0 && showDropCap && (
                  <span className={`drop-cap-print ${
                    themeStyle === "journal" 
                      ? "text-[#8C7A5F] opacity-50 font-serif" 
                      : themeStyle === "travelbook"
                      ? "text-[#5C4D3C] opacity-50 font-serif"
                      : themeStyle === "magazine" 
                      ? "opacity-80" 
                      : themeStyle === "modern"
                      ? "font-sans font-black pr-1.5 border-r-4 mr-2"
                      : ""
                  }`}
                  style={(themeStyle === "magazine" || themeStyle === "modern") ? { color: accentColorTheme, borderColor: accentColorTheme } : {}}
                  >
                    {para.charAt(0)}
                  </span>
                );

                return (
                  <div className={`relative font-medium`}>
                    {dropCapSpan}
                    <p 
                      className={`whitespace-pre-wrap outline-none p-1 rounded ${isInCard ? cardFontSizeClass : fontSizeClass} ${
                        isInCard 
                          ? isSolidBlock 
                            ? "text-stone-100" 
                            : themeStyle === "journal" 
                            ? "text-[#4A4335] font-serif" 
                            : themeStyle === "travelbook" 
                            ? "text-[#3E342F] font-serif" 
                            : themeStyle === "magazine" 
                            ? "text-stone-900" 
                            : themeStyle === "modern"
                            ? "text-stone-800 font-sans font-light"
                            : "text-stone-800"
                          : textColorClass
                      }`}
                    >
                      {pIdx === 0 && showDropCap ? para.slice(1) : para}
                    </p>
                  </div>
                );
              };

              const cardHash = (pIdx * 37) + 13;
              let baseHeight = 250;
              if (imgSize === "small") baseHeight = 160;
              else if (imgSize === "large") baseHeight = 360;
              const cardHeightOffset = (cardHash % 7) * 10 - 30;
              let cardHeight = imgSize === "original" ? 250 : baseHeight + cardHeightOffset;

              const textLength = para.length;
              if (textLength < 60) {
                cardHeight = Math.min(cardHeight, 110);
              } else if (textLength < 120) {
                cardHeight = Math.min(cardHeight, 145);
              } else if (textLength < 200) {
                cardHeight = Math.min(cardHeight, 185);
              }

              let cardWrapperClass = "break-inside-avoid w-full flex flex-col justify-center p-6 rounded-2xl relative shadow-md mb-4 ";
              let cardStyle: React.CSSProperties = {
                minHeight: `${cardHeight}px`
              };
              let showCardWashiTape = false;
              let showCardPhotoCorners = false;
              let showCardPushpin = false;
              let showCardInnerOvalFrame = false;

              if (pStyle === "polaroid") {
                const angle = (cardHash % 9) - 4;
                cardStyle = {
                  ...cardStyle,
                  transform: `rotate(${angle}deg)`,
                  backgroundSize: "12px 12px",
                  backgroundImage: "radial-gradient(#e4dec6 1px, transparent 1px)",
                  backgroundColor: "#FCFAF6",
                };
                cardWrapperClass = `break-inside-avoid w-full flex flex-col justify-between p-6 pb-12 border-[10px] border-white bg-[#FCFAF6] shadow-[6px_10px_24px_rgba(50,40,30,0.16)] rounded-sm relative mb-4`;
                showCardWashiTape = true;
              } else if (pStyle === "scrapbook") {
                const angle = (cardHash % 11) - 5;
                cardStyle = {
                  ...cardStyle,
                  transform: `rotate(${angle}deg)`,
                  backgroundImage: "linear-gradient(#e8dfd0 1px, transparent 1px)",
                  backgroundSize: "100% 20px",
                  lineHeight: "20px",
                  backgroundColor: "#FAF5EB",
                };
                cardWrapperClass = `break-inside-avoid w-full flex flex-col justify-center p-6 border-[8px] border-white bg-[#FAF6EE] shadow-[4px_8px_20px_rgba(70,60,50,0.15)] rounded-sm relative mb-4`;
                showCardPhotoCorners = true;
                showCardPushpin = true;
              } else if (pStyle === "tilted") {
                const baseAngle = pIdx % 2 === 0 ? -4 : 4;
                const offset = (cardHash % 5) - 2;
                const angle = baseAngle + offset;
                cardStyle = {
                  ...cardStyle,
                  transform: `rotate(${angle}deg)`,
                };
                cardWrapperClass = `break-inside-avoid w-full flex flex-col justify-center p-6 border-[8px] border-white bg-white shadow-[8px_16px_35px_rgba(0,0,0,0.14)] relative mb-4`;
              } else if (pStyle === "circle-oval") {
                cardWrapperClass = `break-inside-avoid w-full flex flex-col justify-center p-8 rounded-t-[140px] rounded-b-[30px] border border-stone-200/40 bg-white shadow-[0_20px_45px_rgba(0,0,0,0.08)] relative mb-4 overflow-hidden`;
                showCardInnerOvalFrame = true;
              } else if (pStyle === "modern-glow") {
                cardWrapperClass = `break-inside-avoid w-full flex flex-col justify-center p-6 rounded-3xl bg-white border border-stone-100 relative mb-4`;
                cardStyle = {
                  ...cardStyle,
                  boxShadow: `0 15px 35px rgba(${rgb}, 0.22)`,
                  border: `1px solid rgba(${rgb}, 0.15)`
                };
              } else {
                if (isSolidBlock) {
                  cardWrapperClass = "break-inside-avoid w-full flex flex-col justify-center p-6 bg-white/10 backdrop-blur-sm border border-white/20 shadow-inner rounded-2xl relative mb-4";
                } else if (border === "glassmorphic") {
                  cardWrapperClass = "break-inside-avoid w-full flex flex-col justify-center p-6 bg-white/70 backdrop-blur-md border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.06)] rounded-3xl relative mb-4";
                } else {
                  if (themeStyle === "journal") {
                    const angle = (cardHash % 3) - 1;
                    cardStyle = {
                      ...cardStyle,
                      backgroundImage: "linear-gradient(#e4dec6 1px, transparent 1px)",
                      backgroundSize: "100% 24px",
                      lineHeight: "24px",
                      transform: `rotate(${angle}deg)`,
                      backgroundColor: "#FAF7F0",
                    };
                    cardWrapperClass = "break-inside-avoid w-full flex flex-col justify-center p-6 bg-[#FAF7F0] border border-dashed border-[#E4DEC6] rounded-[16px] shadow-[0_4px_12px_rgba(180,170,140,0.1)] relative mb-4";
                  } else if (themeStyle === "travelbook") {
                    const angle = (cardHash % 5) - 2;
                    cardStyle = {
                      ...cardStyle,
                      transform: `rotate(${angle}deg)`
                    };
                    cardWrapperClass = "break-inside-avoid w-full flex flex-col justify-center p-6 bg-[#FCFAF2] border-[4px] border-double border-[#5C4D3C] rounded-sm shadow-md relative mb-4";
                  } else if (themeStyle === "magazine") {
                    cardStyle = {
                      ...cardStyle,
                      borderLeftColor: accentColorTheme
                    };
                    cardWrapperClass = "break-inside-avoid w-full flex flex-col justify-center p-6 bg-gradient-to-br from-white to-stone-50 border border-stone-200 border-l-[6px] rounded-r-2xl rounded-l-sm shadow-sm relative mb-4";
                  } else if (themeStyle === "modern") {
                    cardStyle = {
                      ...cardStyle,
                      borderBottomColor: accentColorTheme
                    };
                    cardWrapperClass = "break-inside-avoid w-full flex flex-col justify-center p-6 bg-white border border-stone-100 border-b-[4px] rounded-xl shadow-md relative mb-4";
                  } else {
                    cardWrapperClass = "break-inside-avoid w-full flex flex-col justify-center p-6 bg-white/80 backdrop-blur-sm border border-stone-200 shadow-sm rounded-2xl relative mb-4";
                  }
                }
              }

              return (
                <div key={pIdx} className="space-y-4">
                  {!isOddImages && renderParagraphText(false)}

                  {density !== "hidden" && paraImages.length > 0 && (
                    <div className={`${columnClass} w-full`}>
                      {isOddImages && (
                        <div className={cardWrapperClass} style={cardStyle}>
                          {showCardWashiTape && (
                            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-10 h-3.5 bg-amber-100/35 border-l border-r border-amber-200/20 shadow-[0_1px_2px_rgba(0,0,0,0.02)] rotate-[-3deg] backdrop-blur-[0.5px] pointer-events-none select-none z-[10]" />
                          )}
                          {showCardPushpin && (
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-600 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.3)] z-20 pointer-events-none">
                              <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white/50 rounded-full" />
                              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[2px] h-3.5 bg-stone-400/80 shadow-sm" />
                            </div>
                          )}
                          {showCardPhotoCorners && (
                            <>
                              <div className="absolute top-0 left-0 w-4 h-4 bg-[#3E2723] z-10 pointer-events-none border-r border-b border-black/10 shadow-sm" style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />
                              <div className="absolute top-0 right-0 w-4 h-4 bg-[#3E2723] z-10 pointer-events-none border-l border-b border-black/10 shadow-sm" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }} />
                              <div className="absolute bottom-0 left-0 w-4 h-4 bg-[#3E2723] z-10 pointer-events-none border-r border-t border-black/10 shadow-sm" style={{ clipPath: "polygon(0 0, 0 100%, 100% 100%)" }} />
                              <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#3E2723] z-10 pointer-events-none border-l border-t border-black/10 shadow-sm" style={{ clipPath: "polygon(100% 0, 0 100%, 100% 100%)" }} />
                            </>
                          )}
                          {showCardInnerOvalFrame && (
                            <div className="absolute inset-2 border border-dashed border-[#C5B39A] rounded-t-[130px] rounded-b-[24px] pointer-events-none" />
                          )}
                          {renderParagraphText(true)}
                          {pStyle === "polaroid" && (
                            <div className="absolute bottom-1 left-0 right-0 text-center cursive-font text-stone-600 font-bold text-lg leading-none z-10 pointer-events-none select-none">
                              {post.createdAt || post.date ? new Date(post.createdAt || post.date).toLocaleDateString("cs-CZ") : "Krásné vzpomínky"}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {paraImages.map((att: any, attIdx: number) => {
                        const isLarge = largeImageIds.includes(att.id);
                        
                        let wrapperStyle: React.CSSProperties = isLarge ? { columnSpan: "all" } : {};
                        let actualWrapperClass = "";
                        let showWashiTape = false;
                        let showPhotoCorners = false;

                        const hash = att.id.split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
                        
                        const isPortrait = att.aspect ? att.aspect < 0.95 : false;

                        let baseHeight = 250;
                        if (imgSize === "small") baseHeight = 160;
                        else if (imgSize === "large") baseHeight = 360;

                        if (isPortrait) {
                          if (imgSize === "small") baseHeight = 240;
                          else if (imgSize === "large") baseHeight = 500;
                          else baseHeight = 380;
                        }

                        const heightOffset = ((hash + attIdx * 31) % 7) * 10 - 30;
                        const defaultHeight = imgSize === "original" ? undefined : baseHeight + heightOffset;
                        const customHeight = (el.customImageHeights || {})[att.id];
                        const dynamicHeight = customHeight !== undefined ? customHeight : defaultHeight;
                        const customFit = (el.customImageFits || {})[att.id] || "cover";
                        const customZoom = (el.customImageZooms || {})[att.id] || 1.0;
                        const offset = (el.customImageOffsets || {})[att.id] || { x: 0, y: 0 };

                        if (pStyle === "polaroid") {
                          const angle = ((hash + attIdx * 17) % 11) - 5;
                          wrapperStyle = {
                            ...wrapperStyle,
                            transform: `rotate(${angle}deg)`,
                          };
                          actualWrapperClass = `break-inside-avoid block w-full max-w-full mx-auto border-[10px] border-b-[32px] border-white bg-[#FCFAF6] p-0.5 shadow-[6px_10px_24px_rgba(50,40,30,0.16)] rounded-sm relative group overflow-hidden ${mbClass}`;
                          showWashiTape = true;
                        } else if (pStyle === "scrapbook") {
                          const angle = ((hash + attIdx * 23) % 13) - 6;
                          wrapperStyle = {
                            ...wrapperStyle,
                            transform: `rotate(${angle}deg)`,
                            pointerEvents: "auto"
                          };
                          actualWrapperClass = `break-inside-avoid block w-full max-w-full mx-auto border-[8px] border-white bg-[#FAF6EE] p-0.5 shadow-[4px_8px_20px_rgba(70,60,50,0.15)] rounded-sm relative group ${mbClass}`;
                          showPhotoCorners = true;
                        } else if (pStyle === "tilted") {
                          const baseAngle = attIdx % 2 === 0 ? -4 : 4;
                          const offset = ((hash + attIdx * 19) % 7) - 3;
                          const angle = baseAngle + offset;
                          wrapperStyle = {
                            ...wrapperStyle,
                            transform: `rotate(${angle}deg)`,
                          };
                          actualWrapperClass = `break-inside-avoid block w-full max-w-full mx-auto border-[8px] border-white bg-white p-0.5 shadow-[8px_16px_35px_rgba(0,0,0,0.14)] relative group ${mbClass}`;
                        } else if (pStyle === "circle-oval") {
                          actualWrapperClass = `break-inside-avoid block w-full max-w-full mx-auto rounded-t-[140px] rounded-b-[30px] border border-stone-200/40 bg-white p-1.5 shadow-[0_20px_45px_rgba(0,0,0,0.08)] relative group overflow-hidden ${mbClass}`;
                        } else if (pStyle === "modern-glow") {
                          actualWrapperClass = `break-inside-avoid block w-full max-w-full mx-auto rounded-3xl bg-white p-1 relative group overflow-hidden ${mbClass}`;
                          wrapperStyle = {
                            ...wrapperStyle,
                            boxShadow: `0 15px 35px rgba(${rgb}, 0.22)`,
                            border: `1px solid rgba(${rgb}, 0.15)`
                          };
                        } else if (pStyle === "art-gallery") {
                          actualWrapperClass = `break-inside-avoid block w-full max-w-full mx-auto relative group overflow-hidden ${mbClass}`;
                          wrapperStyle = {
                            ...wrapperStyle,
                            padding: '10px',
                            paddingBottom: '20px',
                            background: '#F5F2EE',
                            border: '1px solid #E8E4DE',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)'
                          };
                        } else if (pStyle === "rounded-soft") {
                          actualWrapperClass = `break-inside-avoid block w-full max-w-full mx-auto rounded-[20px] relative group overflow-hidden ${mbClass}`;
                          wrapperStyle = {
                            ...wrapperStyle,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)'
                          };
                        } else if (pStyle === "duotone-filter") {
                          actualWrapperClass = `break-inside-avoid block w-full max-w-full mx-auto rounded-xl relative group overflow-hidden ${mbClass}`;
                          wrapperStyle = {
                            ...wrapperStyle,
                            boxShadow: `0 8px 24px rgba(${rgb}, 0.20)`
                          };
                        } else {
                          actualWrapperClass = isAdventure
                            ? `break-inside-avoid block w-full max-w-full mx-auto border-[10px] border-white bg-white p-0.5 shadow-[0_12px_24px_rgba(0,0,0,0.07)] rounded-sm relative group overflow-hidden ${mbClass}`
                            : `break-inside-avoid block w-full max-w-full mx-auto rounded-2xl shadow-[0_15px_35px_rgba(0,0,0,0.08)] bg-transparent border border-stone-100 relative group overflow-hidden ${mbClass}`;
                        }

                        return (
                          <div 
                            key={att.id} 
                            className={actualWrapperClass}
                            style={wrapperStyle}
                          >
                            {showWashiTape && (
                              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-10 h-3.5 bg-amber-100/35 border-l border-r border-amber-200/20 shadow-[0_1px_2px_rgba(0,0,0,0.02)] rotate-[-3deg] backdrop-blur-[0.5px] pointer-events-none select-none z-[10]" />
                            )}

                            {showPhotoCorners && (
                              <>
                                <div className="absolute top-0 left-0 w-4 h-4 bg-[#3E2723] z-10 pointer-events-none border-r border-b border-black/10 shadow-sm" style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />
                                <div className="absolute top-0 right-0 w-4 h-4 bg-[#3E2723] z-10 pointer-events-none border-l border-b border-black/10 shadow-sm" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }} />
                                <div className="absolute bottom-0 left-0 w-4 h-4 bg-[#3E2723] z-10 pointer-events-none border-r border-t border-black/10 shadow-sm" style={{ clipPath: "polygon(0 0, 0 100%, 100% 100%)" }} />
                                <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#3E2723] z-10 pointer-events-none border-l border-t border-black/10 shadow-sm" style={{ clipPath: "polygon(100% 0, 0 100%, 100% 100%)" }} />
                              </>
                            )}

                            <div 
                              className={`w-full overflow-hidden relative transition-all`}
                              style={{ height: dynamicHeight ? `${dynamicHeight}px` : undefined }}
                            >
                              <img 
                                src={att.url} 
                                className={`${
                                  customFit === "contain" 
                                    ? "object-contain bg-stone-100/30 border border-stone-200/20" 
                                    : "object-cover"
                                }`}
                                style={{ 
                                  height: dynamicHeight ? "100%" : undefined,
                                  width: "100%",
                                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${customZoom})`,
                                  transformOrigin: "center center"
                                }} 
                              />
                              {pStyle === "duotone-filter" && (
                                <div 
                                  className="absolute inset-0 pointer-events-none z-[5]"
                                  style={{ 
                                    backgroundColor: accentColorTheme, 
                                    opacity: 0.40,
                                    mixBlendMode: "color"
                                  }} 
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </article>
    );
  };

  if (!mounted) {
    return <div className="min-h-screen bg-stone-900" />;
  }

  const pageW = formatState === "A4" ? "210mm" : "148mm";
  const pageH = formatState === "A4" ? "297mm" : "210mm";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,900;1,900&family=Outfit:wght@300;400;700;900&family=Caveat:wght@400;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=Inter:wght@300;400;600&family=Syne:wght@700;800&family=Montserrat:wght@800;900&display=swap');
        
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          margin: 0;
          padding: 0;
          background: #1c1917;
          font-family: 'Inter', sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .paper-bg {
          background-color: #fcfaf7;
          background-image: url("https://www.transparenttextures.com/patterns/paper.png");
        }
        
        .cursive-font {
          font-family: 'Caveat', cursive;
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

        .editorial-serif-title {
          font-family: 'Cormorant Garamond', 'Playfair Display', serif;
          font-weight: 600;
          letter-spacing: 0.01em;
        }
        .editorial-serif-body {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-weight: 400;
          font-size: 1.05em;
          line-height: 1.75;
          letter-spacing: 0.02em;
        }
        .clean-sans-title {
          font-family: 'Inter', 'Outfit', sans-serif;
          font-weight: 600;
          letter-spacing: -0.02em;
        }
        .clean-sans-body {
          font-family: 'Inter', sans-serif;
          font-weight: 300;
          letter-spacing: 0;
          line-height: 1.7;
        }
        .avant-garde-title {
          font-family: 'Syne', 'Montserrat', sans-serif;
          font-weight: 800;
          letter-spacing: -0.03em;
          text-transform: uppercase;
        }
        .avant-garde-body {
          font-family: 'Montserrat', sans-serif;
          font-weight: 400;
          letter-spacing: -0.01em;
          line-height: 1.65;
        }
        .handwritten-title {
          font-family: 'Caveat', cursive;
          font-weight: 700;
          letter-spacing: 0.01em;
        }
        .handwritten-body {
          font-family: 'Caveat', cursive;
          font-weight: 400;
          font-size: 1.1em;
          line-height: 1.6;
        }

        .print-controls {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 9999;
          background: #0c0a09;
          color: white;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          height: 64px;
          gap: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .print-controls h1 {
          font-family: 'Outfit', sans-serif;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          opacity: 0.8;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .print-btn {
          background: #ea580c;
          color: white;
          border: none;
          border-radius: 12px;
          padding: 10px 28px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(234, 88, 12, 0.3);
        }
        .print-btn:hover {
          background: #c2410c;
          transform: translateY(-1px);
        }
        .print-btn:active {
          transform: translateY(1px);
        }
        .print-hint {
          font-size: 11px;
          opacity: 0.5;
          font-weight: 500;
        }

        .pages-wrapper {
          padding: 96px 0 60px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }

        .pb-page {
          width: ${pageW};
          height: ${pageH};
          background: #FEFCF8;
          overflow: hidden;
          position: relative;
          box-shadow: 0 20px 50px rgba(0,0,0,0.4);
          display: flex;
          flex-direction: column;
          transition: box-shadow 0.3s ease;
        }

        .title-page {
          background: #1a1410;
          color: #F5F0E8;
          justify-content: flex-end;
          padding: 60px 56px;
          gap: 0;
        }
        .title-page .eyebrow {
          font-family: 'Outfit', sans-serif;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.35em;
          text-transform: uppercase;
          color: ${accentColor};
          margin-bottom: 24px;
        }
        .title-page h1 {
          font-family: 'Playfair Display', serif;
          font-size: ${formatState === "A4" ? "82px" : "56px"};
          font-weight: 700;
          font-style: italic;
          line-height: 0.88;
          color: #F5F0E8;
          margin-bottom: 48px;
          letter-spacing: -0.01em;
        }
        .title-page .meta-line {
          display: flex;
          align-items: center;
          gap: 24px;
          font-family: 'Inter', sans-serif;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(245,240,232,0.45);
          border-top: 1px solid rgba(245,240,232,0.1);
          padding-top: 24px;
        }
        .title-page .meta-item { display: flex; align-items: center; gap: 8px; }
        .title-page .meta-accent { color: ${accentColor}; }

        .page-header {
          padding: 16px 48px 8px;
          border-bottom: 1px solid rgba(0,0,0,0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }
        .page-header .folder-name {
          font-family: 'Outfit', sans-serif;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: #A09580;
        }
        .page-header .page-num {
          font-family: 'Playfair Display', serif;
          font-size: 14px;
          color: #C0B8A8;
          font-style: italic;
        }

        .page-footer {
          margin-top: auto;
          padding: 8px 48px 16px;
          border-top: 1px solid rgba(0,0,0,0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }
        .page-footer span {
          font-family: 'Inter', sans-serif;
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #C0B8A8;
        }
        .questea-mark {
          font-family: 'Playfair Display', serif;
          font-size: 12px;
          font-style: italic;
          color: ${accentColor};
          font-weight: 900;
        }

        .page-content-wrapper {
          flex: 1;
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        /* Print only overrides */
        @page {
          size: ${formatState === 'A4' ? 'A4 portrait' : 'A5 portrait'};
          margin: 0mm !important;
        }

        @media print {
          /* Force all parent wrappers to let natural layout flow without collapsing or height restrictions */
          html, body, body > div, main, #__next, .pages-wrapper {
            background: white !important;
            color: #1c1917 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: auto !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            position: static !important;
            display: block !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .print-controls { display: none !important; }
          
          /* Title page styling with high contrast */
          .title-page {
            box-shadow: none !important;
            margin: 0 !important;
            border: none !important;
            width: ${pageW} !important;
            height: ${pageH} !important;
            page-break-after: always !important;
            break-after: page !important;
            overflow: hidden !important;
            position: relative !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-end !important;
            background: #FEFCF8 !important;
            color: #1c1917 !important;
            padding: 60px 56px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .title-page h1 {
            color: #1c1917 !important;
            font-size: ${formatState === "A4" ? "82px" : "56px"} !important;
            margin-bottom: 48px !important;
          }
          .title-page .eyebrow {
            color: #ea580c !important;
            margin-bottom: 24px !important;
          }
          .title-page .meta-line {
            color: #78716c !important;
            border-top: 1px solid rgba(0,0,0,0.08) !important;
            display: flex !important;
            align-items: center !important;
            gap: 24px !important;
            padding-top: 24px !important;
          }
          .title-page .meta-accent {
            color: #ea580c !important;
          }

          /* Body page styling with highly stable absolute layout to avoid flex collapse bugs */
          .pb-page {
            box-shadow: none !important;
            margin: 0 !important;
            border: none !important;
            width: ${pageW} !important;
            height: ${pageH} !important;
            page-break-after: always !important;
            break-after: page !important;
            overflow: hidden !important;
            position: relative !important;
            display: block !important; /* block layout so absolute children are sized perfectly */
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .pb-page .page-header {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            height: 40px !important;
            padding: 16px 48px 8px !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            border-bottom: 1px solid rgba(0,0,0,0.05) !important;
          }

          .pb-page .page-footer {
            position: absolute !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            height: 40px !important;
            padding: 8px 48px 16px !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            border-top: 1px solid rgba(0,0,0,0.05) !important;
          }

          .pb-page .page-content-wrapper {
            position: absolute !important;
            top: 40px !important;
            bottom: 40px !important;
            left: 0 !important;
            right: 0 !important;
            height: calc(${pageH} - 80px) !important;
            overflow: hidden !important;
            padding: ${formatState === 'A4' ? '24px 56px' : '16px 36px'} !important;
          }

          .pb-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}</style>

      <div className="print-controls no-print">
        <h1>📖 {folder.title} — Náhled k tisku</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <span className="print-hint">Doporučujeme nastavit: Bez okrajů (Margin: None) a Pozadí grafiky (Background graphics: ON)</span>
          <button className="print-btn" onClick={handlePrint}>
            🖨️ Vytisknout / PDF
          </button>
        </div>
      </div>

      <div className="pages-wrapper">
        {/* TITLE PAGE */}
        <div className="pb-page title-page">
          <div className="eyebrow">Questea · Fotokniha</div>
          <h1>{folder.title}</h1>
          <div className="meta-line">
            <div className="meta-item">
              <span className="meta-accent">📅</span>
              {startDate}
              {startDate !== endDate && <> — {endDate}</>}
            </div>
            <div className="meta-item">
              <span className="meta-accent">📍</span>
              {posts.length} zastávek
            </div>
          </div>
        </div>

        {/* PAGES */}
        {activePages.map((page, pageIdx) => {
          return (
            <div className="pb-page paper-bg" key={pageIdx}>
              {/* Running header */}
              <div className="page-header">
                <div className="folder-name">{folder.title}</div>
                <div className="page-num">{pageIdx + 1}</div>
              </div>

              {/* Page Contents */}
              <div className="page-content-wrapper" style={{ padding: formatState === 'A4' ? '24px 56px' : '16px 36px' }}>
                {page.elements.map((el, elIdx) => (
                  <React.Fragment key={el.id}>
                    {elIdx > 0 && (
                      <div className="w-full py-4 flex items-center justify-center select-none">
                        <div className="h-px w-24 bg-[#5C4D3C]/10 border-dashed border-t" />
                        <span className="mx-3 text-[8px] font-black uppercase tracking-[0.3em] text-[#5C4D3C]/40">Další stanoviště</span>
                        <div className="h-px w-24 bg-[#5C4D3C]/10 border-dashed border-t" />
                      </div>
                    )}
                    <div 
                      key={el.id}
                      className={`${
                        (el.x === 0 && el.y === 0 && el.type === 'blog-entry') ? 'relative w-full' : 'absolute'
                      }`}
                      style={{
                        position: (el.x === 0 && el.y === 0 && el.type === 'blog-entry') ? 'relative' : 'absolute',
                        left: (el.x === 0 && el.y === 0 && el.type === 'blog-entry') ? undefined : `${el.x}%`,
                        top: (el.x === 0 && el.y === 0 && el.type === 'blog-entry') ? undefined : `${el.y}%`,
                        width: `${el.width}%`,
                        transform: el.rotation ? `rotate(${el.rotation}deg)` : 'none',
                        marginBottom: (el.x === 0 && el.y === 0 && el.type === 'blog-entry') ? '1.5rem' : undefined
                      }}
                    >
                      {el.type === 'blog-entry' ? (
                        <BlogEntryRenderer post={el.content} el={el} />
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
                        <div className={`px-12 py-12 flex flex-col justify-start items-center text-stone-900 w-full ${formatState === "A4" ? "h-[1000px]" : "h-[680px]"}`}>
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
                          
                          <div className={`w-full mt-4 flex-1 ${formatState === "A4" ? "h-[740px] min-h-[660px]" : "h-[460px] min-h-[400px]"} relative rounded-3xl overflow-hidden border border-stone-200 shadow-xl bg-white p-2`}>
                             <JourneyMap points={el.content.points} id={`print-map-${el.id}`} className="w-full h-full rounded-2xl" />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </React.Fragment>
                ))}
              </div>

              {/* Running footer */}
              <div className="page-footer">
                <span>{startDate !== endDate ? `${startDate} — ${endDate}` : startDate}</span>
                <span className="questea-mark">Questea</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
