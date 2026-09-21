/**
 * Sazeč fotoknihy.
 *
 * Nahrazuje model „jeden příspěvek = jedna stránka", kvůli kterému krátký
 * příspěvek zabral celou A4 a zbytek zůstal prázdný. Místo toho se každý
 * příspěvek rozloží na bloky (nadpis, text, skupina fotek) a ty se skládají
 * do souvislého toku, který se láme na stránky. Dvoufotkový příspěvek tak
 * zabere pětinu stránky a hned pod ním začne další.
 *
 * Fotky se zásadně neořezávají: řádek fotek se sází „justified" – výška řádku
 * vyplyne ze skutečných poměrů stran a z šířky sazebního obrazce. Výška skupiny
 * fotek proto není volný parametr, ale výsledek. Aby stránky přesto vycházely
 * plné, hledá se pro každou stránku taková cílová výška řádku, při které obsah
 * zaplní dostupné místo nejlépe.
 *
 * Modul je záměrně čistý (žádné DOM, žádný React), aby se dal testovat zvlášť.
 */

export type Geometry = {
  pageW: number;
  pageH: number;
  /** Okraje jsou zrcadlené: u hřbetu širší, protože se tam část stránky
   *  ztratí ohybem a lepením. Šířka sazebního obrazce je na obou stranách
   *  stejná, liší se jen jeho odsazení – sazeč tak parity stránek nemusí řešit. */
  padInner: number;
  padOuter: number;
  padTop: number;
  padBottom: number;
  gap: number;
  /** Šířka a výška sazebního obrazce (stránka bez okrajů). */
  contentW: number;
  contentH: number;
  /** Míra textu: širší řádek než ~65 znaků se špatně čte, tak se text
   *  nesází přes celou šířku stránky. */
  textW: number;
  /** Měřítko typografie: A4 = 1, A5 = 0.72. */
  scale: number;
};

export type SourcePost = {
  id: string;
  title: string;
  /** Datum · místo. */
  meta: string;
  /** Text už nakrájený na kusy, které se dají prokládat fotkami.
   *  Krájí se mimo sazeč, aby ruční úpravy měly stabilní pořadí – kdyby se
   *  text po každé úpravě dělil znovu, posunuly by se indexy a další úprava
   *  by přepsala jiný kus. */
  chunks: string[];
  /** Id fotek v pořadí, v jakém patří k příspěvku. */
  photos: string[];
};

export type PhotoCell = { id: string; w: number; h: number };

/** `full` = přes celou šířku (krátká poznámka), `measured` = čitelná míra
 *  (souvislý text), `aside` = na půl šířky a vedle fotka. */
export type TextLayout = "full" | "measured" | "aside";

/** Ruční velikost fotky. Bez ořezu se velikost řídí tím, s kolika fotkami
 *  se dělí o řádek: čím míň jich v řádku je, tím je každá vyšší a širší. */
export type PhotoSize = "s" | "m" | "l" | "full";

/** Kolik fotek smí být v řádku, který tuhle fotku obsahuje. */
const SIZE_LIMITS: Record<PhotoSize, { min: number; max: number }> = {
  s: { min: 3, max: 9 },
  m: { min: 1, max: 9 },
  l: { min: 1, max: 2 },
  full: { min: 1, max: 1 },
};
export type PhotoRow = { h: number; cells: PhotoCell[] };

export type Block =
  | { kind: "heading"; postId: string; title: string; meta: string; h: number }
  | {
      kind: "text";
      postId: string;
      text: string;
      lead: boolean;
      chunkIdx: number;
      /** Jak široko text sedí: přes celou šířku, v čitelné míře, nebo na půl
       *  šířky s fotkou vedle sebe. */
      layout: TextLayout;
      /** Jen u `aside` – fotka po pravé straně textu. */
      photo?: PhotoCell;
      h: number;
    }
  | { kind: "photos"; postId: string; rows: PhotoRow[]; h: number };

export type Page = {
  id: string;
  blocks: Block[];
  /** Kolik výšky sazebního obrazce je zaplněno (0–1). Pro ladění a diagnostiku. */
  fill: number;
};

