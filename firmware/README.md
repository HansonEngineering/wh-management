# Firmware ESP32 — WH Management

Dua peranti ESP32. Kod sedia ada dalam folder masing-masing:

- `stor_esp32/stor_esp32.ino` — Pintu stor (RFID + maglock + buzzer + sensor pintu + LCD 1602)
- `kehadiran_esp32/kehadiran_esp32.ino` — Kehadiran (thumbprint + LCD 2004 + buzzer)

---

## 1. Peranti Stor (`stor_esp32`)

### Pin (DIBETULKAN — RST pindah ke GPIO33, bukan 22)

| Komponen | Pin ESP32 |
|---|---|
| RFID RC522 SDA (SS) | GPIO 5 |
| RFID RC522 SCK | GPIO 18 |
| RFID RC522 MOSI | GPIO 23 |
| RFID RC522 MISO | GPIO 19 |
| RFID RC522 RST | GPIO 33 |
| Relay maglock | GPIO 26 |
| Buzzer | GPIO 27 |
| Reed switch pintu | GPIO 25 (INPUT_PULLUP) |
| Butang EXIT (dalam stor) | GPIO 32 (INPUT_PULLUP) |
| LCD I2C SDA | GPIO 21 |
| LCD I2C SCL | GPIO 22 |

### Aliran

1. Imbas kad → POST `/api/stor/open` dengan `rfid_uid` + header `x-device-key`.
2. Kalau OK: maglock terbuka 5 saat, LCD papar nama staff, timer mula.
3. ESP32 poll `/api/stor/session` setiap 5 saat — bila staff submit dalam app, timer berhenti.
4. Kalau timer tamat dan belum submit: buzzer berbunyi berulang.
5. Reed switch kesan pintu tutup → POST `/api/stor/door` dengan `{"closed": true}`.
6. Butang EXIT dalam stor → buka maglock serta-merta (keselamatan, tanpa internet).
7. WiFi putus → kad dalam senarai `OFFLINE_CARDS` tetap boleh buka pintu.

---

## 2. Peranti Kehadiran (`kehadiran_esp32`)

### Pin

| Komponen | Pin ESP32 |
|---|---|
| Sensor TX (hijau) → RX2 | GPIO 16 |
| Sensor RX (putih) ← TX2 | GPIO 17 |
| LCD I2C SDA | GPIO 21 |
| LCD I2C SCL | GPIO 22 |
| Buzzer | GPIO 27 |

Sensor yang disokong: AS608 / R307 / FPM10A (UART 57600 baud).

### Aliran

1. Staff letak jari → sensor pulangkan `fingerprint_id`.
2. POST `/api/attendance` dengan `fingerprint_id` + header `x-device-key`.
3. App tentukan sendiri clock-in atau clock-out; LCD papar nama, masa, status (ON TIME / LEWAT x minit / selamat pulang).

### Mendaftar cap jari staff

1. Dalam Arduino IDE, buka **File → Examples → Adafruit Fingerprint Sensor Library → enroll**.
2. Tukar wiring Serial2 sama seperti firmware utama (RX2=16, TX2=17) — dalam sketch enroll, ganti `SoftwareSerial` dengan `HardwareSerial`:
   ```cpp
   HardwareSerial mySerial(2);
   Adafruit_Fingerprint finger(&mySerial);
   // dalam setup(): mySerial.begin(57600, SERIAL_8N1, 16, 17);
   ```
3. Upload, buka Serial Monitor (115200), masukkan nombor ID (1–127), ikut arahan letak jari 2 kali.
4. **Catat ID setiap staff**, kemudian masukkan ID itu dalam app: Staff → pilih staff → isi medan `fingerprint_id`.

---

## Cara upload firmware (dua-dua peranti sama)

1. Pasang **Arduino IDE** (arduino.cc).
2. **File → Preferences → Additional board manager URLs**, tambah:
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. **Tools → Board → Boards Manager**, cari `esp32`, pasang **esp32 by Espressif**.
4. **Sketch → Manage Libraries**, pasang:
   - `MFRC522` oleh GithubCommunity *(peranti stor sahaja)*
   - `Adafruit Fingerprint Sensor Library` oleh Adafruit *(peranti kehadiran sahaja)*
   - `LiquidCrystal I2C` oleh Frank de Brabander
   - `ArduinoJson` oleh Benoit Blanchon
5. Buka fail `.ino`, ubah bahagian **KONFIGURASI** di atas:
   - `WIFI_SSID` dan `WIFI_PASSWORD`
   - `API_BASE` — `https://wh-management.hansonglenn01.workers.dev`
   - `DEVICE_API_KEY` — mesti sama dengan secret `DEVICE_API_KEY` di Cloudflare
6. Sambung ESP32 ke USB, pilih **Tools → Board → ESP32 Dev Module**, pilih Port yang betul.
7. Klik **Upload**. Siap.

## Nota keselamatan

- Maglock mestilah jenis **fail-safe** (terbuka bila elektrik putus) dan butang EXIT wajib dipasang di dalam stor.
- Wiring maglock: kuasa maglock melalui terminal **NC** relay supaya relay ON = pintu terbuka. Kalau terbalik, tukar `HIGH`/`LOW` dalam fungsi `unlockDoor()`.
- Kalau LCD tidak papar apa-apa, cuba tukar alamat I2C `0x27` kepada `0x3F` dalam kod.
