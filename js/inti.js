'use strict';
/**
 * ============================================================
 * SIMSPP Ganda Husada — Frontend (JavaScript.html)
 * Prinsip gas-instant-ux:
 *  1. SPA: semua halaman sudah ada di DOM → pindah menu 0 ms.
 *  2. Data kerja di memori (S.db) + cadangan localStorage → render instan.
 *  3. Optimistic UI: simpan langsung tampil, sinkron di latar dengan
 *     ID idempoten + outbox (aman bila koneksi putus / klik ganda).
 *  4. Satu panggilan bootstrap; pencarian/filter/dashboard dihitung lokal;
 *     riwayat transaksi besar dipaginasi di server (PRD 7.3).
 * Aman di iframe (Blogger): tanpa window.location / window.open / ?page=.
 * ============================================================
 */

// ════════════════════════════════════════════════════════════
// BAGIAN 1 — STATE, UTILITAS, API, UI DASAR
// ════════════════════════════════════════════════════════════

/** Konfigurasi dari js/config.js — hanya URL /exec (bukan rahasia) */
const CFG = window.APP_CONFIG || {};
const GAS_URL = String(CFG.GAS_URL || '').trim();
const KONFIG_OK = /^https:\/\/script\.google\.com\/.+\/exec$/.test(GAS_URL) && !/GANTI|XXXX/i.test(GAS_URL);
/** Info publik (nama sekolah, logo, versi) — diisi dari cache lalu GET ?action=info */
const BOOT = { siap: true, nama: 'SMK Kesehatan Ganda Husada', yayasan: 'Yayasan Pendidikan Ganda Husada', logo: '', kota: '', versi: '2.0' };
const S = {
  token: null, me: null, set: {}, ver: '0', skema: {},
  db: { siswa: [], kelas: [], jurusan: [], ta: [], tarif: [], users: [], koreksi: [], tg: {}, agg: [], hariIni: [], pending: [], terbaru: [], lampiran: {} },
  idx: { siswa: new Map(), nis: new Map(), kelas: new Map(), jurusan: new Map(), ta: new Map(), users: new Map() },
  memo: new Map(), hal: null, sinkron: 0, offline: false, outbox: [], charts: {}, ui: {}, cacheRw: new Map()
};
const PERAN = { YAY: 'YAYASAN', OPR: 'OPERATOR', BEN: 'BENDAHARA' };
const LABEL_PERAN = { YAYASAN: 'Ketua Yayasan', OPERATOR: 'Operator Sekolah (Super Admin)', BENDAHARA: 'Bendahara' };
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BLN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
const ACT = {}, INP = {}, CHG = {};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const angka = v => { if (typeof v === 'number') return v; const n = Number(String(v === undefined || v === null ? '' : v).replace(/[^\d-]/g, '')); return isFinite(n) ? n : 0; };
const ribu = n => Math.round(angka(n)).toLocaleString('id-ID');
const rp = n => 'Rp ' + ribu(n);
const rpS = n => { n = angka(n); const a = Math.abs(n); if (a >= 1e9) return 'Rp ' + (n / 1e9).toFixed(2).replace('.', ',') + ' M'; if (a >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1).replace('.', ',') + ' jt'; return rp(n); };
const pct = (a, b) => b > 0 ? (a / b * 100) : 0;
const pctL = (a, b) => pct(a, b).toFixed(1).replace('.', ',') + '%';
const pad = n => String(n).padStart(2, '0');
const isoTgl = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const hariIni = () => isoTgl(new Date());
const periodeKini = () => hariIni().slice(0, 7);
const tambahHari = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoTgl(d); };
const selisihHari = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
const tglLabel = s => { s = String(s || ''); if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s || '-'; return Number(s.slice(8, 10)) + ' ' + BULAN[Number(s.slice(5, 7)) - 1] + ' ' + s.slice(0, 4); };
const tglPendek = s => { s = String(s || ''); if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s || '-'; return Number(s.slice(8, 10)) + ' ' + BLN3[Number(s.slice(5, 7)) - 1] + ' ' + s.slice(0, 4); };
const jam = s => String(s || '').slice(11, 16);
const bulanLabel = p => { p = String(p || ''); const m = Number(p.slice(5, 7)); return m ? BULAN[m - 1] + ' ' + p.slice(0, 4) : p; };
const bulanPendek = p => { p = String(p || ''); const m = Number(p.slice(5, 7)); return m ? BLN3[m - 1] + ' ' + p.slice(0, 4) : p; };
const inisial = n => String(n || '?').replace(/^(Bpk\.|Ibu|Bapak)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const aktif = v => String(v).toUpperCase() === 'Y';
const emailValid = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim());
const hpValid = h => /^08\d{7,12}$/.test(String(h || '').replace(/\D/g, '').replace(/^62/, '0'));
const alokParse = s => String(s || '').split(';').filter(String).map(x => { const p = x.split(':'); return { p: p[0], j: angka(p[1]) }; });
const urutkan = (arr, f, arah = 1) => arr.sort((a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * arah; });
const acak = n => { const a = new Uint8Array(n); (window.crypto || window.msCrypto).getRandomValues(a); return Array.from(a, b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join(''); };
const idemBaru = () => 'IDEM-' + hariIni().replace(/-/g, '') + '-' + acak(8);

/** localStorage aman (iframe/privat dapat melempar galat) */
const LS = {
  get(k, d) { try { const v = localStorage.getItem('simspp.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('simspp.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem('simspp.' + k); } catch (e) { /* abaikan */ } }
};

/**
 * Pemanggil REST API Apps Script → Promise data.
 * POST text/plain (tanpa preflight CORS) berisi {action, token, args}; token sesi di badan, tidak pernah di URL.
 * Galat jaringan/HTTP (e.jaringan = true) dibedakan dari penolakan server (e.kode) → outbox tahu kapan harus mencoba ulang.
 */
async function api(fn, ...args) {
  if (!KONFIG_OK) { const e = new Error('Konfigurasi belum lengkap: isi GAS_URL di js/config.js dengan URL Web App (/exec).'); e.kode = 'KONFIG'; throw e; }
  const isi = { action: fn, args };
  if (fn !== 'masuk') isi.token = S.token;
  indikatorSinkron(1);
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const tm = setTimeout(() => ctl && ctl.abort(), Number(CFG.TIMEOUT_MS) || 60000);
  let res;
  try {
    const r = await fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(isi), redirect: 'follow', credentials: 'omit', cache: 'no-store', signal: ctl ? ctl.signal : undefined });
    if (!r.ok) throw new Error('server membalas HTTP ' + r.status);
    const teks = await r.text();
    try { res = JSON.parse(teks); }
    catch (x) { throw new Error(/<html|<!doctype/i.test(teks) ? 'server membalas halaman HTML — periksa GAS_URL dan akses penerapan "Siapa saja"' : 'respons bukan JSON'); }
  } catch (err) {
    const e = new Error('Tidak dapat menghubungi server (' + (err && err.name === 'AbortError' ? 'waktu habis' : (err && err.message) || 'jaringan') + ').');
    e.jaringan = true; aturOffline(true); throw e;
  } finally { clearTimeout(tm); indikatorSinkron(-1); }
  aturOffline(false);
  if (!res || typeof res !== 'object') throw new Error('Respons server tidak valid.');
  if (res.ok) { if (res.ver && res.ver0 && res.ver0 === S.ver) S.ver = res.ver; return res.data; }
  const e = new Error(res.pesan || 'Permintaan gagal.'); e.kode = res.kode;
  if (res.kode === 'SESI' && S.token) sesiBerakhir();
  throw e;
}
/** GET publik ringan: info branding layar masuk (juga "membangunkan" Web App) */
async function muatInfo() {
  if (!KONFIG_OK) return null;
  try {
    const r = await fetch(GAS_URL + '?action=info', { credentials: 'omit', cache: 'no-store', redirect: 'follow' });
    const j = JSON.parse(await r.text());
    if (j && j.ok && j.data) { LS.set('info', j.data); return j.data; }
  } catch (e) { /* biarkan memakai info tersimpan */ }
  return null;
}
/** Panggilan "kirim lalu lupakan" (sinkron latar) */
function apiLatar(fn, ...args) { api(fn, ...args).catch(e => console.warn(fn + ': ' + e.message)); }

