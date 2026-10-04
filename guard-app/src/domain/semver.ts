const parts = (v: string) => v.trim().replace(/^v/, "").split(/[.\-+]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
/** Negative when a < b; "1.2" equals "1.2.0". */
export function compareVersions(a: string, b: string): number {
  const pa = parts(a), pb = parts(b);
  for (let i = 0; i < 3; i++) { const x = pa[i] ?? 0, y = pb[i] ?? 0; if (x !== y) return x < y ? -1 : 1; }
  return 0;
}
export const needsUpdate = (current: string, minimum?: string | null) => !!minimum && compareVersions(current, minimum) < 0;
