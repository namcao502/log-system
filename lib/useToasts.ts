"use client";

import { useState, useCallback } from "react";
import type { Toast } from "./types";

const MAX_TOASTS = 5;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const toast: Toast = { ...t, id: crypto.randomUUID() };
    setToasts((prev) => {
      const next = [toast, ...prev];
      return next.length > MAX_TOASTS ? next.slice(0, MAX_TOASTS) : next;
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}
