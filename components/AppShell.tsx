"use client";

import { useCallback } from "react";
import { useNotifications } from "@/lib/useNotifications";
import { useToasts } from "@/lib/useToasts";
import { useTheme } from "@/lib/useTheme";
import type { Notification } from "@/lib/types";
import NotificationBell from "./NotificationBell";
import ThemePicker from "./ThemePicker";
import ToastContainer from "./ToastContainer";
import LogForm from "./LogForm";

interface AppShellProps {
  today: string;
}

export default function AppShell({ today }: AppShellProps) {
  const { notifications, unreadCount, addNotification, markRead, clearAll } =
    useNotifications();
  const { toasts, addToast, dismissToast } = useToasts();
  const { color, setColor } = useTheme();

  const notify = useCallback(
    (n: Omit<Notification, "id" | "timestamp">) => {
      addNotification(n);
      addToast(n);
    },
    [addNotification, addToast]
  );

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white/95">Welcome, Nam Nguyen</h1>
          <p className="mt-1 text-sm text-white/45">Today: {today}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemePicker color={color} onChange={setColor} />
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onOpen={markRead}
            onClearAll={clearAll}
          />
        </div>
      </div>
      <div className="mt-6">
        <LogForm onNotify={notify} />
      </div>
    </>
  );
}
