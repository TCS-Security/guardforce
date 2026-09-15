import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DayStepper, FilterBar, FilterField } from "../filter-bar";

describe("FilterBar", () => {
  it("puts its controls on a bordered, filled strip so they read as controls", () => {
    const { container } = render(
      <FilterBar>
        <FilterField label="Site" htmlFor="site">
          <input id="site" />
        </FilterField>
      </FilterBar>,
    );
    const bar = container.querySelector("[data-slot=filter-bar]")!;
    expect(bar.className).toContain("border");
    expect(bar.className).toContain("bg-card");
    expect(bar.className).toContain("shadow-sm");
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
