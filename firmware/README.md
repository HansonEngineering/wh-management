# Firmware ESP32 — WH Management

Dua peranti ESP32. Kod sedia ada dalam folder masing-masing:

- `stor_esp32/stor_esp32.ino` — Pintu stor (RFID + maglock + 2 buzzer + 2 butang + LCD 1602)
- `kehadiran_esp32/kehadiran_esp32.ino` — Kehadiran (thumbprint + LCD 2004 + buzzer)

---

# PANDUAN WIRING LENGKAP

## A. PERANTI STOR

### A1. RFID RC522 → ESP32

> ⚠️ **PENTING: RC522 guna 3.3V SAHAJA. Sambung ke 5V akan rosakkan modul!**

| Pin RC522 | Sambung ke | Nota |
|---|---|---|
| VCC | **3.3V** ESP32 | JANGAN 5V! |
| GND | GND | |
| SDA (SS) | GPIO 5 | |
| SCK | GPIO 18 | |
| MOSI | GPIO 23 | |
| MISO | GPIO 19 | |
| RST | GPIO 33 | |
| IRQ | *(tidak perlu sambung)* | |

### A2. LCD 1602 + I2C backpack → ESP32

| Pin LCD | Sambung ke |
|---|---|
| VCC | 5V (pin VIN ESP32) |
| GND | GND |
| SDA | GPIO 21 |
| SCL | GPIO 22 |

### A3. Modul Relay 4-channel (guna Channel 1 sahaja) → Maglock 12V

> 1-channel rosak pun tidak mengapa — 4-channel sama fungsi. Guna **IN1 / CH1**
> sahaja. Channel 2–4 biar kosong untuk masa depan.
>
> Maglock perlukan **bekalan 12V berasingan** (adapter 12V 2A). ESP32 hanya
> hantar isyarat ke IN1.

**Sisi isyarat (expansion board → modul relay):**

| Pin modul 4-channel | Sambung ke |
|---|---|
| VCC | 5V / VIN expansion board |
| GND | GND expansion board |
| IN1 | D26 |
| IN2, IN3, IN4 | *(jangan sambung)* |

Kalau ada jumper **JD-VCC** di modul, **biarkan terpasang**.

**Sisi kuasa maglock — Channel 1 sahaja (terminal skru besar, biasanya paling kiri):**

Setiap channel ada 3 skru: `NO` · `COM` · `NC`. Guna **CH1** sahaja:

```
Adapter 12V (+) ──► COM  (Channel 1)
NC Channel 1    ──► Maglock (+)     ← mesti NC, bukan NO
Adapter 12V (−) ──► Maglock (−)
Adapter 12V (−) ──► GND expansion board   [common ground wajib]
```

Dengan NC: elektrik putus → maglock hilang kuasa → pintu TERBUKA (fail-safe).

Kod sudah diset `RELAY_ACTIVE_LOW = true` (sesuai 4-channel Songle). Kalau
pintu TERBUKA masa idle (patut berkunci), tukar kepada `false` dalam `stor_esp32.ino`.

### A4. Dua buzzer aktif → ESP32 (berbunyi sama masa)

Kod akan hidupkan **dua-dua** GPIO sekali.

| Buzzer | Pin + / terminal | Pin − |
|---|---|---|
| Buzzer 1 — di pintu stor | GPIO 27 / D27 | GND |
| Buzzer 2 — di kaunter | GPIO 14 / D14 | GND |

Guna buzzer aktif 3.3V–5V. Kalau buzzer kaunter jauh (>10 m) dan bunyi lemah, sambung D14 ke modul relay kecil, kemudian relay hidupkan buzzer 5V/12V di kaunter.

### A5. Butang 1 — sensor pintu tutup → ESP32

Sama ada reed switch magnet ATAU butang/limit switch mekanikal:

| Kaki | Sambung ke |
|---|---|
| Kaki 1 | GPIO 25 |
| Kaki 2 | GND |

Kod: `LOW` = pintu **tutup**. Kalau terbalik (buzzer/app salah baca), tukar wiring atau beritahu saya.

### A6. Butang 2 — EXIT / admin buka dari dalam → ESP32

| Kaki butang | Sambung ke |
|---|---|
| Kaki 1 | GPIO 32 |
| Kaki 2 | GND |

Tekan = maglock terbuka 5 saat. Berfungsi walau WiFi putus (keselamatan).

### A7. Bekalan kuasa keseluruhan (Stor)

| Komponen | Kuasa |
|---|---|
| ESP32 | USB 5V (atau pin VIN 5V) |
| LCD, Relay | 5V dari pin VIN ESP32 |
| RC522 | 3.3V dari pin 3V3 ESP32 |
| Maglock | Adapter 12V 2A berasingan (melalui relay) |

### A8. Wiring melalui Expansion Board (disyorkan)

Boleh dan **patut** guna expansion board. GPIO nombor **sama** — kau hanya skru wayar ke terminal yang bertulis `D25`, `D27`, dll. (D25 = GPIO 25).

Pasang ESP32 ke socket expansion board (pin USB ESP32 ke luar). USB power masuk ke ESP32 seperti biasa.

**Label terminal:** papan biasa tulis `D5` / `D18` / `3V3` / `GND` / `5V` / `VIN`. Kalau papan kau tulis `GPIO5` — itu sama dengan `D5`.

#### Jadual skru (Stor — semua ke expansion board)

