# SIMSPP Ganda Husada — Frontend

Sistem Informasi Manajemen Pembayaran SPP untuk SMK Kesehatan Ganda Husada.
Repository ini berisi **frontend statis** (HTML/CSS/JS) yang di-host di GitHub Pages.
Backend berupa **REST API Google Apps Script** dan **tidak** disimpan di sini.

```
index.html        ← halaman aplikasi (SPA, 15 modul)
css/style.css     ← sistem desain (terang/gelap, responsif)
js/config.js      ← ⚙️ SATU-SATUNYA berkas yang perlu diisi: GAS_URL
js/tema.js        ← menerapkan tema sebelum halaman digambar
js/inti.js        ← utilitas, pemanggil API (fetch), komponen UI
js/data.js        ← login, data lokal, router, sinkronisasi, outbox
js/dashboard.js   ← dashboard, data siswa, tagihan
js/kasir.js       ← kasir, verifikasi, riwayat, koreksi, kuitansi
js/admin.js       ← siaran, notifikasi, akademik, tarif, impor, laporan, pengguna, pengaturan
```

## Konfigurasi

Buka `js/config.js` dan isi `GAS_URL` dengan URL Web App Apps Script yang berakhiran `/exec`.
URL ini bukan rahasia: keamanan dijaga oleh login, token sesi, dan pemeriksaan peran di server.
Jangan pernah menaruh token, kata sandi, atau ID spreadsheet di repository ini.

## Cara kerja singkat

- Semua komunikasi ke backend memakai `fetch()` ke `GAS_URL`: `GET ?action=info` (branding layar masuk) dan
  `POST {action, token, args}` dengan `Content-Type: text/plain` (tanpa preflight CORS). Token sesi dikirim di badan permintaan, tidak pernah di URL.
- Pindah menu tanpa memuat ulang, data disimpan di browser lalu diperbarui di latar, pembayaran tampil seketika
  dan dikirim lewat antrean ber-kunci idempotensi (aman dari klik ganda dan koneksi putus).

Panduan instalasi lengkap: **PANDUAN-INSTALASI.md**.

## Memperbarui situs

```bash
git add .
git commit -m "Deskripsi perubahan"
git push
```
GitHub Pages memperbarui situs dalam 1–2 menit. Tekan **Ctrl+Shift+R** bila masih tampil versi lama.
