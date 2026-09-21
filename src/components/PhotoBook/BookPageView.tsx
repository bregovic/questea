"use client";

import React from "react";
import type { Block, Geometry, Page } from "@/lib/photobook/compose";
import { TYPE, TEXT_PAD, textWidthFor } from "@/lib/photobook/compose";
import type { BookStyle } from "@/lib/photobook/styles";
import { PhotoCaption, type Caption } from "./PhotoCaption";

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
  onTogglePageBreak,
  pageBreaks,
  captions,
  onCaption,
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
  onTogglePageBreak?: (postId: string) => void;
  pageBreaks?: Set<string>;
  captions?: Record<string, Caption>;
  onCaption?: (photoId: string, next: Caption | null) => void;
}) {
  /* Kniha se čte po dvoustranách: první stránka za obálkou je pravá, pak se
     střídají. Vnitřní (širší) okraj musí být vždy u hřbetu. */
  const rightHand = index % 2 === 0;
  const bleed = page.blocks.length === 1 && page.blocks[0].kind === "bleed" ? page.blocks[0] : null;

  /* Obsah se sází odshora, takže při neúplné stránce zbylo místo dole.
     Zbytek se rozpustí do mezer mezi bloky, ale jen málo: velké mezery mezi
     textem a fotkami vypadají jako díry v sazbě a hlavně zabírají místo,
     kam se jinak vejde začátek dalšího příspěvku. */
  const slack = Math.max(0, geo.contentH * (1 - page.fill));
  const extraGap =
    page.blocks.length > 1 ? Math.min(slack / (page.blocks.length - 1), geo.gap * 1.2) : 0;

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
      {bleed && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={urlOf(bleed.photoId)}
          alt=""
          crossOrigin="anonymous"
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}

      <div
        style={{
          display: bleed ? "none" : "flex",
          position: "absolute",
          top: geo.padTop,
          bottom: geo.padBottom,
          left: rightHand ? geo.padInner : geo.padOuter,
          right: rightHand ? geo.padOuter : geo.padInner,
          flexDirection: "column",
          gap: geo.gap + extraGap,
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
            onTogglePageBreak={onTogglePageBreak}
            pageBreaks={pageBreaks}
            captions={captions}
            onCaption={onCaption}
          />
        ))}
      </div>

      <div
        style={{
          display: bleed ? "none" : "block",
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

/* Velká písmena se dělají v JS, ne přes CSS text-transform.
   html2canvas měří převedený řetězec, ale rozsahy nastavuje na původní
   textový uzel; jakmile se délky rozejdou, spadne na IndexSizeError.
   U češtiny se délka nemění, ale rakouské „ß" se převádí na „SS" – o znak
   delší – a export knihy z cesty přes Rakousko na tom padal. */
const upper = (s: string) => s.toLocaleUpperCase("cs-CZ");

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
  onTogglePageBreak,
  pageBreaks,
  captions,
  onCaption,
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
  onTogglePageBreak?: (postId: string) => void;
  pageBreaks?: Set<string>;
  captions?: Record<string, Caption>;
  onCaption?: (photoId: string, next: Caption | null) => void;
}) {
  if (block.kind === "heading") {
    return (
      <div style={{ position: "relative" }}>
        {editable && (
          <div style={{ position: "absolute", top: -2, right: -2, display: "flex", gap: 4 }}>
            {onTogglePageBreak && (
              <button
                onClick={() => onTogglePageBreak(block.postId)}
                title={pageBreaks?.has(block.postId) ? "Nezačínat na nové stránce" : "Začít na nové stránce"}
                style={{ ...HEAD_BTN, background: pageBreaks?.has(block.postId) ? "#ea580c" : HEAD_BTN.background }}
              >
                ⇤
              </button>
            )}
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
              letterSpacing: style.metaTracking,
              color: style.accent,
              marginBottom: TYPE.meta.gapAfter * geo.scale * 0.4,
            }}
          >
            {upper(block.meta)}
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
          background: style.textTint || undefined,
          padding: style.textTint ? `${TEXT_PAD * geo.scale}px ${TEXT_PAD * 1.4 * geo.scale}px` : undefined,
          borderRadius: style.textTint ? 6 : undefined,
          boxSizing: "border-box",
          fontSize: t.size * geo.scale,
          lineHeight: t.line,
          color: style.text,
          fontWeight: block.lead ? 600 : 450,
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
              transform: `rotate(${tiltFor(block.photo.id, style.tilt)}deg)`,
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
            {captions?.[block.photo.id] && (
              <PhotoCaption
                caption={captions[block.photo.id]}
                style={style}
                scale={geo.scale}
                editable={editable}
                onChange={(next) => onCaption?.(block.photo!.id, next)}
                onRemove={() => onCaption?.(block.photo!.id, null)}
              />
            )}
            {editable && onRemovePhoto && (
              <div style={{ position: "absolute", top: 4, right: 4 }}>
                <RemoveBtn onClick={() => onRemovePhoto(block.photo!.id)} />
              </div>
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

  if (block.kind === "bleed") return null;

  // skupina fotek: řádky už spočítal sazeč, tady se jen vykreslí
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: geo.gap }}>
      {block.rows.map((row, ri) => (
        // Řádky vyplňují celou šířku sazebního obrazce, takže lícují s okraji
        // stránky i mezi sebou; zarovnání na začátek je jen pojistka.
        <div key={ri} style={{ display: "flex", gap: geo.gap, height: row.h, justifyContent: "flex-start" }}>
          {row.cells.map((c) => (
            <div
              key={c.id}
              style={{
                transform:
                  row.cells.length === 1 ? `rotate(${tiltFor(c.id, style.tilt)}deg)` : undefined,
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
              {captions?.[c.id] && (
                <PhotoCaption
                  caption={captions[c.id]}
                  style={style}
                  scale={geo.scale}
                  editable={editable}
                  onChange={(next) => onCaption?.(c.id, next)}
                  onRemove={() => onCaption?.(c.id, null)}
                />
              )}
              {editable && (
                <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 4 }}>
                  {onCaption && !captions?.[c.id] && (
                    <button
                      onClick={() => onCaption(c.id, { text: "Popisek", x: 6, y: 78 })}
                      title="Přidat popisek do fotky"
                      style={{ ...HEAD_BTN, background: "rgba(0,0,0,0.55)" }}
                    >
                      T
                    </button>
                  )}
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

/** Stálé „náhodné" pootočení odvozené z id fotky – při překreslení se nemění. */
function tiltFor(id: string, max: number): number {
  if (!max) return 0;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return ((h / 1000) * 2 - 1) * max;
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
