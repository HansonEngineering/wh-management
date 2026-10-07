import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow, deleteRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, toBool } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { RoomType } from "@/lib/types";

function parse(r: Record<string, string>): RoomType {
  return {
    id: r.id,
    name: r.name,
    beds: Number(r.beds) || 0,
    is_active: toBool(r.is_active),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function GET() {
  try {
    await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const rows = await readAll<Record<string, string>>(SHEETS.ROOM_TYPES);
    return NextResponse.json({ ok: true, roomTypes: rows.map(parse) });
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
    const beds = Number(body.beds) || 0;
    if (!name || beds < 1) {
      return NextResponse.json({ ok: false, error: "Nama dan bilangan katil diperlukan." }, { status: 400 });
    }
    const id = genId("rt");
    const now = nowISO();
    await appendRow(SHEETS.ROOM_TYPES, { id, name, beds: String(beds), is_active: "true", created_at: now, updated_at: now });
    await logAudit(session.id, "create", "room_type", id, name);
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
    if (body.beds !== undefined) update.beds = String(body.beds);
    if (body.is_active !== undefined) update.is_active = body.is_active ? "true" : "false";
    const ok = await updateRow(SHEETS.ROOM_TYPES, id, update);
    if (!ok) return NextResponse.json({ ok: false, error: "Jenis bilik tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "update", "room_type", id, "");
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

    // Halang padam kalau ada bilik guna jenis ni
    const rooms = await readAll<Record<string, string>>(SHEETS.ROOMS);
    if (rooms.some((r) => r.room_type_id === id)) {
      return NextResponse.json(
        { ok: false, error: "Jenis bilik ini sedang digunakan oleh bilik. Nyahaktifkan sahaja." },
        { status: 409 }
      );
    }
    const ok = await deleteRow(SHEETS.ROOM_TYPES, id);
    if (!ok) return NextResponse.json({ ok: false, error: "Jenis bilik tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "delete", "room_type", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
