import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, todayMY } from "@/lib/utils";
import type { RoomStatus } from "@/lib/types";

function parse(r: Record<string, string>): RoomStatus {
  return {
    id: r.id,
    date: r.date,
    room_id: r.room_id,
    is_lnb: r.is_lnb === "true",
    cleaning_status: r.cleaning_status as RoomStatus["cleaning_status"],
    sellable: r.sellable !== "false",
    notes: r.notes,
    updated_at: r.updated_at,
  };
}

// GET /api/room-statuses?date=YYYY-MM-DD
// Semua role boleh tengok status bilik
export async function GET(req: Request) {
  try {
    await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const date = new URL(req.url).searchParams.get("date") ?? todayMY();
    const rows = (await readAll<Record<string, string>>(SHEETS.ROOM_STATUSES))
      .map(parse)
      .filter((r) => r.date === date);
    return NextResponse.json({ ok: true, statuses: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// POST — cipta atau kemas kini status bilik (dipanggil system Exely atau admin)
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor"]);
    const body = await req.json();
    const roomId = String(body.room_id ?? "");
    const date = String(body.date ?? todayMY());
    if (!roomId) return NextResponse.json({ ok: false, error: "room_id diperlukan." }, { status: 400 });

    const rows = await readAll<Record<string, string>>(SHEETS.ROOM_STATUSES);
    const existing = rows.find((r) => r.room_id === roomId && r.date === date);
    const now = nowISO();

    const fields: Record<string, string> = { updated_at: now };
    if (body.is_lnb !== undefined) fields.is_lnb = body.is_lnb ? "true" : "false";
    if (body.cleaning_status !== undefined) fields.cleaning_status = String(body.cleaning_status);
    if (body.sellable !== undefined) fields.sellable = body.sellable ? "true" : "false";
    if (body.notes !== undefined) fields.notes = String(body.notes);

    if (existing) {
      await updateRow(SHEETS.ROOM_STATUSES, existing.id, fields);
      return NextResponse.json({ ok: true, id: existing.id });
    }

    const id = genId("rs");
    await appendRow(SHEETS.ROOM_STATUSES, {
      id,
      date,
      room_id: roomId,
      is_lnb: fields.is_lnb ?? "false",
      cleaning_status: fields.cleaning_status ?? "none",
      sellable: fields.sellable ?? "true",
      notes: fields.notes ?? "",
      updated_at: now,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
