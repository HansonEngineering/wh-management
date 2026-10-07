import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { readAll } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { createSession } from "@/lib/auth";
import { toBool } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const password = String(body.password ?? "");

    if (!name || !password) {
      return NextResponse.json({ ok: false, error: "Sila isi nama dan kata laluan." }, { status: 400 });
    }

    const staff = await readAll<{
      id: string;
      name: string;
      role: string;
      password_hash: string;
      is_active: string;
    }>(SHEETS.STAFF);

    const user = staff.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (!user || !toBool(user.is_active)) {
      return NextResponse.json({ ok: false, error: "Nama atau kata laluan salah." }, { status: 401 });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return NextResponse.json({ ok: false, error: "Nama atau kata laluan salah." }, { status: 401 });
    }

    await createSession({ id: user.id, name: user.name, role: user.role as never });
    return NextResponse.json({ ok: true, name: user.name, role: user.role });
  } catch (e) {
    console.error("Login gagal:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Login gagal" },
      { status: 500 }
    );
  }
}
