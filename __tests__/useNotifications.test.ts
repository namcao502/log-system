import { renderHook, act } from "@testing-library/react";
import { useNotifications } from "@/lib/useNotifications";

describe("useNotifications", () => {
  it("starts with empty list and zero unread", () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it("addNotification prepends and increments unread", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.addNotification({ type: "success", title: "Done", detail: "ok" });
    });
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]).toMatchObject({ type: "success", title: "Done", detail: "ok" });
    expect(result.current.notifications[0].id).toBeTruthy();
    expect(result.current.notifications[0].timestamp).toBeGreaterThan(0);
    expect(result.current.unreadCount).toBe(1);
  });

  it("newest notification is first", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.addNotification({ type: "info", title: "First", detail: "" });
      result.current.addNotification({ type: "info", title: "Second", detail: "" });
    });
    expect(result.current.notifications[0].title).toBe("Second");
    expect(result.current.notifications[1].title).toBe("First");
  });

  it("markRead resets unreadCount to 0", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.addNotification({ type: "info", title: "A", detail: "" });
      result.current.addNotification({ type: "info", title: "B", detail: "" });
    });
    expect(result.current.unreadCount).toBe(2);
    act(() => {
      result.current.markRead();
    });
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications).toHaveLength(2);
  });

  it("clearAll empties list and resets unread", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.addNotification({ type: "error", title: "Err", detail: "" });
    });
    act(() => {
      result.current.clearAll();
    });
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it("caps list at 50 entries, drops oldest", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      for (let i = 0; i < 55; i++) {
        result.current.addNotification({ type: "info", title: `n${i}`, detail: "" });
      }
    });
    expect(result.current.notifications).toHaveLength(50);
    expect(result.current.notifications[0].title).toBe("n54");
    expect(result.current.notifications[49].title).toBe("n5");
  });
});
