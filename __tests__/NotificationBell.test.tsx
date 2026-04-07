import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationBell from "@/components/NotificationBell";
import type { Notification } from "@/lib/types";

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: crypto.randomUUID(),
    type: "success",
    title: "TSC logged",
    detail: "MDP-1234 \u2192 cell M366",
    timestamp: Date.now(),
    ...overrides,
  };
}

function renderBell(
  overrides: Partial<React.ComponentProps<typeof NotificationBell>> = {}
) {
  const props = {
    notifications: [],
    unreadCount: 0,
    onOpen: jest.fn(),
    onClearAll: jest.fn(),
    ...overrides,
  };
  return { ...render(<NotificationBell {...props} />), ...props };
}

describe("NotificationBell -- badge", () => {
  it("hides badge when unreadCount is 0", () => {
    renderBell({ unreadCount: 0 });
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it("shows badge with count when unreadCount > 0", () => {
    renderBell({ unreadCount: 3 });
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows 9+ when unreadCount > 9", () => {
    renderBell({ unreadCount: 12 });
    expect(screen.getByText("9+")).toBeInTheDocument();
  });
});

describe("NotificationBell -- dropdown", () => {
  it("dropdown is closed by default", () => {
    renderBell();
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
  });

  it("opens dropdown and calls onOpen when bell is clicked", async () => {
    const user = userEvent.setup();
    const { onOpen } = renderBell();
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("closes dropdown when bell is clicked again", async () => {
    const user = userEvent.setup();
    renderBell();
    const btn = screen.getByRole("button", { name: /notifications/i });
    await user.click(btn);
    await user.click(btn);
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
  });

  it("shows empty state when no notifications", async () => {
    const user = userEvent.setup();
    renderBell({ notifications: [] });
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByText("No notifications")).toBeInTheDocument();
  });

  it("renders notification entries in dropdown", async () => {
    const user = userEvent.setup();
    renderBell({
      notifications: [
        makeNotification({ title: "TSC logged", detail: "MDP-1234 \u2192 cell M366" }),
      ],
    });
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByText("TSC logged")).toBeInTheDocument();
    expect(screen.getByText("MDP-1234 \u2192 cell M366")).toBeInTheDocument();
  });

  it("calls onClearAll when Clear all is clicked", async () => {
    const user = userEvent.setup();
    const { onClearAll } = renderBell({
      notifications: [makeNotification()],
    });
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    await user.click(screen.getByRole("button", { name: /clear all/i }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("does not show Clear all when notifications list is empty", async () => {
    const user = userEvent.setup();
    renderBell({ notifications: [] });
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });
});
