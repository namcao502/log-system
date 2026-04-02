/**
 * Tests for components/LogForm.tsx
 *
 * Covers:
 * - Input renders with placeholder and label.
 * - Input converts typed text to uppercase.
 * - Verify button disabled when input is empty or invalid format.
 * - Verify button enabled when input matches MDP-XXXX pattern.
 * - Log TSC button disabled until Jira verification succeeds.
 * - Log HRM button disabled when HRM ticket list is empty.
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
 * - HRM multi-ticket: add to list, remove from list, send all.
 * - Log All: disabled when Jira not verified or HRM list empty or in-flight.
 * - Log All: fires both fetches in parallel, statuses update independently.
 * - Log All: both success, partial failure (TSC only, HRM only).
 * - Log All: input change resets both statuses after completion.
 */

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

async function addTicketToHrm(
  user: ReturnType<typeof userEvent.setup>,
  ticketId: string,
  summary: string
) {
  mockFetch.mockReturnValueOnce(
    jsonResponse({ valid: true, summary })
  );
  await typeTicket(user, ticketId);
  await user.click(screen.getByRole("button", { name: /verify/i }));
  await waitFor(() =>
    expect(screen.getByText(new RegExp(summary))).toBeInTheDocument()
  );
  await user.click(screen.getByRole("button", { name: /add to hrm/i }));
}

function getTodayISO(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
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
  it("is disabled when HRM ticket list is empty", () => {
    render(<LogForm />);
    expect(screen.getByRole("button", { name: /log hrm/i })).toBeDisabled();
  });

  it("is enabled after adding a ticket to HRM list", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");
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

  it("sends POST to /api/sharepoint/log with ticket and date in body", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await verifySuccessFlow(user);

    mockFetch.mockReturnValueOnce(
      jsonResponse({ success: true, cell: "O66" })
    );

    await user.click(screen.getByRole("button", { name: /log tsc/i }));

    await waitFor(() => {
      const call = mockFetch.mock.calls.find(([url]: [string]) => url === "/api/sharepoint/log");
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body).toMatchObject({ ticket: "MDP-1234" });
      expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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
// Log HRM fetch -- happy path (multi-ticket)
// ---------------------------------------------------------------------------

describe("LogForm -- Log HRM happy path", () => {
  it("shows success message on successful HRM log", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    await waitFor(() =>
      expect(screen.getByText(/Logged MDP-1234 to HRM timesheet/)).toBeInTheDocument()
    );
  });

  it("sends POST to /api/hrm/log with tickets array and date in body", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    await waitFor(() => {
      const call = mockFetch.mock.calls.find(([url]: [string]) => url === "/api/hrm/log");
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body).toMatchObject({ tickets: ["MDP-1234"] });
      expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it("sends multiple tickets when multiple are added to HRM list", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-100", "Feature A");
    await addTicketToHrm(user, "MDP-200", "Feature B");
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    await waitFor(() => {
      const call = mockFetch.mock.calls.find(([url]: [string]) => url === "/api/hrm/log");
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body.tickets).toEqual(["MDP-100", "MDP-200"]);
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
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");
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
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");
    mockFetch.mockReturnValueOnce(jsonResponse({ success: false }));
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    await waitFor(() =>
      expect(screen.getByText("Failed to log to HRM")).toBeInTheDocument()
    );
  });

  it("shows network error when HRM fetch throws", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    await waitFor(() =>
      expect(screen.getByText("Failed to reach HRM")).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// HRM multi-ticket list management
// ---------------------------------------------------------------------------

describe("LogForm -- HRM ticket list", () => {
  it("adds a verified ticket to the HRM list", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");
    expect(screen.getByText("MDP-1234")).toBeInTheDocument();
    expect(screen.getByText(/HRM Tickets \(1\/5\)/)).toBeInTheDocument();
  });

  it("removes a ticket from the HRM list", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");
    expect(screen.getByText("MDP-1234")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove MDP-1234/i }));
    expect(screen.queryByText(/HRM Tickets/)).not.toBeInTheDocument();
  });

  it("prevents adding duplicate tickets", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    // Try to verify and add the same ticket again
    mockFetch.mockReturnValueOnce(
      jsonResponse({ valid: true, summary: "Fix login bug" })
    );
    await typeTicket(user, "MDP-1234");
    await user.click(screen.getByRole("button", { name: /verify/i }));
    await waitFor(() =>
      expect(screen.getByText(/Fix login bug/)).toBeInTheDocument()
    );

    // "Add to HRM" should be disabled since ticket is already in the list
    expect(screen.getByRole("button", { name: /add to hrm/i })).toBeDisabled();
  });

  it("shows ticket count in Log HRM button", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    expect(screen.getByRole("button", { name: /log hrm/i })).toHaveTextContent("Log HRM (0)");
    await addTicketToHrm(user, "MDP-100", "Feature A");
    expect(screen.getByRole("button", { name: /log hrm/i })).toHaveTextContent("Log HRM (1)");
    await addTicketToHrm(user, "MDP-200", "Feature B");
    expect(screen.getByRole("button", { name: /log hrm/i })).toHaveTextContent("Log HRM (2)");
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
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");
    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    expect(screen.getByRole("button", { name: /log hrm/i })).toBeDisabled();
  });

  it("shows Logging to HRM... message during HRM loading", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");
    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    expect(screen.getByText("Logging to HRM... (browser will open briefly)")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Date picker
// ---------------------------------------------------------------------------

describe("LogForm -- date picker", () => {
  it("renders date input with today's value on initial render", () => {
    render(<LogForm />);
    const dateInput = screen.getByLabelText(/date/i);
    expect(dateInput).toHaveValue(getTodayISO());
  });

  it("resets date to today when ticket input changes", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    const dateInput = screen.getByLabelText(/date/i);
    fireEvent.change(dateInput, { target: { value: "2026-01-15" } });
    expect(dateInput).toHaveValue("2026-01-15");

    await typeTicket(user, "MDP-9999");

    expect(dateInput).toHaveValue(getTodayISO());
  });

  it("Log TSC sends the selected date", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await verifySuccessFlow(user);

    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: "2026-01-15" } });

    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, cell: "O15" }));
    await user.click(screen.getByRole("button", { name: /log tsc/i }));

    await waitFor(() => {
      const call = mockFetch.mock.calls.find(([url]: [string]) => url === "/api/sharepoint/log");
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body.date).toBe("2026-01-15");
    });
  });

  it("Log HRM sends the selected date", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: "2026-01-15" } });

    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
    await user.click(screen.getByRole("button", { name: /log hrm/i }));

    await waitFor(() => {
      const call = mockFetch.mock.calls.find(([url]: [string]) => url === "/api/hrm/log");
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body.date).toBe("2026-01-15");
    });
  });
});