| Komponen | Kaki komponen | Terminal expansion board | Rel kuasa |
|---|---|---|---|
| RFID RC522 | VCC | **3V3** | 3.3V — JANGAN 5V |
| RFID RC522 | GND | GND | |
| RFID RC522 | SDA (SS) | D5 | |
| RFID RC522 | SCK | D18 | |
| RFID RC522 | MOSI | D23 | |
| RFID RC522 | MISO | D19 | |
| RFID RC522 | RST | D33 | |
| LCD 1602 I2C | VCC | 5V / VIN | 5V |
| LCD 1602 I2C | GND | GND | |
| LCD 1602 I2C | SDA | D21 | |
| LCD 1602 I2C | SCL | D22 | |
| Relay 4-ch (CH1) | VCC | 5V / VIN | 5V |
| Relay 4-ch (CH1) | GND | GND | |
| Relay 4-ch (CH1) | IN1 | D26 | IN2–IN4 kosong |
| Buzzer 1 (pintu stor) | + | D27 | |
| Buzzer 1 (pintu stor) | − | GND | |
| Buzzer 2 (kaunter) | + | D14 | |
| Buzzer 2 (kaunter) | − | GND | |
| Butang 1 (pintu tutup) | kaki 1 | D25 | |
| Butang 1 (pintu tutup) | kaki 2 | GND | |
| Butang 2 (EXIT dalam) | kaki 1 | D32 | |
| Butang 2 (EXIT dalam) | kaki 2 | GND | |
| Adapter maglock 12V (−) | − | GND | common ground wajib |

Sisi 12V maglock **tidak** masuk expansion board (terlalu besar arus). Tetap:

```
Adapter 12V (+) ──► COM relay
NC relay        ──► Maglock (+)
Adapter 12V (−) ──► Maglock (−)  DAN  GND expansion board
```

#### Pin simpanan untuk masa depan (jangan guna sekarang)

Kosongkan terminal ni — senang tambah sensor/relay nanti tanpa ubah wiring sedia ada:

| Terminal | Boleh tambah nanti |
|---|---|
| D4 | sensor / LED / relay tambahan |
| D13 | sensor / LED / relay tambahan |
| D15 | sensor / LED / relay tambahan |
| D16 | UART / sensor |
| D17 | UART / sensor |

Elak D0, D2, D12 — pin boot ESP32, boleh buat board tak nak start.

**Tidak perlu expansion board kedua.** Satu papan ni sudah cukup untuk sekarang + beberapa tambahan nanti.

---

## B. PERANTI KEHADIRAN

### B1. Sensor cap jari AS608/R307 → ESP32

| Wayar Sensor | Sambung ke | Nota |
|---|---|---|
| Merah (VCC) | 5V (VIN) | R307 terima 4.2V–6V |
| Hitam (GND) | GND | |
| Hijau (TX sensor) | GPIO 16 (RX2) | TX sensor → RX ESP32 |
| Putih (RX sensor) | GPIO 17 (TX2) | RX sensor → TX ESP32 |

> ⚠️ Silang TX/RX: TX sensor masuk ke RX ESP32, RX sensor masuk ke TX ESP32.
> Kalau sensor tidak dikesan ("SENSOR GAGAL!" di LCD), perkara pertama
> untuk semak ialah pasangan TX/RX ini terbalik atau tidak.

### B2. LCD 2004 + I2C backpack → ESP32

| Pin LCD | Sambung ke |
|---|---|
| VCC | 5V (VIN) |
| GND | GND |
| SDA | GPIO 21 |
| SCL | GPIO 22 |

### B3. Buzzer aktif → ESP32

| Pin Buzzer | Sambung ke |
|---|---|
| + | GPIO 27 |
| − | GND |

### B4. Bekalan kuasa (Kehadiran)

ESP32 melalui USB 5V atau adapter 5V ke pin VIN. Semua komponen lain
(LCD, sensor, buzzer) ambil kuasa dari ESP32 — tiada bekalan luar diperlukan.

---

## Senarai semak sebelum ON

- [ ] RC522 disambung ke **3.3V**, bukan 5V
- [ ] GND adapter 12V disambung ke GND ESP32 (common ground)
- [ ] Maglock melalui terminal **NC** relay (fail-safe)
- [ ] Butang EXIT berfungsi sebelum pintu dikunci buat kali pertama
- [ ] TX/RX sensor cap jari bersilang (TX→RX, RX→TX)
- [ ] Uji butang EXIT dan maglock DULU sebelum pasang di pintu sebenar

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
| Buzzer pintu stor | GPIO 27 |
| Buzzer kaunter | GPIO 14 |
| Butang 1 — sensor pintu | GPIO 25 (INPUT_PULLUP) |
| Butang 2 — EXIT dalam stor | GPIO 32 (INPUT_PULLUP) |
| LCD I2C SDA | GPIO 21 |
| LCD I2C SCL | GPIO 22 |

### Aliran

1. Imbas kad → POST `/api/stor/open` dengan `rfid_uid` + header `x-device-key`.
2. Kalau OK: maglock terbuka 5 saat, LCD papar nama staff, timer mula.
3. ESP32 poll `/api/stor/session` setiap 5 saat — bila staff submit dalam app, timer berhenti.
4. Kalau timer tamat dan belum submit: **dua buzzer** (stor + kaunter) berbunyi berulang.
5. Butang 1 kesan pintu tutup → POST `/api/stor/door` dengan `{"closed": true}`.
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
