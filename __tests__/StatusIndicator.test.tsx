/**
 * Tests for components/StatusIndicator.tsx
 *
 * Covers:
 * - Renders label text for all states.
 * - Idle state: grey dot, no message.
 * - Loading state: spinner element, optional message.
 * - Success state: checkmark character, message in green.
 * - Error state: cross character, message in red.
 * - No message rendered when message prop is undefined.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import StatusIndicator from "@/components/StatusIndicator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderIndicator(
  overrides: Partial<React.ComponentProps<typeof StatusIndicator>> = {}
) {
  const props = { label: "Jira", status: "idle" as const, ...overrides };
  return render(<StatusIndicator {...props} />);
}

// ---------------------------------------------------------------------------
// Label rendering
// ---------------------------------------------------------------------------

describe("StatusIndicator -- label", () => {
  it("renders the label text", () => {
    renderIndicator({ label: "TSC Log" });
    expect(screen.getByText("TSC Log:")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Idle state
// ---------------------------------------------------------------------------

describe("StatusIndicator -- idle state", () => {
  it("renders a grey dot when status is idle", () => {
    const { container } = renderIndicator({ status: "idle" });
    const dot = container.querySelector("span.bg-slate-600");
    expect(dot).toBeInTheDocument();
  });

  it("does not render a message when message is undefined", () => {
    const { container } = renderIndicator({ status: "idle" });
    // Only the label span and the dot span should be present
    const spans = container.querySelectorAll("span");
    // label span + dot span = 2
    expect(spans.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("StatusIndicator -- loading state", () => {
  it("renders a spinning indicator when status is loading", () => {
    const { container } = renderIndicator({ status: "loading" });
    const spinner = container.querySelector("span.animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("renders the message in blue when provided", () => {
    renderIndicator({ status: "loading", message: "Verifying..." });
    const msg = screen.getByText("Verifying...");
    expect(msg).toHaveClass("text-blue-400");
  });

  it("does not render a grey dot or checkmark", () => {
    const { container } = renderIndicator({ status: "loading" });
    expect(container.querySelector("span.bg-slate-600")).not.toBeInTheDocument();
    expect(screen.queryByText("\u2713")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Success state
// ---------------------------------------------------------------------------

describe("StatusIndicator -- success state", () => {
  it("renders a green checkmark", () => {
    renderIndicator({ status: "success", message: "OK" });
    // Checkmark character: ✓ (U+2713)
    const check = screen.getByText("\u2713");
    expect(check).toHaveClass("text-green-500");
  });

  it("renders the message in green", () => {
    renderIndicator({ status: "success", message: "MDP-1234 -- Summary" });
    const msg = screen.getByText("MDP-1234 -- Summary");
    expect(msg).toHaveClass("text-green-400");
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("StatusIndicator -- error state", () => {
  it("renders a red cross", () => {
    renderIndicator({ status: "error", message: "Not found" });
    // Cross character: ✕ (U+2715)
    const cross = screen.getByText("\u2715");
    expect(cross).toHaveClass("text-red-500");
  });

  it("renders the message in red", () => {
    renderIndicator({ status: "error", message: "Ticket not found" });
    const msg = screen.getByText("Ticket not found");
    expect(msg).toHaveClass("text-red-400");
  });
});

// ---------------------------------------------------------------------------
// Message rendering
// ---------------------------------------------------------------------------

describe("StatusIndicator -- message prop", () => {
  it("does not render a message span when message is undefined in success state", () => {
    const { container } = renderIndicator({ status: "success" });
    // Should have label span + checkmark span = 2
    const spans = container.querySelectorAll("span");
    expect(spans.length).toBe(2);
  });
});