function indikatorSinkron(d) {
  S.sinkron = Math.max(0, S.sinkron + d);
  const p = $('#pillSync'); if (!p) return;
  p.classList.toggle('sinkron', S.sinkron > 0);
  perbaruiPill();
}
function aturOffline(v) { if (S.offline === v) return; S.offline = v; perbaruiPill(); }
function perbaruiPill() {
  const p = $('#pillSync'), t = $('#syncTeks'); if (!p || !t) return;
  const antre = S.outbox.length;
  p.classList.toggle('offline', S.offline || antre > 0);
  t.textContent = S.offline ? 'Luring' + (antre ? ' • ' + antre + ' antre' : '') : antre ? 'Mengirim ' + antre + ' antrean…' : S.sinkron > 0 ? 'Menyinkronkan…' : 'Live Sistem v' + (BOOT.versi || '1.0');
}

// ── Toast ──
function toast(pesan, tipe = 'info', judul = '', ms = 4800) {
  const ikon = { ok: 'check-circle-fill', err: 'x-octagon-fill', warn: 'exclamation-triangle-fill', info: 'info-circle-fill' }[tipe] || 'info-circle-fill';
  const el = document.createElement('div');
  el.className = 'toast-x ' + tipe; el.setAttribute('role', tipe === 'err' ? 'alert' : 'status');
  el.innerHTML = `<i class="bi bi-${ikon}"></i><div>${judul ? `<div class="tj">${esc(judul)}</div>` : ''}<div class="tp">${esc(pesan)}</div></div><button aria-label="Tutup">&times;</button>`;
  el.querySelector('button').onclick = () => el.remove();
  $('#toastWadah').appendChild(el);
  setTimeout(() => el.remove(), tipe === 'err' ? ms + 3000 : ms);
}

