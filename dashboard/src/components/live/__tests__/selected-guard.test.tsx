import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LivePresence } from "@/lib/data/live";

// live-map pulls in maplibre-gl, which needs a real canvas; only the marker palette is used here.
vi.mock("../live-map", () => ({
  MARKER_STYLE: {
    live: { color: "#000", label: "live" },
    stale: { color: "#111", label: "not seen" },
    location_off: { color: "#222", label: "loc off" },
    off_duty: { color: "#333", label: "off duty" },
  },
}));

const { SelectedGuard } = await import("../selected-guard");

function presence(over: Partial<LivePresence> = {}): LivePresence {
  return {
    guard_id: "g-1",
    site_id: "s-1",
    shift_id: "sh-1",
    lat: 12.9,
    lng: 77.7,
    accuracy_m: 8.4,
    battery_pct: 74,
    in_fence: true,
    is_mock: false,
    location_enabled: true,
    last_seen_at: new Date().toISOString(),
    guards: { id: "g-1", full_name: "Harish Chandra", employee_code: "SSS-004", designation: "Head guard", phone: "+919000000000" },
    shifts: { id: "sh-1", started_at: new Date().toISOString(), scheduled_end: new Date().toISOString(), shift_types: { name: "Day" } },
    ...over,
  } as LivePresence;
}

describe("SelectedGuard", () => {
  it("offers both actions as buttons that point at the guard's shift and profile", () => {
    render(<SelectedGuard presence={presence()} timezone="Asia/Kolkata" stalenessMin={10} />);
    // ButtonLink renders a Next Link as a Base UI button, so the role is "button".
    const shift = screen.getByRole("button", { name: /Open shift for Harish Chandra/ });
    expect(shift).toHaveAttribute("href", "/attendance/sh-1");
    expect(shift).toHaveTextContent("Open shift");
    expect(shift).toHaveAttribute("data-slot", "button");

    const profile = screen.getByRole("button", { name: /Open guard profile for Harish Chandra/ });
    expect(profile).toHaveAttribute("href", "/guards/g-1");
    expect(profile).toHaveAttribute("data-slot", "button");
  });

  it("names the guard the actions belong to", () => {
    render(<SelectedGuard presence={presence()} siteName="Sobha Dream Acres" timezone="Asia/Kolkata" stalenessMin={10} />);
    expect(screen.getByText("Selected guard")).toBeInTheDocument();
    expect(screen.getByText("Harish Chandra")).toBeInTheDocument();
    expect(screen.getByText("Sobha Dream Acres")).toBeInTheDocument();
  });

  it("falls back to a full-width profile action when the guard has no shift", () => {
    render(<SelectedGuard presence={presence({ shift_id: null })} timezone="Asia/Kolkata" stalenessMin={10} />);
    expect(screen.queryByRole("button", { name: /Open shift/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Open guard profile/ })).toHaveClass("col-span-2");
  });

  it("clears the selection", async () => {
    const onClear = vi.fn();
    render(<SelectedGuard presence={presence()} timezone="Asia/Kolkata" stalenessMin={10} onClear={onClear} />);
    await userEvent.click(screen.getByRole("button", { name: /Clear selection of Harish Chandra/ }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("renders nothing without a selection", () => {
    const { container } = render(<SelectedGuard presence={null} timezone="Asia/Kolkata" stalenessMin={10} />);
    expect(container).toBeEmptyDOMElement();
  });
});
