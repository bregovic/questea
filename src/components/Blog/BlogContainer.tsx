"use client";

import React, { useState } from "react";
import { MapPin, Clock, Navigation, Calendar, ChevronDown, Camera } from "lucide-react";
import { Reveal, RevealImage, FloatingHeader, Lightbox } from "./BlogClient";
import { AnimatePresence } from "framer-motion";

interface BlogContainerProps {
  posts: any[];
  folder: any;
  template: string;
}

export const BlogContainer: React.FC<BlogContainerProps> = ({ posts, folder, template }) => {
  const [lightbox, setLightbox] = useState<{ images: string[], index: number } | null>(null);

  const isMinimal = template === "MINIMAL";
  const isAdventure = template === "ADVENTURE";
  const isElegant = template === "ELEGANT";
  const isDark = template === "DARK";

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

  return (
    <>
      <div className="space-y-64">
        {posts.map((post, idx) => {
          const date = new Date(post.recordedAt || post.createdAt);
          const nextPost = posts[idx + 1];
          const images = post.attachments?.filter((a: any) => a.type === "image") || [];
          const imageUrls = images.map((img: any) => img.url);
          
          let distToNext = 0;
          if (nextPost) {
            const l1 = post.locations?.[0];
            const l2 = nextPost.locations?.[0];
            if (l1 && l2) distToNext = calculateDistance(l1.latitude, l1.longitude, l2.latitude, l2.longitude);
          }

          // Content Interleaving Logic
          const paragraphs = post.description ? post.description.split("\n\n").filter(Boolean) : [];
          
          return (
            <article key={post.id} className="relative group blog-article">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-16 items-start">
                
                {/* Metadata Column (Desktop) */}
                {!isMinimal && (
                  <div className="md:col-span-2 hidden md:block pt-6 sticky top-24">
                     <Reveal>
                       <div className={`text-[12px] font-black uppercase tracking-[0.3em] mb-6 ${isAdventure ? 'text-[#a68a64]' : isElegant ? 'text-[#c5a059]' : isDark ? 'text-white/40' : 'text-[#ea580c]'}`}>
                          {idx + 1}
                       </div>
                       <div className={`text-[11px] font-black space-y-2 opacity-60 ${isDark ? 'text-white/30' : 'text-stone-400'}`}>
                          <div>{date.toLocaleTimeString("cs-CZ", { hour: '2-digit', minute: '2-digit' })}</div>
                          <div>{date.toLocaleDateString("cs-CZ")}</div>
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
                         <div className={`flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] ${isDark ? 'text-white/40' : 'text-stone-400'}`}>
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

                               {paraImages.length > 0 && (
                                 <div className={`grid gap-6 ${paraImages.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                                   {paraImages.map((att: any, imgIdx: number) => {
                                      const absoluteImgIdx = images.indexOf(att);
                                      const rotation = isAdventure ? (imgIdx % 2 === 0 ? -2.5 : 2.5) : 0;
                                      
                                      return (
                                        <RevealImage 
                                          key={att.id} 
                                          delay={imgIdx * 0.1} 
                                          rotation={rotation}
                                          onClick={() => setLightbox({ images: imageUrls, index: absoluteImgIdx })}
                                        >
                                          <div className={`relative group overflow-hidden shadow-xl transition-all duration-700 ${isAdventure ? 'border-[12px] border-white p-1 rounded-sm shadow-stone-400/30' : isElegant ? 'rounded-none border border-stone-100' : 'rounded-2xl md:rounded-3xl'}`}>
                                            {isAdventure && (
                                              <div className="absolute top-[-15px] left-1/2 -translate-x-1/2 w-24 h-10 washi-tape z-20 rotate-[-2deg] pointer-events-none opacity-80" />
                                            )}
                                            <img 
                                              src={att.url} 
                                              alt={att.name} 
                                              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 aspect-[4/3] md:aspect-[3/2]" 
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 duration-500">
                                              <div className="bg-white/20 backdrop-blur-md p-4 rounded-full border border-white/30 text-white">
                                                <Camera size={24} />
                                              </div>
                                            </div>
                                          </div>
                                        </RevealImage>
                                      );
                                   })}
                                 </div>
                               )}
                             </div>
                           );
                         })}
                       </div>
                     ) : (
                       // Fallback for posts with only images
                       <div className={`grid gap-6 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                          {images.map((att: any, imgIdx: number) => (
                            <RevealImage 
                              key={att.id} 
                              delay={imgIdx * 0.1}
                              onClick={() => setLightbox({ images: imageUrls, index: imgIdx })}
                            >
                               <div className={`relative group overflow-hidden shadow-xl ${isAdventure ? 'border-[12px] border-white p-1' : isElegant ? 'rounded-none' : 'rounded-2xl md:rounded-3xl'}`}>
                                 <img src={att.url} className="w-full aspect-[4/3] object-cover" />
                               </div>
                            </RevealImage>
                          ))}
                       </div>
                     )}
                  </div>
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
      </AnimatePresence>
    </>
  );
};