// ── Modal (Bootstrap) ──
const M = {};
function modalBs(id) { return bootstrap.Modal.getOrCreateInstance(document.getElementById(id), { focus: false }); }
function bukaModal({ judul, isi, kaki = '', ukuran = '', onBuka = null }) {
  $('#mdlJudul').textContent = judul;
  $('#mdlIsi').innerHTML = isi;
  $('#mdlKaki').innerHTML = kaki;
  $('#mdlKaki').classList.toggle('hidden', !kaki);
  $('#mdlDialog').className = 'modal-dialog modal-dialog-centered modal-dialog-scrollable' + (ukuran ? ' modal-' + ukuran : '');
  modalBs('mdl').show();
  setTimeout(() => { const f = $('#mdlIsi [autofocus]') || $('#mdlIsi input:not([type=hidden]):not([disabled]), #mdlIsi textarea'); if (f) f.focus(); if (onBuka) onBuka(); }, 180);
}
function tutupModal() { modalBs('mdl').hide(); }

/** Konfirmasi (dialog native, di atas modal). input → mengembalikan teks */
function konfirmasi(judul, pesan, { ok = 'Ya, lanjutkan', bahaya = false, input = null } = {}) {
  return new Promise(res => {
    const d = $('#dlgKf');
    $('#kfJudul').textContent = judul; $('#kfPesan').innerHTML = pesan;
    $('#kfInput').innerHTML = input ? `<label class="form-label" for="kfTeks">${esc(input.label)}</label><textarea class="form-control" id="kfTeks" rows="3" placeholder="${esc(input.ph || '')}"></textarea>${input.min ? `<div class="form-text">Minimal ${input.min} karakter.</div>` : ''}` : '';
    const b = $('#kfOk'); b.textContent = ok; b.className = 'btn ' + (bahaya ? 'btn-danger' : 'btn-primary');
    d.returnValue = '';
    d.onclose = () => {
      if (d.returnValue !== 'ok') return res(false);
      if (!input) return res(true);
      const v = $('#kfTeks').value.trim();
      if (input.min && v.length < input.min) { toast('Isian minimal ' + input.min + ' karakter.', 'warn'); return res(false); }
      res(v);
    };
    d.showModal();
    setTimeout(() => (input ? $('#kfTeks') : $('#kfOk')).focus(), 40);
  });
}

