// Nama tab dalam Google Sheets (database)
export const SHEETS = {
  STAFF: "Staff",
  ROOM_TYPES: "RoomTypes",
  ROOMS: "Rooms",
  ITEMS: "Items",
  ROOM_TYPE_MAXSO: "RoomTypeMaxSO",
  STOCK_MOVEMENTS: "StockMovements",
  STOCK_COUNTS: "StockCounts",
  GUEST_REQUESTS: "GuestRequests",
  STOCK_ALERTS: "StockAlerts",
  ROOM_STATUSES: "RoomStatuses",
  HOUSEKEEPING_TASKS: "HousekeepingTasks",
  REPORTS: "Reports",
  REPORT_REPLIES: "ReportReplies",
  SHIFTS: "Shifts",
  SCHEDULES: "Schedules",
  SCHEDULE_CHANGES: "ScheduleChanges",
  LEAVE_TYPES: "LeaveTypes",
  LEAVE_REQUESTS: "LeaveRequests",
  ATTENDANCE: "Attendance",
  MERIT_DEMERIT: "MeritDemerit",
  PAYROLL: "Payroll",
  SETTINGS: "Settings",
  STOR_SESSIONS: "StorSessions",
  STOR_PURPOSES: "StorPurposes",
  PUSH_SUBSCRIPTIONS: "PushSubscriptions",
  AUDIT_LOG: "AuditLog",
} as const;

// Susunan kolum untuk setiap tab (baris pertama = header)
export const SHEET_HEADERS: Record<string, string[]> = {
  [SHEETS.STAFF]: [
    "id", "name", "phone", "email", "role", "password_hash", "rfid_uid",
    "fingerprint_id", "is_active", "basic_salary", "ot_rate_per_hour",
    "telegram_chat_id", "created_at", "updated_at",
  ],
  [SHEETS.ROOM_TYPES]: ["id", "name", "beds", "is_active", "created_at", "updated_at"],
  [SHEETS.ROOMS]: ["id", "room_number", "room_type_id", "floor", "is_active", "created_at", "updated_at"],
  [SHEETS.ITEMS]: [
    "id", "name", "category", "is_tracked", "current_stock",
    "responsible_staff_id", "is_active", "created_at", "updated_at",
  ],
  [SHEETS.ROOM_TYPE_MAXSO]: ["id", "room_type_id", "item_id", "max_so", "min_so", "updated_at"],
  [SHEETS.STOCK_MOVEMENTS]: [
    "id", "date", "time", "staff_id", "item_id", "qty", "movement_type",
    "reference_id", "notes", "created_at",
  ],
  [SHEETS.STOCK_COUNTS]: [
    "id", "date", "item_id", "counted_by", "system_qty", "physical_qty",
    "variance", "status", "decided_by", "decision_notes", "created_at", "updated_at",
  ],
  [SHEETS.GUEST_REQUESTS]: [
    "id", "date", "time", "room_id", "item_id", "qty", "requested_by",
    "status", "approved_by", "handled_by", "completed_at", "created_at", "updated_at",
  ],
  [SHEETS.STOCK_ALERTS]: [
    "id", "date", "item_id", "responsible_staff_id", "expected_max", "total_so",
    "variance", "guest_requests_note", "status", "decided_by", "decision_notes",
    "created_at", "updated_at",
  ],
  [SHEETS.ROOM_STATUSES]: [
    "id", "date", "room_id", "is_lnb", "cleaning_status", "sellable",
    "notes", "updated_at",
  ],
  [SHEETS.HOUSEKEEPING_TASKS]: [
    "id", "date", "room_id", "assigned_to", "checklist_json", "status",
    "started_at", "submitted_by", "submitted_at", "created_at",
  ],
  [SHEETS.REPORTS]: [
    "id", "date", "time", "room_id", "category", "severity", "title",
    "description", "photo_url", "reported_by", "status", "created_at", "updated_at",
  ],
  [SHEETS.REPORT_REPLIES]: [
    "id", "report_id", "staff_id", "message", "photo_url", "reply_type", "created_at",
  ],
  [SHEETS.SHIFTS]: ["id", "name", "start_time", "end_time", "color", "is_active", "created_at", "updated_at"],
  [SHEETS.SCHEDULES]: ["id", "staff_id", "date", "shift_id", "source", "created_at", "updated_at"],
  [SHEETS.SCHEDULE_CHANGES]: [
    "id", "date", "original_staff_id", "covering_staff_id", "change_type",
    "reason", "status", "approved_by", "created_at", "updated_at",
  ],
  [SHEETS.LEAVE_TYPES]: [
    "id", "name", "requires_mc", "is_paid", "default_days_per_year",
    "min_notice_days", "is_active", "created_at", "updated_at",
  ],
  [SHEETS.LEAVE_REQUESTS]: [
    "id", "staff_id", "leave_type_id", "start_date", "end_date", "days",
    "reason", "mc_url", "status", "approved_by", "approval_notes", "created_at", "updated_at",
  ],
  [SHEETS.ATTENDANCE]: [
    "id", "staff_id", "date", "clock_in", "clock_out", "shift_id",
    "status", "late_minutes", "ot_hours", "notes", "created_at", "updated_at",
  ],
  [SHEETS.MERIT_DEMERIT]: [
    "id", "staff_id", "date", "type", "category", "points", "description",
    "reference_id", "given_by", "created_at",
  ],
  [SHEETS.PAYROLL]: [
    "id", "staff_id", "month", "basic_salary", "days_present", "days_absent",
    "days_leave", "late_count", "merit_points", "demerit_points",
    "deduction_percent", "deduction_amount", "ot_hours", "ot_amount",
    "net_salary", "status", "created_at", "updated_at",
  ],
  [SHEETS.SETTINGS]: ["key", "value", "description", "updated_at"],
  [SHEETS.STOR_SESSIONS]: [
    "id", "staff_id", "opened_at", "submit_deadline", "door_deadline",
    "purpose", "purpose_notes", "status", "submitted_at", "door_closed_at",
    "overridden_by", "created_at", "updated_at",
  ],
  [SHEETS.STOR_PURPOSES]: ["id", "name", "is_active", "created_at"],
  [SHEETS.PUSH_SUBSCRIPTIONS]: ["id", "staff_id", "endpoint", "keys_json", "created_at"],
  [SHEETS.AUDIT_LOG]: ["id", "staff_id", "action", "entity", "entity_id", "details", "created_at"],
};

