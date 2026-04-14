"use client";

import { useState, useRef, useEffect } from "react";

const DEFAULT_COLOR = "#10b981";

interface ThemePickerProps {
  color: string;
  onChange: (hex: string) => void;
}

export default function ThemePicker({ color, onChange }: ThemePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Theme color picker"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--t-200)] bg-gradient-to-br from-[var(--t-50)] to-[var(--t-50)] text-[var(--t-700)] hover:border-[var(--t-300)]"
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
          className="absolute right-0 top-11 z-50 w-44 rounded-xl border border-[var(--t-200)] bg-gradient-to-br from-[var(--t-50)] to-[var(--t-50)] p-4 shadow-xl shadow-black/10"
        >
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--t-700)]">
            Theme Color
          </p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label="Color"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border-0 p-0"
            />
            <button
              type="button"
              onClick={() => onChange(DEFAULT_COLOR)}
              className="text-xs text-gray-500 hover:text-red-400"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
