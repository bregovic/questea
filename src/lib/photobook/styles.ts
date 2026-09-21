/**
 * Styly fotoknihy.
 *
 * Styl se volí jednou pro celou knihu a určuje paletu, dvojici písem, rámečky
 * fotek a rytmus mezer. Rozvržení stránek je na stylu nezávislé – sazeč počítá
 * jen s geometrií, takže přepnutí stylu nepřesází knihu znovu.
 */

export type StyleId = "sand" | "ink" | "album" | "noir";

export type BookStyle = {
  id: StyleId;
  label: string;
  /** Krátký popis do výběru. */
  note: string;
  paper: string;
  text: string;
  muted: string;
  accent: string;
  /** Rodina pro nadpisy a pro text. */
  titleFont: string;
  bodyFont: string;
  titleWeight: number;
  titleItalic: boolean;
  /** Zaoblení a rámeček fotek. */
  photoRadius: number;
  photoBorder: string | null;
  photoShadow: string | null;
  /** Velká písmena a prostrkání u popisků (datum · místo). */
  metaTracking: string;
  /** Jemné podbarvení textových bloků, ať na stránce nesplývají s papírem. */
  textTint: string | null;
  /** Největší náhodné pootočení samostatné fotky ve stupních. Patří jen ke
   *  scrapbookovému stylu – v knižní sazbě by vypadalo jako chyba. */
  tilt: number;
};

const SANS = "'Outfit', 'Inter', system-ui, sans-serif";
const SERIF = "'Playfair Display', Georgia, serif";

export const STYLES: Record<StyleId, BookStyle> = {
  sand: {
    id: "sand",
    label: "Písek",
    note: "Světlá, teplá, korálový akcent – jako appka",
    paper: "#fdfbf7",
    text: "#1c1917",
    muted: "#8a8179",
    accent: "#ea580c",
    titleFont: SANS,
    bodyFont: SANS,
    titleWeight: 800,
    titleItalic: false,
    photoRadius: 6,
    photoBorder: null,
    photoShadow: "0 10px 26px rgba(0,0,0,0.10)",
    metaTracking: "0.22em",
    textTint: "rgba(28,25,23,0.035)",
    tilt: 0,
  },
  ink: {
    id: "ink",
    label: "Kniha",
    note: "Patkové nadpisy, klidná šedá, knižní dojem",
    paper: "#fcfcfa",
    text: "#141414",
    muted: "#7d7d78",
    accent: "#2f2f2c",
    titleFont: SERIF,
    bodyFont: SANS,
    titleWeight: 900,
    titleItalic: true,
    photoRadius: 0,
    photoBorder: null,
    photoShadow: null,
    metaTracking: "0.26em",
    textTint: "rgba(20,20,20,0.03)",
    tilt: 0,
  },
  album: {
    id: "album",
    label: "Album",
    note: "Bílé rámečky kolem fotek, cestovatelský deník",
    paper: "#f6f1e8",
    text: "#2d241e",
    muted: "#98897a",
    accent: "#a68a64",
    titleFont: SERIF,
    bodyFont: SANS,
    titleWeight: 900,
    titleItalic: true,
    photoRadius: 2,
    photoBorder: "6px solid #ffffff",
    photoShadow: "0 8px 20px rgba(80,60,40,0.16)",
    metaTracking: "0.24em",
    textTint: "rgba(166,138,100,0.10)",
    tilt: 0.8,
  },
  noir: {
    id: "noir",
    label: "Noir",
    note: "Tmavý papír, fotky svítí",
    paper: "#131211",
    text: "#f5f0e8",
    muted: "#8b857d",
    accent: "#d6d1c7",
    titleFont: SANS,
    bodyFont: SANS,
    titleWeight: 800,
    titleItalic: false,
    photoRadius: 4,
    photoBorder: null,
    photoShadow: "0 12px 30px rgba(0,0,0,0.5)",
    metaTracking: "0.22em",
    textTint: "rgba(245,240,232,0.05)",
    tilt: 0,
  },
};

export const STYLE_LIST = Object.values(STYLES);
