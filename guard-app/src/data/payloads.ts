export const Kinds = {
  CHECK_IN: "CHECK_IN", CHECK_OUT: "CHECK_OUT", LOCATION_STATE: "LOCATION_STATE",
  PATROL_START: "PATROL_START", PATROL_COMPLETE: "PATROL_COMPLETE",
  TASK_START: "TASK_START", TASK_COMPLETE: "TASK_COMPLETE",
  LEAVE_APPLY: "LEAVE_APPLY", LEAVE_CANCEL: "LEAVE_CANCEL", REG_SELFIE: "REG_SELFIE",
} as const;

export type LocalPhoto = { file: string; remotePath: string; lat?: number | null; lng?: number | null; takenAt: string };
export type CheckInPayload = { shiftKey: string; guardId: string; siteId: string; lat: number; lng: number; accuracyM: number | null; selfieFile: string; selfieRemotePath: string; capturedAt: string; device: Record<string, unknown>; shiftId: string | null };
export type CheckOutPayload = { shiftKey: string; lat: number; lng: number; accuracyM: number | null; selfieFile: string; selfieRemotePath: string; capturedAt: string; device: Record<string, unknown> };
export type LocationStatePayload = { shiftKey: string; enabled: boolean; at: string };
export type PatrolStartPayload = { patrolId: string; at: string };
export type PatrolCompletePayload = { patrolId: string; trail: [number, number][]; photos: LocalPhoto[]; at: string; notes: string | null };
export type TaskStartPayload = { taskId: string; at: string };
export type TaskCompletePayload = { taskId: string; photo: LocalPhoto | null; note: string | null; lat: number | null; lng: number | null; at: string };
export type LeaveApplyPayload = { type: string; start: string; end: string; reason: string | null };
export type LeaveCancelPayload = { id: string };
export type RegSelfiePayload = { file: string; remotePath: string };
