"use client";

import React, { useState, useEffect } from "react";
import { User, Mail, Plus, Trash2, HelpCircle, Save, CheckCircle, Sparkles, Smartphone, Download } from "lucide-react";
import { motion } from "framer-motion";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState<any[]>([]);
  const [newAlias, setNewAlias] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    if (data) {
      setName(data.name || "");
      setAliases(data.aliasEmails || []);
    }
    setLoading(false);
  };

  const handleUpdateName = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
  };

  const handleAddAlias = async () => {
    if (!newAlias.trim()) return;
    const res = await fetch("/api/settings/aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newAlias }),
    });
    if (res.ok) {
      const alias = await res.json();
      setAliases([...aliases, alias]);
      setNewAlias("");
    }
  };

  const handleDeleteAlias = async (id: string) => {
    const res = await fetch(`/api/settings/aliases/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAliases(aliases.filter(a => a.id !== id));
    }
  };

  const toggleAi = async (id: string, allowAi: boolean) => {
    const res = await fetch(`/api/settings/aliases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowAi }),
    });
    if (res.ok) {
      setAliases(aliases.map(a => a.id === id ? { ...a, allowAi } : a));
    }
  };

  if (loading) return <div className="p-8 text-center bg-[#fdfaf5] min-h-screen">Načítání nastavení...</div>;

  return (
    <div className="min-h-screen bg-[#fdfaf5] pb-20 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex items-center gap-4 mb-2">
          <div className="p-3 bg-coral/10 rounded-2xl">
            <User className="w-8 h-8 text-coral" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-sand-dark">Nastavení profilu</h1>
            <p className="text-sand-dark/60">Spravujte své jméno, e-mailové aliasy a AI asistenta.</p>
          </div>
        </header>

        {/* User Profile Section */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-sand/30">
          <h2 className="text-xl font-bold text-sand-dark mb-4 flex items-center gap-2">
            <User className="w-5 h-5" /> Uživatelský profil
          </h2>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-sand-dark/60 mb-2">Jméno a příjmení</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full p-4 bg-sand/10 border-none rounded-2xl focus:ring-2 focus:ring-coral text-sand-dark"
                placeholder="Vaše jméno"
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={handleUpdateName}
                disabled={saving}
                className="p-4 bg-coral text-white rounded-2xl hover:bg-coral-dark transition-colors flex items-center gap-2 font-bold disabled:opacity-50"
              >
                <Save className="w-5 h-5" /> {saving ? "Ukládám..." : "Uložit změny"}
              </button>
            </div>
          </div>
        </section>

        {/* E-mail Aliases Section */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-sand/30">
          <h2 className="text-xl font-bold text-sand-dark mb-2 flex items-center gap-2">
            <Mail className="w-5 h-5" /> E-mailové aliasy
          </h2>
          <p className="text-sm text-sand-dark/60 mb-6">
            Z těchto adres můžete přeposílat e-maily a Questea z nich vytvoří úkoly.
          </p>

          <div className="space-y-4 mb-8">
            {aliases.map((alias) => (
              <div key={alias.id} className="flex items-center justify-between p-4 bg-sand/5 rounded-2xl border border-sand/10">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-sand/10 rounded-full">
                    <Mail className="w-4 h-4 text-sand-dark/60" />
                  </div>
                  <div>
                    <span className="font-medium text-sand-dark block">{alias.email}</span>
                    <span className="text-[10px] uppercase font-bold text-green-500 tracking-wider">Ověřeno</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => toggleAi(alias.id, !alias.allowAi)}
                      className={`flex items-center gap-2 p-2 px-3 rounded-full text-xs font-bold transition-all ${
                        alias.allowAi 
                          ? "bg-purple-100 text-purple-600 border border-purple-200" 
                          : "bg-sand/10 text-sand-dark/40 grayscale"
                      }`}
                    >
                      <Sparkles className="w-3 h-3" /> AI {alias.allowAi ? "ON" : "OFF"}
                    </button>
                  </div>
                  <button 
                    onClick={() => handleDeleteAlias(alias.id)}
                    className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            <input 
              type="email" 
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              placeholder="novy-email@pracovni.cz"
              className="flex-1 p-4 bg-sand/5 border border-sand/20 rounded-2xl focus:ring-2 focus:ring-coral text-sand-dark"
            />
            <button 
              onClick={handleAddAlias}
              className="p-4 bg-sand-dark text-white rounded-2xl hover:bg-black transition-colors flex items-center gap-2 px-6"
            >
              <Plus className="w-5 h-5" /> Přidat
            </button>
          </div>
        </section>

        {/* PWA Installation Section */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-sand/30 overflow-hidden relative">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-blue-50 rounded-2xl">
              <Smartphone className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-sand-dark">Instalace do mobilu</h2>
              <p className="text-sm text-sand-dark/60">Používejte Questea jako nativní aplikaci.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-5 bg-sand/5 rounded-2xl border border-sand/10">
              <h3 className="font-bold text-sand-dark mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs shadow-sm">1</span>
                Pro iOS (Safari)
              </h3>
              <ul className="text-sm space-y-2 text-sand-dark/70">
                <li className="flex gap-2">📱 Otevřete v prohlížeči <b>Safari</b></li>
                <li className="flex gap-2">📤 Klikněte na ikonu <b>Sdílet</b> (čtvereček s šipkou)</li>
                <li className="flex gap-2">➕ Vyberte <b>Přidat na plochu</b></li>
              </ul>
            </div>

            <div className="p-5 bg-sand/5 rounded-2xl border border-sand/10">
              <h3 className="font-bold text-sand-dark mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs shadow-sm">2</span>
                Pro Android (Chrome)
              </h3>
              <ul className="text-sm space-y-2 text-sand-dark/70">
                <li className="flex gap-2">🤖 Otevřete v prohlížeči <b>Chrome</b></li>
                <li className="flex gap-2">⋮ Klikněte na <b>tři tečky</b> vpravo nahoře</li>
                <li className="flex gap-2">📥 Vyberte <b>Instalovat aplikaci</b></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-orange-50 rounded-2xl border border-orange-100 flex items-center gap-3">
             <div className="p-2 bg-white rounded-full shadow-sm text-orange-500">
               <Download className="w-4 h-4" />
             </div>
             <p className="text-xs text-orange-800 leading-relaxed font-medium">
                Po instalaci se Questea otevře v celoobrazovkovém režimu bez adresního řádku prohlížeče, stejně jako běžná aplikace z App Store/Google Play.
             </p>
          </div>
        </section>

        {/* Documentation Section */}
        <section className="bg-sand-dark text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
            <HelpCircle className="w-48 h-48" />
          </div>
          
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <HelpCircle className="w-6 h-6 text-coral" /> Jak funguje vytváření úkolů z e-mailu?
            </h2>
            
            <div className="space-y-6 text-sand/80">
              <div>
                <h3 className="text-coral font-bold mb-2 uppercase tracking-widest text-xs">Cílová adresa</h3>
                <code className="block p-3 bg-black/30 rounded-xl text-sand font-mono text-sm break-all">
                  https://questea.up.railway.app/api/webhooks/mail-task
                </code>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-coral font-bold mb-2 uppercase tracking-widest text-xs">Podporované tagy</h3>
                  <ul className="space-y-3">
                    <li className="flex gap-2">
                      <b className="text-white font-mono">&lt;priority&gt;</b> 
                      <span>HIGH, URGENT, LOW</span>
                    </li>
                    <li className="flex gap-2">
                      <b className="text-white font-mono">&lt;deadline&gt;</b> 
                      <span>YYYY-MM-DD</span>
                    </li>
                    <li className="flex gap-2">
                      <b className="text-white font-mono">&lt;category&gt;</b> 
                      <span>Název číselníku</span>
                    </li>
                    <li className="flex gap-2">
                      <b className="text-white font-mono">&lt;ai&gt;</b> 
                      <span>true / false</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-coral font-bold mb-2 uppercase tracking-widest text-xs">Instrukce</h3>
                  <p className="text-sm leading-relaxed">
                    Maily přeposílejte na koncovou adresu webhooku (nebo využijte Google Apps Script). 
                    AI automaticky analyzuje předmět a tělo e-mailu a vytvoří přehledný úkol. 
                    Tagy mají přednost před automatickou analýzou AI.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
