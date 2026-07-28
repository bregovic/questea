"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Search, Navigation, Loader2, Map as MapIcon, Check, ChevronRight } from "lucide-react";
import styles from "./LocationSelectionModal.module.css";

interface LocationSelectionModalProps {
  onClose: () => void;
  onSelect: (location: any) => void;
  initialQuery?: string;
  autoGPS?: boolean;
}

export const LocationSelectionModal: React.FC<LocationSelectionModalProps> = ({ 
  onClose, onSelect, initialQuery, autoGPS = true 
}) => {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialQuery || "");
  const [results, setResults] = useState<any[]>([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Confirmation state
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [note, setNote] = useState("");

  /* Sjednocené zadání místa: k souřadnicím se dá dojít třemi cestami a k místu
     se rovnou nastaví, jak se má chovat (blog/mapa, počasí, čím se tam jelo). */
  const [coordInput, setCoordInput] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [mapOnly, setMapOnly] = useState(false);
  const [isWeatherBase, setIsWeatherBase] = useState(false);
  const [travelMode, setTravelMode] = useState("");

  const derivePlaceName = (p: any) =>
    p?.address?.amenity || p?.address?.shop || p?.address?.tourism ||
    p?.address?.building || p?.address?.road || p?.name || "Místo";

  /* Přijme „48.6243, 14.3051", „48.6243 14.3051" i český zápis s desetinnou
     čárkou „48,6243 14,3051".
     Klíč je rozlišit, co je oddělovač: když je v zápisu mezera, dělí čísla ona
     a všechny čárky jsou desetinné; bez mezery odděluje jediná čárka. */
  const parseCoords = (raw: string): [number, number] | null => {
    const s = raw.trim();
    const parts = /\s/.test(s)
      ? s.replace(/,/g, ".").split(/\s+/)
      : s.split(",");
    const nums = parts.map((p) => parseFloat(p.replace(",", "."))).filter((n) => !isNaN(n));
    return nums.length >= 2 ? [nums[0], nums[1]] : null;
  };

  const useManualCoords = async () => {
    const parsed = parseCoords(coordInput);
    if (!parsed) {
      setError("Zadej souřadnice ve tvaru 48.6243, 14.3051");
      return;
    }
    const [lat, lon] = parsed;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      setError("Souřadnice jsou mimo rozsah.");
      return;
    }
    setError(null);
    setLoading(true);
    let place: any = { lat, lon, display_name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, name: "Místo" };
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
        { headers: { "Accept-Language": "cs" } }
      );
      const rev = await res.json();
      if (rev && !rev.error) place = { ...rev, lat, lon };
    } catch { /* bez adresy to jde taky */ }
    setLoading(false);
    handlePlaceClick(place);
  };

  const searchPlaces = async (query: string) => {
    if (!query || query.length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=15`,
        { headers: { "Accept-Language": "cs" } }
      );
      const data = await res.json();
      setResults(data);
    } catch (err) {
      setError("Chyba při vyhledávání.");
    } finally {
      setLoading(false);
    }
  };

  const getNearbyPlaces = async (lat: number, lon: number) => {
    setLoading(true);
    try {
      // We'll search for 'amenity' (POI) nearby to get a better list than just one reverse geocode
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=amenity&lat=${lat}&lon=${lon}&addressdetails=1&limit=10`,
        { headers: { "Accept-Language": "cs" } }
      );
      const data = await res.json();
      
      // Also get the exact address as top result
      const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`, { 
        headers: { "Accept-Language": "cs" } 
      });
      const revData = await revRes.json();
      
      // Combine results, ensuring exact address is first
      const combined = [revData, ...data.filter((d: any) => d.place_id !== revData.place_id)];
      setResults(combined);
    } catch (err) {
      console.warn("Nearby search failed", err);
    } finally {
      setLoading(false);
    }
  };

  const getGPS = () => {
    setGpsLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError("GPS není podporováno.");
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await getNearbyPlaces(latitude, longitude);
        setGpsLoading(false);
      },
      (err) => {
        console.error("GPS Error:", err);
        let msg = "Nepodařilo se získat polohu.";
        if (err.code === 1) msg = "Povolte prosím GPS v nastavení prohlížeče.";
        if (err.code === 3) msg = "Získání polohy vypršelo.";
        setError(msg);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  useEffect(() => {
    if (initialQuery) {
      searchPlaces(initialQuery);
    } else if (autoGPS) {
      getGPS();
    }
  }, []);

  const handlePlaceClick = (place: any) => {
    setSelectedPlace(place);
    setPlaceName(derivePlaceName(place)); // předvyplní, uživatel může přepsat
  };

  const handleConfirm = () => {
    if (!selectedPlace) return;

    const lat = selectedPlace.lat ? parseFloat(selectedPlace.lat) : selectedPlace.latitude;
    const lon = selectedPlace.lon ? parseFloat(selectedPlace.lon) : selectedPlace.longitude;
    const addr = selectedPlace.display_name || selectedPlace.address;

    onSelect({
      latitude: lat,
      longitude: lon,
      address: addr,
      placeName: placeName.trim() || derivePlaceName(selectedPlace),
      note,
      isGpsLog: mapOnly,
      isWeatherBase,
      travelMode: travelMode || null,
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className={styles.modal} 
        onClick={e => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.iconBox}>
            <MapPin size={20} />
          </div>
          <div>
            <h3>{selectedPlace ? "Doplnit údaje" : "Vybrat místo"}</h3>
            <p>{selectedPlace ? "Přidejte poznámku k místu" : "Zaznamenejte polohu k záznamu"}</p>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={20} />
          </button>
        </header>

        <div className={styles.content}>
          <AnimatePresence mode="wait">
            {!selectedPlace ? (
              <motion.div 
                key="search"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className={styles.searchBar}>
                  <div className={styles.inputGroup}>
                    <Search className={styles.searchIcon} size={18} />
                    <input 
                      type="text" 
                      placeholder="Hledat adresu nebo místo..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchPlaces(searchQuery)}
                    />
                    <button onClick={() => searchPlaces(searchQuery)} className={styles.searchBtn}>Hledat</button>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={getGPS} 
                      disabled={gpsLoading}
                      className={styles.gpsBtn}
                    >
                      {gpsLoading ? <Loader2 className={styles.spin} size={18} /> : <Navigation size={18} />}
                      <span>{gpsLoading ? "Zjišťuji..." : "Moje poloha"}</span>
                    </button>

                    <button 
                      onClick={() => {
                        setGpsLoading(true);
                        navigator.geolocation.getCurrentPosition(
                          async (pos) => {
                            const { latitude, longitude } = pos.coords;
                            onSelect({
                              latitude,
                              longitude,
                              address: "GPS Záznam",
                              placeName: "GPS Log",
                              isGpsLog: true
                            });
                          },
                          (err) => setError("Nepodařilo se získat GPS."),
                          { enableHighAccuracy: true }
                        );
                      }}
                      disabled={gpsLoading}
                      className={`${styles.gpsBtn} ${styles.logOnlyBtn}`}
                    >
                      <MapIcon size={18} />
                      <span>Jen zapsat GPS</span>
                    </button>
                  </div>

                  {/* třetí cesta k souřadnicím: opsat je ručně */}
                  <div className={styles.inputGroup}>
                    <MapPin className={styles.searchIcon} size={18} />
                    <input
                      type="text"
                      placeholder="…nebo GPS souřadnice: 48.6243, 14.3051"
                      value={coordInput}
                      onChange={e => setCoordInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && useManualCoords()}
                    />
                    <button onClick={useManualCoords} className={styles.searchBtn}>Použít</button>
                  </div>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.resultsList}>
                  {loading ? (
                    <div className={styles.loadingState}>
                      <Loader2 className={styles.spin} />
                      <span>Hledám nejlepší místa v okolí...</span>
                    </div>
                  ) : results.length > 0 ? (
                    results.map((r, idx) => (
                      <button 
                        key={r.place_id || idx} 
                        className={styles.resultItem}
                        onClick={() => handlePlaceClick(r)}
                      >
                        <div className={styles.resultIcon}>
                          <MapIcon size={16} />
                        </div>
                        <div className={styles.resultText}>
                          <span className={styles.resultName}>
                            {r.address?.amenity || r.address?.shop || r.address?.tourism || r.address?.building || r.address?.road || r.name || "Neznámé místo"}
                          </span>
                          <span className={styles.resultAddr}>{r.display_name}</span>
                        </div>
                        <ChevronRight className={styles.checkIcon} size={16} />
                      </button>
                    ))
                  ) : !gpsLoading && (
                    <div className={styles.emptyState}>
                      Zatím žádné výsledky. Zkuste vyhledat adresu nebo použít GPS.
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="confirm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={styles.confirmView}
              >
                <div className={styles.selectedPlaceInfo}>
                  <MapPin className="text-coral" size={24} />
                  <div className="min-w-0">
                    <p className="text-sm opacity-60 leading-tight">{selectedPlace.display_name}</p>
                  </div>
                </div>

                <div className="mt-6">
                   <label className="text-xs font-black uppercase tracking-widest opacity-40 block mb-2">Název místa</label>
                   <input
                     type="text"
                     className={styles.noteInput}
                     style={{ minHeight: 0, height: 44 }}
                     value={placeName}
                     onChange={e => setPlaceName(e.target.value)}
                     placeholder="Jak se to místo jmenuje?"
                   />
                </div>

                {/* Parametry místa – co s ním dál. */}
                <div className="mt-6 flex flex-col gap-3">
                  <label className="text-xs font-black uppercase tracking-widest opacity-40">Kde se má objevit</label>
                  <div className="flex gap-2 flex-wrap">
                    <button type="button" onClick={() => setMapOnly(false)}
                      className={`px-3 py-2 rounded-xl border text-sm font-bold transition-colors ${!mapOnly ? 'border-orange-500 text-orange-600 bg-orange-50' : 'border-stone-200 text-stone-500'}`}>
                      V blogu i na mapě
                    </button>
                    <button type="button" onClick={() => setMapOnly(true)}
                      className={`px-3 py-2 rounded-xl border text-sm font-bold transition-colors ${mapOnly ? 'border-orange-500 text-orange-600 bg-orange-50' : 'border-stone-200 text-stone-500'}`}>
                      Jen do mapy
                    </button>
                  </div>

                  <label className="flex items-center gap-2.5 mt-1 cursor-pointer">
                    <input type="checkbox" checked={isWeatherBase} onChange={e => setIsWeatherBase(e.target.checked)} />
                    <span className="text-sm font-bold">Stálá základna pro počasí</span>
                    <span className="text-xs opacity-50">– v hlavičce blogu se u ní pořád ukazuje aktuální počasí</span>
                  </label>

                  <label className="text-xs font-black uppercase tracking-widest opacity-40 mt-2">Jak jsme se sem dostali</label>
                  <select
                    value={travelMode}
                    onChange={e => setTravelMode(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-stone-200 text-sm font-bold bg-white"
                  >
                    <option value="">Rovnou čarou (nekreslit trasu)</option>
                    <option value="CAR">Autem – po silnici</option>
                    <option value="WALK">Pěšky</option>
                    <option value="BIKE">Na kole</option>
                    <option value="BOAT">Lodí – po řece</option>
                  </select>
                </div>

                <div className="mt-6">
                   <label className="text-xs font-black uppercase tracking-widest opacity-40 block mb-2">Poznámka / Deníček</label>
                   <textarea
                     className={styles.noteInput}
                     placeholder="Co se tady dělo? Přidejte detail..."
                     value={note}
                     onChange={e => setNote(e.target.value)}
                   />
                </div>

                <div className={styles.confirmActions}>
                  <button onClick={() => setSelectedPlace(null)} className={styles.backBtn}>Zpět k výběru</button>
                  <button onClick={handleConfirm} className={styles.saveBtn}>
                    <Check size={18} />
                    Uložit místo
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
