"use client";

import { useState, useCallback } from "react";
import type { Notification } from "./types";

const MAX_NOTIFICATIONS = 50;

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const addNotification = useCallback(
    (n: Omit<Notification, "id" | "timestamp">) => {
      const notification: Notification = {
        ...n,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      setNotifications((prev) => {
        const next = [notification, ...prev];
        return next.length > MAX_NOTIFICATIONS ? next.slice(0, MAX_NOTIFICATIONS) : next;
      });
      setUnreadCount((prev) => prev + 1);
    },
    []
  );

  const markRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, addNotification, markRead, clearAll };
}