function sibuk(btn, on, teks) {
  if (!btn) return;
  if (on) { btn.dataset.html = btn.innerHTML; btn.classList.add('memuat'); btn.disabled = true; btn.innerHTML = '<span class="putar"></span> ' + esc(teks || 'Memproses…'); }
  else { btn.classList.remove('memuat'); btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
}

// ── Pembangun potongan UI ──
const chip = (teks, tone = '', ikon = '') => `<span class="chip ${tone ? 'chip-' + tone : ''}">${ikon ? `<i class="bi bi-${ikon}"></i>` : ''}${esc(teks)}</span>`;
const kosong = (pesan, ikon = 'inbox') => `<div class="kosong"><i class="bi bi-${ikon}"></i>${esc(pesan)}</div>`;
const avatar = (nama, kelas = '') => `<span class="avatar ${kelas}" aria-hidden="true">${esc(inisial(nama))}</span>`;
function kpi({ label, nilai, sub = '', ikon = 'graph-up', tone = '', aksen = '', aksi = '' }) {
  return `<div class="kpi ${aksen ? 'aksen-' + aksen : ''}" ${aksi}>
    <div class="kpi-top"><span class="label">${esc(label)}</span><span class="kpi-ikon ${tone}"><i class="bi bi-${ikon}"></i></span></div>
    <div class="kpi-nilai">${nilai}</div><div class="kpi-sub">${sub}</div></div>`;
}
function opsi(list, val, kosongLabel) {
  return (kosongLabel !== undefined ? `<option value="">${esc(kosongLabel)}</option>` : '') + list.map(o => { const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`; }).join('');
}
function pager(act, page, total, size) {
  const n = Math.max(1, Math.ceil(total / size));
  if (n <= 1) return '';
  const b = [];
  const add = (p, l = p) => b.push(`<button data-act="${act}" data-page="${p}" class="${p === page ? 'aktif' : ''}" aria-label="Halaman ${p}">${l}</button>`);
  b.push(`<button data-act="${act}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Sebelumnya"><i class="bi bi-chevron-left"></i></button>`);
  const set = new Set([1, n, page - 1, page, page + 1].filter(p => p >= 1 && p <= n));
  let prev = 0;
  [...set].sort((a, c) => a - c).forEach(p => { if (p - prev > 1) b.push('<span class="text-mut px-1">…</span>'); add(p); prev = p; });
  b.push(`<button data-act="${act}" data-page="${page + 1}" ${page >= n ? 'disabled' : ''} aria-label="Berikutnya"><i class="bi bi-chevron-right"></i></button>`);
  return `<div class="pager">${b.join('')}</div>`;
}
function thUrut(label, kunci, ui, act, kelas = '') {
  const aktifU = ui.urut === kunci;
  const ik = aktifU ? (ui.arah > 0 || ui.arah === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill') : 'bi-chevron-expand';
  return `<th class="urut ${kelas}" data-act="${act}" data-k="${kunci}" aria-sort="${aktifU ? (ui.arah > 0 || ui.arah === 'asc' ? 'ascending' : 'descending') : 'none'}">${esc(label)}<i class="bi ${ik}"></i></th>`;
}
function peringatan(teks, tone = 'warn', ikon = 'exclamation-triangle') { return `<div class="peringatan ${tone === 'warn' ? '' : tone}"><i class="bi bi-${ikon}"></i><div class="isi">${teks}</div></div>`; }

// ── Muat skrip pustaka berat hanya saat dibutuhkan ──
const _skrip = {};
function muatSkrip(url) {
  if (_skrip[url]) return _skrip[url];
  _skrip[url] = new Promise((ok, gagal) => { const s = document.createElement('script'); s.src = url; s.onload = ok; s.onerror = () => { delete _skrip[url]; gagal(new Error('Gagal memuat pustaka: ' + url)); }; document.head.appendChild(s); });
  return _skrip[url];
}
const URL_XLSX = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
const URL_QR = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
async function qrDataUrl(teks) {
  try { await muatSkrip(URL_QR); const q = qrcode(0, 'M'); q.addData(teks); q.make(); return q.createDataURL(3, 2); } catch (e) { return ''; }
}
/** Ekspor Excel di browser (SheetJS) — tanpa beban server */
async function eksporXlsx(namaFile, lembar) {
  try {
    await muatSkrip(URL_XLSX);
    const wb = XLSX.utils.book_new();
    lembar.forEach(l => { const ws = XLSX.utils.aoa_to_sheet(l.rows); if (l.lebar) ws['!cols'] = l.lebar.map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, l.nama.slice(0, 31)); });
    XLSX.writeFile(wb, namaFile);
    toast('Berkas ' + namaFile + ' diunduh.', 'ok');
  } catch (e) { toast('Ekspor gagal: ' + e.message, 'err'); }
}
function unduhB64(nama, mime, b64) {
  const bin = atob(b64), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([arr], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = nama; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
/** Cetak potongan HTML (kuitansi/laporan) tanpa membuka tab baru */
function cetakHtml(html, ukuran = 'A4 portrait') {
  const area = $('#printArea');
  area.innerHTML = `<style>@page{size:${ukuran};margin:12mm}</style>` + html;
  document.body.classList.add('mencetak');
  const selesai = () => { document.body.classList.remove('mencetak'); area.innerHTML = ''; window.removeEventListener('afterprint', selesai); };
  window.addEventListener('afterprint', selesai);
  setTimeout(() => { window.print(); setTimeout(selesai, 1500); }, 80);
}
function terbilang(n) {
  n = Math.floor(Math.abs(angka(n)));
  const a = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  const t = x => x < 12 ? a[x] : x < 20 ? t(x - 10) + ' belas' : x < 100 ? t(Math.floor(x / 10)) + ' puluh ' + t(x % 10) : x < 200 ? 'seratus ' + t(x - 100) : x < 1000 ? t(Math.floor(x / 100)) + ' ratus ' + t(x % 100) : x < 2000 ? 'seribu ' + t(x - 1000) : x < 1e6 ? t(Math.floor(x / 1000)) + ' ribu ' + t(x % 1000) : x < 1e9 ? t(Math.floor(x / 1e6)) + ' juta ' + t(x % 1e6) : t(Math.floor(x / 1e9)) + ' miliar ' + t(x % 1e9);
  const s = (n === 0 ? 'nol' : t(n)).replace(/\s+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1) + ' rupiah';
}
/** Format input rupiah saat diketik (tanpa melompatkan kursor ke tengah) */
function formatInputRp(el) { const v = angka(el.value); el.value = v ? ribu(v) : ''; }

// ── Delegasi event (satu pendengar untuk seluruh aplikasi) ──
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const f = ACT[el.dataset.act];
  if (!f) return;
  e.preventDefault();
  try { f(el, e); } catch (err) { console.error(err); toast(err.message, 'err'); }
});
document.addEventListener('input', e => { const el = e.target.closest('[data-inp]'); if (el && INP[el.dataset.inp]) INP[el.dataset.inp](el, e); });
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el, e); });

// ── Tema ──
function terapkanTema(t) {
  document.body.classList.add('tema-transisi');
  document.documentElement.setAttribute('data-bs-theme', t);
  LS.set('tema', t);
  const ik = $('#ikonTema'); if (ik) ik.className = 'bi ' + (t === 'dark' ? 'bi-sun' : 'bi-moon-stars');
  setTimeout(() => document.body.classList.remove('tema-transisi'), 300);
  if (S.me) { Object.keys(S.charts).forEach(k => { try { S.charts[k].destroy(); } catch (e) { /* abaikan */ } }); S.charts = {}; rerenderHalaman(); }
}
ACT.gantiTema = () => terapkanTema(document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark');
ACT.lihatSandi = el => { const i = document.getElementById(el.dataset.target); i.type = i.type === 'password' ? 'text' : 'password'; el.innerHTML = `<i class="bi bi-${i.type === 'password' ? 'eye' : 'eye-slash'}"></i>`; };
const warna = n => getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim();
