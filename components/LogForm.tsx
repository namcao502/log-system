"use client";

import { useState, useCallback } from "react";
import type { JiraVerifyResponse, Notification } from "@/lib/types";
import { getTimeSlots } from "@/lib/time-slots";
import { LABELS, NOTIFY } from "@/lib/constants";
import LogPanel from "./LogPanel";
import DatePickerPopover from "./DatePickerPopover";

interface HrmTicketItem {
  ticket: string;
  summary: string;
}

interface LogFormProps {
  onNotify: (n: Omit<Notification, "id" | "timestamp">) => void;
}

const SINGLE_TICKET_REGEX = /^MDP-\d+$/;
const INPUT_REGEX = /^MDP-\d+(,\s*MDP-\d+)*$/;
const MAX_HRM_TICKETS = 5;
const MAX_LOG_DATES = 5;

function parseTickets(input: string): string[] {
  return input.split(/,\s*/).filter((t) => SINGLE_TICKET_REGEX.test(t));
}

function getTodayDateString(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
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

async function readNdJsonStream(
  body: ReadableStream<Uint8Array>,
  onLog: (line: string) => void
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
        type: string;
        data?: string;
        success?: boolean;
        cell?: string;
        error?: string;
      };
      if (msg.type === "log" && msg.data !== undefined) {
        onLog(msg.data);
      } else if (msg.type === "result") {
        return { success: msg.success ?? false, cell: msg.cell, error: msg.error };
      }
    }
  }
  return { success: false, error: NOTIFY.ERR_STREAM };
}

