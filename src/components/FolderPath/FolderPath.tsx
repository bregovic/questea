"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, Home, Search, FolderOpen, Route } from "lucide-react";
import styles from "./FolderPath.module.css";

export type PathTask = {
  id: string;
  title: string;
  parentId: string | null;
  taskType?: string | null;
  isDeleted?: boolean;
};

/** Do čeho se dá v seznamu vstoupit – jen tohle má smysl nabízet jako „složku". */
const NAVIGABLE = new Set(["FOLDER", "LOCATION_HISTORY"]);
const isFolder = (t: PathTask) => !t.isDeleted && NAVIGABLE.has(t.taskType || "");

/** Hledání bez ohledu na diakritiku a velikost písmen (Garáž == garaz). */
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const PANEL_W = 340;

export function FolderPath({
  tasks,
  currentId,
  open,
  onOpenChange,
  onNavigate,
}: {
  tasks: PathTask[];
  currentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (id: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  /** Cesta od kořene k aktuální složce. Strom je celý v paměti, stačí jít po parentId. */
  const trail = useMemo(() => {
    const out: PathTask[] = [];
    const seen = new Set<string>(); // pojistka, kdyby se v datech objevil cyklus
    let cur = currentId ? byId.get(currentId) : undefined;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      out.unshift(cur);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return out;
  }, [byId, currentId]);

  const current = trail.length ? trail[trail.length - 1] : null;

  const folders = useMemo(() => tasks.filter(isFolder), [tasks]);
  const childrenOf = useMemo(
    () => (id: string | null) =>
      folders
        .filter((f) => (f.parentId ?? null) === id)
        .sort((a, b) => a.title.localeCompare(b.title, "cs")),
    [folders]
  );

  const children = childrenOf(current?.id ?? null);
  const siblings = current
    ? childrenOf(current.parentId ?? null).filter((s) => s.id !== current.id)
    : [];

  const results = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return [];
    return folders.filter((f) => norm(f.title).includes(q)).slice(0, 40);
  }, [folders, query]);

  /** „Dům › Garáž" pro položku ve výsledcích hledání. */
  const pathLabel = (t: PathTask) => {
    const parts: string[] = [];
    const seen = new Set<string>();
    let cur = t.parentId ? byId.get(t.parentId) : undefined;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      parts.unshift(cur.title);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return parts.length ? parts.join(" › ") : "Vše";
  };

  // Panel visí v portálu na <body>, aby ho neusekl sticky header ani jeho z-index.
  // Na desktopu se kotví pod spouštěč, na mobilu je z něj spodní sheet (CSS).
  const measure = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(12, Math.min(r.left, window.innerWidth - PANEL_W - 12));
    setAnchor({ top: r.bottom + 8, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, measure]);

  const toggle = () => {
    if (!open) {
      measure();
      setQuery("");
    }
    onOpenChange(!open);
  };

  const go = (id: string | null) => {
    onNavigate(id);
    onOpenChange(false);
  };

  const iconFor = (t: PathTask) =>
    t.taskType === "LOCATION_HISTORY" ? <Route size={15} /> : <FolderOpen size={15} />;

  const row = (t: PathTask, opts?: { depth?: number; sub?: string }) => (
    <button
      key={`${opts?.sub ? "s" : "n"}-${t.id}`}
      className={`${styles.row} ${t.id === currentId ? styles.rowActive : ""}`}
      style={opts?.depth ? { paddingLeft: 14 + opts.depth * 16 } : undefined}
      onClick={() => go(t.id)}
    >
      <span className={styles.rowIcon}>{iconFor(t)}</span>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{t.title}</span>
        {opts?.sub && <span className={styles.rowSub}>{opts.sub}</span>}
      </span>
      {t.id === currentId && <span className={styles.rowHere}>tady</span>}
    </button>
  );

  const panel = (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={styles.backdrop}
        onClick={() => onOpenChange(false)}
      />
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className={styles.panel}
        style={anchor ? ({ "--anchor-top": `${anchor.top}px`, "--anchor-left": `${anchor.left}px` } as React.CSSProperties) : undefined}
        role="menu"
      >
        <div className={styles.searchRow}>
          <Search size={16} className={styles.searchIcon} />
          <input
            autoFocus
            className={styles.searchInput}
            placeholder="Hledat složku…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className={styles.scroll}>
          {query.trim() ? (
            results.length ? (
              <div className={styles.section}>
                {results.map((r) => row(r, { sub: pathLabel(r) }))}
              </div>
            ) : (
              <div className={styles.empty}>Nic takového tu není</div>
            )
          ) : (
            <>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Cesta</div>
                <button
                  className={`${styles.row} ${!currentId ? styles.rowActive : ""}`}
                  onClick={() => go(null)}
                >
                  <span className={styles.rowIcon}>
                    <Home size={15} />
                  </span>
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>Vše</span>
                  </span>
                  {!currentId && <span className={styles.rowHere}>tady</span>}
                </button>
                {trail.map((t, i) => row(t, { depth: i + 1 }))}
              </div>

              {children.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>
                    {current ? "Uvnitř" : "Projekty"}
                  </div>
                  {children.map((c) => row(c))}
                </div>
              )}

              {siblings.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Vedle</div>
                  {siblings.map((s) => row(s))}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </>
  );

  return (
    <div className={styles.bar}>
      <button
        className={styles.home}
        onClick={() => onNavigate(null)}
        title="Všechny projekty"
        aria-label="Všechny projekty"
      >
        <Home size={18} />
      </button>

      {trail.slice(0, -1).map((a) => (
        <React.Fragment key={a.id}>
          <ChevronRight size={14} className={styles.sep} />
          <button className={styles.crumb} onClick={() => onNavigate(a.id)}>
            {a.title}
          </button>
        </React.Fragment>
      ))}

      {current && <ChevronRight size={14} className={`${styles.sep} ${styles.sepLast}`} />}

      <button
        ref={triggerRef}
        className={styles.trigger}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Přepnout složku"
      >
        <span className={styles.triggerText}>{current ? current.title : "Vše"}</span>
        <ChevronDown size={16} className={styles.triggerIcon} />
      </button>

      {open && typeof document !== "undefined" && createPortal(panel, document.body)}
    </div>
  );
}
