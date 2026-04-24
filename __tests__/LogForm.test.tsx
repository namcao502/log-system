/**
 * LogForm tests
 * - Initial render: one empty row with today's date.
 * - Add row: "+ Add row" inserts a new empty row.
 * - Remove row: X removes the row; last row is replaced by a fresh empty row.
 * - Ticket blur (valid): calls Jira verify, updates status to valid, shows summary.
 * - Ticket blur (invalid): marks row invalid.
 * - Log TSC/HRM disabled when no valid rows.
 * - Log TSC calls /api/sharepoint/log once per date group with combined tickets.
 * - Log HRM calls /api/hrm/log once per date group.
 * - Log All fires both in parallel.
 * - On success rows are reset to one empty row.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LogForm from "@/components/LogForm";
import type { Notification } from "@/lib/types";

// --- Mocks ---

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockOnNotify = jest.fn<void, [Omit<Notification, "id" | "timestamp">]>();

beforeEach(() => {
  jest.clearAllMocks();
  // Fake only Date so "today" is deterministic; leave setTimeout/setInterval real
  // so @testing-library/user-event (which uses real timers internally) does not hang.
  jest.useFakeTimers({
    now: new Date("2026-04-24T09:00:00+07:00").getTime(),
    doNotFake: [
      "setTimeout",
      "setInterval",
      "clearTimeout",
      "clearInterval",
      "setImmediate",
      "clearImmediate",
      "queueMicrotask",
      "nextTick",
    ],
  });
});

afterEach(() => {
  jest.useRealTimers();
});

// --- Stream helpers ---

function makeStream(lines: object[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(ctrl) {
      for (const l of lines) ctrl.enqueue(enc.encode(JSON.stringify(l) + "\n"));
      ctrl.close();
    },
  });
}

function streamResponse(lines: object[]): Promise<Response> {
  return Promise.resolve(
    new Response(makeStream(lines), {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
    }),
  );
}

function jsonResponse(data: object, status = 200): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
}

// --- Helpers ---

async function verifyRow(
  user: ReturnType<typeof userEvent.setup>,
  ticketNum: string,
  summary: string,
  inputIndex = 0,
) {
  mockFetch.mockResolvedValueOnce(jsonResponse({ valid: true, summary }));
  const inputs = screen.getAllByPlaceholderText("1234");
  const input = inputs[inputIndex];
  await user.clear(input);
  await user.type(input, ticketNum);
  fireEvent.blur(input);
  await waitFor(() => expect(screen.getByText(`MDP-${ticketNum}: ${summary}`)).toBeInTheDocument());
}

// --- Tests ---

describe("LogForm -- initial render", () => {
  it("renders one empty row and add-row button", () => {
    render(<LogForm onNotify={mockOnNotify} />);
    expect(screen.getAllByPlaceholderText("1234")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /add row/i })).toBeInTheDocument();
  });

  it("Log TSC, Log HRM, Log All are disabled initially", () => {
    render(<LogForm onNotify={mockOnNotify} />);
    expect(screen.getByRole("button", { name: /log tsc/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /log hrm/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /log all/i })).toBeDisabled();
  });
});

describe("LogForm -- row management", () => {
  it("adds a new row when clicking add row", async () => {
    const user = userEvent.setup();
    render(<LogForm onNotify={mockOnNotify} />);
    await user.click(screen.getByRole("button", { name: /add row/i }));
    expect(screen.getAllByPlaceholderText("1234")).toHaveLength(2);
  });

  it("removes a row on X click", async () => {
    const user = userEvent.setup();
    render(<LogForm onNotify={mockOnNotify} />);
    await user.click(screen.getByRole("button", { name: /add row/i }));
    expect(screen.getAllByPlaceholderText("1234")).toHaveLength(2);
    const removeButtons = screen.getAllByRole("button", { name: /remove row/i });
    await user.click(removeButtons[0]);
    expect(screen.getAllByPlaceholderText("1234")).toHaveLength(1);
  });

  it("removing the last row leaves one fresh empty row", async () => {
    const user = userEvent.setup();
    render(<LogForm onNotify={mockOnNotify} />);
    await user.click(screen.getByRole("button", { name: /remove row/i }));
    expect(screen.getAllByPlaceholderText("1234")).toHaveLength(1);
    expect(screen.getByPlaceholderText("1234")).toHaveValue("");
  });
});

describe("LogForm -- ticket verification", () => {
  it("marks row valid and shows summary after successful verify", async () => {
    const user = userEvent.setup();
    render(<LogForm onNotify={mockOnNotify} />);
    await verifyRow(user, "1234", "Fix login bug");
    expect(screen.getByLabelText("Verified")).toBeInTheDocument();
  });

  it("marks row invalid when Jira returns valid: false", async () => {
    const user = userEvent.setup();
    render(<LogForm onNotify={mockOnNotify} />);
    mockFetch.mockResolvedValueOnce(jsonResponse({ valid: false }));
    const input = screen.getByPlaceholderText("1234");
    await user.type(input, "9999");
    fireEvent.blur(input);
    await waitFor(() => expect(screen.getByLabelText("Invalid ticket")).toBeInTheDocument());
  });

  it("does not mark invalid and does not fetch when blurring an empty field", () => {
    render(<LogForm onNotify={mockOnNotify} />);
    const input = screen.getByPlaceholderText("1234");
    fireEvent.blur(input);
    expect(screen.queryByLabelText("Invalid ticket")).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("resets status to idle when ticket is changed after verification", async () => {
    const user = userEvent.setup();
    render(<LogForm onNotify={mockOnNotify} />);
    await verifyRow(user, "1234", "Fix login bug");
    expect(screen.getByLabelText("Verified")).toBeInTheDocument();
    const input = screen.getByPlaceholderText("1234");
    await user.type(input, "5");
    expect(screen.queryByLabelText("Verified")).not.toBeInTheDocument();
  });
});

describe("LogForm -- log buttons enabled state", () => {
  it("enables Log TSC and Log HRM after a row is verified", async () => {
    const user = userEvent.setup();
    render(<LogForm onNotify={mockOnNotify} />);
    await verifyRow(user, "1234", "Fix login bug");
    expect(screen.getByRole("button", { name: /log tsc/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /log hrm/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /log all/i })).toBeEnabled();
  });
});

describe("LogForm -- Log TSC", () => {
  it("calls /api/sharepoint/log with tickets joined and single date", async () => {
    const user = userEvent.setup();
    render(<LogForm onNotify={mockOnNotify} />);
    await verifyRow(user, "1234", "Fix login bug");
    mockFetch.mockReturnValueOnce(
      streamResponse([{ type: "result", success: true, cell: "M100" }]),
    );
    await user.click(screen.getByRole("button", { name: /log tsc/i }));
    await waitFor(() => expect(mockOnNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", title: "TSC logged" }),
    ));
    const call = mockFetch.mock.calls.find((c) => c[0].includes("sharepoint"));
    expect(call).toBeTruthy();
    const body = JSON.parse((call![1] as RequestInit).body as string);
    expect(body.ticket).toBe("MDP-1234");
    expect(body.dates).toHaveLength(1);
  });

  it("makes a separate API call for each row (different dates)", async () => {
    const user = userEvent.setup();
    render(<LogForm onNotify={mockOnNotify} />);
    await verifyRow(user, "1234", "Fix A", 0);
    // second row gets tomorrow's date automatically (today is already taken)
    await user.click(screen.getByRole("button", { name: /add row/i }));
    await verifyRow(user, "5678", "Fix B", 1);
    mockFetch
      .mockReturnValueOnce(streamResponse([{ type: "result", success: true, cell: "M100" }]))
      .mockReturnValueOnce(streamResponse([{ type: "result", success: true, cell: "M101" }]));
    await user.click(screen.getByRole("button", { name: /log tsc/i }));
    await waitFor(() => expect(mockOnNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    ));
    const calls = mockFetch.mock.calls.filter((c) => c[0].includes("sharepoint"));
    expect(calls).toHaveLength(2);
  });

  it("notifies error when API returns non-ok", async () => {
    const user = userEvent.setup();
    render(<LogForm onNotify={mockOnNotify} />);
    await verifyRow(user, "1234", "Fix login bug");
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Server error" }), { status: 500 }),
    );
    await user.click(screen.getByRole("button", { name: /log tsc/i }));
    await waitFor(() => expect(mockOnNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", title: "TSC failed" }),
    ));
  });

  it("resets rows to one empty row on success", async () => {
    const user = userEvent.setup();
    render(<LogForm onNotify={mockOnNotify} />);
    await verifyRow(user, "1234", "Fix login bug");
    mockFetch.mockReturnValueOnce(
      streamResponse([{ type: "result", success: true, cell: "M100" }]),
    );
    await user.click(screen.getByRole("button", { name: /log tsc/i }));
    await waitFor(() => expect(mockOnNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    ));
    expect(screen.getAllByPlaceholderText("1234")).toHaveLength(1);
    expect(screen.getByPlaceholderText("1234")).toHaveValue("");
  });
});

describe("LogForm -- Log HRM", () => {
  it("calls /api/hrm/log with tickets array and single date per group", async () => {
    const user = userEvent.setup();
    render(<LogForm onNotify={mockOnNotify} />);
    await verifyRow(user, "1234", "Fix login bug");
    mockFetch.mockReturnValueOnce(
      streamResponse([{ type: "result", success: true }]),
    );
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    await waitFor(() => expect(mockOnNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", title: "HRM logged" }),
    ));
    const call = mockFetch.mock.calls.find((c) => c[0].includes("hrm"));
    const body = JSON.parse((call![1] as RequestInit).body as string);
    expect(body.tickets).toEqual(["MDP-1234"]);
    expect(body.dates).toHaveLength(1);
  });

  it("makes a separate API call per row (different dates)", async () => {
    const user = userEvent.setup();
    render(<LogForm onNotify={mockOnNotify} />);
    await verifyRow(user, "100", "Feature A", 0);
    await user.click(screen.getByRole("button", { name: /add row/i }));
    await verifyRow(user, "200", "Feature B", 1);
    mockFetch
      .mockReturnValueOnce(streamResponse([{ type: "result", success: true }]))
      .mockReturnValueOnce(streamResponse([{ type: "result", success: true }]));
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    await waitFor(() => expect(mockOnNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    ));
    const calls = mockFetch.mock.calls.filter((c) => c[0].includes("hrm"));
    expect(calls).toHaveLength(2);
  });
});

describe("LogForm -- Log All", () => {
  it("fires TSC and HRM fetch in parallel (both called before either resolves)", async () => {
    const user = userEvent.setup();
    render(<LogForm onNotify={mockOnNotify} />);
    await verifyRow(user, "1234", "Fix login bug");

    let tscResolve!: () => void;
    let hrmResolve!: () => void;
    const tscPromise = new Promise<Response>((res) => { tscResolve = () => res(new Response(makeStream([{ type: "result", success: true, cell: "M1" }]), { status: 200, headers: { "Content-Type": "application/x-ndjson" } })); });
    const hrmPromise = new Promise<Response>((res) => { hrmResolve = () => res(new Response(makeStream([{ type: "result", success: true }]),         { status: 200, headers: { "Content-Type": "application/x-ndjson" } })); });

    mockFetch
      .mockImplementationOnce(() => tscPromise)
      .mockImplementationOnce(() => hrmPromise);

    await user.click(screen.getByRole("button", { name: /log all/i }));

    // Both fetches were called before resolving either (1 jira verify + 2 log calls)
    expect(mockFetch).toHaveBeenCalledTimes(3);
    tscResolve();
    hrmResolve();

    await waitFor(() => expect(mockOnNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", title: "TSC logged" }),
    ));
    await waitFor(() => expect(mockOnNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", title: "HRM logged" }),
    ));
  });
});

describe("LogForm -- will-log summary", () => {
  it("shows summary panel only when there are valid rows", async () => {
    const user = userEvent.setup();
    render(<LogForm onNotify={mockOnNotify} />);
    expect(screen.queryByTestId("will-log-summary")).not.toBeInTheDocument();
    await verifyRow(user, "1234", "Fix login bug");
    expect(screen.getByTestId("will-log-summary")).toBeInTheDocument();
  });
});
