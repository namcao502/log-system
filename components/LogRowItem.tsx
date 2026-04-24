"use client";

import { useCallback } from "react";
import type { LogRow } from "@/lib/types";
import { LABELS } from "@/lib/constants";
import DatePickerPopover from "./DatePickerPopover";

interface LogRowItemProps {
  row: LogRow;
  min: string;
  max: string;
  onDateChange: (id: string, date: string) => void;
  onTicketChange: (id: string, ticket: string) => void;
  onTicketBlur: (id: string, ticket: string) => void;
  onRemove: (id: string) => void;
}

function StatusBadge({ status }: { status: LogRow["status"] }) {
  const base = "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold";
  if (status === "valid")
    return <span className={`${base} bg-[hsl(142,50%,18%)] text-[hsl(142,60%,52%)]`} aria-label="Verified">&#10003;</span>;
  if (status === "invalid")
    return <span className={`${base} bg-[hsl(0,50%,18%)] text-[hsl(0,68%,58%)]`} aria-label="Invalid ticket">&#x2717;</span>;
  if (status === "verifying")
    return <span className={`${base} bg-[var(--md-surface-container-high)] text-[var(--md-on-surface-variant)]`} aria-label="Verifying">&#x2026;</span>;
  return null;
}

export default function LogRowItem({
  row, min, max, onDateChange, onTicketChange, onTicketBlur, onRemove,
}: LogRowItemProps) {
  const handleTicketChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onTicketChange(row.id, e.target.value.replace(/[^\d,\s]/g, ""));
    },
    [row.id, onTicketChange],
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[230px_1fr_28px] gap-2 items-center bg-[var(--md-surface-container-highest)] rounded-xl px-3 py-2">
        <DatePickerPopover
          id={`date-${row.id}`}
          value={row.date}
          onChange={(v) => onDateChange(row.id, v)}
          min={min}
          max={max}
        />
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder={LABELS.TICKET_ROW_PLACEHOLDER}
            value={row.ticket}
            onChange={handleTicketChange}
            onFocus={(e) => e.target.select()}
            onBlur={() => onTicketBlur(row.id, row.ticket)}
            className="flex-1 min-w-0 px-2.5 py-1.5 text-sm md-input"
          />
          <StatusBadge status={row.status} />
        </div>
        <button
          type="button"
          onClick={() => onRemove(row.id)}
          aria-label="Remove row"
          className="shrink-0 rounded p-1 text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container-high)] hover:text-red-400"
        >
          &#x2715;
        </button>
      </div>
      {row.summary && (
        <div className="pl-[246px] flex flex-col">
          {row.summary.split("\n").map((line, i) => (
            <p key={i} className="text-xs text-[var(--md-on-surface-variant)] truncate">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
