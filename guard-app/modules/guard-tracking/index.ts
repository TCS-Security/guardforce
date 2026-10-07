import { requireNativeModule, type EventSubscription } from "expo-modules-core";

export type Fence = { type: "radius" | "polygon"; lat: number; lng: number; radiusM: number; leewayM: number; polygon?: [number, number][] };

export type TrackingOptions = {
  shiftKey: string;
  siteName: string;
  fence: Fence | null;
  movingS: number;
  stationaryS: number;
  warnMin: number;
  /** Notification copy in the guard's language. */
  texts: { trackingTitle: string; trackingBody: string; trackingOffTitle: string; locationOffTitle: string; locationOffBody: string };
};

export type TrackingStatus = {
  tracking?: boolean;
  lat?: number;
  lng?: number;
  accuracyM?: number | null;
  inFence?: boolean | null;
  distanceOutsideM?: number | null;
  batteryPct?: number | null;
  lastFixMs?: number;
  isMock?: boolean;
  locationEnabled?: boolean;
  intervalS?: number;
  pending?: number;
};

export type TrackingRecord = {
  id: number;
  kind: "ping" | "location_state";
  shiftKey: string | null;
  at: number;
  lat?: number;
  lng?: number;
  accuracy?: number;
  speed?: number;
  battery?: number;
  mock?: boolean;
  enabled?: boolean;
};

export type TrailPoint = { id: number; at: number; lat: number; lng: number; accuracy?: number };

type NativeModule = {
  start(optionsJson: string): Promise<void>;
  stop(): Promise<void>;
  setPatrol(patrolId: string | null): Promise<void>;
  isRunning(): boolean;
  getStatus(): TrackingStatus;
  getPendingCount(): number;
  drain(limit: number): Promise<TrackingRecord[]>;
  ack(maxId: number): Promise<void>;
  trail(patrolId: string): Promise<TrailPoint[]>;
  clearTrail(patrolId: string): Promise<void>;
  clearAll(): Promise<void>;
  addListener(event: "onStatus", listener: (status: TrackingStatus) => void): EventSubscription;
};

const native = requireNativeModule<NativeModule>("GuardTracking");

export const GuardTracking = {
  start: (o: TrackingOptions) => native.start(JSON.stringify(o)),
  stop: () => native.stop(),
  setPatrol: (id: string | null) => native.setPatrol(id),
  isRunning: () => native.isRunning(),
  getStatus: () => native.getStatus(),
  getPendingCount: () => native.getPendingCount(),
  drain: (limit = 200) => native.drain(limit),
  ack: (maxId: number) => native.ack(maxId),
  trail: (patrolId: string) => native.trail(patrolId),
  clearTrail: (patrolId: string) => native.clearTrail(patrolId),
  clearAll: () => native.clearAll(),
  onStatus: (listener: (s: TrackingStatus) => void) => native.addListener("onStatus", listener),
};
