"use client";

import { LngLatBounds, Marker, Popup, type Map as MlMap } from "maplibre-gl";
import { useCallback } from "react";
import { BaseMap, FENCE_PAINT, upsertGeoJson } from "@/components/map/base-map";
import { fenceGeometry, type FenceSite } from "@/lib/domain/geo";
import { fmtGap, plottable, type GuardPosition } from "@/lib/domain/incidents";
import { fmtDistance, initials } from "@/lib/domain/format";
import type { IncidentPosition } from "@/lib/data/incidents";

/**
 * "Where were the guards when it happened."
 *
 * The site fence, a pin on the incident itself, and one marker per guard whose position
 * we can actually vouch for. Guards whose nearest fix is stale, or whose device had
 * location switched off, are deliberately NOT drawn — the list beside the map calls them
 * unknown instead, because a confident pin in the wrong place is worse than no pin.
 */
export function IncidentMap({
  site,
  incident,
  positions,
  className,
}: {
  site: FenceSite & { name: string };
  incident: { lat: number | null; lng: number | null; title: string; occurred_at: string };
  positions: IncidentPosition[];
  className?: string;
}) {
  const center: [number, number] = [incident.lng ?? site.lng, incident.lat ?? site.lat];

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

      const located = plottable(positions as (IncidentPosition & GuardPosition)[]);
      const markers: Marker[] = [];

      // The incident itself: a ringed signal-coloured pin so it reads first.
      const incidentEl = document.createElement("div");
      incidentEl.setAttribute("data-testid", "incident-pin");
      incidentEl.className = "size-5 rounded-full border-[3px] border-white shadow-lg";
      incidentEl.style.background = "var(--signal)";
      incidentEl.style.boxShadow = "0 0 0 6px color-mix(in oklch, var(--signal) 25%, transparent)";
      markers.push(
        new Marker({ element: incidentEl })
          .setLngLat(center)
          .setPopup(
            new Popup({ offset: 14, closeButton: false }).setHTML(
              `<strong>${escapeHtml(incident.title)}</strong><br/>${
                incident.lat == null ? "Pinned to the site — no exact spot recorded" : "Reported here"
              }`,
            ),
          )
          .addTo(map),
      );

      for (const p of located) {
        const el = document.createElement("div");
        el.setAttribute("data-guard", p.guard_id);
        el.className =
          "flex size-7 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow ring-2 ring-background";
        el.style.background = p.same_site ? "var(--present)" : "var(--muted-foreground)";
        el.style.outline = p.in_fence === false ? "3px solid var(--half-day)" : "";
        el.textContent = initials(p.guard_name);
        markers.push(
          new Marker({ element: el })
            .setLngLat([p.lng, p.lat])
            .setPopup(
              new Popup({ offset: 16, closeButton: false }).setHTML(
                `<strong>${escapeHtml(p.guard_name)}</strong><br/>${escapeHtml(p.site_name)}<br/>` +
                  `${escapeHtml(fmtGap(p.gap_seconds, p.recorded_at, incident.occurred_at))} · ${escapeHtml(
                    fmtDistance(p.distance_m),
                  )} away<br/>${p.in_fence === false ? "Outside the fence" : "Inside the fence"}`,
              ),
            )
            .addTo(map),
        );
      }

      // Fit to the incident and the guards at its own site; a colleague 20 km away must
      // not zoom the map out until the scene of the incident is a dot.
      const bounds = new LngLatBounds(center, center);
      bounds.extend([site.lng, site.lat]);
      for (const p of located) {
        if (p.same_site) bounds.extend([p.lng, p.lat]);
      }
      map.fitBounds(bounds, { padding: 70, maxZoom: 16.5, animate: false });

      return () => markers.forEach((m) => m.remove());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [site, positions, incident.lat, incident.lng, incident.title, incident.occurred_at],
  );

  return <BaseMap center={center} zoom={15} className={className} onReady={onReady} />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Legend used under the map so the marker colours are not a guessing game. */
export function IncidentMapLegend({ unknown }: { unknown: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2 text-xs text-muted-foreground">
      <Swatch color="var(--signal)" label="The incident" />
      <Swatch color="var(--present)" label="On duty at this site" />
      <Swatch color="var(--muted-foreground)" label="On duty elsewhere" />
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-2.5 rounded-full ring-2 ring-half-day" />
        Outside the fence
      </span>
      {unknown > 0 && <span>{unknown} guard{unknown === 1 ? "" : "s"} not plotted — position unknown at that moment</span>}
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
