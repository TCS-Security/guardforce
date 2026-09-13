// Keeps public/maplibre in sync with the installed maplibre-gl worker bundle.
// Run after installing or upgrading maplibre-gl (wired into `bun run dev`/`build` via predev/prebuild).
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("maplibre-gl/dist/maplibre-gl.mjs"));
const out = path.resolve("public/maplibre");
await mkdir(out, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(path.join(dist, file), path.join(out, file));
}
console.log("maplibre worker synced to public/maplibre");
