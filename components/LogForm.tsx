"use client";

import { useState, useCallback } from "react";
import type { JiraVerifyResponse, LogResponse, HrmLogResponse } from "@/lib/types";
import StatusIndicator from "./StatusIndicator";

type AsyncStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "success"; message: string }
  | { state: "error"; message: string };

const TICKET_REGEX = /^MDP-\d+$/;

export default function LogForm() {
  const [ticket, setTicket] = useState("");
  const [jiraStatus, setJiraStatus] = useState<AsyncStatus>({ state: "idle" });
  const [logStatus, setLogStatus] = useState<AsyncStatus>({ state: "idle" });
  const [hrmStatus, setHrmStatus] = useState<AsyncStatus>({ state: "idle" });

  const isTicketValid = TICKET_REGEX.test(ticket);

  const handleTicketChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTicket(e.target.value.toUpperCase());
      setJiraStatus({ state: "idle" });
      setLogStatus({ state: "idle" });
      setHrmStatus({ state: "idle" });
    },
    []
  );

  const handleVerify = useCallback(async () => {
    if (!isTicketValid) return;

    setJiraStatus({ state: "loading" });
    setLogStatus({ state: "idle" });
    setHrmStatus({ state: "idle" });

    try {
      const res = await fetch(
        `/api/jira/verify?ticket=${encodeURIComponent(ticket)}`
      );
      const data: JiraVerifyResponse = await res.json();

      if (data.valid) {
        setJiraStatus({
          state: "success",
          message: `${ticket} — ${data.summary ?? "No summary"}`,
        });
      } else {
        setJiraStatus({
          state: "error",
          message: data.error ?? "Ticket not found",
        });
      }
    } catch {
      setJiraStatus({ state: "error", message: "Failed to reach Jira API" });
    }
  }, [ticket, isTicketValid]);

  const isLogging = logStatus.state === "loading" || hrmStatus.state === "loading";

  const handleLogTsc = useCallback(async () => {
    if (jiraStatus.state !== "success") return;

    setLogStatus({ state: "loading" });
    setHrmStatus({ state: "idle" });
    try {
      const res = await fetch("/api/sharepoint/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket }),
      });
      const data = (await res.json()) as LogResponse;
      if (data.success) {
        setLogStatus({ state: "success", message: `Logged "${ticket}" at cell ${data.cell ?? "O"}` });
      } else {
        setLogStatus({ state: "error", message: data.error ?? "Failed to log" });
      }
    } catch {
      setLogStatus({ state: "error", message: "Failed to write to Excel" });
    }
  }, [ticket, jiraStatus.state]);

  const handleLogHrm = useCallback(async () => {
    if (jiraStatus.state !== "success") return;

    setHrmStatus({ state: "loading" });
    setLogStatus({ state: "idle" });
    try {
      const res = await fetch("/api/hrm/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickets: [ticket] }),
      });
      const data = (await res.json()) as HrmLogResponse;
      if (data.success) {
        setHrmStatus({ state: "success", message: `Logged "${ticket}" to HRM timesheet` });
      } else {
        setHrmStatus({ state: "error", message: data.error ?? "Failed to log to HRM" });
      }
    } catch {
      setHrmStatus({ state: "error", message: "Failed to reach HRM" });
    }
  }, [ticket, jiraStatus.state]);

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

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={jiraStatus.state !== "success" || isLogging}
          onClick={handleLogTsc}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white
                     hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Log TSC
        </button>
        <button
          type="button"
          disabled={jiraStatus.state !== "success" || isLogging}
          onClick={handleLogHrm}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white
                     hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Log HRM
        </button>
      </div>
    </div>
  );
}
