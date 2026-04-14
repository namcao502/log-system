import { renderHook, act } from "@testing-library/react";
import { useTheme, DEFAULT_COLOR } from "@/lib/useTheme";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.style.removeProperty("--theme-hue");
});

describe("useTheme", () => {
  it("defaults to emerald (#10b981) when localStorage is empty", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.color).toBe(DEFAULT_COLOR);
  });

  it("reads saved color from localStorage on mount", () => {
    localStorage.setItem("tsc-theme-color", "#3b82f6");
    const { result } = renderHook(() => useTheme());
    expect(result.current.color).toBe("#3b82f6");
  });

  it("sets --theme-hue on documentElement when color changes", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setColor("#3b82f6"); // blue ~217deg
    });
    const hue = Number(
      document.documentElement.style.getPropertyValue("--theme-hue")
    );
    expect(hue).toBeGreaterThan(200);
    expect(hue).toBeLessThan(230);
  });

  it("saves new color to localStorage on change", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setColor("#3b82f6");
    });
    expect(localStorage.getItem("tsc-theme-color")).toBe("#3b82f6");
  });

  it("sets hue to ~160 for the default emerald color", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setColor(DEFAULT_COLOR);
    });
    const hue = Number(
      document.documentElement.style.getPropertyValue("--theme-hue")
    );
    expect(hue).toBeGreaterThan(150);
    expect(hue).toBeLessThan(170);
  });

  it("sets hue to ~0 for red (#ef4444)", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setColor("#ef4444");
    });
    const hue = Number(
      document.documentElement.style.getPropertyValue("--theme-hue")
    );
    // red wraps: hue is 0 or 360
    expect(hue === 0 || hue === 360 || hue < 10).toBe(true);
  });

  it("falls back to hue 0 for invalid hex input", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setColor("invalid");
    });
    const hue = Number(
      document.documentElement.style.getPropertyValue("--theme-hue")
    );
    expect(hue).toBe(0);
  });
});
