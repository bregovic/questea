"use client";

import { useState, useEffect, ReactNode } from "react";
import { motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
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
      <button 
        className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors p-2 bg-white/5 rounded-full"
        onClick={onClose}
      >
        <X size={32} />
      </button>

      {images.length > 1 && (
        <>
          <button 
            className="absolute left-8 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors p-4 hidden md:block"
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => (prev - 1 + images.length) % images.length); }}
          >
            <ChevronLeft size={48} />
          </button>
          <button 
            className="absolute right-8 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors p-4 hidden md:block"
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => (prev + 1) % images.length); }}
          >
            <ChevronRight size={48} />
          </button>
        </>
      )}

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
    </motion.div>
  );
};
