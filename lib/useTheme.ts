"use client";

import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "tsc-theme-color";
export const DEFAULT_COLOR = "#10b981"; // emerald-500, hue ~160

function hexToHue(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) return 0;

  let hue: number;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }

  return Math.round(hue * 60 + (hue < 0 ? 360 : 0));
}

export function useTheme(): { color: string; setColor: (hex: string) => void } {
  const [color, setColorState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_COLOR;
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_COLOR;
  });

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      // On mount: only set the CSS variable, don't write to localStorage.
      // ThemePicker owns localStorage for rainbow vs. static color.
      const hue = hexToHue(color);
      document.documentElement.style.setProperty("--theme-hue", String(hue));
      return;
    }
    const hue = hexToHue(color);
    document.documentElement.style.setProperty("--theme-hue", String(hue));
    localStorage.setItem(STORAGE_KEY, color);
  }, [color]);

  return { color, setColor: setColorState };
}
