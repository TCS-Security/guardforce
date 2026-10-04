/**
 * Permission catalogue — a TypeScript mirror of public.permission_catalogue.
 *
 * The database is the source of truth (roles are validated against it by trigger); this
 * mirror exists so the UI can lay out the role editor and the nav can gate itself without
 * a round trip, and so pure helpers can be unit tested.
 */
export const PERMISSION_KEYS = [
  "sites:read", "sites:write",
  "guards:read", "guards:write", "guards:kyc", "guards:share",
  "roster:read", "roster:write",
  "attendance:read", "attendance:correct",
  "live:read",
  "events:read", "events:acknowledge",
  "incidents:read", "incidents:write",
  "patrols:read", "patrols:write",
  "tasks:read", "tasks:write",
  "leave:read", "leave:decide",
  "reports:read", "reports:export",
  "settings:read", "settings:write",
  "team:read", "team:manage",
  "audit:read",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

/** Rows of the role editor: one resource, its read permission, and its extra actions. */
export const PERMISSION_RESOURCES: {
  resource: string;
  label: string;
  read: PermissionKey;
  actions: { key: PermissionKey; label: string; hint: string }[];
}[] = [
  { resource: "sites", label: "Sites", read: "sites:read", actions: [{ key: "sites:write", label: "Manage", hint: "Create and edit sites, fences and shift types" }] },
  {
    resource: "guards",
    label: "Guards",
    read: "guards:read",
    actions: [
      { key: "guards:write", label: "Manage", hint: "Add, edit, invite and deactivate guards" },
      { key: "guards:kyc", label: "KYC documents", hint: "Open, upload, verify and reject identity documents" },
      { key: "guards:share", label: "Share profiles", hint: "Create and revoke shareable profile links" },
    ],
  },
  { resource: "roster", label: "Roster", read: "roster:read", actions: [{ key: "roster:write", label: "Manage", hint: "Assign and remove guards, create weekly patterns" }] },
  { resource: "attendance", label: "Attendance", read: "attendance:read", actions: [{ key: "attendance:correct", label: "Correct", hint: "Override attendance and log location exceptions (audited)" }] },
  { resource: "live", label: "Live map", read: "live:read", actions: [] },
  { resource: "events", label: "Events", read: "events:read", actions: [{ key: "events:acknowledge", label: "Acknowledge", hint: "Mark alerts as seen" }] },
  { resource: "incidents", label: "Incidents", read: "incidents:read", actions: [{ key: "incidents:write", label: "Log & resolve", hint: "Report incidents and move them through investigation to resolved" }] },
  { resource: "patrols", label: "Patrols", read: "patrols:read", actions: [{ key: "patrols:write", label: "Manage", hint: "Define routes and annotate rounds" }] },
  { resource: "tasks", label: "Tasks", read: "tasks:read", actions: [{ key: "tasks:write", label: "Manage", hint: "Create, assign, close and delete tasks" }] },
  { resource: "leave", label: "Leave", read: "leave:read", actions: [{ key: "leave:decide", label: "Decide", hint: "Approve, decline and log leave; edit balances" }] },
  { resource: "reports", label: "Reports", read: "reports:read", actions: [{ key: "reports:export", label: "Export", hint: "Download muster rolls and other CSVs" }] },
  { resource: "settings", label: "Settings", read: "settings:read", actions: [{ key: "settings:write", label: "Change", hint: "Edit agency defaults and the guard-app config" }] },
  { resource: "team", label: "Team", read: "team:read", actions: [{ key: "team:manage", label: "Manage", hint: "Invite users, assign roles and site scope, edit roles" }] },
  { resource: "audit", label: "Audit log", read: "audit:read", actions: [] },
];

/** The read key a route needs, used by the nav and by page guards. */
export const ROUTE_PERMISSION: Record<string, PermissionKey> = {
  "/live": "live:read",
  "/events": "events:read",
  "/incidents": "incidents:read",
  "/sites": "sites:read",
  "/guards": "guards:read",
  "/roster": "roster:read",
  "/attendance": "attendance:read",
  "/patrols": "patrols:read",
  "/tasks": "tasks:read",
  "/leave": "leave:read",
  "/reports": "reports:read",
  "/settings": "settings:read",
};

/** Write permissions imply their read permission; the editor keeps the pair consistent. */
export function withImpliedReads(keys: Iterable<string>): PermissionKey[] {
  const set = new Set<PermissionKey>();
  for (const k of keys) {
    if (!isPermissionKey(k)) continue;
    set.add(k);
    const read = `${k.split(":")[0]}:read`;
    if (isPermissionKey(read)) set.add(read);
  }
  return PERMISSION_KEYS.filter((k) => set.has(k));
}

/** Removing a read permission also drops the actions that depend on it. */
export function withoutResource(keys: Iterable<string>, readKey: PermissionKey): PermissionKey[] {
  const resource = readKey.split(":")[0];
  return PERMISSION_KEYS.filter((k) => new Set(keys).has(k) && !k.startsWith(`${resource}:`));
}

/** Short summary for a role row: "All", "Read-only", or "12 of 26". */
export function describePermissions(keys: readonly string[]): string {
  const set = new Set(keys);
  if (PERMISSION_KEYS.every((k) => set.has(k))) return "Everything";
  const reads = PERMISSION_KEYS.filter((k) => k.endsWith(":read"));
  const onlyReads = [...set].every((k) => k.endsWith(":read"));
  if (onlyReads && reads.every((k) => set.has(k))) return "Read-only, everything";
  if (onlyReads) return `Read-only, ${set.size} of ${reads.length} areas`;
  return `${set.size} of ${PERMISSION_KEYS.length}`;
}
