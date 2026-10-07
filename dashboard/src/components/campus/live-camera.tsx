"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ImageIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/gf/status-pill";
import { cn } from "cn";

/**
 * Live photo with a burned-in watermark (who took it, when, where). Uses the real camera when
 * the browser allows it; a laptop in a demo room often will not, so "Sample photo" draws a
 * stand-in through the same watermarking path. There is deliberately no gallery upload: a
 * photo from the gallery proves nothing about now.
 */
export type Watermark = { by: string; place: string; gps?: string };

type CamState = "idle" | "connecting" | "live" | "denied" | "captured";

export function LiveCamera({ watermark, onCapture, value, label = "Live photo", aspect = "aspect-[4/3]" }: {
  watermark: Watermark;
  onCapture: (dataUrl: string | null) => void;
  value: string | null;
  label?: string;
  aspect?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CamState>(value ? "captured" : "idle");

  useEffect(() => () => stop(), []);

  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  async function open() {
    setState("connecting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: 960 }, audio: false });
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play().catch(() => {});
      }
      setState("live");
    } catch {
      setState("denied");
    }
  }

  function stamp(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
    const w = 960, h = 720;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    draw(ctx, w, h);
    const now = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date());
    ctx.fillStyle = "rgba(10,12,8,0.62)";
    ctx.fillRect(0, h - 118, w, 118);
    ctx.fillStyle = "#e9e4c9";
    ctx.font = "600 26px ui-monospace, monospace";
    ctx.fillText(`● ${watermark.by}`, 24, h - 80);
    ctx.font = "22px ui-monospace, monospace";
    ctx.fillText(`${now} IST · ${watermark.place}`, 24, h - 48);
    ctx.fillText(`${watermark.gps ?? "GPS fixed"} · GuardWatch AI verified capture`, 24, h - 18);
    return c.toDataURL("image/jpeg", 0.82);
  }

  function capture() {
    const v = video.current;
    if (!v) return;
    const url = stamp((ctx, w, h) => ctx.drawImage(v, 0, 0, w, h));
    stop();
    setState("captured");
    onCapture(url);
  }

  function sample() {
    const url = stamp((ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#5d6b4a");
      g.addColorStop(1, "#2b3122");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // A corridor in perspective, so the frame reads as a place rather than a swatch.
      ctx.strokeStyle = "rgba(233,228,201,0.35)";
      ctx.lineWidth = 3;
      for (const [x1, y1, x2, y2] of [[0, 0, 360, 260], [w, 0, 600, 260], [0, h - 118, 360, 460], [w, h - 118, 600, 460]] as const) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      ctx.strokeRect(360, 260, 240, 200);
      ctx.fillStyle = "rgba(233,228,201,0.18)";
      ctx.fillRect(440, 300, 80, 160);
      ctx.fillStyle = "rgba(255,120,60,0.85)";
      ctx.fillRect(452, 280, 56, 14);
    });
    stop();
    setState("captured");
    onCapture(url);
  }

  function retake() {
    onCapture(null);
    setState("idle");
  }

  const chip: Record<CamState, { text: string; tone: "neutral" | "half-day" | "present" | "absent" | "olive" }> = {
    idle: { text: "Camera ready", tone: "neutral" },
    connecting: { text: "Connecting…", tone: "half-day" },
    live: { text: "Live", tone: "present" },
    denied: { text: "Camera blocked", tone: "absent" },
    captured: { text: "Captured · watermarked", tone: "olive" },
  };

  return (
    <div className="flex flex-col gap-2" data-testid="live-camera">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <StatusPill tone={chip[state].tone} size="xs" pulse={state === "live"}>{chip[state].text}</StatusPill>
      </div>
      <div className={cn("relative overflow-hidden rounded-lg border bg-ink", aspect)}>
        {value ? (
          <img src={value} alt="Captured photo with watermark" className="size-full object-cover" />
        ) : (
          <>
            <video ref={video} muted playsInline className={cn("size-full object-cover", state !== "live" && "hidden")} />
            {state !== "live" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-xs text-white/70">
                {state === "denied" ? <CameraOff className="size-6" /> : <Camera className="size-6" />}
                <span className="max-w-[220px]">
                  {state === "denied" ? "This browser did not allow the camera. Use a sample photo for the demo." : state === "connecting" ? "Waiting for the camera…" : "Gallery uploads are off: only a photo taken now counts."}
                </span>
              </div>
            )}
            {state === "live" && <div className="pointer-events-none absolute inset-6 rounded-md border-2 border-dashed border-white/50" />}
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {state === "captured" ? (
          <Button type="button" variant="outline" size="sm" onClick={retake}><RotateCcw data-icon="inline-start" /> Retake</Button>
        ) : state === "live" ? (
          <Button type="button" size="sm" onClick={capture}><Camera data-icon="inline-start" /> Capture</Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={open} disabled={state === "connecting"}><Camera data-icon="inline-start" /> Open camera</Button>
        )}
        {state !== "captured" && (
          <Button type="button" variant="ghost" size="sm" onClick={sample}><ImageIcon data-icon="inline-start" /> Sample photo</Button>
        )}
      </div>
    </div>
  );
}
