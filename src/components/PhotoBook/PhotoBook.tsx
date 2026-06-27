"use client";

/**
 * PhotoBook – fotokniha (magazínová sazba, vyplní A4).
 * Fotky i text jsou "položky" se stejným poměrovým systémem (justified). Buňky
 * mají PŘESNÉ rozměry podle poměru stran fotky → žádné nevhodné ořezy. Krátký
 * text se vkládá jako textová dlaždice přímo do koláže (ve formátu fotky).
 * Mapa = blogová Leaflet JourneyMap na obálce. PDF přes generatePhotoBookPdf.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Download, Loader2, Image as ImageIcon } from "lucide-react";
import { generatePhotoBookPdf } from "@/lib/generatePdf";

/**
 * RouteTrace – vektorová (SVG) stopa trasy pro obálku. Žádné dlaždice z cizí
 * domény → canvas se neušpiní a export do PDF projde (na rozdíl od Leaflet mapy).
 * Mercator projekce bodů, hladká křivka (Catmull-Rom), číslované zastávky.
 */
function RouteTrace({ points, accent, height }: {
  points: { lat: number; lng: number; title: string }[];
  accent: string;
  height: number;
}) {
  const W = 700, H = Math.max(160, height);
  if (!points.length) return null;
  const merc = (lat: number, lng: number) => ({
    x: (lng + 180) / 360,
    y: (1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2,
  });
  const proj = points.map((p) => merc(p.lat, p.lng));
  const xs = proj.map((p) => p.x), ys = proj.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-6, spanY = maxY - minY || 1e-6;
  const pad = 56;
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const offX = (W - spanX * scale) / 2, offY = (H - spanY * scale) / 2;
  const pts = proj.map((p) => ({ x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale }));
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <defs>
        <pattern id="rt-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="url(#rt-grid)" />
      {pts.length > 1 && <path d={d} fill="none" stroke={accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 9" opacity={0.95} />}
      {pts.map((p, i) => {
        const isStart = i === 0, isEnd = i === pts.length - 1;
        const col = isStart ? "#16a34a" : isEnd ? "#dc2626" : accent;
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={isStart || isEnd ? 8 : 6} fill={col} stroke="#1a1410" strokeWidth={2.5} />
            {points[i].title && (isStart || isEnd || pts.length <= 8) && (
              <text x={p.x} y={p.y - 13} textAnchor="middle" fontFamily="Outfit, sans-serif" fontSize="12" fontWeight="700" fill="rgba(245,240,232,0.85)">
                {points[i].title.length > 22 ? points[i].title.slice(0, 22) + "…" : points[i].title}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

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

type Item =
  | { key: string; aspect: number; kind: "img"; img: Att }
  | { key: string; aspect: number; kind: "text"; meta: string; title: string; desc: string };
type Cell = { item: Item; w: number };
type Row = { h: number; cells: Cell[] };
type Header = { title: string; meta: string };
type PhotoBlock = { kind: "photos"; header?: Header; rows: Row[]; caption?: string; h: number };
type TextBlock = { kind: "text"; title?: string; meta: string; desc: string; h: number };
type Block = PhotoBlock | TextBlock;

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

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

function justify(items: Item[], W: number, gap: number, targetRowH: number): Row[] {
  const rows: Row[] = [];
  let cur: Item[] = [];
  let arSum = 0;
  const flush = (last: boolean) => {
    if (!cur.length) return;
    let h = (W - gap * (cur.length - 1)) / arSum;
    if (last) h = Math.min(h, targetRowH * 1.35);
    rows.push({ h, cells: cur.map((it) => ({ item: it, w: it.aspect * h })) });
    cur = [];
    arSum = 0;
  };
  for (const it of items) {
    cur.push(it);
    arSum += it.aspect;
    if ((W - gap * (cur.length - 1)) / arSum <= targetRowH) flush(false);
  }
  flush(true);
  return rows;
}

const sumH = (rows: Row[], gap: number) => rows.reduce((s, r) => s + r.h, 0) + gap * Math.max(0, rows.length - 1);

/** Poskládá položky do šířky W tak, aby jejich celková výška ~ target (crop-free). */
function fitToHeight(items: Item[], W: number, gap: number, target: number): Row[] {
  const sumA = items.reduce((s, it) => s + it.aspect, 0);
  let rowH = Math.sqrt(Math.max(target, 40) * W / Math.max(sumA, 0.1));
  let rows = justify(items, W, gap, rowH);
  const h = sumH(rows, gap);
  if (h > 0 && Math.abs(h - target) / target > 0.04) {
    rowH *= target / h;
    rows = justify(items, W, gap, rowH);
  }
  return rows;
}

function buildPages(
  posts: Post[],
  aspects: Record<string, number>,
  fmt: Format,
  pageW: number,
  pageH: number,
  gap: number,
  baseRowH: number,
): Block[] {
  const HEAD_H = fmt === "A4" ? 64 : 50;
  const estTextH = (desc: string, width: number, fontPx: number) => {
    const cpl = Math.max(20, Math.floor(width / (fontPx * 0.5)));
    return Math.ceil(desc.length / cpl) * (fontPx * 1.62) + 12;
  };
  const pages: Block[] = [];

  for (const post of posts) {
    const imgs = (post.attachments || []).filter((a) => a.type === "image");
    const title = (post.title || "").trim();
    const desc = (post.description || "").trim();
    if (post.taskType === "GPS_LOG") continue;
    if (imgs.length === 0 && !desc) continue;
    const meta = [fmtDate(post), post.locations?.[0]?.placeName || post.locations?.[0]?.address]
      .filter(Boolean).join(" · ");

    if (imgs.length === 0) {
      pages.push({ kind: "text", title, meta, desc, h: pageH });
      continue;
    }

    const items: Item[] = imgs.map((a) => ({ key: a.id, aspect: aspects[a.id] || 1.5, kind: "img" as const, img: a }));
    const shortText = !!desc && desc.length <= 240 && imgs.length <= 5;
    if (shortText) items.unshift({ key: `t-${post.id}`, aspect: 0.82, kind: "text", meta, title, desc: clip(desc, 200) });

    const header: Header | undefined = !shortText && (title || meta) ? { title, meta } : undefined;
    const caption: string | undefined = !shortText && desc ? desc : undefined;
    const headerH = header ? HEAD_H : 0;
    const captionH = caption ? estTextH(caption, pageW, 13.5) + 8 : 0;

    // 1) přirozené řádky → rozdělení do stránek (velké příspěvky na víc stran)
    const natRows = justify(items, pageW, gap, pageH / (fmt === "A4" ? 3.4 : 3.0));
    const perPage: Item[][] = [];
    let curItems: Item[] = [];
    let usedH = 0;
    natRows.forEach((r, ri) => {
      const avail = pageH - (perPage.length === 0 ? headerH : 0) - (ri === natRows.length - 1 ? captionH : 0);
      const add = r.h + (curItems.length ? gap : 0);
      if (usedH + add > avail && curItems.length) {
        perPage.push(curItems);
        curItems = [];
        usedH = 0;
      }
      curItems.push(...r.cells.map((c) => c.item));
      usedH += r.h + gap;
    });
    if (curItems.length) perPage.push(curItems);

    // 2) každou stránku vyplň (zvětši fotky crop-free), hlavička jen první, text jen poslední
    perPage.forEach((pageItems, pi) => {
      const isFirst = pi === 0;
      const isLast = pi === perPage.length - 1;
      const target = pageH - (isFirst ? headerH + (headerH ? gap : 0) : 0) - (isLast ? captionH + (captionH ? gap : 0) : 0);
      const rows = fitToHeight(pageItems, pageW, gap, target);
      pages.push({
        kind: "photos",
        header: isFirst ? header : undefined,
        rows,
        caption: isLast ? caption : undefined,
        h: pageH,
      });
    });
  }

  return pages; // jedna položka = jedna stránka
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

  // Trasa = jeden bod na příspěvek (v pořadí), bez GPS logů → čistá spojnice zastávek.
  const mapPoints = useMemo(() => {
    const pts: { lat: number; lng: number; title: string }[] = [];
    (posts || []).forEach((p) => {
      if (p.taskType === "GPS_LOG") return;
      const l = (p.locations || []).find((x) => typeof x.latitude === "number" && typeof x.longitude === "number");
      if (l) pts.push({ lat: l.latitude as number, lng: l.longitude as number, title: (p.title || "").trim() });
    });
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
      fontFamily: "Outfit, sans-serif", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase",
      boxShadow: onPhoto ? "0 2px 8px rgba(0,0,0,0.35)" : "none",
    }}>{children}</span>
  );

  /** Buňka řádku – fotka, nebo textová dlaždice (ve formátu fotky). */
  const CellView = ({ cell, h }: { cell: Cell; h: number }) => {
    const common: React.CSSProperties = { width: cell.w, height: h, flexShrink: 0, overflow: "hidden", borderRadius: 4 };
    if (cell.item.kind === "img") {
      return (
        <div style={{ ...common, background: "#ece8e1" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cell.item.img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      );
    }
    return (
      <div style={{ ...common, background: "#fbf8f3", border: `1px solid #efe9df`, borderTop: `3px solid ${accent}`, display: "flex", flexDirection: "column", justifyContent: "center", padding: "16px 18px" }}>
        {cell.item.meta && <div style={{ marginBottom: 9 }}><MetaPill>{cell.item.meta}</MetaPill></div>}
        {cell.item.title && <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 19, fontWeight: 700, fontStyle: "italic", lineHeight: 1.1, color: "#1c1917", marginBottom: 9 }}>{cell.item.title}</div>}
        <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 11.5, lineHeight: 1.55, color: "#57534e", whiteSpace: "pre-wrap" }}>{cell.item.desc}</div>
      </div>
    );
  };
  const Rows = ({ rows }: { rows: Row[] }) => (
    <>{rows.map((row, ri) => (
      <div key={ri} style={{ display: "flex", gap: GAP, height: row.h, justifyContent: "center", marginTop: ri > 0 ? GAP : 0 }}>
        {row.cells.map((c, ci) => <CellView key={ci} cell={c} h={row.h} />)}
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
                    <RouteTrace points={mapPoints} accent={accent} height={format === "A4" ? 440 : 300} />
                  </>
                )}
              </div>
              <div>
                <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.35em", textTransform: "uppercase", color: accent, marginBottom: 20 }}>Questea · Fotokniha</div>
                <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: format === "A4" ? 76 : 50, fontWeight: 700, fontStyle: "italic", lineHeight: 0.9, marginBottom: 28 }}>{folder.title}</h1>
                <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(245,240,232,0.55)" }}>{dateRange}</div>
              </div>
            </div>

            {/* OBSAH – jedna stránka = jeden příspěvek (velké rozdělené, malé vyplněné) */}
            {pages.map((b, i) => (
              <div key={i} className="print-page relative overflow-hidden" style={{ width: dims.w, height: dims.h, background: "#ffffff" }}>
                <div style={{ position: "absolute", inset: PAD, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  {b.kind === "photos" ? (
                    <>
                      {b.header && (b.header.title || b.header.meta) && (
                        <div style={{ marginBottom: GAP, flexShrink: 0 }}>
                          {b.header.meta && <div style={{ marginBottom: 6 }}><MetaPill>{b.header.meta}</MetaPill></div>}
                          {b.header.title && <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: format === "A4" ? 30 : 22, fontWeight: 700, fontStyle: "italic", lineHeight: 1.05, margin: 0, color: "#1c1917" }}>{b.header.title}</h2>}
                        </div>
                      )}
                      <Rows rows={b.rows} />
                      {b.caption && (
                        <p style={{ fontFamily: "Outfit, sans-serif", fontSize: 13.5, lineHeight: 1.6, color: "#44403c", whiteSpace: "pre-wrap", margin: `${GAP}px 0 0`, paddingLeft: 12, borderLeft: `3px solid ${accent}`, flexShrink: 0 }}>{b.caption}</p>
                      )}
                    </>
                  ) : (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 620, margin: "0 auto" }}>
                      {b.meta && <div style={{ marginBottom: 14 }}><MetaPill>{b.meta}</MetaPill></div>}
                      {b.title && <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: format === "A4" ? 44 : 30, fontWeight: 700, fontStyle: "italic", lineHeight: 1.1, marginBottom: 22, color: "#1c1917" }}>{b.title}</h2>}
                      <p style={{ fontFamily: "Outfit, sans-serif", fontSize: 15, lineHeight: 1.75, color: "#44403c", whiteSpace: "pre-wrap", margin: 0 }}>{b.desc}</p>
                    </div>
                  )}
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
