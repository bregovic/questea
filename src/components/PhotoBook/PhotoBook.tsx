"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Download, RefreshCw, Loader2, ImageOff } from "lucide-react";
import { generatePhotoBookPdf } from "@/lib/generatePdf";
import {
  compose,
  chunksFor,
  geometryFor,
  type Density,
  type Format,
  type Page,
  type SourcePost,
  type TextLayout,
  type PhotoSize,
} from "@/lib/photobook/compose";
import { STYLES, STYLE_LIST, type StyleId } from "@/lib/photobook/styles";
import { BookPageView } from "./BookPageView";
import { BookCover } from "./BookCover";
import type { Caption } from "./PhotoCaption";

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

/**
 * Nastavení knihy. Do databáze se ukládá jen tohle – samotné rozvržení stránek
 * se dopočítá sazečem. Když přibude fotka nebo se upraví příspěvek, kniha se
 * přesází sama a ruční zásahy zůstanou.
 */
type Settings = {
  v: 2;
  format: Format;
  style: StyleId;
  /** Fotky vynechané z knihy. */
  hidden: string[];
  /** Celé příspěvky vynechané z knihy. */
  hiddenPosts: string[];
  /** Přepsané nadpisy, klíč = id příspěvku. */
  titles: Record<string, string>;
  /** Přepsané kusy textu, klíč = `idPříspěvku#poradí`. */
  chunks: Record<string, string>;
  /** Kolik fotek na stránku: 1 = pár velkých, 5 = hustá mřížka. */
  density: Density;
  /** Ruční volba šířky textu, klíč `idPříspěvku#poradíKusu`. */
  textLayouts: Record<string, TextLayout>;
  /** Ruční velikosti fotek, klíč = id fotky. */
  photoSizes: Record<string, PhotoSize>;
  /** Id příspěvků, které mají začít na nové stránce. */
  pageBreaks: string[];
  /** Popisky položené přes fotky, klíč = id fotky. */
  captions: Record<string, Caption>;
  /** Ručně vybraná fotka a název na obálce. */
  coverPhoto?: string;
  coverTitle?: string;
};

const DEFAULTS: Settings = {
  v: 2,
  format: "A4",
  style: "sand",
  hidden: [],
  hiddenPosts: [],
  titles: {},
  chunks: {},
  density: 3,
  textLayouts: {},
  photoSizes: {},
  pageBreaks: [],
  captions: {},
};

function styleFor(blogTemplate?: string | null): StyleId {
  switch (blogTemplate) {
    case "ADVENTURE":
      return "album";
    case "ELEGANT":
      return "ink";
    case "DARK":
      return "noir";
    default:
      return "sand";
  }
}

const DENSITY_LABEL: Record<Density, string> = {
  1: "pár velkých",
  2: "vzdušně",
  3: "vyváženě",
  4: "hustě",
  5: "hodně",
};

function fmtDate(p: Post): string {
  const d = p.recordedAt || p.createdAt;
  if (!d) return "";
  return new Date(d).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
}

