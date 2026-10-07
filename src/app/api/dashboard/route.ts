import { NextResponse } from "next/server";
import { readAll } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { todayMY } from "@/lib/utils";

// GET /api/dashboard — ringkasan untuk dashboard utama
export async function GET() {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const today = todayMY();

    const [attendance, tasks, reports, alerts, requests, statuses, rooms, staff] = await Promise.all([
      readAll<Record<string, string>>(SHEETS.ATTENDANCE),
      readAll<Record<string, string>>(SHEETS.HOUSEKEEPING_TASKS),
      readAll<Record<string, string>>(SHEETS.REPORTS),
      readAll<Record<string, string>>(SHEETS.STOCK_ALERTS),
      readAll<Record<string, string>>(SHEETS.GUEST_REQUESTS),
      readAll<Record<string, string>>(SHEETS.ROOM_STATUSES),
      readAll<Record<string, string>>(SHEETS.ROOMS),
      readAll<Record<string, string>>(SHEETS.STAFF),
    ]);

    const todayAtt = attendance.filter((a) => a.date === today);
    const present = todayAtt.filter((a) => ["on_time", "late", "unscheduled"].includes(a.status)).length;
    const late = todayAtt.filter((a) => a.status === "late").length;
    const absent = todayAtt.filter((a) => a.status === "absent" || a.status === "absent_no_notice").length;

    const todayTasks = tasks.filter((t) => t.date === today);
    const pendingRooms = todayTasks.filter((t) => t.status === "pending").length;
    const inProgressRooms = todayTasks.filter((t) => t.status === "in_progress").length;
    const doneRooms = todayTasks.filter((t) => t.status === "done").length;

    const openReports = reports.filter((r) => !["approved", "resolved"].includes(r.status)).length;
    const pendingApprovalReports = reports.filter((r) => r.status === "pending_approval").length;

    const pendingAlerts = alerts.filter((a) => a.status === "pending_decision").length;
    const pendingRequests = requests.filter((r) => r.status === "pending_approval").length;

    const todayStatuses = statuses.filter((s) => s.date === today);
    const notSellable = todayStatuses.filter((s) => s.sellable === "false").length;

    // Untuk staff biasa, kira perkara yang relevan dengan dia
    const myTasks = todayTasks.filter((t) => t.assigned_to === session.id || t.submitted_by === session.id).length;
    const myAlerts = alerts.filter((a) => a.responsible_staff_id === session.id && a.status === "pending_decision").length;
    const myAttendance = todayAtt.find((a) => a.staff_id === session.id);

    return NextResponse.json({
      ok: true,
      today,
      stats: {
        totalStaff: staff.filter((s) => s.is_active === "true").length,
        present,
        late,
        absent,
        totalRooms: rooms.filter((r) => r.is_active === "true").length,
        pendingRooms,
        inProgressRooms,
        doneRooms,
        openReports,
        pendingApprovalReports,
        pendingAlerts,
        pendingRequests,
        notSellable,
      },
      my: {
        tasks: myTasks,
        alerts: myAlerts,
        clockedIn: !!myAttendance?.clock_in,
        status: myAttendance?.status ?? null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
