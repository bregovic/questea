"use client";

/**
 * PhotoBook – fotokniha (magazínová sazba, vyplní A4).
 * Každý příspěvek = atomický blok (nadpis + fotky + text drží pohromadě,
 * nikdy se nerozdělí přes stránky). Šablona se volí podle počtu fotek a délky
 * textu: krátký text vedle fotek, delší pod nimi. Fotky "justified" dle poměru
 * stran (na šířku → široká buňka). Mapa = blogová Leaflet JourneyMap na obálce.
 * PDF přes generatePhotoBookPdf (snímky .print-page).
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Download, Loader2, Image as ImageIcon } from "lucide-react";
import { generatePhotoBookPdf } from "@/lib/generatePdf";
import { JourneyMap } from "@/components/Blog/BlogClient";

type Att = { id: string; type: string; url: string };
type Loc = { address?: string | null; placeName?: string | null; latitude?: number | null; longitude?: number | null };
type Post = {
  id: string;
  title?: string | null;
  description?: string | null;
  taskType?: string | null;
  recordedAt?: string | Date | null;
  createdAt?: string | Date | null;
  locations?: Loc[];
  attachments?: Att[];
};
type Folder = { id: string; title?: string | null; blogTemplate?: string | null };
type Format = "A4" | "A5";

type Cell = { img: Att; w: number };
type Row = { h: number; cells: Cell[] };
type Header = { title: string; meta: string };
type StackedBlock = { kind: "stacked"; header?: Header; rows: Row[]; caption?: string; h: number };
type SideBlock = { kind: "side"; header: Header; rows: Row[]; desc: string; photoW: number; textW: number; colGap: number; h: number };
type TextBlock = { kind: "text"; title?: string; meta: string; desc: string; h: number };
type Block = StackedBlock | SideBlock | TextBlock;

const SIZES: Record<Format, { w: number; h: number }> = {
  A4: { w: 794, h: 1123 },
  A5: { w: 559, h: 794 },
};

function accentFor(template?: string | null): string {
  switch (template) {
    case "ADVENTURE": return "#a68a64";
    case "ELEGANT": return "#c5a059";
    case "DARK": return "#737373";
    case "MINIMAL": return "#111111";
    default: return "#ea580c";
  }
}

function fmtDate(p: Post): string {
  const d = p.recordedAt || p.createdAt;
  if (!d) return "";
  return new Date(d).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
}

function justify(imgs: Att[], aspects: Record<string, number>, W: number, gap: number, targetRowH: number): Row[] {
  const rows: Row[] = [];
  let cur: { img: Att; a: number }[] = [];
  let arSum = 0;
  const flush = (last: boolean) => {
    if (!cur.length) return;
    let h = (W - gap * (cur.length - 1)) / arSum;
    if (last) h = Math.min(h, targetRowH * 1.4);
    rows.push({ h, cells: cur.map((x) => ({ img: x.img, w: x.a * h })) });
    cur = [];
    arSum = 0;
  };
  for (const img of imgs) {
    const a = aspects[img.id] || 1.5;
    cur.push({ img, a });
    arSum += a;
    if ((W - gap * (cur.length - 1)) / arSum <= targetRowH) flush(false);
  }
  flush(true);
  return rows;
}

const sumH = (rows: Row[], gap: number) => rows.reduce((s, r) => s + r.h, 0) + gap * Math.max(0, rows.length - 1);

/** Poskládá fotky do šířky W tak, aby se vešly do maxH (zmenší fotky, aspekt drží). */
function fitRows(imgs: Att[], aspects: Record<string, number>, W: number, gap: number, baseRowH: number, maxH: number) {
  let rows = justify(imgs, aspects, W, gap, baseRowH);
  let h = sumH(rows, gap);
  if (h > maxH && h > 0) {
    const sumA = imgs.reduce((s, im) => s + (aspects[im.id] || 1.5), 0);
    const rh = Math.sqrt(Math.max(maxH, 40) * W / Math.max(sumA, 0.1));
    rows = justify(imgs, aspects, W, gap, rh);
    h = sumH(rows, gap);
  }
  return { rows, h };
}