export type Doc = {
  v: 2;
  pages: Page[];
};

/* ─────────────────────────── geometrie ─────────────────────────── */

/* Okraje podle zvyklostí knižní sazby: vnitřní (u hřbetu) výrazně širší než
   vnější, dolní o něco větší než horní. Hodnoty v px při 96 DPI, tj.
   1 mm ≈ 3.78 px – vnitřní 80 px ≈ 21 mm, vnější 50 px ≈ 13 mm. */
export const PAGE_SIZES = {
  A4: { w: 794, h: 1123, inner: 80, outer: 50, top: 50, bottom: 64, scale: 1 },
  A5: { w: 559, h: 794, inner: 58, outer: 36, top: 36, bottom: 46, scale: 0.72 },
} as const;

export type Format = keyof typeof PAGE_SIZES;

/** Kolem 65 znaků na řádek se čte nejlépe; víc už oko ztrácí návaznost. */
const IDEAL_CHARS_PER_LINE = 65;

export function geometryFor(format: Format): Geometry {
  const s = PAGE_SIZES[format];
  const contentW = s.w - s.inner - s.outer;
  return {
    pageW: s.w,
    pageH: s.h,
    padInner: s.inner,
    padOuter: s.outer,
    padTop: s.top,
    padBottom: s.bottom,
    gap: Math.round(16 * s.scale),
    contentW,
    contentH: s.h - s.top - s.bottom,
    textW: Math.min(contentW, Math.round(TYPE.body.size * s.scale * AVG_CHAR_W * IDEAL_CHARS_PER_LINE)),
    scale: s.scale,
  };
}

/* ─────────────────────────── typografie ─────────────────────────── */

/**
 * Odhad výšky textu. Nepotřebujeme přesnost na pixel – stačí, aby se blok
 * vešel tam, kam ho sazeč pošle; drobný rozdíl dorovná pružná mezera.
 * `0.5 × velikost písma` je obvyklá střední šířka znaku u humanistického
 * bezpatkového písma; čeština s diakritikou se tím trefí dost dobře.
 */
const AVG_CHAR_W = 0.5;

export const TYPE = {
  title: { size: 27, line: 1.12, gapAfter: 7 },
  meta: { size: 11, line: 1.3, gapAfter: 13 }, // 11 px ≈ 8,3 pt – tiskové minimum pro bezpatkové je 8 pt
  lead: { size: 14.5, line: 1.62, gapAfter: 0 },
  body: { size: 12.5, line: 1.66, gapAfter: 0 },
} as const;

function wrappedLines(text: string, width: number, fontSize: number): number {
  const perLine = Math.max(1, Math.floor(width / (fontSize * AVG_CHAR_W)));
  // Vlastní odstavce v textu se lámou samostatně, jinak by dlouhý text
  // s mnoha krátkými řádky vyšel jako jeden dlouhý blok.
  return text
    .split(/\n+/)
    .filter((p) => p.trim().length > 0)
    .reduce((n, para) => n + Math.max(1, Math.ceil(para.trim().length / perLine)), 0);
}

/** Odsazení uvnitř podbarveného textového bloku (px při A4). */
export const TEXT_PAD = 9;

export function textHeight(text: string, geo: Geometry, lead: boolean, width?: number): number {
  const t = lead ? TYPE.lead : TYPE.body;
  const size = t.size * geo.scale;
  const pad = TEXT_PAD * geo.scale;
  const paras = text.split(/\n+/).filter((p) => p.trim().length > 0).length;
  const lines = wrappedLines(text, (width ?? geo.textW) - pad * 2.8, size);
  // mezera mezi odstavci uvnitř bloku + odsazení podbarvení
  return Math.ceil(lines * size * t.line + Math.max(0, paras - 1) * size * 0.6 + pad * 2);
}

