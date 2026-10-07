"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SessionUser } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/constants";

interface Stats {
  totalStaff: number;
  present: number;
  late: number;
  absent: number;
  totalRooms: number;
  pendingRooms: number;
  inProgressRooms: number;
  doneRooms: number;
  openReports: number;
  pendingApprovalReports: number;
  pendingAlerts: number;
  pendingRequests: number;
  notSellable: number;
}

interface My {
  tasks: number;
  alerts: number;
  clockedIn: boolean;
  status: string | null;
}

export default function DashboardClient({ user }: { user: SessionUser }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [my, setMy] = useState<My | null>(null);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [pwForm, setPwForm] = useState({ old_password: "", new_password: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");

  const isPriv = user.role === "admin" || user.role === "supervisor";

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      if (data.ok) {
        setStats(data.stats);
        setMy(data.my);
        setToday(data.today);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg("");
    if (pwForm.new_password !== pwForm.confirm) {
      setPwMsg("Kata laluan baru tidak sepadan.");
      return;
    }
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pwForm),
    });
    const data = await res.json();
    if (data.ok) {
      setPwMsg("Kata laluan berjaya ditukar.");
      setPwForm({ old_password: "", new_password: "", confirm: "" });
      setTimeout(() => setShowPw(false), 1500);
    } else {
      setPwMsg(data.error ?? "Gagal menukar kata laluan.");
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Selamat datang, {user.name}</h1>
          <p className="mt-1 text-neutral-500">
            {ROLE_LABELS[user.role]} · {today}
          </p>
        </div>
        <button onClick={() => setShowPw(true)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs">
          Tukar Kata Laluan
        </button>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-neutral-500">Memuatkan...</p>
      ) : (
        <>
          {/* Ringkasan peribadi */}
          {my && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <p className="text-xs text-neutral-500">Kehadiran hari ini</p>
                <p className="mt-1 text-lg font-semibold">
                  {my.clockedIn ? (my.status === "late" ? "Lewat" : "Hadir") : "Belum"}
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <p className="text-xs text-neutral-500">Tugas saya</p>
                <p className="mt-1 text-lg font-semibold">{my.tasks}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <p className="text-xs text-neutral-500">Alert item saya</p>
                <p className={`mt-1 text-lg font-semibold ${my.alerts > 0 ? "text-red-600" : ""}`}>{my.alerts}</p>
              </div>
              <Link href="/dashboard/stor" className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-400">
                <p className="text-xs text-neutral-500">Stor</p>
                <p className="mt-1 text-lg font-semibold">Buka →</p>
              </Link>
            </div>
          )}

          {/* Ringkasan hotel untuk admin/supervisor */}
          {isPriv && stats && (
            <>
              <h2 className="mt-8 font-medium">Ringkasan hotel hari ini</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Link href="/dashboard/kehadiran" className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-400">
                  <p className="text-xs text-neutral-500">Hadir</p>
                  <p className="mt-1 text-lg font-semibold text-green-700">{stats.present}</p>
                  <p className="text-xs text-neutral-400">Lewat: {stats.late} · Tidak: {stats.absent}</p>
                </Link>
                <Link href="/dashboard/bilik" className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-400">
                  <p className="text-xs text-neutral-500">Bilik pending</p>
                  <p className="mt-1 text-lg font-semibold text-amber-600">{stats.pendingRooms}</p>
                  <p className="text-xs text-neutral-400">Siap: {stats.doneRooms}</p>
                </Link>
                <Link href="/dashboard/report" className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-400">
                  <p className="text-xs text-neutral-500">Report aktif</p>
                  <p className="mt-1 text-lg font-semibold text-blue-600">{stats.openReports}</p>
                  <p className="text-xs text-neutral-400">Menunggu lulus: {stats.pendingApprovalReports}</p>
                </Link>
                <Link href="/dashboard/stok" className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-400">
                  <p className="text-xs text-neutral-500">Alert stok</p>
                  <p className={`mt-1 text-lg font-semibold ${stats.pendingAlerts > 0 ? "text-red-600" : ""}`}>{stats.pendingAlerts}</p>
                  <p className="text-xs text-neutral-400">Bilik tak dijual: {stats.notSellable}</p>
                </Link>
              </div>
            </>
          )}

          {/* Pautan pantas */}
          <h2 className="mt-8 font-medium">Pautan pantas</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Link href="/dashboard/bilik" className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm hover:border-neutral-400">Bilik</Link>
            <Link href="/dashboard/stok" className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm hover:border-neutral-400">Stok</Link>
            <Link href="/dashboard/report" className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm hover:border-neutral-400">Report</Link>
            <Link href="/dashboard/jadual" className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm hover:border-neutral-400">Jadual Syif</Link>
            <Link href="/dashboard/cuti" className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm hover:border-neutral-400">Cuti</Link>
            <Link href="/dashboard/kehadiran" className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm hover:border-neutral-400">Kehadiran</Link>
          </div>
        </>
      )}

      {/* Modal tukar kata laluan */}
      {showPw && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowPw(false)}>
          <form onSubmit={changePassword} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-3">
            <h2 className="font-medium">Tukar Kata Laluan</h2>
            <input
              type="password"
              placeholder="Kata laluan lama"
              value={pwForm.old_password}
              onChange={(e) => setPwForm({ ...pwForm, old_password: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              required
            />
            <input
              type="password"
              placeholder="Kata laluan baru (min 6)"
              value={pwForm.new_password}
              onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              minLength={6}
              required
            />
            <input
              type="password"
              placeholder="Sahkan kata laluan baru"
              value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              minLength={6}
              required
            />
            {pwMsg && <p className={`text-sm ${pwMsg.includes("berjaya") ? "text-green-600" : "text-red-600"}`}>{pwMsg}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 rounded-lg bg-neutral-900 py-2.5 text-sm text-white">Simpan</button>
              <button type="button" onClick={() => setShowPw(false)} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm">Batal</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
