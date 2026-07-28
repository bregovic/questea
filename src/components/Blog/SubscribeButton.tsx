"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, X, Loader2 } from "lucide-react";

/**
 * Decentní ikona odběru v hlavičce blogu + dialog na zadání adresy.
 * Slouží zároveň k odhlášení, aby čtenář nemusel hledat starý e-mail.
 */
export function SubscribeButton({ folderId, blogTitle }: { folderId: string; blogTitle: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (action: "subscribe" | "unsubscribe") => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/blog/${folderId}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Nepodařilo se to uložit.");
      setMsg({ ok: true, text: data.message });
      setEmail("");
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Nepodařilo se to uložit." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); setMsg(null); }}
        title="Odebírat nové příspěvky e-mailem"
        className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-colors text-[10px] font-black uppercase tracking-[0.2em]"
      >
        <Mail size={14} />
        Odebírat
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-5"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-3xl bg-white p-8 text-left shadow-2xl"
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute right-5 top-5 text-stone-400 hover:text-stone-700"
                title="Zavřít"
              >
                <X size={20} />
              </button>

              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-600 mb-3">
                Odběr
              </div>
              <h3 className="text-2xl font-black text-stone-900 mb-2 leading-tight">{blogTitle}</h3>
              <p className="text-sm text-stone-500 mb-6 leading-relaxed">
                Když přibude nový příspěvek, pošleme ti ho na e-mail. Odhlásit se můžeš kdykoli
                odkazem v každé zprávě.
              </p>

              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tvuj@email.cz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !busy && email && submit("subscribe")}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 text-base outline-none focus:border-orange-500"
              />

              {msg && (
                <div className={`mt-4 text-sm font-medium ${msg.ok ? "text-green-700" : "text-red-600"}`}>
                  {msg.text}
                </div>
              )}

              <button
                onClick={() => submit("subscribe")}
                disabled={busy || !email}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3.5 font-black text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                Odebírat
              </button>

              <button
                onClick={() => submit("unsubscribe")}
                disabled={busy || !email}
                className="mt-3 w-full text-xs font-bold text-stone-400 hover:text-stone-700 disabled:opacity-40"
              >
                Zrušit odběr pro tuhle adresu
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