export function headingHeight(title: string, meta: string, geo: Geometry): number {
  const ts = TYPE.title.size * geo.scale;
  const ms = TYPE.meta.size * geo.scale;
  const titleLines = title ? wrappedLines(title, geo.contentW, ts) : 0;
  let h = 0;
  if (title) h += titleLines * ts * TYPE.title.line + TYPE.title.gapAfter * geo.scale;
  if (meta) h += ms * TYPE.meta.line + TYPE.meta.gapAfter * geo.scale;
  return Math.ceil(h);
}

/* ───────────────────── justified řádky fotek ───────────────────── */

/**
 * Rozláme fotky do řádků tak, aby každý řádek přesně vyplnil šířku.
 * Výška řádku vyplyne z poměrů stran – žádná fotka se neořezává.
 *
 * Zalomení se hledá dynamickým programováním přes celou skupinu, ne hladově
 * fotka po fotce. Hladový postup se rozhoduje podle toho, co zrovna vidí, a
 * doplatí na to konec skupiny: poslední řádek vyjde buď přeplácaný, nebo v něm
 * zůstane jedna fotka. Tady se minimalizuje součet čtverců odchylek výšky
 * řádku od cílové (váženo počtem fotek v řádku), takže se odchylka rozloží
 * rovnoměrně. Je to stejný princip, jakým se v sazbě lámou odstavce na řádky.
 */
export function justify(
  photos: { id: string; aspect: number; size?: PhotoSize }[],
  width: number,
  gap: number,
  targetRowH: number
): PhotoRow[] {
  const n = photos.length;
  if (!n) return [];

  // prefixové součty poměrů stran → šířka libovolného úseku je rozdíl dvou čísel
  const pre = [0];
  for (const p of photos) pre.push(pre[pre.length - 1] + p.aspect);

  const rowH = (i: number, j: number) =>
    (width - gap * (j - i - 1)) / (pre[j] - pre[i]);

  // Kolik fotek se na řádek vůbec může vejít – strop prohledávání.
  const minAspect = Math.min(...photos.map((p) => p.aspect));
  const maxPerRow = Math.max(1, Math.round(width / targetRowH / minAspect) + 2);

  /** Smí úsek [i,j) tvořit řádek? Ruční velikosti omezují počet fotek v řádku. */
  const allowed = (i: number, j: number) => {
    const k = j - i;
    for (let x = i; x < j; x++) {
      const lim = SIZE_LIMITS[photos[x].size || "m"];
      if (k < lim.min || k > lim.max) return false;
    }
    return true;
  };

  const cost = new Array<number>(n + 1).fill(Infinity);
  const from = new Array<number>(n + 1).fill(0);
  cost[0] = 0;

  for (let j = 1; j <= n; j++) {
    for (let i = Math.max(0, j - maxPerRow); i < j; i++) {
      if (!isFinite(cost[i])) continue;
      if (!allowed(i, j)) continue;
      const h = rowH(i, j);
      if (h <= 0) continue;
      const c = cost[i] + (h - targetRowH) ** 2 * (j - i);
      if (c < cost[j]) {
        cost[j] = c;
        from[j] = i;
      }
    }
  }

  // Kdyby se ruční velikosti nedaly splnit (např. „malá" jako jediná zbylá
  // fotka), radši se omezení pustí, než aby se skupina vůbec nevysázela.
  if (!isFinite(cost[n])) {
    return justify(photos.map((p) => ({ id: p.id, aspect: p.aspect })), width, gap, targetRowH);
  }

  const cuts: number[] = [];
  for (let j = n; j > 0; j = from[j]) cuts.unshift(j);

  const rows: PhotoRow[] = [];
  let start = 0;
  for (const end of cuts) {
    const slice = photos.slice(start, end);
    // Strop výšky: jedna fotka na řádku by se jinak roztáhla přes celou šířku.
    const solo = slice.length === 1 && slice[0].size === "full";
    const h = Math.min(rowH(start, end), targetRowH * (solo ? 1.9 : 1.1));
    rows.push({ h, cells: slice.map((it) => ({ id: it.id, w: it.aspect * h, h })) });
    start = end;
  }
  return rows;
}

