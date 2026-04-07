"use client";

import type { ReactNode } from "react";

function colorizeLogLine(line: string): ReactNode {
  const match = line.match(/^(\[[^\]]+\])( \[\d+\.\d+s\])?(.*)$/);
  if (!match) return <span className="text-gray-400">{line}</span>;
  const [, prefix, timestamp, rest] = match;
  return (
    <>
      <span className="text-emerald-400">{prefix}</span>
      {timestamp && <span className="text-gray-500">{timestamp}</span>}
      {rest && <span className="text-gray-400">{rest}</span>}
    </>
  );
}

interface LogPanelProps {
  logs: string[];
}

export default function LogPanel({ logs }: LogPanelProps) {
  if (logs.length === 0) return null;
  return (
    <pre className="scrollbar-dark h-[211px] overflow-y-auto rounded-lg bg-[#022c22] px-3 py-2 text-xs leading-relaxed">
      {logs.map((line, i) => (
        <div key={i}>{colorizeLogLine(line)}</div>
      ))}
    </pre>
  );
}
