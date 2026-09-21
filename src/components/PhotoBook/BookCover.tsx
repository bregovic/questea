"use client";

import React from "react";
import type { Geometry } from "@/lib/photobook/compose";
import type { BookStyle } from "@/lib/photobook/styles";

/**
 * Obálka knihy: fotka na spad, přes ni ztmavení a název. U tmavého papíru
 * se ztmavení nepřidává, jinak by obálka zčernala.
 */
/* Velká písmena se dělají v JS, ne přes CSS text-transform.
   html2canvas měří převedený řetězec, ale rozsahy nastavuje na původní
   textový uzel; jakmile se délky rozejdou, spadne na IndexSizeError.
   U češtiny se délka nemění, ale rakouské „ß" se převádí na „SS" – o znak
   delší – a export knihy z cesty přes Rakousko na tom padal. */
const upper = (s: string) => s.toLocaleUpperCase("cs-CZ");

export function BookCover({
  title,
  subtitle,
  geo,
  style,
  photoId,
  urlOf,
  editable = false,
  onEditTitle,
}: {
  title: string;
  subtitle?: string;
  geo: Geometry;
  style: BookStyle;
  photoId?: string;
  urlOf: (id: string) => string;
  editable?: boolean;
  onEditTitle?: (value: string) => void;
}) {
  return (
    <div
      className="print-page"
      style={{
        width: geo.pageW,
        height: geo.pageH,
        position: "relative",
        overflow: "hidden",
        background: style.paper,
        fontFamily: style.bodyFont,
      }}
    >
      {photoId && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urlOf(photoId)}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.25) 42%, rgba(0,0,0,0.05) 100%)",
            }}
          />
        </>
      )}

      <div
        style={{
          position: "absolute",
          left: geo.padOuter,
          right: geo.padOuter,
          bottom: geo.padBottom,
          color: photoId ? "#fff" : style.text,
        }}
      >
        {subtitle && (
          <div
            style={{
              fontSize: 10 * geo.scale,
              fontWeight: 700,
              letterSpacing: style.metaTracking,
              marginBottom: 12 * geo.scale,
              opacity: 0.8,
            }}
          >
            {upper(subtitle)}
          </div>
        )}
        <div
          contentEditable={editable && !!onEditTitle}
          suppressContentEditableWarning
          onBlur={(e) => onEditTitle?.(e.currentTarget.textContent || "")}
          style={{
            outline: "none",
            fontFamily: style.titleFont,
            fontWeight: style.titleWeight,
            fontStyle: style.titleItalic ? "italic" : "normal",
            fontSize: 54 * geo.scale,
            lineHeight: 0.98,
            letterSpacing: "-0.03em",
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 18 * geo.scale,
            width: 54 * geo.scale,
            height: 3 * geo.scale,
            background: photoId ? "#fff" : style.accent,
          }}
        />
      </div>
    </div>
  );
}
