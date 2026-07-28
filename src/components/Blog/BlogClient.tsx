"use client";

import { useState, useEffect, ReactNode, useRef } from "react";
import { motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Navigation, Maximize2 } from "lucide-react";
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
      @keyframes pulse {
        0% { transform: scale(1); opacity: 0.5; }
        100% { transform: scale(3); opacity: 0; }
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

const MAX_ZOOM = 4;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const dist = (a: { x: number, y: number }, b: { x: number, y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export const Lightbox = ({ images, initialIndex, onClose }: { images: string[], initialIndex: number, onClose: () => void }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  /* Transformace fotky žije v refu, ne ve state – gesto tak nepřekresluje React
     na každý pohyb prstu a zůstává plynulé i na slabším mobilu. */
  const tr = useRef({ scale: 1, x: 0, y: 0 });
  const g = useRef({
    pointers: new Map<number, { x: number, y: number }>(),
    startDist: 0, startScale: 1, startX: 0, startY: 0,
    downX: 0, downY: 0, pinchCx: 0, pinchCy: 0,
    dx: 0, dy: 0, moved: false, lastTap: 0,
  });

  const apply = (animate: boolean) => {
    const el = zoomRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform 260ms cubic-bezier(0.16,1,0.3,1)" : "none";
    el.style.transform = `translate3d(${tr.current.x}px, ${tr.current.y}px, 0) scale(${tr.current.scale})`;
  };

  /* Meze posunu: fotku nejde vytáhnout mimo vlastní plochu. */
  const setTransform = (scale: number, x: number, y: number, animate = false) => {
    tr.current.scale = clamp(scale, 1, MAX_ZOOM);
    const stage = stageRef.current, img = imgRef.current;
    const maxX = stage && img ? Math.max(0, (img.offsetWidth * tr.current.scale - stage.clientWidth) / 2) : 0;
    const maxY = stage && img ? Math.max(0, (img.offsetHeight * tr.current.scale - stage.clientHeight) / 2) : 0;
    tr.current.x = clamp(x, -maxX, maxX);
    tr.current.y = clamp(y, -maxY, maxY);
    apply(animate);
    setZoomed(tr.current.scale > 1.01);
  };

  const reset = (animate = false) => setTransform(1, 0, 0, animate);
  const go = (dir: number) => setCurrentIndex((prev) => (prev + dir + images.length) % images.length);

  /* Dvojtap / dvojklik přiblíží na místo, kam uživatel ťukl. */
  const toggleZoomAt = (clientX: number, clientY: number) => {
    if (tr.current.scale > 1.01) return reset(true);
    const rect = stageRef.current?.getBoundingClientRect();
    const cx = rect ? clientX - (rect.left + rect.width / 2) : 0;
    const cy = rect ? clientY - (rect.top + rect.height / 2) : 0;
    setTransform(2.5, -cx * 1.5, -cy * 1.5, true);
  };

  useEffect(() => { reset(false); }, [currentIndex]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [images.length, onClose]);

  const onPointerDown = (e: React.PointerEvent) => {
    const s = g.current;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    s.moved = false; s.dx = 0; s.dy = 0;
    s.startScale = tr.current.scale; s.startX = tr.current.x; s.startY = tr.current.y;
    s.downX = e.clientX; s.downY = e.clientY;
    if (s.pointers.size === 2) {
      const [p1, p2] = [...s.pointers.values()];
      const rect = stageRef.current?.getBoundingClientRect();
      s.startDist = dist(p1, p2);
      s.pinchCx = (p1.x + p2.x) / 2 - (rect ? rect.left + rect.width / 2 : 0);
      s.pinchCy = (p1.y + p2.y) / 2 - (rect ? rect.top + rect.height / 2 : 0);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s.pointers.has(e.pointerId)) return;
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (s.pointers.size >= 2) {
      if (!s.startDist) return;
      const [p1, p2] = [...s.pointers.values()];
      const rect = stageRef.current?.getBoundingClientRect();
      const scale = clamp(s.startScale * (dist(p1, p2) / s.startDist), 1, MAX_ZOOM);
      const k = scale / s.startScale;
      // bod mezi prsty zůstává na místě + dvěma prsty jde zároveň posouvat
      const cx = (p1.x + p2.x) / 2 - (rect ? rect.left + rect.width / 2 : 0);
      const cy = (p1.y + p2.y) / 2 - (rect ? rect.top + rect.height / 2 : 0);
      setTransform(
        scale,
        s.pinchCx - k * (s.pinchCx - s.startX) + (cx - s.pinchCx),
        s.pinchCy - k * (s.pinchCy - s.startY) + (cy - s.pinchCy),
      );
      s.moved = true;
      return;
    }

    const dx = e.clientX - s.downX, dy = e.clientY - s.downY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) s.moved = true;

    if (tr.current.scale > 1.01) {
      setTransform(tr.current.scale, s.startX + dx, s.startY + dy);
    } else {
      // nepřiblížená fotka: tažení = přepnutí fotky / zavření, s náznakem pohybu
      s.dx = dx; s.dy = dy;
      const el = zoomRef.current;
      if (el) {
        el.style.transition = "none";
        el.style.transform = `translate3d(${dx * 0.6}px, ${Math.max(0, dy) * 0.6}px, 0) scale(1)`;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const s = g.current;
    s.pointers.delete(e.pointerId);

    if (s.pointers.size >= 1) {
      // zvedl se jeden ze dvou prstů – přepni referenci, ať fotka neposkočí
      const [p] = [...s.pointers.values()];
      s.downX = p.x; s.downY = p.y;
      s.startX = tr.current.x; s.startY = tr.current.y;
      s.startScale = tr.current.scale; s.startDist = 0;
      return;
    }

    if (tr.current.scale <= 1.01) {
      const { dx, dy } = s;
      if (images.length > 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        go(dx < 0 ? 1 : -1);
      } else if (dy > 110 && Math.abs(dy) > Math.abs(dx)) {
        onClose();
        return;
      }
      reset(true);
    } else {
      setTransform(tr.current.scale, tr.current.x, tr.current.y, true);
    }

    if (!s.moved) {
      const now = performance.now();
      if (now - s.lastTap < 300) { s.lastTap = 0; toggleZoomAt(e.clientX, e.clientY); }
      else s.lastTap = now;
    }
    s.dx = 0; s.dy = 0;
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    const s = g.current;
    s.pointers.delete(e.pointerId);
    if (s.pointers.size === 0) setTransform(tr.current.scale, tr.current.x, tr.current.y, true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-12"
      onClick={onClose}
    >
      <div
        ref={stageRef}
        className="relative w-full h-full flex items-center justify-center overflow-hidden select-none"
        style={{ touchAction: "none" }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div
          ref={zoomRef}
          className="w-full h-full flex items-center justify-center"
          style={{ willChange: "transform", cursor: zoomed ? "grab" : "zoom-in" }}
        >
          <motion.img
            ref={imgRef}
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            src={images[currentIndex]}
            draggable={false}
            className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
          />
        </div>

        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 font-mono text-sm tracking-widest bg-black/20 px-4 py-2 rounded-full backdrop-blur-md pointer-events-none">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>

      <button
        className="absolute text-white/50 hover:text-white transition-colors p-3 bg-white/10 hover:bg-white/20 rounded-full z-[100] backdrop-blur-md border border-white/10"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)", right: "16px" }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X size={28} />
      </button>

      {images.length > 1 && (
        <>
          <button
            className="absolute left-8 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors p-4 z-[100] hidden md:block"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
          >
            <ChevronLeft size={48} />
          </button>
          <button
            className="absolute right-8 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors p-4 z-[100] hidden md:block"
            onClick={(e) => { e.stopPropagation(); go(1); }}
          >
            <ChevronRight size={48} />
          </button>
        </>
      )}
    </motion.div>
  );
};
/* ───────────────────── trasa mezi body na mapě ─────────────────────
   Každý bod si nese, JAK se k němu došlo z předchozího (travelMode) a
   nacachovanou linku (routeGeometry). Když linka chybí, spojí se rovně –
   mapa tak funguje i pro staré záznamy, kde se nic neroutovalo. */

export type JourneyPoint = {
  lat: number; lng: number; title: string;
  travelMode?: string | null;
  routeGeometry?: string | null;
};

type Segment = { mode: string; coords: [number, number][]; routed: boolean };

const MODE_STYLE: Record<string, { color: string; dash?: string; label: string }> = {
  CAR:    { color: "#ea580c", label: "autem" },
  BIKE:   { color: "#ea580c", dash: "10 7", label: "na kole" },
  WALK:   { color: "#16a34a", dash: "1 7", label: "pěšky" },
  BOAT:   { color: "#0284c7", label: "po vodě" },
  DIRECT: { color: "#a8a29e", dash: "6 8", label: "přímo" },
};

const styleOf = (mode: string) => MODE_STYLE[mode] || MODE_STYLE.DIRECT;

function buildSegments(points: JourneyPoint[]): Segment[] {
  const segs: Segment[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1], cur = points[i];
    let coords: [number, number][] | null = null;
    if (cur.routeGeometry) {
      try {
        const parsed = JSON.parse(cur.routeGeometry);
        if (Array.isArray(parsed) && parsed.length > 1) coords = parsed;
      } catch { /* rozbitý JSON → spojíme rovně */ }
    }
    segs.push({
      mode: coords ? (cur.travelMode || "DIRECT") : "DIRECT",
      coords: coords || [[prev.lat, prev.lng], [cur.lat, cur.lng]],
      routed: !!coords,
    });
  }
  return segs;
}

/* Vykreslí úseky a vrátí všechny souřadnice pro dopočet výřezu. */
function drawSegments(L: any, map: any, points: JourneyPoint[], isMini: boolean): [number, number][] {
  const segs = buildSegments(points);
  const all: [number, number][] = points.map((p) => [p.lat, p.lng]);

  for (const seg of segs) {
    const st = styleOf(seg.mode);
    if (!isMini) {
      // tmavý podklad, ať je linka čitelná i nad hustou mapou
      L.polyline(seg.coords, { color: "#431407", weight: 5, opacity: 0.35 }).addTo(map);
    }
    L.polyline(seg.coords, {
      color: st.color,
      weight: isMini ? 2 : 3,
      opacity: isMini ? 0.8 : 1,
      dashArray: st.dash,
      lineCap: st.dash === "1 7" ? "round" : "butt",
    }).addTo(map);
    all.push(...seg.coords);
  }
  return all;
}

const JourneyMapFullscreen = ({ points, id }: { points: JourneyPoint[], id: string }) => {
  const mapRef = useRef<any>(null);

  useEffect(() => {
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
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        tap: true
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        crossOrigin: true   // CORS dlaždice → canvas se neušpiní → export PDF funguje
      }).addTo(map);

      const latlngs = points.length > 1 ? drawSegments(L, map, points, false) : points.map(p => [p.lat, p.lng] as [number, number]);

      points.forEach((p, i) => {
        const isLast = i === points.length - 1;
        const color = isLast ? '#22c55e' : '#ea580c';

        const icon = L.divIcon({
          className: 'custom-div-icon',
          html: `
            <div style="position: relative; background-color: ${color}; width: 14px; height: 14px; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 0 12px rgba(0,0,0,0.4);">
              ${isLast ? `<div style="position: absolute; inset: -8px; border-radius: 50%; background: ${color}; opacity: 0.3; animation: pulse 2s infinite;"></div>` : ''}
            </div>
          `,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
        marker.bindPopup(`<b style="font-family: sans-serif; font-size: 14px; color: #1c1917;">${p.title}</b>`).openPopup();
      });

      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [50, 50] });

      // Invalidate size and refit bounds after rendering to resolve hidden tab container tile issues
      setTimeout(() => {
        map.invalidateSize();
        map.fitBounds(bounds, { padding: [50, 50] });
      }, 300);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [points, id]);

  return <div id={id} className="w-full h-full" />;
};

export const JourneyMap = ({ points, isMini = false, id = "journey-map", className = "" }: { points: JourneyPoint[], isMini?: boolean, id?: string, className?: string }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapRef = useRef<any>(null);

  useEffect(() => {
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

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        crossOrigin: true   // CORS dlaždice → canvas se neušpiní → export PDF funguje
      }).addTo(map);

      const latlngs = points.length > 1 ? drawSegments(L, map, points, isMini) : points.map(p => [p.lat, p.lng] as [number, number]);

      points.forEach((p, i) => {
        const isLast = i === points.length - 1;
        const color = isLast ? '#22c55e' : '#ea580c';
        
        const icon = L.divIcon({
          className: 'custom-div-icon',
          html: `
            <div style="position: relative; background-color: ${color}; width: ${isMini ? '12px' : '12px'}; height: ${isMini ? '12px' : '12px'}; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.3);">
              ${isLast ? `<div style="position: absolute; inset: -8px; border-radius: 50%; background: ${color}; opacity: 0.3; animation: pulse 2s infinite;"></div>` : ''}
            </div>
          `,
          iconSize: [isMini ? 12 : 12, isMini ? 12 : 12],
          iconAnchor: [isMini ? 6 : 6, isMini ? 6 : 6]
        });

        const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
        if (!isMini) {
           marker.bindPopup(`<b style="font-family: sans-serif; font-size: 12px; color: #1c1917;">${p.title}</b>`);
        }
      });

      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: isMini ? [5, 5] : [30, 30] });
      if (isMini && points.length === 1) {
        map.setZoom(6);
      }

      // Invalidate size and refit bounds after rendering to resolve hidden tab container tile issues
      setTimeout(() => {
        map.invalidateSize();
        if (latlngs.length > 0) {
          map.fitBounds(bounds, { padding: isMini ? [5, 5] : [30, 30] });
          if (isMini && points.length === 1) {
            map.setZoom(6);
          }
        }
      }, 300);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [points, isMini, id, isUnlocked]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  return (
    <>
      <div 
        className={`relative w-full ${className || (isMini ? 'h-full' : 'h-[400px] md:h-[600px]')} rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-stone-100 group transition-all duration-500 ${isUnlocked ? 'ring-4 ring-orange-500/20' : ''}`}
        onClick={() => !isMini && setIsUnlocked(true)}
      >
        <div id={id} className="w-full h-full z-10" />
        
        {!isMini && !isUnlocked && (
          <div className="absolute inset-0 z-30 cursor-pointer group-hover:bg-black/5 transition-all" />
        )}

        {!isMini && (
          <div className="absolute top-6 left-6 z-20 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 select-none">
            <Navigation size={14} className="text-orange-500 animate-pulse" />
            Mapa expedice {isUnlocked && <span className="text-orange-600 font-bold ml-1">• Aktivní</span>}
          </div>
        )}

        {!isMini && (
          <button
            onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}
            className="no-print absolute top-6 right-6 z-40 bg-white/80 hover:bg-white backdrop-blur-md text-stone-900 p-2.5 rounded-full shadow-lg border border-white/20 transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center group/btn cursor-pointer"
            title="Maximalizovat mapu"
          >
            <Maximize2 size={15} className="text-stone-700 transition-transform group-hover/btn:scale-110" />
          </button>
        )}
        
        {isUnlocked && !isMini && (
          <button 
            onClick={(e) => { e.stopPropagation(); setIsUnlocked(false); }}
            className="absolute bottom-6 right-6 z-40 bg-stone-900/80 backdrop-blur-md text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl border border-white/10 cursor-pointer hover:bg-stone-900 transition-colors"
          >
            Ukončit režim mapy
          </button>
        )}
      </div>

      <AnimatePresence>
        {isFullscreen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-stone-950/96 backdrop-blur-xl flex flex-col p-4 md:p-8"
            onClick={() => setIsFullscreen(false)}
          >
            <div 
              className="relative w-full h-full flex flex-col bg-white rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Floating Header in Fullscreen */}
              <div className="absolute top-6 left-6 z-50 bg-stone-900/90 backdrop-blur-md px-5 py-3 rounded-2xl text-white shadow-xl flex items-center gap-3 border border-white/10 pointer-events-none select-none">
                <div className="bg-orange-500 p-1.5 rounded-lg flex items-center justify-center">
                  <Navigation size={16} className="text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider">Mapa expedice</h4>
                  <p className="text-[10px] text-white/50">Celoobrazovkový interaktivní režim</p>
                </div>
              </div>

              {/* Close Button in Fullscreen */}
              <button 
                className="absolute top-6 right-6 text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all p-3.5 bg-white/90 rounded-2xl z-50 shadow-xl border border-stone-200 cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center"
                onClick={() => setIsFullscreen(false)}
                title="Zavřít mapu (Esc)"
              >
                <X size={20} />
              </button>

              {/* Actual interactive map */}
              <div className="flex-1 w-full h-full bg-stone-100 relative">
                <JourneyMapFullscreen points={points} id={`${id}-fullscreen`} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
