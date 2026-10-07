import { NextResponse } from "next/server";
import { readAll, appendRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO } from "@/lib/utils";
import type { ReportReply } from "@/lib/types";

function parse(r: Record<string, string>): ReportReply {
  return {
    id: r.id,
    report_id: r.report_id,
    staff_id: r.staff_id,
    message: r.message,
    photo_url: r.photo_url,
    reply_type: r.reply_type as ReportReply["reply_type"],
    created_at: r.created_at,
  };
}

// GET /api/reports/replies?report_id=...
export async function GET(req: Request) {
  try {
    await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const reportId = new URL(req.url).searchParams.get("report_id") ?? "";
    let rows = (await readAll<Record<string, string>>(SHEETS.REPORT_REPLIES)).map(parse);
    if (reportId) rows = rows.filter((r) => r.report_id === reportId);
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return NextResponse.json({ ok: true, replies: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// POST — tambah balasan (gambar selepas baiki, komen, dsb)
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const body = await req.json();
    const reportId = String(body.report_id ?? "");
    const message = String(body.message ?? "");
    const photoUrl = String(body.photo_url ?? "");
    const replyType = String(body.reply_type ?? "comment");

    if (!reportId || !message.trim()) {
      return NextResponse.json({ ok: false, error: "report_id dan mesej diperlukan." }, { status: 400 });
    }

    const id = genId("rpl");
    await appendRow(SHEETS.REPORT_REPLIES, {
      id,
      report_id: reportId,
      staff_id: session.id,
      message,
      photo_url: photoUrl,
      reply_type: replyType,
      created_at: nowISO(),
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
