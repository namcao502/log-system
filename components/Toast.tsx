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
    bg: "bg-green-500/10",
    border: "border-green-500/20 border-l-green-500",
    title: "text-green-400",
    detail: "text-green-400/70",
    dismiss: "text-green-500/50 hover:text-green-400",
  },
  error: {
    bg: "bg-red-500/10",
    border: "border-red-500/20 border-l-red-500",
    title: "text-red-400",
    detail: "text-red-400/70",
    dismiss: "text-red-500/50 hover:text-red-400",
  },
  info: {
    bg: "bg-white/5",
    border: "border-white/10 border-l-[var(--t-400)]",
    title: "text-[var(--t-300)]",
    detail: "text-[var(--t-300)]/70",
    dismiss: "text-[var(--t-400)]/50 hover:text-[var(--t-300)]",
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
      className={`flex items-start justify-between gap-3 rounded-xl border border-l-[3px] px-4 py-3 shadow-2xl backdrop-blur-xl ${s.bg} ${s.border}`}
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
