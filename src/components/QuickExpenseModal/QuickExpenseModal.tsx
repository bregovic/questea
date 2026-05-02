"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Save, Wallet, Tag, Building, CreditCard } from "lucide-react";
import styles from "./QuickExpenseModal.module.css";

interface QuickExpenseModalProps {
  task: any;
  categories: any[];
  onClose: () => void;
  onSave: (data: any) => void;
}

export const QuickExpenseModal: React.FC<QuickExpenseModalProps> = ({ task, categories, onClose, onSave }) => {
  const [amount, setAmount] = useState(task.amount || "");
  const [currency, setCurrency] = useState(task.currency || "CZK");
  const [categoryId, setCategoryId] = useState(task.categoryId || "");
  const [categorySearch, setCategorySearch] = useState("");
  const [showCatSuggestions, setShowCatSuggestions] = useState(false);
  const [payee, setPayee] = useState(task.payee || "");
  const [title, setTitle] = useState(task.title || "");

  useEffect(() => {
    // Load last used currency
    const lastCurrency = localStorage.getItem("lastCurrency");
    if (lastCurrency && !task.currency) {
      setCurrency(lastCurrency);
    }
  }, [task.currency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("lastCurrency", currency);
    onSave({
      amount: parseFloat(amount as string),
      currency,
      categoryId: categoryId || null,
      categoryName: categoryId ? null : categorySearch, // Pass name if no ID selected
      payee,
      title
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
            <CreditCard size={20} />
          </div>
          <div>
            <h3>Zaznamenat náklad</h3>
            <p>Rychlé zadání výdaje k úkolu</p>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label><Wallet size={14} /> Částka a měna</label>
            <div className={styles.amountRow}>
              <input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={amount}
                onChange={e => setAmount(e.target.value)}
                autoFocus
                required
              />
              <select value={currency} onChange={e => setCurrency(e.target.value)}>
                <option value="CZK">CZK</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label><Tag size={14} /> Kategorie</label>
            <div className={styles.categorySearch}>
              <input 
                type="text" 
                placeholder="Hledat nebo vytvořit kategorii..." 
                value={categorySearch}
                onChange={e => {
                  setCategorySearch(e.target.value);
                  setShowCatSuggestions(true);
                }}
                onFocus={() => setShowCatSuggestions(true)}
                onBlur={() => setTimeout(() => setShowCatSuggestions(false), 200)}
              />
              {showCatSuggestions && (
                <div className={styles.suggestions}>
                  {Array.from(new Set(categories.map(c => c.name.toLowerCase())))
                    .map(name => categories.find(c => c.name.toLowerCase() === name))
                    .filter(c => c && c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                    .map(c => c && (
                      <div 
                        key={c.id} 
                        className={styles.suggestionItem}
                        onClick={() => {
                          setCategorySearch(c.name);
                          setCategoryId(c.id);
                          setShowCatSuggestions(false);
                        }}
                      >
                        <div className={styles.colorDot} style={{ background: c.color }} />
                        {c.name}
                      </div>
                    ))
                  }
                  {categorySearch && !categories.some(c => c.name.toLowerCase() === categorySearch.toLowerCase()) && (
                    <div 
                      className={`${styles.suggestionItem} ${styles.newCat}`}
                      onClick={() => setShowCatSuggestions(false)}
                    >
                      Vytvořit novou: <strong>{categorySearch}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label><Building size={14} /> Dodavatel / Komu</label>
            <input 
              type="text" 
              placeholder="Např. Shell, Restaurace..." 
              value={payee}
              onChange={e => setPayee(e.target.value)}
            />
          </div>

          <div className={styles.inputGroup}>
            <label>Název položky</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <footer className={styles.footer}>
            <button type="button" onClick={onClose} className={styles.cancelBtn}>Zrušit</button>
            <button type="submit" className={styles.saveBtn}>
              <Save size={18} />
              Uložit výdaj
            </button>
          </footer>
        </form>
      </motion.div>
    </div>
  );
};
