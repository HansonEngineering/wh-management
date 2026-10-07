"use client";

import { useEffect, useState, useCallback } from "react";
import type { SessionUser, LeaveType, LeaveRequest, Staff } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = { pending: "Menunggu", approved: "Diluluskan", rejected: "Ditolak" };
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function CutiClient({ user }: { user: SessionUser }) {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ leave_type_id: "", start_date: "", end_date: "", reason: "" });

  const isPriv = user.role === "admin" || user.role === "supervisor";

  const load = useCallback(async () => {
    const fetches: Promise<Response>[] = [fetch("/api/leave")];
    if (isPriv) fetches.push(fetch("/api/staff"));
    const [lRes, sRes] = await Promise.all(fetches);
    const l = await lRes.json();
    if (l.ok) {
      setTypes(l.types);
      setRequests(l.requests);
    }
    if (sRes) {
      const s = await sRes.json();
      if (s.ok) setStaff(s.staff);
    }
    setLoading(false);
  }, [isPriv]);

  useEffect(() => {
    load();
  }, [load]);

  function typeName(id: string) {
    return types.find((t) => t.id === id)?.name ?? id;
  }
  function staffName(id: string) {
    return staff.find((s) => s.id === id)?.name ?? id;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!data.ok) {
      alert(data.error ?? "Gagal menghantar permohonan");
      return;
    }
    setShowNew(false);
    setForm({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
    load();
  }

  async function decide(id: string, action: "approve" | "reject") {
    await fetch("/api/leave", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    load();
  }

  if (loading) return <p className="text-sm text-neutral-500">Memuatkan...</p>;

  const pending = requests.filter((r) => r.status === "pending");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cuti</h1>
        <button onClick={() => setShowNew(true)} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white">
          + Mohon Cuti
        </button>
      </div>

      {isPriv && pending.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-medium text-amber-900">Menunggu kelulusan ({pending.length})</h2>
          <div className="mt-3 space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="rounded-xl bg-white border border-amber-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{staffName(r.staff_id)}</p>
                    <p className="text-xs text-neutral-500">
                      {typeName(r.leave_type_id)} · {r.start_date} hingga {r.end_date} ({r.days} hari)
                    </p>
                    {r.reason && <p className="mt-1 text-xs text-neutral-600">{r.reason}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => decide(r.id, "approve")} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white">Approve</button>
                    <button onClick={() => decide(r.id, "reject")} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs">Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-medium">{isPriv ? "Semua permohonan" : "Permohonan saya"}</h2>
        <div className="mt-3 space-y-2">
          {requests.length === 0 && <p className="text-sm text-neutral-500">Tiada permohonan.</p>}
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-neutral-200 p-3 text-sm">
              <div>
                <p className="font-medium">{isPriv ? staffName(r.staff_id) : typeName(r.leave_type_id)}</p>
                <p className="text-xs text-neutral-500">
                  {isPriv ? `${typeName(r.leave_type_id)} · ` : ""}
                  {r.start_date} hingga {r.end_date} ({r.days} hari)
                </p>
              </div>
              <span className={`rounded-lg px-2 py-1 text-xs ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</span>
            </div>
          ))}
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowNew(false)}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 space-y-3">
            <h2 className="font-medium">Mohon Cuti</h2>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Jenis cuti</label>
              <select value={form.leave_type_id} onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" required>
                <option value="">Pilih jenis</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.requires_mc ? " (perlu MC)" : ""}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Dari</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Hingga</label>
                <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" required />
              </div>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Sebab</label>
              <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" rows={2} />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 rounded-lg bg-neutral-900 py-2.5 text-sm text-white">Hantar</button>
              <button type="button" onClick={() => setShowNew(false)} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm">Batal</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
