/**
 * Tests for lib/jira.ts -- verifyTicket()
 *
 * Covers:
 * - Returns { valid: true, summary } when Jira returns 200.
 * - Returns { valid: false } when Jira returns 404.
 * - Throws error when Jira returns other status codes.
 * - Throws error when env vars are missing.
 * - Builds correct URL and Authorization header.
 */

import { verifyTicket } from "@/lib/jira";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = mockFetch;
  process.env.JIRA_BASE_URL = "https://test.atlassian.net";
  process.env.JIRA_EMAIL = "user@test.com";
  process.env.JIRA_API_TOKEN = "test-token";
});

afterEach(() => {
  delete process.env.JIRA_BASE_URL;
  delete process.env.JIRA_EMAIL;
  delete process.env.JIRA_API_TOKEN;
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("verifyTicket -- valid ticket", () => {
  it("returns valid: true with summary when Jira returns 200", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ fields: { summary: "Fix login bug" } }),
    });

    const result = await verifyTicket("MDP-1234");

    expect(result).toEqual({ valid: true, summary: "Fix login bug" });
  });

  it("calls fetch with correct URL and Basic auth header", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ fields: { summary: "Test" } }),
    });

    await verifyTicket("MDP-42");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.atlassian.net/rest/api/3/issue/MDP-42?fields=summary",
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from("user@test.com:test-token").toString("base64")}`,
          Accept: "application/json",
        },
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Not found
// ---------------------------------------------------------------------------

describe("verifyTicket -- ticket not found", () => {
  it("returns valid: false when Jira returns 404", async () => {
    mockFetch.mockResolvedValueOnce({ status: 404 });

    const result = await verifyTicket("MDP-9999");

    expect(result).toEqual({ valid: false });
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("verifyTicket -- error handling", () => {
  it("throws error when Jira returns unexpected status code", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(verifyTicket("MDP-1234")).rejects.toThrow(
      "Jira API error: 500 Internal Server Error"
    );
  });

  it("throws error when Jira returns 403 Forbidden", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 403,
      statusText: "Forbidden",
    });

    await expect(verifyTicket("MDP-1234")).rejects.toThrow(
      "Jira API error: 403 Forbidden"
    );
  });
});

// ---------------------------------------------------------------------------
// Missing environment variables
// ---------------------------------------------------------------------------

describe("verifyTicket -- missing env vars", () => {
  it("throws when JIRA_BASE_URL is missing", async () => {
    delete process.env.JIRA_BASE_URL;
    await expect(verifyTicket("MDP-1234")).rejects.toThrow(
      "Missing Jira environment variables"
    );
  });

  it("throws when JIRA_EMAIL is missing", async () => {
    delete process.env.JIRA_EMAIL;
    await expect(verifyTicket("MDP-1234")).rejects.toThrow(
      "Missing Jira environment variables"
    );
  });

  it("throws when JIRA_API_TOKEN is missing", async () => {
    delete process.env.JIRA_API_TOKEN;
    await expect(verifyTicket("MDP-1234")).rejects.toThrow(
      "Missing Jira environment variables"
    );
  });
});
