
// ════════════════════════════════════════════════════════════
// BAGIAN 2 — AUTENTIKASI, DATA LOKAL, ROUTER SPA, SINKRON
// ════════════════════════════════════════════════════════════

function terapkanBranding(b) {
  const nama = (S.set && S.set.NAMA_SEKOLAH) || b.nama || 'SMK Kesehatan Ganda Husada';
  const yys = (S.set && S.set.NAMA_YAYASAN) || b.yayasan || 'Yayasan Pendidikan Ganda Husada';
  const logo = (S.set && S.set.LOGO_URL) || b.logo || '';
  $('#lgSekolah').textContent = nama; $('#lgYayasan').textContent = yys; $('#sbSekolah').textContent = nama;
  $('#lgVersi').textContent = 'SIMSPP v' + (b.versi || '1.0') + ' • ' + nama;
  const isiLogo = logo ? `<img src="${esc(logo)}" alt="Logo ${esc(nama)}">` : 'GH';
  $('#sbLogo').innerHTML = isiLogo; $('#lgLogo').innerHTML = isiLogo;
}
function sembunyikanLoader() { const l = $('#bootLoader'); l.classList.add('pergi'); setTimeout(() => l.remove(), 300); }
function tampilLogin() { $('#appView').classList.add('hidden'); $('#loginView').classList.remove('hidden'); setTimeout(() => $('#lgUser').focus(), 50); }
function tampilApp() { $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden'); }

async function mulai() {
  terapkanTema(LS.get('tema', document.documentElement.getAttribute('data-bs-theme')));
  Object.assign(BOOT, LS.get('info', {}));
  terapkanBranding(BOOT);
  S.outbox = LS.get('outbox', []);
  if (!KONFIG_OK) {
    $('#lgPeringatan').innerHTML = peringatan('Konfigurasi belum lengkap. Isi <code>GAS_URL</code> di berkas <code>js/config.js</code> dengan URL Web App Apps Script (berakhiran <code>/exec</code>), lalu unggah ulang ke GitHub.', 'err', 'gear') + '<div class="mb-3"></div>';
    tampilLogin(); sembunyikanLoader(); return;
  }
  // Info publik diperbarui di latar (login tampil seketika dengan info tersimpan)
  muatInfo().then(i => {
    if (!i) return;
    Object.assign(BOOT, i); terapkanBranding(BOOT); perbaruiPill();
    $('#lgPeringatan').innerHTML = i.siap === false ? peringatan(esc(i.pesan || 'Aplikasi belum disiapkan.'), 'err', 'gear') + '<div class="mb-3"></div>' : '';
  });
  const tok = LS.get('token'), me = LS.get('me');
  if (tok && me) {
    S.token = tok; S.me = me;
    const cache = LS.get('boot.' + me.id);
    if (cache) { hidrasi(cache, true); tampilApp(); go(LS.get('hal', 'dashboard')); sembunyikanLoader(); }
    else $('#bootTeks').textContent = 'Memuat data…';
    try {
      const d = await api('getBootstrap');
      hidrasi(d);
      if (!cache) { tampilApp(); go(LS.get('hal', 'dashboard')); sembunyikanLoader(); }
      kirimOutbox();
      if (S.me.wajibGanti) formGantiSandi(true);
    } catch (e) {
      if (e.kode === 'SESI' || e.kode === 'AKSES') { keluarLokal(); tampilLogin(); }
      else if (!cache) { tampilLogin(); $('#lgPesan').textContent = e.message; }
      else toast('Menampilkan data tersimpan (luring). ' + e.message, 'warn');
      sembunyikanLoader();
    }
  } else { tampilLogin(); sembunyikanLoader(); }
  setInterval(pantauVersi, 30000);
  setInterval(kirimOutbox, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pantauVersi(); });
  window.addEventListener('online', () => { aturOffline(false); kirimOutbox(); });
}

