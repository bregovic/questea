"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

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

export const RevealImage = ({ children, delay = 0, rotation = 0 }: { children: ReactNode, delay?: number, rotation?: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, rotate: rotation - 3 }}
      whileInView={{ opacity: 1, scale: 1, rotate: rotation }}
      viewport={{ once: true }}
      transition={{ duration: 1.2, delay, ease: [0.16, 1, 0.3, 1] }}
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
