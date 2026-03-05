/**
 * Tests for lib/excel.ts -- writeTicketToExcel()
 *
 * Covers:
 * - Finds today's date row in column B and writes ticket to column O.
 * - Appends ticket to existing value with comma separator.
 * - Writes ticket directly when cell is empty.
 * - Throws error when today's date is not found in column B.
 * - Throws error when column B read fails.
 * - Throws error when cell read fails.
 * - Throws error when cell write fails.
 * - Throws error when SharePoint env vars are missing.
 */

// We need to mock getAccessToken before importing excel module
jest.mock("@/lib/graph", () => ({
  getAccessToken: jest.fn().mockResolvedValue("mock-token"),
}));

import { writeTicketToExcel } from "@/lib/excel";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();

  // Re-setup the graph mock after resetAllMocks
  const graphMock = require("@/lib/graph");
  graphMock.getAccessToken.mockResolvedValue("mock-token");

  global.fetch = mockFetch;
  process.env.SHAREPOINT_DRIVE_ID = "drive-123";
  process.env.SHAREPOINT_DRIVE_ITEM_ID = "item-456";
});

afterEach(() => {
  delete process.env.SHAREPOINT_DRIVE_ID;
  delete process.env.SHAREPOINT_DRIVE_ITEM_ID;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockColumnBResponse(values: (string | null)[][]) {
  return {
    ok: true,
    json: () => Promise.resolve({ values }),
  };
}

function mockCellReadResponse(value: string) {
  return {
    ok: true,
    json: () => Promise.resolve({ values: [[value]] }),
  };
}

function mockCellWriteResponse() {
  return {
    ok: true,
    json: () => Promise.resolve({}),
  };
}

function mockErrorResponse(status: number, statusText: string) {
  return {
    ok: false,
    status,
    statusText,
  };
}

// Create column B data with today's date at a specific row
function buildColumnBValues(todayRow: number, totalRows = 30): (string | null)[][] {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );
  const today = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

  const values: (string | null)[][] = [];
  for (let i = 0; i < totalRows; i++) {
    values.push(i === todayRow - 1 ? [today] : [null]);
  }
  return values;
}

// ---------------------------------------------------------------------------
// Happy path -- empty cell
// ---------------------------------------------------------------------------

describe("writeTicketToExcel -- write to empty cell", () => {
  it("writes ticket to column O at the row matching today's date", async () => {
    const columnBValues = buildColumnBValues(10);

    // Call 1: read column B (findDateRow)
    // Call 2: read cell O10 (readCell)
    // Call 3: write cell O10 (writeCell)
    mockFetch
      .mockResolvedValueOnce(mockColumnBResponse(columnBValues))
      .mockResolvedValueOnce(mockCellReadResponse(""))
      .mockResolvedValueOnce(mockCellWriteResponse());

    const result = await writeTicketToExcel("MDP-1234");

    expect(result).toEqual({ cell: "O10" });
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Verify the write call body contains the ticket
    const writeCall = mockFetch.mock.calls[2];
    const writeBody = JSON.parse(writeCall[1].body);
    expect(writeBody).toEqual({ values: [["MDP-1234"]] });
  });
});

// ---------------------------------------------------------------------------
// Happy path -- append to existing value
// ---------------------------------------------------------------------------

describe("writeTicketToExcel -- append to existing value", () => {
  it("appends ticket with comma separator when cell already has content", async () => {
    const columnBValues = buildColumnBValues(5);

    mockFetch
      .mockResolvedValueOnce(mockColumnBResponse(columnBValues))
      .mockResolvedValueOnce(mockCellReadResponse("MDP-0001"))
      .mockResolvedValueOnce(mockCellWriteResponse());

    const result = await writeTicketToExcel("MDP-0002");

    expect(result).toEqual({ cell: "O5" });

    const writeCall = mockFetch.mock.calls[2];
    const writeBody = JSON.parse(writeCall[1].body);
    expect(writeBody).toEqual({ values: [["MDP-0001, MDP-0002"]] });
  });
});

// ---------------------------------------------------------------------------
// Error: date not found
// ---------------------------------------------------------------------------

describe("writeTicketToExcel -- date not found", () => {
  it("throws error when today's date is not in column B", async () => {
    // Column B with no matching date
    const emptyValues: (string | null)[][] = Array(10)
      .fill(null)
      .map(() => [null]);

    mockFetch.mockResolvedValueOnce(mockColumnBResponse(emptyValues));

    await expect(writeTicketToExcel("MDP-1234")).rejects.toThrow(
      /No row found for today's date/
    );
  });
});

// ---------------------------------------------------------------------------
// Error: API failures
// ---------------------------------------------------------------------------

describe("writeTicketToExcel -- API failures", () => {
  it("throws error when column B read fails", async () => {
    mockFetch.mockResolvedValueOnce(
      mockErrorResponse(500, "Internal Server Error")
    );

    await expect(writeTicketToExcel("MDP-1234")).rejects.toThrow(
      "Failed to read column B: 500 Internal Server Error"
    );
  });

  it("throws error when cell read fails", async () => {
    const columnBValues = buildColumnBValues(3);

    mockFetch
      .mockResolvedValueOnce(mockColumnBResponse(columnBValues))
      .mockResolvedValueOnce(mockErrorResponse(403, "Forbidden"));

    await expect(writeTicketToExcel("MDP-1234")).rejects.toThrow(
      "Failed to read cell O3: 403 Forbidden"
    );
  });

  it("throws error when cell write fails", async () => {
    const columnBValues = buildColumnBValues(3);

    mockFetch
      .mockResolvedValueOnce(mockColumnBResponse(columnBValues))
      .mockResolvedValueOnce(mockCellReadResponse(""))
      .mockResolvedValueOnce(mockErrorResponse(500, "Internal Server Error"));

    await expect(writeTicketToExcel("MDP-1234")).rejects.toThrow(
      "Failed to write cell O3: 500 Internal Server Error"
    );
  });
});

// ---------------------------------------------------------------------------
// Error: missing env vars
// ---------------------------------------------------------------------------

describe("writeTicketToExcel -- missing env vars", () => {
  it("throws when SHAREPOINT_DRIVE_ID is missing", async () => {
    delete process.env.SHAREPOINT_DRIVE_ID;

    await expect(writeTicketToExcel("MDP-1234")).rejects.toThrow(
      "Missing SharePoint environment variables"
    );
  });

  it("throws when SHAREPOINT_DRIVE_ITEM_ID is missing", async () => {
    delete process.env.SHAREPOINT_DRIVE_ITEM_ID;

    await expect(writeTicketToExcel("MDP-1234")).rejects.toThrow(
      "Missing SharePoint environment variables"
    );
  });
});
