import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow, deleteRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, toBool } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { Shift } from "@/lib/types";

function parse(r: Record<string, string>): Shift {
  return {
    id: r.id,
    name: r.name,
    start_time: r.start_time,
    end_time: r.end_time,
    color: r.color || "#3b82f6",
    is_active: toBool(r.is_active),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function GET() {
  try {
    await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const rows = await readAll<Record<string, string>>(SHEETS.SHIFTS);
    return NextResponse.json({ ok: true, shifts: rows.map(parse) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin"]);
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const start = String(body.start_time ?? "");
    const end = String(body.end_time ?? "");
    if (!name || !start || !end) {
      return NextResponse.json({ ok: false, error: "Nama, masa mula dan masa tamat diperlukan." }, { status: 400 });
    }
    const id = genId("shf");
    const now = nowISO();
    await appendRow(SHEETS.SHIFTS, {
      id,
      name,
      start_time: start,
      end_time: end,
      color: String(body.color ?? "#3b82f6"),
      is_active: "true",
      created_at: now,
      updated_at: now,
    });
    await logAudit(session.id, "create", "shift", id, name);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireRole(["admin"]);
    const body = await req.json();
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ ok: false, error: "ID diperlukan." }, { status: 400 });
    const update: Record<string, string> = { updated_at: nowISO() };
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.start_time !== undefined) update.start_time = String(body.start_time);
    if (body.end_time !== undefined) update.end_time = String(body.end_time);
    if (body.color !== undefined) update.color = String(body.color);
    if (body.is_active !== undefined) update.is_active = body.is_active ? "true" : "false";
    const ok = await updateRow(SHEETS.SHIFTS, id, update);
    if (!ok) return NextResponse.json({ ok: false, error: "Syif tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "update", "shift", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireRole(["admin"]);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return NextResponse.json({ ok: false, error: "ID diperlukan." }, { status: 400 });
    const ok = await deleteRow(SHEETS.SHIFTS, id);
    if (!ok) return NextResponse.json({ ok: false, error: "Syif tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "delete", "shift", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
