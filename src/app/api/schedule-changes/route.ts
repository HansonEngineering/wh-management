import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { ScheduleChange } from "@/lib/types";

function parse(r: Record<string, string>): ScheduleChange {
  return {
    id: r.id,
    date: r.date,
    original_staff_id: r.original_staff_id,
    covering_staff_id: r.covering_staff_id,
    change_type: r.change_type as ScheduleChange["change_type"],
    reason: r.reason,
    status: r.status as ScheduleChange["status"],
    approved_by: r.approved_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function GET() {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    let rows = (await readAll<Record<string, string>>(SHEETS.SCHEDULE_CHANGES)).map(parse);
    if (session.role !== "admin" && session.role !== "supervisor") {
      rows = rows.filter((r) => r.original_staff_id === session.id || r.covering_staff_id === session.id);
    }
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return NextResponse.json({ ok: true, changes: rows.slice(0, 100) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// POST — staff mohon tukar syif / emergency, atau staff lain tawar cover
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const body = await req.json();
    const date = String(body.date ?? "");
    const changeType = String(body.change_type ?? "swap");
    const reason = String(body.reason ?? "");
    const coveringStaffId = String(body.covering_staff_id ?? "");

    if (!date) return NextResponse.json({ ok: false, error: "Tarikh diperlukan." }, { status: 400 });

    const id = genId("sc");
    const now = nowISO();
    await appendRow(SHEETS.SCHEDULE_CHANGES, {
      id,
      date,
      original_staff_id: session.id,
      covering_staff_id: coveringStaffId,
      change_type: changeType,
      reason,
      status: "pending",
      approved_by: "",
      created_at: now,
      updated_at: now,
    });
    await logAudit(session.id, "create", "schedule_change", id, `${changeType} ${date}`);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// PUT — approve/reject (admin/supervisor). Bila approve, jadual dikemas kini.
export async function PUT(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor"]);
    const body = await req.json();
    const id = String(body.id ?? "");
    const action = String(body.action ?? ""); // "approve" | "reject"

    const rows = await readAll<Record<string, string>>(SHEETS.SCHEDULE_CHANGES);
    const change = rows.find((r) => r.id === id);
    if (!change) return NextResponse.json({ ok: false, error: "Permohonan tidak dijumpai." }, { status: 404 });
    if (change.status !== "pending") {
      return NextResponse.json({ ok: false, error: "Permohonan sudah diproses." }, { status: 409 });
    }

    const now = nowISO();
    const newStatus = action === "approve" ? "approved" : "rejected";
    await updateRow(SHEETS.SCHEDULE_CHANGES, id, { status: newStatus, approved_by: session.id, updated_at: now });

    if (action === "approve" && change.covering_staff_id) {
      // Dapatkan syif asal
      const schedules = await readAll<Record<string, string>>(SHEETS.SCHEDULES);
      const orig = schedules.find((s) => s.staff_id === change.original_staff_id && s.date === change.date);
      const shiftId = orig?.shift_id ?? "";

      // Staff asal jadi OFF / cuti
      if (orig) {
        await updateRow(SHEETS.SCHEDULES, orig.id, { shift_id: "OFF", source: "change", updated_at: now });
      }
      // Staff pengganti ambil syif tu
      const coverExisting = schedules.find((s) => s.staff_id === change.covering_staff_id && s.date === change.date);
      if (coverExisting) {
        await updateRow(SHEETS.SCHEDULES, coverExisting.id, { shift_id: shiftId, source: "change", updated_at: now });
      } else {
        await appendRow(SHEETS.SCHEDULES, {
          id: genId("sch"),
          staff_id: change.covering_staff_id,
          date: change.date,
          shift_id: shiftId,
          source: "change",
          created_at: now,
          updated_at: now,
        });
      }
    }

    await logAudit(session.id, action, "schedule_change", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
