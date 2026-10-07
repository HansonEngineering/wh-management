import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow, deleteRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, toBool } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { StorPurpose } from "@/lib/types";

function parse(r: Record<string, string>): StorPurpose {
  return { id: r.id, name: r.name, is_active: toBool(r.is_active), created_at: r.created_at };
}

export async function GET() {
  try {
    await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const rows = await readAll<Record<string, string>>(SHEETS.STOR_PURPOSES);
    return NextResponse.json({ ok: true, purposes: rows.map(parse) });
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
    if (!name) return NextResponse.json({ ok: false, error: "Nama tujuan diperlukan." }, { status: 400 });
    const id = genId("pp");
    await appendRow(SHEETS.STOR_PURPOSES, { id, name, is_active: "true", created_at: nowISO() });
    await logAudit(session.id, "create", "stor_purpose", id, name);
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
    const update: Record<string, string> = {};
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.is_active !== undefined) update.is_active = body.is_active ? "true" : "false";
    const ok = await updateRow(SHEETS.STOR_PURPOSES, id, update);
    if (!ok) return NextResponse.json({ ok: false, error: "Tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "update", "stor_purpose", id, "");
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
    const ok = await deleteRow(SHEETS.STOR_PURPOSES, id);
    if (!ok) return NextResponse.json({ ok: false, error: "Tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "delete", "stor_purpose", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
