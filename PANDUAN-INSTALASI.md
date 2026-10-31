# Panduan Instalasi — SIMSPP Ganda Husada
### Backend: Google Apps Script (REST API) • Frontend: GitHub Pages

```
 Browser pengguna ──► https://USERNAME.github.io/NAMA-REPO/   (GitHub Pages: index.html, css/, js/)
        │  fetch()  GET ?action=info  |  POST {action, token, args}  (text/plain, JSON)
        ▼
 https://script.google.com/macros/s/…/exec   (Apps Script: Kode.gs → JSON)
        │
        ▼
 Google Sheets (database) • Google Drive (bukti & PDF) • Gmail (notifikasi) • Script Properties (rahasia)
```

Berkas yang Anda terima:

| Berkas | Dipakai di | Keterangan |
|---|---|---|
| `Kode.gs` | Apps Script | Seluruh backend (REST API) |
| `appsscript.json` | Apps Script | Manifes: zona waktu, V8, pengaturan Web App |
| `simspp-ganda-husada.zip` | GitHub | Frontend: `index.html`, `css/`, `js/`, `README.md`, panduan ini |

---

## BAGIAN A — Backend di Google Apps Script (± 10 menit)

1. Buka **https://script.google.com** → **Proyek baru** → ganti nama proyek menjadi *SIMSPP Ganda Husada API*.
2. **Setelan proyek** (ikon roda di kiri) → centang **Tampilkan file manifes "appsscript.json" di editor**.
3. Kembali ke **Editor** (ikon `< >`):
   - buka `appsscript.json` → hapus isinya → tempel isi berkas `appsscript.json`;
   - ganti nama `Code.gs` menjadi **`Kode`** → hapus isinya → tempel isi `Kode.gs` → **Simpan** (Ctrl+S).
   - Tidak perlu membuat berkas HTML apa pun — tampilan sekarang ada di GitHub.
4. Di toolbar pilih fungsi **`setupAppEnvironment`** → **Jalankan** → **Tinjau izin** → pilih akun sekolah → **Izinkan**.
   (Bila muncul "Google belum memverifikasi aplikasi ini": klik **Lanjutan** → **Buka SIMSPP… (tidak aman)**. Ini normal untuk skrip milik sendiri.)
5. Buka **Log eksekusi** dan **catat sekarang** — hanya tampil sekali:
   - sandi sementara **daffit** (Operator Sekolah), **izra** (Bendahara), **alfani** (Ketua Yayasan);
   - akses darurat `darurat / …`.
6. **Terapkan → Penerapan baru** → ikon roda → **Aplikasi web**:
   - *Deskripsi*: `v2 REST API`
   - *Jalankan sebagai*: **Saya**
   - *Yang memiliki akses*: **Siapa saja** ← wajib, agar GitHub Pages bisa memanggilnya
   - **Terapkan** → salin **URL aplikasi web** (berakhiran `/exec`).
7. Uji: tempel URL tadi di tab browser baru dan tambahkan `?action=ping` di belakangnya.
   Benar bila tampil teks JSON seperti `{"ok":true,"data":{"app":"SIMSPP Ganda Husada","versi":"2.0.0",…}}`.

**Yang dibuat `setupAppEnvironment()`** (aman dijalankan ulang; rahasia yang sudah ada tidak ditimpa):
spreadsheet *DB SIMSPP Ganda Husada* (15 sheet), folder Drive *SIMSPP Ganda Husada* (Bukti Transfer, Bukti Pembayaran PDF, Ekspor & Laporan, Impor, Cadangan),
Script Properties (ID spreadsheet/folder, kunci sesi, hash sandi), 3 akun PRD + akses darurat, data contoh 120 siswa (mode kirim **SIMULASI**), pemicu harian 07.00 & antrean 5 menit.

> 🔁 **Setiap kali `Kode.gs` diubah:** Terapkan → **Kelola penerapan** → ikon pensil → *Versi*: **Versi baru** → **Terapkan**.
> Jangan membuat "Penerapan baru" lagi — URL `/exec` akan berubah dan frontend harus diubah juga.

