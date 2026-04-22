"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { LABELS } from "@/lib/constants";

interface DatePickerPopoverProps {
  id?: string;
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  min?: string;
  max?: string;
}

interface PopoverPos {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
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
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Compute fixed position from trigger rect each time the popover opens.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const calHeight = 320;
    if (spaceBelow >= calHeight || rect.top < calHeight) {
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    } else {
      setPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width });
    }
  }, [open]);

  // Close on outside click (checking both trigger and portaled popover).
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) return;
      setOpen(false);
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

  const popoverStyle: React.CSSProperties = pos
    ? {
        position: "fixed",
        left: pos.left,
        width: pos.width,
        ...(pos.top !== undefined ? { top: pos.top } : { bottom: pos.bottom }),
        zIndex: 9999,
      }
    : { display: "none" };

  return (
    <div className="relative w-full">
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
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-lg px-3 py-2 text-sm text-left transition-colors md-input"
      >
        {displayDate(value)}
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={LABELS.DATE_PICKER_ARIA}
            style={popoverStyle}
            className="rounded-2xl md-surface p-3 shadow-2xl"
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
                month_caption: "flex items-center justify-between mb-3 px-1",
                caption_label: "text-sm font-semibold text-[var(--md-on-surface)]",
                nav: "flex gap-1",
                button_previous:
                  "p-1.5 rounded-lg hover:bg-[var(--md-surface-container-highest)] text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)] transition-colors disabled:opacity-20 disabled:cursor-not-allowed",
                button_next:
                  "p-1.5 rounded-lg hover:bg-[var(--md-surface-container-highest)] text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)] transition-colors disabled:opacity-20 disabled:cursor-not-allowed",
                month_grid: "w-full border-collapse",
                weekdays: "",
                weekday: "text-[11px] font-medium text-[var(--md-on-surface-variant)] w-9 text-center pb-2",
                week: "",
                day: "text-center p-0.5",
                day_button:
                  "h-8 w-8 mx-auto rounded-full text-sm text-[var(--md-on-surface)] hover:bg-[var(--md-surface-container-highest)] transition-colors flex items-center justify-center",
                selected:
                  "[&>button]:!bg-[var(--md-primary)] [&>button]:!text-[var(--md-on-primary)] [&>button]:hover:!brightness-110",
                today:
                  "[&>button]:font-bold [&>button]:text-[var(--md-primary)]",
                outside: "opacity-30",
                disabled:
                  "[&>button]:!opacity-20 [&>button]:cursor-not-allowed",
                hidden: "invisible",
              }}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
