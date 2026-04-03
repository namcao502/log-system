"use client";

import { useState, useCallback, useEffect } from "react";
import type { JiraVerifyResponse, LogResponse, HrmLogResponse } from "@/lib/types";
import StatusIndicator from "./StatusIndicator";
import DatePickerPopover from "./DatePickerPopover";

type AsyncStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "success"; message: string }
  | { state: "error"; message: string };

interface HrmTicketItem {
  ticket: string;
  summary: string;
}

const SINGLE_TICKET_REGEX = /^MDP-\d+$/;
const INPUT_REGEX = /^MDP-\d+(,\s*MDP-\d+)*$/;
const MAX_HRM_TICKETS = 5;

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
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function getCurrentYearBounds(): { min: string; max: string } {
  const yearStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).format(new Date());
  return { min: `${yearStr}-01-01`, max: `${yearStr}-12-31` };
}

export default function LogForm() {
  const [ticket, setTicket] = useState("");
  const [stagingDate, setStagingDate] = useState(getTodayDateString);
  const [logDates, setLogDates] = useState<string[]>(() => [getTodayDateString()]);
  const [jiraStatus, setJiraStatus] = useState<AsyncStatus>({ state: "idle" });
  const [logStatus, setLogStatus] = useState<AsyncStatus>({ state: "idle" });
  const [hrmStatus, setHrmStatus] = useState<AsyncStatus>({ state: "idle" });
  const [stagedTickets, setStagedTickets] = useState<HrmTicketItem[]>([]);
  const [exitingTickets, setExitingTickets] = useState<Set<string>>(new Set());
  const [jiraFading, setJiraFading] = useState(false);
  const [logFading, setLogFading] = useState(false);
  const [hrmFading, setHrmFading] = useState(false);
  const [tscLogs, setTscLogs] = useState<string[]>([]);
  const [hrmLogs, setHrmLogs] = useState<string[]>([]);

  const isTicketValid = INPUT_REGEX.test(ticket.trim());
  const { min, max } = getCurrentYearBounds();

  const handleTicketChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTicket(e.target.value.toUpperCase());
      setJiraStatus({ state: "idle" });
      setLogStatus({ state: "idle" });
      setHrmStatus({ state: "idle" });
    },
    []
  );

  const handleStagingDateChange = useCallback(
    (value: string) => {
      setStagingDate(value);
      // When exactly one date is selected, update it in-place instead of requiring "+ Add"
      if (logDates.length === 1) {
        setLogDates([value]);
      }
    },
    [logDates.length]
  );

  const handleAddDate = useCallback(() => {
    if (!stagingDate || logDates.includes(stagingDate)) return;
    setLogDates((prev) => [...prev, stagingDate]);
  }, [stagingDate, logDates]);

  const handleRemoveDate = useCallback((date: string) => {
    setLogDates((prev) => prev.filter((d) => d !== date));
  }, []);

  const handleVerify = useCallback(async () => {
    if (!isTicketValid) return;

    setJiraStatus({ state: "loading" });
    setLogStatus({ state: "idle" });
    setHrmStatus({ state: "idle" });

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
        setJiraStatus({
          state: "error",
          message: `Invalid: ${invalid.map((r) => r.ticket).join(", ")}`,
        });
        return;
      }

      const verified: HrmTicketItem[] = results.map((r) => ({
        ticket: r.ticket,
        summary: `${r.ticket} — ${r.data.summary ?? "No summary"}`,
      }));
      setJiraStatus({
        state: "success",
        message: verified.map((v) => v.summary).join(" | "),
      });
      // Auto-stage: append new tickets, skip duplicates, respect MAX_HRM_TICKETS
      setStagedTickets((prev) => {
        const existingIds = new Set(prev.map((t) => t.ticket));
        const toAdd = verified.filter((v) => !existingIds.has(v.ticket));
        const combined = [...prev, ...toAdd];
        return combined.slice(0, MAX_HRM_TICKETS);
      });
      document.getElementById("log-date")?.focus();
    } catch {
      setJiraStatus({ state: "error", message: "Failed to reach Jira API" });
    }
  }, [ticket, isTicketValid]);

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

  const isLogging = logStatus.state === "loading" || hrmStatus.state === "loading";

  useEffect(() => {
    if (jiraStatus.state !== "success") return;
    const fadeId = setTimeout(() => setJiraFading(true), 19500);
    const clearId = setTimeout(() => {
      setJiraStatus({ state: "idle" });
      setJiraFading(false);
    }, 20000);
    return () => {
      clearTimeout(fadeId);
      clearTimeout(clearId);
    };
  }, [jiraStatus.state]);

  useEffect(() => {
    if (logStatus.state !== "success") return;
    const fadeId = setTimeout(() => setLogFading(true), 9500);
    const clearId = setTimeout(() => {
      setLogStatus({ state: "idle" });
      setLogFading(false);
    }, 10000);
    return () => {
      clearTimeout(fadeId);
      clearTimeout(clearId);
    };
  }, [logStatus.state]);

  useEffect(() => {
    if (hrmStatus.state !== "success") return;
    const fadeId = setTimeout(() => setHrmFading(true), 9500);
    const clearId = setTimeout(() => {
      setHrmStatus({ state: "idle" });
      setHrmFading(false);
    }, 10000);
    return () => {
      clearTimeout(fadeId);
      clearTimeout(clearId);
    };
  }, [hrmStatus.state]);

  const handleLogTsc = useCallback(async () => {
    if (stagedTickets.length === 0 || isLogging) return;

    const tscTicket = stagedTickets.map((t) => t.ticket).join(", ");

    setLogStatus({ state: "loading" });
    setTscLogs([]);
    try {
      const res = await fetch("/api/sharepoint/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: tscTicket, dates: logDates }),
      });
      const data = (await res.json()) as LogResponse;
      if (data.success) {
        setLogStatus({ state: "success", message: `Logged "${tscTicket}" at cell ${data.cell ?? "O"}` });
        setTscLogs(data.logs ?? []);
        setStagedTickets([]);
      } else {
        setLogStatus({ state: "error", message: data.error ?? "Failed to log" });
        setTscLogs(data.logs ?? []);
      }
    } catch {
      setLogStatus({ state: "error", message: "Failed to write to Excel" });
    }
  }, [stagedTickets, logDates, isLogging]);

  const handleLogHrm = useCallback(async () => {
    if (stagedTickets.length === 0 || isLogging) return;

    setHrmStatus({ state: "loading" });
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
      const data = (await res.json()) as HrmLogResponse;
      if (data.success) {
        const ticketIds = stagedTickets.map((t) => t.ticket).join(", ");
        setHrmStatus({ state: "success", message: `Logged ${ticketIds} to HRM timesheet` });
        setHrmLogs(data.logs ?? []);
        setStagedTickets([]);
      } else {
        setHrmStatus({ state: "error", message: data.error ?? "Failed to log to HRM" });
        setHrmLogs(data.logs ?? []);
      }
    } catch {
      setHrmStatus({ state: "error", message: "Failed to reach HRM" });
    }
  }, [stagedTickets, logDates, isLogging]);

  const handleLogAll = useCallback(async () => {
    if (stagedTickets.length === 0 || isLogging) return;

    setLogStatus({ state: "loading" });
    setHrmStatus({ state: "loading" });
    setTscLogs([]);
    setHrmLogs([]);

    await Promise.all([
      (async () => {
        const tscTicket = stagedTickets.map((t) => t.ticket).join(", ");
        try {
          const res = await fetch("/api/sharepoint/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticket: tscTicket, dates: logDates }),
          });
          const data = (await res.json()) as LogResponse;
          if (data.success) {
            setLogStatus({ state: "success", message: `Logged "${tscTicket}" at cell ${data.cell ?? "O"}` });
            setTscLogs(data.logs ?? []);
            setStagedTickets([]);
          } else {
            setLogStatus({ state: "error", message: data.error ?? "Failed to log" });
            setTscLogs(data.logs ?? []);
          }
        } catch {
          setLogStatus({ state: "error", message: "Failed to write to Excel" });
        }
      })(),
      (async () => {
        try {
          const res = await fetch("/api/hrm/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tickets: stagedTickets.map((t) => t.ticket), dates: logDates }),
          });
          const data = (await res.json()) as HrmLogResponse;
          if (data.success) {
            const ticketIds = stagedTickets.map((t) => t.ticket).join(", ");
            setHrmStatus({ state: "success", message: `Logged ${ticketIds} to HRM timesheet` });
            setHrmLogs(data.logs ?? []);
            setStagedTickets([]);
          } else {
            setHrmStatus({ state: "error", message: data.error ?? "Failed to log to HRM" });
            setHrmLogs(data.logs ?? []);
          }
        } catch {
          setHrmStatus({ state: "error", message: "Failed to reach HRM" });
        }
      })(),
    ]);
  }, [logDates, stagedTickets, isLogging]);

  const logAllLabel = `Log All — ${stagedTickets.length} ticket${stagedTickets.length !== 1 ? "s" : ""} × ${logDates.length} date${logDates.length !== 1 ? "s" : ""}`;
  const showFormatError = ticket.length > 0 && !isTicketValid;

  return (
    <div className="space-y-2.5">
      {/* Tickets card */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            {stagedTickets.length > 0 ? `Tickets (${stagedTickets.length}/5)` : "Tickets"}
          </p>
          {stagedTickets.length > 0 && (
            <button
              type="button"
              onClick={() => setStagedTickets([])}
              className="text-xs text-slate-500 hover:text-red-400"
            >
              Clear All
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="ticket" className="text-sm font-medium text-slate-400">
            Ticket:
          </label>
          <input
            id="ticket"
            type="text"
            placeholder="MDP-1234 or MDP-1234, MDP-5678"
            value={ticket}
            onChange={handleTicketChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isTicketValid && jiraStatus.state !== "loading") {
                handleVerify();
              }
            }}
            className={`flex-1 rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 ${
              showFormatError
                ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                : "border-slate-700 focus:border-blue-500 focus:ring-blue-500"
            }`}
          />
          <button
            type="button"
            disabled={!isTicketValid || jiraStatus.state === "loading"}
            onClick={handleVerify}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white
                       active:scale-95 transition-transform duration-100
                       hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Verify
          </button>
        </div>
        {showFormatError && (
          <p className="text-xs text-red-400">Use MDP-xxxx format</p>
        )}
        <StatusIndicator
          label="Jira"
          status={jiraStatus.state}
          fading={jiraFading}
          message={
            jiraStatus.state === "success" || jiraStatus.state === "error"
              ? jiraStatus.message
              : jiraStatus.state === "loading"
                ? "Verifying..."
                : undefined
          }
        />
        {stagedTickets.length > 0 && (
          <ul className="space-y-1.5">
            {stagedTickets.map((item) => {
              const description = item.summary.slice(item.ticket.length + 3);
              return (
                <li
                  key={item.ticket}
                  className={`flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm transition-all duration-150 ${
                    exitingTickets.has(item.ticket) ? "opacity-0 -translate-y-1.5" : "animate-slide-in"
                  }`}
                >
                  <span className="flex flex-col min-w-0">
                    <span className="font-medium text-slate-200">{item.ticket}</span>
                    {description && (
                      <span className="truncate text-xs text-slate-500">{description}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFromStaged(item.ticket)}
                    className="ml-3 shrink-0 rounded p-1 text-slate-600 hover:bg-slate-700 hover:text-red-400"
                    aria-label={`Remove ${item.ticket}`}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Dates card */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Dates</p>
        <div className="flex items-center gap-3">
          <label htmlFor="log-date" className="text-sm font-medium text-slate-400">
            Date:
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
            disabled={!stagingDate || logDates.includes(stagingDate)}
            onClick={handleAddDate}
            className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm font-medium text-slate-300
                       active:scale-95 transition-transform duration-100
                       hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add
          </button>
        </div>
        {logDates.length > 0 && (
          <ul className="space-y-1.5">
            {logDates.map((d) => (
              <li
                key={d}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              >
                <span className="text-slate-300">{formatDateDisplay(d)}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveDate(d)}
                  className="ml-2 shrink-0 rounded p-1 text-slate-600 hover:bg-slate-700 hover:text-red-400"
                  aria-label={`Remove date ${d}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Status card */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Status</p>
        <StatusIndicator
          label="TSC Log"
          status={logStatus.state}
          fading={logFading}
          logs={tscLogs}
          message={
            logStatus.state === "success" || logStatus.state === "error"
              ? logStatus.message
              : logStatus.state === "loading"
                ? "Writing to Excel... (browser will open briefly)"
                : undefined
          }
        />
        <StatusIndicator
          label="HRM Log"
          status={hrmStatus.state}
          fading={hrmFading}
          logs={hrmLogs}
          message={
            hrmStatus.state === "success" || hrmStatus.state === "error"
              ? hrmStatus.message
              : hrmStatus.state === "loading"
                ? "Logging to HRM... (browser will open briefly)"
                : undefined
          }
        />
        {stagedTickets.length > 0 && logDates.length > 0 && (
          <div className="rounded-lg border border-blue-900/50 border-l-[3px] border-l-blue-500 bg-blue-950/30 px-4 py-3 text-sm">
            <p className="font-medium text-blue-300">Will log:</p>
            <p className="mt-1 text-blue-400">
              {stagedTickets.map((t) => t.ticket).join(", ")}
            </p>
            <p className="text-blue-500">
              on {logDates.map((d) => formatDateDisplay(d)).join(", ")}
            </p>
          </div>
        )}
      </div>

      {/* Actions card */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Actions</p>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            disabled={stagedTickets.length === 0 || logDates.length === 0 || isLogging}
            onClick={handleLogTsc}
            className="w-full rounded-lg border border-blue-600 bg-transparent px-4 py-2.5 text-sm font-medium text-blue-400
                       active:scale-95 transition-transform duration-100
                       hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Log TSC
          </button>
          <button
            type="button"
            disabled={stagedTickets.length === 0 || isLogging}
            onClick={handleLogHrm}
            className="w-full rounded-lg border border-teal-600 bg-transparent px-4 py-2.5 text-sm font-medium text-teal-400
                       active:scale-95 transition-transform duration-100
                       hover:bg-teal-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Log HRM ({stagedTickets.length})
          </button>
          <button
            type="button"
            disabled={stagedTickets.length === 0 || isLogging}
            onClick={handleLogAll}
            className="w-full rounded-lg bg-violet-700 px-4 py-3 text-sm font-medium text-white
                       active:scale-95 transition-transform duration-100
                       hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {logAllLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
