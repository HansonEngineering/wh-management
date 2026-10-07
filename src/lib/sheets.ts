import * as jose from "jose";
import { SHEET_HEADERS } from "./constants";

// Lapisan Google Sheets menggunakan REST API terus (fetch + JWT service account).
// Versi ini serasi dengan Cloudflare Workers — tiada googleapis/gaxios.

const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

let cachedToken: { token: string; exp: number } | null = null;

function getCredentials() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL atau GOOGLE_PRIVATE_KEY belum diset");
  }
  return { email, key: key.replace(/\\n/g, "\n") };
}

export function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID belum diset");
  return id;
}

// Dapatkan access token OAuth2 melalui aliran JWT bearer (service account)
async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.token;

  const { email, key } = getCredentials();
  const privateKey = await jose.importPKCS8(key, "RS256");
  const assertion = await new jose.SignJWT({ scope: SCOPES })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(email)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(`Google token gagal: ${data.error ?? res.status} ${data.error_description ?? ""}`);
  }
  cachedToken = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return data.access_token;
}

// Panggilan asas ke Sheets API
async function apiFetch(path: string, init?: RequestInit): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/${getSpreadsheetId()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Sheets API ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function valuesGet(range: string): Promise<any> {
  return apiFetch(`/values/${encodeURIComponent(range)}`);
}

function valuesAppend(range: string, values: string[][]): Promise<any> {
  return apiFetch(`/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values }),
  });
}

function valuesUpdate(range: string, values: string[][], inputOption: "RAW" | "USER_ENTERED" = "USER_ENTERED"): Promise<any> {
  return apiFetch(`/values/${encodeURIComponent(range)}?valueInputOption=${inputOption}`, {
    method: "PUT",
    body: JSON.stringify({ values }),
  });
}

function batchUpdate(requests: unknown[]): Promise<any> {
  return apiFetch(`:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });
}

// Tukar nombor kolum (0-based) kepada huruf A, B, ... Z, AA, AB
function colLetter(index: number): string {
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function rangeFor(tab: string): string {
  const headers = SHEET_HEADERS[tab];
  if (!headers) throw new Error(`Tab tidak dikenali: ${tab}`);
  return `'${tab}'!A:${colLetter(headers.length - 1)}`;
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

// Baca semua baris sebagai objek, ikut header
export async function readAll<T extends Record<string, unknown>>(tab: string): Promise<T[]> {
  const res = await valuesGet(rangeFor(tab));
  const rows = res.values ?? [];
  if (rows.length < 2) return [];
  const headers = rows[0].map((h: unknown) => String(h));
  return rows.slice(1).map((row: unknown[]) => {
    const obj: Record<string, string> = {};
    headers.forEach((h: string, i: number) => {
      obj[h] = cellToString(row[i]);
    });
    return obj as unknown as T;
  });
}

// Cari nombor baris (1-based dalam sheet) ikut nilai kolum id
export async function findRowById(tab: string, id: string): Promise<number> {
  const res = await valuesGet(`'${tab}'!A:A`);
  const rows = res.values ?? [];
  for (let i = 1; i < rows.length; i++) {
    if (cellToString(rows[i][0]) === id) return i + 1;
  }
  return -1;
}

// Tambah baris baru
export async function appendRow(tab: string, obj: Record<string, unknown>): Promise<void> {
  const headers = SHEET_HEADERS[tab];
  const values = [headers.map((h) => (obj[h] === undefined || obj[h] === null ? "" : String(obj[h])))];
  await valuesAppend(`'${tab}'!A:A`, values);
}

// Kemas kini baris sedia ada ikut id
export async function updateRow(tab: string, id: string, obj: Record<string, unknown>): Promise<boolean> {
  const rowNum = await findRowById(tab, id);
  if (rowNum < 0) return false;
  const headers = SHEET_HEADERS[tab];

  // Baca baris sedia ada supaya kolum yang tak dihantar kekal
  const existing = await valuesGet(`'${tab}'!A${rowNum}:${colLetter(headers.length - 1)}${rowNum}`);
  const current = existing.values?.[0] ?? [];
  const merged = headers.map((h, i) => {
    if (obj[h] !== undefined) return obj[h] === null ? "" : String(obj[h]);
    return cellToString(current[i]);
  });

  await valuesUpdate(`'${tab}'!A${rowNum}:${colLetter(headers.length - 1)}${rowNum}`, [merged]);
  return true;
}

// Padam baris ikut id
export async function deleteRow(tab: string, id: string): Promise<boolean> {
  const rowNum = await findRowById(tab, id);
  if (rowNum < 0) return false;
  const meta = await apiFetch("");
  const sheet = (meta.sheets ?? []).find((s: any) => s.properties?.title === tab);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) return false;

  await batchUpdate([
    {
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: rowNum - 1,
          endIndex: rowNum,
        },
      },
    },
  ]);
  return true;
}

// Cipta semua tab dan header (diguna semasa setup awal)
export async function initializeSpreadsheet(): Promise<{ created: string[]; existing: string[] }> {
  const meta = await apiFetch("");
  const existingTitles = new Set((meta.sheets ?? []).map((s: any) => s.properties?.title ?? ""));

  const created: string[] = [];
  const existing: string[] = [];
  const toCreate = Object.keys(SHEET_HEADERS).filter((t) => !existingTitles.has(t));

  if (toCreate.length > 0) {
    await batchUpdate(toCreate.map((title) => ({ addSheet: { properties: { title } } })));
    created.push(...toCreate);
  }
  Object.keys(SHEET_HEADERS).forEach((t) => {
    if (existingTitles.has(t)) existing.push(t);
  });

  // Tulis header untuk setiap tab
  for (const [tab, headers] of Object.entries(SHEET_HEADERS)) {
    await valuesUpdate(`'${tab}'!A1:${colLetter(headers.length - 1)}1`, [headers], "RAW");
  }

  return { created, existing };
}

// Baca satu setting
export async function getSetting(key: string): Promise<string> {
  const rows = await readAll<{ key: string; value: string }>("Settings");
  const row = rows.find((r) => r.key === key);
  return row?.value ?? "";
}

// Baca semua settings sebagai objek
export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await readAll<{ key: string; value: string }>("Settings");
  const out: Record<string, string> = {};
  rows.forEach((r) => {
    out[r.key] = r.value;
  });
  return out;
}

// Set satu setting (cari ikut kolum key, bukan kolum id)
export async function setSetting(key: string, value: string, description?: string): Promise<void> {
  const rows = await readAll<{ key: string }>("Settings");
  const exists = rows.some((r) => r.key === key);
  const now = new Date().toISOString();
  if (exists) {
    const res = await valuesGet(`'Settings'!A:A`);
    const col = res.values ?? [];
    let rowNum = -1;
    for (let i = 1; i < col.length; i++) {
      if (String(col[i][0]) === key) {
        rowNum = i + 1;
        break;
      }
    }
    if (rowNum > 0) {
      await valuesUpdate(`'Settings'!B${rowNum}:D${rowNum}`, [[value, description ?? "", now]]);
    }
  } else {
    await appendRow("Settings", { key, value, description: description ?? "", updated_at: now });
  }
}
