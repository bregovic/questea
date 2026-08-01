"use client";

import { useEffect } from "react";

/**
 * Zamkne rolování stránky, dokud je otevřený dialog.
 *
 * `overflow: hidden` na body na iOS nestačí – Safari stránku pod overlayem
 * posouvá dál. Drží až `position: fixed`, u kterého je ale potřeba si
 * zapamatovat pozici a po zavření se na ni vrátit, jinak dialog uživatele
 * „teleportuje" na začátek stránky.
 *
 * Počítá vnořené dialogy: zámek povolí až ten poslední zavřený.
 */
let depth = 0;
let savedY = 0;

export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;

    const { body } = document;
    if (depth === 0) {
      savedY = window.scrollY;
      body.style.position = "fixed";
      body.style.top = `-${savedY}px`;
      body.style.width = "100%";
    }
    depth++;

    return () => {
      depth--;
      if (depth > 0) return;
      body.style.position = "";
      body.style.top = "";
      body.style.width = "";
      window.scrollTo(0, savedY);
    };
  }, [active]);
}
