import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { initializeSpreadsheet, appendRow, readAll, setSetting } from "@/lib/sheets";
import { SHEETS, DEFAULT_SETTINGS } from "@/lib/constants";
import { genId, nowISO } from "@/lib/utils";

// POST /api/setup
// Satu kali sahaja: cipta semua tab, header, settings default dan akaun admin pertama.
// Selepas admin pertama wujud, endpoint ini akan menolak.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const password = String(body.password ?? "");
    const email = String(body.email ?? "").trim();

    if (!name || password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "Nama diperlukan dan kata laluan mesti sekurang-kurangnya 6 aksara." },
        { status: 400 }
      );
    }

    const { created, existing } = await initializeSpreadsheet();

    // Isi settings default (abaikan yang sudah ada)
    for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
      try {
        await setSetting(key, def.value, def.description);
      } catch (e) {
        console.error(`Gagal set setting ${key}:`, e);
      }
    }

    // Semak sama ada admin sudah wujud
    const staff = await readAll<{ id: string; role: string }>(SHEETS.STAFF);
    const hasAdmin = staff.some((s) => s.role === "admin");
    if (hasAdmin) {
      return NextResponse.json(
        { ok: false, error: "Setup sudah selesai. Akaun admin sudah wujud.", tabsCreated: created, tabsExisting: existing },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = nowISO();
    await appendRow(SHEETS.STAFF, {
      id: genId("stf"),
      name,
      phone: "",
      email,
      role: "admin",
      password_hash: passwordHash,
      rfid_uid: "",
      fingerprint_id: "",
      is_active: "true",
      basic_salary: "0",
      ot_rate_per_hour: "0",
      telegram_chat_id: "",
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({
      ok: true,
      message: "Setup selesai. Akaun admin telah dicipta.",
      tabsCreated: created,
      tabsExisting: existing,
    });
  } catch (e) {
    console.error("Setup gagal:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Setup gagal" },
      { status: 500 }
    );
  }
}
