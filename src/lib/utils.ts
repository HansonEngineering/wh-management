export function genId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function todayMY(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuching",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function timeMY(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuching",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function toBool(v: string): boolean {
  return v === "true" || v === "TRUE" || v === "1";
}

export function toNum(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
