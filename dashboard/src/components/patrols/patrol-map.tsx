"use client";

import { LngLatBounds, Marker, Popup, type Map as MlMap } from "maplibre-gl";
import { useCallback } from "react";
import { BaseMap, FENCE_PAINT, upsertGeoJson } from "@/components/map/base-map";
import { fenceGeometry, type FenceSite } from "@/lib/domain/geo";

export type PatrolPhotoPin = { id: string; lat: number | null; lng: number | null; taken_at: string; index: number };

/** The walked route over the site fence, with a pin where each photo was taken. */
export function PatrolMap({
  site,
  trail,
  photos,
  className,
}: {
  site: FenceSite;
  trail: unknown;
  photos: PatrolPhotoPin[];
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

      const line = trail as { type?: string; coordinates?: [number, number][] } | null;
      const coords = line?.type === "LineString" ? (line.coordinates ?? []) : [];
      if (coords.length > 1) {
        upsertGeoJson(map, "patrol-trail", { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
        map.addLayer({
          id: "patrol-trail-line",
          type: "line",
          source: "patrol-trail",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#7a6a52", "line-width": 3, "line-opacity": 0.9 },
        });
        map.addLayer({
          id: "patrol-trail-arrows",
          type: "symbol",
          source: "patrol-trail",
          layout: { "symbol-placement": "line", "text-field": "▸", "text-size": 14, "symbol-spacing": 60 },
          paint: { "text-color": "#5c4f3c" },
        });
      }

      const markers: Marker[] = [];
      for (const p of photos) {
        if (p.lat == null || p.lng == null) continue;
        const el = document.createElement("div");
        el.className = "flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground ring-2 ring-background";
        el.textContent = String(p.index);
        markers.push(
          new Marker({ element: el })
            .setLngLat([p.lng, p.lat])
            .setPopup(new Popup({ offset: 12, closeButton: false }).setText(`Photo ${p.index}`))
            .addTo(map),
        );
      }

      const pts = [...coords, ...photos.filter((p) => p.lat != null && p.lng != null).map((p) => [p.lng!, p.lat!] as [number, number])];
      if (pts.length > 0) {
        const bounds = new LngLatBounds(pts[0]!, pts[0]!);
        for (const c of pts) bounds.extend(c);
        map.fitBounds(bounds, { padding: 60, maxZoom: 18, animate: false });
      }

      return () => markers.forEach((m) => m.remove());
    },
    [site, trail, photos],
  );

  return <BaseMap center={[site.lng, site.lat]} zoom={16} className={className} onReady={onReady} />;
}