export function PhotoBook({
  folder,
  posts: postsProp,
  format: formatProp,
  onClose,
}: {
  folder: Folder;
  posts?: Post[];
  format?: Format;
  onClose?: () => void;
}) {
  const [posts, setPosts] = useState<Post[] | null>(postsProp ?? null);
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sel, setSel] = useState(0);
  const [progress, setProgress] = useState<{ cur: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastSavedRef = useRef<string>("");
  const [stageScale, setStageScale] = useState(0.7);

  // ?raw=1 → fotka jde přes náš server, ne přesměrováním na R2. Bez toho
  // by ji prohlížeč kvůli chybějícímu CORS zablokoval a PDF by nešlo vytvořit.
  const urlOf = useCallback((id: string) => `/api/images/${id}?raw=1`, []);

  /* ── načtení příspěvků ── */
  useEffect(() => {
    if (posts !== null) return;
    let live = true;
    fetch(`/api/tasks/${folder.id}`)
      .then((r) => r.json())
      .then((task: { subTasks?: Post[] }) => {
        if (!live) return;
        setPosts(
          (task.subTasks || []).map((s) => ({
            ...s,
            attachments: (s.attachments || [])
              .filter((a) => a.type === "image")
              .map((a) => ({ id: a.id, type: a.type, url: `/api/images/${a.id}` })),
          }))
        );
      })
      .catch(() => live && setError("Načtení fotek selhalo."));
    return () => {
      live = false;
    };
  }, [folder.id, posts]);

  /* ── poměry stran: bez nich sazeč neumí spočítat výšky řádků ── */
  const allImages = useMemo(
    () => (posts || []).flatMap((p) => (p.attachments || []).filter((a) => a.type === "image")),
    [posts]
  );

  useEffect(() => {
    if (!allImages.length) return;
    let cancelled = false;
    const next: Record<string, number> = {};
    let pending = allImages.length;
    const done = () => {
      if (--pending <= 0 && !cancelled) setAspects((prev) => ({ ...prev, ...next }));
    };
    allImages.forEach((a) => {
      const im = new window.Image();
      im.onload = () => {
        next[a.id] = im.naturalWidth / im.naturalHeight || 1.5;
        done();
      };
      im.onerror = () => {
        next[a.id] = 1.5;
        done();
      };
      im.src = urlOf(a.id); // stejná adresa jako při vykreslení → načte se jen jednou
    });
    return () => {
      cancelled = true;
    };
  }, [allImages, urlOf]);

  /* ── nastavení z databáze; starý formát (pole stránek) se zahodí a přesází ── */
  useEffect(() => {
    let live = true;
    fetch(`/api/tasks/${folder.id}/photobook`)
      .then((r) => (r.ok ? r.json() : { doc: null }))
      .then((d: { doc?: unknown }) => {
        if (!live) return;
        const doc = d?.doc as Partial<Settings> | null;
        const ok = doc && !Array.isArray(doc) && doc.v === 2;
        const next: Settings = ok
          ? { ...DEFAULTS, ...(doc as Settings) }
          : { ...DEFAULTS, style: styleFor(folder.blogTemplate), format: formatProp || "A4" };
        lastSavedRef.current = ok ? JSON.stringify(next) : "";
        setSaveState(ok ? "saved" : "idle");
        setSettings(next);
      })
      .catch(() => {
        if (live) setSettings({ ...DEFAULTS, style: styleFor(folder.blogTemplate), format: formatProp || "A4" });
      });
    return () => {
      live = false;
    };
  }, [folder.id, folder.blogTemplate, formatProp]);

  /* ── ukládání ── */
  useEffect(() => {
    if (!settings) return;
    const json = JSON.stringify(settings);
    if (json === lastSavedRef.current) return;
    setSaveState("saving");
    const t = setTimeout(() => {
      fetch(`/api/tasks/${folder.id}/photobook`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: `{"doc":${json}}`,
      })
        .then((r) => {
          if (!r.ok) throw new Error();
          lastSavedRef.current = json;
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 700);
    return () => clearTimeout(t);
  }, [settings, folder.id]);

  const patch = (p: Partial<Settings>) => setSettings((s) => (s ? { ...s, ...p } : s));

  /* ── příspěvky → vstup pro sazeč (s ručními zásahy) ── */
  const sources: SourcePost[] = useMemo(() => {
    if (!posts || !settings) return [];
    const hidden = new Set(settings.hidden);
    const skipped = new Set(settings.hiddenPosts);
    return posts
      .filter((p) => p.taskType !== "GPS_LOG" && !skipped.has(p.id))
      .map((p) => {
        const photos = (p.attachments || [])
          .filter((a) => a.type === "image" && !hidden.has(a.id))
          .map((a) => a.id);
        // Text se nakrájí z původního znění, ruční úpravy se pak na kusy
        // jen přiloží – pořadí tím zůstává stabilní i po opakované úpravě.
        const chunks = chunksFor((p.description || "").trim(), photos.length).map(
          (c, i) => settings.chunks[`${p.id}#${i}`] ?? c
        );
        return {
          id: p.id,
          title: settings.titles[p.id] ?? (p.title || "").trim(),
          meta: [fmtDate(p), p.locations?.[0]?.placeName || p.locations?.[0]?.address]
            .filter(Boolean)
            .join(" · "),
          chunks,
          photos,
        };
      })
      .filter((p) => p.photos.length || p.chunks.some((c) => c.trim()) || p.title);
  }, [posts, settings]);

  const geo = useMemo(() => geometryFor(settings?.format || "A4"), [settings?.format]);

  const pages: Page[] = useMemo(() => {
    if (!sources.length) return [];
    // dokud se nenačtou poměry stran, sazba by byla nanečisto
    if (allImages.length && Object.keys(aspects).length < allImages.length) return [];
    return compose({
      posts: sources,
      aspects,
      geo,
      density: settings?.density ?? 3,
      textLayouts: settings?.textLayouts,
      photoSizes: settings?.photoSizes,
      pageBreaks: settings?.pageBreaks,
    });
  }, [sources, aspects, geo, allImages.length, settings?.density, settings?.textLayouts, settings?.photoSizes, settings?.pageBreaks]);

  const breakSet = useMemo(() => new Set(settings?.pageBreaks || []), [settings?.pageBreaks]);
  const style = STYLES[settings?.style || "sand"];
  const ready = !!settings && !!posts && (!allImages.length || pages.length > 0);

  const coverPhoto = useMemo(() => {
    const hidden = new Set(settings?.hidden || []);
    // Fotka na obálce se nevybírá automaticky – titulka si zaslouží
    // vědomou volbu, ne první snímek, který v cestě padl.
    if (settings?.coverPhoto && !hidden.has(settings.coverPhoto)) return settings.coverPhoto;
    return undefined;
  }, [settings?.hidden, settings?.coverPhoto]);

  const dateRange = useMemo(() => {
    if (!posts?.length) return "";
    const a = fmtDate(posts[0]);
    const b = fmtDate(posts[posts.length - 1]);
    return a && b && a !== b ? `${a} — ${b}` : a || b;
  }, [posts]);

  const total = pages.length + 1; // + obálka
  useEffect(() => {
    if (sel > total - 1) setSel(Math.max(0, total - 1));
  }, [sel, total]);

  /* ── náhled se vejde do plochy ── */
  useEffect(() => {
    const fit = () => {
      const el = stageRef.current;
      if (!el) return;
      const s = Math.min(
        (el.clientWidth - 48) / geo.pageW,
        (el.clientHeight - 48) / geo.pageH
      );
      setStageScale(Math.max(0.2, Math.min(1.1, s)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [geo.pageW, geo.pageH]);

  /* ── ruční zásahy ── */
  const hidePhoto = (id: string) =>
    patch({ hidden: [...(settings?.hidden || []), id] });
  const restorePhoto = (id: string) =>
    patch({ hidden: (settings?.hidden || []).filter((x) => x !== id) });
  const hidePost = (postId: string) =>
    patch({ hiddenPosts: [...(settings?.hiddenPosts || []), postId] });
  const restorePost = (postId: string) =>
    patch({ hiddenPosts: (settings?.hiddenPosts || []).filter((x) => x !== postId) });
  const editTitle = (postId: string, value: string) => {
    if (!settings) return;
    if ((settings.titles[postId] ?? undefined) === value) return;
    patch({ titles: { ...settings.titles, [postId]: value } });
  };
  const setCaption = (photoId: string, next: Caption | null) => {
    if (!settings) return;
    const captions = { ...settings.captions };
    if (next) captions[photoId] = next;
    else delete captions[photoId];
    patch({ captions });
  };
  const togglePageBreak = (postId: string) => {
    if (!settings) return;
    const on = settings.pageBreaks.includes(postId);
    patch({
      pageBreaks: on
        ? settings.pageBreaks.filter((x) => x !== postId)
        : [...settings.pageBreaks, postId],
    });
  };
  const SIZE_CYCLE: PhotoSize[] = ["m", "l", "full", "bleed", "s"];
  const cyclePhotoSize = (id: string) => {
    if (!settings) return;
    const cur = settings.photoSizes[id] || "m";
    const next = SIZE_CYCLE[(SIZE_CYCLE.indexOf(cur) + 1) % SIZE_CYCLE.length];
    patch({ photoSizes: { ...settings.photoSizes, [id]: next } });
  };
  const LAYOUT_CYCLE: TextLayout[] = ["full", "measured", "aside"];
  const cycleLayout = (postId: string, chunkIdx: number) => {
    if (!settings) return;
    const key = `${postId}#${chunkIdx}`;
    const cur = settings.textLayouts[key];
    const next = LAYOUT_CYCLE[(LAYOUT_CYCLE.indexOf(cur) + 1) % LAYOUT_CYCLE.length];
    patch({ textLayouts: { ...settings.textLayouts, [key]: next } });
  };
  const editChunk = (postId: string, chunkIdx: number, value: string) => {
    const key = `${postId}#${chunkIdx}`;
    if (!settings) return;
    if (settings.chunks[key] === value) return;
    patch({ chunks: { ...settings.chunks, [key]: value } });
  };
  const resetEdits = () => {
    if (!confirm("Vrátit knihu do původního stavu? Ruční úpravy textu a vynechané fotky se zahodí.")) return;
    patch({ hidden: [], hiddenPosts: [], titles: {}, chunks: {}, textLayouts: {}, photoSizes: {}, pageBreaks: [], captions: {}, coverPhoto: undefined, coverTitle: undefined });
  };

  async function exportPdf() {
    if (!exportRef.current) return;
    setProgress({ cur: 0, total });
    try {
      await generatePhotoBookPdf(exportRef.current, {
        format: settings?.format || "A4",
        title: folder.title || "fotokniha",
        onProgress: (cur, t) => setProgress({ cur, total: t }),
      });
    } catch (err) {
      setError(
        err instanceof Error ? `Vytvoření PDF selhalo. ${err.message}` : "Vytvoření PDF selhalo."
      );
    } finally {
      setProgress(null);
    }
  }

  const hiddenList = (settings?.hidden || [])
    .map((id) => allImages.find((a) => a.id === id))
    .filter(Boolean) as Att[];

  const hiddenPostList = (settings?.hiddenPosts || [])
    .map((id) => posts?.find((p) => p.id === id))
    .filter(Boolean) as Post[];

  return (
    <div className="fixed inset-0 z-[11000] flex flex-col bg-stone-950 text-stone-100">
      {/* Prázdný nadpis by jinak nebyl vidět a nedal se do něj kliknout. */}
      <style jsx global>{`
        [data-placeholder]:empty::before {
          content: attr(data-placeholder);
          opacity: 0.28;
        }
      `}</style>

      {/* lišta */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
        <div className="mr-auto flex items-baseline gap-3">
          <span className="text-base font-bold">{folder.title || "Fotokniha"}</span>
          <span className="text-xs text-stone-400">
            {ready ? `${total} stran` : "Počítám sazbu…"}
          </span>
          <span className="text-xs text-stone-500">
            {saveState === "saving" ? "Ukládám…" : saveState === "saved" ? "Uloženo" : saveState === "error" ? "Uložení selhalo" : ""}
          </span>
        </div>

        <select
          value={settings?.style || "sand"}
          onChange={(e) => patch({ style: e.target.value as StyleId })}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm outline-none"
          title="Styl knihy"
        >
          {STYLE_LIST.map((s) => (
            <option key={s.id} value={s.id} className="text-stone-900">
              {s.label} — {s.note}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm" title="Kolik fotek se vejde na stránku">
          <span className="text-stone-400">Fotek na stránku</span>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={settings?.density ?? 3}
            onChange={(e) => patch({ density: Number(e.target.value) as Density })}
            className="w-24 accent-orange-600"
          />
          <span className="w-16 text-xs text-stone-400">{DENSITY_LABEL[settings?.density ?? 3]}</span>
        </label>

        <div className="flex overflow-hidden rounded-lg bg-white/10 text-sm">
          {(["A4", "A5"] as Format[]).map((f) => (
            <button
              key={f}
              onClick={() => patch({ format: f })}
              className={`px-3 py-1.5 ${settings?.format === f ? "bg-orange-600" : ""}`}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          onClick={resetEdits}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
          title="Zahodit ruční úpravy a přesázet"
        >
          <RefreshCw size={14} /> Přesázet
        </button>

        <button
          onClick={exportPdf}
          disabled={!ready || !!progress}
          className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-1.5 text-sm font-bold disabled:opacity-40"
        >
          {progress ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {progress ? `${progress.cur}/${progress.total}` : "Stáhnout PDF"}
        </button>

        {onClose && (
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10" title="Zavřít">
            <X size={18} />
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-900/60 px-4 py-2 text-sm">
          {error}{" "}
          <button className="underline" onClick={() => setError(null)}>
            skrýt
          </button>
        </div>
      )}

      {!ready ? (
        <div className="flex flex-1 items-center justify-center gap-3 text-stone-400">
          <Loader2 className="animate-spin" size={18} /> Sázím stránky…
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* pruh náhledů */}
          <div className="w-[136px] shrink-0 overflow-y-auto border-r border-white/10 bg-black/40 p-3">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                onClick={() => setSel(i)}
                className={`mb-2 block w-full overflow-hidden rounded border transition ${
                  i === sel ? "border-orange-500" : "border-white/10 hover:border-white/40"
                }`}
                style={{ aspectRatio: `${geo.pageW}/${geo.pageH}` }}
                title={i === 0 ? "Obálka" : `Strana ${i}`}
              >
                <div
                  className="pointer-events-none origin-top-left"
                  style={{
                    width: geo.pageW,
                    height: geo.pageH,
                    transform: `scale(${110 / geo.pageW})`,
                  }}
                >
                  {i === 0 ? (
                    <BookCover
                      title={settings?.coverTitle ?? folder.title ?? "Fotokniha"}
                      subtitle={dateRange}
                      geo={geo}
                      style={style}
                      photoId={coverPhoto}
                      urlOf={urlOf}
                    />
                  ) : (
                    <BookPageView
                      page={pages[i - 1]}
                      index={i - 1}
                      geo={geo}
                      style={style}
                      urlOf={urlOf}
                    />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* vybraná stránka */}
          <div ref={stageRef} className="flex min-w-0 flex-1 items-center justify-center overflow-auto p-6">
            <div
              style={{
                width: geo.pageW * stageScale,
                height: geo.pageH * stageScale,
                flex: "0 0 auto",
              }}
            >
              <div
                className="origin-top-left shadow-2xl"
                style={{ width: geo.pageW, height: geo.pageH, transform: `scale(${stageScale})` }}
              >
                {sel === 0 ? (
                  <BookCover
                    title={settings?.coverTitle ?? folder.title ?? "Fotokniha"}
                    subtitle={dateRange}
                    geo={geo}
                    style={style}
                    photoId={coverPhoto}
                    urlOf={urlOf}
                    editable
                    onEditTitle={(v) => patch({ coverTitle: v })}
                  />
                ) : (
                  <BookPageView
                    page={pages[sel - 1]}
                    index={sel - 1}
                    geo={geo}
                    style={style}
                    urlOf={urlOf}
                    editable
                    onEditText={editChunk}
                    onEditTitle={editTitle}
                    onCycleLayout={cycleLayout}
                    onRemovePost={hidePost}
                    onRemovePhoto={hidePhoto}
                    onCyclePhotoSize={cyclePhotoSize}
                    onTogglePageBreak={togglePageBreak}
                    pageBreaks={breakSet}
                    captions={settings?.captions}
                    onCaption={setCaption}
                  />
                )}
              </div>
            </div>
          </div>

          {/* výběr fotky na obálku */}
          {sel === 0 && (
            <div className="w-[150px] shrink-0 overflow-y-auto border-l border-white/10 bg-black/40 p-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                Fotka na obálku
              </div>
              <div className="grid grid-cols-2 gap-2">
                {allImages
                  .filter((a) => !(settings?.hidden || []).includes(a.id))
                  .map((a) => (
                    <button
                      key={a.id}
                      onClick={() => patch({ coverPhoto: a.id })}
                      className={`aspect-square overflow-hidden rounded border transition ${
                        coverPhoto === a.id ? "border-2 border-orange-500" : "border-white/10 hover:border-white/50"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urlOf(a.id)} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* vynechané fotky */}
          {(hiddenList.length > 0 || hiddenPostList.length > 0) && (
            <div className="w-[150px] shrink-0 overflow-y-auto border-l border-white/10 bg-black/40 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                <ImageOff size={12} /> Vynechané
              </div>
              {hiddenPostList.length > 0 && (
                <div className="mb-3 space-y-1">
                  {hiddenPostList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => restorePost(p.id)}
                      title="Vrátit příspěvek do knihy"
                      className="block w-full truncate rounded bg-white/5 px-2 py-1 text-left text-[11px] text-stone-300 hover:bg-white/15"
                    >
                      ↩ {p.title || "Bez názvu"}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {hiddenList.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => restorePhoto(a.id)}
                    title="Vrátit do knihy"
                    className="aspect-square overflow-hidden rounded border border-white/10 opacity-60 hover:opacity-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urlOf(a.id)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* skrytý kontejner, ze kterého se snímá PDF */}
      <div ref={exportRef} style={{ position: "fixed", left: -99999, top: 0, opacity: 0 }} aria-hidden>
        <BookCover
          title={settings?.coverTitle ?? folder.title ?? "Fotokniha"}
          subtitle={dateRange}
          geo={geo}
          style={style}
          photoId={coverPhoto}
          urlOf={urlOf}
        />
        {pages.map((p, i) => (
          <BookPageView
            key={p.id}
            page={p}
            index={i}
            geo={geo}
            style={style}
            urlOf={urlOf}
            captions={settings?.captions}
          />
        ))}
      </div>
    </div>
  );
}
