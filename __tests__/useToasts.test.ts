import { renderHook, act } from "@testing-library/react";
import { useToasts } from "@/lib/useToasts";

describe("useToasts", () => {
  it("starts with empty toast list", () => {
    const { result } = renderHook(() => useToasts());
    expect(result.current.toasts).toEqual([]);
  });

  it("addToast prepends a toast with generated id", () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.addToast({ type: "success", title: "Done", detail: "ok" });
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({ type: "success", title: "Done", detail: "ok" });
    expect(result.current.toasts[0].id).toBeTruthy();
  });

  it("newest toast is first", () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.addToast({ type: "info", title: "First", detail: "" });
      result.current.addToast({ type: "info", title: "Second", detail: "" });
    });
    expect(result.current.toasts[0].title).toBe("Second");
  });

  it("dismissToast removes by id", () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.addToast({ type: "error", title: "Err", detail: "" });
    });
    const id = result.current.toasts[0].id;
    act(() => {
      result.current.dismissToast(id);
    });
    expect(result.current.toasts).toEqual([]);
  });

  it("caps list at 5 toasts, drops oldest", () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      for (let i = 0; i < 7; i++) {
        result.current.addToast({ type: "info", title: `t${i}`, detail: "" });
      }
    });
    expect(result.current.toasts).toHaveLength(5);
    expect(result.current.toasts[0].title).toBe("t6");
    expect(result.current.toasts[4].title).toBe("t2");
  });
});