$('#formLogin').addEventListener('submit', async e => {
  e.preventDefault();
  const u = $('#lgUser').value.trim(), p = $('#lgPass').value, btn = $('#lgTombol');
  $('#lgPesan').textContent = '';
  if (!u || !p) { $('#lgPesan').textContent = 'Isi nama pengguna dan kata sandi.'; return; }
  sibuk(btn, true, 'Memeriksa…');
  try {
    const r = await api('masuk', u, p);
    S.token = r.token; S.me = r.me; LS.set('token', r.token); LS.set('me', r.me);
    sibuk(btn, true, 'Memuat data…');
    const d = await api('getBootstrap');
    hidrasi(d); tampilApp(); go('dashboard');
    $('#lgPass').value = '';
    toast('Selamat datang, ' + r.me.nama + '.', 'ok');
    if (r.me.wajibGanti) formGantiSandi(true);
    kirimOutbox();
  } catch (err) { $('#lgPesan').textContent = err.message; $('#lgPass').select(); }
  finally { sibuk(btn, false); }
});

function keluarLokal() {
  if (S.me) LS.del('boot.' + S.me.id);
  LS.del('token'); LS.del('me'); LS.del('hal');
  S.token = null; S.me = null;
  Object.keys(S.charts).forEach(k => { try { S.charts[k].destroy(); } catch (e) { /* abaikan */ } }); S.charts = {};
}
function sesiBerakhir() { keluarLokal(); tutupModal(); tampilLogin(); $('#lgPesan').textContent = 'Sesi berakhir. Silakan masuk kembali.'; }
ACT.keluar = async () => {
  if (S.outbox.length && !(await konfirmasi('Masih ada antrean', `Ada ${S.outbox.length} transaksi yang belum terkirim ke server. Keluar sekarang akan menyimpannya di perangkat ini untuk dikirim saat Anda masuk kembali.`, { ok: 'Tetap keluar' }))) return;
  apiLatar('keluar'); keluarLokal(); tampilLogin(); toast('Anda telah keluar.', 'info');
};
ACT.keluarSemua = async () => {
  if (!(await konfirmasi('Keluar dari semua perangkat?', 'Semua sesi akun Anda (termasuk perangkat ini) akan dicabut.', { ok: 'Keluar semua', bahaya: true }))) return;
  try { await api('keluarSemuaPerangkat'); } catch (e) { /* tetap keluar */ }
  keluarLokal(); tampilLogin(); toast('Semua sesi dicabut.', 'ok');
};
function formGantiSandi(wajib) {
  bukaModal({
    judul: wajib ? 'Ganti Kata Sandi Sementara' : 'Ganti Kata Sandi',
    isi: `${wajib ? peringatan('Akun Anda masih memakai <b>sandi sementara</b>. Demi keamanan, ganti sekarang.', 'info', 'shield-lock') + '<div class="mb-3"></div>' : ''}
      <div class="mb-3"><label class="form-label" for="gsLama">Sandi saat ini</label><input class="form-control" type="password" id="gsLama" autocomplete="current-password" autofocus></div>
      <div class="mb-3"><label class="form-label" for="gsBaru">Sandi baru</label><input class="form-control" type="password" id="gsBaru" autocomplete="new-password"><div class="form-text">Minimal 8 karakter, memuat huruf dan angka.</div></div>
      <div><label class="form-label" for="gsUlang">Ulangi sandi baru</label><input class="form-control" type="password" id="gsUlang" autocomplete="new-password"></div>
      <div class="invalid-msg" id="gsPesan"></div>`,
    kaki: `<button class="btn btn-soft" data-bs-dismiss="modal">${wajib ? 'Nanti' : 'Batal'}</button><button class="btn btn-primary" data-act="simpanSandi"><i class="bi bi-shield-check"></i> Simpan Sandi</button>`
  });
}
ACT.formGantiSandi = () => formGantiSandi(false);
ACT.simpanSandi = async btn => {
  const l = $('#gsLama').value, b = $('#gsBaru').value, u = $('#gsUlang').value, msg = $('#gsPesan');
  if (b !== u) { msg.textContent = 'Ulangan sandi baru tidak sama.'; return; }
  if (b.length < 8 || !/\d/.test(b) || !/[A-Za-z]/.test(b)) { msg.textContent = 'Sandi baru minimal 8 karakter dan memuat huruf serta angka.'; return; }
  sibuk(btn, true, 'Menyimpan…');
  try { const r = await api('gantiSandi', l, b); S.token = r.token; S.me = r.me; LS.set('token', r.token); LS.set('me', r.me); tutupModal(); toast('Kata sandi diganti. Sesi di perangkat lain telah dicabut.', 'ok'); }
  catch (e) { msg.textContent = e.message; } finally { sibuk(btn, false); }
};

