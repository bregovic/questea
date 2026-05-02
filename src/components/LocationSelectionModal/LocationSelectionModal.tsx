"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Search, Navigation, Loader2, Save, Map as MapIcon, Check } from "lucide-react";
import styles from "./LocationSelectionModal.module.css";

interface LocationSelectionModalProps {
  onClose: () => void;
  onSelect: (location: any) => void;
  initialQuery?: string;
}

export const LocationSelectionModal: React.FC<LocationSelectionModalProps> = ({ onClose, onSelect, initialQuery }) => {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialQuery || "");
  const [results, setResults] = useState<any[]>([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchPlaces = async (query: string) => {
    if (!query || query.length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=10`,
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
        try {
          // 1. Get the main address
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            { headers: { "Accept-Language": "cs" } }
          );
          const mainPlace = await res.json();
          
          // 2. Also search for nearby POIs to give more options
          const nearbyRes = await fetch(
             `https://nominatim.openstreetmap.org/search?format=json&q=point+of+interest&lat=${latitude}&lon=${longitude}&addressdetails=1&limit=8`,
             { headers: { "Accept-Language": "cs" } }
          );
          const nearbyData = await nearbyRes.json();
          
          const combined = [mainPlace, ...nearbyData.filter((p: any) => p.place_id !== mainPlace.place_id)];
          setResults(combined);
          setSearchQuery(mainPlace.display_name);
        } catch (err) {
          setError("Chyba při získávání adresy.");
        } finally {
          setGpsLoading(false);
        }
      },
      () => {
        setError("Přístup k GPS byl zamítnut.");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if (initialQuery) {
      searchPlaces(initialQuery);
    } else {
      getGPS();
    }
  }, []);

  const handleSelect = (place: any) => {
    const address = place.display_name;
    const name = place.address.amenity || place.address.shop || place.address.tourism || place.address.building || place.address.road || place.name || "Místo";
    
    onSelect({
      latitude: parseFloat(place.lat),
      longitude: parseFloat(place.lon),
      address: address,
      placeName: name,
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
            <h3>Vybrat místo</h3>
            <p>Zaznamenejte polohu k záznamu</p>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={20} />
          </button>
        </header>

        <div className={styles.content}>
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
              <span>Použít GPS</span>
            </button>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.resultsList}>
            {loading ? (
              <div className={styles.loadingState}>
                <Loader2 className={styles.spin} />
                <span>Vyhledávám místa...</span>
              </div>
            ) : results.length > 0 ? (
              results.map((r, idx) => (
                <button 
                  key={r.place_id || idx} 
                  className={styles.resultItem}
                  onClick={() => handleSelect(r)}
                >
                  <div className={styles.resultIcon}>
                    <MapIcon size={16} />
                  </div>
                  <div className={styles.resultText}>
                    <span className={styles.resultName}>
                      {r.address.amenity || r.address.shop || r.address.tourism || r.address.building || r.address.road || r.name}
                    </span>
                    <span className={styles.resultAddr}>{r.display_name}</span>
                  </div>
                  <Check className={styles.checkIcon} size={16} />
                </button>
              ))
            ) : !gpsLoading && (
              <div className={styles.emptyState}>
                Zatím žádné výsledky. Zkuste vyhledat adresu nebo použít GPS.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
