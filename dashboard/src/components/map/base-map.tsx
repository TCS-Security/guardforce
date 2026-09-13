"use client";

import {
  AttributionControl,
  Map as MlMap,
  NavigationControl,
  type FillLayerSpecification,
  type GeoJSONSource,
  type LineLayerSpecification,
  setWorkerUrl,
  type StyleSpecification,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import "maplibre-gl/dist/maplibre-gl.css";

export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/**
 * MapLibre derives its worker URL from its own module URL, which the bundler rewrites —
 * the worker then 404s and every vector tile and GeoJSON source silently stays empty.
 * The worker bundle is copied into /public/maplibre (see scripts/sync-maplibre-worker.mjs).
 */
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}

/** Flat canvas used when tile servers are unreachable (offline dev, CI, e2e runs). */
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#e9e4da" } }],
};

/** Cached across map instances so we probe the tile server at most once per page load. */
let styleProbe: Promise<StyleSpecification | string> | null = null;

/**
 * The style JSON alone is not enough: a network that serves it but stalls on the
 * TileJSON/tiles leaves MapLibre half-initialised. Probe both, once per page.
 */
function resolveStyle(): Promise<StyleSpecification | string> {
  if (!styleProbe) {
    styleProbe = (async () => {
      try {
        const res = await fetch(MAP_STYLE_URL, { signal: AbortSignal.timeout(2500) });
        if (!res.ok) return FALLBACK_STYLE;
        const style = (await res.json()) as StyleSpecification;
        const tileJson = Object.values(style.sources ?? {})
          .map((src) => (src as { url?: string }).url)
          .find((url): url is string => typeof url === "string" && url.startsWith("http"));
        if (tileJson) {
          const probe = await fetch(tileJson, { signal: AbortSignal.timeout(2500) });
          if (!probe.ok) return FALLBACK_STYLE;
        }
        return MAP_STYLE_URL as string;
      } catch {
        return FALLBACK_STYLE;
      }
    })();
  }
  return styleProbe;
}

export type { MlMap };

export type BaseMapProps = {
  center: [number, number];
  zoom?: number;
  interactive?: boolean;
  className?: string;
  /** Runs once the map has loaded; return a cleanup function if you add listeners or markers. */
  onReady?: (map: MlMap) => void | (() => void);
  children?: React.ReactNode;
};

/**
 * MapLibre canvas with a graceful fallback: if the tile style cannot be fetched we
 * render a flat canvas so fences, trails and markers stay readable and the page
 * never looks broken.
 */
export function BaseMap({ center, zoom = 15, interactive = true, className, onReady, children }: BaseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const onReadyRef = useRef(onReady);
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cleanup: void | (() => void);
    let map: MlMap | null = null;
    let disposed = false;

    void resolveStyle().then((style) => {
      if (disposed || !containerRef.current) return;
      if (style !== MAP_STYLE_URL) setTilesFailed(true);

      map = new MlMap({
        container: containerRef.current,
        style,
        center,
        zoom,
        interactive,
        attributionControl: false,
        fadeDuration: 0,
      });
      mapRef.current = map;
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __gfMap?: MlMap }).__gfMap = map;
      }

      // `load` waits for tiles too, which can hang on slow networks — the style being
      // parsed is enough to add our own sources, layers and markers.
      let attempts = 0;
      const whenStyleReady = () => {
        if (disposed || !map) return;
        try {
          if (interactive) map.addControl(new NavigationControl({ showCompass: false }), "top-right");
          map.addControl(new AttributionControl({ compact: true, customAttribution: "© OpenFreeMap · OSM" }));
          cleanup = onReadyRef.current?.(map);
          map.getContainer().setAttribute("data-map-ready", "true");
        } catch {
          if (attempts++ < 20) setTimeout(whenStyleReady, 150);
        }
      };
      map.once("styledata", whenStyleReady);
    });

    return () => {
      disposed = true;
      if (typeof cleanup === "function") cleanup();
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn("relative", className)} data-testid="map" data-tiles={tilesFailed ? "offline" : "online"}>
      <div ref={containerRef} className="size-full" />
      {tilesFailed && (
        <div className="pointer-events-none absolute top-2 left-2 rounded-md border bg-background/85 px-2 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur">
          Basemap offline — fence and positions only
        </div>
      )}
      {children}
    </div>
  );
}

/** Adds (or updates) a GeoJSON source. Returns true when the source was newly created. */
export function upsertGeoJson(map: MlMap, id: string, data: GeoJSON.FeatureCollection | GeoJSON.Feature) {
  const collection: GeoJSON.FeatureCollection =
    data.type === "FeatureCollection" ? data : { type: "FeatureCollection", features: [data] };
  const existing = map.getSource(id) as GeoJSONSource | undefined;
  if (existing) {
    existing.setData(collection);
    return false;
  }
  map.addSource(id, { type: "geojson", data: collection });
  return true;
}

export const FENCE_PAINT: {
  perimeterFill: FillLayerSpecification["paint"];
  perimeterLine: LineLayerSpecification["paint"];
  bufferLine: LineLayerSpecification["paint"];
} = {
  perimeterFill: { "fill-color": "#4a6b2f", "fill-opacity": 0.12 },
  perimeterLine: { "line-color": "#3f5c28", "line-width": 1.8 },
  bufferLine: { "line-color": "#3f5c28", "line-width": 1.2, "line-dasharray": [2, 2], "line-opacity": 0.8 },
};
