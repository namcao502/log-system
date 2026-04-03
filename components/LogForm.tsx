"use client";

import { useState, useCallback, useEffect } from "react";
import type { JiraVerifyResponse, LogResponse, HrmLogResponse } from "@/lib/types";
import StatusIndicator from "./StatusIndicator";

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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
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
    } catch {
      setJiraStatus({ state: "error", message: "Failed to reach Jira API" });
    }
  }, [ticket, isTicketValid]);

  const handleRemoveFromStaged = useCallback((ticketId: string) => {
    setStagedTickets((prev) => prev.filter((t) => t.ticket !== ticketId));
  }, []);

  const isLogging = logStatus.state === "loading" || hrmStatus.state === "loading";

  useEffect(() => {
    if (jiraStatus.state !== "success") return;
    const id = setTimeout(() => setJiraStatus({ state: "idle" }), 10000);
    return () => clearTimeout(id);
  }, [jiraStatus.state]);

  useEffect(() => {
    if (logStatus.state !== "success") return;
    const id = setTimeout(() => setLogStatus({ state: "idle" }), 10000);
    return () => clearTimeout(id);
  }, [logStatus.state]);

  useEffect(() => {
    if (hrmStatus.state !== "success") return;
    const id = setTimeout(() => setHrmStatus({ state: "idle" }), 10000);
    return () => clearTimeout(id);
  }, [hrmStatus.state]);

  const handleLogTsc = useCallback(async () => {
    if (jiraStatus.state !== "success" || isLogging) return;

    const tscTicket = stagedTickets.length > 0
      ? stagedTickets.map((t) => t.ticket).join(", ")
      : ticket;

    setLogStatus({ state: "loading" });
    try {
      const res = await fetch("/api/sharepoint/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: tscTicket, dates: logDates }),
      });
      const data = (await res.json()) as LogResponse;
      if (data.success) {
        setLogStatus({ state: "success", message: `Logged "${tscTicket}" at cell ${data.cell ?? "O"}` });
      } else {
        setLogStatus({ state: "error", message: data.error ?? "Failed to log" });
      }
    } catch {
      setLogStatus({ state: "error", message: "Failed to write to Excel" });
    }
  }, [ticket, stagedTickets, logDates, jiraStatus.state]);

  const handleLogHrm = useCallback(async () => {
    if (stagedTickets.length === 0 || isLogging) return;

    setHrmStatus({ state: "loading" });
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
      } else {
        setHrmStatus({ state: "error", message: data.error ?? "Failed to log to HRM" });
      }
    } catch {
      setHrmStatus({ state: "error", message: "Failed to reach HRM" });
    }
  }, [stagedTickets, logDates]);

  const handleLogAll = useCallback(async () => {
    if (jiraStatus.state !== "success" || stagedTickets.length === 0 || isLogging) return;

    setLogStatus({ state: "loading" });
    setHrmStatus({ state: "loading" });

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
          } else {
            setLogStatus({ state: "error", message: data.error ?? "Failed to log" });
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
          } else {
            setHrmStatus({ state: "error", message: data.error ?? "Failed to log to HRM" });
          }
        } catch {
          setHrmStatus({ state: "error", message: "Failed to reach HRM" });
        }
      })(),
    ]);
  }, [logDates, jiraStatus.state, stagedTickets, logStatus.state, hrmStatus.state]);

  const logAllLabel = `Log All — ${stagedTickets.length} ticket${stagedTickets.length !== 1 ? "s" : ""} × ${logDates.length} date${logDates.length !== 1 ? "s" : ""}`;

  return (
    <div className="space-y-5">
      {/* Tickets section */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Tickets</p>
        <div className="flex items-center gap-3">
        <label htmlFor="ticket" className="text-sm font-medium text-gray-700">
          Task:
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
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm
                     focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          disabled={!isTicketValid || jiraStatus.state === "loading"}
          onClick={handleVerify}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white
                     hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Verify
        </button>
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Dates section */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Dates</p>
        <div className="space-y-2">
        <div className="flex items-center gap-3">
          <label htmlFor="log-date" className="text-sm font-medium text-gray-700">
            Date:
          </label>
          <input
            id="log-date"
            type="date"
            value={stagingDate}
            min={min}
            max={max}
            onChange={handleStagingDateChange}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm
                       focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            disabled={!stagingDate || logDates.includes(stagingDate)}
            onClick={handleAddDate}
            className="rounded-md bg-gray-600 px-3 py-2 text-sm font-medium text-white
                       hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add
          </button>
        </div>
        {logDates.length > 0 && (
          <ul className="space-y-1">
            {logDates.map((d) => (
              <li
                key={d}
                className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-1.5 text-sm"
              >
                <span className="text-gray-800">{formatDateDisplay(d)}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveDate(d)}
                  className="ml-2 shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  aria-label={`Remove date ${d}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        </div>
      </div>

      {/* Summary banner */}
      {stagedTickets.length > 0 && logDates.length > 0 && (
        <>
          <hr className="border-gray-100" />
          <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
            <p className="font-medium text-blue-800">Will log:</p>
            <p className="mt-1 text-blue-700">
              {stagedTickets.map((t) => t.ticket).join(", ")}
            </p>
            <p className="text-blue-600">
              on {logDates.map((d) => formatDateDisplay(d)).join(", ")}
            </p>
          </div>
        </>
      )}

      <hr className="border-gray-100" />

      {/* Status indicators */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Status</p>
        <StatusIndicator
          label="Jira"
          status={jiraStatus.state}
          message={
            jiraStatus.state === "success" || jiraStatus.state === "error"
              ? jiraStatus.message
              : jiraStatus.state === "loading"
                ? "Verifying..."
                : undefined
          }
        />
        <StatusIndicator
          label="TSC Log"
          status={logStatus.state}
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
          message={
            hrmStatus.state === "success" || hrmStatus.state === "error"
              ? hrmStatus.message
              : hrmStatus.state === "loading"
                ? "Logging to HRM... (browser will open briefly)"
                : undefined
          }
        />
      </div>

      {/* Staged ticket list */}
      {stagedTickets.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            Staged Tickets ({stagedTickets.length}/{MAX_HRM_TICKETS}):
          </p>
          <ul className="space-y-1">
            {stagedTickets.map((item) => {
              const description = item.summary.slice(item.ticket.length + 3);
              return (
                <li
                  key={item.ticket}
                  className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-1.5 text-sm"
                >
                  <span className="flex flex-col min-w-0">
                    <span className="font-medium text-gray-800">{item.ticket}</span>
                    {description && (
                      <span className="truncate text-xs text-gray-500">{description}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFromStaged(item.ticket)}
                    className="ml-3 shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    aria-label={`Remove ${item.ticket}`}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <hr className="border-gray-100" />

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={jiraStatus.state !== "success" || logDates.length === 0 || isLogging}
          onClick={handleLogTsc}
          className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white
                     hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Log TSC
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={stagedTickets.length === 0 || isLogging}
            onClick={handleLogHrm}
            className="flex-1 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-medium text-white
                       hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Log HRM ({stagedTickets.length})
          </button>
        </div>
        <button
          type="button"
          disabled={jiraStatus.state !== "success" || stagedTickets.length === 0 || isLogging}
          onClick={handleLogAll}
          className="w-full rounded-md bg-purple-600 px-4 py-2.5 text-sm font-medium text-white
                     hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {logAllLabel}
        </button>
      </div>
    </div>
  );
}
