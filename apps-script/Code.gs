/**
 * WH Management — Google Apps Script
 *
 * Cara guna:
 * 1. Buka Google Sheet "WH Management DB".
 * 2. Extensions > Apps Script.
 * 3. Padam kandungan default, tampal fail ini.
 * 4. Isi CONFIG di bawah (Exely client_id/secret, property ID).
 * 5. Simpan, kemudian jalankan fungsi setupTriggers() sekali.
 *
 * Fungsi automatik:
 * - syncExelyCheckouts(): setiap 5 minit, tarik bilik check-out dan cipta tugas housekeeping.
 * - dailyStockCheck(): setiap malam, banding MaxSO/LNB dengan TotalSO dan cipta alert.
 * - markAbsents(): setiap malam, tandakan staff yang tidak hadir.
 */

// ===================== CONFIG (ISI DI SINI) =====================
const CONFIG = {
  // Dicipta di Exely extranet: Property settings > API connections
  EXELY_CLIENT_ID: "api_connection_04e9c_51649927b1",
  EXELY_CLIENT_SECRET: "8fZJL8Lajot2RWW3fzlWGIMKaLsiAOnd",
  EXELY_PROPERTY_ID: "503620", // WARISAN HOTEL
  // Masa semakan harian (24 jam, waktu Malaysia)
  DAILY_CHECK_HOUR: 23,
  DAILY_CHECK_MINUTE: 30,
};

// Nama tab (mesti sama dengan app)
const TAB = {
  ROOMS: "Rooms",
  ROOM_TYPES: "RoomTypes",
  ITEMS: "Items",
  MAXSO: "RoomTypeMaxSO",
  MOVEMENTS: "StockMovements",
  ALERTS: "StockAlerts",
  ROOM_STATUSES: "RoomStatuses",
  HK_TASKS: "HousekeepingTasks",
  STAFF: "Staff",
  SCHEDULES: "Schedules",
  ATTENDANCE: "Attendance",
  SETTINGS: "Settings",
  GUEST_REQUESTS: "GuestRequests",
};

// ===================== UTIL =====================
function ss() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet(name) {
  return ss().getSheetByName(name);
}

function readTable(name) {
  const sh = sheet(name);
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i]));
    return obj;
  });
}

function appendRow(name, obj) {
  const sh = sheet(name);
  if (!sh) return;
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const row = headers.map((h) => (obj[h] === undefined ? "" : obj[h]));
  sh.appendRow(row);
}

function todayMY() {
  return Utilities.formatDate(new Date(), "Asia/Kuching", "yyyy-MM-dd");
}

function nowISO() {
  return new Date().toISOString();
}

function genId(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getSetting(key) {
  const rows = readTable(TAB.SETTINGS);
  const row = rows.find((r) => r.key === key);
  return row ? row.value : "";
}

// ===================== EXELY =====================
function exelyToken() {
  const url = "https://connect.hopenapi.com/auth/token";
  const payload = {
    grant_type: "client_credentials",
    client_id: CONFIG.EXELY_CLIENT_ID,
    client_secret: CONFIG.EXELY_CLIENT_SECRET,
  };
  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: Object.keys(payload).map((k) => k + "=" + encodeURIComponent(payload[k])).join("&"),
    muteHttpExceptions: true,
  });
  const json = JSON.parse(res.getContentText());
  return json.access_token;
}

// Tarik booking yang check-out hari ini.
// Pulangkan array: { roomNumber, roomTypeName, guestName, bookingNumber }
//
// Dua peringkat:
// 1) PMS API (utama) — ada nombor bilik fizikal (roomId -> displayName).
//    PERINGATAN: perlu diaktifkan oleh Exely support ("Access to Exely PMS External API").
// 2) Read Reservation API (sandaran) — tiada nombor bilik, hanya jenis bilik.
//    Bilik hanya diisi jika TEPAT SATU bilik padan dengan jenis bilik itu.
function fetchTodayCheckouts() {
  if (!CONFIG.EXELY_CLIENT_ID) return [];
  const token = exelyToken();
  const today = todayMY();

  // ---- Peringkat 1: PMS API ----
  try {
    const pms = fetchCheckoutsViaPmsApi_(token, today);
    if (pms !== null) return pms; // berjaya (mungkin array kosong)
  } catch (e) {
    console.warn("PMS API gagal (mungkin belum diaktifkan Exely): " + e);
  }

  // ---- Peringkat 2: Read Reservation API (sandaran) ----
  try {
    return fetchCheckoutsViaReadApi_(token, today);
  } catch (e) {
    console.error("Read Reservation API gagal:", e);
    return [];
  }
}

