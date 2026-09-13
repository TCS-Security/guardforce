"use client";

import { LngLatBounds, Marker, Popup, type Map as MlMap } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { BaseMap, FENCE_PAINT, upsertGeoJson, type MlMap as MapType } from "@/components/map/base-map";
import { fenceGeometry } from "@/lib/domain/geo";
import { presenceState, type PresenceState } from "@/lib/domain/status";
import { fmtAgo, fmtTime, initials } from "@/lib/domain/format";
import type { LivePresence, LiveSite } from "@/lib/data/live";

export const MARKER_STYLE: Record<PresenceState, { color: string; label: string }> = {
  live: { color: "var(--present)", label: "Live" },
  stale: { color: "var(--muted-foreground)", label: "Not seen recently" },
  location_off: { color: "var(--signal)", label: "Location off" },
  off_duty: { color: "var(--muted-foreground)", label: "Off duty" },
};

/**
 * The control-room map: every site's buffered fence plus a pin per on-duty guard.
 * Fences are layers (cheap at any count); guards are DOM markers so they can carry
 * initials, state colour and an out-of-fence ring.
 */
export function LiveMap({
  sites,
  presence,
  stalenessMin,
  focusSiteId,
  selectedGuardId,
  onSelectGuard,
  timezone,
  className,
}: {
  sites: LiveSite[];
  presence: LivePresence[];
  stalenessMin: number;
  focusSiteId: string | null;
  selectedGuardId: string | null;
  onSelectGuard: (guardId: string | null) => void;
  timezone: string;
  className?: string;
}) {
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const selectRef = useRef(onSelectGuard);
  // The marker and focus effects can run before the map finishes initialising.
  const [ready, setReady] = useState(0);

  useEffect(() => {
    selectRef.current = onSelectGuard;
  }, [onSelectGuard]);

  const center: [number, number] = sites.length > 0 ? [sites[0]!.lng, sites[0]!.lat] : [77.5946, 12.9716];

  const onReady = useCallback(
    (map: MapType) => {
      mapRef.current = map;
      setReady((n) => n + 1);

      const perimeters: GeoJSON.Feature[] = [];
      const buffers: GeoJSON.Feature[] = [];
      for (const s of sites) {
        const { perimeter, buffered } = fenceGeometry(s);
        perimeters.push({ ...perimeter, properties: { name: s.name, id: s.id } });
        if (buffered) buffers.push({ ...buffered, properties: { id: s.id } });
      }
      if (upsertGeoJson(map, "site-buffers", { type: "FeatureCollection", features: buffers })) {
        map.addLayer({ id: "site-buffers-line", type: "line", source: "site-buffers", paint: FENCE_PAINT.bufferLine });
      }
      if (upsertGeoJson(map, "site-fences", { type: "FeatureCollection", features: perimeters })) {
        map.addLayer({ id: "site-fences-fill", type: "fill", source: "site-fences", paint: FENCE_PAINT.perimeterFill });
        map.addLayer({ id: "site-fences-line", type: "line", source: "site-fences", paint: FENCE_PAINT.perimeterLine });
        map.addLayer({
          id: "site-fences-label",
          type: "symbol",
          source: "site-fences",
          layout: { "text-field": ["get", "name"], "text-size": 11, "text-offset": [0, 0.6], "text-anchor": "top" },
          paint: { "text-color": "#3f5c28", "text-halo-color": "#ffffff", "text-halo-width": 1.4 },
        });
      }

      if (sites.length > 1) {
        const bounds = new LngLatBounds([sites[0]!.lng, sites[0]!.lat], [sites[0]!.lng, sites[0]!.lat]);
        for (const s of sites) bounds.extend([s.lng, s.lat]);
        map.fitBounds(bounds, { padding: 80, maxZoom: 13, animate: false });
      }
    },
    [sites],
  );

  // Guard pins are rebuilt whenever presence changes (realtime pushes new rows in).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();

    for (const p of presence) {
      if (p.lat == null || p.lng == null) continue;
      seen.add(p.guard_id);
      const state = presenceState(p, stalenessMin);
      const name = p.guards?.full_name ?? "Guard";
      const existing = markersRef.current.get(p.guard_id);
      const el = existing?.getElement() ?? document.createElement("button");

      el.setAttribute("type", "button");
      el.setAttribute("data-guard", p.guard_id);
      el.setAttribute("aria-label", `${name} — ${MARKER_STYLE[state].label}`);
      el.className = "flex size-7 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow ring-2 ring-background transition-transform hover:scale-110";
      el.style.background = MARKER_STYLE[state].color;
      el.style.outline = p.in_fence === false ? "3px solid var(--half-day)" : "";
      el.style.transform = p.guard_id === selectedGuardId ? "scale(1.25)" : "";
      el.textContent = initials(name);
      el.onclick = () => selectRef.current(p.guard_id);

      const popup = new Popup({ offset: 16, closeButton: false }).setHTML(
        `<strong>${escapeHtml(name)}</strong><br/>${escapeHtml(p.shifts?.shift_types?.name ?? "Shift")} · since ${escapeHtml(
          fmtTime(p.shifts?.started_at, timezone),
        )}<br/>${p.in_fence === false ? "Outside fence" : "Inside fence"} · ${p.battery_pct ?? "?"}% · seen ${escapeHtml(fmtAgo(p.last_seen_at))}`,
      );

      if (existing) {
        existing.setLngLat([p.lng, p.lat]).setPopup(popup);
      } else {
        markersRef.current.set(p.guard_id, new Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map));
      }
    }

    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
  }, [presence, stalenessMin, selectedGuardId, timezone, ready]);

  // Focusing a site (or a guard) flies the map there.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (selectedGuardId) {
      const p = presence.find((x) => x.guard_id === selectedGuardId);
      if (p?.lat != null && p.lng != null) {
        map.flyTo({ center: [p.lng, p.lat], zoom: 16, duration: 600 });
        markersRef.current.get(selectedGuardId)?.togglePopup();
        return;
      }
    }
    if (focusSiteId) {
      const s = sites.find((x) => x.id === focusSiteId);
      if (s) map.flyTo({ center: [s.lng, s.lat], zoom: 15, duration: 600 });
    } else if (sites.length > 1) {
      const bounds = new LngLatBounds([sites[0]!.lng, sites[0]!.lat], [sites[0]!.lng, sites[0]!.lat]);
      for (const s of sites) bounds.extend([s.lng, s.lat]);
      map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 600 });
    }
  }, [focusSiteId, selectedGuardId, sites, presence, ready]);

  return <BaseMap center={center} zoom={12} className={className} onReady={onReady} />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
