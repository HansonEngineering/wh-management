"use client";

import { useEffect, useState, useCallback } from "react";
import type { Payroll, Staff } from "@/lib/types";

export default function GajiClient() {
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, sRes] = await Promise.all([fetch(`/api/payroll?month=${month}`), fetch("/api/staff")]);
    const p = await pRes.json();
    const s = await sRes.json();
    if (p.ok) setPayroll(p.payroll);
    if (s.ok) setStaff(s.staff);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  function staffName(id: string) {
    return staff.find((s) => s.id === id)?.name ?? id;
  }

  async function generate() {
    if (!confirm(`Jana gaji untuk ${month}? Ini akan mengira semula berdasarkan kehadiran dan merit/demerit.`)) return;
    setGenerating(true);
    const res = await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    const data = await res.json();
    setGenerating(false);
    if (!data.ok) {
      alert(data.error ?? "Gagal menjana gaji");
      return;
    }
    load();
  }

  async function finalize(id: string) {
    await fetch("/api/payroll", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  const totalNet = payroll.reduce((sum, p) => sum + p.net_salary, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gaji</h1>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <button onClick={generate} disabled={generating} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50">
            {generating ? "Menjana..." : "Jana Gaji"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-500">Memuatkan...</p>
      ) : (
        <>
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Ringkasan {month}</h2>
              <p className="text-sm text-neutral-500">
                Jumlah bersih: <span className="font-semibold text-neutral-900">RM {totalNet.toFixed(2)}</span>
              </p>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-500 border-b border-neutral-200">
                    <th className="py-2 pr-3">Staff</th>
                    <th className="py-2 pr-3">Pokok</th>
                    <th className="py-2 pr-3">Hadir</th>
                    <th className="py-2 pr-3">Lewat</th>
                    <th className="py-2 pr-3">Merit</th>
                    <th className="py-2 pr-3">Demerit</th>
                    <th className="py-2 pr-3">Potong</th>
                    <th className="py-2 pr-3">OT</th>
                    <th className="py-2 pr-3">Bersih</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.map((p) => (
                    <tr key={p.id} className="border-b border-neutral-100">
                      <td className="py-2 pr-3 font-medium">{staffName(p.staff_id)}</td>
                      <td className="py-2 pr-3">RM {p.basic_salary.toFixed(2)}</td>
                      <td className="py-2 pr-3">{p.days_present}</td>
                      <td className="py-2 pr-3">{p.late_count}</td>
                      <td className="py-2 pr-3 text-green-700">{p.merit_points}</td>
                      <td className="py-2 pr-3 text-red-600">{p.demerit_points}</td>
                      <td className="py-2 pr-3 text-red-600">
                        {p.deduction_percent > 0 ? `-${p.deduction_percent}% (RM ${p.deduction_amount.toFixed(2)})` : "-"}
                      </td>
                      <td className="py-2 pr-3">{p.ot_hours > 0 ? `${p.ot_hours}j (RM ${p.ot_amount.toFixed(2)})` : "-"}</td>
                      <td className="py-2 pr-3 font-semibold">RM {p.net_salary.toFixed(2)}</td>
                      <td className="py-2">
                        {p.status === "draft" ? (
                          <button onClick={() => finalize(p.id)} className="rounded-lg border border-neutral-300 px-2 py-1 text-xs">
                            Finalize
                          </button>
                        ) : (
                          <span className="rounded-lg bg-green-100 px-2 py-1 text-xs text-green-700">Final</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payroll.length === 0 && (
                <p className="py-4 text-sm text-neutral-500">Tiada data untuk bulan ini. Tekan "Jana Gaji".</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
