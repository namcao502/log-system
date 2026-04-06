"use client";

import type { ReactNode } from "react";

type Status = "idle" | "loading" | "success" | "error";

interface StatusIndicatorProps {
  label: string;
  status: Status;
  message?: string;
  fading?: boolean;
  logs?: string[];
}

function colorizeLogLine(line: string): ReactNode {
  const match = line.match(/^(\[[^\]]+\])( \[\d+\.\d+s\])?(.*)$/);
  if (!match) return <span className="text-slate-400">{line}</span>;
  const [, prefix, timestamp, rest] = match;
  return (
    <>
      <span className="text-blue-500">{prefix}</span>
      {timestamp && <span className="text-slate-600">{timestamp}</span>}
      {rest && <span className="text-slate-400">{rest}</span>}
    </>
  );
}

export default function StatusIndicator({
  label,
  status,
  message,
  fading = false,
  logs,
}: StatusIndicatorProps) {
  const hasLogs = logs !== undefined && logs.length > 0;

  return (
    <div
      className={`text-sm transition-all duration-200${
        status === "error" ? " animate-shake" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-medium text-slate-400">{label}:</span>

          {status === "idle" && (
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-600 transition-colors duration-300" />
          )}

          {status === "loading" && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
          )}

          {status === "success" && (
            <span className="font-semibold text-green-500 transition-colors duration-300">&#10003;</span>
          )}

          {status === "error" && (
            <span className="font-semibold text-red-500">&#10005;</span>
          )}
        </div>

        {message && (
          <span
            className={
              "min-w-0 break-words transition-opacity duration-500 " +
              (fading ? "opacity-0 " : "opacity-100 ") +
              (status === "success"
                ? "text-green-400"
                : status === "error"
                  ? "text-red-400"
                  : status === "loading"
                    ? "text-blue-400"
                    : "text-slate-500")
            }
          >
            {message}
          </span>
        )}
      </div>

      {hasLogs && (
        <pre className="mt-1.5 h-[211px] overflow-y-auto rounded-lg bg-slate-950 px-3 py-2 text-xs leading-relaxed">
          {logs.map((line, i) => (
            <div key={i}>{colorizeLogLine(line)}</div>
          ))}
        </pre>
      )}
    </div>
  );
}
