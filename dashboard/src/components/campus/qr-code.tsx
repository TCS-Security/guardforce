import QRCode from "qrcode";
import { cn } from "cn";

/**
 * A real, scannable QR code rendered as SVG paths (no canvas, no network), so it prints sharp
 * on a label printer and works in a server component.
 */
export function QrCode({ value, size = 160, className, label }: { value: string; size?: number; className?: string; label?: string }) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = 2;
  let d = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.modules.get(x, y)) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  const box = n + quiet * 2;
  return (
    <svg
      role="img"
      aria-label={label ?? `QR code for ${value}`}
      viewBox={`0 0 ${box} ${box}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={cn("rounded-sm bg-white", className)}
    >
      <path d={d} fill="#14160f" />
    </svg>
  );
}
