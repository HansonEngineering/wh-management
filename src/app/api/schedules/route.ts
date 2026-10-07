import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow, deleteRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { Schedule } from "@/lib/types";

function parse(r: Record<string, string>): Schedule {
  return {
    id: r.id,
    staff_id: r.staff_id,
    date: r.date,
    shift_id: r.shift_id,
    source: r.source as Schedule["source"],
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// GET /api/schedules?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: Request) {
  try {
    await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";
    let rows = (await readAll<Record<string, string>>(SHEETS.SCHEDULES)).map(parse);
    if (from) rows = rows.filter((r) => r.date >= from);
    if (to) rows = rows.filter((r) => r.date <= to);
    return NextResponse.json({ ok: true, schedules: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// POST — admin/supervisor set jadual satu staff untuk satu tarikh
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor"]);
    const body = await req.json();
    const staffId = String(body.staff_id ?? "");
    const date = String(body.date ?? "");
    const shiftId = String(body.shift_id ?? ""); // "OFF" untuk hari rehat
    if (!staffId || !date) {
      return NextResponse.json({ ok: false, error: "staff_id dan date diperlukan." }, { status: 400 });
    }

    const rows = await readAll<Record<string, string>>(SHEETS.SCHEDULES);
    const existing = rows.find((r) => r.staff_id === staffId && r.date === date);
    const now = nowISO();

    if (existing) {
      await updateRow(SHEETS.SCHEDULES, existing.id, { shift_id: shiftId, source: "manual", updated_at: now });
      return NextResponse.json({ ok: true, id: existing.id });
    }

    const id = genId("sch");
    await appendRow(SHEETS.SCHEDULES, {
      id,
      staff_id: staffId,
      date,
      shift_id: shiftId,
      source: "manual",
      created_at: now,
      updated_at: now,
    });
    await logAudit(session.id, "create", "schedule", id, `${staffId} ${date}=${shiftId}`);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor"]);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return NextResponse.json({ ok: false, error: "ID diperlukan." }, { status: 400 });
    const ok = await deleteRow(SHEETS.SCHEDULES, id);
    if (!ok) return NextResponse.json({ ok: false, error: "Jadual tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "delete", "schedule", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
