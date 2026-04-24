import React from "react";
import { render, screen } from "@testing-library/react";
import LogPanel from "@/components/LogPanel";

describe("LogPanel", () => {
  it("renders nothing when logs is empty", () => {
    const { container } = render(<LogPanel logs={[]} />);
    expect(container.querySelector("pre")).not.toBeInTheDocument();
  });

  it("renders a pre element when logs are present", () => {
    const { container } = render(
      <LogPanel logs={["[tsc-log] [0.1s] Browser launched"]} />
    );
    expect(container.querySelector("pre")).toBeInTheDocument();
  });

  it("renders each log line", () => {
    render(
      <LogPanel
        logs={[
          "[tsc-log] [0.1s] Browser launched",
          "[tsc-log] [1.2s] Done",
        ]}
      />
    );
    expect(screen.getByText(/Browser launched/)).toBeInTheDocument();
    expect(screen.getByText(/Done/)).toBeInTheDocument();
  });

  it("does not render prefix span, shows timestamp and text", () => {
    const { container } = render(
      <LogPanel logs={["[tsc-log] [0.1s] some text"]} />
    );
    expect(container.querySelector("span.text-emerald-400")).not.toBeInTheDocument();
    expect(screen.getByText(/0\.1s/)).toBeInTheDocument();
    expect(screen.getByText(/some text/)).toBeInTheDocument();
  });

  it("applies fixed height and overflow scroll classes", () => {
    const { container } = render(
      <LogPanel logs={["[tsc-log] test"]} />
    );
    const pre = container.querySelector("pre");
    expect(pre?.className).toContain("h-[211px]");
    expect(pre?.className).toContain("overflow-y-auto");
  });
});