---

## BAGIAN B — Siapkan folder frontend

1. Ekstrak `simspp-ganda-husada.zip` (klik kanan → **Extract All**). Hasilnya folder **`simspp-ganda-husada`** yang **langsung** berisi `index.html`, folder `css`, folder `js`.
   👉 **Folder inilah yang nanti di-`git init`** — jangan masuk lebih dalam, jangan naik satu tingkat.
2. Buka `js\config.js` dengan Notepad, ganti baris `GAS_URL` dengan URL `/exec` dari langkah A6:
   ```js
   GAS_URL: 'https://script.google.com/macros/s/AKfycb…/exec',
   ```
   Simpan. Hanya URL ini yang boleh ada di frontend — repository GitHub bersifat publik.

---

## BAGIAN C — Unggah ke GitHub Pages (lewat terminal)

> ⚠️ Jangan memakai tombol **Upload files** di situs GitHub — struktur folder `css/` dan `js/` akan rusak dan tampilan menjadi polos.

**C1. Pasang Git** — Windows: https://git-scm.com/download/win (pengaturan bawaan). Mac: ketik `git --version` di Terminal. Cek:
```bash
git --version
```

**C2. Akun GitHub** — daftar di https://github.com. Username menjadi bagian alamat situs: `https://USERNAME.github.io/NAMA-REPO/`.

**C3. Identitas Git** (sekali saja per komputer):
```bash
git config --global user.name "Nama Lengkap Anda"
git config --global user.email "email-akun-github@contoh.com"
```

**C4. Buat repository** — di github.com: **+** → **New repository** → nama misalnya `simspp-ganda-husada` → **Public** → **jangan** centang README/.gitignore/license → **Create repository**.

**C5. Buka terminal di folder frontend** — buka folder `simspp-ganda-husada` di File Explorer, klik address bar, ketik `powershell`, Enter. Lalu periksa isinya:
```powershell
dir
```
Wajib terlihat `index.html`, `css`, `js` di daftar teratas. Kalau yang terlihat justru sebuah folder lain, masuk dulu ke folder yang berisi `index.html` (`cd nama-folder`).

**C6. Kirim ke GitHub** — jalankan satu per satu:
```bash
git init
git add .
git commit -m "Upload pertama SIMSPP"
git branch -M main
git remote add origin https://github.com/USERNAME/simspp-ganda-husada.git
git push -u origin main
```
Saat diminta *Password*, tempel **Personal Access Token**, bukan sandi akun GitHub. Layar memang tidak menampilkan apa pun saat token ditempel — itu normal, tekan Enter.

**C7. Membuat token** (bila muncul *Password authentication is not supported*): https://github.com/settings/tokens → **Generate new token (classic)** → Note `git-push` → Expiration `90 days` → centang **repo** → **Generate** → salin `ghp_…` (hanya tampil sekali) → ulangi `git push -u origin main`.

**C8. Aktifkan Pages** — repository → **Settings** → **Pages**: Source **Deploy from a branch**, Branch **main** / **(root)** → **Save**. Centang **Enforce HTTPS**. Tunggu 1–2 menit sampai muncul *Your site is live at https://USERNAME.github.io/simspp-ganda-husada/*.

---

## BAGIAN D — Uji pertama

1. Buka alamat situs → layar masuk tampil dengan nama sekolah (dimuat dari backend).
2. Masuk sebagai `daffit` dengan sandi sementara → sistem meminta ganti sandi.
3. Tekan **F12 → Console**: tidak boleh ada tulisan merah tentang CORS atau 404.
4. Catat satu pembayaran percobaan di **Catat Pembayaran** → cek baris baru di sheet *Pembayaran*.

Panggilan pertama setelah lama tidak dipakai bisa butuh 2–5 detik (Apps Script "bangun"); berikutnya cepat, dan pembayaran tetap tampil seketika berkat antrean di browser.

---

## BAGIAN E — Sebelum dipakai sungguhan

