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
  };

  const handleConfirm = () => {
    if (!selectedPlace) return;
    
    const lat = selectedPlace.lat ? parseFloat(selectedPlace.lat) : selectedPlace.latitude;
    const lon = selectedPlace.lon ? parseFloat(selectedPlace.lon) : selectedPlace.longitude;
    const addr = selectedPlace.display_name || selectedPlace.address;
    const name = selectedPlace.address?.amenity || selectedPlace.address?.shop || selectedPlace.address?.tourism || selectedPlace.address?.building || selectedPlace.address?.road || selectedPlace.name || "Místo";

    onSelect({
      latitude: lat,
      longitude: lon,
      address: addr,
      placeName: name,
      note: note
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
                  
                  <button 
                    onClick={getGPS} 
                    disabled={gpsLoading}
                    className={styles.gpsBtn}
                  >
                    {gpsLoading ? <Loader2 className={styles.spin} size={18} /> : <Navigation size={18} />}
                    <span>{gpsLoading ? "Zjišťuji..." : "Moje poloha"}</span>
                  </button>
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
                  <div>
                    <h4 className="font-bold text-lg">
                      {selectedPlace.address?.amenity || selectedPlace.address?.shop || selectedPlace.address?.tourism || selectedPlace.address?.building || selectedPlace.address?.road || selectedPlace.name || "Místo"}
                    </h4>
                    <p className="text-sm opacity-60 leading-tight mt-1">{selectedPlace.display_name}</p>
                  </div>
                </div>

                <div className="mt-8">
                   <label className="text-xs font-black uppercase tracking-widest opacity-40 block mb-2">Poznámka / Deníček</label>
                   <textarea 
                     className={styles.noteInput}
                     placeholder="Co se tady dělo? Přidejte detail..."
                     value={note}
                     onChange={e => setNote(e.target.value)}
                     autoFocus
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
