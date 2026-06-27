"use client";

/**
 * PhotoBook – editor fotoknihy (šablony + sloty).
 *
 * Model: dokument = pole editovatelných A4 stránek { template, title, meta, text,
 * photos[] }. Z příspěvků se vygeneruje první nástřel (auto-draft), pak ho uživatel
 * ladí: přepíná šablonu stránky, přehazuje fotky ze zásobníku do slotů, edituje text,
 * mění pořadí a počet stránek. Stav se ukládá do localStorage (klíč dle složky).
 *
 * Export: skrytý "čistý" kontejner renderuje všechny stránky BEZ editačních ovládátek
 * jako .print-page → generatePhotoBookPdf z nich dělá PDF stránku po stránce.
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X, Download, Loader2, Image as ImageIcon, Plus, Trash2, ChevronLeft, ChevronRight, RotateCcw, LayoutTemplate } from "lucide-react";
import { generatePhotoBookPdf } from "@/lib/generatePdf";

/* ───────────────────────── obálková SVG stopa trasy ───────────────────────── */
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

/* ───────────────────────────────── typy ──────────────────────────────────── */
type Att = { id: string; type: string; url: string };
type Loc = { address?: string | null; placeName?: string | null; latitude?: number | null; longitude?: number | null };
type Post = {
  id: string; title?: string | null; description?: string | null; taskType?: string | null;
  recordedAt?: string | Date | null; createdAt?: string | Date | null;
  locations?: Loc[]; attachments?: Att[];
};
type Folder = { id: string; title?: string | null; blogTemplate?: string | null };
type Format = "A4" | "A5";
type Template = "cover" | "editorial" | "gallery" | "fullbleed" | "text";
type BookPage = { id: string; template: Template; title: string; meta: string; text: string; photos: string[] };

const TEMPLATES: { id: Template; label: string }[] = [
  { id: "cover", label: "Obálka" },
  { id: "editorial", label: "Text + fotky" },
  { id: "gallery", label: "Galerie" },
  { id: "fullbleed", label: "Celostránková" },
  { id: "text", label: "Jen text" },
];

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
let _uid = 0;
const uid = () => `p${Date.now().toString(36)}_${(_uid++).toString(36)}`;

/* justified řádky fotek (crop-free – buňka má přesný poměr fotky) */
type Cell = { id: string; w: number };
type Row = { h: number; cells: Cell[] };
function justifyRows(photos: { id: string; aspect: number }[], W: number, gap: number, targetRowH: number): Row[] {
  const rows: Row[] = [];
  let cur: { id: string; aspect: number }[] = [];
  let arSum = 0;
  const flush = (last: boolean) => {
    if (!cur.length) return;
    let h = (W - gap * (cur.length - 1)) / arSum;
    if (last) h = Math.min(h, targetRowH * 1.4);
    rows.push({ h, cells: cur.map((it) => ({ id: it.id, w: it.aspect * h })) });
    cur = []; arSum = 0;
  };
  for (const it of photos) {
    cur.push(it); arSum += it.aspect;
    if ((W - gap * (cur.length - 1)) / arSum <= targetRowH) flush(false);
  }
  flush(true);
  return rows;
}

/* ───────────────── auto-nástřel dokumentu z příspěvků ───────────────── */
function buildAutoDoc(posts: Post[], folderTitle: string): BookPage[] {
  const pages: BookPage[] = [{ id: uid(), template: "cover", title: folderTitle || "Fotokniha", meta: "", text: "", photos: [] }];
  for (const post of posts) {
    if (post.taskType === "GPS_LOG") continue;
    const imgs = (post.attachments || []).filter((a) => a.type === "image").map((a) => a.id);
    const title = clip((post.title || "").trim(), 90);
    const text = (post.description || "").trim();
    if (imgs.length === 0 && !text) continue;
    const meta = [fmtDate(post), post.locations?.[0]?.placeName || post.locations?.[0]?.address].filter(Boolean).join(" · ");

    if (imgs.length === 0) {
      pages.push({ id: uid(), template: "text", title, meta, text, photos: [] });
      continue;
    }
    // 1. strana s textem (editorial, ~4 fotky), zbytek do galerijních stran po 6.
    const hasText = !!text;
    const firstCap = hasText ? 4 : 6;
    pages.push({ id: uid(), template: hasText ? "editorial" : "gallery", title, meta, text, photos: imgs.slice(0, firstCap) });
    let rest = imgs.slice(firstCap);
    while (rest.length) {
      pages.push({ id: uid(), template: "gallery", title: "", meta: "", text: "", photos: rest.slice(0, 6) });
      rest = rest.slice(6);
    }
  }
  return pages;
}

