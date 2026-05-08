"use client";

import { useState, useEffect, ReactNode, useRef } from "react";
import { motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Navigation } from "lucide-react";
import { AnimatePresence } from "framer-motion";

export const BlogStyles = () => {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,900;1,900&family=Outfit:wght@300;400;700;900&display=swap');
      html { scroll-behavior: smooth; }
      body { 
        -webkit-font-smoothing: antialiased;
        overflow-x: hidden;
      }
      .drop-cap {
        float: left;
        font-family: 'Playfair Display', serif;
        font-weight: 900;
        line-height: 0.8;
        margin-right: 0.75rem;
        margin-top: 0.5rem;
        font-size: 4.5rem;
      }
      @media (min-width: 768px) {
        .drop-cap {
          font-size: 7.5rem;
          margin-right: 1.5rem;
          margin-top: 1rem;
        }
      }
      .washi-tape {
        background: rgba(255, 255, 255, 0.4);
        backdrop-filter: blur(4px);
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        border: 1px solid rgba(255,255,255,0.2);
      }
      .blog-article {
        container-type: inline-size;
      }
    `}</style>
  );
};

export const Reveal = ({ children, delay = 0 }: { children: ReactNode, delay?: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
};

export const RevealImage = ({ children, delay = 0, rotation = 0, onClick }: { children: ReactNode, delay?: number, rotation?: number, onClick?: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, rotate: rotation - 3 }}
      whileInView={{ opacity: 1, scale: 1, rotate: rotation }}
      viewport={{ once: true }}
      transition={{ duration: 1.2, delay, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className={onClick ? "cursor-pointer" : ""}
    >
      {children}
    </motion.div>
  );
};

export const FloatingHeader = ({ children }: { children: ReactNode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 2, ease: "easeOut" }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
};

export const Lightbox = ({ images, initialIndex, onClose }: { images: string[], initialIndex: number, onClose: () => void }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setCurrentIndex((prev) => (prev + 1) % images.length);
      if (e.key === "ArrowLeft") setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "auto";
    };
  }, [images.length, onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-12"
      onClick={onClose}
    >
      <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <motion.img
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          src={images[currentIndex]}
          className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
        />
        
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 font-mono text-sm tracking-widest bg-black/20 px-4 py-2 rounded-full backdrop-blur-md">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>

      <button 
        className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors p-3 bg-white/10 hover:bg-white/20 rounded-full z-[100] backdrop-blur-md border border-white/10"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X size={32} />
      </button>

      {images.length > 1 && (
        <>
          <button 
            className="absolute left-8 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors p-4 z-[100] hidden md:block"
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => (prev - 1 + images.length) % images.length); }}
          >
            <ChevronLeft size={48} />
          </button>
          <button 
            className="absolute right-8 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors p-4 z-[100] hidden md:block"
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => (prev + 1) % images.length); }}
          >
            <ChevronRight size={48} />
          </button>
        </>
      )}
    </motion.div>
  );
};
export const JourneyMap = ({ points, isMini = false, id = "journey-map" }: { points: { lat: number, lng: number, title: string }[], isMini?: boolean, id?: string }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    // Load Leaflet from CDN
    if (!(window as any).L) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => initMap();
      document.head.appendChild(script);
    } else {
      initMap();
    }

    function initMap() {
      const L = (window as any).L;
      if (!L || !points.length) return;

      const container = document.getElementById(id);
      if (!container || (container as any)._leaflet_id) return;

      const map = L.map(id, {
        zoomControl: false,
        scrollWheelZoom: false,
        attributionControl: false,
        dragging: isUnlocked && !isMini,
        touchZoom: isUnlocked && !isMini,
        doubleClickZoom: isUnlocked && !isMini,
        tap: isUnlocked && !isMini
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(map);

      const latlngs = points.map(p => [p.lat, p.lng]);
      
      // Draw path
      if (latlngs.length > 1) {
        L.polyline(latlngs, {
          color: '#ea580c',
          weight: isMini ? 2 : 3,
          opacity: 0.5,
          dashArray: '10, 10'
        }).addTo(map);
      }

      // Add markers
      points.forEach((p, i) => {
        const isLast = i === points.length - 1;
        const color = isLast ? '#22c55e' : '#ea580c';
        
        const icon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color: ${color}; width: ${isMini ? '8px' : '12px'}; height: ${isMini ? '8px' : '12px'}; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.2);"></div>`,
          iconSize: [isMini ? 8 : 12, isMini ? 8 : 12],
          iconAnchor: [isMini ? 4 : 6, isMini ? 4 : 6]
        });

        const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
        if (!isMini) {
           marker.bindPopup(`<b style="font-family: sans-serif; font-size: 12px;">${p.title}</b>`);
        }
      });

      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: isMini ? [5, 5] : [50, 50] });
      if (isMini && points.length === 1) {
        map.setZoom(12);
      }
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [points, isMini, id, isUnlocked]);

  return (
    <div 
      className={`relative w-full ${isMini ? 'h-full' : 'h-[400px] md:h-[600px]'} rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-stone-100 group transition-all duration-500 ${isUnlocked ? 'ring-4 ring-orange-500/20' : ''}`}
      onClick={() => !isMini && setIsUnlocked(true)}
    >
      <div id={id} className="w-full h-full z-10" />
      
      {!isMini && !isUnlocked && (
        <div className="absolute inset-0 z-30 cursor-pointer group-hover:bg-black/5 transition-all" />
      )}

      {!isMini && (
        <div className="absolute top-6 left-6 z-20 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
          <Navigation size={14} className="text-orange-500" />
          Mapa expedice {isUnlocked && <span className="text-orange-600 font-bold ml-1">• Aktivní</span>}
        </div>
      )}
      
      {isUnlocked && !isMini && (
        <button 
          onClick={(e) => { e.stopPropagation(); setIsUnlocked(false); }}
          className="absolute bottom-6 right-6 z-40 bg-stone-900/80 backdrop-blur-md text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl border border-white/10"
        >
          Ukončit režim mapy
        </button>
      )}
    </div>
  );
};

export const ViewCounter = ({ blogId }: { blogId: string }) => {
  const [views, setViews] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Increment and fetch views
    fetch(`/api/blog/${blogId}/view`, { method: "POST" })
      .then(res => res.json())
      .then(data => {
        if (data.viewCount !== undefined) setViews(data.viewCount);
      })
      .catch(err => console.error("Failed to track views", err));
  }, [blogId]);

  if (views === null || !mounted) return null;

  return (
    <div className="flex flex-col items-center gap-4 opacity-30 hover:opacity-100 transition-opacity duration-1000 group">
      <div className="h-px w-12 bg-stone-300" />
      <div className="flex items-center gap-2 text-stone-900 text-[9px] font-black uppercase tracking-[0.4em]">
        {views.toLocaleString("cs-CZ")} návštěv
      </div>
    </div>
  );
};
