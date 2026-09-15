import { guardApi } from "../api/guardApi";
import { ApiError, toApiError } from "../api/errors";
import { GuardTracking } from "../../modules/guard-tracking";
import { localShifts, outbox, overrides, pings, type OutboxRow } from "./db";
import { Kinds, type CheckInPayload, type CheckOutPayload, type LeaveApplyPayload, type LeaveCancelPayload, type LocationStatePayload, type PatrolCompletePayload, type PatrolStartPayload, type RegSelfiePayload, type TaskCompletePayload, type TaskStartPayload } from "./payloads";

type Listener = (issue: string) => void;
const issueListeners = new Set<Listener>();
export const onSyncIssue = (l: Listener) => { issueListeners.add(l); return () => issueListeners.delete(l); };
const emitIssue = (code: string) => issueListeners.forEach((l) => l(code));

let running = false;
export const syncState = { lastSyncAt: 0, lastError: null as string | null, syncing: false };

/**
 * 1. Pull what the native service captured while JS was away.
 * 2. Drain the outbox strictly in order (network errors stop the run, domain errors are resolved).
 * 3. Flush pings for every shift whose server id is known.
 */
export async function sync(): Promise<boolean> {
  if (running) return false;
  running = true; syncState.syncing = true;
  try {
    await drainNative();
    await processOutbox();
    await flushPings();
    syncState.lastSyncAt = Date.now(); syncState.lastError = null;
    localShifts.prune(Date.now() - 3 * 86_400_000); overrides.prune(Date.now() - 2 * 86_400_000);
    return true;
  } catch (e) {
    const err = toApiError(e); syncState.lastError = err.message;
    return false;
  } finally { running = false; syncState.syncing = false; }
}

/** Copies pings and location-state markers out of the native store into the outbox/pings tables. */
export async function drainNative() {
  for (;;) {
    let records;
    try { records = await GuardTracking.drain(200); } catch { return; }
    if (!records.length) return;
    const pingRows = records.filter((r) => r.kind === "ping" && r.shiftKey && r.lat != null && r.lng != null)
      .map((r) => ({ shift_key: r.shiftKey!, recorded_at: r.at, lat: r.lat!, lng: r.lng!, accuracy: r.accuracy ?? null, speed: r.speed ?? null, battery: r.battery ?? null, mock: r.mock ? 1 : 0 }));
    pings.insertMany(pingRows);
    for (const r of records) if (r.kind === "location_state" && r.shiftKey) {
      outbox.insert(Kinds.LOCATION_STATE, { shiftKey: r.shiftKey, enabled: !!r.enabled, at: new Date(r.at).toISOString() } satisfies LocationStatePayload);
    }
    await GuardTracking.ack(records[records.length - 1].id);
  }
}

async function processOutbox() {
  for (;;) {
    const op = outbox.next();
    if (!op) return;
    try {
      await execute(op);
      outbox.delete(op.id);
    } catch (e) {
      const err = toApiError(e);
      if (err.retryable || err.code === "UNAUTHORIZED") throw err;
      if (!(await resolvePermanent(op, err))) outbox.block(op.id, err.message);
    }
  }
}

const serverShiftId = (key: string) => localShifts.get(key)?.server_id ?? null;