// PMS API: cari tempahan aktif yang menjejaskan hari ini, tapis checkOutDateTime == hari ini.
// Pulang null jika API gagal (supaya sandaran digunakan).
function fetchCheckoutsViaPmsApi_(token, today) {
  const base = "https://connect.hopenapi.com/api/pms/v2/properties/" + CONFIG.EXELY_PROPERTY_ID;

  // Peta roomId -> displayName (nombor bilik)
  const roomsRes = UrlFetchApp.fetch(base + "/rooms?maxPageSize=100", {
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true,
  });
  if (roomsRes.getResponseCode() !== 200) {
    console.warn("PMS /rooms status " + roomsRes.getResponseCode());
    return null;
  }
  const roomsJson = JSON.parse(roomsRes.getContentText());
  const roomNameById = {};
  (roomsJson.rooms || []).forEach((r) => (roomNameById[r.id] = r.displayName));

  // Cari tempahan yang stay-nya menyentuh hari ini
  const url = base + "/reservations/search?state=Active" +
    "&startAffectPeriodDateTime=" + today + "T00:00" +
    "&endAffectPeriodDateTime=" + today + "T23:59" +
    "&maxPageSize=100";
  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    console.warn("PMS reservations/search status " + res.getResponseCode());
    return null;
  }
  const json = JSON.parse(res.getContentText());
  const out = [];
  (json.reservations || []).forEach((rv) => {
    const guestName = rv.customer ? String(rv.customer).trim() : "";
    (rv.roomStays || []).forEach((rs) => {
      const co = String(rs.actualCheckOutDateTime || rs.checkOutDateTime || "");
      if (co.slice(0, 10) !== today) return;
      const roomNumber = roomNameById[rs.roomId] || "";
      out.push({
        roomNumber: roomNumber,
        roomTypeName: "",
        guestName: guestName,
        bookingNumber: rv.number || "",
      });
    });
  });
  return out;
}

// Read Reservation API (sandaran): tiada nombor bilik — hanya jenis bilik.
function fetchCheckoutsViaReadApi_(token, today) {
  const base = "https://connect.hopenapi.com/api/read-reservation/v1/properties/" + CONFIG.EXELY_PROPERTY_ID;
  const since = Utilities.formatDate(new Date(Date.now() - 48 * 3600 * 1000), "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'");
  const listRes = UrlFetchApp.fetch(base + "/bookings?lastModification=" + encodeURIComponent(since), {
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true,
  });
  if (listRes.getResponseCode() !== 200) {
    throw new Error("Read API list status " + listRes.getResponseCode());
  }
  const list = JSON.parse(listRes.getContentText());
  const summaries = (list.bookingSummaries || []).filter((b) => b.status !== "Cancelled");
  const out = [];
  summaries.slice(0, 50).forEach((b) => {
    const detRes = UrlFetchApp.fetch(base + "/bookings/" + encodeURIComponent(b.number), {
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true,
    });
    if (detRes.getResponseCode() !== 200) return;
    const det = JSON.parse(detRes.getContentText());
    const booking = det.booking || det;
    (booking.roomStays || []).forEach((rs) => {
      const co = String((rs.stayDates && rs.stayDates.departureDateTime) || "");
      if (co.slice(0, 10) !== today) return;
      const guest = (rs.guests && rs.guests[0]) || {};
      out.push({
        roomNumber: "", // tiada dalam API ini
        roomTypeName: (rs.roomType && rs.roomType.name) || "",
        guestName: (guest.firstName + " " + (guest.lastName || "")).trim(),
        bookingNumber: booking.number || b.number,
      });
    });
  });
  return out;
}