// ── Hidrasi data bootstrap → objek + indeks ──
function keObj(n, r) { const o = {}; (S.skema[n] || []).forEach((h, i) => { o[h] = r[i] === undefined || r[i] === null ? '' : r[i]; }); return o; }
function hidrasi(d, dariCache) {
  S.skema = d.skema; S.set = d.set || {}; S.me = Object.assign({}, S.me || {}, d.me);
  S.ver = dariCache ? '0' : d.ver;
  const O = (n, rows) => (rows || []).map(r => keObj(n, r));
  Object.assign(S.db, {
    siswa: O('Siswa', d.siswa), kelas: O('Kelas', d.kelas), jurusan: O('Jurusan', d.jurusan), ta: O('TahunAjaran', d.ta), tarif: O('TarifSPP', d.tarif),
    users: O('Pengguna', d.users), koreksi: O('KoreksiTransaksi', d.koreksi), tg: d.tagihan || {}, agg: d.agg || [],
    pending: O('Pembayaran', d.pending), hariIni: O('Pembayaran', d.hariIni), terbaru: O('Pembayaran', d.terbaru), lampiran: d.lampiran || {}
  });
  terapkanOutboxLokal();
  bangunIndeks();
  if (!dariCache) { LS.set('me', S.me); if (!LS.set('boot.' + S.me.id, d)) console.warn('Cache lokal penuh — data tetap di memori.'); }
  S.cacheRw.clear();
  terapkanBranding(BOOT);
  renderKerangka();
  rerenderHalaman();
}
function bangunIndeks() {
  const I = S.idx;
  I.siswa = new Map(S.db.siswa.map(s => [s.ID, s])); I.nis = new Map(S.db.siswa.map(s => [String(s.NIS), s]));
  I.kelas = new Map(S.db.kelas.map(k => [k.ID, k])); I.jurusan = new Map(S.db.jurusan.map(j => [j.ID, j]));
  I.ta = new Map(S.db.ta.map(t => [t.ID, t])); I.users = new Map(S.db.users.map(u => [u.ID, u]));
  S.memo.clear();
}
const taAktif = () => S.idx.ta.get(S.set.TA_AKTIF) || S.db.ta.find(t => aktif(t.Aktif)) || S.db.ta[S.db.ta.length - 1] || {};
const namaKelas = id => (S.idx.kelas.get(id) || {}).Nama || '-';
const namaJurusan = id => (S.idx.jurusan.get(id) || {}).Nama || '-';
const kodeJurusan = id => (S.idx.jurusan.get(id) || {}).Kode || '-';
const tingkatKelas = id => (S.idx.kelas.get(id) || {}).Tingkat || '';
function periodeTA(ta) {
  ta = ta || taAktif(); const out = [];
  if (!ta.Mulai) return out;
  let y = Number(String(ta.Mulai).slice(0, 4)), m = Number(String(ta.Mulai).slice(5, 7));
  const akhir = String(ta.Selesai).slice(0, 7);
  for (let i = 0; i < 24; i++) { const p = y + '-' + pad(m); if (p > akhir) break; out.push(p); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

/**
 * Status siswa (PRD US-07): LUNAS | SEBAGIAN | BELUM | MENUNGGAK
 * dihitung dari pembayaran TERVERIFIKASI (tertahan transfer tidak dihitung lunas).
 */
function statSiswa(sid) {
  if (S.memo.has(sid)) return S.memo.get(sid);
  const rows = S.db.tg[sid] || [], today = hariIni(), pk = periodeKini();
  const r = { sisaDue: 0, nTunggak: 0, sisaTotal: 0, tertahan: 0, tagihanDue: 0, terbayarDue: 0, adaSebagian: false, sisaBulanIni: 0, tunggakBulan: [], status: 'LUNAS' };
  rows.forEach(([p, n, t, pd, jt]) => {
    const sisa = Math.max(0, n - t);
    r.sisaTotal += sisa; r.tertahan += pd;
    if (jt < today) { r.tagihanDue += n; r.terbayarDue += Math.min(t, n); if (sisa > 0) { r.sisaDue += sisa; r.nTunggak++; r.tunggakBulan.push(p); } }
    if (t > 0 && t < n && p <= pk) r.adaSebagian = true;
    if (p === pk) r.sisaBulanIni = sisa;
  });
  r.status = !rows.length ? 'TANPA' : r.nTunggak ? 'MENUNGGAK' : r.adaSebagian ? 'SEBAGIAN' : r.sisaBulanIni > 0 ? 'BELUM' : 'LUNAS';
  S.memo.set(sid, r);
  return r;
}
function chipStatusSiswa(st) {
  return { LUNAS: chip('Lunas', 'ok'), SEBAGIAN: chip('Sebagian', 'warn'), BELUM: chip('Belum bayar', 'info'), MENUNGGAK: chip(`Menunggak (${st.nTunggak} bln)`, st.nTunggak >= 2 ? 'err' : 'warn'), TANPA: chip('Tanpa tagihan') }[st.status];
}
/** Status satu bulan tagihan [periode, nominal, terbayar, tertahan, jatuhTempo] */
function statusBulan(x) {
  const [p, n, t, pd, jt] = x, sisa = n - t, today = hariIni();
  if (sisa <= 0) return 'LUNAS';
  if (pd > 0 && sisa - pd <= 0) return 'TERTAHAN';
  if (jt < today) return 'MENUNGGAK';
  if (t > 0) return 'SEBAGIAN';
  return p <= periodeKini() ? 'BERJALAN' : 'MENDATANG';
}
const CHIP_BULAN = { LUNAS: ['Lunas', 'ok'], TERTAHAN: ['Menunggu verifikasi', 'info'], MENUNGGAK: ['Menunggak', 'err'], SEBAGIAN: ['Sebagian', 'warn'], BERJALAN: ['Bulan berjalan', 'info'], MENDATANG: ['Mendatang', ''] };
const chipStatusTrx = s => ({ TERVERIFIKASI: chip('Terverifikasi', 'ok'), MENUNGGU: chip('Menunggu verifikasi', 'warn'), DIBATALKAN: chip('Dibatalkan', 'err'), SINKRON: chip('Menyinkronkan', 'info', 'arrow-repeat') }[s] || chip(s));
const labelMetode = (m, b) => ({ TUNAI: '<i class="bi bi-cash-stack"></i> Tunai loket', TRANSFER: '<i class="bi bi-bank"></i> Transfer' + (b ? ' ' + esc(b) : ''), QRIS: '<i class="bi bi-qr-code"></i> QRIS' }[m] || esc(m));

// ── Akses per halaman (tampilan saja; server tetap memeriksa) ──
const SEMUA = [PERAN.YAY, PERAN.OPR, PERAN.BEN], KASIR = [PERAN.OPR, PERAN.BEN];
const AKSES = { dashboard: SEMUA, siswa: SEMUA, tagihan: SEMUA, bayar: KASIR, verifikasi: KASIR, riwayat: SEMUA, koreksi: SEMUA, siaran: [PERAN.OPR], notifikasi: [PERAN.OPR], akademik: SEMUA, tarif: SEMUA, impor: [PERAN.OPR], laporan: SEMUA, pengguna: [PERAN.OPR], pengaturan: [PERAN.OPR, PERAN.YAY] };
const boleh = id => !!(S.me && AKSES[id] && AKSES[id].includes(S.me.peran));
const isOpr = () => S.me && S.me.peran === PERAN.OPR;
const isKasir = () => S.me && KASIR.includes(S.me.peran);
const MENU = [
  { grup: 'Navigasi Utama' },
  { id: 'dashboard', ikon: 'grid-1x2', label: 'Dashboard' },
  { id: 'siswa', ikon: 'people', label: 'Data Siswa', badge: () => S.db.siswa.filter(s => s.Status === 'AKTIF').length },
  { id: 'tagihan', ikon: 'calendar2-week', label: 'Tagihan & Tunggakan', badge: () => S.db.siswa.filter(s => s.Status === 'AKTIF' && statSiswa(s.ID).nTunggak >= 2).length, tone: 'warn' },
  { id: 'bayar', ikon: 'cash-coin', label: 'Catat Pembayaran' },
  { id: 'verifikasi', ikon: 'patch-check', label: 'Verifikasi Transfer', badge: () => S.db.pending.length, tone: 'warn' },
  { id: 'riwayat', ikon: 'receipt', label: 'Riwayat Transaksi' },
  { id: 'koreksi', ikon: 'arrow-left-right', label: 'Persetujuan Koreksi', badge: () => S.db.koreksi.filter(k => k.Status === 'DIAJUKAN').length, tone: 'pri' },
  { grup: 'Modul Komunikasi (W-22)' },
  { id: 'siaran', ikon: 'megaphone', label: 'Siaran Pengingat' },
  { id: 'notifikasi', ikon: 'envelope-paper', label: 'Notifikasi & Kuitansi' },
  { grup: 'Administrasi' },
  { id: 'akademik', ikon: 'mortarboard', label: 'Data Akademik' },
  { id: 'tarif', ikon: 'tags', label: 'Tarif SPP' },
  { id: 'impor', ikon: 'file-earmark-arrow-up', label: 'Impor Data Excel' },
  { id: 'laporan', ikon: 'graph-up-arrow', label: 'Laporan Keuangan' },
  { id: 'pengguna', ikon: 'person-gear', label: 'Pengguna & Hak Akses' },
  { id: 'pengaturan', ikon: 'sliders', label: 'Pengaturan & Log' }
];
function renderKerangka() {
  const me = S.me; if (!me) return;
  $('#uNama').textContent = me.nama; $('#uPeran').textContent = LABEL_PERAN[me.peran] || me.peran; $('#uAvatar').textContent = inisial(me.nama);
  const ta = taAktif();
  $('#sbTA').textContent = 'TA ' + (ta.Nama || '—');
  let html = '', grupTertunda = '';
  MENU.forEach(m => {
    if (m.grup) { grupTertunda = m.grup; return; }
    if (!boleh(m.id)) return;
    if (grupTertunda) { html += `<div class="sb-grup">${esc(grupTertunda)}</div>`; grupTertunda = ''; }
    const n = m.badge ? m.badge() : 0;
    html += `<button class="sb-item" data-act="nav" data-hal="${m.id}" title="${esc(m.label)}"><i class="bi bi-${m.ikon}"></i><span class="tx">${esc(m.label)}</span>${n ? `<span class="lencana ${m.tone || ''}">${n}</span><span class="lencana-mini"></span>` : ''}</button>`;
  });
  $('#sbNav').innerHTML = html;
  tandaiNav(); renderNotif(); perbaruiPill();
}
function tandaiNav() { $$('.sb-item').forEach(b => { const a = b.dataset.hal === S.hal; b.classList.toggle('aktif', a); if (a) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }); }

// ── Router SPA (tanpa server, tanpa ubah URL) ──
const HAL = {};
function go(id, opsi = {}) {
  if (!HAL[id]) id = 'dashboard';
  if (!boleh(id)) { if (S.hal) toast('Halaman ini tidak tersedia untuk peran Anda.', 'warn'); id = 'dashboard'; }
  $$('.halaman').forEach(s => s.classList.toggle('aktif', s.id === 'hal-' + id));
  S.hal = id; LS.set('hal', id);
  tandaiNav(); ACT.tutupSidebar();
  document.title = HAL[id].judul + ' • SIMSPP';
  window.scrollTo(0, 0);
  try { HAL[id].render(opsi); } catch (e) { console.error(e); toast('Gagal menampilkan halaman: ' + e.message, 'err'); }
}
function rerenderHalaman() {
  renderKerangka();
  if (S.hal && HAL[S.hal] && !$('#appView').classList.contains('hidden')) { try { HAL[S.hal].render({ segar: true }); } catch (e) { console.error(e); } }
}
ACT.nav = el => go(el.dataset.hal);
ACT.bukaSidebar = () => { $('#sidebar').classList.add('terbuka'); $('#tirai').classList.remove('hidden'); };
ACT.tutupSidebar = () => { $('#sidebar').classList.remove('terbuka'); $('#tirai').classList.add('hidden'); };
ACT.segarkan = async btn => {
  try { await muatUlang(false); } catch (e) { toast(e.message, 'err'); }
};
async function muatUlang(diam) {
  const d = await api('getBootstrap');
  hidrasi(d);
  if (!diam) toast('Data terbaru dimuat.', 'ok');
}
async function pantauVersi() {
  if (!S.token || document.hidden || S.sinkron > 0) return;
  try { const r = await api('cekVersi'); if (r && r.ver !== S.ver && !(HAL[S.hal] && HAL[S.hal].sedangMengetik && HAL[S.hal].sedangMengetik())) await muatUlang(true); } catch (e) { /* abaikan; indikator luring sudah aktif */ }
}

// ── Pencarian global (lokal, instan) ──
const cariGlobal = $('#cariGlobal'), cariHasil = $('#cariHasil');
let cariFokus = -1, cariItems = [];
function cariSiswaLokal(q, max = 8) {
  q = q.toLowerCase().trim(); if (!q) return [];
  const angkaSaja = /^\d+$/.test(q);
  const hasil = [];
  for (const s of S.db.siswa) {
    const nis = String(s.NIS);
    let skor = 0;
    if (nis === q) skor = 100; else if (angkaSaja && nis.startsWith(q)) skor = 80; else if (s.Nama.toLowerCase().startsWith(q)) skor = 60; else if (s.Nama.toLowerCase().includes(q)) skor = 40; else if (String(s.NamaWali).toLowerCase().includes(q) || String(s.HPWali).includes(q)) skor = 20;
    if (skor) hasil.push([skor - (s.Status === 'AKTIF' ? 0 : 30), s]);
  }
  return hasil.sort((a, b) => b[0] - a[0]).slice(0, max).map(x => x[1]);
}
cariGlobal.addEventListener('input', debounce(() => {
  const q = cariGlobal.value.trim();
  if (!q) { cariHasil.classList.add('hidden'); return; }
  const sw = cariSiswaLokal(q, 6);
  cariItems = sw.map(s => ({ t: 'siswa', s }));
  if (/^(KW|TRX|IMP)-/i.test(q) || q.length >= 4) cariItems.push({ t: 'bukti', q });
  cariFokus = cariItems.length ? 0 : -1;
  cariHasil.innerHTML = cariItems.length ? cariItems.map((it, i) => it.t === 'siswa'
    ? `<div class="cari-item ${i === cariFokus ? 'fokus' : ''}" data-act="cariPilih" data-i="${i}" role="option">${avatar(it.s.Nama, 'lembut')}<div style="min-width:0"><div class="sel-utama">${esc(it.s.Nama)}</div><div class="sel-sub">NIS ${esc(it.s.NIS)} • ${esc(namaKelas(it.s.KelasID))}</div></div><span class="ms-auto">${chipStatusSiswa(statSiswa(it.s.ID))}</span></div>`
    : `<div class="cari-item ${i === cariFokus ? 'fokus' : ''}" data-act="cariPilih" data-i="${i}" role="option"><span class="kpi-ikon"><i class="bi bi-receipt"></i></span><div><div class="sel-utama">Cari transaksi “${esc(it.q)}”</div><div class="sel-sub">Nomor bukti / nama / NIS di riwayat (server)</div></div></div>`).join('')
    : `<div class="p-3 text-mut">Tidak ada hasil.</div>`;
  cariHasil.classList.remove('hidden');
}, 120));
cariGlobal.addEventListener('keydown', e => {
  if (cariHasil.classList.contains('hidden')) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); cariFokus = (cariFokus + (e.key === 'ArrowDown' ? 1 : -1) + cariItems.length) % cariItems.length; $$('.cari-item', cariHasil).forEach((x, i) => x.classList.toggle('fokus', i === cariFokus)); }
  else if (e.key === 'Enter' && cariFokus >= 0) { e.preventDefault(); ACT.cariPilih({ dataset: { i: cariFokus } }); }
  else if (e.key === 'Escape') cariHasil.classList.add('hidden');
});
document.addEventListener('click', e => { if (!e.target.closest('.cari-global')) cariHasil.classList.add('hidden'); if (!e.target.closest('.cari-siswa')) { const h = $('#byHasil'); if (h) h.classList.add('hidden'); } });
ACT.cariPilih = el => {
  const it = cariItems[Number(el.dataset.i)]; cariHasil.classList.add('hidden'); cariGlobal.value = '';
  if (!it) return;
  if (it.t === 'siswa') detailSiswa(it.s.ID);
  else { S.ui.rw = Object.assign(defaultRw(), { q: it.q, preset: 'semua', dari: '', sampai: '' }); go('riwayat'); }
};

