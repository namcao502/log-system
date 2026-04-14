import { render, screen, fireEvent } from "@testing-library/react";
import ThemePicker from "@/components/ThemePicker";

const DEFAULT_COLOR = "#10b981";

describe("ThemePicker", () => {
  it("renders the palette button with accessible label", () => {
    render(<ThemePicker color={DEFAULT_COLOR} onChange={() => {}} />);
    expect(
      screen.getByRole("button", { name: /theme color picker/i })
    ).toBeInTheDocument();
  });

  it("popover is not visible initially", () => {
    render(<ThemePicker color={DEFAULT_COLOR} onChange={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens popover when button is clicked", () => {
    render(<ThemePicker color={DEFAULT_COLOR} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /theme color picker/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("color input is pre-filled with current color", () => {
    render(<ThemePicker color="#3b82f6" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /theme color picker/i }));
    const input = screen.getByLabelText("Color") as HTMLInputElement;
    expect(input.value).toBe("#3b82f6");
  });

  it("calls onChange when color input changes", () => {
    const onChange = jest.fn();
    render(<ThemePicker color={DEFAULT_COLOR} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /theme color picker/i }));
    fireEvent.change(screen.getByLabelText("Color"), {
      target: { value: "#3b82f6" },
    });
    expect(onChange).toHaveBeenCalledWith("#3b82f6");
  });

  it("calls onChange with default color when Reset is clicked", () => {
    const onChange = jest.fn();
    render(<ThemePicker color="#3b82f6" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /theme color picker/i }));
    fireEvent.click(screen.getByText("Reset"));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_COLOR);
  });

  it("closes popover on click outside", () => {
    render(
      <div>
        <ThemePicker color={DEFAULT_COLOR} onChange={() => {}} />
        <div data-testid="outside">outside</div>
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: /theme color picker/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
