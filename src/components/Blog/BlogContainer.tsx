"use client";

import React, { useState } from "react";
import { MapPin, Clock, Navigation, Calendar, ChevronDown, Camera } from "lucide-react";
import { Reveal, RevealImage, FloatingHeader, Lightbox, JourneyMap } from "./BlogClient";
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

  // Extract map points
  const mapPoints = posts
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

  // Odometer Calibration Logic
  const getCalibratedDistances = () => {
    let odoPosts = posts.filter(p => p.odometer !== null && p.odometer !== undefined);
    
    // Support "Trip Odometer" mode: If the first post doesn't have an odometer, 
    // assume it started at 0 for the sake of calibration.
    if (posts.length > 0 && (odoPosts.length === 0 || odoPosts[0].id !== posts[0].id)) {
      odoPosts = [{ ...posts[0], odometer: 0 }, ...odoPosts];
    }

    const corrections: Record<string, number> = {};
    if (odoPosts.length < 2) return corrections;

    for (let i = 0; i < odoPosts.length - 1; i++) {
      const p1 = odoPosts[i];
      const p2 = odoPosts[i+1];
      const realSegmentDist = Math.abs((p2.odometer || 0) - (p1.odometer || 0));
      
      const segmentStartIndex = posts.findIndex(p => p.id === p1.id);
      const segmentEndIndex = posts.findIndex(p => p.id === p2.id);
      const segmentPosts = posts.slice(segmentStartIndex, segmentEndIndex + 1);
      
      let gpsSegmentDist = 0;
      const segmentStepDistances: {id: string, dist: number}[] = [];
      
      for (let j = 0; j < segmentPosts.length - 1; j++) {
        const l1 = segmentPosts[j].locations?.[0];
        const l2 = segmentPosts[j+1].locations?.[0];
        if (l1 && l2) {
          const d = calculateDistance(l1.latitude, l1.longitude, l2.latitude, l2.longitude);
          gpsSegmentDist += d;
          segmentStepDistances.push({ id: segmentPosts[j].id, dist: d });
        }
      }
      
      const ratio = gpsSegmentDist > 0 ? realSegmentDist / gpsSegmentDist : 1;
      segmentStepDistances.forEach(step => {
        corrections[step.id] = step.dist * ratio;
      });
    }
    return corrections;
  };

  const calibratedCorrections = getCalibratedDistances();
  const visiblePosts = posts.filter(p => p.taskType !== "GPS_LOG" || (p.locations && p.locations.length > 0));

  // Calculate distances between visible posts, including intermediate GPS_LOG points
  const getVisibleDistances = () => {
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
        
        if (calibratedCorrections[pA.id] !== undefined) {
          totalDist += calibratedCorrections[pA.id];
        } else {
          const l1 = pA.locations?.[0];
          const l2 = pB.locations?.[0];
          if (l1 && l2) totalDist += calculateDistance(l1.latitude, l1.longitude, l2.latitude, l2.longitude);
        }
      }
      dists[current.id] = totalDist;
    }
    return dists;
  };

  const visibleDistances = getVisibleDistances();

  return (
    <>
      {/* Interactive Map Section */}
      {mapPoints.length > 1 && (
        <div className="mb-48">
          <Reveal>
            <JourneyMap points={mapPoints} />
          </Reveal>
        </div>
      )}

      <div className="space-y-64">
        {[...visiblePosts].reverse().map((post, idx) => {
          const visualIndex = visiblePosts.length - idx;
          const date = new Date(post.recordedAt || post.createdAt);

          if (post.taskType === "GPS_LOG") {
            const loc = post.locations[0];
            return (
              <div key={post.id} className="relative flex justify-center py-8">
                 <Reveal>
                    <div className="flex flex-col items-center gap-4">
                       <div className="flex items-center gap-3 px-4 py-2 bg-white/80 backdrop-blur-md border border-stone-100 rounded-full shadow-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">
                             Zapsána poloha: {date.toLocaleTimeString("cs-CZ", { hour: '2-digit', minute: '2-digit' })}
                          </span>
                       </div>
                       <div className="h-32 w-48 rounded-3xl overflow-hidden border-4 border-white shadow-xl relative group cursor-pointer hover:scale-105 transition-all">
                          <JourneyMap 
                             id={`mini-map-${post.id}`}
                             points={[{ lat: loc.latitude, lng: loc.longitude, title: "Zde" }]} 
                             isMini 
                          />
                       </div>
                    </div>
                 </Reveal>
              </div>
            );
          }
          const images = post.attachments?.filter((a: any) => a.type === "image") || [];
          const imageUrls = images.map((img: any) => img.url);
          
          const distToNext = visibleDistances[post.id] || 0;

          // Content Interleaving Logic - improved to handle single newlines if needed
          let paragraphs = post.description ? post.description.split(/\n\s*\n/).filter(Boolean) : [];
          
          // Fallback: If we have one giant block but it contains single newlines, split by those
          if (paragraphs.length === 1 && post.description && post.description.includes('\n')) {
            paragraphs = post.description.split('\n').filter((p: string) => p.trim().length > 20);
          }
          
          // Safety: If still only 1 paragraph but very long, we could split by sentences, 
          // but usually single newline split above covers most cases.
          
          return (
            <article key={post.id} className="relative group blog-article">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-16 items-start">
                
                {/* Metadata Column (Desktop) */}
                {!isMinimal && (
                  <div className="md:col-span-2 hidden md:block pt-6 sticky top-24">
                     <Reveal>
                       <div className={`text-[12px] font-black uppercase tracking-[0.3em] mb-6 ${isAdventure ? 'text-[#a68a64]' : isElegant ? 'text-[#c5a059]' : isDark ? 'text-white/40' : 'text-[#ea580c]'}`}>
                          {visualIndex}
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
