"use client";

import { useEffect, useState } from "react";
import { Layers, X } from "lucide-react";

type Coll = { collectionId: string; title: string; slug?: string | null };

export function CollectionPicker({
  postId,
  candidates,
}: {
  postId: string;
  candidates: { id: string; title: string }[];
}) {
  const [items, setItems] = useState<Coll[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`/api/collections?postId=${postId}`);
      if (res.ok) setItems(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const add = async (collectionId: string) => {
    if (!collectionId || busy) return;
    setBusy(true);
    try {
      await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId, postId }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (collectionId: string) => {
    setBusy(true);
    try {
      await fetch("/api/collections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId, postId }),
      });
      setItems((prev) => prev.filter((i) => i.collectionId !== collectionId));
    } finally {
      setBusy(false);
    }
  };

  const inIds = new Set(items.map((i) => i.collectionId));
  const available = candidates.filter((c) => !inIds.has(c.id));

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
        <Layers size={12} /> Kolekce (samostatné blogy)
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {items.map((i) => (
            <span
              key={i.collectionId}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-xs text-stone-700"
            >
              {i.title || "Bez názvu"}
              <button
                type="button"
                onClick={() => remove(i.collectionId)}
                className="text-stone-400 hover:text-red-600 disabled:opacity-40"
                disabled={busy}
                title="Odebrat z kolekce"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      {available.length > 0 ? (
        <select
          value=""
          disabled={busy}
          onChange={(e) => add(e.target.value)}
          className="text-xs border border-stone-200 rounded-md px-2 h-7 bg-white text-stone-600"
        >
          <option value="">+ Přidat do kolekce…</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title || "Bez názvu"}
            </option>
          ))}
        </select>
      ) : (
        !loading &&
        items.length === 0 && (
          <span className="text-xs text-stone-400">
            Zatím nemáš žádný blog/složku k přidání.
          </span>
        )
      )}
    </div>
  );
}
