"use client";

import { LngLatBounds, Marker, type Map as MlMap } from "maplibre-gl";
import { useCallback } from "react";
import { BaseMap } from "@/components/map/base-map";

/** Small map on the lead card: the lead's pin, and the agency's own sites nearby as dots. */
export function LeadMap({
  lat,
  lng,
  name,
  sites,
  className,
}: {
  lat: number;
  lng: number;
  name: string;
  sites: { id: string; name: string; lat: number; lng: number }[];
  className?: string;
}) {
  const onReady = useCallback(
    (map: MlMap) => {
      const created: Marker[] = [];
      const pin = document.createElement("div");
      pin.className = "size-3.5 rounded-full bg-signal ring-[3px] ring-background shadow";
      pin.title = name;
      created.push(new Marker({ element: pin }).setLngLat([lng, lat]).addTo(map));
      const bounds = new LngLatBounds([lng, lat], [lng, lat]);
      for (const s of sites) {
        const dot = document.createElement("div");
        dot.className = "size-2.5 rounded-full bg-primary ring-2 ring-background";
        dot.title = `Your site: ${s.name}`;
        created.push(new Marker({ element: dot }).setLngLat([s.lng, s.lat]).addTo(map));
        bounds.extend([s.lng, s.lat]);
      }
      if (sites.length > 0) map.fitBounds(bounds, { padding: 36, maxZoom: 15, duration: 0 });
      return () => created.forEach((m) => m.remove());
    },
    [lat, lng, name, sites],
  );
  return <BaseMap center={[lng, lat]} zoom={14} interactive={false} className={className} onReady={onReady} />;
}
