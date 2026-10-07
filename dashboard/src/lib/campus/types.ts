import type { LatLng } from "./geo";

/**
 * The property side of a site: the client's campus, its buildings, floors, gates and the
 * companies that rent space there. A site in GuardWatch AI is where the agency's guards
 * stand; these are what they guard.
 */

export type CampusGuard = {
  id: string;
  full_name: string;
  employee_code: string | null;
  phone: string | null;
};

export type Campus = {
  site_id: string;
  name: string;
  client_name: string | null;
  address: string | null;
  city: string | null;
  code: string;
  anchor: LatLng;
};

export type TowerCategory = "commercial" | "corporate" | "coworking" | "utility" | "residential";

export type Tower = {
  id: string;
  code: string;
  name: string;
  category: TowerCategory;
  floors: number;
  units: number;
  incharge: string;
  incharge_phone: string;
  status: "active" | "maintenance";
  description: string;
};

export type Floor = LatLng & {
  id: string;
  code: string;
  name: string;
  tower_id: string;
  radius_m: number;
  units: string;
};

export type Checkpoint = LatLng & {
  id: string;
  code: string;
  floor_id: string;
  location: string;
  radius_m: number;
};

export type Gate = {
  id: string;
  code: string;
  name: string;
  kind: "main" | "visitor" | "service" | "parking";
  open_hours: string;
};

export type Tenant = {
  id: string;
  code: string;
  name: string;
  floor_id: string;
  unit: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  /** How the host approves visitors who walk up unannounced. */
  approval_channel: "whatsapp" | "link" | "desk";
};

export type ShiftMaster = { id: string; code: string; name: string; start: string; end: string; break_min: number };

export type ChecklistItem = {
  id: string;
  code: string;
  category: string;
  question: string;
  ok_label: string;
  fail_label: string;
  required: boolean;
  /** A failing answer cannot be submitted without a photo of the problem. */
  photo_on_fail: boolean;
  /** Who a failing answer is routed to as a task. */
  owner: "facility" | "security" | "electrical" | "housekeeping";
};

export type VisitorType = "client" | "vendor" | "contractor" | "interview" | "delivery" | "guest";
export type IdType = "aadhaar" | "dl" | "pan" | "voter" | "passport";
export type VisitorStatus = "expected" | "pending" | "approved" | "checked_in" | "checked_out" | "rejected";

export type Visitor = {
  id: string;
  ref: string;
  name: string;
  phone: string;
  company: string;
  type: VisitorType;
  id_type: IdType;
  id_last4: string;
  vehicle: string | null;
  tenant_id: string;
  purpose: string;
  gate_id: string;
  status: VisitorStatus;
  /** Pre-authorised by the host before arrival ("self approved" on the dashboard). */
  pre_authorised: boolean;
  arrived_at: string;
  approved_at: string | null;
  approved_by: string | null;
  approval_via: "whatsapp" | "link" | "desk" | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  badge_no: string | null;
  checked_out_at: string | null;
  checked_out_by: string | null;
  exit_gate_id: string | null;
  exit_remarks: string | null;
  baggage: string | null;
  photo_hue: number;
  escalated?: boolean;
};

export type PassType = "work_permit" | "material_in" | "material_out" | "vip";
export type PassStatus = "active" | "closed" | "expired" | "revoked";

export type GatePass = {
  id: string;
  ref: string;
  type: PassType;
  title: string;
  holder: string;
  firm: string;
  phone: string;
  id_type: IdType;
  id_last4: string;
  tenant_id: string;
  floor_id: string;
  unit: string;
  gate_ids: string[];
  valid_from: string;
  valid_to: string;
  issued_at: string;
  issued_by: string;
  materials: string;
  deposit: string;
  scope: string;
  returnable: boolean;
  status: PassStatus;
};

export type InspectionState = "completed" | "pending_approval" | "missed" | "due";

export type FloorInspection = {
  id: string;
  ref: string;
  floor_id: string;
  inspector_id: string;
  started_at: string;
  finished_at: string;
  gps_distance_m: number;
  gps_ok: boolean;
  answers: Record<string, boolean>;
  remarks: string;
  state: Exclude<InspectionState, "due">;
  signed_off_by: string | null;
};

export type Duty =
  | "gate" | "inspection" | "visitor" | "vehicle" | "material" | "fire" | "night_patrol" | "cctv" | "emergency" | "other";

export type Deployment = {
  guard: CampusGuard;
  tower_id: string | null;
  floor_ids: string[];
  gate_ids: string[];
  shift_id: string;
  duties: Duty[];
  post: string;
  battery_pct: number | null;
  online: boolean;
  last_seen_at: string | null;
  reserve: boolean;
  agency: string;
  access_card: boolean;
  biometric: boolean;
  app_access: boolean;
};

export type Breadcrumb = { id: string; guard_id: string; at: string; checkpoint_id: string; activity: string; accuracy_m: number };

export type CampusData = {
  campus: Campus;
  towers: Tower[];
  floors: Floor[];
  checkpoints: Checkpoint[];
  gates: Gate[];
  tenants: Tenant[];
  shifts: ShiftMaster[];
  checklist: ChecklistItem[];
  visitors: Visitor[];
  passes: GatePass[];
  inspections: FloorInspection[];
  deployments: Deployment[];
  breadcrumbs: Breadcrumb[];
  hourly: { hour: string; today: number | null; yesterday: number }[];
  now: string;
  today: string;
};
