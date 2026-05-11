"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, FileText, Download, ChevronLeft, ChevronRight, Plus, Trash2, Maximize, Minimize, Move, Type, Image as ImageIcon, Layout } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PrintElement {
  id: string;
  type: "text" | "image";
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
}

interface PrintPage {
  elements: PrintElement[];
}

interface PrintEditorProps {
  folder: any;
  tasks: any[];
  onClose: () => void;
}

export const PrintEditor: React.FC<PrintEditorProps> = ({ folder, tasks, onClose }) => {
  const [format, setFormat] = useState<"A4" | "A5">("A4");
  const [pages, setPages] = useState<PrintPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  
  // Initialize pages from tasks
  useEffect(() => {
    const initialElements: PrintElement[] = [];
    
    // Add Folder Title as first element
    initialElements.push({
      id: "title-" + folder.id,
      type: "text",
      content: folder.title,
      x: 10, y: 10, width: 80, height: 10,
      fontSize: 42
    });

    tasks.filter(t => !t.isDeleted && t.taskType !== "GPS_LOG").forEach((t, i) => {
      // Add text
      if (t.description) {
        initialElements.push({
          id: "text-" + t.id,
          type: "text",
          content: t.description,
          x: 10, y: 25 + (i * 20), width: 80, height: 15,
          fontSize: 14
        });
      }
      
      // Add images
      if (t.attachments) {
        t.attachments.filter((a: any) => a.type === 'image').forEach((img: any, imgIdx: number) => {
          initialElements.push({
            id: "img-" + img.id,
            type: "image",
            content: `/api/images/${img.id}`,
            x: 10 + (imgIdx * 25), y: 45 + (i * 20), width: 25, height: 25
          });
        });
      }
    });

    // Simple auto-pagination (basic for now: 5 elements per page)
    const paginated: PrintPage[] = [];
    for (let i = 0; i < initialElements.length; i += 6) {
      paginated.push({ elements: initialElements.slice(i, i + 6).map((el, idx) => ({ ...el, y: 10 + (idx * 15) })) });
    }
    setPages(paginated.length > 0 ? paginated : [{ elements: [] }]);
  }, [folder, tasks]);

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
      x: 10, y: 10, width: 50, height: 5,
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
      {/* Header */}
      <header className="h-16 bg-black text-white flex items-center justify-between px-6 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="hover:opacity-50 transition-opacity"><X size={24} /></button>
          <div className="h-6 w-px bg-white/10" />
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60">Editor Fotoknihy</h2>
        </div>

        <div className="flex items-center gap-4 bg-white/5 p-1 rounded-xl">
           <button 
             onClick={() => setFormat("A4")}
             className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${format === 'A4' ? 'bg-white text-black shadow-lg' : 'opacity-40 hover:opacity-100'}`}
           >
             A4 (Na výšku)
           </button>
           <button 
             onClick={() => setFormat("A5")}
             className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${format === 'A5' ? 'bg-white text-black shadow-lg' : 'opacity-40 hover:opacity-100'}`}
           >
             A5 (Kapesní)
           </button>
        </div>

        <div className="flex items-center gap-4">
           <button 
             onClick={handleExport}
             className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
           >
             <Download size={14} /> Export do PDF
           </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Tools */}
        <aside className="w-20 bg-black/50 border-r border-white/5 flex flex-col items-center py-8 gap-8 shrink-0">
           <button onClick={handleAddText} className="flex flex-col items-center gap-2 group">
              <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-white/10 transition-colors"><Type size={20} className="text-white/60" /></div>
              <span className="text-[8px] font-black uppercase tracking-widest opacity-30">Text</span>
           </button>
           <button className="flex flex-col items-center gap-2 group opacity-20 cursor-not-allowed">
              <div className="p-3 bg-white/5 rounded-2xl"><ImageIcon size={20} className="text-white/60" /></div>
              <span className="text-[8px] font-black uppercase tracking-widest">Foto</span>
           </button>
           <button className="flex flex-col items-center gap-2 group opacity-20 cursor-not-allowed">
              <div className="p-3 bg-white/5 rounded-2xl"><Layout size={20} className="text-white/60" /></div>
              <span className="text-[8px] font-black uppercase tracking-widest">Vzory</span>
           </button>
        </aside>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto p-12 flex flex-col items-center gap-12 bg-stone-950/50 scrollbar-hide">
           {/* Pagination */}
           <div className="flex items-center gap-8 sticky top-0 z-20 bg-stone-900/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/5 shadow-2xl">
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
             id="print-area"
             className={`relative bg-white shadow-2xl flex-shrink-0 transition-all duration-500 overflow-hidden ${format === 'A4' ? 'w-[794px] h-[1123px]' : 'w-[559px] h-[794px]'}`}
             style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
           >
              {currentPage?.elements.map((el) => (
                <div 
                  key={el.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedElementId(el.id); }}
                  className={`absolute group cursor-move border-2 transition-all ${selectedElementId === el.id ? 'border-orange-500 bg-orange-500/5' : 'border-transparent hover:border-orange-500/30'}`}
                  style={{ 
                    left: `${el.x}%`, 
                    top: `${el.y}%`, 
                    width: `${el.width}%`, 
                    minHeight: el.type === 'image' ? `${el.height}%` : 'auto' 
                  }}
                >
                  {el.type === 'text' ? (
                    <textarea 
                      className="w-full bg-transparent outline-none resize-none font-serif leading-relaxed"
                      style={{ fontSize: `${el.fontSize}px` }}
                      value={el.content}
                      onChange={(e) => handleUpdateElement(el.id, { content: e.target.value })}
                    />
                  ) : (
                    <img src={el.content} className="w-full h-full object-cover" />
                  )}

                  {/* Element Controls */}
                  {selectedElementId === el.id && (
                    <div className="absolute -top-10 left-0 flex items-center bg-orange-500 text-white rounded-lg shadow-lg px-2 h-8 gap-3 z-[100]">
                       <button onClick={() => handleUpdateElement(el.id, { x: Math.max(0, el.x - 2) })}><ChevronLeft size={14} /></button>
                       <button onClick={() => handleUpdateElement(el.id, { x: Math.min(90, el.x + 2) })}><ChevronRight size={14} /></button>
                       <div className="w-px h-4 bg-white/20" />
                       <button onClick={() => handleUpdateElement(el.id, { y: Math.max(0, el.y - 2) })} className="rotate-90"><ChevronLeft size={14} /></button>
                       <button onClick={() => handleUpdateElement(el.id, { y: Math.min(95, el.y + 2) })} className="rotate-90"><ChevronRight size={14} /></button>
                       <div className="w-px h-4 bg-white/20" />
                       {el.type === 'text' && (
                         <>
                           <button onClick={() => handleUpdateElement(el.id, { fontSize: (el.fontSize || 14) + 1 })}><Plus size={14} /></button>
                           <button onClick={() => handleUpdateElement(el.id, { fontSize: Math.max(8, (el.fontSize || 14) - 1) })} className="rotate-45"><Plus size={14} /></button>
                           <div className="w-px h-4 bg-white/20" />
                         </>
                       )}
                       <button onClick={() => handleDeleteElement(el.id)}><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              ))}

              {/* Page Number Footer */}
              <div className="absolute bottom-10 left-0 w-full text-center text-[10px] font-black uppercase tracking-widest opacity-20">
                — {currentPageIndex + 1} —
              </div>
           </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100% !important; 
            height: 100% !important; 
            box-shadow: none !important;
          }
          header, aside, .pagination-controls { display: none !important; }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};
