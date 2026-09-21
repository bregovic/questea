"use client";

import React from "react";
import type { Block, Geometry, Page } from "@/lib/photobook/compose";
import { TYPE, textWidthFor } from "@/lib/photobook/compose";
import type { BookStyle } from "@/lib/photobook/styles";

/**
 * Vykreslení jedné vysázené stránky. Rozměry chodí ze sazeče v pixelech,
 * takže náhled v editoru i skrytý kontejner pro export do PDF vypadají stejně.
 */

export function BookPageView({
  page,
  index,
  geo,
  style,
  urlOf,
  editable = false,
  onEditText,
  onEditTitle,
  onCycleLayout,
  onRemovePost,
  onRemovePhoto,
  onCyclePhotoSize,
}: {
  page: Page;
  index: number;
  geo: Geometry;
  style: BookStyle;
  urlOf: (id: string) => string;
  editable?: boolean;
  onEditText?: (postId: string, chunkIdx: number, value: string) => void;
  onEditTitle?: (postId: string, value: string) => void;
  onCycleLayout?: (postId: string, chunkIdx: number) => void;
  onRemovePost?: (postId: string) => void;
  onRemovePhoto?: (id: string) => void;
  onCyclePhotoSize?: (id: string) => void;
}) {
  /* Kniha se čte po dvoustranách: první stránka za obálkou je pravá, pak se
     střídají. Vnitřní (širší) okraj musí být vždy u hřbetu. */
  const rightHand = index % 2 === 0;

  return (
    <div
      className="print-page"
      style={{
        width: geo.pageW,
        height: geo.pageH,
        background: style.paper,
        color: style.text,
        position: "relative",
        overflow: "hidden",
        fontFamily: style.bodyFont,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: geo.padTop,
          bottom: geo.padBottom,
          left: rightHand ? geo.padInner : geo.padOuter,
          right: rightHand ? geo.padOuter : geo.padInner,
          display: "flex",
          flexDirection: "column",
          gap: geo.gap,
        }}
      >
        {page.blocks.map((b, i) => (
          <BlockView
            key={i}
            block={b}
            geo={geo}
            style={style}
            urlOf={urlOf}
            editable={editable}
            onEditText={onEditText}
            onEditTitle={onEditTitle}
            onCycleLayout={onCycleLayout}
            onRemovePost={onRemovePost}
            onRemovePhoto={onRemovePhoto}
            onCyclePhotoSize={onCyclePhotoSize}
          />
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: Math.round(geo.padBottom * 0.38),
          left: rightHand ? geo.padInner : geo.padOuter,
          right: rightHand ? geo.padOuter : geo.padInner,
          textAlign: rightHand ? "right" : "left",
          fontSize: 9 * geo.scale,
          fontWeight: 700,
          letterSpacing: "0.2em",
          color: style.muted,
        }}
      >
        {index + 1}
      </div>
    </div>
  );
}

function BlockView({
  block,
  geo,
  style,
  urlOf,
  editable,
  onEditText,
  onEditTitle,
  onCycleLayout,
  onRemovePost,
  onRemovePhoto,
  onCyclePhotoSize,
}: {
  block: Block;
  geo: Geometry;
  style: BookStyle;
  urlOf: (id: string) => string;
  editable: boolean;
  onEditText?: (postId: string, chunkIdx: number, value: string) => void;
  onEditTitle?: (postId: string, value: string) => void;
  onCycleLayout?: (postId: string, chunkIdx: number) => void;
  onRemovePost?: (postId: string) => void;
  onRemovePhoto?: (id: string) => void;
  onCyclePhotoSize?: (id: string) => void;
}) {
  if (block.kind === "heading") {
    return (
      <div style={{ position: "relative" }}>
        {editable && (
          <div style={{ position: "absolute", top: -2, right: -2, display: "flex", gap: 4 }}>
            {onRemovePost && (
              <button
                onClick={() => onRemovePost(block.postId)}
                title="Vynechat celý příspěvek z knihy"
                style={HEAD_BTN}
              >
                ⌫
              </button>
            )}
            {onEditTitle && block.title && (
              <button onClick={() => onEditTitle(block.postId, "")} title="Odstranit nadpis" style={HEAD_BTN}>
                ×
              </button>
            )}
          </div>
        )}
        {block.meta && (
          <div
            style={{
              fontSize: TYPE.meta.size * geo.scale,
              lineHeight: TYPE.meta.line,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: style.metaTracking,
              color: style.accent,
              marginBottom: TYPE.meta.gapAfter * geo.scale * 0.4,
            }}
          >
            {block.meta}
          </div>
        )}
        {(block.title || editable) && (
          <div
            contentEditable={editable && !!onEditTitle}
            suppressContentEditableWarning
            data-placeholder="Nadpis"
            onBlur={(e) => onEditTitle?.(block.postId, e.currentTarget.textContent || "")}
            style={{
              outline: "none",
              minHeight: editable ? TYPE.title.size * geo.scale : undefined,
              fontFamily: style.titleFont,
              fontSize: TYPE.title.size * geo.scale,
              lineHeight: TYPE.title.line,
              fontWeight: style.titleWeight,
              fontStyle: style.titleItalic ? "italic" : "normal",
              letterSpacing: "-0.015em",
            }}
          >
            {block.title}
          </div>
        )}
      </div>
    );
  }

  if (block.kind === "text") {
    const t = block.lead ? TYPE.lead : TYPE.body;
    const width = textWidthFor(block.layout, geo);

    const body = (
      <div
        contentEditable={editable}
        suppressContentEditableWarning
        onBlur={(e) =>
          onEditText?.(block.postId, block.chunkIdx, e.currentTarget.textContent || "")
        }
        style={{
          width,
          fontSize: t.size * geo.scale,
          lineHeight: t.line,
          color: block.lead ? style.text : style.muted,
          fontWeight: block.lead ? 500 : 400,
          whiteSpace: "pre-wrap",
          outline: "none",
        }}
      >
        {block.text}
      </div>
    );

    // `aside`: text vlevo, fotka vpravo – obojí na půl šířky sazebního obrazce
    if (block.layout === "aside" && block.photo) {
      return (
        <div style={{ display: "flex", gap: geo.gap, alignItems: "flex-start" }}>
          {body}
          <div
            style={{
              width: block.photo.w,
              height: block.photo.h,
              overflow: "hidden",
              borderRadius: style.photoRadius,
              border: style.photoBorder || undefined,
              boxShadow: style.photoShadow || undefined,
              background: "#e8e4dd",
              position: "relative",
              flex: "0 0 auto",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlOf(block.photo.id)}
              alt=""
              crossOrigin="anonymous"
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            {editable && onRemovePhoto && (
              <RemoveBtn onClick={() => onRemovePhoto(block.photo!.id)} />
            )}
          </div>
        </div>
      );
    }

    if (!editable || !onCycleLayout) return body;

    // Šířku textu lze přepnout ručně: celá šířka → čitelná míra → s fotkou vedle.
    return (
      <div style={{ position: "relative" }}>
        {body}
        <button
          onClick={() => onCycleLayout(block.postId, block.chunkIdx)}
          title="Přepnout šířku textu"
          style={{
            position: "absolute",
            top: -4,
            left: -22,
            width: 18,
            height: 18,
            borderRadius: 9,
            border: "none",
            cursor: "pointer",
            background: "rgba(0,0,0,0.3)",
            color: "#fff",
            fontSize: 10,
            lineHeight: "18px",
            padding: 0,
          }}
        >
          ↔
        </button>
      </div>
    );
  }

  // skupina fotek: řádky už spočítal sazeč, tady se jen vykreslí
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: geo.gap }}>
      {block.rows.map((row, ri) => (
        // Poslední řádek nemusí vyplnit celou šířku (má strop výšky) – ať pak
        // nevisí u levého okraje, vycentruje se.
        <div key={ri} style={{ display: "flex", gap: geo.gap, height: row.h, justifyContent: "center" }}>
          {row.cells.map((c) => (
            <div
              key={c.id}
              style={{
                width: c.w,
                height: row.h,
                position: "relative",
                overflow: "hidden",
                borderRadius: style.photoRadius,
                border: style.photoBorder || undefined,
                boxShadow: style.photoShadow || undefined,
                background: "#e8e4dd",
                flex: "0 0 auto",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urlOf(c.id)}
                alt=""
                crossOrigin="anonymous"
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              {editable && (
                <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 4 }}>
                  {onCyclePhotoSize && (
                    <button
                      onClick={() => onCyclePhotoSize(c.id)}
                      title="Změnit velikost fotky"
                      style={{ ...HEAD_BTN, background: "rgba(0,0,0,0.55)" }}
                    >
                      ⤢
                    </button>
                  )}
                  {onRemovePhoto && <RemoveBtn onClick={() => onRemovePhoto(c.id)} />}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const HEAD_BTN: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  background: "rgba(0,0,0,0.35)",
  color: "#fff",
  fontSize: 12,
  lineHeight: "20px",
  padding: 0,
};

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Vynechat fotku z knihy"
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
        background: "rgba(0,0,0,0.55)",
        color: "#fff",
        fontSize: 13,
        lineHeight: "20px",
        padding: 0,
      }}
    >
      ×
    </button>
  );
}