export default function LogForm({ onNotify }: LogFormProps) {
  const [ticket, setTicket] = useState("");
  const [stagingDate, setStagingDate] = useState(getTodayDateString);
  const [logDates, setLogDates] = useState<string[]>(() => [getTodayDateString()]);
  const [isJiraLoading, setIsJiraLoading] = useState(false);
  const [isTscLogging, setIsTscLogging] = useState(false);
  const [isHrmLogging, setIsHrmLogging] = useState(false);
  const [stagedTickets, setStagedTickets] = useState<HrmTicketItem[]>([]);
  const [exitingTickets, setExitingTickets] = useState<Set<string>>(new Set());
  const [tscLogs, setTscLogs] = useState<string[]>([]);
  const [hrmLogs, setHrmLogs] = useState<string[]>([]);

  const isLogging = isTscLogging || isHrmLogging;
  const isTicketValid = INPUT_REGEX.test(ticket.trim());
  const { min, max } = getCurrentYearBounds();

  const handleTicketChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTicket(e.target.value.toUpperCase());
    },
    []
  );

  const handleStagingDateChange = useCallback((value: string) => {
    setStagingDate(value);
  }, []);

  const handleAddDate = useCallback(() => {
    if (!stagingDate || logDates.includes(stagingDate) || logDates.length >= MAX_LOG_DATES) return;
    setLogDates((prev) => [...prev, stagingDate]);
  }, [stagingDate, logDates]);

  const handleRemoveDate = useCallback((date: string) => {
    setLogDates((prev) => prev.filter((d) => d !== date));
  }, []);

  const handleVerify = useCallback(async () => {
    if (!isTicketValid || isJiraLoading) return;
    setIsJiraLoading(true);
    const tickets = parseTickets(ticket);
    try {
      const results = await Promise.all(
        tickets.map(async (t) => {
          const res = await fetch(`/api/jira/verify?ticket=${encodeURIComponent(t)}`);
          const data: JiraVerifyResponse = await res.json();
          return { ticket: t, data };
        })
      );
      const invalid = results.filter((r) => !r.data.valid);
      if (invalid.length > 0) {
        onNotify({
          type: "error",
          title: NOTIFY.JIRA_FAILED,
          detail: `Invalid: ${invalid.map((r) => r.ticket).join(", ")}`,
        });
        return;
      }
      const verified: HrmTicketItem[] = results.map((r) => ({
        ticket: r.ticket,
        summary: `${r.ticket} — ${r.data.summary ?? LABELS.NO_SUMMARY}`,
      }));
      onNotify({
        type: "info",
        title: NOTIFY.JIRA_VERIFIED,
        detail: verified.map((v) => v.summary).join(", "),
      });
      setStagedTickets((prev) => {
        const existingIds = new Set(prev.map((t) => t.ticket));
        const toAdd = verified.filter((v) => !existingIds.has(v.ticket));
        const combined = [...prev, ...toAdd];
        return combined.slice(0, MAX_HRM_TICKETS);
      });
      document.getElementById("log-date")?.focus();
    } catch {
      onNotify({ type: "error", title: NOTIFY.JIRA_FAILED, detail: NOTIFY.ERR_JIRA_API });
    } finally {
      setIsJiraLoading(false);
    }
  }, [ticket, isTicketValid, isJiraLoading, onNotify]);

  const handleRemoveFromStaged = useCallback((ticketId: string) => {
    setExitingTickets((prev) => new Set([...prev, ticketId]));
    setTimeout(() => {
      setStagedTickets((prev) => prev.filter((t) => t.ticket !== ticketId));
      setExitingTickets((prev) => {
        const next = new Set(prev);
        next.delete(ticketId);
        return next;
      });
    }, 150);
  }, []);

  const handleLogTsc = useCallback(async () => {
    if (stagedTickets.length === 0 || isLogging) return;
    const tscTicket = stagedTickets.map((t) => t.ticket).join(", ");
    const tscSummary = stagedTickets.map((t) => t.summary).join(", ");
    setIsTscLogging(true);
    setTscLogs([]);
    try {
      const res = await fetch("/api/sharepoint/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: tscTicket, dates: logDates }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        onNotify({ type: "error", title: NOTIFY.TSC_FAILED, detail: data.error ?? NOTIFY.ERR_LOG });
        return;
      }
      if (!res.body) {
        onNotify({ type: "error", title: NOTIFY.TSC_FAILED, detail: NOTIFY.ERR_LOG });
        return;
      }
      const result = await readNdJsonStream(res.body, (line) =>
        setTscLogs((prev) => [...prev, line])
      );
      if (result.success) {
        onNotify({
          type: "success",
          title: NOTIFY.TSC_LOGGED,
          detail: `${tscSummary} → cell ${result.cell ?? "?"}`,
        });
        setStagedTickets([]);
      } else {
        onNotify({ type: "error", title: NOTIFY.TSC_FAILED, detail: result.error || NOTIFY.ERR_LOG });
      }
    } catch {
      onNotify({ type: "error", title: NOTIFY.TSC_FAILED, detail: NOTIFY.ERR_EXCEL });
    } finally {
      setIsTscLogging(false);
    }
  }, [stagedTickets, logDates, isLogging, onNotify]);

  const handleLogHrm = useCallback(async () => {
    if (stagedTickets.length === 0 || isLogging) return;
    setIsHrmLogging(true);
    setHrmLogs([]);
    try {
      const res = await fetch("/api/hrm/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickets: stagedTickets.map((t) => t.ticket),
          dates: logDates,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        onNotify({ type: "error", title: NOTIFY.HRM_FAILED, detail: data.error ?? NOTIFY.ERR_HRM });
        return;
      }
      if (!res.body) {
        onNotify({ type: "error", title: NOTIFY.HRM_FAILED, detail: NOTIFY.ERR_HRM });
        return;
      }
      const result = await readNdJsonStream(res.body, (line) =>
        setHrmLogs((prev) => [...prev, line])
      );
      if (result.success) {
        const ticketIds = stagedTickets.map((t) => t.ticket).join(", ");
        onNotify({
          type: "success",
          title: NOTIFY.HRM_LOGGED,
          detail: `${ticketIds} on ${logDates.map(formatDateDisplay).join(", ")}`,
        });
        setStagedTickets([]);
      } else {
        onNotify({ type: "error", title: NOTIFY.HRM_FAILED, detail: result.error || NOTIFY.ERR_HRM });
      }
    } catch {
      onNotify({ type: "error", title: NOTIFY.HRM_FAILED, detail: NOTIFY.ERR_HRM_API });
    } finally {
      setIsHrmLogging(false);
    }
  }, [stagedTickets, logDates, isLogging, onNotify]);

  const handleLogAll = useCallback(async () => {
    if (stagedTickets.length === 0 || isLogging) return;
    const tscTicket = stagedTickets.map((t) => t.ticket).join(", ");
    const tscSummary = stagedTickets.map((t) => t.summary).join(", ");
    setIsTscLogging(true);
    setIsHrmLogging(true);
    setTscLogs([]);
    setHrmLogs([]);

    await Promise.all([
      (async () => {
        try {
          const res = await fetch("/api/sharepoint/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticket: tscTicket, dates: logDates }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({})) as { error?: string };
            onNotify({ type: "error", title: NOTIFY.TSC_FAILED, detail: data.error ?? NOTIFY.ERR_LOG });
            return;
          }
          if (!res.body) {
            onNotify({ type: "error", title: NOTIFY.TSC_FAILED, detail: NOTIFY.ERR_LOG });
            return;
          }
          const result = await readNdJsonStream(res.body, (line) =>
            setTscLogs((prev) => [...prev, line])
          );
          if (result.success) {
            onNotify({
              type: "success",
              title: NOTIFY.TSC_LOGGED,
              detail: `${tscSummary} → cell ${result.cell ?? "?"}`,
            });
            setStagedTickets([]);
          } else {
            onNotify({ type: "error", title: NOTIFY.TSC_FAILED, detail: result.error || NOTIFY.ERR_LOG });
          }
        } catch {
          onNotify({ type: "error", title: NOTIFY.TSC_FAILED, detail: NOTIFY.ERR_EXCEL });
        } finally {
          setIsTscLogging(false);
        }
      })(),
      (async () => {
        try {
          const res = await fetch("/api/hrm/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tickets: stagedTickets.map((t) => t.ticket), dates: logDates }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({})) as { error?: string };
            onNotify({ type: "error", title: NOTIFY.HRM_FAILED, detail: data.error ?? NOTIFY.ERR_HRM });
            return;
          }
          if (!res.body) {
            onNotify({ type: "error", title: NOTIFY.HRM_FAILED, detail: NOTIFY.ERR_HRM });
            return;
          }
          const result = await readNdJsonStream(res.body, (line) =>
            setHrmLogs((prev) => [...prev, line])
          );
          if (result.success) {
            const ticketIds = stagedTickets.map((t) => t.ticket).join(", ");
            onNotify({
              type: "success",
              title: NOTIFY.HRM_LOGGED,
              detail: `${ticketIds} on ${logDates.map(formatDateDisplay).join(", ")}`,
            });
            setStagedTickets([]);
          } else {
            onNotify({ type: "error", title: NOTIFY.HRM_FAILED, detail: result.error || NOTIFY.ERR_HRM });
          }
        } catch {
          onNotify({ type: "error", title: NOTIFY.HRM_FAILED, detail: NOTIFY.ERR_HRM_API });
        } finally {
          setIsHrmLogging(false);
        }
      })(),
    ]);
  }, [logDates, stagedTickets, isLogging, onNotify]);

  const logAllLabel = `Log All — ${stagedTickets.length} ticket${stagedTickets.length !== 1 ? "s" : ""} x ${logDates.length} date${logDates.length !== 1 ? "s" : ""}`;
  const showFormatError = ticket.length > 0 && !isTicketValid;

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        {/* Tickets card */}
        <div className="rounded-xl glass px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
              {stagedTickets.length > 0 ? `${LABELS.TICKETS} (${stagedTickets.length}/5)` : LABELS.TICKETS}
            </p>
            {stagedTickets.length > 0 && (
              <button
                type="button"
                onClick={() => setStagedTickets([])}
                className="text-xs text-white/40 hover:text-red-400"
              >
                {LABELS.CLEAR_ALL}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="ticket" className="text-sm font-medium text-white/75">
              {LABELS.TICKET}
            </label>
            <input
              id="ticket"
              type="text"
              autoComplete="off"
              placeholder={LABELS.TICKET_PLACEHOLDER}
              value={ticket}
              onChange={handleTicketChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isTicketValid && !isJiraLoading) {
                  handleVerify();
                }
              }}
              className={`w-full px-3 py-2 text-sm glass-input ${
                showFormatError ? "!border-red-500/70" : ""
              }`}
            />
            <button
              type="button"
              disabled={!isTicketValid || isJiraLoading}
              onClick={handleVerify}
              className="w-full rounded-lg px-4 py-2 text-sm font-medium btn-glass-primary
                         active:scale-95 transition-transform duration-100
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isJiraLoading ? LABELS.VERIFYING : LABELS.VERIFY}
            </button>
          </div>
          {showFormatError && (
            <p className="text-xs text-red-400">{LABELS.TICKET_FORMAT_ERROR}</p>
          )}
          {stagedTickets.length > 0 && (
            <ul className="space-y-1.5">
              {stagedTickets.map((item) => {
                const description = item.summary.slice(item.ticket.length + 3);
                return (
                  <li
                    key={item.ticket}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all duration-150 glass-item ${
                      exitingTickets.has(item.ticket) ? "opacity-0 -translate-y-1.5" : "animate-slide-in"
                    }`}
                  >
                    <span className="flex flex-col min-w-0">
                      <span className="font-medium text-white/90">{item.ticket}</span>
                      {description && (
                        <span className="truncate text-xs text-white/45">{description}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromStaged(item.ticket)}
                      className="ml-3 shrink-0 rounded p-1 text-white/30 hover:bg-white/10 hover:text-red-400"
                      aria-label={`Remove ${item.ticket}`}
                    >
                      &#x2715;
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Dates card */}
        <div className="rounded-xl glass px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
              {logDates.length > 0 ? `${LABELS.DATES} (${logDates.length}/${MAX_LOG_DATES})` : LABELS.DATES}
            </p>
            {logDates.length > 0 && (
              <button
                type="button"
                onClick={() => setLogDates([])}
                className="text-xs text-white/40 hover:text-red-400"
              >
                {LABELS.CLEAR_ALL}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="log-date" className="text-sm font-medium text-white/75">
              {LABELS.DATE}
            </label>
            <DatePickerPopover
              id="log-date"
              value={stagingDate}
              onChange={handleStagingDateChange}
              min={min}
              max={max}
            />
            <button
              type="button"
              disabled={!stagingDate || logDates.includes(stagingDate) || logDates.length >= MAX_LOG_DATES}
              onClick={handleAddDate}
              className="w-full rounded-lg px-4 py-2 text-sm font-medium btn-glass-primary
                         active:scale-95 transition-transform duration-100
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              {LABELS.ADD}
            </button>
          </div>
          {logDates.length > 0 && (
            <ul className="space-y-1.5">
              {logDates.map((d) => (
                <li
                  key={d}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm glass-item"
                >
                  <span className="flex flex-col min-w-0">
                    <span className="font-medium text-white/90">
                      {new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
                        (() => { const [y, m, day] = d.split("-").map(Number); return new Date(y, m - 1, day); })()
                      )}
                    </span>
                    <span className="truncate text-xs text-white/45">
                      {new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
                        (() => { const [y, m, day] = d.split("-").map(Number); return new Date(y, m - 1, day); })()
                      )}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDate(d)}
                    className="ml-2 shrink-0 rounded p-1 text-white/30 hover:bg-white/10 hover:text-red-400"
                    aria-label={`Remove date ${d}`}
                  >
                    &#x2715;
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Status card */}
      <div className="rounded-xl glass px-5 py-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{LABELS.STATUS}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {/* TSC Log block */}
          <div className="rounded-lg glass-strong px-4 py-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{LABELS.TSC_LOG}</p>
            <LogPanel logs={tscLogs} />
          </div>

          {/* HRM Log block */}
          <div className="rounded-lg glass-strong px-4 py-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{LABELS.HRM_LOG}</p>
            <LogPanel logs={hrmLogs} />
          </div>
        </div>
      </div>

      {/* Actions card */}
      <div className="rounded-xl glass px-5 py-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{LABELS.ACTIONS}</p>
        {stagedTickets.length > 0 && logDates.length > 0 && (
          <div data-testid="will-log-summary" className="rounded-lg border border-white/10 border-l-[3px] border-l-[color:var(--t-400)] bg-white/5 px-4 py-3 text-sm space-y-3">
            {/* Tickets section */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-1.5">{LABELS.TICKETS}</p>
              <ul className="space-y-1">
                {stagedTickets.map((t, i) => {
                  const slots = getTimeSlots(stagedTickets.length, i);
                  const timeStr = slots.map((s) => `${s.start}\u2013${s.end}`).join(" / ");
                  return (
                    <li key={t.ticket} className="flex items-center gap-2">
                      <span className="font-medium text-white/90">{t.ticket}</span>
                      <span className="text-white/50 text-xs">{timeStr}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="border-t border-white/10" />

            {/* Dates section */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-1.5">{LABELS.DATES}</p>
              <ul className="space-y-1">
                {logDates.map((d) => (
                  <li key={d} className="text-white/75">{formatDateDisplay(d)}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={stagedTickets.length === 0 || logDates.length === 0 || isLogging}
              onClick={handleLogTsc}
              className="rounded-lg px-4 py-2.5 text-sm font-medium btn-glass-outline active:scale-95 transition-transform duration-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {LABELS.LOG_TSC}
            </button>
            <button
              type="button"
              disabled={stagedTickets.length === 0 || isLogging}
              onClick={handleLogHrm}
              className="rounded-lg px-4 py-2.5 text-sm font-medium btn-glass-outline active:scale-95 transition-transform duration-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Log HRM ({stagedTickets.length})
            </button>
          </div>
          <button
            type="button"
            disabled={stagedTickets.length === 0 || isLogging}
            onClick={handleLogAll}
            className="w-full rounded-lg px-4 py-3 text-sm font-medium btn-glass-all active:scale-95 transition-transform duration-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {logAllLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
