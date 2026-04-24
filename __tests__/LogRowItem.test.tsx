// __tests__/LogRowItem.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LogRowItem from "@/components/LogRowItem";
import type { LogRow } from "@/lib/types";

const BASE_ROW: LogRow = { id: "r1", date: "2026-04-28", ticket: "", status: "idle" };
const handlers = {
  onDateChange: jest.fn(),
  onTicketChange: jest.fn(),
  onTicketBlur: jest.fn(),
  onRemove: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

test("renders ticket input and remove button", () => {
  render(<LogRowItem row={BASE_ROW} min="2026-01-01" max="2026-12-31" {...handlers} />);
  expect(screen.getByPlaceholderText("1234")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /remove row/i })).toBeInTheDocument();
});

test("passes only digit characters to onTicketChange", async () => {
  const user = userEvent.setup();
  render(<LogRowItem row={BASE_ROW} min="2026-01-01" max="2026-12-31" {...handlers} />);
  await user.type(screen.getByPlaceholderText("1234"), "1");
  expect(handlers.onTicketChange).toHaveBeenCalledWith("r1", "1");
});

test("strips non-digit characters from input", () => {
  render(<LogRowItem row={BASE_ROW} min="2026-01-01" max="2026-12-31" {...handlers} />);
  fireEvent.change(screen.getByPlaceholderText("1234"), { target: { value: "MDP-123" } });
  expect(handlers.onTicketChange).toHaveBeenCalledWith("r1", "123");
});

test("calls onTicketBlur on input blur", () => {
  render(<LogRowItem row={{ ...BASE_ROW, ticket: "MDP-1234" }} min="2026-01-01" max="2026-12-31" {...handlers} />);
  fireEvent.blur(screen.getByPlaceholderText("1234"));
  expect(handlers.onTicketBlur).toHaveBeenCalledWith("r1", "MDP-1234");
});

test("calls onRemove with row id", async () => {
  const user = userEvent.setup();
  render(<LogRowItem row={BASE_ROW} min="2026-01-01" max="2026-12-31" {...handlers} />);
  await user.click(screen.getByRole("button", { name: /remove row/i }));
  expect(handlers.onRemove).toHaveBeenCalledWith("r1");
});

test("shows summary text when status is valid", () => {
  const row: LogRow = { ...BASE_ROW, ticket: "MDP-1234", status: "valid", summary: "Fix login bug" };
  render(<LogRowItem row={row} min="2026-01-01" max="2026-12-31" {...handlers} />);
  expect(screen.getByText("Fix login bug")).toBeInTheDocument();
});

test("shows verified aria-label when status is valid", () => {
  const row: LogRow = { ...BASE_ROW, ticket: "MDP-1234", status: "valid" };
  render(<LogRowItem row={row} min="2026-01-01" max="2026-12-31" {...handlers} />);
  expect(screen.getByLabelText("Verified")).toBeInTheDocument();
});

test("shows invalid aria-label when status is invalid", () => {
  const row: LogRow = { ...BASE_ROW, ticket: "MDP-0000", status: "invalid" };
  render(<LogRowItem row={row} min="2026-01-01" max="2026-12-31" {...handlers} />);
  expect(screen.getByLabelText("Invalid ticket")).toBeInTheDocument();
});

test("shows verifying aria-label when status is verifying", () => {
  const row: LogRow = { ...BASE_ROW, ticket: "MDP-1234", status: "verifying" };
  render(<LogRowItem row={row} min="2026-01-01" max="2026-12-31" {...handlers} />);
  expect(screen.getByLabelText("Verifying")).toBeInTheDocument();
});
