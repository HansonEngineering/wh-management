"use client";

import { useEffect, useState, useCallback } from "react";
import type { SessionUser, Attendance, Staff } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  on_time: "On time",
  late: "Lewat",
  absent: "Tidak hadir",
  absent_no_notice: "Tidak hadir (tiada notis)",
  leave: "Cuti",
  unscheduled: "Tiada jadual",
};

const STATUS_COLOR: Record<string, string> = {
  on_time: "bg-green-100 text-green-700",
  late: "bg-amber-100 text-amber-700",
  absent: "bg-red-100 text-red-700",
  absent_no_notice: "bg-red-100 text-red-700",
  leave: "bg-blue-100 text-blue-700",
  unscheduled: "bg-neutral-100 text-neutral-500",
};

export default function KehadiranClient({ user }: { user: SessionUser }) {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const isPriv = user.role === "admin" || user.role === "supervisor";

  const load = useCallback(async () => {
    const fetches: Promise<Response>[] = [fetch(`/api/attendance?date=${date}`)];
    if (isPriv) fetches.push(fetch("/api/staff"));
    const [aRes, sRes] = await Promise.all(fetches);
    const a = await aRes.json();
    if (a.ok) setAttendance(a.attendance);
    if (sRes) {
      const s = await sRes.json();
      if (s.ok) setStaff(s.staff.filter((x: Staff) => x.is_active));
    }
    setLoading(false);
  }, [date, isPriv]);

  useEffect(() => {
    load();
  }, [load]);

  function staffName(id: string) {
    return staff.find((s) => s.id === id)?.name ?? id;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kehadiran</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-500">Memuatkan...</p>
      ) : (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="font-medium">{isPriv ? `Kehadiran semua staff · ${date}` : `Kehadiran saya · ${date}`}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-neutral-200">
                  {isPriv && <th className="py-2 pr-4">Staff</th>}
                  <th className="py-2 pr-4">Masuk</th>
                  <th className="py-2 pr-4">Keluar</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Lewat</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id} className="border-b border-neutral-100">
                    {isPriv && <td className="py-2 pr-4 font-medium">{staffName(a.staff_id)}</td>}
                    <td className="py-2 pr-4 font-mono">{a.clock_in || "-"}</td>
                    <td className="py-2 pr-4 font-mono">{a.clock_out || "-"}</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-lg px-2 py-1 text-xs ${STATUS_COLOR[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                    </td>
                    <td className="py-2 pr-4">{a.late_minutes > 0 ? `${a.late_minutes} min` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {attendance.length === 0 && <p className="py-4 text-sm text-neutral-500">Tiada rekod untuk tarikh ini.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
