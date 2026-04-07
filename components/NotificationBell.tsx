"use client";

import { useState, useRef, useEffect } from "react";
import type { Notification } from "@/lib/types";

function formatRelativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onOpen: () => void;
  onClearAll: () => void;
}

const typeColors: Record<Notification["type"], string> = {
  success: "text-green-600",
  error: "text-red-600",
  info: "text-teal-600",
};

export default function NotificationBell({
  notifications,
  unreadCount,
  onOpen,
  onClearAll,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function handleToggle() {
    const opening = !open;
    setOpen(opening);
    if (opening) onOpen();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 text-lg hover:border-emerald-300"
      >
        &#x1F514;
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-xl">
          <div className="flex items-center justify-between border-b border-emerald-200 px-4 py-3">
            <span className="text-xs font-semibold text-gray-700">Notifications</span>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-gray-400">No notifications</p>
            ) : (
              <ul className="divide-y divide-emerald-100">
                {notifications.map((n) => (
                  <li key={n.id} className="flex items-start justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${typeColors[n.type]}`}>{n.title}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{n.detail}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-gray-400">
                      {formatRelativeTime(n.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
