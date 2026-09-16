import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DayStepper, FilterBar, FilterField } from "../filter-bar";

describe("FilterBar", () => {
  it("is a tinted tray, so the controls on it are the lightest thing in the strip", () => {
    const { container } = render(
      <FilterBar>
        <FilterField label="Site" htmlFor="site">
          <input id="site" />
        </FilterField>
      </FilterBar>,
    );
    const bar = container.querySelector("[data-slot=filter-bar]")!;
    expect(bar.className).toContain("border");
    // The tray itself is tinted...
    expect(bar.className).toContain("bg-secondary");
    expect(bar.className.split(" ")).not.toContain("bg-card");
    // ...and it lifts the controls sitting on it to the card surface. Without this the
    // strip is a white box holding near-white selects, which is what got missed.
    expect(bar.className).toContain("[&_[data-slot=select-trigger]]:bg-card");
    expect(bar.className).toContain("[&_[data-slot=input]]:bg-card");
    // the label is tied to the control it names
    expect(screen.getByLabelText("Site")).toHaveAttribute("id", "site");
  });
});

describe("DayStepper", () => {
  it("steps back a day, across a month boundary", async () => {
    const onChange = vi.fn();
    render(<DayStepper value="2026-03-01" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(onChange).toHaveBeenCalledWith("2026-02-28");
  });

  it("steps forward a day", async () => {
    const onChange = vi.fn();
    render(<DayStepper value="2026-02-28" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(onChange).toHaveBeenCalledWith("2026-03-01");
  });

  it("reports the date picked in the input and ignores a cleared one", () => {
    const onChange = vi.fn();
    render(<DayStepper id="day" value="2026-02-28" onChange={onChange} />);
    const input = document.getElementById("day") as HTMLInputElement;
    expect(input.type).toBe("date");
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "2026-03-15" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-03-15");
  });
});