// ── Notifikasi dalam aplikasi (PRD US-25 tahap 1) ──
function daftarNotif() {
  const n = [];
  if (isKasir() && S.db.pending.length) {
    const tertua = S.db.pending.reduce((a, p) => (!a || p.Waktu < a ? p.Waktu : a), '');
    n.push({ ikon: 'patch-check', tone: 'warn', judul: S.db.pending.length + ' transfer menunggu verifikasi', sub: rp(S.db.pending.reduce((a, p) => a + angka(p.Jumlah), 0)) + ' • tertua ' + tglPendek(tertua) + ' ' + jam(tertua), hal: 'verifikasi' });
  }
  const diajukan = S.db.koreksi.filter(k => k.Status === 'DIAJUKAN');
  if (isOpr() && diajukan.length) n.push({ ikon: 'arrow-left-right', tone: 'info', judul: diajukan.length + ' pengajuan koreksi/pembatalan', sub: 'Perlu ditinjau Operator', hal: 'koreksi' });
  if (S.me && S.me.peran === PERAN.BEN) S.db.koreksi.filter(k => k.Status !== 'DIAJUKAN' && k.WaktuTinjau && selisihHari(String(k.WaktuTinjau).slice(0, 10), hariIni()) <= 3).forEach(k => n.push({ ikon: k.Status === 'DITERAPKAN' ? 'check2-circle' : 'x-circle', tone: k.Status === 'DITERAPKAN' ? 'ok' : 'err', judul: 'Pengajuan ' + k.NoBukti + ' ' + (k.Status === 'DITERAPKAN' ? 'diterapkan' : 'ditolak'), sub: k.Peninjau + ' • ' + tglPendek(k.WaktuTinjau), hal: 'koreksi' }));
  const kritis = S.db.siswa.filter(s => s.Status === 'AKTIF' && statSiswa(s.ID).nTunggak >= 2);
  if (kritis.length) n.push({ ikon: 'exclamation-triangle', tone: 'err', judul: kritis.length + ' siswa menunggak ≥ 2 bulan', sub: rp(kritis.reduce((a, s) => a + statSiswa(s.ID).sisaDue, 0)) + ' belum tertagih', hal: 'tagihan' });
  if (S.outbox.length) n.push({ ikon: 'cloud-upload', tone: 'warn', judul: S.outbox.length + ' transaksi menunggu dikirim', sub: 'Dikirim ulang otomatis saat koneksi pulih', hal: 'bayar' });
  return n;
}
function renderNotif() {
  const n = daftarNotif(), b = $('#notifJumlah');
  b.textContent = n.length; b.classList.toggle('hidden', !n.length);
  $('#notifMenu').innerHTML = `<div class="px-2 py-2 d-flex justify-content-between align-items-center"><span class="h-sm">Notifikasi</span><span class="chip">${n.length} aktif</span></div>` +
    (n.length ? n.map(x => `<div class="notif-item" data-act="nav" data-hal="${x.hal}"><span class="kpi-ikon ${x.tone}"><i class="bi bi-${x.ikon}"></i></span><div><div class="sel-utama" style="font-size:13px">${esc(x.judul)}</div><div class="sel-sub">${esc(x.sub)}</div></div></div>`).join('') : `<div class="kosong py-4"><i class="bi bi-bell-slash"></i>Tidak ada notifikasi.</div>`);
}

