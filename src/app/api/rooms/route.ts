import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow, deleteRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, toBool } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { Room } from "@/lib/types";

function parse(r: Record<string, string>): Room {
  return {
    id: r.id,
    room_number: r.room_number,
    room_type_id: r.room_type_id,
    floor: r.floor,
    is_active: toBool(r.is_active),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function GET() {
  try {
    await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const rows = await readAll<Record<string, string>>(SHEETS.ROOMS);
    return NextResponse.json({ ok: true, rooms: rows.map(parse) });
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
    const roomNumber = String(body.room_number ?? "").trim();
    const roomTypeId = String(body.room_type_id ?? "");
    if (!roomNumber || !roomTypeId) {
      return NextResponse.json({ ok: false, error: "Nombor bilik dan jenis bilik diperlukan." }, { status: 400 });
    }
    const existing = await readAll<Record<string, string>>(SHEETS.ROOMS);
    if (existing.some((r) => r.room_number === roomNumber)) {
      return NextResponse.json({ ok: false, error: "Nombor bilik sudah wujud." }, { status: 409 });
    }
    const id = genId("room");
    const now = nowISO();
    await appendRow(SHEETS.ROOMS, {
      id,
      room_number: roomNumber,
      room_type_id: roomTypeId,
      floor: String(body.floor ?? ""),
      is_active: "true",
      created_at: now,
      updated_at: now,
    });
    await logAudit(session.id, "create", "room", id, roomNumber);
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
    if (body.room_number !== undefined) update.room_number = String(body.room_number).trim();
    if (body.room_type_id !== undefined) update.room_type_id = String(body.room_type_id);
    if (body.floor !== undefined) update.floor = String(body.floor);
    if (body.is_active !== undefined) update.is_active = body.is_active ? "true" : "false";
    const ok = await updateRow(SHEETS.ROOMS, id, update);
    if (!ok) return NextResponse.json({ ok: false, error: "Bilik tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "update", "room", id, "");
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
    const ok = await deleteRow(SHEETS.ROOMS, id);
    if (!ok) return NextResponse.json({ ok: false, error: "Bilik tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "delete", "room", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
