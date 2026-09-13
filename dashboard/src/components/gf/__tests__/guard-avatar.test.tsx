import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GuardAvatar } from "../guard-avatar";

describe("GuardAvatar", () => {
  it("shows initials when there is no photo", () => {
    const { container } = render(<GuardAvatar name="Ramesh Yadav" />);
    expect(container.textContent).toBe("RY");
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders a real URL", () => {
    const { container } = render(<GuardAvatar name="Ramesh Yadav" src="https://example.test/a.jpg" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://example.test/a.jpg");
  });

  it("ignores a storage object path, which would render as a broken image", () => {
    const { container } = render(<GuardAvatar name="Suresh Gowda" src="agency-id/selfies/reg/SSS-002.jpg" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("SG");
  });

  it("is hidden from assistive tech because the name is always beside it", () => {
    render(
      <div>
        <GuardAvatar name="Mohan Lal" />
        <span>Mohan Lal</span>
      </div>,
    );
    expect(screen.getAllByText("Mohan Lal")).toHaveLength(1);
  });
});
