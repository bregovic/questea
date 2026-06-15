"use client";

/**
 * PhotoBook – fotokniha (magazínová sazba, vyplní A4).
 * Příspěvky tečou za sebou jako bloky o přirozené výšce (víc příspěvků na
 * stránku). Fotky se skládají "justified" dle poměru stran (na šířku → široká
 * buňka, na výšku → vysoká) → bez "nudlí" a ořezů. Kompozice se liší podle
 * počtu fotek a délky textu. PDF přes generatePhotoBookPdf (snímky .print-page).
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
  taskType?: string | null;
  recordedAt?: string | Date | null;
  createdAt?: string | Date | null;
  locations?: Loc[];
  attachments?: Att[];
};
type Folder = { id: string; title?: string | null; blogTemplate?: string | null };
type Format = "A4" | "A5";

type Cell = { img: Att; w: number };
type Header = { title: string; meta: string; desc?: string };
// Plynulé prvky sazby
type RowEl = { type: "row"; h: number; cells: Cell[]; header?: Header; topGap: number };
type HeadEl = { type: "head"; h: number; title: string; meta: string; topGap: number };
type TextEl = { type: "text"; h: number; title?: string; meta?: string; desc: string; topGap: number };
type FlowEl = RowEl | HeadEl | TextEl;

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

function justify(imgs: Att[], aspects: Record<string, number>, pageW: number, gap: number, targetRowH: number) {
  const rows: { h: number; cells: Cell[] }[] = [];
  let cur: { img: Att; a: number }[] = [];
  let arSum = 0;
  const flush = (last: boolean) => {
    if (!cur.length) return;
    let h = (pageW - gap * (cur.length - 1)) / arSum;
    if (last) h = Math.min(h, targetRowH * 1.4);
    rows.push({ h, cells: cur.map((x) => ({ img: x.img, w: x.a * h })) });
    cur = [];
    arSum = 0;
  };
  for (const img of imgs) {
    const a = aspects[img.id] || 1.5;
    cur.push({ img, a });
    arSum += a;
    if ((pageW - gap * (cur.length - 1)) / arSum <= targetRowH) flush(false);
  }
  flush(true);
  return rows;
}

/** Sestaví plynulé prvky (bloky) a rozdělí je do stránek dle výšky. */
function buildPages(
  posts: Post[],
  aspects: Record<string, number>,
  fmt: Format,
  pageW: number,
  pageH: number,
  gap: number,
  targetRowH: number,
): FlowEl[][] {
  const POST_GAP = fmt === "A4" ? 34 : 24;
  const HEAD_H = fmt === "A4" ? 74 : 56;
  const SHORT = 170;
  const cpl = Math.max(30, Math.floor(pageW / 7.2));
  const estTextH = (desc: string) => Math.min(Math.ceil(desc.length / cpl) * 25 + 14, pageH * 0.55);

  const els: FlowEl[] = [];
  for (const post of posts) {
    const imgs = (post.attachments || []).filter((a) => a.type === "image");
    const title = (post.title || "").trim();
    const desc = (post.description || "").trim();

    // GPS log = jen značka pro mapu; bez fotky a bez textu nic neukazujeme
    // (stejně jako blog). Takové záznamy do knihy nezahrnujeme.
    if (post.taskType === "GPS_LOG") continue;
    if (imgs.length === 0 && !desc) continue;

    const meta = [fmtDate(post), post.locations?.[0]?.placeName || post.locations?.[0]?.address]
      .filter(Boolean).join(" · ");

    if (imgs.length === 0) {
      els.push({ type: "text", h: HEAD_H + estTextH(desc), title, meta, desc, topGap: POST_GAP });
      continue;
    }

    const rows = justify(imgs, aspects, pageW, gap, targetRowH);
    if (desc.length <= SHORT) {
      // krátký text → překryv přes první fotku
      const header: Header = { title, meta, desc: desc || undefined };
      rows.forEach((r, idx) =>
        els.push({ type: "row", h: r.h, cells: r.cells, header: idx === 0 ? header : undefined, topGap: idx === 0 ? POST_GAP : gap }),
      );
    } else {
      // delší text → nadpis nad fotkami + text pod
      els.push({ type: "head", h: HEAD_H, title, meta, topGap: POST_GAP });
      rows.forEach((r) => els.push({ type: "row", h: r.h, cells: r.cells, topGap: gap }));
      els.push({ type: "text", h: estTextH(desc), desc, topGap: gap });
    }
  }

  // Stránkování dle výšky (kompaktně, bez roztahování → víc bloků na stránku).
  const pages: FlowEl[][] = [];
  let cur: FlowEl[] = [];
  let used = 0;
  for (const el of els) {
    const add = el.h + (cur.length ? el.topGap : 0);
    if (used + add > pageH && cur.length) {
      pages.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(el);
    used += el.h + (cur.length > 1 ? el.topGap : 0);
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
  const PAD = format === "A4" ? 40 : 28; // ~12 mm okraj
  const GAP = 6;
  const pageW = dims.w - 2 * PAD;
  const pageH = dims.h - 2 * PAD;
  const targetRowH = pageH / (format === "A4" ? 3.6 : 3.2);

  const aspectsReady = allImages.length === 0 || Object.keys(aspects).length >= allImages.length;
  const pages = useMemo(
    () => (posts && aspectsReady ? buildPages(posts, aspects, format, pageW, pageH, GAP, targetRowH) : []),
    [posts, aspects, aspectsReady, format, pageW, pageH, targetRowH],
  );

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

  // Štítek (meta) s podkladem – ať se neztratí na fotce ani na bílé.
  const MetaPill = ({ children, onPhoto }: { children: React.ReactNode; onPhoto?: boolean }) => (
    <span style={{
      display: "inline-block", background: accent, color: "#fff", padding: "3px 9px", borderRadius: 5,
      fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase",
      boxShadow: onPhoto ? "0 2px 8px rgba(0,0,0,0.35)" : "none",
    }}>{children}</span>
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
                className={`px-3 py-1.5 text-xs font-bold ${format === f ? "bg-white text-stone-950" : "text-white/70 hover:bg-white/10"}`}>
                {f}
              </button>
            ))}
          </div>
          <button onClick={exportPdf} disabled={!!progress || !posts || pages.length === 0}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            style={{ background: accent }}>
            {progress ? (<><Loader2 size={16} className="animate-spin" /> {progress.cur}/{progress.total}</>) : (<><Download size={16} /> Stáhnout PDF</>)}
          </button>
          {onClose && (
            <button onClick={onClose} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"><X size={20} /></button>
          )}
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
              style={{ width: dims.w, height: dims.h, background: "#1a1410", color: "#F5F0E8", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: format === "A4" ? "60px 56px" : "40px 36px" }}>
              <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.35em", textTransform: "uppercase", color: accent, marginBottom: 24 }}>Questea · Fotokniha</div>
              <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: format === "A4" ? 80 : 54, fontWeight: 700, fontStyle: "italic", lineHeight: 0.9, marginBottom: 32 }}>{folder.title}</h1>
              <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(245,240,232,0.55)" }}>{dateRange}</div>
            </div>

            {/* OBSAH */}
            {pages.map((els, i) => (
              <div key={i} className="print-page relative overflow-hidden" style={{ width: dims.w, height: dims.h, background: "#ffffff" }}>
                <div style={{ position: "absolute", inset: PAD, overflow: "hidden" }}>
                  {els.map((el, idx) => {
                    const mt = idx > 0 ? el.topGap : 0;
                    if (el.type === "row") {
                      return (
                        <div key={idx} style={{ position: "relative", display: "flex", gap: GAP, height: el.h, marginTop: mt }}>
                          {el.cells.map((c) => (
                            <div key={c.img.id} style={{ flex: `${c.w} 1 0`, minWidth: 0, overflow: "hidden", borderRadius: 3, background: "#ece8e1" }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={c.img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                            </div>
                          ))}
                          {el.header && (
                            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "56px 22px 18px", background: "linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0))", color: "white" }}>
                              {el.header.meta && <div style={{ marginBottom: 8 }}><MetaPill onPhoto>{el.header.meta}</MetaPill></div>}
                              {el.header.title && <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: format === "A4" ? 34 : 24, fontWeight: 700, fontStyle: "italic", lineHeight: 1, margin: 0, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>{el.header.title}</h2>}
                              {el.header.desc && <p style={{ fontFamily: "Outfit, sans-serif", fontSize: 12.5, lineHeight: 1.5, marginTop: 8, maxWidth: 540, color: "rgba(255,255,255,0.9)" }}>{el.header.desc.length > 200 ? el.header.desc.slice(0, 200) + "…" : el.header.desc}</p>}
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (el.type === "head") {
                      return (
                        <div key={idx} style={{ marginTop: mt }}>
                          {el.meta && <div style={{ marginBottom: 8 }}><MetaPill>{el.meta}</MetaPill></div>}
                          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: format === "A4" ? 34 : 24, fontWeight: 700, fontStyle: "italic", lineHeight: 1.05, margin: 0, color: "#1c1917" }}>{el.title}</h2>
                        </div>
                      );
                    }
                    // text
                    return (
                      <div key={idx} style={{ marginTop: mt }}>
                        {el.meta && <div style={{ marginBottom: 8 }}><MetaPill>{el.meta}</MetaPill></div>}
                        {el.title && <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: format === "A4" ? 30 : 22, fontWeight: 700, fontStyle: "italic", lineHeight: 1.1, marginBottom: 12, color: "#1c1917" }}>{el.title}</h2>}
                        <p style={{ fontFamily: "Outfit, sans-serif", fontSize: 14, lineHeight: 1.65, color: "#44403c", whiteSpace: "pre-wrap", margin: 0 }}>{el.desc}</p>
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
