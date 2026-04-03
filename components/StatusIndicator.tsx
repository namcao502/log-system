"use client";

type Status = "idle" | "loading" | "success" | "error";

interface StatusIndicatorProps {
  label: string;
  status: Status;
  message?: string;
  fading?: boolean;
}

export default function StatusIndicator({
  label,
  status,
  message,
  fading = false,
}: StatusIndicatorProps) {
  return (
    <div
      className={`flex items-start gap-2 text-sm transition-all duration-200${
        status === "error" ? " animate-shake" : ""
      }`}
    >
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
  );
}
