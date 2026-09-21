"use client";

import React, { useRef } from "react";
import type { BookStyle } from "@/lib/photobook/styles";

export type Caption = { text: string; x: number; y: number };

/**
 * Popisek položený přes fotku.
 *
 * Aby byl čitelný na světlé i tmavé fotce, nespoléhá na barvu písma, ale
 * leží na vlastním tmavém podkladu – to funguje vždycky, na rozdíl od
 * bílého textu, který na obloze zmizí.
 *
 * Umístění se ukládá v procentech plochy fotky, ne v pixelech, takže
 * popisek drží své místo i když se fotka na jiné stránce vysází jinak velká.
 * Táhne se za úchyt, text se upravuje kliknutím do něj – jinak by se
 * psaní a posouvání pralo o stejné gesto.
 */
export function PhotoCaption({
  caption,
  style,
  scale,
  editable,
  onChange,
  onRemove,
}: {
  caption: Caption;
  style: BookStyle;
  scale: number;
  editable: boolean;
  onChange?: (next: Caption) => void;
  onRemove?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const startDrag = (e: React.PointerEvent) => {
    if (!editable || !onChange) return;
    e.preventDefault();
    e.stopPropagation();
    const cell = ref.current?.parentElement;
    if (!cell) return;
    const rect = cell.getBoundingClientRect();

    const move = (ev: PointerEvent) => {
      const x = ((ev.clientX - rect.left) / rect.width) * 100;
      const y = ((ev.clientY - rect.top) / rect.height) * 100;
      onChange({
        ...caption,
        x: Math.max(2, Math.min(92, x)),
        y: Math.max(2, Math.min(92, y)),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: `${caption.x}%`,
        top: `${caption.y}%`,
        maxWidth: "70%",
        display: "flex",
        alignItems: "flex-start",
        gap: 4,
        padding: `${5 * scale}px ${9 * scale}px`,
        borderRadius: 4,
        background: "rgba(0,0,0,0.42)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        color: "#fff",
        fontFamily: style.bodyFont,
        fontSize: 11 * scale,
        lineHeight: 1.35,
        fontWeight: 600,
        letterSpacing: "0.01em",
        textShadow: "0 1px 2px rgba(0,0,0,0.45)",
      }}
    >
      {editable && (
        <span
          onPointerDown={startDrag}
          title="Přetáhnout popisek"
          style={{ cursor: "grab", opacity: 0.6, fontSize: 10 * scale, lineHeight: `${14 * scale}px` }}
        >
          ⠿
        </span>
      )}
      <span
        contentEditable={editable}
        suppressContentEditableWarning
        onBlur={(e) => onChange?.({ ...caption, text: e.currentTarget.textContent || "" })}
        style={{ outline: "none", whiteSpace: "pre-wrap" }}
      >
        {caption.text}
      </span>
      {editable && onRemove && (
        <button
          onClick={onRemove}
          title="Odstranit popisek"
          style={{
            border: "none",
            background: "none",
            color: "#fff",
            opacity: 0.6,
            cursor: "pointer",
            padding: 0,
            fontSize: 11 * scale,
            lineHeight: `${14 * scale}px`,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
