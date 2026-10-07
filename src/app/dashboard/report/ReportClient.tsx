"use client";

import { useEffect, useState, useCallback } from "react";
import type { SessionUser, Report, Room, ReportReply, Staff } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  new: "Baru",
  in_progress: "Sedang dibaiki",
  pending_approval: "Menunggu kelulusan",
  approved: "Diluluskan",
  rejected: "Ditolak",
  resolved: "Selesai",
};

const STATUS_COLOR: Record<string, string> = {
  new: "bg-amber-100 text-amber-700",
  in_progress: "bg-purple-100 text-purple-700",
  pending_approval: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  resolved: "bg-neutral-100 text-neutral-600",
};

export default function ReportClient({ user }: { user: SessionUser }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [active, setActive] = useState<Report | null>(null);
  const [replies, setReplies] = useState<ReportReply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [form, setForm] = useState({ room_id: "", category: "maintenance", title: "", description: "" });
  const [photo, setPhoto] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [replyPhoto, setReplyPhoto] = useState<string>("");

  const isPriv = user.role === "admin" || user.role === "supervisor";
  const isMaintenance = user.role === "maintenance";

  const load = useCallback(async () => {
    const fetches: Promise<Response>[] = [fetch("/api/reports"), fetch("/api/rooms")];
    if (isPriv) fetches.push(fetch("/api/staff"));
    const [rRes, roomRes, sRes] = await Promise.all(fetches);
    const r = await rRes.json();
    const rm = await roomRes.json();
    if (r.ok) setReports(r.reports);
    if (rm.ok) setRooms(rm.rooms.filter((x: Room) => x.is_active));
    if (sRes) {
      const s = await sRes.json();
      if (s.ok) setStaff(s.staff);
    }
    setLoading(false);
  }, [isPriv]);

  useEffect(() => {
    load();
  }, [load]);

  function roomNumber(id: string) {
    return rooms.find((r) => r.id === id)?.room_number ?? (id || "-");
  }
  function staffName(id: string) {
    return staff.find((s) => s.id === id)?.name ?? id;
  }

  async function openReport(r: Report) {
    setActive(r);
    const res = await fetch(`/api/reports/replies?report_id=${r.id}`);
    const data = await res.json();
    if (data.ok) setReplies(data.replies);
  }

  async function action(id: string, act: string, extra: Record<string, unknown> = {}) {
    const res = await fetch("/api/reports", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: act, ...extra }),
    });
    const data = await res.json();
    if (!data.ok) alert(data.error ?? "Gagal");
    load();
    if (active?.id === id) setActive(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      setUploading(false);
      if (data.ok) setter(data.url);
      else alert(data.error ?? "Upload gambar gagal. Pastikan Cloudinary diset.");
    };
    reader.readAsDataURL(file);
  }

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, photo_url: photo }),
    });
    const data = await res.json();
    if (!data.ok) {
      alert(data.error ?? "Gagal menghantar report");
      return;
    }
    setShowNew(false);
    setForm({ room_id: "", category: "maintenance", title: "", description: "" });
    setPhoto("");
    load();
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !replyText.trim()) return;
    await fetch("/api/reports/replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report_id: active.id, message: replyText, photo_url: replyPhoto }),
    });
    setReplyText("");
    setReplyPhoto("");
    openReport(active);
  }

  if (loading) return <p className="text-sm text-neutral-500">Memuatkan...</p>;

  const open = reports.filter((r) => !["approved", "resolved"].includes(r.status));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Report</h1>
        <button onClick={() => setShowNew(true)} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white">
          + Report Baru
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {open.length === 0 && <p className="text-sm text-neutral-500">Tiada report aktif.</p>}
        {open.map((r) => (
          <button key={r.id} onClick={() => openReport(r)} className="w-full text-left rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {r.date} {r.time} · Bilik {roomNumber(r.room_id)} · {r.category}
                  {r.severity !== "unclassified" && ` · ${r.severity}`}
                </p>
              </div>
              <span className={`shrink-0 rounded-lg px-2 py-1 text-xs ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Modal report baru */}
      {showNew && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowNew(false)}>
          <form onSubmit={submitNew} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 space-y-3">
            <h2 className="font-medium">Report Baru</h2>
            <select value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
              <option value="">Pilih bilik (pilihan)</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>Bilik {r.room_number}</option>
              ))}
            </select>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
              <option value="maintenance">Kerosakan (Maintenance)</option>
              <option value="linen">Linen tak cukup</option>
            </select>
            <input placeholder="Tajuk" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" required />
            <textarea placeholder="Keterangan" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" rows={3} />
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Gambar (pilihan)</label>
              <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFile(e, setPhoto)} className="w-full text-sm" />
              {uploading && <p className="text-xs text-neutral-400 mt-1">Memuat naik...</p>}
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="Pratonton" className="mt-2 rounded-lg w-full max-h-40 object-cover" />
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={uploading} className="flex-1 rounded-lg bg-neutral-900 py-2.5 text-sm text-white disabled:opacity-50">Hantar</button>
              <button type="button" onClick={() => setShowNew(false)} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm">Batal</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal detail report */}
      {active && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setActive(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-medium">{active.title}</h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Bilik {roomNumber(active.room_id)} · {active.category} · oleh {staffName(active.reported_by) || active.reported_by}
                </p>
              </div>
              <span className={`shrink-0 rounded-lg px-2 py-1 text-xs ${STATUS_COLOR[active.status]}`}>{STATUS_LABEL[active.status]}</span>
            </div>
            {active.description && <p className="mt-3 text-sm text-neutral-700">{active.description}</p>}
            {active.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.photo_url} alt="Gambar report" className="mt-3 rounded-xl w-full" />
            )}

            {/* Tindakan ikut role */}
            <div className="mt-4 space-y-2">
              {user.role === "admin" && active.severity === "unclassified" && (
                <div className="rounded-xl border border-neutral-200 p-3">
                  <p className="text-xs font-medium text-neutral-500 mb-2">Klasifikasi (Admin)</p>
                  <div className="flex gap-2">
                    <button onClick={() => action(active.id, "classify", { severity: "major", sellable: false })} className="flex-1 rounded-lg bg-red-600 py-2 text-xs text-white">Major · Tidak dijual</button>
                    <button onClick={() => action(active.id, "classify", { severity: "major", sellable: true })} className="flex-1 rounded-lg bg-amber-500 py-2 text-xs text-white">Major · Boleh dijual</button>
                    <button onClick={() => action(active.id, "classify", { severity: "minor", sellable: true })} className="flex-1 rounded-lg border border-neutral-300 py-2 text-xs">Minor</button>
                  </div>
                </div>
              )}

              {(isMaintenance || isPriv) && active.category === "maintenance" && active.status === "new" && (
                <button onClick={() => action(active.id, "start_work")} className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm text-white">
                  Mula Baiki
                </button>
              )}
              {(isMaintenance || isPriv) && active.category === "maintenance" && active.status === "in_progress" && (
                <button onClick={() => action(active.id, "submit_work")} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm text-white">
                  Hantar Untuk Kelulusan
                </button>
              )}
              {isPriv && active.status === "pending_approval" && (
                <div className="flex gap-2">
                  <button onClick={() => action(active.id, "approve")} className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm text-white">Approve</button>
                  <button onClick={() => action(active.id, "reject")} className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm text-white">Reject</button>
                </div>
              )}
              {isPriv && active.category === "linen" && active.status === "new" && (
                <button onClick={() => action(active.id, "resolve")} className="w-full rounded-lg bg-green-600 py-2.5 text-sm text-white">
                  Tanda Selesai (stok ditambah)
                </button>
              )}
            </div>

            {/* Balasan */}
            <div className="mt-5 border-t border-neutral-200 pt-4">
              <p className="text-sm font-medium">Balasan ({replies.length})</p>
              <div className="mt-2 space-y-2">
                {replies.map((r) => (
                  <div key={r.id} className="rounded-lg bg-neutral-50 p-3 text-sm">
                    <p className="text-xs text-neutral-400">{staffName(r.staff_id) || r.staff_id}</p>
                    <p className="mt-0.5">{r.message}</p>
                    {r.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.photo_url} alt="Gambar balasan" className="mt-2 rounded-lg w-full" />
                    )}
                  </div>
                ))}
              </div>
              <form onSubmit={sendReply} className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Tulis balasan..."
                    className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                  <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white">Hantar</button>
                </div>
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFile(e, setReplyPhoto)} className="text-xs" />
                  {replyPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={replyPhoto} alt="Pratonton" className="h-10 w-10 rounded object-cover" />
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
