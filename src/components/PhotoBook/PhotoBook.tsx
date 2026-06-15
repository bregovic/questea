"use client";

/**
 * PhotoBook – nová fotokniha (magazínová mozaika na spad, vyplní celou A4).
 * Nahrazuje původní PrintEditor. Layout staví na pevných šablonách
 * (grid-template-areas), které vždy pokryjí celou stránku → žádné prázdné dno.
 * PDF se generuje stávající pipeline (generatePhotoBookPdf – snímky .print-page).
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Download, Loader2, Image as ImageIcon } from "lucide-react";
import { generatePhotoBookPdf } from "@/lib/generatePdf";

type Att = { id: string; type: string; url: string };
type Loc = { address?: string | null; placeName?: string | null };
type Post = {
  id: string;
  title?: string | null;
  description?: string | null;
  recordedAt?: string | Date | null;
  createdAt?: string | Date | null;
  locations?: Loc[];
  attachments?: Att[];
};
type Folder = { id: string; title?: string | null; blogTemplate?: string | null };

type Format = "A4" | "A5";

// Šablony mozaiky: pro N fotek pokryjí celou stránku (žádné mezery na dně).
type Tpl = { cols: string; rows: string; areas: string };
const AREA_KEYS = ["a", "b", "c", "d", "e", "f"];
const TEMPLATES: Record<number, Tpl[]> = {
  1: [{ cols: "1fr", rows: "1fr", areas: `"a"` }],
  2: [
    { cols: "1fr 1fr", rows: "1fr", areas: `"a b"` },
    { cols: "1fr", rows: "1fr 1fr", areas: `"a" "b"` },
  ],
  3: [
    { cols: "1.6fr 1fr", rows: "1fr 1fr", areas: `"a b" "a c"` },
    { cols: "1fr 1.6fr", rows: "1fr 1fr", areas: `"b a" "c a"` },
  ],
  4: [
    { cols: "1fr 1fr", rows: "1fr 1fr", areas: `"a b" "c d"` },
    { cols: "1.5fr 1fr", rows: "1fr 1fr 1fr", areas: `"a b" "a c" "a d"` },
  ],
  5: [
    { cols: "1fr 1fr 1fr", rows: "1.4fr 1fr", areas: `"a a b" "c d e"` },
    { cols: "1fr 1fr 1fr", rows: "1fr 1.4fr", areas: `"a b c" "d d e"` },
  ],
  6: [
    { cols: "1fr 1fr 1fr", rows: "1fr 1fr", areas: `"a b c" "d e f"` },
    { cols: "1fr 1fr", rows: "1fr 1fr 1fr", areas: `"a b" "c d" "e f"` },
  ],
};

function chunkSizes(n: number): number[] {
  const out: number[] = [];
  let r = n;
  while (r > 0) {
    const s = r > 6 ? (r - 5 === 1 ? 4 : 5) : r;
    out.push(s);
    r -= s;
  }
  return out;
}

type MosaicPage = {
  kind: "mosaic";
  imgs: Att[];
  tpl: Tpl;
  header?: { title: string; meta: string; desc?: string };
};
type TextPage = { kind: "text"; title: string; meta: string; desc: string };
type Page = MosaicPage | TextPage;

function accentFor(template?: string | null): string {
  switch (template) {
    case "ADVENTURE": return "#a68a64";
    case "ELEGANT": return "#c5a059";
    case "DARK": return "#e5e5e5";
    case "MINIMAL": return "#111111";
    default: return "#ea580c";
  }
}

function fmtDate(p: Post): string {
  const d = p.recordedAt || p.createdAt;
  if (!d) return "";
  return new Date(d).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
}

function buildPages(posts: Post[]): Page[] {
  const pages: Page[] = [];
  let tplCounter = 0;
  for (const post of posts) {
    const imgs = (post.attachments || []).filter((a) => a.type === "image");
    const meta = [fmtDate(post), post.locations?.[0]?.placeName || post.locations?.[0]?.address]
      .filter(Boolean)
      .join(" · ");
    const title = (post.title || "").trim();
    const desc = (post.description || "").trim();

    if (imgs.length === 0) {
      if (title || desc) pages.push({ kind: "text", title: title || "Zápis", meta, desc });
      continue;
    }

    const sizes = chunkSizes(imgs.length);
    let offset = 0;
    sizes.forEach((size, idx) => {
      const slice = imgs.slice(offset, offset + size);
      offset += size;
      const variants = TEMPLATES[size] || TEMPLATES[6];
      const tpl = variants[tplCounter % variants.length];
      tplCounter++;
      pages.push({
        kind: "mosaic",
        imgs: slice,
        tpl,
        header: idx === 0 && (title || meta) ? { title, meta, desc: desc || undefined } : undefined,
      });
    });
  }
  return pages;
}

const SIZES: Record<Format, { w: number; h: number }> = {
  A4: { w: 794, h: 1123 },
  A5: { w: 559, h: 794 },
};

export function PhotoBook({
  folder,
  posts: postsProp,
  format: formatProp = "A4",
  onClose,
}: {
  folder: Folder;
  posts?: Post[];
  format?: Format;
  onClose?: () => void;
}) {
  const [posts, setPosts] = useState<Post[] | null>(postsProp ?? null);
  const [format, setFormat] = useState<Format>(formatProp);
  const [progress, setProgress] = useState<{ cur: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Data si umíme dotáhnout sami (TaskList předává jen folder).
  useEffect(() => {
    if (posts !== null) return;
    let live = true;
    fetch(`/api/tasks/${folder.id}`)
      .then((r) => r.json())
      .then((task) => {
        if (!live) return;
        const subs: Post[] = (task.subTasks || []).map((s: any) => ({
          ...s,
          attachments: (s.attachments || [])
            .filter((a: any) => a.type === "image")
            .map((a: any) => ({ id: a.id, type: a.type, url: `/api/images/${a.id}` })),
        }));
        setPosts(subs);
      })
      .catch(() => live && setError("Načtení fotek selhalo."));
    return () => { live = false; };
  }, [folder.id, posts]);

  const accent = accentFor(folder.blogTemplate);
  const pages = useMemo(() => (posts ? buildPages(posts) : []), [posts]);
  const dims = SIZES[format];

  const dateRange = useMemo(() => {
    if (!posts || posts.length === 0) return "";
    const a = fmtDate(posts[0]);
    const b = fmtDate(posts[posts.length - 1]);
    return a && b && a !== b ? `${a} — ${b}` : a || b;
  }, [posts]);

  async function exportPdf() {
    if (!containerRef.current) return;
    setProgress({ cur: 0, total: pages.length + 1 });
    try {
      await generatePhotoBookPdf(containerRef.current, {
        format,
        title: folder.title || "fotokniha",
        onProgress: (cur, total) => setProgress({ cur, total }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generování PDF selhalo.");
    }
    setProgress(null);
  }

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-stone-950/80 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-stone-950 px-5 py-3 text-white">
        <div className="flex items-center gap-2 text-sm font-bold">
          <ImageIcon size={16} style={{ color: accent }} />
          Fotokniha · {folder.title}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-white/15">
            {(["A4", "A5"] as Format[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-3 py-1.5 text-xs font-bold ${format === f ? "bg-white text-stone-950" : "text-white/70 hover:bg-white/10"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={exportPdf}
            disabled={!!progress || !posts || pages.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-1.5 text-sm font-bold text-stone-950 hover:bg-stone-200 disabled:opacity-50"
            style={{ background: progress ? undefined : accent, color: "white" }}
          >
            {progress ? (
              <><Loader2 size={16} className="animate-spin" /> {progress.cur}/{progress.total}</>
            ) : (
              <><Download size={16} /> Stáhnout PDF</>
            )}
          </button>
          {onClose && (
            <button onClick={onClose} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Náhled (všechny stránky ve skutečné velikosti, scrollovatelné) */}
      <div className="flex-1 overflow-auto p-8">
        {error && (
          <p className="mx-auto mb-4 max-w-md rounded-lg bg-red-950/60 px-4 py-2 text-center text-sm text-red-200">{error}</p>
        )}
        {!posts ? (
          <p className="py-20 text-center text-sm text-white/50">Načítám…</p>
        ) : pages.length === 0 ? (
          <p className="py-20 text-center text-sm text-white/50">Tato složka nemá žádné fotky k vytištění.</p>
        ) : (
          <div ref={containerRef} className="mx-auto flex flex-col items-center gap-8" style={{ width: dims.w }}>
            {/* COVER */}
            <div
              className="print-page relative overflow-hidden"
              style={{ width: dims.w, height: dims.h, background: "#1a1410", color: "#F5F0E8", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: format === "A4" ? "60px 56px" : "40px 36px" }}
            >
              <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.35em", textTransform: "uppercase", color: accent, marginBottom: 24 }}>
                Questea · Fotokniha
              </div>
              <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: format === "A4" ? 80 : 54, fontWeight: 700, fontStyle: "italic", lineHeight: 0.9, marginBottom: 32 }}>
                {folder.title}
              </h1>
              <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(245,240,232,0.55)" }}>
                {dateRange}
              </div>
            </div>

            {/* CONTENT PAGES */}
            {pages.map((page, i) => (
              <div
                key={i}
                className="print-page relative overflow-hidden"
                style={{ width: dims.w, height: dims.h, background: "#fcfaf7" }}
              >
                {page.kind === "mosaic" ? (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: page.tpl.cols,
                        gridTemplateRows: page.tpl.rows,
                        gridTemplateAreas: page.tpl.areas,
                        gap: 4,
                        width: "100%",
                        height: "100%",
                      }}
                    >
                      {page.imgs.map((img, idx) => (
                        <div key={img.id} style={{ gridArea: AREA_KEYS[idx], overflow: "hidden", background: "#ece8e1" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        </div>
                      ))}
                    </div>
                    {page.header && (
                      <div
                        style={{
                          position: "absolute", left: 0, right: 0, bottom: 0, padding: "64px 40px 28px",
                          background: "linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0))",
                          color: "white",
                        }}
                      >
                        {page.header.meta && (
                          <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: accent, marginBottom: 8 }}>
                            {page.header.meta}
                          </div>
                        )}
                        {page.header.title && (
                          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: format === "A4" ? 40 : 28, fontWeight: 700, fontStyle: "italic", lineHeight: 1, margin: 0 }}>
                            {page.header.title}
                          </h2>
                        )}
                        {page.header.desc && (
                          <p style={{ fontFamily: "Outfit, sans-serif", fontSize: 13, lineHeight: 1.5, marginTop: 10, maxWidth: 560, color: "rgba(255,255,255,0.88)" }}>
                            {page.header.desc.length > 220 ? page.header.desc.slice(0, 220) + "…" : page.header.desc}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  // TEXT PAGE
                  <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: format === "A4" ? "80px 72px" : "56px 48px", color: "#1c1917" }}>
                    {page.meta && (
                      <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.25em", textTransform: "uppercase", color: accent, marginBottom: 16 }}>
                        {page.meta}
                      </div>
                    )}
                    <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: format === "A4" ? 48 : 34, fontWeight: 700, fontStyle: "italic", lineHeight: 1.05, marginBottom: 24 }}>
                      {page.title}
                    </h2>
                    <p style={{ fontFamily: "Outfit, sans-serif", fontSize: 15, lineHeight: 1.7, color: "#44403c", whiteSpace: "pre-wrap" }}>
                      {page.desc}
                    </p>
                  </div>
                )}

                {/* Číslo stránky */}
                <div style={{ position: "absolute", bottom: 14, right: 18, fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: 700, color: page.kind === "mosaic" && page.header ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.35)" }}>
                  {i + 1}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
