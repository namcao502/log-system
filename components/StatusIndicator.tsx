"use client";

type Status = "idle" | "loading" | "success" | "error";

interface StatusIndicatorProps {
  label: string;
  status: Status;
  message?: string;
}

export default function StatusIndicator({
  label,
  status,
  message,
}: StatusIndicatorProps) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-medium text-gray-700">{label}:</span>

        {status === "idle" && (
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300" />
        )}

        {status === "loading" && (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        )}

        {status === "success" && (
          <span className="text-green-600 font-semibold">&#10003;</span>
        )}

        {status === "error" && (
          <span className="text-red-600 font-semibold">&#10005;</span>
        )}
      </div>

      {message && (
        <span
          className={
            "min-w-0 break-words " +
            (status === "success"
              ? "text-green-700"
              : status === "error"
                ? "text-red-700"
                : status === "loading"
                  ? "text-blue-700"
                  : "text-gray-500")
          }
        >
          {message}
        </span>
      )}
    </div>
  );
}
