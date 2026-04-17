"use client";

import { useState, useRef, useEffect } from "react";

const DEFAULT_COLOR = "#10b981";
const STORAGE_KEY = "tsc-theme-color";
const RAINBOW_KEY = "tsc-theme-rainbow";
const HUE_KEY = "tsc-theme-hue";

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

interface ThemePickerProps {
  color: string;
  onChange: (hex: string) => void;
}

export default function ThemePicker({ color, onChange }: ThemePickerProps) {
  const [open, setOpen] = useState(false);
  const [rainbow, setRainbow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const hueRef = useRef<number>(0);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  useEffect(() => {
    const isRainbow = localStorage.getItem(RAINBOW_KEY) === "1";
    const hasColor = !!localStorage.getItem(STORAGE_KEY);
    if (isRainbow || !hasColor) {
      hueRef.current = Number(localStorage.getItem(HUE_KEY) || "0");
      setRainbow(true);
      const tick = () => {
        hueRef.current = (hueRef.current + 0.5) % 360;
        document.documentElement.style.setProperty("--theme-hue", String(hueRef.current));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    if (!rainbow) return;
    const save = () => localStorage.setItem(HUE_KEY, String(Math.round(hueRef.current)));
    window.addEventListener("beforeunload", save);
    return () => window.removeEventListener("beforeunload", save);
  }, [rainbow]);

  function startRainbow() {
    localStorage.setItem(RAINBOW_KEY, "1");
    localStorage.removeItem(STORAGE_KEY);
    const current = document.documentElement.style.getPropertyValue("--theme-hue");
    hueRef.current = current ? Number(current) : 0;
    setRainbow(true);
    const tick = () => {
      hueRef.current = (hueRef.current + 0.5) % 360;
      document.documentElement.style.setProperty("--theme-hue", String(hueRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function stopRainbow() {
    cancelAnimationFrame(rafRef.current);
    localStorage.removeItem(RAINBOW_KEY);
    setRainbow(false);
    onChange(hslToHex(hueRef.current, 60, 50));
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Theme color picker"
        className="relative flex h-9 w-9 items-center justify-center rounded-full glass text-white/75 hover:bg-white/15 transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Theme color picker"
          className="absolute right-0 top-11 z-50 w-44 rounded-xl glass p-4 shadow-2xl"
        >
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-white/40">
            Theme Color
          </p>
          <div className="flex items-center gap-3">
            {rainbow ? (
              <div
                aria-label="Color (rainbow active)"
                className="h-8 w-8 rounded cursor-default"
                style={{ background: "linear-gradient(135deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ef4444)" }}
              />
            ) : (
              <input
                type="color"
                aria-label="Color"
                value={color}
                onChange={(e) => {
                  cancelAnimationFrame(rafRef.current);
                  localStorage.removeItem(RAINBOW_KEY);
                  setRainbow(false);
                  onChange(e.target.value);
                }}
                className="h-8 w-8 cursor-pointer rounded border-0 p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none"
              />
            )}
            <button
              type="button"
              onClick={() => {
                cancelAnimationFrame(rafRef.current);
                localStorage.removeItem(RAINBOW_KEY);
                setRainbow(false);
                onChange(DEFAULT_COLOR);
              }}
              className="text-xs text-white/40 hover:text-red-400"
            >
              Reset
            </button>
          </div>
          <button
            type="button"
            onClick={rainbow ? stopRainbow : startRainbow}
            className="mt-2 w-full rounded-lg px-2 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ef4444)",
              opacity: rainbow ? 1 : 0.5,
            }}
          >
            {rainbow ? "Rainbow ✓" : "Rainbow"}
          </button>
        </div>
      )}
    </div>
  );
}
