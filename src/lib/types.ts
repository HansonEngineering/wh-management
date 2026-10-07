import type { Role } from "./constants";

export interface Staff {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: Role;
  password_hash: string;
  rfid_uid: string;
  fingerprint_id: string;
  is_active: boolean;
  basic_salary: number;
  ot_rate_per_hour: number;
  telegram_chat_id: string;
  created_at: string;
  updated_at: string;
}

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
}

export interface RoomType {
  id: string;
  name: string;
  beds: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  room_number: string;
  room_type_id: string;
  floor: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  name: string;
  category: string; // "consumable" | "linen"
  is_tracked: boolean;
  current_stock: number;
  responsible_staff_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoomTypeMaxSO {
  id: string;
  room_type_id: string;
  item_id: string;
  max_so: number;
  min_so: number;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  date: string;
  time: string;
  staff_id: string;
  item_id: string;
  qty: number;
  movement_type: "OUT" | "IN" | "RETURN" | "ADJUST";
  reference_id: string;
  notes: string;
  created_at: string;
}

export interface StockCount {
  id: string;
  date: string;
  item_id: string;
  counted_by: string;
  system_qty: number;
  physical_qty: number;
  variance: number;
  status: "pending_decision" | "resolved";
  decided_by: string;
  decision_notes: string;
  created_at: string;
  updated_at: string;
}

export interface GuestRequest {
  id: string;
  date: string;
  time: string;
  room_id: string;
  item_id: string;
  qty: number;
  requested_by: string;
  status: "pending_approval" | "approved" | "rejected" | "completed";
  approved_by: string;
  handled_by: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

export interface StockAlert {
  id: string;
  date: string;
  item_id: string;
  responsible_staff_id: string;
  expected_max: number;
  total_so: number;
  variance: number;
  guest_requests_note: string;
  status: "pending_decision" | "demerit_given" | "excused";
  decided_by: string;
  decision_notes: string;
  created_at: string;
  updated_at: string;
}

export interface RoomStatus {
  id: string;
  date: string;
  room_id: string;
  is_lnb: boolean;
  cleaning_status: "occupied" | "pending_clean" | "cleaning" | "clean" | "none";
  sellable: boolean;
  notes: string;
  updated_at: string;
}

export interface HousekeepingTask {
  id: string;
  date: string;
  room_id: string;
  assigned_to: string;
  checklist_json: string;
  status: "pending" | "in_progress" | "done";
  started_at: string;
  submitted_by: string;
  submitted_at: string;
  created_at: string;
}

export interface Report {
  id: string;
  date: string;
  time: string;
  room_id: string;
  category: "maintenance" | "linen";
  severity: "unclassified" | "major" | "minor";
  title: string;
  description: string;
  photo_url: string;
  reported_by: string;
  status: "new" | "in_progress" | "pending_approval" | "approved" | "rejected" | "resolved";
  created_at: string;
  updated_at: string;
}

export interface ReportReply {
  id: string;
  report_id: string;
  staff_id: string;
  message: string;
  photo_url: string;
  reply_type: "work_done" | "comment";
  created_at: string;
}

export interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: string;
  staff_id: string;
  date: string;
  shift_id: string; // "OFF" untuk hari cuti rehat
  source: "template" | "manual" | "change";
  created_at: string;
  updated_at: string;
}

export interface ScheduleChange {
  id: string;
  date: string;
  original_staff_id: string;
  covering_staff_id: string;
  change_type: "swap" | "emergency" | "cover";
  reason: string;
  status: "pending" | "approved" | "rejected";
  approved_by: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveType {
  id: string;
  name: string;
  requires_mc: boolean;
  is_paid: boolean;
  default_days_per_year: number;
  min_notice_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  staff_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  mc_url: string;
  status: "pending" | "approved" | "rejected";
  approved_by: string;
  approval_notes: string;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  staff_id: string;
  date: string;
  clock_in: string;
  clock_out: string;
  shift_id: string;
  status: "on_time" | "late" | "absent" | "absent_no_notice" | "leave" | "unscheduled";
  late_minutes: number;
  ot_hours: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface MeritDemerit {
  id: string;
  staff_id: string;
  date: string;
  type: "merit" | "demerit";
  category: string;
  points: number;
  description: string;
  reference_id: string;
  given_by: string;
  created_at: string;
}

export interface Payroll {
  id: string;
  staff_id: string;
  month: string; // "2026-10"
  basic_salary: number;
  days_present: number;
  days_absent: number;
  days_leave: number;
  late_count: number;
  merit_points: number;
  demerit_points: number;
  deduction_percent: number;
  deduction_amount: number;
  ot_hours: number;
  ot_amount: number;
  net_salary: number;
  status: "draft" | "finalized";
  created_at: string;
  updated_at: string;
}

export interface StorSession {
  id: string;
  staff_id: string;
  opened_at: string;
  submit_deadline: string;
  door_deadline: string;
  purpose: string; // "take_stock" atau nama tujuan lain
  purpose_notes: string;
  status: "open" | "submitted" | "closed" | "overridden" | "expired";
  submitted_at: string;
  door_closed_at: string;
  overridden_by: string;
  created_at: string;
  updated_at: string;
}

export interface StorPurpose {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface PushSubscription {
  id: string;
  staff_id: string;
  endpoint: string;
  keys_json: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  staff_id: string;
  action: string;
  entity: string;
  entity_id: string;
  details: string;
  created_at: string;
}
