/**
 * Vykreslení trasy mezi dvěma zaznamenanými body podle způsobu dopravy.
 *
 * Silnice/chodníky řeší veřejné routovací servery (bez klíče; když je v env
 * ORS_API_KEY, použije se přednostně, protože má jasný fair-use limit).
 * Řeku žádný routovací engine neumí, takže si ji stavíme sami: přes Overpass
 * stáhneme vodní toky v okolí úseku, poskládáme z nich graf uzlů a najdeme
 * nejkratší cestu Dijkstrou. Zvládne to i větvení, ramena a rozházené pořadí.
 */

export type TravelMode = "CAR" | "WALK" | "BIKE" | "BOAT" | "DIRECT";

export type LatLng = { lat: number; lng: number };

export type RouteResult = {
  coords: [number, number][]; // [lat, lng]
  distanceKm: number;
  provider: string;
};

const UA = "Questea/1.0 (osobni denik; https://github.com/bregovic/questea)";

/* Řeku hledáme v obálce kolem úseku – u obřího bboxu by Overpass odešel.
   Silniční routing žádný limit nemá, ten dlouhou trasu zvládne jedním dotazem. */
const MAX_RIVER_SPAN_KM = 200;
const MAX_SNAP_KM = 3; // dál než tohle od vody už bod k řece nepatří
/* Linka se posílá do prohlížeče s každým načtením blogu, tak ať není zbytečně
   hustá – 400 bodů je na mapě k nerozeznání od plné geometrie. */
const MAX_POINTS = 400;

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pathLengthKm(coords: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversineKm({ lat: coords[i - 1][0], lng: coords[i - 1][1] }, { lat: coords[i][0], lng: coords[i][1] });
  }
  return d;
}

/* Rovnoměrné prořídnutí – krajní body vždy zůstanou. */
function decimate(coords: [number, number][], max = MAX_POINTS): [number, number][] {
  if (coords.length <= max) return coords;
  const step = Math.ceil(coords.length / max);
  const out = coords.filter((_, i) => i % step === 0);
  const last = coords[coords.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

async function fetchJson(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 20000, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, ...(rest.headers || {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* ─────────────────────────── silnice / chodník / kolo ─────────────────────── */

const OSRM_PROFILE: Record<string, { host: string; profile: string }> = {
  CAR: { host: "routed-car", profile: "driving" },
  WALK: { host: "routed-foot", profile: "foot" },
  BIKE: { host: "routed-bike", profile: "bike" },
};

const ORS_PROFILE: Record<string, string> = {
  CAR: "driving-car",
  WALK: "foot-walking",
  BIKE: "cycling-regular",
};

const VALHALLA_COSTING: Record<string, string> = {
  CAR: "auto",
  WALK: "pedestrian",
  BIKE: "bicycle",
};

async function viaOrs(from: LatLng, to: LatLng, mode: string): Promise<RouteResult | null> {
  const key = process.env.ORS_API_KEY;
  if (!key) return null;
  const json = await fetchJson(`https://api.openrouteservice.org/v2/directions/${ORS_PROFILE[mode]}/geojson`, {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }),
  });
  const line = json?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(line) || line.length < 2) return null;
  const coords = line.map((c: number[]) => [c[1], c[0]] as [number, number]);
  return { coords: decimate(coords), distanceKm: pathLengthKm(coords), provider: "openrouteservice" };
}

async function viaOsrm(from: LatLng, to: LatLng, mode: string): Promise<RouteResult | null> {
  const p = OSRM_PROFILE[mode];
  if (!p) return null;
  const url =
    `https://routing.openstreetmap.de/${p.host}/route/v1/${p.profile}/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}?overview=simplified&geometries=geojson`;
  const json = await fetchJson(url);
  const line = json?.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(line) || line.length < 2) return null;
  const coords = line.map((c: number[]) => [c[1], c[0]] as [number, number]);
  return {
    coords: decimate(coords),
    distanceKm: (json.routes[0].distance ?? 0) / 1000 || pathLengthKm(coords),
    provider: "osrm",
  };
}

/* Valhalla vrací zakódovanou polyline s přesností 1e-6. */
function decodePolyline6(str: string): [number, number][] {
  const out: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < str.length) {
    for (const isLat of [true, false]) {
      let shift = 0, result = 0, byte: number;
      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (isLat) lat += delta; else lng += delta;
    }
    out.push([lat / 1e6, lng / 1e6]);
  }
  return out;
}

