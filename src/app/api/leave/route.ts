import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, toBool } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { LeaveRequest, LeaveType } from "@/lib/types";

function parseType(r: Record<string, string>): LeaveType {
  return {
    id: r.id,
    name: r.name,
    requires_mc: toBool(r.requires_mc),
    is_paid: toBool(r.is_paid),
    default_days_per_year: Number(r.default_days_per_year) || 0,
    min_notice_days: Number(r.min_notice_days) || 0,
    is_active: toBool(r.is_active),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function parseReq(r: Record<string, string>): LeaveRequest {
  return {
    id: r.id,
    staff_id: r.staff_id,
    leave_type_id: r.leave_type_id,
    start_date: r.start_date,
    end_date: r.end_date,
    days: Number(r.days) || 0,
    reason: r.reason,
    mc_url: r.mc_url,
    status: r.status as LeaveRequest["status"],
    approved_by: r.approved_by,
    approval_notes: r.approval_notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// GET — semua nampak permohonan sendiri; admin/supervisor nampak semua
export async function GET() {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const types = (await readAll<Record<string, string>>(SHEETS.LEAVE_TYPES)).map(parseType);
    let requests = (await readAll<Record<string, string>>(SHEETS.LEAVE_REQUESTS)).map(parseReq);
    if (session.role !== "admin" && session.role !== "supervisor") {
      requests = requests.filter((r) => r.staff_id === session.id);
    }
    requests.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return NextResponse.json({ ok: true, types: types.filter((t) => t.is_active), requests });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// POST — staff mohon cuti
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const body = await req.json();
    const leaveTypeId = String(body.leave_type_id ?? "");
    const startDate = String(body.start_date ?? "");
    const endDate = String(body.end_date ?? "");
    const reason = String(body.reason ?? "");
    const mcUrl = String(body.mc_url ?? "");

    if (!leaveTypeId || !startDate || !endDate) {
      return NextResponse.json({ ok: false, error: "Jenis cuti dan tarikh diperlukan." }, { status: 400 });
    }

    const days = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
    if (days < 1) return NextResponse.json({ ok: false, error: "Tarikh tidak sah." }, { status: 400 });

    const id = genId("lv");
    const now = nowISO();
    await appendRow(SHEETS.LEAVE_REQUESTS, {
      id,
      staff_id: session.id,
      leave_type_id: leaveTypeId,
      start_date: startDate,
      end_date: endDate,
      days: String(days),
      reason,
      mc_url: mcUrl,
      status: "pending",
      approved_by: "",
      approval_notes: "",
      created_at: now,
      updated_at: now,
    });
    await logAudit(session.id, "create", "leave_request", id, `${startDate} hingga ${endDate}`);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// PUT — admin/supervisor approve atau reject
export async function PUT(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor"]);
    const body = await req.json();
    const id = String(body.id ?? "");
    const action = String(body.action ?? "");
    const notes = String(body.approval_notes ?? "");

    const rows = await readAll<Record<string, string>>(SHEETS.LEAVE_REQUESTS);
    const leave = rows.find((r) => r.id === id);
    if (!leave) return NextResponse.json({ ok: false, error: "Permohonan tidak dijumpai." }, { status: 404 });
    if (leave.status !== "pending") {
      return NextResponse.json({ ok: false, error: "Permohonan sudah diproses." }, { status: 409 });
    }

    const now = nowISO();
    const newStatus = action === "approve" ? "approved" : "rejected";
    await updateRow(SHEETS.LEAVE_REQUESTS, id, {
      status: newStatus,
      approved_by: session.id,
      approval_notes: notes,
      updated_at: now,
    });

    // Kalau diluluskan, tandakan jadual sebagai CUTI
    if (action === "approve") {
      const schedules = await readAll<Record<string, string>>(SHEETS.SCHEDULES);
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().slice(0, 10);
        const existing = schedules.find((s) => s.staff_id === leave.staff_id && s.date === dateStr);
        if (existing) {
          await updateRow(SHEETS.SCHEDULES, existing.id, { shift_id: "CUTI", source: "change", updated_at: now });
        } else {
          await appendRow(SHEETS.SCHEDULES, {
            id: genId("sch"),
            staff_id: leave.staff_id,
            date: dateStr,
            shift_id: "CUTI",
            source: "change",
            created_at: now,
            updated_at: now,
          });
        }
      }
    }

    await logAudit(session.id, action, "leave_request", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
