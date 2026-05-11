"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, FileText, Download, ChevronLeft, ChevronRight, Plus, Trash2, Maximize, Minimize, Move, Type, Image as ImageIcon, Layout, Printer } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PrintElement {
  id: string;
  type: "text" | "image" | "header" | "meta";
  content: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  fontSize?: number;
  rotation?: number;
  isBold?: boolean;
  isItalic?: boolean;
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

  // Initialize pages from tasks
  useEffect(() => {
    if (!folder.subTasks) return;
    
    const allElements: PrintElement[] = [];
    
    // 1. Cover Page Title
    allElements.push({
      id: "header-" + folder.id,
      type: "header",
      content: folder.title,
      x: 10, y: 15, width: 80,
      fontSize: 64,
      isBold: true,
      isItalic: isAdventure || isElegant
    });

    // 2. Add subtasks (entries)
    folder.subTasks.filter((t: any) => !t.isDeleted && t.taskType !== "GPS_LOG").forEach((t: any, i: number) => {
      // Entry Title
      allElements.push({
        id: "ent-title-" + t.id,
        type: "header",
        content: t.title,
        x: 10, y: 0, width: 80,
        fontSize: 32,
        isBold: true
      });

      // Entry Meta
      if (t.recordedAt || t.createdAt) {
        allElements.push({
          id: "ent-meta-" + t.id,
          type: "meta",
          content: new Date(t.recordedAt || t.createdAt).toLocaleDateString("cs-CZ"),
          x: 10, y: 0, width: 80,
          fontSize: 10
        });
      }

      // Entry Text
      if (t.description) {
        allElements.push({
          id: "text-" + t.id,
          type: "text",
          content: t.description,
          x: 10, y: 0, width: 50,
          fontSize: 16
        });
      }
      
      // Entry Images
      if (t.attachments) {
        t.attachments.filter((a: any) => a.type === 'image').forEach((img: any, imgIdx: number) => {
          allElements.push({
            id: "img-" + img.id,
            type: "image",
            content: img.url || `/api/images/${img.id}`,
            x: 65, y: 0, width: 25,
            rotation: isAdventure ? (imgIdx % 2 === 0 ? -2 : 2) : 0
          });
        });
      }
    });

    // Simple auto-pagination logic
    const paginated: PrintPage[] = [];
    let currentPageElements: PrintElement[] = [];
    let currentY = 10;

    allElements.forEach((el) => {
      // Estimate height
      let height = 10;
      if (el.type === 'text') height = Math.ceil(el.content.length / 100) * 5 + 10;
      if (el.type === 'image') height = 30;
      if (el.type === 'header') height = 15;

      if (currentY + height > 90) {
        paginated.push({ elements: currentPageElements });
        currentPageElements = [];
        currentY = 10;
      }

      currentPageElements.push({ ...el, y: currentY });
      currentY += height + 5;
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

  const handleAddText = () => {
    const newEl: PrintElement = {
      id: "new-text-" + Date.now(),
      type: "text",
      content: "Nový text...",
      x: 10, y: 10, width: 50,
      fontSize: 16
    };
    setPages(prev => prev.map((page, i) => i === currentPageIndex ? { elements: [...page.elements, newEl] } : page));
  };

  const handleExport = () => {
    window.print();
  };

  const currentPage = pages[currentPageIndex];

  return (
    <div className="fixed inset-0 z-[15000] bg-stone-900 flex flex-col font-sans select-none">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,900;1,900&family=Outfit:wght@300;400;700;900&display=swap');
        
        .paper-bg {
          background-color: #fcfaf7;
          background-image: url("https://www.transparenttextures.com/patterns/paper.png");
        }
        
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
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60">Editor Fotoknihy — {folder.title}</h2>
        </div>

        <div className="flex items-center gap-4 bg-white/5 p-1 rounded-xl">
           <button 
             onClick={() => setFormat("A4")}
             className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${format === 'A4' ? 'bg-white text-black shadow-lg' : 'opacity-40 hover:opacity-100'}`}
           >
             A4
           </button>
           <button 
             onClick={() => setFormat("A5")}
             className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${format === 'A5' ? 'bg-white text-black shadow-lg' : 'opacity-40 hover:opacity-100'}`}
           >
             A5
           </button>
        </div>

        <div className="flex items-center gap-4">
           <button 
             onClick={handleExport}
             className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
           >
             <Printer size={14} /> Tisk / PDF
           </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="editor-container flex-1 flex overflow-hidden">
        {/* Sidebar Tools */}
        <aside className="no-print w-20 bg-black/50 border-r border-white/5 flex flex-col items-center py-8 gap-8 shrink-0">
           <button onClick={handleAddText} className="flex flex-col items-center gap-2 group">
              <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-white/10 transition-colors"><Type size={20} className="text-white/60" /></div>
              <span className="text-[8px] font-black uppercase tracking-widest opacity-30">Text</span>
           </button>
        </aside>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto p-12 flex flex-col items-center gap-12 bg-stone-950/50 scrollbar-hide">
           {/* Pagination */}
           <div className="no-print flex items-center gap-8 sticky top-0 z-[1000] bg-stone-900/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/5 shadow-2xl">
              <button 
                onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
                disabled={currentPageIndex === 0}
                className="p-2 hover:bg-white/5 rounded-xl disabled:opacity-20 transition-all"
              >
                <ChevronLeft size={20} className="text-white" />
              </button>
              <div className="text-[11px] font-black text-white/40 uppercase tracking-widest">
                Strana <span className="text-white">{currentPageIndex + 1}</span> z {pages.length}
              </div>
              <button 
                onClick={() => setCurrentPageIndex(prev => Math.min(pages.length - 1, prev + 1))}
                disabled={currentPageIndex === pages.length - 1}
                className="p-2 hover:bg-white/5 rounded-xl disabled:opacity-20 transition-all"
              >
                <ChevronRight size={20} className="text-white" />
              </button>
           </div>

           {/* The Page */}
           <div 
             className={`print-page relative paper-bg shadow-2xl flex-shrink-0 transition-all duration-500 overflow-hidden ${format === 'A4' ? 'w-[794px] h-[1123px]' : 'w-[559px] h-[794px]'}`}
           >
              {currentPage?.elements.map((el) => (
                <div 
                  key={el.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedElementId(el.id); }}
                  className={`absolute group transition-all ${selectedElementId === el.id ? 'border-2 border-orange-500 bg-orange-500/5 z-[100]' : 'border-2 border-transparent hover:border-orange-500/30'}`}
                  style={{ 
                    left: `${el.x}%`, 
                    top: `${el.y}%`, 
                    width: `${el.width}%`,
                    transform: el.rotation ? `rotate(${el.rotation}deg)` : 'none'
                  }}
                >
                  {el.type === 'header' ? (
                    <h1 className={`${isAdventure || isElegant ? 'font-serif italic' : 'font-black tracking-tight'} leading-none`} style={{ fontSize: `${el.fontSize}px` }}>
                      {el.content}
                    </h1>
                  ) : el.type === 'meta' ? (
                    <div className="text-stone-400 font-black uppercase tracking-widest" style={{ fontSize: `${el.fontSize}px` }}>
                      {el.content}
                    </div>
                  ) : el.type === 'text' ? (
                    <textarea 
                      className="w-full bg-transparent outline-none resize-none font-serif leading-relaxed text-stone-800"
                      style={{ fontSize: `${el.fontSize}px`, height: 'auto' }}
                      value={el.content}
                      onChange={(e) => handleUpdateElement(el.id, { content: e.target.value })}
                    />
                  ) : (
                    <div className={`relative ${isAdventure ? 'border-[8px] border-white shadow-lg p-0.5' : ''}`}>
                      <img src={el.content} className="w-full h-auto object-contain" />
                    </div>
                  )}

                  {/* Element Controls */}
                  {selectedElementId === el.id && (
                    <div className="no-print absolute -top-10 left-0 flex items-center bg-stone-900 text-white rounded-lg shadow-lg px-2 h-8 gap-3 z-[110]">
                       <button onClick={() => handleUpdateElement(el.id, { x: Math.max(0, el.x - 2) })}><ChevronLeft size={14} /></button>
                       <button onClick={() => handleUpdateElement(el.id, { x: Math.min(90, el.x + 2) })}><ChevronRight size={14} /></button>
                       <div className="w-px h-4 bg-white/20" />
                       <button onClick={() => handleUpdateElement(el.id, { y: Math.max(0, el.y - 2) })} className="rotate-90"><ChevronLeft size={14} /></button>
                       <button onClick={() => handleUpdateElement(el.id, { y: Math.min(95, el.y + 2) })} className="rotate-90"><ChevronRight size={14} /></button>
                       <div className="w-px h-4 bg-white/20" />
                       <button onClick={() => handleUpdateElement(el.id, { width: Math.min(90, el.width + 5) })}><Maximize size={14} /></button>
                       <button onClick={() => handleUpdateElement(el.id, { width: Math.max(10, el.width - 5) })}><Minimize size={14} /></button>
                       <div className="w-px h-4 bg-white/20" />
                       <button onClick={() => handleDeleteElement(el.id)} className="text-red-400"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              ))}

              {/* Page Number Footer */}
              <div className="absolute bottom-10 left-0 w-full text-center text-[10px] font-black uppercase tracking-widest opacity-30">
                {folder.title} — Strana {currentPageIndex + 1}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
