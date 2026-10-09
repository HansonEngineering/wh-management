/*
 * ============================================================================
 * WH MANAGEMENT — PERANTI STOR (ESP32)
 * WARISAN HOTEL
 * ============================================================================
 * Fungsi:
 *   1. Imbas kad RFID -> hantar ke app -> buka pintu maglock kalau berdaftar
 *   2. LCD papar nama staff + timer submit
 *   3. DUA buzzer berbunyi sekali (pintu stor + kaunter) kalau timer tamat
 *      tapi staff belum submit dalam app
 *   4. Butang 1 / sensor pintu -> beritahu app bila pintu ditutup
 *   5. Butang 2 EXIT di dalam stor -> buka pintu (admin / kecemasan)
 *   6. Mod offline: kalau WiFi putus, kad dalam senarai OFFLINE_CARDS tetap
 *      boleh buka pintu
 *
 * Library yang perlu dipasang (Arduino IDE -> Sketch -> Manage Libraries):
 *   - "MFRC522" oleh GithubCommunity
 *   - "LiquidCrystal I2C" oleh Frank de Brabander
 *   - "ArduinoJson" oleh Benoit Blanchon (versi 7.x)
 *   - Board: "ESP32" oleh Espressif (dari Boards Manager)
 * ============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

// ===================== KONFIGURASI — UBAH DI SINI =====================

// WiFi hotel
const char* WIFI_SSID     = "Warisan 2.4GHz";
const char* WIFI_PASSWORD = "Warisan004004";

// Alamat app (Cloudflare Workers)
const char* API_BASE = "https://wh-management.hansonglenn01.workers.dev";

// Kunci peranti — MESTI sama dengan DEVICE_API_KEY dalam Cloudflare/.env.local
const char* DEVICE_API_KEY = "78ee05b0294c0b22e2c6e6d1735c2bdd9d4c2de0937feb6d";

// Kad yang dibenarkan buka pintu walau WiFi putus (mod kecemasan).
// Isi UID kad admin/manager di sini. Format: "AA BB CC DD"
const char* OFFLINE_CARDS[] = {
  // "AA BB CC DD",
};
const int OFFLINE_CARDS_COUNT = 0;  // tukar ikut bilangan kad di atas

// ===================== PIN (jangan ubah kalau ikut wiring standard) =========
// RFID RC522 (SPI)
#define PIN_RFID_SS    5
#define PIN_RFID_RST   33   // NOTA: README lama tulis 22 — itu konflik dengan LCD SCL
#define PIN_RFID_SCK   18
#define PIN_RFID_MOSI  23
#define PIN_RFID_MISO  19
// LCD 1602 I2C
#define PIN_LCD_SDA    21
#define PIN_LCD_SCL    22
// Lain-lain
#define PIN_RELAY           26   // relay maglock — IN1 pada modul 4-channel
#define PIN_BUZZER_STOR     27   // buzzer PASIF di pintu stor
#define PIN_BUZZER_COUNTER  14   // buzzer PASIF di kaunter (berbunyi sama masa)
#define BUZZ_FREQ           2700 // Hz — sesuai buzzer pasif
#define BUZZ_RES            8
#define PIN_DOOR            25   // Butang 1 / reed switch (INPUT_PULLUP, LOW = pintu tutup)
#define PIN_EXIT_BTN        32   // Butang 2 EXIT dalam stor (INPUT_PULLUP, LOW = ditekan)

// Modul 4-channel (Songle) hampir semua LOW-level trigger: IN LOW = relay ON.
// Kalau maglock TERBUKA masa idle (patut berkunci), tukar kepada false.
const bool RELAY_ACTIVE_LOW = true;

// ===================== TETAPAN MASA =========================================
const unsigned long UNLOCK_MS       = 5000;   // maglock terbuka 5 saat
const unsigned long POLL_SESSION_MS = 5000;   // semak status submit setiap 5s
const unsigned long WIFI_RETRY_MS   = 10000;  // cuba semula WiFi setiap 10s

// ===================== OBJEK =================================================
MFRC522 rfid(PIN_RFID_SS, PIN_RFID_RST);
LiquidCrystal_I2C lcd(0x27, 16, 2);   // kalau LCD tidak papar apa-apa, cuba 0x3F
WiFiClientSecure secureClient;

// ===================== KEADAAN ==============================================
bool sessionActive = false;
unsigned long sessionDeadline = 0;    // masa submit_deadline (millis anggaran)
unsigned long lastPoll = 0;
unsigned long lastWifiTry = 0;
bool alarmOn = false;
bool sirenOn = false;
bool sirenHigh = false;
unsigned long lastSirenFlip = 0;
bool waitingStorFree = false;
int lastDoorState = HIGH;
unsigned long lastDoorChange = 0;
unsigned long lastHeartbeat = 0;
bool rfidOk = false;
unsigned long unlockUntil = 0;
unsigned long beepUntil = 0;
unsigned long lastCardMs = 0;
String lastCardUid = "";

#define CACHE_MAX 40
String cacheUid[CACHE_MAX];
String cacheName[CACHE_MAX];
int cacheCount = 0;

// ===================== UTILITI ==============================================
void lcdMsg(const String& line1, const String& line2 = "") {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(line1.substring(0, 16));
  lcd.setCursor(0, 1); lcd.print(line2.substring(0, 16));
}

void buzzersInit() {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(PIN_BUZZER_STOR, BUZZ_FREQ, BUZZ_RES);
  ledcAttach(PIN_BUZZER_COUNTER, BUZZ_FREQ, BUZZ_RES);
#else
  ledcSetup(0, BUZZ_FREQ, BUZZ_RES);
  ledcAttachPin(PIN_BUZZER_STOR, 0);
  ledcSetup(1, BUZZ_FREQ, BUZZ_RES);
  ledcAttachPin(PIN_BUZZER_COUNTER, 1);
#endif
}

void buzzersTone(int freq) {
  if (freq <= 0) {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcWrite(PIN_BUZZER_STOR, 0);
    ledcWrite(PIN_BUZZER_COUNTER, 0);
#else
    ledcWriteTone(0, 0);
    ledcWriteTone(1, 0);
#endif
    return;
  }
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcChangeFrequency(PIN_BUZZER_STOR, freq, BUZZ_RES);
  ledcChangeFrequency(PIN_BUZZER_COUNTER, freq, BUZZ_RES);
  ledcWrite(PIN_BUZZER_STOR, 128);
  ledcWrite(PIN_BUZZER_COUNTER, 128);
#else
  ledcWriteTone(0, freq);
  ledcWriteTone(1, freq);
#endif
}

void stopSiren() {
  sirenOn = false;
  alarmOn = false;
  waitingStorFree = false;
  buzzersTone(0);
}

void startSiren() {
  sirenOn = true;
  sirenHigh = true;
  lastSirenFlip = millis();
  buzzersTone(2400);  // mula "nii"
}

void startOkBeep() {
  stopSiren();
  buzzersTone(2700);
  beepUntil = millis() + 1000;
}

void startUnlock() {
  relayUnlock();
  unlockUntil = millis() + UNLOCK_MS;
}

void handleTimedOutputs() {
  if (beepUntil && millis() >= beepUntil) {
    beepUntil = 0;
    if (!sirenOn) buzzersTone(0);
  }
  if (unlockUntil && millis() >= unlockUntil) {
    unlockUntil = 0;
    relayLock();
  }
}

String compactUid(const String& u) {
  String s = u;
  s.toUpperCase();
  s.replace(" ", "");
  return s;
}

int cacheFind(const String& uid) {
  String c = compactUid(uid);
  for (int i = 0; i < cacheCount; i++) {
    if (compactUid(cacheUid[i]) == c) return i;
  }
  return -1;
}

void cachePut(const String& uid, const String& name) {
  int i = cacheFind(uid);
  if (i >= 0) {
    cacheName[i] = name;
    return;
  }
  if (cacheCount >= CACHE_MAX) return;
  cacheUid[cacheCount] = uid;
  cacheName[cacheCount] = name;
  cacheCount++;
}

void loadCardCache() {
  String resp;
  int code = getJson("/api/stor/cards", resp);
  if (code != 200) {
    Serial.println("Cache kad: gagal muat dari server");
    return;
  }
  JsonDocument doc;
  if (deserializeJson(doc, resp) != DeserializationError::Ok || !doc["ok"]) return;
  JsonArray arr = doc["cards"].as<JsonArray>();
  for (JsonObject o : arr) {
    cachePut(String((const char*)(o["rfid_uid"] | "")), String((const char*)(o["name"] | "Staff")));
  }
  Serial.print("Cache kad: ");
  Serial.print(cacheCount);
  Serial.println(" kad");
}

// 2) Kad tidak dikenali: titititit 2 saat
void playDeniedBeep() {
  stopSiren();
  unsigned long endAt = millis() + 2000;
  while (millis() < endAt) {
    buzzersTone(3200);
    delay(70);
    buzzersTone(0);
    delay(70);
  }
}

// 3) Error: nii-noo sampai error hilang (dipanggil dari loop)
void handleSiren() {
  if (!sirenOn) return;
  if (millis() - lastSirenFlip < 350) return;
  lastSirenFlip = millis();
  sirenHigh = !sirenHigh;
  buzzersTone(sirenHigh ? 2400 : 1600);
}

void relayLock() {
  digitalWrite(PIN_RELAY, RELAY_ACTIVE_LOW ? HIGH : LOW);   // coil OFF → NC hidup → maglock berkunci
}

void relayUnlock() {
  digitalWrite(PIN_RELAY, RELAY_ACTIVE_LOW ? LOW : HIGH);   // coil ON  → NC putus → maglock terbuka
}

void unlockDoor() {
  startUnlock();
}

bool wifiReady() {
  if (WiFi.status() == WL_CONNECTED) return true;
  if (millis() - lastWifiTry > WIFI_RETRY_MS) {
    lastWifiTry = millis();
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
  return false;
}

// Hantar POST JSON ke app. Pulangkan kod HTTP, atau -1 kalau gagal sambung.
int postJson(const char* path, const String& jsonBody, String& responseOut) {
  if (!wifiReady()) return -1;
  HTTPClient http;
  String url = String(API_BASE) + path;
  http.begin(secureClient, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_API_KEY);
  http.setTimeout(5000);
  int code = http.POST(jsonBody);
  if (code > 0) responseOut = http.getString();
  http.end();
  return code;
}

// GET ringkas ke app (untuk semak status sesi)
int getJson(const char* path, String& responseOut) {
  if (!wifiReady()) return -1;
  HTTPClient http;
  String url = String(API_BASE) + path;
  http.begin(secureClient, url);
  http.addHeader("x-device-key", DEVICE_API_KEY);
  http.setTimeout(5000);
  int code = http.GET();
  if (code > 0) responseOut = http.getString();
  http.end();
  return code;
}

// ===================== LOGIK RFID ===========================================
String readCardUid() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return "";
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) uid += " ";
  }
  uid.toUpperCase();
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  return uid;
}

bool isOfflineCardAllowed(const String& uid) {
  for (int i = 0; i < OFFLINE_CARDS_COUNT; i++) {
    if (uid.equalsIgnoreCase(OFFLINE_CARDS[i])) return true;
  }
  return false;
}

void grantEntry(const String& name, int timerMin) {
  lcdMsg("Selamat masuk:", name);
  startOkBeep();
  startUnlock();
  sessionActive = true;
  sessionDeadline = millis() + (unsigned long)timerMin * 60UL * 1000UL;
}

void applyOpenResponse(int code, const String& resp, const String& uid, bool alreadyOpened) {
  if (code == 200) {
    JsonDocument doc;
    if (deserializeJson(doc, resp) == DeserializationError::Ok && doc["ok"]) {
      String name = doc["staff_name"] | "Staff";
      int timerMin = doc["timer_minutes"] | 5;
      cachePut(uid, name);
      if (!alreadyOpened) grantEntry(name, timerMin);
      else {
        sessionActive = true;
        sessionDeadline = millis() + (unsigned long)timerMin * 60UL * 1000UL;
      }
      return;
    }
  }

  if (alreadyOpened && (code == 409 || code == 403)) {
    unlockUntil = 0;
    relayLock();
    beepUntil = 0;
  }

  if (code == 403) {
    lcdMsg("Tidak berdaftar", uid);
    playDeniedBeep();
    showIdleScreen();
    return;
  }
  if (code == 409) {
    JsonDocument doc;
    deserializeJson(doc, resp);
    String blockedBy = doc["blocked_by"] | "staff lain";
    lcdMsg("Stor digunakan:", blockedBy);
    waitingStorFree = true;
    startSiren();
    return;
  }
  if (code == 401) {
    lcdMsg("Ralat kunci", "peranti (401)");
    startSiren();
    return;
  }
  if (!alreadyOpened && isOfflineCardAllowed(uid)) {
    grantEntry("Staff", 5);
    return;
  }
  if (!alreadyOpened) {
    lcdMsg("Tiada sambungan", "Cuba lagi");
    startSiren();
  }
}

void handleCard(const String& uid) {
  Serial.println("RFID UID: " + uid);
  if (uid == lastCardUid && millis() - lastCardMs < 2500) return;
  lastCardUid = uid;
  lastCardMs = millis();
  stopSiren();

  int idx = cacheFind(uid);
  bool known = idx >= 0 || isOfflineCardAllowed(uid);
  String cachedName = idx >= 0 ? cacheName[idx] : "Staff";

  if (known) {
    grantEntry(cachedName, 5);
  } else {
    lcdMsg("Mengesahkan...", uid);
  }

  String resp;
  String body = "{\"rfid_uid\":\"" + uid + "\"}";
  int code = postJson("/api/stor/open", body, resp);
  applyOpenResponse(code, resp, uid, known);
}

// ===================== LOGIK PINTU ==========================================
void handleDoor() {
  int state = digitalRead(PIN_DOOR);
  if (state != lastDoorState && millis() - lastDoorChange > 300) {  // debounce
    lastDoorChange = millis();
    lastDoorState = state;
    bool closed = (state == LOW);
    String resp;
    String body = String("{\"closed\":") + (closed ? "true" : "false") + "}";
    postJson("/api/stor/door", body, resp);
    if (closed) {
      sessionActive = false;
      stopSiren();
      lcdMsg("Pintu ditutup", "Terima kasih!");
      delay(1500);
      showIdleScreen();
    }
  }
}

void handleExitButton() {
  static unsigned long lastPress = 0;
  if (digitalRead(PIN_EXIT_BTN) == LOW && millis() - lastPress > 1000) {
    lastPress = millis();
    lcdMsg("EXIT dibuka", "");
    unlockDoor();
    showIdleScreen();
  }
}

// ===================== TIMER + BUZZER =======================================
void handleSessionTimer() {
  if (!sessionActive) return;

  // Semak dengan app sama ada staff sudah submit (setiap 5 saat)
  if (millis() - lastPoll > POLL_SESSION_MS) {
    lastPoll = millis();
    String resp;
    int code = getJson("/api/stor/session", resp);
    if (code == 200) {
      JsonDocument doc;
      if (deserializeJson(doc, resp) == DeserializationError::Ok) {
        if (doc["session"].isNull()) {
          sessionActive = false;
          stopSiren();
          showIdleScreen();
          return;
        }
      }
    }
  }

  if (millis() > sessionDeadline && !alarmOn) {
    alarmOn = true;
    startSiren();
    lcdMsg("SILA SUBMIT", "dalam app!");
  }
}

void pollStorFree() {
  if (!waitingStorFree) return;
  if (millis() - lastPoll < POLL_SESSION_MS) return;
  lastPoll = millis();
  String resp;
  int code = getJson("/api/stor/session", resp);
  if (code != 200) return;
  JsonDocument doc;
  if (deserializeJson(doc, resp) != DeserializationError::Ok) return;
  if (doc["session"].isNull()) {
    stopSiren();
    showIdleScreen();
  }
}

// ===================== SETUP & LOOP =========================================
void setup() {
  Serial.begin(115200);
  delay(1500);  // beri masa USB Serial Monitor buka
  Serial.println();
  Serial.println("================================");
  Serial.println("WH Management STOR — ESP32");
  Serial.println("Kalau kau nampak ayat ni, Serial OK");
  Serial.println("================================");

  pinMode(PIN_RELAY, OUTPUT);
  pinMode(PIN_DOOR, INPUT_PULLUP);
  pinMode(PIN_EXIT_BTN, INPUT_PULLUP);
  relayLock();
  buzzersInit();
  buzzersTone(0);

  Wire.begin(PIN_LCD_SDA, PIN_LCD_SCL);
  delay(100);
  Serial.println("Imbas I2C (LCD patut 0x27 atau 0x3F):");
  int i2cFound = 0;
  for (byte a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) {
      Serial.print("  jumpa 0x");
      Serial.println(a, HEX);
      i2cFound++;
    }
  }
  if (i2cFound == 0) Serial.println("  TIADA peranti I2C — LCD tidak dikesan (wiring/kuasa/alamat)");

  lcd.init();
  lcd.backlight();
  lcdMsg("WH Management", "STOR ESP32");
  delay(2000);

  SPI.begin(PIN_RFID_SCK, PIN_RFID_MISO, PIN_RFID_MOSI, PIN_RFID_SS);
  rfid.PCD_Init();
  delay(50);
  byte ver = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print("RFID RC522 versi: 0x");
  Serial.println(ver, HEX);
  rfidOk = !(ver == 0x00 || ver == 0xFF);
  if (!rfidOk) {
    Serial.println("RFID TIDAK DIKESAN — semak wiring 3.3V / SDA / SCK / MOSI / MISO / RST");
    lcdMsg("RFID RC522", "GAGAL 0x" + String(ver, HEX));
  } else {
    Serial.println("RFID OK. Imbas kad sekarang.");
    lcdMsg("RFID RC522", "OK 0x" + String(ver, HEX));
  }
  delay(2500);

  secureClient.setInsecure();  // terima sijil HTTPS tanpa semakan (mudah untuk hotel)

  Serial.print("Menyambung WiFi: ");
  Serial.println(WIFI_SSID);
  lcdMsg("Menyambung WiFi", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi OK. IP: ");
    Serial.println(WiFi.localIP());
    lcdMsg("WiFi OK", WiFi.localIP().toString());
  } else {
    Serial.println("WiFi GAGAL. Mod offline.");
    lcdMsg("WiFi GAGAL", "Mod offline");
  }
  delay(1500);
  if (WiFi.status() == WL_CONNECTED) {
    lcdMsg("Muat senarai", "kad RFID...");
    loadCardCache();
  }
  startOkBeep();
  showIdleScreen();
  Serial.println("Sedia. Imbas kad pada RC522...");
}

void showIdleScreen() {
  String line2 = "WiFi GAGAL";
  if (WiFi.status() == WL_CONNECTED) line2 = WiFi.localIP().toString();
  else if (!rfidOk) line2 = "RFID GAGAL";
  lcdMsg("Imbas kad anda", line2);
}

void loop() {
  String uid = readCardUid();
  if (uid.length() > 0) handleCard(uid);
  handleTimedOutputs();
  handleDoor();
  handleExitButton();
  handleSessionTimer();
  pollStorFree();
  handleSiren();
  if (millis() - lastHeartbeat > 5000) {
    lastHeartbeat = millis();
    Serial.println("Menunggu kad... (imbas sekarang)");
  }
  delay(20);
}