/**
 * Najde pro dané fotky takové rozlámání do řádků, které co nejlépe vyplní
 * `available` px na výšku. Vrací řádky, které se vejdou, a fotky, které
 * zbyly na další stránku.
 *
 * Zkouší různé cílové výšky řádku: vyšší cíl = méně fotek na řádek a vyšší
 * řádky, nižší cíl = hustší mřížka. Vybere tu variantu, která místo zaplní
 * nejvíc; při shodě tu, která umístí víc fotek.
 */
export function fitPhotos(
  photos: { id: string; aspect: number; size?: PhotoSize }[],
  geo: Geometry,
  available: number,
  density: Density = 3
): { rows: PhotoRow[]; used: number; rest: { id: string; aspect: number; size?: PhotoSize }[] } {
  if (!photos.length || available <= 0) return { rows: [], used: 0, rest: photos };

  const band = ROW_BANDS[density];
  const minRowH = geo.contentH * band[0];
  const maxRowH = geo.contentH * band[1];

  let best: { rows: PhotoRow[]; used: number; count: number; fill: number } | null = null;

  const STEPS = 22;
  for (let i = 0; i <= STEPS; i++) {
    const target = minRowH + ((maxRowH - minRowH) * i) / STEPS;
    const all = justify(photos, geo.contentW, geo.gap, target);

    // vezmi tolik řádků, kolik se vejde
    const taken: PhotoRow[] = [];
    let h = 0;
    for (const row of all) {
      const next = h + (taken.length ? geo.gap : 0) + row.h;
      if (next > available) break;
      taken.push(row);
      h = next;
    }
    if (!taken.length) continue;

    const count = taken.reduce((n, r) => n + r.cells.length, 0);
    const fill = h / available;
    if (
      !best ||
      fill > best.fill + 0.001 ||
      (Math.abs(fill - best.fill) <= 0.001 && count > best.count)
    ) {
      best = { rows: taken, used: h, count, fill };
    }
  }

  if (!best) return { rows: [], used: 0, rest: photos };
  return { rows: best.rows, used: best.used, rest: photos.slice(best.count) };
}

/* ─────────────────────── příspěvky → bloky ─────────────────────── */

/**
 * Text příspěvku se dělí na kusy po dvou větách, aby šel prokládat fotkami
 * – stejně jako na blogu. Krátký text zůstane vcelku.
 */
const RUNT = 70; // kratší útržek textu už na stránce působí jako zmetek

export function splitSentences(text: string, perChunk = 2): string[] {
  const clean = text.trim();
  if (!clean) return [];
  const sentences = clean
    .split(/(?<=[.!?…])\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ0-9„"])/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length < 2) return [clean];

  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += perChunk) {
    out.push(sentences.slice(i, i + perChunk).join(" "));
  }
  // Poslední kus bývá po dělení po dvou větách krátký – přilepit k předchozímu.
  if (out.length > 1 && out[out.length - 1].length < RUNT) {
    const tail = out.pop() as string;
    out[out.length - 1] += " " + tail;
  }
  return out;
}

/**
 * Kolik kusů textu má smysl udělat. Text se dělí jen proto, aby šel proložit
 * fotkami – bez fotek se nedělí vůbec a zůstane souvislý.
 */
export function chunksFor(text: string, photoCount: number): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (photoCount === 0) return [clean];
  const all = splitSentences(clean);
  const wanted = Math.max(1, Math.min(all.length, photoCount));
  if (all.length <= wanted) return all;
  // slij přebytečné kusy rovnoměrně do `wanted` skupin
  const merged: string[] = [];
  const per = Math.ceil(all.length / wanted);
  for (let i = 0; i < all.length; i += per) merged.push(all.slice(i, i + per).join(" "));
  return merged;
}

/** Šířka textového sloupce pro dané rozvržení. */
export function textWidthFor(layout: TextLayout, geo: Geometry): number {
  if (layout === "full") return geo.contentW;
  if (layout === "aside") return Math.round((geo.contentW - geo.gap) / 2);
  return geo.textW;
}

