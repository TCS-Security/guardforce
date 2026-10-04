import * as SQLite from "expo-sqlite";

/** Local state: the outbox, the phone's own record of the shift, cached payloads, optimistic overrides. */
export const db = SQLite.openDatabaseSync("guardforce.db");

db.execSync(`
  pragma journal_mode = wal;
  create table if not exists outbox (id integer primary key autoincrement, kind text not null, payload text not null, created_at integer not null, attempts integer not null default 0, last_error text, blocked integer not null default 0);
  create table if not exists local_shifts (key text primary key, server_id text, site_id text not null, guard_id text not null, started_at integer not null, status text not null, updated_at integer not null);
  create table if not exists cache (key text primary key, json text not null, updated_at integer not null);
  create table if not exists overrides (kind text not null, id text not null, status text not null, at integer not null, primary key (kind, id));
  create table if not exists pings (id integer primary key autoincrement, shift_key text not null, recorded_at integer not null, lat real not null, lng real not null, accuracy real, speed real, battery integer, mock integer not null default 0);
  create index if not exists pings_shift on pings(shift_key, id);
`);

export type OutboxRow = { id: number; kind: string; payload: string; created_at: number; attempts: number; last_error: string | null; blocked: number };
export type LocalShiftRow = { key: string; server_id: string | null; site_id: string; guard_id: string; started_at: number; status: string; updated_at: number };
export type OverrideRow = { kind: string; id: string; status: string; at: number };
export type PingRow = { id: number; shift_key: string; recorded_at: number; lat: number; lng: number; accuracy: number | null; speed: number | null; battery: number | null; mock: number };

export const outbox = {
  insert: (kind: string, payload: unknown) => db.runSync("insert into outbox (kind, payload, created_at) values (?, ?, ?)", kind, JSON.stringify(payload), Date.now()),
  next: () => db.getFirstSync<OutboxRow>("select * from outbox where blocked = 0 order by id asc limit 1"),
  delete: (id: number) => db.runSync("delete from outbox where id = ?", id),
  block: (id: number, error: string) => db.runSync("update outbox set blocked = 1, attempts = attempts + 1, last_error = ? where id = ?", error, id),
  count: () => db.getFirstSync<{ n: number }>("select count(*) as n from outbox")?.n ?? 0,
  clear: () => db.runSync("delete from outbox"),
};

export const localShifts = {
  upsert: (r: Omit<LocalShiftRow, "updated_at">) =>
    db.runSync("insert or replace into local_shifts (key, server_id, site_id, guard_id, started_at, status, updated_at) values (?, ?, ?, ?, ?, ?, ?)", r.key, r.server_id, r.site_id, r.guard_id, r.started_at, r.status, Date.now()),
  get: (key: string) => db.getFirstSync<LocalShiftRow>("select * from local_shifts where key = ?", key),
  current: () => db.getFirstSync<LocalShiftRow>("select * from local_shifts where status not in ('closed', 'failed') order by updated_at desc limit 1"),
  resolve: (key: string, serverId: string | null, status: string) => db.runSync("update local_shifts set server_id = ?, status = ?, updated_at = ? where key = ?", serverId, status, Date.now(), key),
  setStatus: (key: string, status: string) => db.runSync("update local_shifts set status = ?, updated_at = ? where key = ?", status, Date.now(), key),
  prune: (beforeMs: number) => db.runSync("delete from local_shifts where status in ('closed', 'failed') and updated_at < ?", beforeMs),
  clear: () => db.runSync("delete from local_shifts"),
};

export const cache = {
  get: <T>(key: string): T | null => { const r = db.getFirstSync<{ json: string }>("select json from cache where key = ?", key); try { return r ? (JSON.parse(r.json) as T) : null; } catch { return null; } },
  put: (key: string, value: unknown) => db.runSync("insert or replace into cache (key, json, updated_at) values (?, ?, ?)", key, JSON.stringify(value), Date.now()),
  clear: () => db.runSync("delete from cache"),
};

export const overrides = {
  put: (kind: string, id: string, status: string) => db.runSync("insert or replace into overrides (kind, id, status, at) values (?, ?, ?, ?)", kind, id, status, Date.now()),
  list: (kind: string) => db.getAllSync<OverrideRow>("select * from overrides where kind = ?", kind),
  get: (kind: string, id: string) => db.getFirstSync<OverrideRow>("select * from overrides where kind = ? and id = ?", kind, id),
  delete: (kind: string, id: string) => db.runSync("delete from overrides where kind = ? and id = ?", kind, id),
  prune: (beforeMs: number) => db.runSync("delete from overrides where at < ?", beforeMs),
  clear: () => db.runSync("delete from overrides"),
};

/** Pings drained from the native store, waiting for their shift's server id. */
export const pings = {
  insertMany: (rows: Omit<PingRow, "id">[]) => {
    db.withTransactionSync(() => {
      for (const r of rows) db.runSync("insert into pings (shift_key, recorded_at, lat, lng, accuracy, speed, battery, mock) values (?, ?, ?, ?, ?, ?, ?, ?)", r.shift_key, r.recorded_at, r.lat, r.lng, r.accuracy, r.speed, r.battery, r.mock);
    });
  },
  forShift: (key: string, limit: number) => db.getAllSync<PingRow>("select * from pings where shift_key = ? order by id asc limit ?", key, limit),
  shiftKeys: () => db.getAllSync<{ shift_key: string }>("select distinct shift_key from pings").map((r) => r.shift_key),
  deleteIds: (ids: number[]) => { if (ids.length) db.runSync(`delete from pings where id in (${ids.map(() => "?").join(",")})`, ...ids); },
  deleteShift: (key: string) => db.runSync("delete from pings where shift_key = ?", key),
  count: () => db.getFirstSync<{ n: number }>("select count(*) as n from pings")?.n ?? 0,
  clear: () => db.runSync("delete from pings"),
};

export function wipeAll() {
  outbox.clear(); localShifts.clear(); cache.clear(); overrides.clear(); pings.clear();
}
