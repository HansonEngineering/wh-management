import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { readAll, appendRow, updateRow, deleteRow } from "@/lib/sheets";
import { SHEETS, ROLES, type Role } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, toBool } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { Staff } from "@/lib/types";

function parseStaff(r: Record<string, string>): Staff {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    role: r.role as Role,
    password_hash: "",
    rfid_uid: r.rfid_uid,
    fingerprint_id: r.fingerprint_id,
    is_active: toBool(r.is_active),
    basic_salary: Number(r.basic_salary) || 0,
    ot_rate_per_hour: Number(r.ot_rate_per_hour) || 0,
    telegram_chat_id: r.telegram_chat_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function GET() {
  try {
    await requireRole(["admin", "supervisor"]);
    const rows = await readAll<Record<string, string>>(SHEETS.STAFF);
    return NextResponse.json({ ok: true, staff: rows.map(parseStaff) });
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
    const role = String(body.role ?? "") as Role;
    const password = String(body.password ?? "");
    if (!name || !ROLES.includes(role) || password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "Nama, role dan kata laluan (min 6 aksara) diperlukan." },
        { status: 400 }
      );
    }

    const existing = await readAll<Record<string, string>>(SHEETS.STAFF);
    if (existing.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ ok: false, error: "Nama staff sudah wujud." }, { status: 409 });
    }

    const id = genId("stf");
    const now = nowISO();
    await appendRow(SHEETS.STAFF, {
      id,
      name,
      phone: String(body.phone ?? ""),
      email: String(body.email ?? ""),
      role,
      password_hash: await bcrypt.hash(password, 10),
      rfid_uid: String(body.rfid_uid ?? ""),
      fingerprint_id: String(body.fingerprint_id ?? ""),
      is_active: "true",
      basic_salary: String(body.basic_salary ?? "0"),
      ot_rate_per_hour: String(body.ot_rate_per_hour ?? "0"),
      telegram_chat_id: "",
      created_at: now,
      updated_at: now,
    });
    await logAudit(session.id, "create", "staff", id, `Cipta staff ${name} (${role})`);
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
    if (body.phone !== undefined) update.phone = String(body.phone);
    if (body.email !== undefined) update.email = String(body.email);
    if (body.role !== undefined) {
      if (!ROLES.includes(body.role)) {
        return NextResponse.json({ ok: false, error: "Role tidak sah." }, { status: 400 });
      }
      update.role = body.role;
    }
    if (body.rfid_uid !== undefined) update.rfid_uid = String(body.rfid_uid);
    if (body.fingerprint_id !== undefined) update.fingerprint_id = String(body.fingerprint_id);
    if (body.is_active !== undefined) update.is_active = body.is_active ? "true" : "false";
    if (body.basic_salary !== undefined) update.basic_salary = String(body.basic_salary);
    if (body.ot_rate_per_hour !== undefined) update.ot_rate_per_hour = String(body.ot_rate_per_hour);
    if (body.telegram_chat_id !== undefined) update.telegram_chat_id = String(body.telegram_chat_id);
    if (body.password) {
      if (String(body.password).length < 6) {
        return NextResponse.json({ ok: false, error: "Kata laluan min 6 aksara." }, { status: 400 });
      }
      update.password_hash = await bcrypt.hash(String(body.password), 10);
    }

    const ok = await updateRow(SHEETS.STAFF, id, update);
    if (!ok) return NextResponse.json({ ok: false, error: "Staff tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "update", "staff", id, JSON.stringify(Object.keys(update)));
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
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") ?? "";
    if (!id) return NextResponse.json({ ok: false, error: "ID diperlukan." }, { status: 400 });
    if (id === session.id) {
      return NextResponse.json({ ok: false, error: "Tidak boleh padam akaun sendiri." }, { status: 400 });
    }

    const ok = await deleteRow(SHEETS.STAFF, id);
    if (!ok) return NextResponse.json({ ok: false, error: "Staff tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "delete", "staff", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