/* Krátká poznámka v úzkém sloupci vypadá jen zhuštěně a plýtvá místem –
   doporučení „65 znaků na řádek" platí pro souvislé čtení stránek textu,
   ne pro dvě věty z cesty. */
const SHORT_TEXT = 200;
const ASIDE_MAX = 700;

/* ─────────────────────────── sazba stránek ─────────────────────────── */

let _seq = 0;
const pid = () => `pg${(_seq++).toString(36)}`;

/** 1 = pár velkých fotek na stránku, 5 = hustá mřížka. Doporučený průměr
 *  u fotoknih jsou 3–4 fotky na stránku, proto výchozí 3. */
export type Density = 1 | 2 | 3 | 4 | 5;

/** Rozmezí výšky řádku fotek jako podíl výšky sazebního obrazce. */
const ROW_BANDS: Record<Density, [number, number]> = {
  1: [0.30, 0.66],
  2: [0.22, 0.54],
  3: [0.16, 0.44],
  4: [0.12, 0.34],
  5: [0.09, 0.26],
};

export type ComposeInput = {
  posts: SourcePost[];
  aspects: Record<string, number>;
  geo: Geometry;
  density?: Density;
  /** Ruční volba šířky textu, klíč `idPříspěvku#poradíKusu`. */
  textLayouts?: Record<string, TextLayout>;
  /** Ruční velikosti fotek, klíč = id fotky. */
  photoSizes?: Record<string, PhotoSize>;
  /** Id příspěvků, které mají začít na nové stránce. */
  pageBreaks?: string[];
};

/**
 * Hlavní vstup: z příspěvků poskládá stránky.
 *
 * Pravidla sazby:
 *  - nadpis nikdy nezůstane osamocený na konci stránky,
 *  - skupina fotek se smí zlomit jen na hranici řádku,
 *  - když na stránce zbývá míň než sedmina výšky, stránka se uzavře,
 *  - zbylé místo se rozdělí do mezer mezi bloky, ať text neplave nahoře.
 */