1. Jalankan **`hapusDataDemo()`** dari editor Apps Script (cadangan dibuat otomatis).
2. **Pengaturan & Log → Identitas**: nama sekolah, alamat, NPSN, logo (URL gambar https), rekening, bendahara, ketua yayasan.
3. **Impor Data Excel** berurutan: Master → Siswa → Saldo awal → Tagihan → Pembayaran historis (unduh templat di halaman yang sama).
4. **Tagihan & Tunggakan → Buat tagihan** tahun ajaran aktif.
5. Setelah email wali valid: **Notifikasi & Kuitansi → Mode kirim** ubah **SIMULASI → LIVE**.
6. WhatsApp (opsional): token diisi di **Pengaturan → Integrasi** (tersimpan di Script Properties, tampil tersamar).
7. Bagikan sandi sementara `izra` dan `alfani` kepada pemiliknya; batasi editor proyek Apps Script hanya untuk orang tepercaya.

---

## BAGIAN F — Memperbarui

| Yang berubah | Langkah |
|---|---|
| Frontend (`index.html`, `css/`, `js/`) | Di folder `simspp-ganda-husada`: `git add .` → `git commit -m "keterangan"` → `git push`. Tunggu 1–2 menit, tekan Ctrl+Shift+R |
| Backend (`Kode.gs`) | Tempel kode baru → Simpan → **Kelola penerapan → Edit → Versi baru → Terapkan** (URL tetap) |

---

## Pemecahan masalah

| Yang terlihat | Penyebab | Solusi |
|---|---|---|
| "Konfigurasi belum lengkap … GAS_URL" di layar masuk | `js/config.js` belum diisi | Isi URL `/exec`, lalu `git add .` → `git commit -m "isi GAS_URL"` → `git push` |
| "server membalas halaman HTML — periksa GAS_URL …" | Akses penerapan bukan **Siapa saja**, atau URL yang ditempel berakhiran `/dev` | Kelola penerapan → Edit → akses **Siapa saja**; pakai URL `/exec` |
| "Tidak dapat menghubungi server" / error CORS di Console | URL salah ketik, penerapan dihapus, atau internet putus | Uji `URL/exec?action=ping` di browser; transaksi yang sempat dicatat tetap di antrean dan terkirim otomatis saat tersambung |
| "Aksi tidak dikenal" setelah memperbarui | Kode baru belum dibuatkan **versi baru** penerapan | Kelola penerapan → Edit → Versi baru |
| "Aplikasi belum disiapkan" | `setupAppEnvironment` belum dijalankan | Jalankan dari editor (Bagian A4) |
| Situs GitHub 404 | `index.html` tidak berada di root repository | Lihat repository di browser: harus tampak `index.html`, `css`, `js` di halaman depan. Bila tampak folder lain, ulangi C5–C6 dari folder yang benar dengan `git push -u origin main --force` |
| Tampilan polos tanpa warna | Folder `css/` / `js/` rusak (unggah lewat web) | Unggah ulang lewat terminal (Bagian C) |
| Lupa sandi | — | Operator: **Pengguna & Hak Akses → Reset sandi**. Operator sendiri lupa: masuk dengan akses darurat, atau jalankan `resetAksesDarurat()` dari editor |

---

## Catatan keamanan

- Repository GitHub publik **hanya** berisi tampilan dan alamat `/exec`. Spreadsheet, folder, kunci sesi, hash sandi, dan token WhatsApp tetap di akun Google sekolah (Script Properties).
- Backend hanya menjalankan aksi yang terdaftar; fungsi pemeliharaan (`setupAppEnvironment`, `hapusDataDemo`, `resetAksesDarurat`, `rotasiSecretSesi`) dan pemicu tidak bisa dipanggil dari web.
- Setiap aksi memeriksa token sesi (12 jam, dikirim di badan POST) dan peran pengguna di server. 5× gagal masuk → terkunci 15 menit.
- Halaman memakai Content-Security-Policy: skrip hanya dari situs sendiri dan jsDelivr, koneksi data hanya ke Apps Script.