// ── Outbox: transaksi optimistis yang belum dikonfirmasi server ──
function simpanOutbox() {
  const ringan = S.outbox.map(o => Object.assign({}, o, { payload: Object.assign({}, o.payload, { lampiran: (o.payload.lampiran || []).length > 0 && JSON.stringify(o.payload.lampiran).length > 1500000 ? [] : o.payload.lampiran }) }));
  if (!LS.set('outbox', ringan)) LS.set('outbox', S.outbox.map(o => Object.assign({}, o, { payload: Object.assign({}, o.payload, { lampiran: [] }) })));
  perbaruiPill(); renderNotif();
}
function terapkanOutboxLokal() {
  // data dari server belum memuat transaksi di outbox → terapkan lagi agar tampilan konsisten
  S.outbox.forEach(o => {
    if (S.db.hariIni.some(p => p.ID === o.sementara.ID)) return;
    o.snapshot = JSON.parse(JSON.stringify(S.db.tg[o.payload.siswaId] || []));
    terapkanAlokasiLokal(o.payload, o.sementara);
    S.db.hariIni.unshift(o.sementara);
  });
}
let _kirimJalan = false;
async function kirimOutbox() {
  if (_kirimJalan || !S.token || !S.outbox.length) return;
  _kirimJalan = true;
  try { for (const o of S.outbox.slice()) { await kirimSatuOutbox(o); if (S.offline) break; } } finally { _kirimJalan = false; }
}

