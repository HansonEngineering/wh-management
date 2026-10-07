import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, todayMY, timeMY } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { Report } from "@/lib/types";

function parse(r: Record<string, string>): Report {
  return {
    id: r.id,
    date: r.date,
    time: r.time,
    room_id: r.room_id,
    category: r.category as Report["category"],
    severity: r.severity as Report["severity"],
    title: r.title,
    description: r.description,
    photo_url: r.photo_url,
    reported_by: r.reported_by,
    status: r.status as Report["status"],
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// GET — maintenance nampak report maintenance; semua role nampak report sendiri; admin/supervisor semua
export async function GET(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    let rows = (await readAll<Record<string, string>>(SHEETS.REPORTS)).map(parse);

    if (session.role === "maintenance") {
      rows = rows.filter((r) => r.category === "maintenance");
    } else if (session.role !== "admin" && session.role !== "supervisor") {
      rows = rows.filter((r) => r.reported_by === session.id);
    }
    if (status) rows = rows.filter((r) => r.status === status);
    rows.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    return NextResponse.json({ ok: true, reports: rows.slice(0, 100) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// POST — mana-mana staff boleh buat report
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const body = await req.json();
    const roomId = String(body.room_id ?? "");
    const category = String(body.category ?? "maintenance");
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "");
    const photoUrl = String(body.photo_url ?? "");

    if (!title) return NextResponse.json({ ok: false, error: "Tajuk report diperlukan." }, { status: 400 });
    if (!["maintenance", "linen"].includes(category)) {
      return NextResponse.json({ ok: false, error: "Kategori tidak sah." }, { status: 400 });
    }

    const id = genId("rpt");
    const now = nowISO();
    await appendRow(SHEETS.REPORTS, {
      id,
      date: todayMY(),
      time: timeMY(),
      room_id: roomId,
      category,
      severity: "unclassified",
      title,
      description,
      photo_url: photoUrl,
      reported_by: session.id,
      status: "new",
      created_at: now,
      updated_at: now,
    });
    await logAudit(session.id, "create", "report", id, title);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// PUT — pelbagai tindakan ikut role
export async function PUT(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const body = await req.json();
    const id = String(body.id ?? "");
    const action = String(body.action ?? "");

    const rows = await readAll<Record<string, string>>(SHEETS.REPORTS);
    const report = rows.find((r) => r.id === id);
    if (!report) return NextResponse.json({ ok: false, error: "Report tidak dijumpai." }, { status: 404 });

    const now = nowISO();
    const isPriv = session.role === "admin" || session.role === "supervisor";

    switch (action) {
      case "classify": {
        // Admin label major/minor dan set boleh dijual
        if (session.role !== "admin") {
          return NextResponse.json({ ok: false, error: "Hanya admin boleh klasifikasi." }, { status: 403 });
        }
        const severity = String(body.severity ?? "minor");
        const sellable = body.sellable === true;
        await updateRow(SHEETS.REPORTS, id, { severity, updated_at: now });

        // Kemas kini status bilik
        if (report.room_id) {
          const statuses = await readAll<Record<string, string>>(SHEETS.ROOM_STATUSES);
          const st = statuses.find((s) => s.room_id === report.room_id && s.date === todayMY());
          if (st) {
            await updateRow(SHEETS.ROOM_STATUSES, st.id, { sellable: sellable ? "true" : "false", updated_at: now });
          }
        }
        break;
      }
      case "start_work": {
        if (session.role !== "maintenance" && !isPriv) {
          return NextResponse.json({ ok: false, error: "Tidak dibenarkan." }, { status: 403 });
        }
        await updateRow(SHEETS.REPORTS, id, { status: "in_progress", updated_at: now });
        break;
      }
      case "submit_work": {
        // Maintenance hantar kerja siap untuk diluluskan
        if (session.role !== "maintenance" && !isPriv) {
          return NextResponse.json({ ok: false, error: "Tidak dibenarkan." }, { status: 403 });
        }
        await updateRow(SHEETS.REPORTS, id, { status: "pending_approval", updated_at: now });
        break;
      }
      case "approve": {
        if (!isPriv) return NextResponse.json({ ok: false, error: "Hanya admin/supervisor." }, { status: 403 });
        await updateRow(SHEETS.REPORTS, id, { status: "approved", updated_at: now });
        break;
      }
      case "reject": {
        if (!isPriv) return NextResponse.json({ ok: false, error: "Hanya admin/supervisor." }, { status: 403 });
        await updateRow(SHEETS.REPORTS, id, { status: "rejected", updated_at: now });
        break;
      }
      case "resolve": {
        // Untuk report linen: admin/supervisor tanda selesai selepas tambah stok
        if (!isPriv) return NextResponse.json({ ok: false, error: "Hanya admin/supervisor." }, { status: 403 });
        await updateRow(SHEETS.REPORTS, id, { status: "resolved", updated_at: now });
        break;
      }
      default:
        return NextResponse.json({ ok: false, error: "Tindakan tidak sah." }, { status: 400 });
    }

    await logAudit(session.id, action, "report", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
