/**
 * Pure guard-roster logic shared by the dashboard and its tests: phone normalisation,
 * employee-code sequencing, invite deep links and profile-share expiry math.
 */

export const INVITE_SCHEME = "guardforce://invite/";

/** Strips punctuation and the +91 / 0 prefixes Indian numbers are typed with. */
export function normalizePhone(input: string): string {
  const digits = (input ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/** Indian mobile: 10 digits starting 6–9 (TRAI allocation). */
export function isValidIndianMobile(input: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizePhone(input));
}

/**
 * Next code in an agency's employee-code series, e.g. ["SSS-001","SSS-016"] -> "SSS-017".
 * Keeps the dominant prefix and zero-padding width; falls back to `<fallbackPrefix>001`.
 */
export function nextEmployeeCode(existing: (string | null | undefined)[], fallbackPrefix = "GRD-"): string {
  const parsed = existing
    .filter((c): c is string => !!c && c.trim().length > 0)
    .map((c) => /^(.*?)(\d+)$/.exec(c.trim()))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ prefix: m[1]!, num: Number(m[2]), width: m[2]!.length }));

  if (parsed.length === 0) return `${fallbackPrefix}001`;

  const counts = new Map<string, number>();
  for (const p of parsed) counts.set(p.prefix, (counts.get(p.prefix) ?? 0) + 1);
  const prefix = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];

  const series = parsed.filter((p) => p.prefix === prefix);
  const max = Math.max(...series.map((p) => p.num));
  const width = Math.max(...series.map((p) => p.width));
  return `${prefix}${String(max + 1).padStart(width, "0")}`;
}

/** Deep link the guard app registers; opened from the SMS/WhatsApp invite. */
export function inviteDeepLink(token: string) {
  return `${INVITE_SCHEME}${token}`;
}

export function inviteMessage(guardName: string, agencyName: string, token: string) {
  return `Hi ${guardName}, ${agencyName} has added you to GuardForce. Install the app and open this link to finish registration: ${inviteDeepLink(token)}`;
}

/** wa.me link for the manager to forward the invite over WhatsApp. */
export function whatsappUrl(phone: string, text: string) {
  return `https://wa.me/91${normalizePhone(phone)}?text=${encodeURIComponent(text)}`;
}

/** `sms:` link with the body pre-filled (RFC 5724 + iOS-friendly `&body=`). */
export function smsUrl(phone: string, text: string) {
  return `sms:+91${normalizePhone(phone)}?&body=${encodeURIComponent(text)}`;
}

// --- profile shares -------------------------------------------------------

export const SHARE_EXPIRY_DEFAULT_DAYS = 30;
export const SHARE_EXPIRY_MAX_DAYS = 90;

/** KYC-2: shares live 1–90 days, defaulting to 30. */
export function clampShareDays(days: number | null | undefined): number {
  if (days == null || !Number.isFinite(days)) return SHARE_EXPIRY_DEFAULT_DAYS;
  return Math.min(SHARE_EXPIRY_MAX_DAYS, Math.max(1, Math.round(days)));
}

export function shareExpiresAt(days: number | null | undefined, from: Date = new Date()): Date {
  return new Date(from.getTime() + clampShareDays(days) * 86_400_000);
}

export type ShareState = "active" | "expired" | "revoked";

export function shareState(
  share: { expires_at: string | Date; revoked_at?: string | Date | null },
  now: Date = new Date(),
): ShareState {
  if (share.revoked_at) return "revoked";
  return new Date(share.expires_at).getTime() < now.getTime() ? "expired" : "active";
}

/** Whole days remaining, floored at 0. */
export function shareDaysLeft(expiresAt: string | Date, now: Date = new Date()): number {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** Storage object path for a KYC document: <agency>/kyc/<code|guard id>/<type>-<ts>.<ext> */
export function kycObjectPath(agencyId: string, key: string, type: string, fileName: string, now: Date = new Date()) {
  const ext = (/\.([A-Za-z0-9]{1,5})$/.exec(fileName)?.[1] ?? "bin").toLowerCase();
  const safeKey = key.replace(/[^A-Za-z0-9._-]/g, "_");
  return `${agencyId}/kyc/${safeKey}/${type}-${now.getTime()}.${ext}`;
}
