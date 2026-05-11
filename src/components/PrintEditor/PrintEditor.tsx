"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, FileText, Download, ChevronLeft, ChevronRight, Plus, Trash2, Maximize, Minimize, Move, Type, Image as ImageIcon, Layout, Printer, MapPin, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PrintElement {
  id: string;
  type: "blog-entry" | "custom-text" | "custom-image";
  content: any; // Task object or string
  x: number;
  y: number;
  width: number;
  height?: number;
  rotation?: number;
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

  // Initialize pages from tasks - each task is one "Blog Entry" element
  useEffect(() => {
    if (!folder.subTasks) return;
    
    const subTasks = [...folder.subTasks]
      .filter((t: any) => !t.isDeleted && t.taskType !== "GPS_LOG")
      .sort((a: any, b: any) => new Date(a.recordedAt || a.createdAt).getTime() - new Date(b.recordedAt || b.createdAt).getTime());

    const paginated: PrintPage[] = [];
    
    // Simple: One long entry per page for now, or multiple if they fit.
    subTasks.forEach((t: any, i: number) => {
      const visualIndex = subTasks.length - i;
      paginated.push({
        elements: [{
          id: "entry-" + t.id,
          type: "blog-entry",
          content: { ...t, visualIndex },
          x: 0, y: 5, width: 100
        }]
      });
    });

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

  // Helper component to render the entry EXACTLY like the blog
  const BlogEntryRenderer = ({ post }: { post: any }) => {
    const date = new Date(post.recordedAt || post.createdAt);
    const images = post.attachments?.filter((a: any) => a.type === "image") || [];
    
    // Blog logic for paragraphs
    const getSentenceChunks = (text: string) => {
      if (!text) return [];
      const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z\u00C0-\u017F0-9])/).filter(s => s.trim().length > 0);
      if (sentences.length < 2) return [text]; 
      const chunks = [];
      for (let i = 0; i < sentences.length; i += 2) {
        chunks.push(sentences.slice(i, i + 2).join(" ").trim());
      }
      return chunks;
    };
    const paragraphs = getSentenceChunks(post.description || "");

    return (
      <article className="blog-article-print px-12 py-8">
        <div className="grid grid-cols-12 gap-8 items-start">
          {/* Metadata Sidebar */}
          <div className="col-span-2 pt-6">
            <div className={`text-[12px] font-black uppercase tracking-[0.3em] mb-4`} style={{ color: accentColor }}>
              {post.visualIndex}
            </div>
            <div className={`text-[10px] font-black space-y-1 opacity-40 text-stone-500`}>
              <div>{date.toLocaleTimeString("cs-CZ", { hour: '2-digit', minute: '2-digit' })}</div>
              <div>{date.toLocaleDateString("cs-CZ")}</div>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-10">
            <header className="mb-8">
              <h2 className={`text-6xl font-black leading-[0.85] mb-6 text-stone-950 ${isAdventure || isElegant ? 'serif-font italic' : 'title-font'}`}>
                {post.title}
              </h2>
              {post.locations?.[0] && (
                <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-stone-400`}>
                  <MapPin size={14} style={{ color: accentColor }} />
                  {post.locations[0].placeName || post.locations[0].address}
                </div>
              )}
            </header>

            <div className="flex flex-col gap-8">
              {paragraphs.map((para: string, pIdx: number) => {
                const imagesPerPara = Math.ceil(images.length / (paragraphs.length || 1));
                const paraImages = images.slice(pIdx * imagesPerPara, (pIdx + 1) * imagesPerPara);
                
                return (
                  <div key={pIdx} className="space-y-8">
                    <div className="relative font-medium leading-[1.6] text-xl text-stone-800">
                      {pIdx === 0 && (
                        <span className="drop-cap-print">
                          {para.charAt(0)}
                        </span>
                      )}
                      <p className="whitespace-pre-wrap">{pIdx === 0 ? para.slice(1) : para}</p>
                    </div>

                    {paraImages.length > 0 && (
                      <div className={`columns-${Math.min(paraImages.length, 2)} gap-4 space-y-4`}>
                        {paraImages.map((att: any, imgIdx: number) => (
                          <div key={att.id} className="break-inside-avoid">
                            <div className={`relative group overflow-hidden shadow-xl transition-all duration-700 ${isAdventure ? 'border-[8px] border-white p-0.5 rounded-sm shadow-stone-400/20' : 'rounded-2xl'}`}>
                              <img src={att.url} className="w-full h-auto object-contain" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Fallback for only images */}
              {paragraphs.length === 0 && images.length > 0 && (
                <div className="columns-2 gap-4 space-y-4">
                  {images.map((att: any) => (
                    <div key={att.id} className="break-inside-avoid">
                       <div className={`relative group overflow-hidden shadow-xl ${isAdventure ? 'border-[8px] border-white p-0.5 rounded-sm' : 'rounded-2xl'}`}>
                         <img src={att.url} className="w-full h-auto object-contain" />
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  };

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
          margin-right: 1rem;
          margin-top: 0.4rem;
          font-size: 6rem;
          color: ${accentColor};
          opacity: 0.3;
        }

        .title-font { font-family: 'Outfit', sans-serif; }
        .serif-font { font-family: 'Playfair Display', serif; }
        
        @media print {
          @page { size: auto; margin: 0mm; }
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
             <button key={f} onClick={() => setFormat(f as any)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${format === f ? 'bg-white text-black shadow-lg' : 'opacity-40 hover:opacity-100'}`}>{f}</button>
           ))}
        </div>

        <button onClick={handleExport} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
          <Printer size={14} /> PDF Tisk
        </button>
      </header>

      <div className="editor-container flex-1 flex overflow-hidden">
        <aside className="no-print w-20 bg-black/50 border-r border-white/5 flex flex-col items-center py-8 gap-8 shrink-0">
           <button onClick={() => setCurrentPageIndex(p => Math.max(0, p-1))} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
              <ChevronLeft size={20} className="text-white/60" />
           </button>
           <button onClick={() => setCurrentPageIndex(p => Math.min(pages.length-1, p+1))} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
              <ChevronRight size={20} className="text-white/60" />
           </button>
        </aside>

        <div className="flex-1 overflow-auto p-12 flex flex-col items-center gap-12 bg-stone-950/50 scrollbar-hide">
           <div className="no-print text-white/40 text-[10px] font-black uppercase tracking-widest">STRANA {currentPageIndex + 1} Z {pages.length}</div>

           {/* The Page */}
           <div className={`print-page relative paper-bg shadow-2xl flex-shrink-0 transition-all duration-500 overflow-hidden ${format === 'A4' ? 'w-[794px] h-[1123px]' : 'w-[559px] h-[794px]'}`}>
              {pages[currentPageIndex]?.elements.map((el) => (
                <div 
                  key={el.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedElementId(el.id); }}
                  className={`absolute group transition-all ${selectedElementId === el.id ? 'border-2 border-orange-500 bg-orange-500/5 z-[100]' : 'border-2 border-transparent hover:border-orange-500/10'}`}
                  style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`, transform: el.rotation ? `rotate(${el.rotation}deg)` : 'none' }}
                >
                  {el.type === 'blog-entry' ? (
                    <BlogEntryRenderer post={el.content} />
                  ) : el.type === 'custom-text' ? (
                    <textarea className="w-full bg-transparent outline-none resize-none serif-font p-4 text-xl" value={el.content} onChange={(e) => handleUpdateElement(el.id, { content: e.target.value })} />
                  ) : null}

                  {selectedElementId === el.id && (
                    <div className="no-print absolute -top-12 left-0 flex items-center bg-stone-900 text-white rounded-xl shadow-2xl px-3 h-10 gap-4 z-[110] border border-white/10">
                       <button onClick={() => handleUpdateElement(el.id, { y: el.y - 1 })} className="rotate-90"><ChevronLeft size={16} /></button>
                       <button onClick={() => handleUpdateElement(el.id, { y: el.y + 1 })} className="rotate-90"><ChevronRight size={16} /></button>
                       <div className="w-px h-4 bg-white/10" />
                       <button onClick={() => handleDeleteElement(el.id)} className="text-red-400"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="absolute bottom-10 left-0 w-full text-center text-[10px] font-black uppercase tracking-widest opacity-30">— {currentPageIndex + 1} —</div>
           </div>
        </div>
      </div>
    </div>
  );
};
