"use client";

import React, { useState, useEffect } from "react";
import { MapPin, Camera, Save, Loader2, Clock, Navigation } from "lucide-react";
import styles from "./LocationTracker.module.css";
import { motion, AnimatePresence } from "framer-motion";

export const LocationTracker = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  
  const [currentLoc, setCurrentLoc] = useState<{
    lat: number;
    lng: number;
    address: string;
    placeName: string;
  } | null>(null);
  
  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [mileage, setMileage] = useState("");

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      if (Array.isArray(data)) setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history");
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const getGPS = () => {
    setLoading(true);
    setError(null);
    setCurrentLoc(null);

    if (!navigator.geolocation) {
      setError("Geolokace není podporována vaším prohlížečem.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Reverse Geocoding via Nominatim (OSM)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            { headers: { "Accept-Language": "cs" } }
          );
          const data = await res.json();
          
          setCurrentLoc({
            lat: latitude,
            lng: longitude,
            address: data.display_name,
            placeName: data.address.amenity || data.address.shop || data.address.building || data.address.road,
          });
        } catch (err) {
          setCurrentLoc({
            lat: latitude,
            lng: longitude,
            address: `${latitude}, ${longitude}`,
            placeName: "Neznámé místo",
          });
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError("Nepodařilo se získat polohu. Povolte prosím GPS.");
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSave = async () => {
    if (!currentLoc) return;
    setSaving(true);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: currentLoc.lat,
          longitude: currentLoc.lng,
          address: currentLoc.address,
          placeName: currentLoc.placeName,
          note,
          photoUrl,
          mileage: mileage ? parseFloat(mileage) : null
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        setHistory([saved, ...history]);
        setCurrentLoc(null);
        setNote("");
        setPhotoUrl("");
        setMileage("");
      }
    } catch (err) {
      setError("Chyba při ukládání.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <Navigation className="text-coral" size={28} />
          <h1>Aktuální poloha</h1>
        </div>
        <p className={styles.subtitle}>Zaznamenejte, kde se právě nacházíte.</p>
      </header>

      <main className={styles.main}>
        <section className={styles.trackerCard}>
          {!currentLoc ? (
            <button 
              onClick={getGPS} 
              disabled={loading}
              className={styles.gpsBtn}
            >
              {loading ? <Loader2 className={styles.spin} /> : <MapPin size={24} />}
              <span>{loading ? "Zaměřuji polohu..." : "Zjistit mou polohu"}</span>
            </button>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className={styles.details}
            >
              <div className={styles.placeHeader}>
                <div className={styles.placeInfo}>
                  <h3>{currentLoc.placeName || "Nalezená poloha"}</h3>
                  <p>{currentLoc.address}</p>
                  <small className="opacity-40">{currentLoc.lat.toFixed(6)}, {currentLoc.lng.toFixed(6)}</small>
                </div>
                <button onClick={() => setCurrentLoc(null)} className={styles.cancelBtn}>Změnit</button>
              </div>

              <div className={styles.inputs}>
                <div className={styles.inputGroup}>
                  <label>Komentář</label>
                  <textarea 
                    placeholder="Co tu děláte? Poznámka k místu..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                
                <div className={styles.inputGroup}>
                  <label>Kilometry (Tachometr / Vzdálenost)</label>
                  <div className={styles.mileageInputRow}>
                    <Navigation size={18} />
                    <input 
                      type="number" 
                      placeholder="Např. 12450"
                      value={mileage}
                      onChange={(e) => setMileage(e.target.value)}
                    />
                    <span>km</span>
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label>URL Fotografie</label>
                  <div className={styles.photoInputRow}>
                    <Camera size={18} />
                    <input 
                      type="text" 
                      placeholder="https://..."
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleSave} 
                disabled={saving}
                className={styles.saveBtn}
              >
                {saving ? <Loader2 className={styles.spin} size={18} /> : <Save size={18} />}
                Uložit záznam
              </button>
            </motion.div>
          )}
          {error && <div className={styles.error}>{error}</div>}
        </section>

        <section className={styles.history}>
          <div className={styles.sectionHeader}>
            <Clock size={18} />
            <h2>Historie návštěv a cest</h2>
            {history.length > 0 && history[0].mileage && (
              <div className={styles.totalBadge}>
                Aktuální stav: <strong>{history[0].mileage} km</strong>
              </div>
            )}
          </div>
          
          <div className={styles.historyList}>
            {history.map((loc) => (
              <div key={loc.id} className={styles.historyItem}>
                <div className={styles.historyMeta}>
                  <span className={styles.date}>
                    {new Date(loc.createdAt).toLocaleDateString("cs-CZ")}
                  </span>
                  <span className={styles.time}>
                    {new Date(loc.createdAt).toLocaleTimeString("cs-CZ", { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={styles.historyContent}>
                  <div className={styles.itemHeader}>
                    <h4>{loc.placeName || "Bezejmenné místo"}</h4>
                    {loc.mileage && <span className={styles.mileageLabel}>{loc.mileage} km</span>}
                  </div>
                  <p className={styles.addr}>{loc.address}</p>
                  {loc.note && <p className={styles.note}>{loc.note}</p>}
                  {loc.photoUrl && (
                    <img src={loc.photoUrl} alt="Location" className={styles.historyPhoto} />
                  )}
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <div className={styles.emptyHistory}>Zatím žádné záznamy polohy.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
