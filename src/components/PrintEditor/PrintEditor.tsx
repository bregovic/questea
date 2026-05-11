"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, FileText, Download, ChevronLeft, ChevronRight, Plus, Trash2, Maximize, Minimize, Move, Type, Image as ImageIcon, Layout, Printer, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PrintElement {
  id: string;
  type: "text" | "image" | "header" | "meta" | "dropcap" | "sidebar";
  content: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  fontSize?: number;
  rotation?: number;
  isBold?: boolean;
  isItalic?: boolean;
  metaInfo?: {
    index: number;
    time: string;
    date: string;
  };
}

interface PrintPage {
  elements: PrintElement[];
}

interface PrintEditorProps {
  folder: any;
  onClose: () => void;
}

export const PrintEditor: React.FC<PrintEditorProps> = ({ folder, onClose }) => {
  const [format, setFormat] = useState<"A4" | "A5">("A4");
  const [pages, setPages] = useState<PrintPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  
  const template = folder.blogTemplate || "ADVENTURE";
  const isAdventure = template === "ADVENTURE";
  const isElegant = template === "ELEGANT";
  const accentColor = isAdventure ? "#d4a373" : "#ea580c";

  // Initialize pages from tasks
  useEffect(() => {
    if (!folder.subTasks) return;
    
    const allElements: PrintElement[] = [];
    const subTasks = [...folder.subTasks]
      .filter((t: any) => !t.isDeleted && t.taskType !== "GPS_LOG")
      .sort((a: any, b: any) => new Date(a.recordedAt || a.createdAt).getTime() - new Date(b.recordedAt || b.createdAt).getTime());

    // 1. Cover Page Title
    allElements.push({
      id: "cover-title",
      type: "header",
      content: folder.title,
      x: 20, y: 15, width: 70,
      fontSize: 80,
      isBold: true
    });

    subTasks.forEach((t: any, i: number) => {
      const dateObj = new Date(t.recordedAt || t.createdAt);
      const timeStr = dateObj.toLocaleTimeString("cs-CZ", { hour: '2-digit', minute: '2-digit' });
      const dateStr = dateObj.toLocaleDateString("cs-CZ");
      const visualIndex = subTasks.length - i; // Same logic as blog

      // Sidebar Metadata
      allElements.push({
        id: "side-" + t.id,
        type: "sidebar",
        content: "",
        x: 8, y: 0, width: 10,
        metaInfo: {
          index: visualIndex,
          time: timeStr,
          date: dateStr
        }
      });

      // Entry Title
      allElements.push({
        id: "ent-title-" + t.id,
        type: "header",
        content: t.title,
        x: 20, y: 0, width: 70,
        fontSize: 56,
        isBold: true
      });

      // Entry Text with Dropcap
      if (t.description) {
        const text = t.description.trim();
        const firstChar = text.charAt(0);
        const rest = text.slice(1);

        allElements.push({
          id: "drop-" + t.id,
          type: "dropcap",
          content: firstChar,
          x: 20, y: 0, width: 5
        });

        allElements.push({
          id: "text-" + t.id,
          type: "text",
          content: rest,
          x: 20, y: 0, width: 65,
          fontSize: 18
        });
      }
      
      // Entry Images in Grid
      if (t.attachments) {
        const imgs = t.attachments.filter((a: any) => a.type === 'image');
        imgs.forEach((img: any, imgIdx: number) => {
          const isSecondInRow = imgIdx % 2 === 1;
          allElements.push({
            id: "img-" + img.id,
            type: "image",
            content: img.url || `/api/images/${img.id}`,
            x: isSecondInRow ? 58 : 20, 
            y: 0, 
            width: imgs.length === 1 ? 70 : 35,
            rotation: isAdventure ? (imgIdx % 2 === 0 ? -1 : 1) : 0
          });
        });
      }
    });

    // Pagination logic
    const paginated: PrintPage[] = [];
    let currentPageElements: PrintElement[] = [];
    let currentY = 10;

    allElements.forEach((el) => {
      let height = 10;
      if (el.type === 'text') height = Math.ceil(el.content.length / 80) * 4 + 5;
      if (el.type === 'image') height = el.width > 50 ? 50 : 30;
      if (el.type === 'header') height = 15;
      if (el.type === 'sidebar') height = 0; // Doesn't advance Y on its own
      if (el.type === 'dropcap') height = 0; // Same row as text

      if (currentY + height > 90 && el.type !== 'sidebar' && el.type !== 'dropcap') {
        paginated.push({ elements: currentPageElements });
        currentPageElements = [];
        currentY = 10;
      }

      // Special case: Sidebar and Dropcap should align with the Title/Text that follows
      if (el.type === 'sidebar' || el.type === 'dropcap') {
         // Don't advance currentY yet
      }

      currentPageElements.push({ ...el, y: currentY });
      
      if (el.type !== 'sidebar' && el.type !== 'dropcap') {
        currentY += height + 5;
      }
    });

    if (currentPageElements.length > 0) {
      paginated.push({ elements: currentPageElements });
    }

    setPages(paginated.length > 0 ? paginated : [{ elements: [] }]);
  }, [folder]);

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

  const handleExport = () => {
    window.print();
  };

  const currentPage = pages[currentPageIndex];

  return (
    <div className="fixed inset-0 z-[15000] bg-stone-900 flex flex-col font-sans select-none overflow-hidden">
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
          margin-right: 1.5rem;
          margin-top: 0.5rem;
          font-size: 8rem;
          color: ${accentColor};
          opacity: 0.3;
        }

        .title-font { font-family: 'Outfit', sans-serif; }
        .text-font { font-family: 'Outfit', sans-serif; }
        .serif-font { font-family: 'Playfair Display', serif; }
        
        @media print {
          @page {
            size: auto;
            margin: 0mm;
          }
          body { margin: 0; }
          .no-print { display: none !important; }
          .print-page { 
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            page-break-after: always;
            box-shadow: none !important;
            border: none !important;
          }
          .editor-container { display: block !important; background: white !important; }
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
             <button 
               key={f}
               onClick={() => setFormat(f as any)}
               className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${format === f ? 'bg-white text-black shadow-lg' : 'opacity-40 hover:opacity-100'}`}
             >
               {f}
             </button>
           ))}
        </div>

        <button 
          onClick={handleExport}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          <Printer size={14} /> PDF Export
        </button>
      </header>

      {/* Main Workspace */}
      <div className="editor-container flex-1 flex overflow-hidden">
        {/* Sidebar Tools */}
        <aside className="no-print w-20 bg-black/50 border-r border-white/5 flex flex-col items-center py-8 gap-8 shrink-0">
           <button onClick={() => setCurrentPageIndex(p => Math.max(0, p-1))} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
              <ChevronLeft size={20} className="text-white/60" />
           </button>
           <button onClick={() => setCurrentPageIndex(p => Math.min(pages.length-1, p+1))} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
              <ChevronRight size={20} className="text-white/60" />
           </button>
           <div className="h-px w-8 bg-white/10" />
           <button onClick={() => setSelectedElementId(null)} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
              <Move size={20} className="text-white/60" />
           </button>
        </aside>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto p-12 flex flex-col items-center gap-12 bg-stone-950/50 scrollbar-hide">
           <div className="no-print flex items-center gap-4 text-white/40 text-[10px] font-black uppercase tracking-widest">
              STRANA {currentPageIndex + 1} Z {pages.length}
           </div>

           {/* The Page */}
           <div 
             className={`print-page relative paper-bg shadow-2xl flex-shrink-0 transition-all duration-500 overflow-hidden ${format === 'A4' ? 'w-[794px] h-[1123px]' : 'w-[559px] h-[794px]'}`}
           >
              {currentPage?.elements.map((el) => (
                <div 
                  key={el.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedElementId(el.id); }}
                  className={`absolute group transition-all ${selectedElementId === el.id ? 'border-2 border-orange-500 bg-orange-500/5 z-[100]' : 'border-2 border-transparent hover:border-orange-500/10'}`}
                  style={{ 
                    left: `${el.x}%`, 
                    top: `${el.y}%`, 
                    width: `${el.width}%`,
                    transform: el.rotation ? `rotate(${el.rotation}deg)` : 'none'
                  }}
                >
                  {el.type === 'sidebar' && el.metaInfo && (
                    <div className="flex flex-col gap-1 items-start">
                       <span className="text-lg font-black text-[#ea580c]" style={{ color: accentColor }}>{el.metaInfo.index}</span>
                       <span className="text-[10px] font-black opacity-30 text-stone-950 uppercase">{el.metaInfo.time}</span>
                       <span className="text-[10px] font-black opacity-30 text-stone-950 uppercase whitespace-nowrap">{el.metaInfo.date}</span>
                    </div>
                  )}

                  {el.type === 'header' ? (
                    <h1 className="title-font font-black leading-[0.85] text-stone-950" style={{ fontSize: `${el.fontSize}px` }}>
                      {el.content}
                    </h1>
                  ) : el.type === 'dropcap' ? (
                    <span className="drop-cap-print">{el.content}</span>
                  ) : el.type === 'text' ? (
                    <textarea 
                      className="w-full bg-transparent outline-none resize-none text-font font-medium leading-[1.6] text-stone-800"
                      style={{ fontSize: `${el.fontSize}px`, height: 'auto' }}
                      value={el.content}
                      onChange={(e) => handleUpdateElement(el.id, { content: e.target.value })}
                    />
                  ) : (
                    <div className={`relative overflow-hidden ${isAdventure ? 'border-[10px] border-white shadow-xl rounded-sm' : 'rounded-3xl'}`}>
                      <img src={el.content} className="w-full h-auto object-cover" />
                    </div>
                  )}

                  {/* Controls */}
                  {selectedElementId === el.id && (
                    <div className="no-print absolute -top-12 left-0 flex items-center bg-stone-900 text-white rounded-xl shadow-2xl px-3 h-10 gap-4 z-[110] border border-white/10">
                       <button onClick={() => handleUpdateElement(el.id, { x: el.x - 1 })}><ChevronLeft size={16} /></button>
                       <button onClick={() => handleUpdateElement(el.id, { x: el.x + 1 })}><ChevronRight size={16} /></button>
                       <div className="w-px h-4 bg-white/10" />
                       <button onClick={() => handleUpdateElement(el.id, { y: el.y - 1 })} className="rotate-90"><ChevronLeft size={16} /></button>
                       <button onClick={() => handleUpdateElement(el.id, { y: el.y + 1 })} className="rotate-90"><ChevronRight size={16} /></button>
                       <div className="w-px h-4 bg-white/10" />
                       <button onClick={() => handleUpdateElement(el.id, { width: el.width + 2 })}><Maximize size={16} /></button>
                       <button onClick={() => handleUpdateElement(el.id, { width: el.width - 2 })}><Minimize size={16} /></button>
                       <div className="w-px h-4 bg-white/10" />
                       <button onClick={() => handleDeleteElement(el.id)} className="text-red-400"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};
