"use client";

import React, { useRef } from "react";
import type { BookStyle } from "@/lib/photobook/styles";

export type StickerLook = "plate" | "plain" | "frame";

export type Sticker = {
  id: string;
  text: string;
  /** Pozice v procentech sazebního obrazce stránky. */
  x: number;
  y: number;
  /** Šířka v procentech sazebního obrazce. */
  w: number;
  /** Velikost písma v px při A4. */
  size: number;
  look: StickerLook;
};

/**
 * Nálepka s textem, kterou jde položit kamkoliv po stránce – i přes fotky.
 *
 * Patří příspěvku, ne stránce. Kniha se sází pokaždé znovu, takže nálepka
 * přilepená na souřadnice stránky by po přidání fotky skončila u úplně
 * jiného obsahu. Takhle jede s příspěvkem a drží se svého místa v jeho
 * úvodu. Pozice i šířka jsou v procentech sazebního obrazce, aby přežily
 * i přepnutí formátu z A4 na A5.
 */
export function Sticker({
  sticker,
  style,
  scale,
  editable,
  onChange,
  onRemove,
}: {
  sticker: Sticker;
  style: BookStyle;
  scale: number;
  editable: boolean;
  onChange?: (next: Sticker) => void;
  onRemove?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  /** Táhnutí uvnitř sazebního obrazce; `mode` rozlišuje posun a změnu šířky. */
  const drag = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    if (!editable || !onChange) return;
    e.preventDefault();
    e.stopPropagation();
    const box = ref.current?.parentElement;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, sx: sticker.x, sy: sticker.y, sw: sticker.w };

    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - start.x) / rect.width) * 100;
      const dy = ((ev.clientY - start.y) / rect.height) * 100;
      if (mode === "move") {
        onChange({
          ...sticker,
          x: Math.max(0, Math.min(98 - sticker.w, start.sx + dx)),
          y: Math.max(0, Math.min(97, start.sy + dy)),
        });
      } else {
        onChange({ ...sticker, w: Math.max(10, Math.min(100 - sticker.x, start.sw + dx)) });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const look: React.CSSProperties =
    sticker.look === "plate"
      ? { background: "rgba(0,0,0,0.45)", color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.45)" }
      : sticker.look === "frame"
      ? { background: style.paper, color: style.text, border: `${2 * scale}px solid ${style.accent}` }
      : { color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.6)" };

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: `${sticker.x}%`,
        top: `${sticker.y}%`,
        width: `${sticker.w}%`,
        padding: `${6 * scale}px ${10 * scale}px`,
        borderRadius: 5,
        fontFamily: style.bodyFont,
        fontSize: sticker.size * scale,
        lineHeight: 1.35,
        fontWeight: 600,
        pointerEvents: "auto",
        ...look,
      }}
    >
      {editable && (
        <span
          onPointerDown={drag("move")}
          title="Přetáhnout nálepku"
          style={{ cursor: "grab", opacity: 0.55, marginRight: 5, fontSize: 10 * scale }}
        >
          ⠿
        </span>
      )}
      <span
        contentEditable={editable}
        suppressContentEditableWarning
        onBlur={(e) => onChange?.({ ...sticker, text: e.currentTarget.textContent || "" })}
        style={{ outline: "none", whiteSpace: "pre-wrap" }}
      >
        {sticker.text}
      </span>

      {editable && (
        <>
          <button
            onClick={() =>
              onChange?.({
                ...sticker,
                look: sticker.look === "plate" ? "plain" : sticker.look === "plain" ? "frame" : "plate",
              })
            }
            title="Vzhled nálepky"
            style={btn(scale)}
          >
            ◑
          </button>
          <button
            onClick={() => onChange?.({ ...sticker, size: sticker.size >= 30 ? 11 : sticker.size + 4 })}
            title="Velikost písma"
            style={btn(scale)}
          >
            A
          </button>
          {onRemove && (
            <button onClick={onRemove} title="Odstranit nálepku" style={btn(scale)}>
              ×
            </button>
          )}
          <span
            onPointerDown={drag("resize")}
            title="Změnit šířku"
            style={{
              position: "absolute",
              right: -3,
              bottom: -3,
              width: 12 * scale,
              height: 12 * scale,
              cursor: "ew-resize",
              background: style.accent,
              borderRadius: 3,
              opacity: 0.85,
            }}
          />
        </>
      )}
    </div>
  );
}

const btn = (scale: number): React.CSSProperties => ({
  border: "none",
  background: "none",
  color: "inherit",
  opacity: 0.55,
  cursor: "pointer",
  padding: 0,
  marginLeft: 5,
  fontSize: 11 * scale,
});
