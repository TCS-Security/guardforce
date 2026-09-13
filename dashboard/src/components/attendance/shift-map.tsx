"use client";

import { LngLatBounds, Marker, Popup, type Map as MlMap } from "maplibre-gl";
import { useCallback } from "react";
import { BaseMap, FENCE_PAINT, upsertGeoJson } from "@/components/map/base-map";
import { fenceGeometry, type FenceSite } from "@/lib/domain/geo";
import { trailGeoJson, type Ping } from "@/lib/domain/away";

/**
 * Shift replay: the buffered fence, the guard's breadcrumb trail (points turn red
 * outside the fence) and the check-in / check-out pins.
 */
export function ShiftMap({
  site,
  pings,
  start,
  end,
  className,
}: {
  site: FenceSite;
  pings: Ping[];
  start?: { lat: number | null; lng: number | null; label: string } | null;
  end?: { lat: number | null; lng: number | null; label: string } | null;
  className?: string;
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

      const { line, points } = trailGeoJson(pings);
      if (upsertGeoJson(map, "trail", line)) {
        map.addLayer({
          id: "trail-line",
          type: "line",
          source: "trail",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#7a6a52", "line-width": 2, "line-opacity": 0.85 },
        });
      }
      if (upsertGeoJson(map, "trail-points", points)) {
        map.addLayer({
          id: "trail-dots",
          type: "circle",
          source: "trail-points",
          paint: {
            "circle-radius": 3.5,
            "circle-color": ["case", ["==", ["get", "in_fence"], 0], "#c0492b", "#4a6b2f"],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1,
          },
        });
      }

      const markers: Marker[] = [];
      const addPin = (p: { lat: number | null; lng: number | null; label: string } | null | undefined, color: string) => {
        if (!p || p.lat == null || p.lng == null) return;
        const el = document.createElement("div");
        el.className = "size-3.5 rounded-full border-2 border-white shadow";
        el.style.background = color;
        markers.push(
          new Marker({ element: el })
            .setLngLat([p.lng, p.lat])
            .setPopup(new Popup({ offset: 12, closeButton: false }).setText(p.label))
            .addTo(map),
        );
      };
      addPin(start, "#3f5c28");
      addPin(end, "#7a6a52");

      const located = pings.filter((p) => p.lat != null && p.lng != null);
      if (located.length > 0) {
        const bounds = new LngLatBounds([site.lng, site.lat], [site.lng, site.lat]);
        for (const p of located) bounds.extend([p.lng!, p.lat!]);
        map.fitBounds(bounds, { padding: 60, maxZoom: 17, animate: false });
      }

      return () => markers.forEach((m) => m.remove());
    },
    [site, pings, start, end],
  );

  return <BaseMap center={[site.lng, site.lat]} zoom={15} className={className} onReady={onReady} />;
}
