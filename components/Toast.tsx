"use client";

import { useEffect } from "react";
import type { Toast } from "@/lib/types";

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const TOAST_DURATION = 4000;

const styles = {
  success: {
    bg: "bg-green-50",
    border: "border-green-200 border-l-green-500",
    title: "text-green-700",
    detail: "text-green-600",
    dismiss: "text-green-400 hover:text-green-600",
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200 border-l-red-500",
    title: "text-red-700",
    detail: "text-red-600",
    dismiss: "text-red-400 hover:text-red-600",
  },
  info: {
    bg: "bg-teal-50",
    border: "border-teal-200 border-l-teal-500",
    title: "text-teal-700",
    detail: "text-teal-600",
    dismiss: "text-teal-400 hover:text-teal-600",
  },
};

export default function Toast({ toast, onDismiss }: ToastProps) {
  const s = styles[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-lg border border-l-[3px] px-4 py-3 shadow-lg ${s.bg} ${s.border}`}
      role="alert"
    >
      <div className="min-w-0">
        <p className={`text-xs font-semibold ${s.title}`}>{toast.title}</p>
        <p className={`mt-0.5 text-xs ${s.detail}`}>{toast.detail}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className={`shrink-0 text-sm leading-none ${s.dismiss}`}
        aria-label="Dismiss"
      >
        &#x2715;
      </button>
    </div>
  );
}