// ── Pintasan keyboard ──
document.addEventListener('keydown', e => {
  if (!S.me || $('#appView').classList.contains('hidden')) return;
  const modalBuka = document.querySelector('.modal.show');
  if (e.key === 'Escape' && modalBuka && !$('#dlgKf').open) { e.preventDefault(); modalBs($$('.modal.show').pop().id).hide(); return; }
  if (e.key === 'F2') { e.preventDefault(); if ($('#mdlKw').classList.contains('show')) modalBs('mdlKw').hide(); if (isKasir()) { if (S.hal !== 'bayar') go('bayar'); setTimeout(() => { const i = $('#byCari'); i.focus(); i.select(); }, 60); } else cariGlobal.focus(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cariGlobal.focus(); }
  else if (e.key === 'F4' && S.hal === 'bayar' && !modalBuka) { e.preventDefault(); ACT.byMetode({ dataset: { m: 'TUNAI' } }); setTimeout(() => { const i = $('#byDiterima'); if (i) { i.focus(); i.select(); } }, 30); }
  else if (e.key === 'F8' && S.hal === 'bayar' && !modalBuka) { e.preventDefault(); ACT.bySimpan($('#bySimpan')); }
  else if (e.key === 'Escape' && S.hal === 'bayar' && !modalBuka && !$('#dlgKf').open && document.activeElement && !document.activeElement.closest('.cari-hasil')) { if ($('#byHasil') && !$('#byHasil').classList.contains('hidden')) $('#byHasil').classList.add('hidden'); else ACT.byReset(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && $('#mdlKw').classList.contains('show')) { e.preventDefault(); ACT.kwCetak(); }
});