// ===================== SYNC CHECKOUT -> HOUSEKEEPING =====================
function syncExelyCheckouts() {
  const enabled = getSetting("exely_enabled");
  if (enabled !== "true") return;

  const checkouts = fetchTodayCheckouts();
  if (checkouts.length === 0) return;

  const rooms = readTable(TAB.ROOMS);
  const tasks = readTable(TAB.HK_TASKS);
  const statuses = readTable(TAB.ROOM_STATUSES);
  const today = todayMY();

  checkouts.forEach((booking) => {
    let room = null;

    if (booking.roomNumber) {
      // PMS API: nombor bilik terus
      room = rooms.find((r) => String(r.room_number) === String(booking.roomNumber));
    } else if (booking.roomTypeName) {
      // Sandaran: padan ikut jenis bilik — hanya jika TEPAT SATU bilik jenis itu
      const matches = rooms.filter((r) => String(r.room_type || "").toLowerCase() === String(booking.roomTypeName).toLowerCase());
      if (matches.length === 1) room = matches[0];
      else console.warn("Langkau booking " + booking.bookingNumber + ": jenis bilik '" + booking.roomTypeName + "' padan " + matches.length + " bilik");
    }
    if (!room) return;

    // Elak pendua
    const exists = tasks.some((t) => t.room_id === room.id && t.date === today && t.status !== "done");
    if (exists) return;

    // Cipta tugas housekeeping
    appendRow(TAB.HK_TASKS, {
      id: genId("hk"),
      date: today,
      room_id: room.id,
      assigned_to: "",
      checklist_json: "[]",
      status: "pending",
      started_at: "",
      submitted_by: "",
      submitted_at: "",
      created_at: nowISO(),
    });

    // Kemas kini status bilik
    const st = statuses.find((s) => s.room_id === room.id && s.date === today);
    if (st) {
      // update sedia ada
      const sh = sheet(TAB.ROOM_STATUSES);
      const data = sh.getDataRange().getValues();
      const headers = data[0];
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === st.id) {
          const row = headers.map((h) => {
            if (h === "is_lnb") return "true";
            if (h === "cleaning_status") return "pending_clean";
            if (h === "updated_at") return nowISO();
            return data[i][headers.indexOf(h)];
          });
          sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
          break;
        }
      }
    } else {
      appendRow(TAB.ROOM_STATUSES, {
        id: genId("rs"),
        date: today,
        room_id: room.id,
        is_lnb: "true",
        cleaning_status: "pending_clean",
        sellable: "true",
        notes: "Check-out Exely" + (booking.guestName ? " - " + booking.guestName : "") + (booking.bookingNumber ? " (#" + booking.bookingNumber + ")" : ""),
        updated_at: nowISO(),
      });
    }
  });
}

// ===================== DAILY STOCK CHECK =====================
function dailyStockCheck() {
  const today = todayMY();
  const items = readTable(TAB.ITEMS).filter((i) => i.is_tracked === "true" || i.is_tracked === true);
  const maxso = readTable(TAB.MAXSO);
  const movements = readTable(TAB.MOVEMENTS);
  const statuses = readTable(TAB.ROOM_STATUSES);
  const rooms = readTable(TAB.ROOMS);
  const guestRequests = readTable(TAB.GUEST_REQUESTS);

  // Bilik LNB hari ini
  const lnbRoomIds = statuses.filter((s) => s.date === today && (s.is_lnb === "true" || s.is_lnb === true)).map((s) => s.room_id);

  items.forEach((item) => {
    // Had = jumlah MaxSO setiap bilik LNB ikut jenis bilik
    let expectedMax = 0;
    lnbRoomIds.forEach((roomId) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return;
      const rule = maxso.find((m) => m.room_type_id === room.room_type_id && m.item_id === item.id);
      if (rule) expectedMax += Number(rule.max_so) || 0;
    });

    // Total SO hari ini
    const totalSO = movements
      .filter((m) => m.date === today && m.item_id === item.id && m.movement_type === "OUT")
      .reduce((sum, m) => sum + (Number(m.qty) || 0), 0);

    const variance = expectedMax - totalSO;

    if (variance < 0) {
      // Nota permintaan tambahan
      const gr = guestRequests.filter((g) => g.date === today && g.item_id === item.id && g.status !== "rejected");
      let note = "";
      if (gr.length > 0) {
        const total = gr.reduce((s, g) => s + (Number(g.qty) || 0), 0);
        note = total + " permintaan tambahan direkod hari ini.";
      }

      appendRow(TAB.ALERTS, {
        id: genId("al"),
        date: today,
        item_id: item.id,
        responsible_staff_id: item.responsible_staff_id || "",
        expected_max: expectedMax,
        total_so: totalSO,
        variance: variance,
        guest_requests_note: note,
        status: "pending_decision",
        decided_by: "",
        decision_notes: "",
        created_at: nowISO(),
        updated_at: nowISO(),
      });
    }
  });
}

