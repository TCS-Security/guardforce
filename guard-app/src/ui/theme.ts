// Tokens from dashboard/src/app/globals.css (oklch → sRGB). One product, one palette.
export const light = {
  paper: "#F9F7F3", ink: "#1D1711", card: "#FEFDFB", secondary: "#EFECE6", accent: "#EBE8DF",
  border: "#DDD9D0", muted: "#69625A", olive: "#375028", oliveSoft: "#DFEDD9", oliveFg: "#FBFAF6",
  signal: "#E84C23", signalSoft: "#FFE8E1", destructive: "#CC2827",
  present: "#2A904B", halfDay: "#DE9D16", absent: "#D02C2A", onLeave: "#6084A9",
};
export const dark: typeof light = {
  paper: "#1D1711", ink: "#F9F7F3", card: "#262019", secondary: "#2E2721", accent: "#352D25",
  border: "#3F362D", muted: "#B4A99C", olive: "#9DBB86", oliveSoft: "#2C3F22", oliveFg: "#1D1711",
  signal: "#FF6B45", signalSoft: "#4A2418", destructive: "#F08A82",
  present: "#5FBF7C", halfDay: "#E6B04A", absent: "#F07070", onLeave: "#8DB0D4",
};
export type Palette = typeof light;

export const fonts = { display: "bricolage_grotesque", body: "schibsted_grotesk", mono: "jetbrains_mono" };

export type Tone = "present" | "halfDay" | "absent" | "onLeave" | "neutral" | "signal" | "olive";
export function toneColor(p: Palette, tone: Tone): string {
  switch (tone) {
    case "present": return p.present; case "halfDay": return p.halfDay; case "absent": return p.absent; case "onLeave": return p.onLeave;
    case "signal": return p.signal; case "olive": return p.olive; default: return p.muted;
  }
}

export const radius = { sm: 8, md: 12, lg: 16 };