async function execute(op: OutboxRow) {
  const p = JSON.parse(op.payload);
  switch (op.kind) {
    case Kinds.CHECK_IN: {
      const c = p as CheckInPayload;
      await guardApi.upload("selfies", c.selfieRemotePath, c.selfieFile);
      const res = await guardApi.checkIn({ guardId: c.guardId, siteId: c.siteId, lat: c.lat, lng: c.lng, accuracyM: c.accuracyM, selfiePath: c.selfieRemotePath, capturedAt: c.capturedAt, device: c.device, shiftId: c.shiftId });
      localShifts.resolve(c.shiftKey, res.id, "active");
      return;
    }
    case Kinds.CHECK_OUT: {
      const c = p as CheckOutPayload;
      const id = serverShiftId(c.shiftKey);
      if (!id) throw new ApiError("SHIFT_NOT_FOUND", `no server shift for ${c.shiftKey}`);
      await flushPingsFor(c.shiftKey, id); // away time needs every breadcrumb before check_out
      await guardApi.upload("selfies", c.selfieRemotePath, c.selfieFile);
      await guardApi.checkOut({ shiftId: id, lat: c.lat, lng: c.lng, accuracyM: c.accuracyM, selfiePath: c.selfieRemotePath, capturedAt: c.capturedAt, device: c.device });
      localShifts.setStatus(c.shiftKey, "closed");
      return;
    }
    case Kinds.LOCATION_STATE: {
      const c = p as LocationStatePayload;
      const id = serverShiftId(c.shiftKey);
      if (id) await guardApi.reportLocationState(id, c.enabled, c.at);
      return;
    }
    case Kinds.PATROL_START: { const c = p as PatrolStartPayload; await guardApi.startPatrol(c.patrolId, c.at); return; }
    case Kinds.PATROL_COMPLETE: {
      const c = p as PatrolCompletePayload;
      for (const ph of c.photos) await guardApi.upload("patrol-photos", ph.remotePath, ph.file);
      await guardApi.completePatrol(c.patrolId, c.trail, c.photos.map((ph) => ({ file_path: ph.remotePath, lat: ph.lat, lng: ph.lng, taken_at: ph.takenAt })), c.at, c.notes);
      overrides.delete("patrol", c.patrolId);
      return;
    }
    case Kinds.TASK_START: { const c = p as TaskStartPayload; await guardApi.startTask(c.taskId, c.at); return; }
    case Kinds.TASK_COMPLETE: {
      const c = p as TaskCompletePayload;
      if (c.photo) await guardApi.upload("task-photos", c.photo.remotePath, c.photo.file);
      await guardApi.completeTask({ taskId: c.taskId, photoPath: c.photo?.remotePath ?? null, note: c.note, lat: c.lat, lng: c.lng, at: c.at });
      overrides.delete("task", c.taskId);
      return;
    }
    case Kinds.LEAVE_APPLY: { const c = p as LeaveApplyPayload; await guardApi.applyLeave(c.type, c.start, c.end, c.reason); return; }
    case Kinds.LEAVE_CANCEL: { const c = p as LeaveCancelPayload; await guardApi.cancelLeave(c.id); return; }
    case Kinds.REG_SELFIE: { const c = p as RegSelfiePayload; await guardApi.upload("selfies", c.remotePath, c.file); await guardApi.setRegistrationSelfie(c.remotePath); return; }
  }
}

/** @returns true when the op was dealt with and deleted. */
async function resolvePermanent(op: OutboxRow, err: ApiError): Promise<boolean> {
  const p = JSON.parse(op.payload);
  switch (op.kind) {
    case Kinds.CHECK_IN: {
      const c = p as CheckInPayload;
      if (err.code === "TAMPER_SUSPECTED") {
        try { await guardApi.reportTamper(c.guardId, c.siteId, c.lat, c.lng, "queued check-in rejected"); } catch { /* best effort */ }
        emitIssue("TAMPER_SUSPECTED");
      } else if (err.code === "SHIFT_ALREADY_STARTED") {
        // The server already runs this shift (double tap / retried request): adopt it.
        const home = await guardApi.home().catch(() => null);
        if (home?.active_shift_id) { localShifts.resolve(c.shiftKey, home.active_shift_id, "active"); outbox.delete(op.id); return true; }
      } else emitIssue(err.code);
      localShifts.setStatus(c.shiftKey, "failed"); pings.deleteShift(c.shiftKey);
      await GuardTracking.stop().catch(() => undefined);
      outbox.delete(op.id); return true;
    }
    case Kinds.CHECK_OUT: {
      const c = p as CheckOutPayload;
      localShifts.setStatus(c.shiftKey, "closed");
      if (err.code !== "SHIFT_NOT_IN_PROGRESS") emitIssue(err.code);
      outbox.delete(op.id); return true;
    }
    case Kinds.PATROL_COMPLETE: overrides.delete("patrol", (p as PatrolCompletePayload).patrolId); emitIssue(err.code); outbox.delete(op.id); return true;
    case Kinds.TASK_COMPLETE: overrides.delete("task", (p as TaskCompletePayload).taskId); emitIssue(err.code); outbox.delete(op.id); return true;
    default: emitIssue(err.code); outbox.delete(op.id); return true;
  }
}

export async function flushPings() {
  for (const key of pings.shiftKeys()) {
    const shift = localShifts.get(key);
    if (!shift || shift.status === "failed") pings.deleteShift(key);
    else if (shift.server_id) await flushPingsFor(key, shift.server_id);
    // else: check-in not confirmed yet; keep buffering
  }
}

async function flushPingsFor(key: string, serverId: string) {
  for (;;) {
    const batch = pings.forShift(key, 200);
    if (!batch.length) return;
    try {
      await guardApi.ingestPings(serverId, batch.map((r) => ({ recorded_at: new Date(r.recorded_at).toISOString(), lat: r.lat, lng: r.lng, accuracy_m: r.accuracy, speed_mps: r.speed, battery_pct: r.battery, is_mock: r.mock === 1 })));
    } catch (e) {
      const err = toApiError(e);
      if (err.retryable || err.code === "UNAUTHORIZED") throw err;
    }
    pings.deleteIds(batch.map((r) => r.id));
  }
}
