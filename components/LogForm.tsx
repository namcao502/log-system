"use client";

import { useState, useCallback, useId } from "react";
import type { JiraVerifyResponse, LogRow, Notification } from "@/lib/types";
import { getTimeSlots } from "@/lib/time-slots";
import { LABELS, NOTIFY } from "@/lib/constants";
import LogPanel from "./LogPanel";
import LogRowItem from "./LogRowItem";

interface LogFormProps {
  onNotify: (n: Omit<Notification, "id" | "timestamp">) => void;
}

const DIGIT_SEGMENT_REGEX = /^\d+$/;

function getTodayDateString(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year  = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day   = parts.find((p) => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function getCurrentYearBounds(): { min: string; max: string } {
  const yearStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).format(new Date());
  return { min: `${yearStr}-01-01`, max: `${yearStr}-12-31` };
}

function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

function newRow(date: string): LogRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    ticket: "",
    status: "idle",
  };
}

function prefixTickets(raw: string): string[] {
  return raw.split(/,\s*/).map((s) => s.trim()).filter(Boolean).map((s) => `MDP-${s}`);
}

function groupByDate(rows: LogRow[]): [string, string[]][] {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    if (row.status !== "valid") continue;
    const tickets = prefixTickets(row.ticket);
    map.set(row.date, [...(map.get(row.date) ?? []), ...tickets]);
  }
  return [...map.entries()];
}

async function readNdJsonStream(
  body: ReadableStream<Uint8Array>,
  onLog: (line: string) => void,
): Promise<{ success: boolean; cell?: string; error?: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line) as {
        type: string; data?: string; success?: boolean; cell?: string; error?: string;
      };
      if (msg.type === "log" && msg.data !== undefined) onLog(msg.data);
      else if (msg.type === "result") return { success: msg.success ?? false, cell: msg.cell, error: msg.error };
    }
  }
  return { success: false, error: NOTIFY.ERR_STREAM };
}

