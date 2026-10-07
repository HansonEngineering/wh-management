# Firmware ESP32 — WH Management

Dua peranti ESP32:

## 1. Stor (RFID + Maglock + Buzzer + Sensor Pintu + LCD 1602)

**Pin yang dicadangkan:**
| Komponen | Pin ESP32 |
|---|---|
| RFID RC522 SDA | GPIO 5 |
| RFID RC522 SCK | GPIO 18 |
| RFID RC522 MOSI | GPIO 23 |
| RFID RC522 MISO | GPIO 19 |
| RFID RC522 RST | GPIO 22 |
| Relay maglock | GPIO 26 |
| Buzzer | GPIO 27 |
| Reed switch pintu | GPIO 25 (INPUT_PULLUP) |
| LCD I2C SDA | GPIO 21 |
| LCD I2C SCL | GPIO 22 |

**Aliran:**
1. Imbas kad → POST `/api/stor/open` dengan `rfid_uid` dan header `x-device-key`.
2. Kalau OK: buka maglock 5 saat, paparkan nama staff di LCD, mula timer.
3. Kalau tamat timer dan belum submit: buzzer berbunyi.
4. Bila reed switch kesan pintu ditutup: POST `/api/stor/door` dengan `{"closed": true}`.

## 2. Kehadiran (Thumbprint + LCD 2004)

**Aliran:**
1. Baca cap jari → dapatkan `fingerprint_id`.
2. POST `/api/attendance` dengan `fingerprint_id` dan header `x-device-key`.
3. Paparkan nama, masa dan status (on time / lewat) di LCD.

## Konfigurasi

Set dalam kod:
- `WIFI_SSID` dan `WIFI_PASSWORD`
- `API_BASE` — contoh: `https://wh-management.pages.dev`
- `DEVICE_API_KEY` — mesti sama dengan environment variable `DEVICE_API_KEY` di Cloudflare

## Nota

- Timer 5 minit dan buzzer berjalan dalam ESP32 sendiri, bukan di server.
- Simpan senarai kad yang dibenarkan dalam ESP32 supaya pintu masih boleh dibuka bila WiFi terputus.
- Maglock mesti jenis fail-safe (terbuka bila elektrik putus) dan ada butang exit di dalam stor.
