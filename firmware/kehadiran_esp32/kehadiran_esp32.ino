/*
 * ============================================================================
 * WH MANAGEMENT — PERANTI KEHADIRAN (ESP32 + THUMBPRINT)
 * WARISAN HOTEL
 * ============================================================================
 * Fungsi:
 *   1. Staff letak jari -> sensor baca ID cap jari
 *   2. Hantar ke app -> app tentukan clock-in atau clock-out automatik
 *   3. LCD papar nama, masa, dan status (on time / lewat / selamat pulang)
 *
 * Sensor cap jari yang disokong: AS608 / R307 / FPM10A (UART, 57600 baud)
 *
 * Library yang perlu dipasang (Arduino IDE -> Sketch -> Manage Libraries):
 *   - "Adafruit Fingerprint Sensor Library" oleh Adafruit
 *   - "LiquidCrystal I2C" oleh Frank de Brabander
 *   - "ArduinoJson" oleh Benoit Blanchon (versi 7.x)
 *   - Board: "ESP32" oleh Espressif (dari Boards Manager)
 * ============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_Fingerprint.h>
#include <ArduinoJson.h>

// ===================== KONFIGURASI — UBAH DI SINI =====================

// WiFi hotel
const char* WIFI_SSID     = "Warisan 2.4GHz";
const char* WIFI_PASSWORD = "Warisan004004";

// Alamat app (Cloudflare Workers)
const char* API_BASE = "https://wh-management.hansonglenn01.workers.dev";

// Kunci peranti — MESTI sama dengan DEVICE_API_KEY dalam Cloudflare/.env.local
const char* DEVICE_API_KEY = "78ee05b0294c0b22e2c6e6d1735c2bdd9d4c2de0937feb6d";

// ===================== PIN ==================================================
// Sensor cap jari (UART2)
//   Sensor TX (wayar hijau biasanya) -> GPIO16 (RX2 ESP32)
//   Sensor RX (wayar putih biasanya) -> GPIO17 (TX2 ESP32)
#define PIN_FP_RX  16
#define PIN_FP_TX  17
// LCD 2004 I2C
#define PIN_LCD_SDA 21
#define PIN_LCD_SCL 22
// Buzzer (maklum balas bunyi)
#define PIN_BUZZER  27

// ===================== TETAPAN MASA =========================================
const unsigned long WIFI_RETRY_MS    = 10000;
const unsigned long MSG_HOLD_MS      = 3000;  // paparan mesej sebelum reset
const unsigned long FINGER_COOLDOWN  = 5000;  // elak bacaan berganda jari sama

// ===================== OBJEK ================================================
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);
LiquidCrystal_I2C lcd(0x27, 20, 4);   // kalau LCD tidak papar, cuba alamat 0x3F
WiFiClientSecure secureClient;

// ===================== KEADAAN ==============================================
unsigned long lastWifiTry = 0;
unsigned long lastFingerTime = 0;
int lastFingerId = -1;

// ===================== UTILITI ==============================================
void lcdMsg(const String& l1, const String& l2 = "", const String& l3 = "", const String& l4 = "") {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(l1.substring(0, 20));
  lcd.setCursor(0, 1); lcd.print(l2.substring(0, 20));
  lcd.setCursor(0, 2); lcd.print(l3.substring(0, 20));
  lcd.setCursor(0, 3); lcd.print(l4.substring(0, 20));
}

void beep(int times, int onMs = 100, int offMs = 100) {
  for (int i = 0; i < times; i++) {
    digitalWrite(PIN_BUZZER, HIGH); delay(onMs);
    digitalWrite(PIN_BUZZER, LOW);  if (i < times - 1) delay(offMs);
  }
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

int postJson(const char* path, const String& jsonBody, String& responseOut) {
  if (!wifiReady()) return -1;
  HTTPClient http;
  String url = String(API_BASE) + path;
  http.begin(secureClient, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_API_KEY);
  http.setTimeout(10000);
  int code = http.POST(jsonBody);
  if (code > 0) responseOut = http.getString();
  http.end();
  return code;
}

// ===================== LOGIK CAP JARI =======================================
// Pulangkan ID cap jari (1..127), 0 kalau tiada jari, -1 kalau tidak dikenali
int readFingerprint() {
  uint8_t p = finger.getImage();
  if (p == FINGERPRINT_NOFINGER) return 0;
  if (p != FINGERPRINT_OK) return 0;

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) return 0;

  p = finger.fingerFastSearch();
  if (p == FINGERPRINT_NOTFOUND) return -1;   // jari ada, tapi tidak berdaftar dalam sensor
  if (p != FINGERPRINT_OK) return 0;

  return finger.fingerID;
}

void handleFingerprint(int fpId) {
  lcdMsg("Mengesahkan...", "", "", "");

  String resp;
  String body = "{\"fingerprint_id\":\"" + String(fpId) + "\"}";
  int code = postJson("/api/attendance", body, resp);

  if (code == 200) {
    JsonDocument doc;
    if (deserializeJson(doc, resp) == DeserializationError::Ok && doc["ok"]) {
      String name   = doc["name"] | "Staff";
      String time   = doc["time"] | "";
      String action = doc["action"] | "";

      if (action == "clock_in") {
        String status = doc["status"] | "";
        int lateMin = doc["late_minutes"] | 0;
        beep(1);
        if (status == "late") {
          lcdMsg("Selamat datang,", name, "Masuk: " + time, "LEWAT " + String(lateMin) + " minit");
        } else if (status == "leave") {
          lcdMsg(name, "Anda CUTI hari ini", "Masuk: " + time, "");
        } else if (status == "unscheduled") {
          lcdMsg(name, "Tiada syif hari ini", "Masuk direkod: " + time, "");
        } else {
          lcdMsg("Selamat datang,", name, "Masuk: " + time, "ON TIME");
        }
      } else {
        beep(1);
        lcdMsg("Selamat pulang,", name, "Keluar: " + time, "");
      }
      delay(MSG_HOLD_MS);
      lcdMsg("WH Management", "Letakkan jari anda", "", "");
      return;
    }
  }

  if (code == 403) {
    beep(3);
    lcdMsg("Cap jari tidak", "berdaftar!", "Hubungi admin", "");
  } else if (code == 401) {
    beep(3);
    lcdMsg("Ralat kunci", "peranti (401)", "", "");
  } else {
    beep(2);
    lcdMsg("Tiada sambungan", "Cuba lagi", "", "");
  }
  delay(MSG_HOLD_MS);
  lcdMsg("WH Management", "Letakkan jari anda", "", "");
}

// ===================== SETUP & LOOP =========================================
void setup() {
  Serial.begin(115200);

  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  lcd.init();
  lcd.backlight();
  lcdMsg("WH Management", "Memulakan...", "", "");

  // Sensor cap jari
  fpSerial.begin(57600, SERIAL_8N1, PIN_FP_RX, PIN_FP_TX);
  finger.begin(57600);
  if (finger.verifyPassword()) {
    lcdMsg("Sensor cap jari OK", "", "", "");
  } else {
    lcdMsg("SENSOR GAGAL!", "Semak wiring", "TX/RX sensor", "");
    while (true) delay(1000);   // berhenti di sini — sensor wajib berfungsi
  }
  delay(1000);

  secureClient.setInsecure();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(300);
  }
  if (WiFi.status() == WL_CONNECTED) {
    lcdMsg("WiFi OK", WiFi.localIP().toString(), "", "");
  } else {
    lcdMsg("WiFi GAGAL", "Semak router", "", "");
  }
  delay(1500);
  beep(1);
  lcdMsg("WH Management", "Letakkan jari anda", "", "");
}

void loop() {
  int fpId = readFingerprint();

  if (fpId > 0) {
    // Elak bacaan berganda: jari sama dalam tempoh cooldown
    if (!(fpId == lastFingerId && millis() - lastFingerTime < FINGER_COOLDOWN)) {
      lastFingerId = fpId;
      lastFingerTime = millis();
      handleFingerprint(fpId);
    }
  } else if (fpId == -1) {
    beep(3);
    lcdMsg("Jari tidak dikenali", "dalam sensor", "Daftar dulu guna", "sketch 'enroll'", "");
    delay(MSG_HOLD_MS);
    lcdMsg("WH Management", "Letakkan jari anda", "", "");
  }

  delay(150);
}