// ---------------------------------------------------------------------------
// Log All button disabled states
// ---------------------------------------------------------------------------

describe("LogForm -- Log All button disabled states", () => {
  it("is disabled before Jira verification", () => {
    render(<LogForm />);
    expect(screen.getByRole("button", { name: /log all/i })).toBeDisabled();
  });

  it("is disabled when Jira is verified but HRM ticket list is empty", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await verifySuccessFlow(user);
    expect(screen.getByRole("button", { name: /log all/i })).toBeDisabled();
  });

  it("is disabled when HRM has tickets but Jira is not verified", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");
    // Clear the current ticket to lose jira verification
    await typeTicket(user, "MDP-9999");
    expect(screen.getByRole("button", { name: /log all/i })).toBeDisabled();
  });

  it("is enabled when Jira is verified AND HRM list has tickets", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");
    // addTicketToHrm leaves jiraStatus as success for current ticket
    expect(screen.getByRole("button", { name: /log all/i })).toBeEnabled();
  });

  it("is disabled while TSC log is in-flight", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    await user.click(screen.getByRole("button", { name: /log all/i }));

    expect(screen.getByRole("button", { name: /log all/i })).toBeDisabled();
  });

  it("is disabled while HRM log is in-flight", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    await user.click(screen.getByRole("button", { name: /log all/i }));

    expect(screen.getByRole("button", { name: /log all/i })).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Log All — parallel execution
// ---------------------------------------------------------------------------

describe("LogForm -- Log All parallel execution", () => {
  it("sets both logStatus and hrmStatus to loading before any fetch resolves", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    await user.click(screen.getByRole("button", { name: /log all/i }));

    expect(screen.getByText("Writing to Excel... (browser will open briefly)")).toBeInTheDocument();
    expect(screen.getByText("Logging to HRM... (browser will open briefly)")).toBeInTheDocument();
  });

  it("fires both /api/sharepoint/log and /api/hrm/log when clicked", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, cell: "O66" }));
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
    await user.click(screen.getByRole("button", { name: /log all/i }));

    await waitFor(() => {
      const urls = mockFetch.mock.calls.map(([url]: [string]) => url);
      expect(urls).toContain("/api/sharepoint/log");
      expect(urls).toContain("/api/hrm/log");
    });
  });

  it("shows success on both status indicators when both operations succeed", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, cell: "O66" }));
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
    await user.click(screen.getByRole("button", { name: /log all/i }));

    await waitFor(() => {
      expect(screen.getByText(/Logged "MDP-1234" at cell O66/)).toBeInTheDocument();
      expect(screen.getByText(/Logged MDP-1234 to HRM timesheet/)).toBeInTheDocument();
    });
  });

  it("shows TSC success independently when HRM fails", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, cell: "O66" }));
    mockFetch.mockReturnValueOnce(jsonResponse({ success: false, error: "HRM error" }));
    await user.click(screen.getByRole("button", { name: /log all/i }));

    await waitFor(() => {
      expect(screen.getByText(/Logged "MDP-1234" at cell O66/)).toBeInTheDocument();
      expect(screen.getByText("HRM error")).toBeInTheDocument();
    });
  });

  it("shows HRM success independently when TSC fails", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    mockFetch.mockReturnValueOnce(jsonResponse({ success: false, error: "TSC error" }));
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
    await user.click(screen.getByRole("button", { name: /log all/i }));

    await waitFor(() => {
      expect(screen.getByText("TSC error")).toBeInTheDocument();
      expect(screen.getByText(/Logged MDP-1234 to HRM timesheet/)).toBeInTheDocument();
    });
  });

  it("auto-stages tickets after successful verify without clicking Add to HRM", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: true, summary: "Fix login bug" }),
    }) as jest.Mock;

    render(<LogForm />);

    fireEvent.change(screen.getByPlaceholderText(/MDP-1234/), {
      target: { value: "MDP-1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(screen.getByText("MDP-1234")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /add to hrm/i })).not.toBeInTheDocument();
  });

  it("resets both statuses to idle when ticket input changes after Log All", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, cell: "O66" }));
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
    await user.click(screen.getByRole("button", { name: /log all/i }));

    await waitFor(() =>
      expect(screen.getByText(/Logged "MDP-1234" at cell O66/)).toBeInTheDocument()
    );

    // Type a new ticket — both statuses should reset
    await typeTicket(user, "MDP-9999");

    expect(screen.queryByText(/Logged "MDP-1234"/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Logged MDP-1234 to HRM/)).not.toBeInTheDocument();
  });
});
