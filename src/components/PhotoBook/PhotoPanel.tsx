"use client";

import React from "react";
import { Maximize, Replace, Type, AlignLeft, Trash2, Expand } from "lucide-react";
import type { PhotoSize } from "@/lib/photobook/compose";

/**
 * Ovládání vybrané fotky.
 *
 * Panel visí vedle fotky, ale mimo stránku – uvnitř by se zmenšil spolu
 * s náhledem a nešel by ovládat. Nabízí to, co jde s fotkou udělat, aniž
 * by se rozbila sazba: velikost se mapuje na varianty, které sazeč umí.
 */
export function PhotoPanel({
  rect,
  size,
  rowStart,
  hasCaption,
  onSize,
  onRowStart,
  onCaption,
  onReplace,
  onRemove,
  onClose,
}: {
  rect: { top: number; left: number; width: number; height: number };
  size: PhotoSize;
  rowStart: boolean;
  hasCaption: boolean;
  onSize: (s: PhotoSize) => void;
  onRowStart: () => void;
  onCaption: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const SIZES: { id: PhotoSize; label: string; title: string }[] = [
    { id: "s", label: "S", title: "Malá – do řádku aspoň po třech" },
    { id: "m", label: "M", title: "Normální – nechá rozhodnout sazeč" },
    { id: "l", label: "L", title: "Větší – v řádku nejvýš dvě" },
    { id: "full", label: "XL", title: "Přes celou šířku" },
    { id: "bleed", label: "∎", title: "Na spad – vlastní stránka přes celou plochu" },
  ];

  return (
    <div
      className="fixed z-[11500] flex items-center gap-1 rounded-xl border border-white/10 bg-stone-900/95 p-1.5 shadow-2xl backdrop-blur"
      style={{ top: Math.max(8, rect.top - 46), left: rect.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex overflow-hidden rounded-lg bg-white/10">
        {SIZES.map((s) => (
          <button
            key={s.id}
            onClick={() => onSize(s.id)}
            title={s.title}
            className={`px-2 py-1 text-xs font-bold ${size === s.id ? "bg-orange-600 text-white" : "text-stone-300 hover:bg-white/10"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Btn onClick={onRowStart} active={rowStart} title="Začít tímhle nový řádek">
        <AlignLeft size={14} />
      </Btn>
      <Btn onClick={onCaption} active={hasCaption} title="Popisek do fotky">
        <Type size={14} />
      </Btn>
      <Btn onClick={onReplace} title="Vyměnit za jinou fotku">
        <Replace size={14} />
      </Btn>
      <Btn onClick={onRemove} title="Vynechat fotku z knihy">
        <Trash2 size={14} />
      </Btn>
      <button onClick={onClose} title="Zavřít" className="px-1.5 text-stone-500 hover:text-white">
        ×
      </button>
    </div>
  );
}

function Btn({
  onClick,
  title,
  active,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-lg p-1.5 ${active ? "bg-orange-600 text-white" : "text-stone-300 hover:bg-white/10"}`}
    >
      {children}
    </button>
  );
}

export { Maximize, Expand };
