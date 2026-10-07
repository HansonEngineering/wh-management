import { appendRow } from "./sheets";
import { SHEETS } from "./constants";
import { genId, nowISO } from "./utils";

export async function logAudit(
  staffId: string,
  action: string,
  entity: string,
  entityId: string,
  details: string
): Promise<void> {
  try {
    await appendRow(SHEETS.AUDIT_LOG, {
      id: genId("log"),
      staff_id: staffId,
      action,
      entity,
      entity_id: entityId,
      details,
      created_at: nowISO(),
    });
  } catch (e) {
    console.error("Gagal tulis audit log:", e);
  }
}
