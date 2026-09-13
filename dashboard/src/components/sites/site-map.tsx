"use client";

import { LngLatBounds, Marker, Popup, type Map as MlMap } from "maplibre-gl";
import { useCallback } from "react";
import { BaseMap, FENCE_PAINT, upsertGeoJson } from "@/components/map/base-map";
import { fenceGeometry, type FenceSite } from "@/lib/domain/geo";
import { presenceState } from "@/lib/domain/status";

export type SiteMapMarker = {
  guard_id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  in_fence: boolean | null;
  last_seen_at: string | null;
  location_enabled: boolean;
  shift_id: string | null;
  battery_pct: number | null;
};

const STATE_COLOR: Record<string, string> = {
  live: "var(--present)",
  stale: "var(--muted-foreground)",
  location_off: "var(--signal)",
  off_duty: "var(--muted-foreground)",
};

/** Read-only map: the site fence (perimeter + leeway ring) and on-duty guard pins. */
export function SiteMap({
  site,
  markers = [],
  className,
  zoom = 15,
  stalenessMin = 15,
}: {
  site: FenceSite & { name?: string };
  markers?: SiteMapMarker[];
  className?: string;
  zoom?: number;
  stalenessMin?: number;
}) {
  const onReady = useCallback(
    (map: MlMap) => {
      const { perimeter, buffered } = fenceGeometry(site);
      if (buffered && upsertGeoJson(map, "fence-buffer", buffered)) {
        map.addLayer({ id: "fence-buffer-line", type: "line", source: "fence-buffer", paint: FENCE_PAINT.bufferLine });
      }
      if (upsertGeoJson(map, "fence", perimeter)) {
        map.addLayer({ id: "fence-fill", type: "fill", source: "fence", paint: FENCE_PAINT.perimeterFill });
        map.addLayer({ id: "fence-line", type: "line", source: "fence", paint: FENCE_PAINT.perimeterLine });
      }

      const el = document.createElement("div");
      el.className = "size-2.5 rounded-full bg-primary ring-2 ring-background";
      new Marker({ element: el }).setLngLat([site.lng, site.lat]).addTo(map);

      const created: Marker[] = [];
      for (const m of markers) {
        if (m.lat == null || m.lng == null) continue;
        const state = presenceState(m, stalenessMin);
        const node = document.createElement("div");
        node.setAttribute("data-guard", m.guard_id);
        node.className = "flex size-6 items-center justify-center rounded-full text-[9px] font-semibold text-white shadow ring-2 ring-background";
        node.style.background = STATE_COLOR[state] ?? "var(--muted-foreground)";
        if (m.in_fence === false) node.style.boxShadow = "0 0 0 3px var(--half-day)";
        node.textContent = m.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
        const marker = new Marker({ element: node })
          .setLngLat([m.lng, m.lat])
          .setPopup(
            new Popup({ offset: 14, closeButton: false }).setHTML(
              `<strong>${escapeHtml(m.name)}</strong><br/>${m.in_fence === false ? "Outside fence" : "Inside fence"}${
                m.battery_pct != null ? ` · ${m.battery_pct}%` : ""
              }`,
            ),
          )
          .addTo(map);
        created.push(marker);
      }

      const pts = markers.filter((m) => m.lat != null && m.lng != null);
      if (pts.length > 0) {
        const bounds = new LngLatBounds([site.lng, site.lat], [site.lng, site.lat]);
        for (const p of pts) bounds.extend([p.lng!, p.lat!]);
        map.fitBounds(bounds, { padding: 70, maxZoom: 16, animate: false });
      }

      return () => created.forEach((m) => m.remove());
    },
    [site, markers, stalenessMin],
  );

  return <BaseMap center={[site.lng, site.lat]} zoom={zoom} className={className} onReady={onReady} />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