// Setting default (admin boleh ubah dalam app)
export const DEFAULT_SETTINGS: Record<string, { value: string; description: string }> = {
  stor_timer_minutes: { value: "5", description: "Tempoh (minit) untuk staff update stock selepas scan kad" },
  stor_buzzer_seconds: { value: "60", description: "Tempoh (saat) buzzer berbunyi" },
  late_grace_minutes: { value: "10", description: "Minit lewat yang masih dikira on time" },
  compare_period: { value: "daily", description: "Tempoh perbandingan stock: daily atau weekly" },
  stock_count_schedule: { value: "weekly_sunday", description: "Jadual kiraan stok fizikal" },
  max_concurrent_leave: { value: "1", description: "Maksimum staff cuti serentak untuk setiap role" },
  deduction_tiers: {
    value: JSON.stringify([
      { min: 1, max: 5, percent: 2 },
      { min: 6, max: 10, percent: 5 },
      { min: 11, max: 999, percent: 10 },
    ]),
    description: "Peratus potongan gaji ikut julat mata demerit",
  },
  max_deduction_percent: { value: "10", description: "Had maksimum potongan gaji sebulan (%)" },
  guest_request_daily_limit: { value: "2", description: "Had permintaan tambahan setiap item, setiap bilik, sehari" },
  daily_check_time: { value: "23:30", description: "Masa semakan stock harian dijalankan" },
  exely_enabled: { value: "false", description: "Sambungan Exely aktif atau tidak" },
  telegram_alerts: { value: "true", description: "Hantar alert penting melalui Telegram" },
};

export const ROLES = ["admin", "supervisor", "housekeeping", "maintenance", "receptionist"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  housekeeping: "Housekeeping",
  maintenance: "Maintenance",
  receptionist: "Receptionist",
};
