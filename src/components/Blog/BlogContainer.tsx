"use client";

import React, { useState, useMemo } from "react";
import { MapPin, Clock, Navigation, Calendar, ChevronDown, Camera, X } from "lucide-react";
import { Reveal, RevealImage, FloatingHeader, Lightbox, JourneyMap } from "./BlogClient";
import { AnimatePresence, motion } from "framer-motion";
import { BlogSocial } from "./BlogSocial";

interface BlogContainerProps {
  posts: any[];
  folder: any;
  template: string;
  onlyMap?: any;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const BlogContainer: React.FC<BlogContainerProps> = ({ posts, folder, template, onlyMap }) => {
  const [lightbox, setLightbox] = useState<{ images: string[], index: number } | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Move all hooks to the top
  const mapPoints = useMemo(() => {
    if (!mounted) return [];
    return posts
      .map(p => {
        const loc = p.locations?.[0];
        if (loc && loc.latitude && loc.longitude) {
          const time = new Date(p.recordedAt || p.createdAt).toLocaleTimeString("cs-CZ", { hour: '2-digit', minute: '2-digit' });
          return { 
            lat: loc.latitude, 
            lng: loc.longitude, 
            title: p.taskType === "GPS_LOG" ? `📍 Poloha (${time})` : p.title 
          };
        }
        return null;
      })
      .filter(Boolean) as { lat: number, lng: number, title: string }[];
  }, [posts, mounted]);

  const visiblePosts = useMemo(() => posts.filter(p => p.taskType !== "GPS_LOG"), [posts]);

  const visibleDistances = useMemo(() => {
    const dists: Record<string, number> = {};
    for (let i = 0; i < visiblePosts.length - 1; i++) {
      const current = visiblePosts[i];
      const next = visiblePosts[i+1];
      
      let totalDist = 0;
      const sIdx = posts.findIndex(p => p.id === current.id);
      const eIdx = posts.findIndex(p => p.id === next.id);
      
      for (let j = sIdx; j < eIdx; j++) {
        const pA = posts[j];
        const pB = posts[j+1];
        
        if (pA.calculatedDistance !== null && pA.calculatedDistance !== undefined) {
          totalDist += pA.calculatedDistance;
        } else {
          const l1 = pA.locations?.[0];
          const l2 = pB.locations?.[0];
          if (l1 && l2) totalDist += calculateDistance(l1.latitude, l1.longitude, l2.latitude, l2.longitude);
        }
      }
      dists[current.id] = totalDist;
    }
    return dists;
  }, [visiblePosts, posts]);

  if (!mounted) {
    return <div className="min-h-screen opacity-0" />;
  }

  if (onlyMap) {
    const loc = onlyMap.locations?.[0];
    if (!loc) return null;
    return (
       <div 
         className="w-full h-full cursor-pointer hover:scale-105 transition-transform duration-300"
         onClick={() => setShowMapModal(true)}
       >
         <JourneyMap 
            id={`header-mini-map-${folder.id}`}
            points={[{ lat: loc.latitude, lng: loc.longitude, title: "Aktuálně" }]} 
            isMini 
         />
       </div>
    );
  }

  const isMinimal = template === "MINIMAL";
  const isAdventure = template === "ADVENTURE";
  const isElegant = template === "ELEGANT";
  const isDark = template === "DARK";

  const accentColor = isAdventure ? "#d4a373" : isElegant ? "#c5a059" : "#ea580c";

  const SmartImageGrid = ({ images, imageUrls, onLightbox }: { images: any[], imageUrls: string[], onLightbox: (idx: number) => void }) => {
    const count = images.length;
    if (count === 0) return null;

    // Masonry approach using CSS columns
    const getColumns = () => {
      if (count === 1) return "columns-1";
      if (count <= 4) return "columns-1 md:columns-2";
      return "columns-1 md:columns-2 lg:columns-3";
    };

    return (
      <div className={`${getColumns()} gap-8 space-y-8 max-w-5xl`}>
        {images.map((att: any, idx: number) => {
          const rotation = isAdventure ? (idx % 2 === 0 ? -1.5 : 1.5) : 0;
          return (
            <div key={att.id} className="break-inside-avoid mb-6">
              <RevealImage 
                delay={idx * 0.1} 
                rotation={rotation}
                onClick={() => onLightbox(idx)}
              >
                <div className={`relative group overflow-hidden shadow-xl transition-all duration-700 ${isAdventure ? 'border-[10px] border-white p-0.5 rounded-sm shadow-stone-400/20' : isElegant ? 'rounded-none' : 'rounded-2xl md:rounded-3xl'}`}>
                  {isAdventure && idx % 3 === 0 && (
                    <div className="absolute top-[-15px] left-1/2 -translate-x-1/2 w-20 h-8 washi-tape z-20 rotate-[-3deg] pointer-events-none opacity-60" />
                  )}
                  <img 
                    src={att.url} 
                    alt={att.name} 
                    className="w-full h-auto object-contain transition-transform duration-1000 group-hover:scale-105" 
                  />
                </div>
              </RevealImage>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* Interactive Map Section */}
      {mapPoints.length > 1 && (
        <div className="mb-48" id="main-journey-map">
          <Reveal>
            <JourneyMap points={mapPoints} />
          </Reveal>
        </div>
      )}

      <div className="space-y-64">
        {[...visiblePosts].reverse().map((post, idx) => {
          const visualIndex = visiblePosts.length - idx;
          const date = new Date(post.recordedAt || post.createdAt);

          const images = post.attachments?.filter((a: any) => a.type === "image") || [];
          const imageUrls = images.map((img: any) => img.url);
          
          const distToNext = visibleDistances[post.id] || 0;

          // Sentence-based Granular Interleaving
          const getSentenceChunks = (text: string) => {
            if (!text) return [];
            // Split by sentences: punctuation followed by space and a Capital Letter or Digit
            const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z\u00C0-\u017F0-9])/).filter(s => s.trim().length > 0);
            
            if (sentences.length < 2) return [text]; 
            
            const chunks = [];
            for (let i = 0; i < sentences.length; i += 2) {
              chunks.push(sentences.slice(i, i + 2).join(" ").trim());
            }
            return chunks;
          };

          let paragraphs = getSentenceChunks(post.description || "");
          
          return (
            <article key={post.id} className="relative group blog-article">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-16 items-start">
                
                {/* Metadata Column (Desktop) */}
                {!isMinimal && (
                  <div className="md:col-span-2 hidden md:block pt-6 sticky top-24">
                     <Reveal>
                       <div className={`text-[13px] font-black uppercase tracking-[0.3em] mb-6 ${isAdventure ? 'text-[#a68a64]' : isElegant ? 'text-[#c5a059]' : isDark ? 'text-white/60' : 'text-[#ea580c]'}`}>
                          {visualIndex}
                       </div>
                       <div className={`text-[12px] font-black space-y-2 ${isDark ? 'text-white/50' : 'text-stone-500'}`}>
                          <div>{mounted ? date.toLocaleTimeString("cs-CZ", { hour: '2-digit', minute: '2-digit' }) : "--:--"}</div>
                          <div>{mounted ? date.toLocaleDateString("cs-CZ") : "--.--.----"}</div>
                       </div>
                     </Reveal>
                  </div>
                )}

                {/* Main Entry Content */}
                <div className={`${isMinimal ? 'md:col-span-12' : 'md:col-span-10'}`}>
                  
                  <header className="mb-16">
                     <Reveal>
                       <h2 className={`text-5xl md:text-8xl font-black leading-[0.85] mb-10 ${isAdventure || isElegant ? 'font-serif italic' : 'tracking-tighter'}`}>
                          {post.title}
                       </h2>
                       {post.locations?.[0] && !isMinimal && (
                         <div className={`flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] ${isDark ? 'text-white/60' : 'text-stone-500'}`}>
                           <MapPin size={16} className={isAdventure ? 'text-[#a68a64]' : isElegant ? 'text-[#c5a059]' : 'text-[#ea580c]'} />
                           {post.locations[0].placeName || post.locations[0].address}
                         </div>
                       )}
                     </Reveal>
                  </header>

                  <div className="flex flex-col gap-12">
                     {/* Dynamic Content Interleaving */}
                     {paragraphs.length > 0 ? (
                       <div className="space-y-16">
                         {paragraphs.map((para: string, pIdx: number) => {
                           // Decide which images to show after this paragraph
                           // We distribute images evenly among paragraphs
                           const imagesPerPara = Math.ceil(images.length / paragraphs.length);
                           const paraImages = images.slice(pIdx * imagesPerPara, (pIdx + 1) * imagesPerPara);
                           
                           return (
                             <div key={pIdx} className="space-y-16">
                               <Reveal delay={0.1}>
                                 <div className={`relative ${isAdventure || isElegant ? 'font-serif leading-relaxed text-2xl max-w-2xl' : 'text-stone-600 leading-[1.8] text-xl md:text-2xl max-w-3xl'}`}>
                                    {pIdx === 0 && (
                                      <span className={`drop-cap ${isAdventure ? 'text-[#d4a373]' : isElegant ? 'text-[#c5a059]' : isDark ? 'text-white/20' : 'text-[#ea580c]/30'}`}>
                                        {para.charAt(0)}
                                      </span>
                                    )}
                                    <p className="whitespace-pre-wrap">{pIdx === 0 ? para.slice(1) : para}</p>
                                 </div>
                               </Reveal>

                                <SmartImageGrid 
                                  images={paraImages} 
                                  imageUrls={imageUrls} 
                                  onLightbox={(localIdx) => {
                                    const absoluteIdx = images.indexOf(paraImages[localIdx]);
                                    setLightbox({ images: imageUrls, index: absoluteIdx });
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        // Fallback for posts with only images
                        <SmartImageGrid 
                          images={images} 
                          imageUrls={imageUrls} 
                          onLightbox={(idx) => setLightbox({ images: imageUrls, index: idx })}
                        />
                      )}
                  </div>

                  <Reveal delay={0.2}>
                    <BlogSocial 
                      taskId={post.id}
                      initialLikes={post._count?.likes || 0}
                      initialComments={post._count?.comments || 0}
                      initiallyLiked={post.likes?.length > 0}
                      theme={{ isDark, accent: accentColor }}
                    />
                  </Reveal>
                </div>
              </div>

              {/* Distance Indicator */}
              {distToNext > 0.1 && (
                <Reveal>
                  <div className="flex items-center gap-16 my-48">
                    <div className={`h-px flex-1 opacity-10 ${isDark ? 'bg-white' : 'bg-black'}`} />
                    <div className={`text-[11px] font-black tracking-[0.6em] uppercase whitespace-nowrap opacity-20 flex items-center gap-6 ${isAdventure || isElegant ? 'font-serif italic' : ''}`}>
                       <Navigation size={14} />
                       {distToNext.toFixed(1)} KM
                    </div>
                    <div className={`h-px flex-1 opacity-10 ${isDark ? 'bg-white' : 'bg-black'}`} />
                  </div>
                </Reveal>
              )}
            </article>
          );
        })}
      </div>

      <AnimatePresence>
        {lightbox && (
          <Lightbox 
            images={lightbox.images} 
            initialIndex={lightbox.index} 
            onClose={() => setLightbox(null)} 
          />
        )}
        {showMapModal && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-12" 
             onClick={() => setShowMapModal(false)}
           >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-6xl h-[85vh] bg-stone-100 rounded-[32px] overflow-hidden shadow-2xl border border-white/10" 
                onClick={e => e.stopPropagation()}
              >
                 <JourneyMap points={mapPoints} id="modal-journey-map" className="h-full" />
                 <button 
                    onClick={() => setShowMapModal(false)}
                    className="absolute top-8 right-8 z-50 bg-white/20 hover:bg-white text-black p-4 rounded-full backdrop-blur-md transition-all hover:scale-110 active:scale-95 border border-white/20 shadow-xl"
                 >
                    <X size={24} />
                 </button>
              </motion.div>
           </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
