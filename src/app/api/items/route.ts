import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow, deleteRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, toBool } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { Item } from "@/lib/types";

function parse(r: Record<string, string>): Item {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    is_tracked: toBool(r.is_tracked),
    current_stock: Number(r.current_stock) || 0,
    responsible_staff_id: r.responsible_staff_id,
    is_active: toBool(r.is_active),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function GET() {
  try {
    await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const rows = await readAll<Record<string, string>>(SHEETS.ITEMS);
    return NextResponse.json({ ok: true, items: rows.map(parse) });
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
    const category = String(body.category ?? "consumable");
    if (!name) return NextResponse.json({ ok: false, error: "Nama item diperlukan." }, { status: 400 });
    if (!["consumable", "linen"].includes(category)) {
      return NextResponse.json({ ok: false, error: "Kategori mesti consumable atau linen." }, { status: 400 });
    }
    const id = genId("item");
    const now = nowISO();
    await appendRow(SHEETS.ITEMS, {
      id,
      name,
      category,
      is_tracked: body.is_tracked === false ? "false" : "true",
      current_stock: String(body.current_stock ?? "0"),
      responsible_staff_id: String(body.responsible_staff_id ?? ""),
      is_active: "true",
      created_at: now,
      updated_at: now,
    });
    await logAudit(session.id, "create", "item", id, name);
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
    if (body.category !== undefined) update.category = String(body.category);
    if (body.is_tracked !== undefined) update.is_tracked = body.is_tracked ? "true" : "false";
    if (body.current_stock !== undefined) update.current_stock = String(body.current_stock);
    if (body.responsible_staff_id !== undefined) update.responsible_staff_id = String(body.responsible_staff_id);
    if (body.is_active !== undefined) update.is_active = body.is_active ? "true" : "false";
    const ok = await updateRow(SHEETS.ITEMS, id, update);
    if (!ok) return NextResponse.json({ ok: false, error: "Item tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "update", "item", id, "");
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
    const ok = await deleteRow(SHEETS.ITEMS, id);
    if (!ok) return NextResponse.json({ ok: false, error: "Item tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "delete", "item", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
