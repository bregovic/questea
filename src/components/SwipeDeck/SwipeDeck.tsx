"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Check, X, Repeat, Clock, CheckCircle2 } from "lucide-react";
import { recurrenceLabel, parseDays } from "@/lib/recurrence";

type SwipeTask = {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: string;
  taskType?: string;
  recurrenceType?: string | null;
  recurrenceDay?: number | null;
  recurrenceDays?: string | null;
  recurrenceTime?: string | null;
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function isOverdue(iso?: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function SwipeDeck({ initialTasks }: { initialTasks: SwipeTask[] }) {
  const [queue, setQueue] = useState<SwipeTask[]>(initialTasks);
  const [pending, setPending] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-12, 12]);
  const doneOpacity = useTransform(x, [40, 140], [0, 1]);
  const skipOpacity = useTransform(x, [-140, -40], [1, 0]);

  const item = queue[0];
  const next = queue[1];

  async function completeOnServer(t: SwipeTask) {
    try {
      await fetch(`/api/tasks/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      });
    } catch {
      /* ignore – karta i tak zmizí, případně se objeví po refreshi */
    }
  }

  async function fly(dir: "done" | "skip") {
    if (!item || pending) return;
    setPending(true);
    await animate(x, dir === "done" ? 520 : -520, { duration: 0.22 });
    if (dir === "done") {
      await completeOnServer(item);
      setDoneCount((c) => c + 1);
    }
    setQueue((q) => q.slice(1));
    x.set(0);
    setPending(false);
  }

  function handleDragEnd(
    _e: unknown,
    info: { offset: { x: number; y: number }; velocity: { x: number; y: number } },
  ) {
    const { offset, velocity } = info;
    if (offset.x > 120 || velocity.x > 700) fly("done");
    else if (offset.x < -120 || velocity.x < -700) fly("skip");
    else animate(x, 0, { type: "spring", stiffness: 300, damping: 25 });
  }

  if (!item) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <CheckCircle2 className="mb-4 text-emerald-500" size={56} />
        <h2 className="text-2xl font-bold text-stone-800">Vše odbaveno 🎉</h2>
        <p className="mt-2 text-stone-500">
          {doneCount > 0
            ? `Dokončeno ${doneCount} úkolů. Nic dalšího k odbavení.`
            : "Žádné úkoly k odbavení pro dnešek."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md select-none px-4 py-6">
      <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-stone-400">
        {queue.length} k odbavení
      </p>

      <div className="relative h-[24rem]">
        {next && (
          <div className="absolute inset-x-3 top-3 h-full scale-[0.97] rounded-3xl bg-white opacity-60 shadow ring-1 ring-stone-200" />
        )}

        <motion.div
          key={item.id}
          drag="x"
          dragDirectionLock
          dragMomentum={false}
          style={{ x, rotate }}
          onDragEnd={handleDragEnd}
          whileTap={{ cursor: "grabbing" }}
          className="absolute inset-0 flex cursor-grab flex-col rounded-3xl bg-white p-6 shadow-xl ring-1 ring-stone-200"
        >
          {/* overlaye směru */}
          <motion.div
            style={{ opacity: doneOpacity }}
            className="pointer-events-none absolute left-5 top-5 rotate-[-10deg] rounded-lg border-2 border-emerald-500 px-3 py-1 text-lg font-black text-emerald-600"
          >
            HOTOVO
          </motion.div>
          <motion.div
            style={{ opacity: skipOpacity }}
            className="pointer-events-none absolute right-5 top-5 rotate-[10deg] rounded-lg border-2 border-stone-400 px-3 py-1 text-lg font-black text-stone-500"
          >
            PŘESKOČIT
          </motion.div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            {item.recurrenceType && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <Repeat size={12} />
                {recurrenceLabel({
                  type: item.recurrenceType ?? null,
                  day: item.recurrenceDay ?? null,
                  days: parseDays(item.recurrenceDays),
                  time: item.recurrenceTime ?? null,
                })}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                isOverdue(item.dueDate)
                  ? "bg-red-100 text-red-700"
                  : "bg-stone-100 text-stone-600"
              }`}
            >
              <Clock size={12} />
              {item.dueDate ? fmtDate(item.dueDate) : "bez termínu"}
              {isOverdue(item.dueDate) ? " · po termínu" : ""}
            </span>
          </div>

          <h2 className="text-3xl font-black leading-tight text-stone-900">
            {item.title}
          </h2>
          {item.description && (
            <p className="mt-3 line-clamp-4 text-stone-500">{item.description}</p>
          )}

          <div className="mt-auto pt-4 text-center text-xs text-stone-400">
            Táhni doprava = hotovo · doleva = přeskočit
          </div>
        </motion.div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          onClick={() => fly("skip")}
          disabled={pending}
          className="flex items-center justify-center gap-2 rounded-2xl bg-stone-200 py-4 text-sm font-bold text-stone-600 transition hover:bg-stone-300 disabled:opacity-50"
        >
          <X size={18} /> Přeskočit
        </button>
        <button
          onClick={() => fly("done")}
          disabled={pending}
          className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          <Check size={18} /> Hotovo
        </button>
      </div>
    </div>
  );
}
