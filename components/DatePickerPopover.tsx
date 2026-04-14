"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { DayPicker } from "react-day-picker";
import { LABELS } from "@/lib/constants";

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
  if (!str) return LABELS.PICK_A_DATE;
  const [y, m, d] = str.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
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
    <div ref={containerRef} className="relative w-full">
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
        className="w-full rounded-lg border border-[var(--t-200)] bg-white px-3 py-2 text-sm text-gray-800
                   text-left transition-colors
                   focus:border-[var(--t-500)] focus:outline-none focus:ring-1 focus:ring-[var(--t-500)]"
      >
        {displayDate(value)}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={LABELS.DATE_PICKER_ARIA}
          className="absolute left-0 top-full z-50 mt-1 rounded-xl border border-[var(--t-200)] bg-gradient-to-br from-[var(--t-50)] to-[var(--t-50)] p-3 shadow-xl shadow-black/10"
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
              caption_label: "text-sm font-semibold text-gray-900",
              nav: "flex gap-1",
              button_previous:
                "p-1.5 rounded-lg hover:bg-[var(--t-100)] text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-20 disabled:cursor-not-allowed",
              button_next:
                "p-1.5 rounded-lg hover:bg-[var(--t-100)] text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-20 disabled:cursor-not-allowed",
              month_grid: "w-full border-collapse",
              weekdays: "",
              weekday:
                "text-[11px] font-medium text-gray-400 w-9 text-center pb-2",
              week: "",
              day: "text-center p-0.5",
              day_button:
                "h-8 w-8 mx-auto rounded-lg text-sm text-gray-700 hover:bg-[var(--t-100)] hover:text-gray-900 transition-colors flex items-center justify-center",
              selected:
                "[&>button]:!bg-[var(--t-600)] [&>button]:!text-white [&>button]:hover:!bg-[var(--t-500)]",
              today:
                "[&>button]:font-bold [&>button]:text-[var(--t-600)]",
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
