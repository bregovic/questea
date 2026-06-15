"use client";

/**
 * PhotoBook – fotokniha (magazínová koláž, vyplní A4).
 * Layout je "justified" (řádkový jako Google Photos): podle skutečného poměru
 * stran fotek skládá řádky tak, aby fotka na šířku dostala širokou buňku a na
 * výšku vysokou → žádné "nudle", minimální ořez. Řádky vyplní celou stránku.
 * PDF přes stávající pipeline (generatePhotoBookPdf – snímky .print-page).
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

type Cell = { img: Att; w: number };
type Row = { h: number; cells: Cell[] };
type Header = { title: string; meta: string; desc?: string };
type Page =
  | { kind: "mosaic"; rows: Row[]; header?: Header }
  | { kind: "text"; title: string; meta: string; desc: string };

const SIZES: Record<Format, { w: number; h: number }> = {
  A4: { w: 794, h: 1123 },
  A5: { w: 559, h: 794 },
};

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

/** Justified layout: poskládá fotky do řádků a stránek dle poměru stran. */
function buildPages(
  posts: Post[],
  aspects: Record<string, number>,
  pageW: number,
  pageH: number,
  gap: number,
  targetRowH: number,
): Page[] {
  const pages: Page[] = [];

  for (const post of posts) {
    const imgs = (post.attachments || []).filter((a) => a.type === "image");
    const meta = [fmtDate(post), post.locations?.[0]?.placeName || post.locations?.[0]?.address]
      .filter(Boolean).join(" · ");
    const title = (post.title || "").trim();
    const desc = (post.description || "").trim();
    const header: Header | undefined = title || meta ? { title, meta, desc: desc || undefined } : undefined;

    if (imgs.length === 0) {
      if (title || desc) pages.push({ kind: "text", title: title || "Zápis", meta, desc });
      continue;
    }

    // 1) Fotky do řádků (každý ~ targetRowH; šířka řádku = pageW).
    const rows: Row[] = [];
    let cur: { img: Att; a: number }[] = [];
    let arSum = 0;
    const flush = (last: boolean) => {
      if (!cur.length) return;
      let h = (pageW - gap * (cur.length - 1)) / arSum;
      if (last) h = Math.min(h, targetRowH * 1.4); // osamělý poslední řádek nepřefoukne
      rows.push({ h, cells: cur.map((x) => ({ img: x.img, w: x.a * h })) });
      cur = [];
      arSum = 0;
    };
    for (const img of imgs) {
      const a = aspects[img.id] || 1.5;
      cur.push({ img, a });
      arSum += a;
      const h = (pageW - gap * (cur.length - 1)) / arSum;
      if (h <= targetRowH) flush(false);
    }
    flush(true);

    // 2) Řádky do stránek podle výšky; první strana dostane hlavičku.
    let pageRows: Row[] = [];
    let usedH = 0;
    let first = true;
    const pushPage = () => {
      pages.push({ kind: "mosaic", rows: pageRows, header: first ? header : undefined });
      first = false;
      pageRows = [];
      usedH = 0;
    };
    for (const row of rows) {
      const add = row.h + (pageRows.length ? gap : 0);
      if (usedH + add > pageH && pageRows.length) pushPage();
      pageRows.push(row);
      usedH += row.h + (pageRows.length > 1 ? gap : 0);
    }
    if (pageRows.length) pushPage();
  }

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

  // Změř poměry stran všech fotek (kvůli orientačně správné koláži).
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
  const PAD = format === "A4" ? 34 : 24;
  const GAP = 6;
  const pageW = dims.w - 2 * PAD;
  const pageH = dims.h - 2 * PAD;
  const targetRowH = pageH / (format === "A4" ? 4 : 3.4); // menší fotky = víc řádků

  const aspectsReady = allImages.length === 0 || Object.keys(aspects).length >= allImages.length;
  const pages = useMemo(
    () => (posts && aspectsReady ? buildPages(posts, aspects, pageW, pageH, GAP, targetRowH) : []),
    [posts, aspects, aspectsReady, pageW, pageH, targetRowH],
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
            className="inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            style={{ background: accent }}
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

      {/* Náhled */}
      <div className="flex-1 overflow-auto p-8">
        {error && (
          <p className="mx-auto mb-4 max-w-md rounded-lg bg-red-950/60 px-4 py-2 text-center text-sm text-red-200">{error}</p>
        )}
        {!posts || !aspectsReady ? (
          <p className="py-20 text-center text-sm text-white/50">
            {!posts ? "Načítám…" : "Připravuji fotky…"}
          </p>
        ) : pages.length === 0 ? (
          <p className="py-20 text-center text-sm text-white/50">Tato složka nemá žádné fotky k vytištění.</p>
        ) : (
          <div ref={containerRef} className="mx-auto flex flex-col items-center gap-8" style={{ width: dims.w }}>
            {/* OBÁLKA */}
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

            {/* OBSAH */}
            {pages.map((page, i) => (
              <div
                key={i}
                className="print-page relative overflow-hidden"
                style={{ width: dims.w, height: dims.h, background: "#ffffff" }}
              >
                <div style={{ position: "absolute", inset: PAD, overflow: "hidden" }}>
                  {page.kind === "mosaic" ? (
                    <>
                      <div style={{ display: "flex", flexDirection: "column", gap: GAP, width: "100%", height: "100%" }}>
                        {page.rows.map((row, ri) => (
                          <div key={ri} style={{ display: "flex", gap: GAP, flex: `${row.h} 1 0`, minHeight: 0 }}>
                            {row.cells.map((c) => (
                              <div key={c.img.id} style={{ flex: `${c.w} 1 0`, minWidth: 0, overflow: "hidden", borderRadius: 3, background: "#ece8e1" }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={c.img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                      {page.header && (
                        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "60px 26px 22px", background: "linear-gradient(to top, rgba(0,0,0,0.74), rgba(0,0,0,0))", color: "white" }}>
                          {page.header.meta && (
                            <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: accent, marginBottom: 8 }}>
                              {page.header.meta}
                            </div>
                          )}
                          {page.header.title && (
                            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: format === "A4" ? 38 : 26, fontWeight: 700, fontStyle: "italic", lineHeight: 1, margin: 0 }}>
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
                    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: format === "A4" ? "48px 52px" : "32px 36px", color: "#1c1917", background: "#fcfaf7" }}>
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
                </div>

                {/* Číslo stránky */}
                <div style={{ position: "absolute", bottom: 14, right: 18, fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.4)" }}>
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
