import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ToastComponent from "@/components/Toast";
import ToastContainer from "@/components/ToastContainer";
import type { Toast } from "@/lib/types";

function makeToast(overrides: Partial<Toast> = {}): Toast {
  return { id: "t1", type: "success", title: "Done", detail: "ok", ...overrides };
}

// ---------------------------------------------------------------------------
// Toast (single item)
// ---------------------------------------------------------------------------

describe("Toast", () => {
  it("renders title and detail", () => {
    render(<ToastComponent toast={makeToast()} onDismiss={jest.fn()} />);
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("calls onDismiss with id when dismiss button clicked", async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    render(<ToastComponent toast={makeToast({ id: "abc" })} onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith("abc");
  });

  it("calls onDismiss automatically after 4 seconds", () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    render(<ToastComponent toast={makeToast({ id: "auto" })} onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(4000); });
    expect(onDismiss).toHaveBeenCalledWith("auto");
    jest.useRealTimers();
  });

  it("applies green styling for success type", () => {
    const { container } = render(
      <ToastComponent toast={makeToast({ type: "success" })} onDismiss={jest.fn()} />
    );
    expect(container.firstChild).toHaveClass("bg-green-50");
  });

  it("applies red styling for error type", () => {
    const { container } = render(
      <ToastComponent toast={makeToast({ type: "error" })} onDismiss={jest.fn()} />
    );
    expect(container.firstChild).toHaveClass("bg-red-50");
  });

  it("applies teal styling for info type", () => {
    const { container } = render(
      <ToastComponent toast={makeToast({ type: "info" })} onDismiss={jest.fn()} />
    );
    expect(container.firstChild).toHaveClass("bg-[var(--t-50)]");
  });
});

// ---------------------------------------------------------------------------
// ToastContainer
// ---------------------------------------------------------------------------

describe("ToastContainer", () => {
  it("renders nothing when toasts list is empty", () => {
    const { container } = render(<ToastContainer toasts={[]} onDismiss={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders all toasts", () => {
    const toasts: Toast[] = [
      makeToast({ id: "1", title: "First" }),
      makeToast({ id: "2", title: "Second" }),
    ];
    render(<ToastContainer toasts={toasts} onDismiss={jest.fn()} />);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("is fixed to top-right of viewport", () => {
    const { container } = render(
      <ToastContainer toasts={[makeToast()]} onDismiss={jest.fn()} />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("fixed");
    expect(wrapper.className).toContain("right-4");
    expect(wrapper.className).toContain("top-4");
  });
});
