/**
 * Tests for components/LogForm.tsx
 *
 * Covers:
 * - Input renders with placeholder and label.
 * - Input converts typed text to uppercase.
 * - Verify button disabled when input is empty or invalid format.
 * - Verify button enabled when input matches MDP-XXXX pattern.
 * - Log TSC button disabled until Jira verification succeeds.
 * - Log HRM button disabled until Jira verification succeeds.
 * - Verify happy path: fetch returns valid ticket, success status shown.
 * - Verify error path: fetch returns invalid ticket, error status shown.
 * - Verify network error: fetch throws, error message shown.
 * - Log TSC happy path: fetch returns success, cell info shown.
 * - Log TSC error path: fetch returns failure, error message shown.
 * - Log TSC network error: fetch throws, error message shown.
 * - Log HRM happy path: fetch returns success, success message shown.
 * - Log HRM error path: fetch returns failure, error message shown.
 * - Log HRM network error: fetch throws, error message shown.
 * - Changing input resets both statuses.
 * - Verify button disabled while loading.
 * - Log TSC button disabled while logging is in progress.
 * - Log HRM button disabled while HRM logging is in progress.
 * - Cross-button state isolation: clicking one log button resets the other's status.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LogForm from "@/components/LogForm";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();

let resolvePendingFetch: (() => void) | null = null;

function pendingFetchResponse() {
  return new Promise<Response>((resolve) => {
    resolvePendingFetch = () =>
      resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: false }),
      } as Response);
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = mockFetch;
});

afterEach(() => {
  jest.restoreAllMocks();
  resolvePendingFetch?.();
  resolvePendingFetch = null;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

async function typeTicket(user: ReturnType<typeof userEvent.setup>, value: string) {
  const input = screen.getByPlaceholderText("MDP-0000");
  await user.clear(input);
  await user.type(input, value);
}

async function verifySuccessFlow(user: ReturnType<typeof userEvent.setup>) {
  mockFetch.mockReturnValueOnce(
    jsonResponse({ valid: true, summary: "Fix login bug" })
  );
  await typeTicket(user, "MDP-1234");
  await user.click(screen.getByRole("button", { name: /verify/i }));
  await waitFor(() =>
    expect(screen.getByText(/Fix login bug/)).toBeInTheDocument()
  );
}

// ---------------------------------------------------------------------------
// Input rendering
// ---------------------------------------------------------------------------

describe("LogForm -- input rendering", () => {
  it("renders ticket input with placeholder", () => {
    render(<LogForm />);
    expect(screen.getByPlaceholderText("MDP-0000")).toBeInTheDocument();
  });

  it("renders the Task label", () => {
    render(<LogForm />);
    expect(screen.getByText("Task:")).toBeInTheDocument();
  });

  it("converts typed text to uppercase", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await typeTicket(user, "mdp-1234");
    expect(screen.getByPlaceholderText("MDP-0000")).toHaveValue("MDP-1234");
  });
});

// ---------------------------------------------------------------------------
// Verify button disabled states
// ---------------------------------------------------------------------------

describe("LogForm -- Verify button disabled states", () => {
  it("is disabled when input is empty", () => {
    render(<LogForm />);
    expect(screen.getByRole("button", { name: /verify/i })).toBeDisabled();
  });

  it("is disabled when input does not match MDP-XXXX pattern", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await typeTicket(user, "INVALID");
    expect(screen.getByRole("button", { name: /verify/i })).toBeDisabled();
  });

  it("is disabled for partial match like MDP-", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await typeTicket(user, "MDP-");
    expect(screen.getByRole("button", { name: /verify/i })).toBeDisabled();
  });

  it("is disabled for MDP without hyphen", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await typeTicket(user, "MDP1234");
    expect(screen.getByRole("button", { name: /verify/i })).toBeDisabled();
  });

  it("is enabled when input matches MDP-XXXX pattern", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await typeTicket(user, "MDP-5678");
    expect(screen.getByRole("button", { name: /verify/i })).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Log TSC button disabled states
// ---------------------------------------------------------------------------

describe("LogForm -- Log TSC button disabled states", () => {
  it("is disabled before verification", () => {
    render(<LogForm />);
    expect(screen.getByRole("button", { name: /log tsc/i })).toBeDisabled();
  });

  it("is enabled after successful verification", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await verifySuccessFlow(user);
    expect(screen.getByRole("button", { name: /log tsc/i })).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Log HRM button disabled states
// ---------------------------------------------------------------------------

describe("LogForm -- Log HRM button disabled states", () => {
  it("is disabled before verification", () => {
    render(<LogForm />);
    expect(screen.getByRole("button", { name: /log hrm/i })).toBeDisabled();
  });

  it("is enabled after successful verification", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await verifySuccessFlow(user);
    expect(screen.getByRole("button", { name: /log hrm/i })).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Verify fetch -- happy path
// ---------------------------------------------------------------------------

describe("LogForm -- Verify happy path", () => {
  it("shows ticket summary on successful verification", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    mockFetch.mockReturnValueOnce(
      jsonResponse({ valid: true, summary: "Implement dashboard" })
    );

    await typeTicket(user, "MDP-9999");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() =>
      expect(screen.getByText(/Implement dashboard/)).toBeInTheDocument()
    );
  });

  it("calls fetch with the correct URL including ticket param", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    mockFetch.mockReturnValueOnce(
      jsonResponse({ valid: true, summary: "Test" })
    );

    await typeTicket(user, "MDP-42");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/jira/verify?ticket=MDP-42"
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Verify fetch -- error paths
// ---------------------------------------------------------------------------

describe("LogForm -- Verify error paths", () => {
  it("shows error when ticket is not found on Jira", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    mockFetch.mockReturnValueOnce(
      jsonResponse({ valid: false, error: "Ticket not found" })
    );

    await typeTicket(user, "MDP-0001");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() =>
      expect(screen.getByText("Ticket not found")).toBeInTheDocument()
    );
  });

  it("shows fallback error when valid is false and no error message", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    mockFetch.mockReturnValueOnce(jsonResponse({ valid: false }));

    await typeTicket(user, "MDP-0002");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() =>
      expect(screen.getByText("Ticket not found")).toBeInTheDocument()
    );
  });

  it("shows network error when fetch throws", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await typeTicket(user, "MDP-0003");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() =>
      expect(screen.getByText("Failed to reach Jira API")).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// Log TSC fetch -- happy path
// ---------------------------------------------------------------------------

describe("LogForm -- Log TSC happy path", () => {
  it("shows cell info on successful log", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await verifySuccessFlow(user);

    mockFetch.mockReturnValueOnce(
      jsonResponse({ success: true, cell: "O66" })
    );

    await user.click(screen.getByRole("button", { name: /log tsc/i }));

    await waitFor(() =>
      expect(screen.getByText(/Logged "MDP-1234" at cell O66/)).toBeInTheDocument()
    );
  });

  it("sends POST to /api/sharepoint/log with ticket in body", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await verifySuccessFlow(user);

    mockFetch.mockReturnValueOnce(
      jsonResponse({ success: true, cell: "O66" })
    );

    await user.click(screen.getByRole("button", { name: /log tsc/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/sharepoint/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: "MDP-1234" }),
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Log TSC fetch -- error paths
// ---------------------------------------------------------------------------

describe("LogForm -- Log TSC error paths", () => {
  it("shows error when log API returns failure", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await verifySuccessFlow(user);

    mockFetch.mockReturnValueOnce(
      jsonResponse({ success: false, error: "Browser automation failed" })
    );

    await user.click(screen.getByRole("button", { name: /log tsc/i }));

    await waitFor(() =>
      expect(screen.getByText("Browser automation failed")).toBeInTheDocument()
    );
  });

  it("shows fallback error when success is false and no error message", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await verifySuccessFlow(user);

    mockFetch.mockReturnValueOnce(jsonResponse({ success: false }));

    await user.click(screen.getByRole("button", { name: /log tsc/i }));

    await waitFor(() =>
      expect(screen.getByText("Failed to log")).toBeInTheDocument()
    );
  });

  it("shows network error when log fetch throws", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await verifySuccessFlow(user);

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await user.click(screen.getByRole("button", { name: /log tsc/i }));

    await waitFor(() =>
      expect(screen.getByText("Failed to write to Excel")).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// Log HRM fetch -- happy path
// ---------------------------------------------------------------------------

describe("LogForm -- Log HRM happy path", () => {
  it("shows success message on successful HRM log", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await verifySuccessFlow(user);
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    await waitFor(() =>
      expect(screen.getByText(/Logged "MDP-1234" to HRM timesheet/)).toBeInTheDocument()
    );
  });

  it("sends POST to /api/hrm/log with tickets array in body", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await verifySuccessFlow(user);
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/hrm/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickets: ["MDP-1234"] }),
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Log HRM fetch -- error paths
// ---------------------------------------------------------------------------

describe("LogForm -- Log HRM error paths", () => {
  it("shows error when HRM API returns failure", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await verifySuccessFlow(user);
    mockFetch.mockReturnValueOnce(
      jsonResponse({ success: false, error: "HRM automation failed" })
    );
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    await waitFor(() =>
      expect(screen.getByText("HRM automation failed")).toBeInTheDocument()
    );
  });

  it("shows fallback error when success is false and no error message", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await verifySuccessFlow(user);
    mockFetch.mockReturnValueOnce(jsonResponse({ success: false }));
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    await waitFor(() =>
      expect(screen.getByText("Failed to log to HRM")).toBeInTheDocument()
    );
  });

  it("shows network error when HRM fetch throws", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await verifySuccessFlow(user);
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    await waitFor(() =>
      expect(screen.getByText("Failed to reach HRM")).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// Status reset on input change
// ---------------------------------------------------------------------------

describe("LogForm -- status reset on input change", () => {
  it("resets Jira status when ticket input changes", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await verifySuccessFlow(user);
    expect(screen.getByText(/Fix login bug/)).toBeInTheDocument();

    await typeTicket(user, "MDP-9999");

    expect(screen.queryByText(/Fix login bug/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Loading states
// ---------------------------------------------------------------------------

describe("LogForm -- loading states", () => {
  it("disables Verify button while verification is in progress", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    mockFetch.mockReturnValueOnce(pendingFetchResponse());

    await typeTicket(user, "MDP-1234");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(screen.getByRole("button", { name: /verify/i })).toBeDisabled();
  });

  it("shows Verifying... message during loading", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    mockFetch.mockReturnValueOnce(pendingFetchResponse());

    await typeTicket(user, "MDP-1234");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(screen.getByText("Verifying...")).toBeInTheDocument();
  });

  it("disables Log TSC button while logging is in progress", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await verifySuccessFlow(user);

    mockFetch.mockReturnValueOnce(pendingFetchResponse());

    await user.click(screen.getByRole("button", { name: /log tsc/i }));

    expect(screen.getByRole("button", { name: /log tsc/i })).toBeDisabled();
  });

  it("shows Writing... message during log loading", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await verifySuccessFlow(user);

    mockFetch.mockReturnValueOnce(pendingFetchResponse());

    await user.click(screen.getByRole("button", { name: /log tsc/i }));

    expect(screen.getByText("Writing to Excel... (browser will open briefly)")).toBeInTheDocument();
  });

  it("disables Log HRM button while HRM logging is in progress", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await verifySuccessFlow(user);
    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    expect(screen.getByRole("button", { name: /log hrm/i })).toBeDisabled();
  });

  it("shows Logging to HRM... message during HRM loading", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await verifySuccessFlow(user);
    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    expect(screen.getByText("Logging to HRM... (browser will open briefly)")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Cross-button state isolation
// ---------------------------------------------------------------------------

describe("LogForm -- cross-button state isolation", () => {
  it("resets HRM status when Log TSC is clicked", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await verifySuccessFlow(user);

    // Log to HRM -> get an error
    mockFetch.mockReturnValueOnce(
      jsonResponse({ success: false, error: "HRM error" })
    );
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    await waitFor(() => expect(screen.getByText("HRM error")).toBeInTheDocument());

    // Click Log TSC -> HRM status should reset (message gone)
    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    await user.click(screen.getByRole("button", { name: /log tsc/i }));

    await waitFor(() =>
      expect(screen.queryByText("HRM error")).not.toBeInTheDocument()
    );
  });

  it("resets TSC status when Log HRM is clicked", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await verifySuccessFlow(user);

    // Log to TSC -> get an error
    mockFetch.mockReturnValueOnce(
      jsonResponse({ success: false, error: "TSC error" })
    );
    await user.click(screen.getByRole("button", { name: /log tsc/i }));
    await waitFor(() => expect(screen.getByText("TSC error")).toBeInTheDocument());

    // Click Log HRM -> TSC status should reset (message gone)
    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    await user.click(screen.getByRole("button", { name: /log hrm/i }));

    await waitFor(() =>
      expect(screen.queryByText("TSC error")).not.toBeInTheDocument()
    );
  });
});
