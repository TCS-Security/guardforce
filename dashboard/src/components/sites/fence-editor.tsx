"use client";

import { LngLatBounds, Marker, type Map as MlMap } from "maplibre-gl";
import { Crosshair, MapPin, Pentagon, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BaseMap, FENCE_PAINT, upsertGeoJson } from "@/components/map/base-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Eyebrow } from "@/components/gf/eyebrow";
import { fenceGeometry } from "@/lib/domain/geo";
import { LEEWAY_MAX_M, RADIUS_MAX_M, RADIUS_MIN_M, parseLatLng, polygonRing, ringCentroid, validatePolygonRing, type LngLat } from "@/lib/domain/sites";
import { cn } from "cn";

export type FenceValue = {
  lat: number;
  lng: number;
  fence_type: "radius" | "polygon";
  radius_m: number;
  leeway_m: number;
  ring: LngLat[];
};

/**
 * Map-based perimeter editor (F1, FENCE-1). Emits hidden form inputs so it can sit
 * inside a plain server-action form. The buffered fence (perimeter + leeway) is drawn
 * live because that is what every fence check actually uses.
 */
export function FenceEditor({
  initial,
  className,
}: {
  initial: Partial<FenceValue> & { lat: number; lng: number; radius_m: number; leeway_m: number; polygon?: unknown };
  className?: string;
}) {
  const [value, setValue] = useState<FenceValue>({
    lat: initial.lat,
    lng: initial.lng,
    fence_type: initial.fence_type ?? "radius",
    radius_m: initial.radius_m,
    leeway_m: initial.leeway_m,
    ring: initial.ring ?? polygonRing(initial.polygon) ?? [],
  });
  const [coordText, setCoordText] = useState(`${initial.lat.toFixed(5)}, ${initial.lng.toFixed(5)}`);
  const [coordError, setCoordError] = useState<string | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const polygonCheck = value.fence_type === "polygon" ? validatePolygonRing(value.ring) : null;

  const [mapReady, setMapReady] = useState(0);

  const onReady = useCallback((map: MlMap) => {
    mapRef.current = map;
    setMapReady((n) => n + 1);

    const el = document.createElement("div");
    el.className = "size-4 rounded-full border-2 border-background bg-primary shadow";
    const marker = new Marker({ element: el, draggable: true })
      .setLngLat([valueRef.current.lng, valueRef.current.lat])
      .addTo(map);
    marker.on("dragend", () => {
      const { lng, lat } = marker.getLngLat();
      setValue((v) => ({ ...v, lat, lng }));
      setCoordText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    });
    markerRef.current = marker;

    map.on("click", (e) => {
      const v = valueRef.current;
      if (v.fence_type === "polygon") {
        setValue((prev) => ({ ...prev, ring: [...prev.ring, [e.lngLat.lng, e.lngLat.lat]] }));
      } else {
        setValue((prev) => ({ ...prev, lat: e.lngLat.lat, lng: e.lngLat.lng }));
        setCoordText(`${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)}`);
      }
    });
    map.getCanvas().style.cursor = "crosshair";

    return () => {
      marker.remove();
      mapRef.current = null;
    };
  }, []);

  // Redraw the fence whenever geometry inputs change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    markerRef.current?.setLngLat([value.lng, value.lat]);

    const site = {
      lat: value.lat,
      lng: value.lng,
      fence_type: value.fence_type,
      radius_m: value.radius_m,
      leeway_m: value.leeway_m,
      polygon: value.fence_type === "polygon" && value.ring.length >= 3 ? { type: "Polygon", coordinates: [[...value.ring, value.ring[0]!]] } : null,
    };
    const { perimeter, buffered } = fenceGeometry(site);

    if (upsertGeoJson(map, "edit-buffer", buffered ?? perimeter)) {
      map.addLayer({ id: "edit-buffer-line", type: "line", source: "edit-buffer", paint: FENCE_PAINT.bufferLine });
    }
    if (upsertGeoJson(map, "edit-fence", perimeter)) {
      map.addLayer({ id: "edit-fence-fill", type: "fill", source: "edit-fence", paint: FENCE_PAINT.perimeterFill });
      map.addLayer({ id: "edit-fence-line", type: "line", source: "edit-fence", paint: FENCE_PAINT.perimeterLine });
    }

    const vertices: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: value.fence_type === "polygon"
        ? value.ring.map((p, i) => ({ type: "Feature", properties: { i: i + 1 }, geometry: { type: "Point", coordinates: p } }))
        : [],
    };
    if (upsertGeoJson(map, "edit-vertices", vertices)) {
      map.addLayer({
        id: "edit-vertices-dot",
        type: "circle",
        source: "edit-vertices",
        paint: { "circle-radius": 5, "circle-color": "#ffffff", "circle-stroke-color": "#4a6b2f", "circle-stroke-width": 2 },
      });
    }
  }, [value, mapReady]);

  function applyTypedCoords() {
    const parsed = parseLatLng(coordText);
    if (!parsed) {
      setCoordError("Enter coordinates as “12.9354, 77.6925”.");
      return;
    }
    setCoordError(null);
    setValue((v) => ({ ...v, lat: parsed.lat, lng: parsed.lng }));
    mapRef.current?.flyTo({ center: [parsed.lng, parsed.lat], zoom: 16, animate: false });
  }

  function switchMode(mode: "radius" | "polygon") {
    setValue((v) => {
      if (mode === "radius" && v.ring.length >= 3) {
        const c = ringCentroid(v.ring);
        if (c) {
          setCoordText(`${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`);
          return { ...v, fence_type: mode, lat: c.lat, lng: c.lng };
        }
      }
      return { ...v, fence_type: mode };
    });
  }

  function fitFence() {
    const map = mapRef.current;
    if (!map) return;
    if (value.fence_type === "polygon" && value.ring.length >= 2) {
      const b = new LngLatBounds(value.ring[0]!, value.ring[0]!);
      for (const p of value.ring) b.extend(p);
      map.fitBounds(b, { padding: 60, animate: false });
    } else {
      map.flyTo({ center: [value.lng, value.lat], zoom: 16, animate: false });
    }
  }

  return (
    <div className={cn("grid gap-4 lg:grid-cols-[1fr_260px]", className)}>
      <input type="hidden" name="lat" value={value.lat} />
      <input type="hidden" name="lng" value={value.lng} />
      <input type="hidden" name="fence_type" value={value.fence_type} />
      <input type="hidden" name="radius_m" value={value.radius_m} />
      <input type="hidden" name="leeway_m" value={value.leeway_m} />
      <input type="hidden" name="polygon" value={value.ring.length >= 3 ? JSON.stringify(value.ring) : ""} />

      <div className="relative overflow-hidden rounded-lg border">
        <BaseMap center={[value.lng, value.lat]} zoom={16} className="h-[360px] w-full" onReady={onReady} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent px-3 py-2">
          <p className="font-mono text-[11px] text-muted-foreground">
            {value.fence_type === "radius"
              ? "Click or drag the pin to place the site. The dashed ring is the leeway buffer."
              : "Click to add perimeter points. At least 3 points, then the shape closes itself."}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <Eyebrow className="mb-1.5">Fence type</Eyebrow>
          <div className="grid grid-cols-2 gap-1.5">
            <Button type="button" variant={value.fence_type === "radius" ? "secondary" : "outline"} size="sm" onClick={() => switchMode("radius")} aria-pressed={value.fence_type === "radius"}>
              <MapPin data-icon="inline-start" /> Radius
            </Button>
            <Button type="button" variant={value.fence_type === "polygon" ? "secondary" : "outline"} size="sm" onClick={() => switchMode("polygon")} aria-pressed={value.fence_type === "polygon"}>
              <Pentagon data-icon="inline-start" /> Polygon
            </Button>
          </div>
        </div>

        {value.fence_type === "radius" ? (
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <Label htmlFor="radius-slider">Radius</Label>
              <span className="font-mono tabular text-xs text-muted-foreground">{value.radius_m} m</span>
            </div>
            <Slider
              id="radius-slider"
              min={RADIUS_MIN_M}
              max={RADIUS_MAX_M}
              step={10}
              value={value.radius_m}
              onValueChange={(v) => setValue((prev) => ({ ...prev, radius_m: Array.isArray(v) ? v[0]! : v }))}
            />
          </div>
        ) : (
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <Label>Perimeter</Label>
              <span className="font-mono tabular text-xs text-muted-foreground">{value.ring.length} points</span>
            </div>
            <div className="flex gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => setValue((v) => ({ ...v, ring: v.ring.slice(0, -1) }))} disabled={value.ring.length === 0}>
                <Undo2 data-icon="inline-start" /> Undo
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setValue((v) => ({ ...v, ring: [] }))} disabled={value.ring.length === 0}>
                <X data-icon="inline-start" /> Clear
              </Button>
            </div>
            {polygonCheck && !polygonCheck.ok && (
              <p className="mt-1.5 text-xs text-signal">{polygonCheck.error}</p>
            )}
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <Label htmlFor="leeway-slider">Leeway buffer</Label>
            <span className="font-mono tabular text-xs text-muted-foreground">+{value.leeway_m} m</span>
          </div>
          <Slider
            id="leeway-slider"
            min={0}
            max={LEEWAY_MAX_M}
            step={10}
            value={value.leeway_m}
            onValueChange={(v) => setValue((prev) => ({ ...prev, leeway_m: Array.isArray(v) ? v[0]! : v }))}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Site boundaries are rarely exact. Every fence check — attendance, away time, exit alerts — allows this much slack.
          </p>
        </div>

        <div>
          <Label htmlFor="coords" className="mb-1.5">Coordinates</Label>
          <div className="flex gap-1.5">
            <Input
              id="coords"
              value={coordText}
              onChange={(e) => setCoordText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyTypedCoords(); } }}
              className="h-8 font-mono text-xs"
              placeholder="12.9354, 77.6925"
            />
            <Button type="button" variant="outline" size="icon-sm" onClick={applyTypedCoords} aria-label="Go to coordinates">
              <Crosshair />
            </Button>
          </div>
          {coordError && <p className="mt-1.5 text-xs text-signal" role="alert">{coordError}</p>}
          <button type="button" onClick={fitFence} className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Fit map to fence
          </button>
        </div>
      </div>
    </div>
  );
}