export default function LogForm({ onNotify }: LogFormProps) {
  const today = getTodayDateString();
  const initialId = useId();
  const [rows, setRows] = useState<LogRow[]>(() => [{ id: initialId, date: today, ticket: "", status: "idle" }]);
  const [isTscLogging, setIsTscLogging] = useState(false);
  const [isHrmLogging, setIsHrmLogging] = useState(false);
  const [tscLogs, setTscLogs] = useState<string[]>([]);
  const [hrmLogs, setHrmLogs] = useState<string[]>([]);

  const { min, max } = getCurrentYearBounds();
  const isLogging = isTscLogging || isHrmLogging;
  const groups = groupByDate(rows);
  const validCount = groups.reduce((n, [, t]) => n + t.length, 0);

  // --- Row handlers ---

  const handleAddRow = useCallback(() => {
    setRows((prev) => {
      const used = new Set(prev.map((r) => r.date));
      let candidate = getTodayDateString();
      while (used.has(candidate)) candidate = nextDay(candidate);
      return [...prev, newRow(candidate)];
    });
  }, []);

  const handleDateChange = useCallback((id: string, date: string) => {
    setRows((prev) => {
      if (prev.some((r) => r.id !== id && r.date === date)) return prev;
      return prev.map((r) => r.id === id ? { ...r, date } : r);
    });
  }, []);

  const handleTicketChange = useCallback((id: string, ticket: string) => {
    setRows((prev) =>
      prev.map((r) => r.id === id ? { ...r, ticket, status: "idle", summary: undefined } : r),
    );
  }, []);

  const handleTicketBlur = useCallback(async (id: string, raw: string) => {
    const parts = raw.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;

    // All parts must be digit strings
    if (!parts.every((s) => DIGIT_SEGMENT_REGEX.test(s))) {
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, status: "invalid" } : r));
      return;
    }

    const normalized = parts.join(", ");
    const existing = rows.find((r) => r.id === id);
    if (existing?.status === "valid" && existing.ticket === normalized) return;

    setRows((prev) => prev.map((r) =>
      r.id === id ? { ...r, ticket: normalized, status: "verifying" } : r
    ));
    try {
      const results = await Promise.all(
        parts.map(async (s) => {
          const ticket = `MDP-${s}`;
          const res = await fetch(`/api/jira/verify?ticket=${encodeURIComponent(ticket)}`);
          const data: JiraVerifyResponse = await res.json();
          return { ticket, data };
        }),
      );
      const allValid = results.every((r) => r.data.valid);
      const summary = results.map((r) => `${r.ticket}: ${r.data.summary ?? ""}`).join("\n");
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: allValid ? "valid" : "invalid", summary: allValid ? summary : undefined }
            : r,
        ),
      );
      const invalid = results.filter((r) => !r.data.valid);
      if (invalid.length > 0) {
        onNotify({ type: "error", title: NOTIFY.JIRA_FAILED, detail: `Invalid: ${invalid.map((r) => r.ticket).join(", ")}` });
      }
    } catch {
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, status: "invalid" } : r));
      onNotify({ type: "error", title: NOTIFY.JIRA_FAILED, detail: NOTIFY.ERR_JIRA_API });
    }
  }, [onNotify, rows]);

  const handleRemoveRow = useCallback((id: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length > 0 ? next : [newRow(getTodayDateString())];
    });
  }, []);

  // --- Log handlers ---

  const handleLogTsc = useCallback(async () => {
    if (groups.length === 0 || isLogging) return;
    setIsTscLogging(true);
    setTscLogs([]);
    try {
      for (const [date, tickets] of groups) {
        const res = await fetch("/api/sharepoint/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket: tickets.join(", "), dates: [date] }),
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({})) as { error?: string };
          onNotify({ type: "error", title: NOTIFY.TSC_FAILED, detail: data.error ?? NOTIFY.ERR_LOG });
          return;
        }
        const result = await readNdJsonStream(res.body, (line) =>
          setTscLogs((prev) => [...prev, line]),
        );
        if (!result.success) {
          onNotify({ type: "error", title: NOTIFY.TSC_FAILED, detail: result.error || NOTIFY.ERR_LOG });
          return;
        }
      }
      onNotify({
        type: "success",
        title: NOTIFY.TSC_LOGGED,
        detail: groups.map(([d, t]) => `${t.join(", ")} on ${formatDateDisplay(d)}`).join("; "),
      });
      setRows([newRow(getTodayDateString())]);
    } catch {
      onNotify({ type: "error", title: NOTIFY.TSC_FAILED, detail: NOTIFY.ERR_EXCEL });
    } finally {
      setIsTscLogging(false);
    }
  }, [groups, isLogging, onNotify]);

  const handleLogHrm = useCallback(async () => {
    if (groups.length === 0 || isLogging) return;
    setIsHrmLogging(true);
    setHrmLogs([]);
    try {
      for (const [date, tickets] of groups) {
        const res = await fetch("/api/hrm/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickets, dates: [date] }),
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({})) as { error?: string };
          onNotify({ type: "error", title: NOTIFY.HRM_FAILED, detail: data.error ?? NOTIFY.ERR_HRM });
          return;
        }
        const result = await readNdJsonStream(res.body, (line) =>
          setHrmLogs((prev) => [...prev, line]),
        );
        if (!result.success) {
          onNotify({ type: "error", title: NOTIFY.HRM_FAILED, detail: result.error || NOTIFY.ERR_HRM });
          return;
        }
      }
      onNotify({
        type: "success",
        title: NOTIFY.HRM_LOGGED,
        detail: groups.map(([d, t]) => `${t.join(", ")} on ${formatDateDisplay(d)}`).join("; "),
      });
      setRows([newRow(getTodayDateString())]);
    } catch {
      onNotify({ type: "error", title: NOTIFY.HRM_FAILED, detail: NOTIFY.ERR_HRM_API });
    } finally {
      setIsHrmLogging(false);
    }
  }, [groups, isLogging, onNotify]);

  const handleLogAll = useCallback(async () => {
    if (groups.length === 0 || isLogging) return;
    setIsTscLogging(true);
    setIsHrmLogging(true);
    setTscLogs([]);
    setHrmLogs([]);

    const tscTask = (async () => {
      try {
        for (const [date, tickets] of groups) {
          const res = await fetch("/api/sharepoint/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticket: tickets.join(", "), dates: [date] }),
          });
          if (!res.ok || !res.body) {
            const data = await res.json().catch(() => ({})) as { error?: string };
            onNotify({ type: "error", title: NOTIFY.TSC_FAILED, detail: data.error ?? NOTIFY.ERR_LOG });
            return false;
          }
          const result = await readNdJsonStream(res.body, (line) =>
            setTscLogs((prev) => [...prev, line]),
          );
          if (!result.success) {
            onNotify({ type: "error", title: NOTIFY.TSC_FAILED, detail: result.error || NOTIFY.ERR_LOG });
            return false;
          }
        }
        onNotify({
          type: "success",
          title: NOTIFY.TSC_LOGGED,
          detail: groups.map(([d, t]) => `${t.join(", ")} on ${formatDateDisplay(d)}`).join("; "),
        });
        return true;
      } catch {
        onNotify({ type: "error", title: NOTIFY.TSC_FAILED, detail: NOTIFY.ERR_EXCEL });
        return false;
      } finally {
        setIsTscLogging(false);
      }
    })();

    const hrmTask = (async () => {
      try {
        for (const [date, tickets] of groups) {
          const res = await fetch("/api/hrm/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tickets, dates: [date] }),
          });
          if (!res.ok || !res.body) {
            const data = await res.json().catch(() => ({})) as { error?: string };
            onNotify({ type: "error", title: NOTIFY.HRM_FAILED, detail: data.error ?? NOTIFY.ERR_HRM });
            return false;
          }
          const result = await readNdJsonStream(res.body, (line) =>
            setHrmLogs((prev) => [...prev, line]),
          );
          if (!result.success) {
            onNotify({ type: "error", title: NOTIFY.HRM_FAILED, detail: result.error || NOTIFY.ERR_HRM });
            return false;
          }
        }
        onNotify({
          type: "success",
          title: NOTIFY.HRM_LOGGED,
          detail: groups.map(([d, t]) => `${t.join(", ")} on ${formatDateDisplay(d)}`).join("; "),
        });
        return true;
      } catch {
        onNotify({ type: "error", title: NOTIFY.HRM_FAILED, detail: NOTIFY.ERR_HRM_API });
        return false;
      } finally {
        setIsHrmLogging(false);
      }
    })();

    const [tscOk, hrmOk] = await Promise.all([tscTask, hrmTask]);
    if (tscOk && hrmOk) {
      setRows([newRow(getTodayDateString())]);
    }
  }, [groups, isLogging, onNotify]);

  // --- Render ---

  const logAllLabel = `Log All -- ${validCount} ticket${validCount !== 1 ? "s" : ""} across ${groups.length} date${groups.length !== 1 ? "s" : ""}`;

  return (
    <div className="space-y-2.5">
      {/* Entry table card */}
      <div className="rounded-2xl md-surface px-5 py-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--md-on-surface-variant)]">
          {LABELS.LOG_ENTRIES}
        </p>
        <div className="grid grid-cols-[230px_1fr_28px] gap-2 px-3 pb-1">
          <span className="text-[11px] font-semibold text-[var(--md-on-surface-variant)] uppercase tracking-wide">{LABELS.DATE_COL}</span>
          <span className="text-[11px] font-semibold text-[var(--md-on-surface-variant)] uppercase tracking-wide">{LABELS.TICKET_COL}</span>
          <span />
        </div>
        <div className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <LogRowItem
              key={row.id}
              row={row}
              min={min}
              max={max}
              onDateChange={handleDateChange}
              onTicketChange={handleTicketChange}
              onTicketBlur={handleTicketBlur}
              onRemove={handleRemoveRow}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={handleAddRow}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-sm
                     border border-dashed border-[var(--md-outline-variant)]
                     rounded-xl text-[var(--md-on-surface-variant)]
                     hover:border-[var(--md-primary)] hover:text-[var(--md-primary)]
                     transition-colors duration-150"
        >
          <span className="text-base leading-none">+</span> {LABELS.ADD_ROW}
        </button>
      </div>

      {/* Will-log summary */}
      {groups.length > 0 && (
        <div
          data-testid="will-log-summary"
          className="rounded-2xl md-surface px-5 py-4 space-y-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--md-on-surface-variant)]">{LABELS.WILL_LOG}</p>
          <div className="rounded-xl border border-[var(--md-outline-variant)] border-l-4 border-l-[var(--md-primary)] bg-[var(--md-surface-container-high)] px-4 py-3 text-sm space-y-3">
            {groups.map(([date, tickets], gi) => (
              <div key={date}>
                {gi > 0 && <div className="border-t border-[var(--md-outline-variant)] mb-3" />}
                <p className="font-semibold text-[var(--md-on-surface)]">{formatDateDisplay(date)}</p>
                <ul className="mt-1.5 space-y-1 pl-2">
                  {tickets.map((t, i) => {
                    const slots = getTimeSlots(tickets.length, i);
                    return (
                      <li key={t} className="flex items-center gap-2">
                        <span className="font-medium text-[var(--md-on-surface)]">{t}</span>
                        <span className="text-xs text-[var(--md-on-surface-variant)]">
                          {slots.map((s) => `${s.start}--${s.end}`).join(" / ")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status card */}
      <div className="rounded-2xl md-surface px-5 py-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--md-on-surface-variant)]">{LABELS.STATUS}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl md-surface-high px-4 py-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--md-on-surface-variant)]">{LABELS.TSC_LOG}</p>
            <LogPanel logs={tscLogs} />
          </div>
          <div className="rounded-xl md-surface-high px-4 py-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--md-on-surface-variant)]">{LABELS.HRM_LOG}</p>
            <LogPanel logs={hrmLogs} />
          </div>
        </div>
      </div>

      {/* Actions card */}
      <div className="rounded-2xl md-surface px-5 py-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--md-on-surface-variant)]">{LABELS.ACTIONS}</p>
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={groups.length === 0 || isLogging}
              onClick={handleLogTsc}
              className="px-4 py-2.5 text-sm md-btn-tonal active:scale-95 transition-transform duration-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {LABELS.LOG_TSC}
            </button>
            <button
              type="button"
              disabled={groups.length === 0 || isLogging}
              onClick={handleLogHrm}
              className="px-4 py-2.5 text-sm md-btn-tonal active:scale-95 transition-transform duration-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {LABELS.LOG_HRM} ({validCount})
            </button>
          </div>
          <button
            type="button"
            disabled={groups.length === 0 || isLogging}
            onClick={handleLogAll}
            className="w-full px-4 py-3 text-sm md-btn-accent active:scale-95 transition-transform duration-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {logAllLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