export function compose({ posts, aspects, geo, density = 3, textLayouts = {}, photoSizes = {}, pageBreaks = [] }: ComposeInput): Page[] {
  const breaks = new Set(pageBreaks);
  const layoutOf = (postId: string, idx: number): TextLayout | undefined =>
    textLayouts[`${postId}#${idx}`];
  const pages: Page[] = [];
  let cur: Block[] = [];
  let used = 0;

  const MIN_TAIL = geo.contentH * 0.14; // pod tím už nemá smysl na stránku cpát další blok
  const aspectOf = (id: string) => aspects[id] || 1.5;

  const closePage = () => {
    if (!cur.length) return;
    pages.push({ id: pid(), blocks: cur, fill: used / geo.contentH });
    cur = [];
    used = 0;
  };

  const remaining = () => geo.contentH - used - (cur.length ? geo.gap : 0);

  const place = (b: Block) => {
    used += (cur.length ? geo.gap : 0) + b.h;
    cur.push(b);
  };

  /** Uzavře stránku a vezme s sebou na další koncový nadpis i text, ke
   *  kterým se už na téhle stránce nevešly fotky. Stránka končící jen
   *  nadpisem a odstavcem vypadá jako nedopsaná – takový ocas patří k
   *  obsahu, který ho následuje. Stránku ale nikdy nevyprázdní úplně. */
  const closeCarryingTrailingText = () => {
    const tail: Block[] = [];
    while (cur.length > 1) {
      const last = cur[cur.length - 1];
      if (last.kind === "photos") break;
      cur.pop();
      used -= last.h + (cur.length ? geo.gap : 0);
      tail.unshift(last);
    }
    closePage();
    tail.forEach(place);
  };

  for (const post of posts) {
    // ruční zalomení: příspěvek má začít na čisté stránce
    if (breaks.has(post.id) && cur.length) closePage();

    const photos = post.photos.map((id) => ({ id, aspect: aspectOf(id), size: photoSizes[id] }));
    const chunks = post.chunks.filter((c) => c.trim().length > 0);
    if (!chunks.length && !photos.length) continue;

    /* ── nadpis ──
       Nesmí zůstat viset sám dole. Vyžádá si místo i pro první kus obsahu. */
    const hh = headingHeight(post.title, post.meta, geo);
    const firstContentH = chunks.length
      ? textHeight(chunks[0], geo, true, geo.contentW)
      : geo.contentH * 0.2;
    if (hh > 0) {
      if (remaining() < hh + geo.gap + Math.min(firstContentH, geo.contentH * 0.18)) {
        closePage();
      }
      place({ kind: "heading", postId: post.id, title: post.title, meta: post.meta, h: hh });
    }

    /* ── text prokládaný fotkami ──
       Fotky se rozdělí mezi kusy textu rovnoměrně, zbytek doteče za poslední.
       Nejdřív se poskládá pořadí obsahu, teprve pak se sází – čte se to líp
       než míchat rozdělování a lámání stránek dohromady. */
    type Item =
      | { t: "text"; text: string; lead: boolean; idx: number; layout: TextLayout; photo?: { id: string; aspect: number } }
      | { t: "photos"; group: { id: string; aspect: number }[] };

    const items: Item[] = [];
    if (chunks.length) {
      const perChunk = Math.ceil(photos.length / chunks.length);
      let pool = photos;
      let lastWasAside = false;

      chunks.forEach((chunk, i) => {
        const len = chunk.length;
        const override = layoutOf(post.id, i);

        /* Volba šířky: krátká poznámka přes celou šířku (neplýtvá místem),
           střední text s fotkou po boku (a nesmí být dva takové za sebou),
           dlouhý text v čitelné míře. */
        let layout: TextLayout;
        if (override) layout = override;
        else if (len < SHORT_TEXT) layout = "full";
        else if (len <= ASIDE_MAX && pool.length >= 2 && !lastWasAside) layout = "aside";
        else layout = "measured";

        let aside: { id: string; aspect: number } | undefined;
        if (layout === "aside" && pool.length) {
          aside = pool[0];
          pool = pool.slice(1);
        } else if (layout === "aside") {
          layout = "full"; // nebyla volná fotka
        }
        lastWasAside = layout === "aside";

        items.push({ t: "text", text: chunk, lead: i === 0, idx: i, layout, photo: aside });

        const group = pool.slice(0, perChunk);
        pool = pool.slice(group.length);
        if (group.length) items.push({ t: "photos", group });
      });
      if (pool.length) items.push({ t: "photos", group: pool });
    } else if (photos.length) {
      items.push({ t: "photos", group: photos });
    }

    for (const item of items) {
      if (item.t === "text") {
        const w = textWidthFor(item.layout, geo);
        let th = textHeight(item.text, geo, item.lead, w);
        let cell: PhotoCell | undefined;
        if (item.layout === "aside" && item.photo) {
          const ph = w / item.photo.aspect;
          cell = { id: item.photo.id, w, h: ph };
          th = Math.max(th, ph);
        }
        if (remaining() < Math.min(th, geo.contentH * 0.22)) closePage();
        place({
          kind: "text",
          postId: post.id,
          text: item.text,
          lead: item.lead,
          chunkIdx: item.idx,
          layout: item.layout,
          photo: cell,
          h: th,
        });
        continue;
      }

      // Skupina fotek se smí zlomit jen na hranici řádku; co se nevejde,
      // pokračuje na další stránce.
      let rest = item.group;
      let guard = 0;
      while (rest.length && guard++ < 500) {
        if (remaining() < MIN_TAIL) closeCarryingTrailingText();
        const fit = fitPhotos(rest, geo, remaining(), density);
        if (!fit.rows.length) {
          // na stránce je jen nadpis (nebo nic) → dál už se to nezlepší
          if (!cur.length || !cur.some((x) => x.kind === "photos")) break;
          closeCarryingTrailingText();
          continue;
        }
        place({ kind: "photos", postId: post.id, rows: fit.rows, h: fit.used });
        rest = fit.rest;
        if (rest.length) closePage();
      }
    }

    // mezi příspěvky se stránka neuzavírá – právě o to jde
  }

  closePage();
  return pages;
}
