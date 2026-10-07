import webpush from "web-push";
import { readAll } from "./sheets";
import { SHEETS } from "./constants";

let configured = false;
function ensureVapid() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:admin@wh-management.local", pub, priv);
  configured = true;
  return true;
}

// Hantar push notification kepada seorang staff (semua peranti dia)
export async function notifyStaff(staffId: string, title: string, body: string, url = "/dashboard"): Promise<void> {
  if (!ensureVapid()) return;
  try {
    const subs = await readAll<Record<string, string>>(SHEETS.PUSH_SUBSCRIPTIONS);
    const mine = subs.filter((s) => s.staff_id === staffId);
    const payload = JSON.stringify({ title, body, url });
    await Promise.allSettled(
      mine.map((s) => {
        const keys = JSON.parse(s.keys_json);
        return webpush.sendNotification({ endpoint: s.endpoint, keys }, payload);
      })
    );
  } catch (e) {
    console.error("Push gagal:", e);
  }
}

// Hantar push kepada semua admin dan supervisor
export async function notifyPrivileged(title: string, body: string, url = "/dashboard"): Promise<void> {
  try {
    const staff = await readAll<Record<string, string>>(SHEETS.STAFF);
    const targets = staff.filter((s) => (s.role === "admin" || s.role === "supervisor") && s.is_active === "true");
    await Promise.allSettled(targets.map((t) => notifyStaff(t.id, title, body, url)));
  } catch (e) {
    console.error("Push privileged gagal:", e);
  }
}

// Hantar mesej Telegram (kalau staff ada telegram_chat_id)
export async function notifyTelegram(staffId: string, message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const staff = await readAll<Record<string, string>>(SHEETS.STAFF);
    const user = staff.find((s) => s.id === staffId);
    const chatId = user?.telegram_chat_id;
    if (!chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
  } catch (e) {
    console.error("Telegram gagal:", e);
  }
}