/* ════════════════════════════ komponenta ════════════════════════════ */
export function PhotoBook({
  folder, posts: postsProp, format: formatProp = "A4", onClose,
}: {
  folder: Folder; posts?: Post[]; format?: Format; onClose?: () => void;
}) {
  const [posts, setPosts] = useState<Post[] | null>(postsProp ?? null);
  const [format, setFormat] = useState<Format>(formatProp);
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const [doc, setDoc] = useState<BookPage[] | null>(null);
  const [docLoaded, setDocLoaded] = useState(false); // server-fetch dokumentu dokončen
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sel, setSel] = useState(0);
  const [trayOpen, setTrayOpen] = useState(true);
  const [progress, setProgress] = useState<{ cur: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const serverDocRef = useRef<BookPage[] | null>(null); // co přišlo z DB (zdroj pravdy)
  const lastSavedRef = useRef<string>("");              // poslední uložený JSON (dirty check)

  const accent = accentFor(folder.blogTemplate);
  const dims = SIZES[format];
  const PAD = format === "A4" ? 58 : 38;
  const GAP = 12;
  const pageW = dims.w - 2 * PAD;
  const pageH = dims.h - 2 * PAD;
  const storeKey = `questea:photobook:${folder.id}`;

  /* načtení příspěvků */
  useEffect(() => {
    if (posts !== null) return;
    let live = true;
    fetch(`/api/tasks/${folder.id}`).then((r) => r.json()).then((task: { subTasks?: (Post & { attachments?: Att[] })[] }) => {
      if (!live) return;
      const subs: Post[] = (task.subTasks || []).map((s) => ({
        ...s,
        attachments: (s.attachments || []).filter((a) => a.type === "image").map((a) => ({ id: a.id, type: a.type, url: `/api/images/${a.id}` })),
      }));
      setPosts(subs);
    }).catch(() => live && setError("Načtení fotek selhalo."));
    return () => { live = false; };
  }, [folder.id, posts]);

  /* mapa id → url (všechny fotky složky, pro tray i render) */
  const allImages = useMemo(() => (posts || []).flatMap((p) => (p.attachments || []).filter((a) => a.type === "image")), [posts]);
  const urlOf = useCallback((id: string) => `/api/images/${id}`, []);

  /* poměry stran fotek (pro justify) */
  useEffect(() => {
    if (allImages.length === 0) return;
    let cancelled = false;
    const next: Record<string, number> = {};
    let pending = allImages.length;
    const done = () => { if (--pending <= 0 && !cancelled) setAspects((prev) => ({ ...prev, ...next })); };
    allImages.forEach((a) => {
      const im = new window.Image();
      im.onload = () => { next[a.id] = im.naturalWidth / im.naturalHeight || 1.5; done(); };
      im.onerror = () => { next[a.id] = 1.5; done(); };
      im.src = a.url;
    });
    return () => { cancelled = true; };
  }, [allImages]);

  /* načtení uloženého rozvržení z DB */
  useEffect(() => {
    let live = true;
    fetch(`/api/tasks/${folder.id}/photobook`)
      .then((r) => (r.ok ? r.json() : { doc: null }))
      .then((d: { doc?: unknown }) => {
        if (!live) return;
        serverDocRef.current = Array.isArray(d?.doc) && d.doc.length ? (d.doc as BookPage[]) : null;
      })
      .catch(() => { if (live) serverDocRef.current = null; })
      .finally(() => { if (live) setDocLoaded(true); });
    return () => { live = false; };
  }, [folder.id]);

  /* inicializace dokumentu: DB → localStorage → auto-nástřel */
  useEffect(() => {
    if (doc || !posts || !docLoaded) return;
    if (serverDocRef.current) {
      lastSavedRef.current = JSON.stringify(serverDocRef.current); // shoda → první save se přeskočí
      setSaveState("saved");
      setDoc(serverDocRef.current);
      return;
    }
    try {
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem(storeKey) : null;
      if (saved) {
        const parsed = JSON.parse(saved) as BookPage[];
        if (Array.isArray(parsed) && parsed.length) { setDoc(parsed); return; }
      }
    } catch { /* ignore */ }
    setDoc(buildAutoDoc(posts, folder.title || ""));
  }, [doc, posts, docLoaded, storeKey, folder.title]);

  /* uložení dokumentu při změně: localStorage hned + debounced PUT do DB */
  useEffect(() => {
    if (!doc) return;
    const json = JSON.stringify(doc);
    try { localStorage.setItem(storeKey, json); } catch { /* ignore */ }
    if (json === lastSavedRef.current) return; // beze změny → neukládej
    setSaveState("saving");
    const t = setTimeout(() => {
      fetch(`/api/tasks/${folder.id}/photobook`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: json.length ? `{"doc":${json}}` : "{}",
      })
        .then((r) => { if (!r.ok) throw new Error(); lastSavedRef.current = json; setSaveState("saved"); })
        .catch(() => setSaveState("error"));
    }, 700);
    return () => clearTimeout(t);
  }, [doc, storeKey, folder.id]);

  const dateRange = useMemo(() => {
    if (!posts || posts.length === 0) return "";
    const a = fmtDate(posts[0]); const b = fmtDate(posts[posts.length - 1]);
    return a && b && a !== b ? `${a} — ${b}` : a || b;
  }, [posts]);

  const mapPoints = useMemo(() => {
    const pts: { lat: number; lng: number; title: string }[] = [];
    (posts || []).forEach((p) => {
      if (p.taskType === "GPS_LOG") return;
      const l = (p.locations || []).find((x) => typeof x.latitude === "number" && typeof x.longitude === "number");
      if (l) pts.push({ lat: l.latitude as number, lng: l.longitude as number, title: (p.title || "").trim() });
    });
    return pts;
  }, [posts]);

  /* ───────── mutace dokumentu ───────── */
  const mutate = (fn: (pages: BookPage[]) => BookPage[]) => setDoc((d) => (d ? fn(d.map((p) => ({ ...p }))) : d));
  const patchPage = (i: number, patch: Partial<BookPage>) => mutate((pages) => { pages[i] = { ...pages[i], ...patch }; return pages; });
  const addPage = () => mutate((pages) => {
    const np: BookPage = { id: uid(), template: "gallery", title: "", meta: "", text: "", photos: [] };
    pages.splice(sel + 1, 0, np); return pages;
  });
  const deletePage = (i: number) => mutate((pages) => { if (pages.length <= 1) return pages; pages.splice(i, 1); setSel((s) => Math.max(0, Math.min(s, pages.length - 2))); return pages; });
  const movePage = (i: number, dir: -1 | 1) => mutate((pages) => {
    const j = i + dir; if (j < 0 || j >= pages.length) return pages;
    [pages[i], pages[j]] = [pages[j], pages[i]]; setSel(j); return pages;
  });
  const addPhoto = (i: number, id: string) => mutate((pages) => { if (!pages[i].photos.includes(id)) pages[i].photos = [...pages[i].photos, id]; return pages; });
  const removePhoto = (i: number, id: string) => mutate((pages) => { pages[i].photos = pages[i].photos.filter((x) => x !== id); return pages; });
  const resetDoc = () => { if (posts && confirm("Obnovit knihu z příspěvků? Tvoje úpravy se zahodí.")) setDoc(buildAutoDoc(posts, folder.title || "")); };

  async function exportPdf() {
    if (!exportRef.current) return;
    setProgress({ cur: 0, total: (doc?.length || 0) + 1 });
    try {
      const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
      if (fonts?.ready) await fonts.ready;
      await generatePhotoBookPdf(exportRef.current, {
        format, title: folder.title || "fotokniha",
        onProgress: (cur, total) => setProgress({ cur, total }),
      });
    } catch (e) { setError(e instanceof Error ? e.message : "Generování PDF selhalo."); }
    setProgress(null);
  }

  const ready = posts && doc;
  const curPage = doc && doc[sel];

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-stone-950/90 backdrop-blur-sm">
      <style dangerouslySetInnerHTML={{ __html: "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700;1,900&family=Outfit:wght@300;400;500;700;800&display=swap');" }} />

      {/* horní lišta */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-stone-950 px-5 py-3 text-white">
        <div className="flex items-center gap-2 text-sm font-bold">
          <ImageIcon size={16} style={{ color: accent }} /> Fotokniha · {folder.title}
        </div>
        <div className="flex items-center gap-2">
          {ready && (
            <span className="mr-1 text-[11px] font-bold" style={{ color: saveState === "error" ? "#fca5a5" : "rgba(255,255,255,0.4)" }}>
              {saveState === "saving" ? "Ukládám…" : saveState === "saved" ? "Uloženo ✓" : saveState === "error" ? "Uložení selhalo" : ""}
            </span>
          )}
          <button onClick={resetDoc} title="Obnovit z příspěvků" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10">
            <RotateCcw size={14} /> Obnovit
          </button>
          <div className="flex overflow-hidden rounded-lg border border-white/15">
            {(["A4", "A5"] as Format[]).map((f) => (
              <button key={f} onClick={() => setFormat(f)} className={`px-3 py-1.5 text-xs font-bold ${format === f ? "bg-white text-stone-950" : "text-white/70 hover:bg-white/10"}`}>{f}</button>
            ))}
          </div>
          <button onClick={exportPdf} disabled={!!progress || !ready} className="inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50" style={{ background: accent }}>
            {progress ? (<><Loader2 size={16} className="animate-spin" /> {progress.cur}/{progress.total}</>) : (<><Download size={16} /> Stáhnout PDF</>)}
          </button>
          {onClose && <button onClick={onClose} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"><X size={20} /></button>}
        </div>
      </div>

      {error && <p className="mx-auto mt-3 max-w-md rounded-lg bg-red-950/60 px-4 py-2 text-center text-sm text-red-200">{error}</p>}

      {!ready ? (
        <p className="py-20 text-center text-sm text-white/50">{!posts ? "Načítám…" : "Připravuji knihu…"}</p>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* strip stránek */}
          <div className="flex w-[150px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-white/10 bg-stone-950/60 p-3">
            {doc!.map((p, i) => (
              <button key={p.id} onClick={() => setSel(i)}
                className={`group relative aspect-[210/297] w-full overflow-hidden rounded-md border text-left transition ${i === sel ? "border-2" : "border-white/15 hover:border-white/40"}`}
                style={{ borderColor: i === sel ? accent : undefined, background: p.template === "cover" ? "#1a1410" : "#fff" }}>
                <div className="pointer-events-none absolute inset-0 origin-top-left" style={{ width: dims.w, height: dims.h, transform: `scale(${150 / dims.w})` }}>
                  <PageView page={p} idx={i} accent={accent} format={format} dims={dims} PAD={PAD} GAP={GAP} pageW={pageW} pageH={pageH} aspects={aspects} urlOf={urlOf} mapPoints={mapPoints} dateRange={dateRange} editable={false} />
                </div>
                <span className="absolute bottom-1 right-1.5 rounded bg-black/55 px-1 text-[10px] font-bold text-white/80">{i + 1}</span>
              </button>
            ))}
            <button onClick={addPage} className="flex aspect-[210/297] w-full items-center justify-center rounded-md border border-dashed border-white/25 text-white/50 hover:border-white/50 hover:text-white">
              <Plus size={20} />
            </button>
          </div>

          {/* hlavní plátno */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* panel stránky */}
            {curPage && (
              <div className="flex items-center gap-3 border-b border-white/10 bg-stone-900/70 px-4 py-2 text-white">
                <LayoutTemplate size={15} style={{ color: accent }} />
                <select value={curPage.template} onChange={(e) => patchPage(sel, { template: e.target.value as Template })}
                  className="rounded-md border border-white/15 bg-stone-800 px-2 py-1 text-xs font-bold text-white outline-none">
                  {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <span className="text-xs text-white/40">stránka {sel + 1}/{doc!.length}</span>
                <div className="ml-auto flex items-center gap-1">
                  <button onClick={() => movePage(sel, -1)} disabled={sel === 0} className="rounded p-1.5 text-white/60 hover:bg-white/10 disabled:opacity-30"><ChevronLeft size={16} /></button>
                  <button onClick={() => movePage(sel, 1)} disabled={sel === doc!.length - 1} className="rounded p-1.5 text-white/60 hover:bg-white/10 disabled:opacity-30"><ChevronRight size={16} /></button>
                  <button onClick={() => deletePage(sel)} disabled={doc!.length <= 1} className="rounded p-1.5 text-red-300/70 hover:bg-red-500/15 disabled:opacity-30"><Trash2 size={16} /></button>
                </div>
              </div>
            )}

            {/* editovatelná aktuální stránka */}
            <div className="flex flex-1 items-start justify-center overflow-auto p-8">
              {curPage && (
                <div className="shadow-2xl" style={{ width: dims.w, height: dims.h, position: "relative" }}>
                  <PageView page={curPage} idx={sel} accent={accent} format={format} dims={dims} PAD={PAD} GAP={GAP} pageW={pageW} pageH={pageH} aspects={aspects} urlOf={urlOf} mapPoints={mapPoints} dateRange={dateRange}
                    editable
                    onText={(patch) => patchPage(sel, patch)}
                    onRemovePhoto={(id) => removePhoto(sel, id)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* zásobník fotek */}
          <div className={`flex shrink-0 flex-col border-l border-white/10 bg-stone-950/60 transition-all ${trayOpen ? "w-[220px]" : "w-[40px]"}`}>
            <button onClick={() => setTrayOpen((o) => !o)} className="flex items-center justify-between px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/5">
              {trayOpen && <span>Fotky ({allImages.length})</span>}
              {trayOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
            {trayOpen && (
              <div className="grid grid-cols-2 gap-1.5 overflow-y-auto p-2">
                {allImages.map((a) => {
                  const used = !!curPage?.photos.includes(a.id);
                  const canAdd = curPage && curPage.template !== "cover" && curPage.template !== "text";
                  return (
                    <button key={a.id} disabled={!canAdd || used} onClick={() => addPhoto(sel, a.id)}
                      title={used ? "Už na stránce" : canAdd ? "Přidat na stránku" : "Tato šablona fotky nemá"}
                      className={`relative aspect-square overflow-hidden rounded border transition ${used ? "border-2 opacity-50" : "border-white/10 hover:border-white/50"} ${!canAdd ? "cursor-not-allowed opacity-30" : ""}`}
                      style={{ borderColor: used ? accent : undefined }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url} alt="" className="h-full w-full object-cover" />
                      {!used && canAdd && <span className="absolute bottom-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white"><Plus size={11} /></span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* skrytý čistý kontejner pro export (všechny stránky, bez ovládátek) */}
      {ready && (
        <div ref={exportRef} aria-hidden style={{ position: "fixed", left: -99999, top: 0, width: dims.w, opacity: 0, pointerEvents: "none" }}>
          {doc!.map((p, i) => (
            <div key={p.id} className="print-page" style={{ width: dims.w, height: dims.h, position: "relative", background: p.template === "cover" ? "#1a1410" : "#fff", overflow: "hidden" }}>
              <PageView page={p} idx={i} accent={accent} format={format} dims={dims} PAD={PAD} GAP={GAP} pageW={pageW} pageH={pageH} aspects={aspects} urlOf={urlOf} mapPoints={mapPoints} dateRange={dateRange} editable={false} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── hoistnuté pomocné komponenty (mimo render) ─────────────── */
function PbEditable({ value, onCommit, style, editable }: { value: string; onCommit: (v: string) => void; style: React.CSSProperties; editable: boolean }) {
  if (!editable) return <div style={style}>{value}</div>;
  return (
    <div contentEditable suppressContentEditableWarning onBlur={(e) => onCommit(e.currentTarget.innerText)}
      style={{ ...style, outline: "none", cursor: "text", minHeight: "1em" }}>{value}</div>
  );
}

function PbLabel({ children, light, accent, a4 }: { children: React.ReactNode; light?: boolean; accent: string; a4: boolean }) {
  return <div style={{ fontFamily: "Outfit, sans-serif", fontSize: a4 ? 11 : 10, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: light ? "rgba(245,240,232,0.55)" : accent }}>{children}</div>;
}

function PbPhotos({ ids, full, editable, onRemovePhoto, aspects, urlOf, pageW, pageH, gap, a4 }: {
  ids: string[]; full?: boolean; editable: boolean; onRemovePhoto?: (id: string) => void;
  aspects: Record<string, number>; urlOf: (id: string) => string; pageW: number; pageH: number; gap: number; a4: boolean;
}) {
  if (full) {
    const id = ids[0];
    return (
      <div style={{ position: "absolute", inset: 0, background: "#1a1410" }}>
        {id ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urlOf(id)} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", fontFamily: "Outfit, sans-serif", fontSize: 13 }}>Přidej fotku ze zásobníku →</div>}
        {editable && id && onRemovePhoto && <RemoveBtn onClick={() => onRemovePhoto(id)} />}
      </div>
    );
  }
  const targetRowH = pageH / (a4 ? 3.15 : 2.85);
  if (ids.length === 0) {
    return editable ? <div style={{ height: targetRowH, border: "2px dashed #e0d8ca", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#b8ac99", fontFamily: "Outfit, sans-serif", fontSize: 13 }}>Přidej fotky ze zásobníku →</div> : null;
  }
  const rows = justifyRows(ids.map((id) => ({ id, aspect: aspects[id] || 1.5 })), pageW, gap, targetRowH);
  return (
    <>{rows.map((row, ri) => (
      <div key={ri} style={{ display: "flex", gap, height: row.h, justifyContent: "center", marginTop: ri > 0 ? gap : 0 }}>
        {row.cells.map((c) => (
          <div key={c.id} style={{ width: c.w, height: row.h, flexShrink: 0, overflow: "hidden", borderRadius: 6, background: "#ece8e1", boxShadow: "0 8px 22px rgba(0,0,0,0.10)", position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urlOf(c.id)} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            {editable && onRemovePhoto && <RemoveBtn onClick={() => onRemovePhoto(c.id)} />}
          </div>
        ))}
      </div>
    ))}</>
  );
}

/* ════════════════════════ render jedné stránky ════════════════════════ */
function PageView({
  page, idx, accent, format, dims, PAD, GAP, pageW, pageH, aspects, urlOf, mapPoints, dateRange,
  editable, onText, onRemovePhoto,
}: {
  page: BookPage; idx: number; accent: string; format: Format;
  dims: { w: number; h: number }; PAD: number; GAP: number; pageW: number; pageH: number;
  aspects: Record<string, number>; urlOf: (id: string) => string;
  mapPoints: { lat: number; lng: number; title: string }[]; dateRange: string;
  editable: boolean; onText?: (patch: Partial<BookPage>) => void; onRemovePhoto?: (id: string) => void;
}) {
  const a4 = format === "A4";
  const commit = (patch: Partial<BookPage>) => onText?.(patch);
  const photoProps = { editable, onRemovePhoto, aspects, urlOf, pageW, pageH, gap: GAP, a4 };
  const innerStyle = (center?: boolean): React.CSSProperties => ({ position: "absolute", inset: PAD, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: center ? "center" : "flex-start" });

  /* ── obálka ── */
  if (page.template === "cover") {
    return (
      <div style={{ width: dims.w, height: dims.h, background: "#1a1410", color: "#F5F0E8", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: a4 ? "56px 52px" : "38px 34px" }}>
        <div style={{ width: "100%" }}>
          {mapPoints.length >= 1 && (<>
            <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 9, fontWeight: 800, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(245,240,232,0.4)", marginBottom: 12 }}>Trasa cesty</div>
            <RouteTrace points={mapPoints} accent={accent} height={a4 ? 440 : 300} />
          </>)}
        </div>
        <div>
          <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.35em", textTransform: "uppercase", color: accent, marginBottom: 20 }}>Questea · Fotokniha</div>
          <PbEditable editable={editable} value={page.title} onCommit={(v) => commit({ title: v })}
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: a4 ? 76 : 50, fontWeight: 900, fontStyle: "italic", lineHeight: 0.9, marginBottom: 28, color: "#F5F0E8" }} />
          <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(245,240,232,0.55)" }}>{dateRange}</div>
        </div>
      </div>
    );
  }

  /* ── celostránková fotka ── */
  if (page.template === "fullbleed") {
    return (
      <div style={{ width: dims.w, height: dims.h, position: "relative", background: "#1a1410", overflow: "hidden" }}>
        <PbPhotos ids={page.photos} full {...photoProps} />
        {(page.title || page.meta) && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: a4 ? "120px 52px 44px" : "80px 34px 30px", background: "linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0))" }}>
            {page.meta && <div style={{ marginBottom: 8 }}><PbLabel light accent={accent} a4={a4}>{page.meta}</PbLabel></div>}
            <PbEditable editable={editable} value={page.title} onCommit={(v) => commit({ title: v })}
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: a4 ? 46 : 32, fontWeight: 900, fontStyle: "italic", lineHeight: 1.02, color: "#fff" }} />
          </div>
        )}
        <PageNum idx={idx} light />
      </div>
    );
  }

  /* ── jen text (vystředěno) ── */
  if (page.template === "text") {
    return (
      <div style={{ width: dims.w, height: dims.h, background: "#fff", position: "relative" }}>
        <div style={innerStyle(true)}>
          <div style={{ maxWidth: a4 ? 560 : 420, margin: "0 auto" }}>
            {page.meta && <div style={{ marginBottom: 12 }}><PbLabel accent={accent} a4={a4}>{page.meta}</PbLabel></div>}
            <PbEditable editable={editable} value={page.title} onCommit={(v) => commit({ title: v })}
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: a4 ? 48 : 32, fontWeight: 900, fontStyle: "italic", lineHeight: 1.02, color: "#1c1917", margin: 0 }} />
            <div style={{ width: 54, height: 3, background: accent, borderRadius: 2, margin: "16px 0 22px" }} />
            <Lead text={page.text} accent={accent} format={format} editable={editable} onCommit={(v) => commit({ text: v })} />
          </div>
        </div>
        <PageNum idx={idx} />
      </div>
    );
  }

  /* ── editorial (text + fotky) a galerie ── */
  const isEditorial = page.template === "editorial";
  return (
    <div style={{ width: dims.w, height: dims.h, background: "#fff", position: "relative" }}>
      <div style={innerStyle()}>
        {page.meta && <div style={{ marginBottom: 12 }}><PbLabel accent={accent} a4={a4}>{page.meta}</PbLabel></div>}
        {(page.title || editable) && (<>
          <PbEditable editable={editable} value={page.title} onCommit={(v) => commit({ title: v })}
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: a4 ? 50 : 34, fontWeight: 900, fontStyle: "italic", lineHeight: 1.02, color: "#1c1917", margin: 0 }} />
          <div style={{ width: 54, height: 3, background: accent, borderRadius: 2, margin: "14px 0 0" }} />
        </>)}
        {isEditorial && (page.text || editable) && (
          <div style={{ marginTop: 20 }}>
            <Lead text={page.text} accent={accent} format={format} editable={editable} onCommit={(v) => commit({ text: v })} />
          </div>
        )}
        <div style={{ marginTop: page.title || (isEditorial && page.text) ? GAP * 2.2 : 0 }}>
          <PbPhotos ids={page.photos} {...photoProps} />
        </div>
      </div>
      <PageNum idx={idx} />
    </div>
  );
}

function Lead({ text, accent, format, editable, onCommit }: { text: string; accent: string; format: Format; editable: boolean; onCommit: (v: string) => void }) {
  const leadPx = format === "A4" ? 16.5 : 13.5;
  const baseStyle: React.CSSProperties = { fontFamily: "'Playfair Display', Georgia, serif", fontSize: leadPx, lineHeight: 1.72, color: "#3f3a35", whiteSpace: "pre-wrap", margin: 0 };
  if (editable) {
    // při editaci bez drop-capu (kvůli kurzoru), drop-cap se projeví v náhledu/exportu
    return (
      <div contentEditable suppressContentEditableWarning onBlur={(e) => onCommit(e.currentTarget.innerText)}
        style={{ ...baseStyle, outline: "none", cursor: "text", minHeight: "1em" }}>{text || ""}</div>
    );
  }
  if (!text) return null;
  const first = text.charAt(0), rest = text.slice(1);
  return (
    <p style={baseStyle}>
      <span style={{ float: "left", fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900, fontSize: leadPx * 4.1, lineHeight: 0.74, marginRight: 12, marginTop: 6, color: accent }}>{first}</span>
      {rest}
    </p>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="Odebrat fotku"
      style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 999, background: "rgba(0,0,0,0.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}>
      <X size={14} />
    </button>
  );
}

function PageNum({ idx, light }: { idx: number; light?: boolean }) {
  return <div style={{ position: "absolute", bottom: 16, right: 20, fontFamily: "Outfit, sans-serif", fontSize: 10, fontWeight: 700, color: light ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.35)" }}>{idx + 1}</div>;
}