async function viaValhalla(from: LatLng, to: LatLng, mode: string): Promise<RouteResult | null> {
  const costing = VALHALLA_COSTING[mode];
  if (!costing) return null;
  const body = {
    locations: [{ lat: from.lat, lon: from.lng }, { lat: to.lat, lon: to.lng }],
    costing,
    directions_options: { units: "kilometers" },
  };
  const json = await fetchJson("https://valhalla1.openstreetmap.de/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const legs = json?.trip?.legs;
  if (!Array.isArray(legs) || !legs.length) return null;
  const coords = legs.flatMap((l: any) => decodePolyline6(l.shape || ""));
  if (coords.length < 2) return null;
  return {
    coords: decimate(coords),
    distanceKm: json.trip.summary?.length ?? pathLengthKm(coords),
    provider: "valhalla",
  };
}

async function routeRoad(from: LatLng, to: LatLng, mode: string): Promise<RouteResult | null> {
  // Pořadí = od nejspolehlivějšího. Když provider spadne, zkusí se další.
  for (const attempt of [viaOrs, viaOsrm, viaValhalla]) {
    try {
      const r = await attempt(from, to, mode);
      if (r) return r;
    } catch (e: any) {
      console.warn(`[routing] ${attempt.name} selhal:`, e?.message || e);
    }
  }
  return null;
}

/* ──────────────────────────────── řeka ──────────────────────────────────── */

type Graph = Map<string, { lat: number; lng: number; edges: { to: string; w: number }[] }>;

const keyOf = (lat: number, lng: number) => `${lat.toFixed(7)},${lng.toFixed(7)}`;

/* Veřejné Overpass instance bývají přetížené a vracejí 504 – projdeme je po řadě. */
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

async function fetchWaterways(from: LatLng, to: LatLng): Promise<any[]> {
  const pad = 0.05; // ~5 km rezerva, ať se chytnou i přítoky u břehu
  const s = Math.min(from.lat, to.lat) - pad;
  const n = Math.max(from.lat, to.lat) + pad;
  const w = Math.min(from.lng, to.lng) - pad;
  const e = Math.max(from.lng, to.lng) + pad;
  const query =
    `[out:json][timeout:25];` +
    `way["waterway"~"^(river|canal)$"](${s},${w},${n},${e});` +
    `out geom;`;

  // krátký timeout na mirror: přetížená instance ať nedrží celý přepočet
  let lastErr: any = null;
  for (const host of OVERPASS_MIRRORS) {
    try {
      const json = await fetchJson(host, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        timeoutMs: 28000,
      });
      return json?.elements || [];
    } catch (e: any) {
      lastErr = e;
      console.warn(`[routing] Overpass ${host} selhal:`, e?.message || e);
    }
  }
  throw lastErr || new Error("Overpass nedostupný");
}

function buildGraph(ways: any[]): Graph {
  const g: Graph = new Map();
  const node = (lat: number, lng: number) => {
    const k = keyOf(lat, lng);
    let nd = g.get(k);
    if (!nd) { nd = { lat, lng, edges: [] }; g.set(k, nd); }
    return { k, nd };
  };
  for (const way of ways) {
    const geo = way.geometry;
    if (!Array.isArray(geo) || geo.length < 2) continue;
    for (let i = 1; i < geo.length; i++) {
      const a = node(geo[i - 1].lat, geo[i - 1].lon);
      const b = node(geo[i].lat, geo[i].lon);
      if (a.k === b.k) continue;
      const w = haversineKm({ lat: a.nd.lat, lng: a.nd.lng }, { lat: b.nd.lat, lng: b.nd.lng });
      // obousměrně: po řece se dá jet i proti proudu
      a.nd.edges.push({ to: b.k, w });
      b.nd.edges.push({ to: a.k, w });
    }
  }
  return g;
}

