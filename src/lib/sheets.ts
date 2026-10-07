import { google } from "googleapis";
import { SHEET_HEADERS } from "./constants";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL atau GOOGLE_PRIVATE_KEY belum diset");
  }
  return new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID belum diset");
  return id;
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
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: rangeFor(tab),
  });
  const rows = res.data.values ?? [];
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h));
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = cellToString(row[i]);
    });
    return obj as unknown as T;
  });
}

// Cari nombor baris (1-based dalam sheet) ikut nilai kolum id
export async function findRowById(tab: string, id: string): Promise<number> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `'${tab}'!A:A`,
  });
  const rows = res.data.values ?? [];
  for (let i = 1; i < rows.length; i++) {
    if (cellToString(rows[i][0]) === id) return i + 1;
  }
  return -1;
}

// Tambah baris baru
export async function appendRow(tab: string, obj: Record<string, unknown>): Promise<void> {
  const headers = SHEET_HEADERS[tab];
  const sheets = getSheets();
  const values = [headers.map((h) => (obj[h] === undefined || obj[h] === null ? "" : String(obj[h])))];
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: `'${tab}'!A:A`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

// Kemas kini baris sedia ada ikut id
export async function updateRow(tab: string, id: string, obj: Record<string, unknown>): Promise<boolean> {
  const rowNum = await findRowById(tab, id);
  if (rowNum < 0) return false;
  const headers = SHEET_HEADERS[tab];
  const sheets = getSheets();

  // Baca baris sedia ada supaya kolum yang tak dihantar kekal
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `'${tab}'!A${rowNum}:${colLetter(headers.length - 1)}${rowNum}`,
  });
  const current = existing.data.values?.[0] ?? [];
  const merged = headers.map((h, i) => {
    if (obj[h] !== undefined) return obj[h] === null ? "" : String(obj[h]);
    return cellToString(current[i]);
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `'${tab}'!A${rowNum}:${colLetter(headers.length - 1)}${rowNum}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [merged] },
  });
  return true;
}

// Padam baris ikut id
export async function deleteRow(tab: string, id: string): Promise<boolean> {
  const rowNum = await findRowById(tab, id);
  if (rowNum < 0) return false;
  const sheets = getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: getSpreadsheetId() });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === tab);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      requests: [
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
      ],
    },
  });
  return true;
}

// Cipta semua tab dan header (diguna semasa setup awal)
export async function initializeSpreadsheet(): Promise<{ created: string[]; existing: string[] }> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title ?? ""));

  const created: string[] = [];
  const existing: string[] = [];
  const toCreate = Object.keys(SHEET_HEADERS).filter((t) => !existingTitles.has(t));

  if (toCreate.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: toCreate.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
    created.push(...toCreate);
  }
  Object.keys(SHEET_HEADERS).forEach((t) => {
    if (existingTitles.has(t)) existing.push(t);
  });

  // Tulis header untuk setiap tab
  for (const [tab, headers] of Object.entries(SHEET_HEADERS)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tab}'!A1:${colLetter(headers.length - 1)}1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
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
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `'Settings'!A:A`,
    });
    const col = res.data.values ?? [];
    let rowNum = -1;
    for (let i = 1; i < col.length; i++) {
      if (String(col[i][0]) === key) {
        rowNum = i + 1;
        break;
      }
    }
    if (rowNum > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: getSpreadsheetId(),
        range: `'Settings'!B${rowNum}:D${rowNum}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[value, description ?? "", now]] },
      });
    }
  } else {
    await appendRow("Settings", { key, value, description: description ?? "", updated_at: now });
  }
}
