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
      <LogPanel logs={["[browser-log] [0.1s] Browser launched"]} />
    );
    expect(container.querySelector("pre")).toBeInTheDocument();
  });

  it("renders each log line", () => {
    render(
      <LogPanel
        logs={[
          "[browser-log] [0.1s] Browser launched",
          "[browser-log] [1.2s] Done",
        ]}
      />
    );
    expect(screen.getByText(/Browser launched/)).toBeInTheDocument();
    expect(screen.getByText(/Done/)).toBeInTheDocument();
  });

  it("colorizes prefix in emerald", () => {
    const { container } = render(
      <LogPanel logs={["[browser-log] [0.1s] some text"]} />
    );
    const prefix = container.querySelector("span.text-emerald-400");
    expect(prefix).toBeInTheDocument();
    expect(prefix?.textContent).toBe("[browser-log]");
  });

  it("applies fixed height and overflow scroll classes", () => {
    const { container } = render(
      <LogPanel logs={["[browser-log] test"]} />
    );
    const pre = container.querySelector("pre");
    expect(pre?.className).toContain("h-[211px]");
    expect(pre?.className).toContain("overflow-y-auto");
  });
});
