"use client";

import { useState, useCallback } from "react";
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
  const [hrmTickets, setHrmTickets] = useState<HrmTicketItem[]>([]);
  const [verifiedTickets, setVerifiedTickets] = useState<HrmTicketItem[]>([]);

  const isTicketValid = INPUT_REGEX.test(ticket.trim());
  const { min, max } = getCurrentYearBounds();

  const newTickets = verifiedTickets.filter(
    (v) => !hrmTickets.some((h) => h.ticket === v.ticket)
  );
  const canAddToHrm =
    jiraStatus.state === "success" &&
    newTickets.length > 0 &&
    hrmTickets.length + newTickets.length <= MAX_HRM_TICKETS;

  const handleTicketChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTicket(e.target.value.toUpperCase());
      setJiraStatus({ state: "idle" });
      setLogStatus({ state: "idle" });
      setHrmStatus({ state: "idle" });
      setVerifiedTickets([]);
    },
    []
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
    setVerifiedTickets([]);

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
      setVerifiedTickets(verified);
      setJiraStatus({
        state: "success",
        message: verified.map((v) => v.summary).join(" | "),
      });
    } catch {
      setJiraStatus({ state: "error", message: "Failed to reach Jira API" });
    }
  }, [ticket, isTicketValid]);

  const handleAddToHrm = useCallback(() => {
    if (!canAddToHrm) return;
    setHrmTickets((prev) => [...prev, ...newTickets]);
  }, [newTickets, canAddToHrm]);

  const handleRemoveFromHrm = useCallback((ticketId: string) => {
    setHrmTickets((prev) => prev.filter((t) => t.ticket !== ticketId));
  }, []);

  const isLogging = logStatus.state === "loading" || hrmStatus.state === "loading";

  const handleLogTsc = useCallback(async () => {
    if (jiraStatus.state !== "success" || isLogging) return;

    const tscTicket = hrmTickets.length > 0
      ? hrmTickets.map((t) => t.ticket).join(", ")
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
  }, [ticket, hrmTickets, logDates, jiraStatus.state, logStatus.state, hrmStatus.state]);

  const handleLogHrm = useCallback(async () => {
    if (hrmTickets.length === 0 || isLogging) return;

    setHrmStatus({ state: "loading" });
    try {
      const res = await fetch("/api/hrm/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickets: hrmTickets.map((t) => t.ticket),
          dates: logDates,
        }),
      });
      const data = (await res.json()) as HrmLogResponse;
      if (data.success) {
        const ticketIds = hrmTickets.map((t) => t.ticket).join(", ");
        setHrmStatus({ state: "success", message: `Logged ${ticketIds} to HRM timesheet` });
      } else {
        setHrmStatus({ state: "error", message: data.error ?? "Failed to log to HRM" });
      }
    } catch {
      setHrmStatus({ state: "error", message: "Failed to reach HRM" });
    }
  }, [hrmTickets, logDates, logStatus.state, hrmStatus.state]);

  const handleLogAll = useCallback(async () => {
    if (jiraStatus.state !== "success" || hrmTickets.length === 0 || isLogging) return;

    setLogStatus({ state: "loading" });
    setHrmStatus({ state: "loading" });

    await Promise.all([
      (async () => {
        const tscTicket = hrmTickets.map((t) => t.ticket).join(", ");
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
            body: JSON.stringify({ tickets: hrmTickets.map((t) => t.ticket), dates: logDates }),
          });
          const data = (await res.json()) as HrmLogResponse;
          if (data.success) {
            const ticketIds = hrmTickets.map((t) => t.ticket).join(", ");
            setHrmStatus({ state: "success", message: `Logged ${ticketIds} to HRM timesheet` });
          } else {
            setHrmStatus({ state: "error", message: data.error ?? "Failed to log to HRM" });
          }
        } catch {
          setHrmStatus({ state: "error", message: "Failed to reach HRM" });
        }
      })(),
    ]);
  }, [ticket, logDates, jiraStatus.state, hrmTickets, logStatus.state, hrmStatus.state]);

  return (
    <div className="space-y-6">
      {/* Ticket input + Verify */}
      <div className="flex items-center gap-3">
        <label htmlFor="ticket" className="text-sm font-medium text-gray-700">
          Task:
        </label>
        <input
          id="ticket"
          type="text"
          placeholder="MDP-0000"
          value={ticket}
          onChange={handleTicketChange}
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

      {/* Date picker */}
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
            onChange={(e) => setStagingDate(e.target.value)}
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
                <span className="text-gray-800">{d}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveDate(d)}
                  className="text-red-500 hover:text-red-700 text-xs font-medium"
                  aria-label={`Remove date ${d}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Status indicators */}
      <div className="space-y-2">
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

      {/* HRM ticket list */}
      {hrmTickets.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            HRM Tickets ({hrmTickets.length}/{MAX_HRM_TICKETS}):
          </p>
          <ul className="space-y-1">
            {hrmTickets.map((item) => (
              <li
                key={item.ticket}
                className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-1.5 text-sm"
              >
                <span className="text-gray-800">{item.ticket}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveFromHrm(item.ticket)}
                  className="text-red-500 hover:text-red-700 text-xs font-medium"
                  aria-label={`Remove ${item.ticket}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={jiraStatus.state !== "success" || isLogging}
          onClick={handleLogTsc}
          className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white
                     hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Log TSC
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={!canAddToHrm || isLogging}
            onClick={handleAddToHrm}
            className="flex-1 rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white
                       hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to HRM
          </button>
          <button
            type="button"
            disabled={hrmTickets.length === 0 || isLogging}
            onClick={handleLogHrm}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white
                       hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Log HRM ({hrmTickets.length})
          </button>
        </div>
        <button
          type="button"
          disabled={jiraStatus.state !== "success" || hrmTickets.length === 0 || isLogging}
          onClick={handleLogAll}
          className="w-full rounded-md bg-purple-600 px-4 py-2.5 text-sm font-medium text-white
                     hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Log All (TSC + HRM)
        </button>
      </div>
    </div>
  );
}