// ===================== MARK ABSENTS =====================
function markAbsents() {
  const today = todayMY();
  const staff = readTable(TAB.STAFF).filter((s) => s.is_active === "true" || s.is_active === true);
  const schedules = readTable(TAB.SCHEDULES);
  const attendance = readTable(TAB.ATTENDANCE);

  staff.forEach((s) => {
    const sched = schedules.find((x) => x.staff_id === s.id && x.date === today);
    if (!sched || sched.shift_id === "OFF" || sched.shift_id === "CUTI") return;

    const hasAtt = attendance.some((a) => a.staff_id === s.id && a.date === today);
    if (hasAtt) return;

    // Semak sama ada ada permohonan cuti yang diluluskan
    appendRow(TAB.ATTENDANCE, {
      id: genId("att"),
      staff_id: s.id,
      date: today,
      clock_in: "",
      clock_out: "",
      shift_id: sched.shift_id,
      status: "absent_no_notice",
      late_minutes: "0",
      ot_hours: "0",
      notes: "Ditandakan automatik oleh system",
      created_at: nowISO(),
      updated_at: nowISO(),
    });
  });
}

// ===================== TRIGGERS =====================
function setupTriggers() {
  // Padam trigger lama
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));

  // Sync Exely setiap 5 minit
  ScriptApp.newTrigger("syncExelyCheckouts").timeBased().everyMinutes(5).create();

  // Semakan harian + tandakan tidak hadir
  ScriptApp.newTrigger("dailyStockCheck").timeBased().atHour(CONFIG.DAILY_CHECK_HOUR).nearMinute(CONFIG.DAILY_CHECK_MINUTE).everyDays(1).create();
  ScriptApp.newTrigger("markAbsents").timeBased().atHour(CONFIG.DAILY_CHECK_HOUR).nearMinute(CONFIG.DAILY_CHECK_MINUTE + 5).everyDays(1).create();

  SpreadsheetApp.getUi().alert("Triggers telah disetup.");
}

// ===================== UJIAN MANUAL =====================
function testDailyCheck() {
  dailyStockCheck();
  SpreadsheetApp.getUi().alert("Semakan harian selesai. Semak tab StockAlerts.");
}

function testSync() {
  syncExelyCheckouts();
  SpreadsheetApp.getUi().alert("Sync selesai. Semak tab HousekeepingTasks.");
}

// Uji sambungan Exely — buka View > Logs selepas run untuk tengok hasil
function testExely() {
  try {
    const token = exelyToken();
    console.log("Token OK: " + token.slice(0, 20) + "...");

    // Uji PMS API
    const base = "https://connect.hopenapi.com/api/pms/v2/properties/" + CONFIG.EXELY_PROPERTY_ID;
    const roomsRes = UrlFetchApp.fetch(base + "/rooms?maxPageSize=100", {
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true,
    });
    console.log("PMS /rooms status: " + roomsRes.getResponseCode());
    console.log("PMS /rooms body (500 aksara pertama): " + roomsRes.getContentText().slice(0, 500));

    // Uji Read Reservation API
    const readBase = "https://connect.hopenapi.com/api/read-reservation/v1/properties/" + CONFIG.EXELY_PROPERTY_ID;
    const since = Utilities.formatDate(new Date(Date.now() - 48 * 3600 * 1000), "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'");
    const listRes = UrlFetchApp.fetch(readBase + "/bookings?lastModification=" + encodeURIComponent(since), {
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true,
    });
    console.log("Read API /bookings status: " + listRes.getResponseCode());
    console.log("Read API /bookings body (500 aksara pertama): " + listRes.getContentText().slice(0, 500));

    // Uji fetch penuh
    const checkouts = fetchTodayCheckouts();
    console.log("Check-out hari ini: " + JSON.stringify(checkouts));
  } catch (e) {
    console.error("testExely gagal: " + e);
  }
}