function buildPages(
  posts: Post[],
  aspects: Record<string, number>,
  fmt: Format,
  pageW: number,
  pageH: number,
  gap: number,
  baseRowH: number,
): Block[][] {
  const POST_GAP = fmt === "A4" ? 30 : 22;
  const HEAD_H = fmt === "A4" ? 64 : 50;
  const estTextH = (desc: string, width: number, fontPx: number) => {
    const cpl = Math.max(20, Math.floor(width / (fontPx * 0.52)));
    return Math.ceil(desc.length / cpl) * (fontPx * 1.55) + 8;
  };

  const blocks: Block[] = [];
  for (const post of posts) {
    const imgs = (post.attachments || []).filter((a) => a.type === "image");
    const title = (post.title || "").trim();
    const desc = (post.description || "").trim();
    if (post.taskType === "GPS_LOG") continue;
    if (imgs.length === 0 && !desc) continue;
    const meta = [fmtDate(post), post.locations?.[0]?.placeName || post.locations?.[0]?.address]
      .filter(Boolean).join(" · ");

    if (imgs.length === 0) {
      const h = (title ? (fmt === "A4" ? 38 : 28) : 0) + (meta ? 24 : 0) + estTextH(desc, pageW, 14) + 10;
      blocks.push({ kind: "text", title, meta, desc, h });
      continue;
    }

    // Krátký text + málo fotek → text vedle fotek.
    if (desc && desc.length <= 260 && imgs.length <= 3) {
      const colGap = fmt === "A4" ? 22 : 16;
      const photoW = Math.round(pageW * 0.62);
      const textW = pageW - photoW - colGap;
      const { rows, h: photosH } = fitRows(imgs, aspects, photoW, gap, baseRowH, pageH * 0.46);
      const textH = HEAD_H + estTextH(desc, textW, 13.5);
      const h = Math.min(Math.max(photosH, textH), pageH);
      blocks.push({ kind: "side", header: { title, meta }, rows, desc, photoW, textW, colGap, h });
      continue;
    }

    // Jinak: nadpis nad + fotky + text pod (vše pohromadě).
    const headerH = title || meta ? HEAD_H : 0;
    const captionH = desc ? estTextH(desc, pageW, 13.5) + 6 : 0;
    const maxPhotosH = pageH - headerH - captionH - gap * 2 - 2;
    const { rows, h: photosH } = fitRows(imgs, aspects, pageW, gap, baseRowH, maxPhotosH);
    const h = headerH + (headerH ? gap : 0) + photosH + (captionH ? gap + captionH : 0);
    blocks.push({ kind: "stacked", header: title || meta ? { title, meta } : undefined, rows, caption: desc || undefined, h: Math.min(h, pageH) });
  }

  // Atomické stránkování – blok se nikdy nerozdělí.
  const pages: Block[][] = [];
  let cur: Block[] = [];
  let used = 0;
  for (const b of blocks) {
    const add = b.h + (cur.length ? POST_GAP : 0);
    if (used + add > pageH && cur.length) {
      pages.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(b);
    used += b.h + (cur.length > 1 ? POST_GAP : 0);
  }
  if (cur.length) pages.push(cur);
  return pages;
}

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
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<{ cur: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const allImages = useMemo(
    () => (posts || []).flatMap((p) => (p.attachments || []).filter((a) => a.type === "image")),
    [posts],
  );
  useEffect(() => {
    if (allImages.length === 0) return;
    let cancelled = false;
    const next: Record<string, number> = {};
    let pending = allImages.length;
    const done = () => { if (--pending <= 0 && !cancelled) setAspects(next); };
    allImages.forEach((a) => {
      const im = new window.Image();
      im.onload = () => { next[a.id] = im.naturalWidth / im.naturalHeight || 1.5; done(); };
      im.onerror = () => { next[a.id] = 1.5; done(); };
      im.src = a.url;
    });
    return () => { cancelled = true; };
  }, [allImages]);

  const accent = accentFor(folder.blogTemplate);
  const dims = SIZES[format];
  const PAD = format === "A4" ? 40 : 28;
  const GAP = 6;
  const pageW = dims.w - 2 * PAD;
  const pageH = dims.h - 2 * PAD;
  const baseRowH = pageH / (format === "A4" ? 3.6 : 3.2);

  const aspectsReady = allImages.length === 0 || Object.keys(aspects).length >= allImages.length;
  const pages = useMemo(
    () => (posts && aspectsReady ? buildPages(posts, aspects, format, pageW, pageH, GAP, baseRowH) : []),
    [posts, aspects, aspectsReady, format, pageW, pageH, baseRowH],
  );

  const dateRange = useMemo(() => {
    if (!posts || posts.length === 0) return "";
    const a = fmtDate(posts[0]);
    const b = fmtDate(posts[posts.length - 1]);
    return a && b && a !== b ? `${a} — ${b}` : a || b;
  }, [posts]);

  const mapPoints = useMemo(() => {
    const pts: { lat: number; lng: number; title: string }[] = [];
    (posts || []).forEach((p) =>
      (p.locations || []).forEach((l) => {
        if (typeof l.latitude === "number" && typeof l.longitude === "number") pts.push({ lat: l.latitude, lng: l.longitude, title: (p.title || "").trim() });
      }),
    );
    return pts;
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

  const MetaPill = ({ children, onPhoto }: { children: React.ReactNode; onPhoto?: boolean }) => (
    <span style={{
      display: "inline-block", background: accent, color: "#fff", padding: "3px 9px", borderRadius: 5,
      fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase",
      boxShadow: onPhoto ? "0 2px 8px rgba(0,0,0,0.35)" : "none",
    }}>{children}</span>
  );
  const Title = ({ children, size, onPhoto }: { children: React.ReactNode; size: number; onPhoto?: boolean }) => (
    <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: size, fontWeight: 700, fontStyle: "italic", lineHeight: 1.05, margin: 0, color: onPhoto ? "#fff" : "#1c1917", textShadow: onPhoto ? "0 2px 12px rgba(0,0,0,0.5)" : "none" }}>{children}</h2>
  );
  const Rows = ({ rows }: { rows: Row[] }) => (
    <>{rows.map((row, ri) => (
      <div key={ri} style={{ display: "flex", gap: GAP, height: row.h, marginTop: ri > 0 ? GAP : 0 }}>
        {row.cells.map((c) => (
          <div key={c.img.id} style={{ flex: `${c.w} 1 0`, minWidth: 0, overflow: "hidden", borderRadius: 3, background: "#ece8e1" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        ))}
      </div>
    ))}</>
  );

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-stone-950/80 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-stone-950 px-5 py-3 text-white">
        <div className="flex items-center gap-2 text-sm font-bold">
          <ImageIcon size={16} style={{ color: accent }} />
          Fotokniha · {folder.title}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-white/15">
            {(["A4", "A5"] as Format[]).map((f) => (
              <button key={f} onClick={() => setFormat(f)}
                className={`px-3 py-1.5 text-xs font-bold ${format === f ? "bg-white text-stone-950" : "text-white/70 hover:bg-white/10"}`}>{f}</button>
            ))}
          </div>
          <button onClick={exportPdf} disabled={!!progress || !posts || pages.length === 0}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            style={{ background: accent }}>
            {progress ? (<><Loader2 size={16} className="animate-spin" /> {progress.cur}/{progress.total}</>) : (<><Download size={16} /> Stáhnout PDF</>)}
          </button>
          {onClose && <button onClick={onClose} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"><X size={20} /></button>}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {error && <p className="mx-auto mb-4 max-w-md rounded-lg bg-red-950/60 px-4 py-2 text-center text-sm text-red-200">{error}</p>}
        {!posts || !aspectsReady ? (
          <p className="py-20 text-center text-sm text-white/50">{!posts ? "Načítám…" : "Připravuji fotky…"}</p>
        ) : pages.length === 0 ? (
          <p className="py-20 text-center text-sm text-white/50">Tato složka nemá žádné fotky k vytištění.</p>
        ) : (
          <div ref={containerRef} className="mx-auto flex flex-col items-center gap-8" style={{ width: dims.w }}>
            {/* OBÁLKA */}
            <div className="print-page relative overflow-hidden"
              style={{ width: dims.w, height: dims.h, background: "#1a1410", color: "#F5F0E8", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: format === "A4" ? "56px 52px" : "38px 34px" }}>
              <div style={{ width: "100%" }}>
                {mapPoints.length >= 1 && (
                  <>
                    <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 9, fontWeight: 800, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(245,240,232,0.4)", marginBottom: 12 }}>Trasa cesty</div>
                    <div style={{ width: "100%", height: format === "A4" ? 440 : 300, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <JourneyMap points={mapPoints} id="pb-cover-map" className="w-full h-full" />
                    </div>
                  </>
                )}
              </div>
              <div>
                <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.35em", textTransform: "uppercase", color: accent, marginBottom: 20 }}>Questea · Fotokniha</div>
                <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: format === "A4" ? 76 : 50, fontWeight: 700, fontStyle: "italic", lineHeight: 0.9, marginBottom: 28 }}>{folder.title}</h1>
                <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(245,240,232,0.55)" }}>{dateRange}</div>
              </div>
            </div>

            {/* OBSAH */}
            {pages.map((blocks, i) => (
              <div key={i} className="print-page relative overflow-hidden" style={{ width: dims.w, height: dims.h, background: "#ffffff" }}>
                <div style={{ position: "absolute", inset: PAD, overflow: "hidden" }}>
                  {blocks.map((b, bi) => {
                    const mt = bi > 0 ? (format === "A4" ? 30 : 22) : 0;
                    if (b.kind === "stacked") {
                      return (
                        <div key={bi} style={{ marginTop: mt }}>
                          {b.header && (b.header.title || b.header.meta) && (
                            <div style={{ marginBottom: GAP }}>
                              {b.header.meta && <div style={{ marginBottom: 6 }}><MetaPill>{b.header.meta}</MetaPill></div>}
                              {b.header.title && <Title size={format === "A4" ? 30 : 22}>{b.header.title}</Title>}
                            </div>
                          )}
                          <Rows rows={b.rows} />
                          {b.caption && (
                            <p style={{ fontFamily: "Outfit, sans-serif", fontSize: 13.5, lineHeight: 1.6, color: "#44403c", whiteSpace: "pre-wrap", margin: `${GAP}px 0 0` }}>{b.caption}</p>
                          )}
                        </div>
                      );
                    }
                    if (b.kind === "side") {
                      return (
                        <div key={bi} style={{ display: "flex", gap: b.colGap, marginTop: mt, height: b.h }}>
                          <div style={{ width: b.photoW, flexShrink: 0 }}><Rows rows={b.rows} /></div>
                          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                            {b.header.meta && <div style={{ marginBottom: 8 }}><MetaPill>{b.header.meta}</MetaPill></div>}
                            {b.header.title && <div style={{ marginBottom: 10 }}><Title size={format === "A4" ? 26 : 20}>{b.header.title}</Title></div>}
                            <p style={{ fontFamily: "Outfit, sans-serif", fontSize: 13, lineHeight: 1.6, color: "#44403c", whiteSpace: "pre-wrap", margin: 0 }}>{b.desc}</p>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={bi} style={{ marginTop: mt }}>
                        {b.meta && <div style={{ marginBottom: 8 }}><MetaPill>{b.meta}</MetaPill></div>}
                        {b.title && <div style={{ marginBottom: 12 }}><Title size={format === "A4" ? 28 : 20}>{b.title}</Title></div>}
                        <p style={{ fontFamily: "Outfit, sans-serif", fontSize: 14, lineHeight: 1.65, color: "#44403c", whiteSpace: "pre-wrap", margin: 0 }}>{b.desc}</p>
                      </div>
                    );
                  })}
                </div>
                <div style={{ position: "absolute", bottom: 14, right: 18, fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.4)" }}>{i + 1}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
