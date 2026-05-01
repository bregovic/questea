"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Building, Tag, Search, Loader2 } from "lucide-react";
import styles from "./page.module.css";
import { motion, AnimatePresence } from "framer-motion";

export default function CodelistsPage() {
  const [payees, setPayees] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#3b82f6");
  const [isAddingCat, setIsAddingCat] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch("/api/payees"),
        fetch("/api/categories")
      ]);
      const pData = await pRes.json();
      const cData = await cRes.json();
      if (Array.isArray(pData)) setPayees(pData);
      if (Array.isArray(cData)) setCategories(cData);
    } catch (err) {
      console.error("Failed to fetch codelists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeletePayee = async (id: string) => {
    if (!confirm("Opravdu smazat tohoto příjemce?")) return;
    try {
      const res = await fetch(`/api/payees?id=${id}`, { method: "DELETE" });
      if (res.ok) setPayees(payees.filter(p => p.id !== id));
    } catch (err) { console.error(err); }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Opravdu smazat tuto kategorii?")) return;
    try {
      const res = await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
      if (res.ok) setCategories(categories.filter(c => c.id !== id));
    } catch (err) { console.error(err); }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName, color: newCatColor })
      });
      if (res.ok) {
        const newCat = await res.json();
        setCategories([...categories, newCat]);
        setNewCatName("");
        setIsAddingCat(false);
      }
    } catch (err) { console.error(err); }
  };

  const filteredPayees = payees.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Číselníky</h1>
          <p className={styles.subtitle}>Spravujte své příjemce a kategorie na jednom místě.</p>
        </div>
        
        <div className={styles.searchBar}>
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Hledat v číselnících..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      {loading ? (
        <div className={styles.loaderBox}>
          <Loader2 className={styles.spin} />
          <span>Načítám číselníky...</span>
        </div>
      ) : (
        <div className={styles.grid}>
          {/* Payees Section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className="flex items-center gap-2">
                <Building size={20} className="text-coral" />
                <h2>Příjemci plateb</h2>
              </div>
              <span className={styles.count}>{payees.length}</span>
            </div>
            
            <div className={styles.list}>
              {filteredPayees.map(p => (
                <div key={p.id} className={styles.item}>
                  <span className={styles.name}>{p.name}</span>
                  <button onClick={() => handleDeletePayee(p.id)} className={styles.deleteBtn}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {filteredPayees.length === 0 && <div className={styles.empty}>Žádní příjemci</div>}
            </div>
          </section>

          {/* Categories Section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className="flex items-center gap-2">
                <Tag size={20} className="text-coral" />
                <h2>Kategorie</h2>
              </div>
              <button 
                onClick={() => setIsAddingCat(!isAddingCat)}
                className={styles.addBtn}
              >
                <Plus size={16} />
              </button>
            </div>

            <AnimatePresence>
              {isAddingCat && (
                <motion.form 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleAddCategory}
                  className={styles.addForm}
                >
                  <input 
                    type="text" 
                    placeholder="Název kategorie..." 
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    autoFocus
                  />
                  <input 
                    type="color" 
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                  />
                  <button type="submit">Uložit</button>
                </motion.form>
              )}
            </AnimatePresence>
            
            <div className={styles.list}>
              {filteredCategories.map(c => (
                <div key={c.id} className={styles.item}>
                  <div className="flex items-center gap-3">
                    <div className={styles.colorDot} style={{ background: c.color }} />
                    <span className={styles.name}>{c.name}</span>
                  </div>
                  <button onClick={() => handleDeleteCategory(c.id)} className={styles.deleteBtn}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {filteredCategories.length === 0 && <div className={styles.empty}>Žádné kategorie</div>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