function nearestNode(g: Graph, p: LatLng): { key: string; distKm: number } | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const [k, nd] of g) {
    const d = haversineKm(p, { lat: nd.lat, lng: nd.lng });
    if (d < bestD) { bestD = d; best = k; }
  }
  return best ? { key: best, distKm: bestD } : null;
}

/* Binární halda – graf řeky mívá desetitisíce uzlů, lineární fronta by brzdila. */
class MinHeap {
  private a: { k: string; d: number }[] = [];
  get size() { return this.a.length; }
  push(item: { k: string; d: number }) {
    this.a.push(item);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p].d <= this.a[i].d) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }
  pop() {
    const top = this.a[0];
    const last = this.a.pop()!;
    if (this.a.length) {
      this.a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.a.length && this.a[l].d < this.a[m].d) m = l;
        if (r < this.a.length && this.a[r].d < this.a[m].d) m = r;
        if (m === i) break;
        [this.a[m], this.a[i]] = [this.a[i], this.a[m]];
        i = m;
      }
    }
    return top;
  }
}

function dijkstra(g: Graph, startKey: string, goalKey: string): string[] | null {
  const dist = new Map<string, number>([[startKey, 0]]);
  const prev = new Map<string, string>();
  const done = new Set<string>();
  const heap = new MinHeap();
  heap.push({ k: startKey, d: 0 });

  while (heap.size) {
    const cur = heap.pop();
    if (done.has(cur.k)) continue;
    done.add(cur.k);
    if (cur.k === goalKey) break;
    const nd = g.get(cur.k);
    if (!nd) continue;
    for (const e of nd.edges) {
      if (done.has(e.to)) continue;
      const alt = cur.d + e.w;
      if (alt < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, alt);
        prev.set(e.to, cur.k);
        heap.push({ k: e.to, d: alt });
      }
    }
  }

  if (!done.has(goalKey)) return null; // řeka je v datech přetržená (typicky přehrada)
  const path: string[] = [];
  for (let k: string | undefined = goalKey; k; k = prev.get(k)) path.push(k);
  return path.reverse();
}

async function routeRiver(from: LatLng, to: LatLng): Promise<RouteResult | null> {
  if (haversineKm(from, to) > MAX_RIVER_SPAN_KM) {
    console.warn("[routing] úsek po vodě je moc dlouhý na Overpass, nechávám rovně");
    return null;
  }
  const ways = await fetchWaterways(from, to);
  if (!ways.length) return null;

  const g = buildGraph(ways);
  const a = nearestNode(g, from);
  const b = nearestNode(g, to);
  if (!a || !b || a.distKm > MAX_SNAP_KM || b.distKm > MAX_SNAP_KM) return null;
  if (a.key === b.key) return null;

  const path = dijkstra(g, a.key, b.key);
  if (!path || path.length < 2) return null;

  // krajní body přilepíme, ať linka opravdu končí u značek na mapě
  const coords: [number, number][] = [
    [from.lat, from.lng],
    ...path.map((k) => { const nd = g.get(k)!; return [nd.lat, nd.lng] as [number, number]; }),
    [to.lat, to.lng],
  ];
  return { coords: decimate(coords), distanceKm: pathLengthKm(coords), provider: "overpass+dijkstra" };
}

/* ──────────────────────────────── veřejné API ───────────────────────────── */

export function routeStampOf(from: LatLng, to: LatLng, mode: string): string {
  const r = (n: number) => n.toFixed(5);
  return `${r(from.lat)},${r(from.lng)}>${r(to.lat)},${r(to.lng)}:${mode}`;
}

/** Vrátí linku úseku, nebo null když se routovat nedá (volající pak spojí rovně). */
export async function computeSegment(from: LatLng, to: LatLng, mode: TravelMode): Promise<RouteResult | null> {
  if (mode === "DIRECT") return null;
  try {
    if (mode === "BOAT") return await routeRiver(from, to);
    return await routeRoad(from, to, mode);
  } catch (e: any) {
    console.warn("[routing] segment selhal:", e?.message || e);
    return null;
  }
}
