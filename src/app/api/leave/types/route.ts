import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow, deleteRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, toBool } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { LeaveType } from "@/lib/types";

function parse(r: Record<string, string>): LeaveType {
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

export async function GET() {
  try {
    await requireRole(["admin", "supervisor"]);
    const rows = await readAll<Record<string, string>>(SHEETS.LEAVE_TYPES);
    return NextResponse.json({ ok: true, types: rows.map(parse) });
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
    if (!name) return NextResponse.json({ ok: false, error: "Nama jenis cuti diperlukan." }, { status: 400 });
    const id = genId("lt");
    const now = nowISO();
    await appendRow(SHEETS.LEAVE_TYPES, {
      id,
      name,
      requires_mc: body.requires_mc ? "true" : "false",
      is_paid: body.is_paid === false ? "false" : "true",
      default_days_per_year: String(body.default_days_per_year ?? "0"),
      min_notice_days: String(body.min_notice_days ?? "0"),
      is_active: "true",
      created_at: now,
      updated_at: now,
    });
    await logAudit(session.id, "create", "leave_type", id, name);
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
    if (body.requires_mc !== undefined) update.requires_mc = body.requires_mc ? "true" : "false";
    if (body.is_paid !== undefined) update.is_paid = body.is_paid ? "true" : "false";
    if (body.default_days_per_year !== undefined) update.default_days_per_year = String(body.default_days_per_year);
    if (body.min_notice_days !== undefined) update.min_notice_days = String(body.min_notice_days);
    if (body.is_active !== undefined) update.is_active = body.is_active ? "true" : "false";
    const ok = await updateRow(SHEETS.LEAVE_TYPES, id, update);
    if (!ok) return NextResponse.json({ ok: false, error: "Jenis cuti tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "update", "leave_type", id, "");
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
    const ok = await deleteRow(SHEETS.LEAVE_TYPES, id);
    if (!ok) return NextResponse.json({ ok: false, error: "Jenis cuti tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "delete", "leave_type", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
