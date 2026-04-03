"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { DayPicker } from "react-day-picker";

interface DatePickerPopoverProps {
  id?: string;
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  min?: string;
  max?: string;
}

function toDate(str: string): Date | undefined {
  if (!str) return undefined;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function displayDate(str: string): string {
  if (!str) return "Pick a date";
  const [y, m, d] = str.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(y, m - 1, d));
}

export default function DatePickerPopover({
  id,
  value,
  onChange,
  min,
  max,
}: DatePickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const handleSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      onChange(toISO(date));
      setOpen(false);
    },
    [onChange]
  );

  const selected = toDate(value);
  const fromDate = min ? toDate(min) : undefined;
  const toDateBound = max ? toDate(max) : undefined;

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden real input keeps tests and screen readers working */}
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        aria-label="Date:"
        tabIndex={-1}
      />

      {/* Visual trigger button */}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200
                   text-left min-w-[148px] hover:border-slate-600 transition-colors
                   focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {displayDate(value)}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Date picker"
          className="absolute left-0 top-full z-50 mt-1 rounded-xl border border-slate-700 bg-slate-800 p-3 shadow-2xl shadow-black/60"
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected}
            disabled={[
              ...(fromDate ? [{ before: fromDate }] : []),
              ...(toDateBound ? [{ after: toDateBound }] : []),
            ]}
            classNames={{
              months: "flex",
              month: "w-full",
              month_caption:
                "flex items-center justify-between mb-3 px-1",
              caption_label: "text-sm font-semibold text-slate-200",
              nav: "flex gap-1",
              button_previous:
                "p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-20 disabled:cursor-not-allowed",
              button_next:
                "p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-20 disabled:cursor-not-allowed",
              month_grid: "w-full border-collapse",
              weekdays: "",
              weekday:
                "text-[11px] font-medium text-slate-500 w-9 text-center pb-2",
              week: "",
              day: "text-center p-0.5",
              day_button:
                "h-8 w-8 mx-auto rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors flex items-center justify-center",
              selected:
                "[&>button]:!bg-blue-600 [&>button]:!text-white [&>button]:hover:!bg-blue-500",
              today:
                "[&>button]:font-bold [&>button]:text-blue-400",
              outside: "opacity-30",
              disabled:
                "[&>button]:!opacity-20 [&>button]:cursor-not-allowed",
              hidden: "invisible",
            }}
          />
        </div>
      )}
    </div>
  );
}
