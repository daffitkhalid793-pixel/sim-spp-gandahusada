
// ════════════════════════════════════════════════════════════
// BAGIAN 4 — LOKET KASIR, KUITANSI, VERIFIKASI, RIWAYAT, KOREKSI
// ════════════════════════════════════════════════════════════

const defaultBy = () => ({ sid: null, pilih: [], metode: 'TUNAI', sebagian: false, jumlah: '', diterima: '', bank: '', ref: '', penyetor: '', catatan: '', berkas: [], cetak: true, email: true, idem: idemBaru() });
S.ui.by = defaultBy();
let _draftDipulihkan = false;
const sisaEf = t => Math.max(0, t[1] - t[2] - t[3]);
function simpanDraftBy() { const d = Object.assign({}, S.ui.by, { berkas: [] }); LS.set('draft.bayar', d); }
function hitungBy() {
  const u = S.ui.by, tg = S.db.tg[u.sid] || [];
  const pilih = tg.filter(t => u.pilih.includes(t[0])).sort((a, b) => a[0] < b[0] ? -1 : 1);
  const subtotal = pilih.reduce((a, t) => a + sisaEf(t), 0), admin = Math.max(0, angka(S.set.BIAYA_ADMIN));
  const jumlah = u.sebagian && angka(u.jumlah) > 0 ? Math.min(angka(u.jumlah), subtotal) : subtotal;
  const total = jumlah + admin, diterima = u.metode === 'TUNAI' ? angka(u.diterima) : total;
  return { pilih, subtotal, admin, jumlah, total, diterima, kembali: diterima - total };
}
HAL.bayar = {
  judul: 'Catat Pembayaran',
  sedangMengetik: () => { const a = document.activeElement; return !!(a && a.closest && a.closest('#hal-bayar') && /INPUT|TEXTAREA|SELECT/.test(a.tagName)); },
  render(opsi = {}) {
    if (!_draftDipulihkan) {
      _draftDipulihkan = true;
      const d = LS.get('draft.bayar');
      if (d && d.sid && S.idx.siswa.get(d.sid) && !opsi.sid) { S.ui.by = Object.assign(defaultBy(), d, { berkas: [] }); toast('Draft transaksi sebelumnya dipulihkan.', 'info'); }
    }
    if (opsi.sid) pilihSiswaBy(opsi.sid, opsi.periode, true);
    $('#byIdem').textContent = '#' + S.ui.by.idem.slice(5);
    $('#byBanner').innerHTML = S.outbox.length ? `<div class="mb-3">${peringatan(`<b>${S.outbox.length} transaksi</b> belum dikonfirmasi server dan akan dikirim ulang otomatis. ID idempoten menjamin tidak ada pencatatan ganda.`, 'warn', 'cloud-upload')}</div>` : '';
    renderBySiswa(); renderByBulan(); renderByPanel(); renderByRekap();
    if (!opsi.segar && !S.ui.by.sid) setTimeout(() => $('#byCari') && $('#byCari').focus(), 60);
  }
};
function pilihSiswaBy(sid, periode, diam) {
  const s = S.idx.siswa.get(sid); if (!s) return;
  const u = S.ui.by, ganti = u.sid !== sid;
  if (ganti) Object.assign(u, { sid, pilih: [], sebagian: false, jumlah: '', diterima: '', penyetor: s.NamaWali || '', berkas: [], ref: '' });
  const tg = S.db.tg[sid] || [], pk = periodeKini();
  if (periode) { if (!u.pilih.includes(periode) && tg.some(t => t[0] === periode && sisaEf(t) > 0)) u.pilih.push(periode); }
  else if (ganti) u.pilih = tg.filter(t => sisaEf(t) > 0 && (t[4] < hariIni() || t[0] <= pk)).map(t => t[0]);
  u.email = emailValid(s.EmailWali) && S.set.EMAIL_TANDA_TERIMA === 'Y';
  $('#byHasil') && $('#byHasil').classList.add('hidden');
  if (!diam) { renderBySiswa(); renderByBulan(); renderByPanel(); }
  simpanDraftBy();
  $('#byTerakhir').classList.add('hidden');
  api('cariPembayaran', { siswaId: sid, size: 1, status: 'TERVERIFIKASI' }).then(r => {
    const el = $('#byTerakhir'); if (!el || S.ui.by.sid !== sid) return;
    const p = r.rows[0] ? keObj('Pembayaran', r.rows[0]) : null;
    el.classList.remove('hidden');
    el.innerHTML = `<div class="d-flex align-items-center gap-3 flex-wrap"><span class="kpi-ikon"><i class="bi bi-journal-text"></i></span><div style="flex:1;min-width:200px"><div class="sel-utama">Buku Bantu SPP Terakhir</div><div class="sel-sub">${p ? `Terakhir bayar ${tglLabel(p.Tanggal)} • ${alokParse(p.Alokasi).map(a => bulanPendek(a.p)).join(', ')} • ${rp(p.Jumlah)} via ${esc(p.Metode.toLowerCase())}` : 'Belum ada pembayaran terverifikasi.'}</div></div><button class="btn btn-outline-primary btn-sm" data-act="detailSiswa" data-id="${sid}">Buku besar lengkap</button></div>`;
  }).catch(() => { /* informasi tambahan saja */ });
}
function renderBySiswa() {
  const u = S.ui.by, s = S.idx.siswa.get(u.sid), el = $('#bySiswa');
  if (!s) { el.innerHTML = `<div class="kosong py-4"><i class="bi bi-person-badge"></i>Pindai kartu SPP atau ketik NIS/nama siswa untuk memulai transaksi.</div>`; return; }
  const x = statSiswa(s.ID);
  el.innerHTML = `<div class="kartu-siswa">${avatar(s.Nama, 'besar')}
    <div style="flex:1;min-width:0"><div class="d-flex align-items-center gap-2 flex-wrap"><span class="h-md">${esc(s.Nama)}</span>${chip(s.Kategori === 'DISPENSASI' ? 'Dispensasi' : 'Aktif (reguler)', s.Kategori === 'DISPENSASI' ? 'info' : 'ok')}</div>
      <div class="text-2 mt-1 num">NIS <b>${esc(s.NIS)}</b> • ${esc(namaKelas(s.KelasID))} • ${esc(namaJurusan(s.JurusanID))}</div>
      <div class="sel-sub mt-1">${s.EmailWali ? `<i class="bi bi-envelope"></i> ${esc(s.EmailWali)}` : '<i class="bi bi-envelope-x"></i> Email wali belum diisi'}</div></div>
    <div class="text-end" style="min-width:150px"><div class="lbl-sm text-mut">Wali murid</div><div class="sel-utama">${esc(s.NamaWali || '-')}</div><div class="sel-sub num">${esc(s.HPWali || '')}</div><button class="btn btn-ghost btn-sm mt-1" data-act="byGanti"><i class="bi bi-arrow-repeat"></i> Ganti siswa</button></div></div>
    ${x.nTunggak ? peringatan(`<div class="d-flex justify-content-between flex-wrap gap-2"><div><b>Kewajiban menunggak: ${x.nTunggak} bulan belum diselesaikan</b><div>Periode ${x.tunggakBulan.map(bulanLabel).join(', ')}.</div></div><div class="text-end"><div class="lbl-sm">Akumulasi tunggakan</div><b class="text-err rp-md">${rp(x.sisaDue)}</b></div></div>`, x.nTunggak >= 2 ? 'err' : 'warn')
      : x.tertahan ? peringatan(`Ada transfer <b>${rp(x.tertahan)}</b> menunggu verifikasi untuk siswa ini — bulan terkait dikunci agar tidak ditagih dua kali.`, 'info', 'hourglass-split') : peringatan('Tidak ada tunggakan jatuh tempo. Siswa dapat membayar bulan berjalan atau di muka.', 'ok', 'check2-circle')}`;
}
function renderByBulan() {
  const u = S.ui.by, el = $('#byBulan'), s = S.idx.siswa.get(u.sid);
  if (!s) { el.innerHTML = `<div class="h-md mb-1">Matriks Pembayaran SPP</div><p class="text-2 mb-0">Pilih siswa terlebih dahulu.</p>`; return; }
  const ta = taAktif(), tg = (S.db.tg[u.sid] || []).filter(t => t[5] === ta.ID || sisaEf(t) > 0 || t[3] > 0);
  const k = hitungBy();
  el.innerHTML = `<div class="kartu-head"><div><div class="h-md">Matriks Pembayaran SPP (TA ${esc(ta.Nama || '')})</div><div class="text-2" style="font-size:13px">Centang periode bulan yang dibayarkan pada sesi loket ini.</div></div>
      <div class="d-flex gap-2"><button class="btn btn-sm btn-outline-primary" data-act="byPilihTunggak">Pilih semua tunggakan</button><button class="btn btn-sm btn-soft" data-act="byBulanIni">Bulan ini saja</button><button class="btn btn-sm btn-ghost" data-act="byKosongkan" aria-label="Kosongkan pilihan"><i class="bi bi-x-lg"></i></button></div></div>
    <div class="bln-list">${tg.map(t => {
      const st = statusBulan(t), sisa = sisaEf(t), dipilih = u.pilih.includes(t[0]), terlambat = st === 'MENUNGGAK' ? selisihHari(t[4], hariIni()) : 0;
      const ket = st === 'LUNAS' ? 'Terbayar penuh' : st === 'TERTAHAN' ? 'Transfer ' + rp(t[3]) + ' menunggu verifikasi' : st === 'MENUNGGAK' ? `Jatuh tempo ${tglLabel(t[4])} (lewat ${terlambat} hari)${t[2] ? ' • terbayar ' + rp(t[2]) : ''}` : `Jatuh tempo ${tglLabel(t[4])}${t[2] ? ' • terbayar ' + rp(t[2]) : ''}`;
      const c = CHIP_BULAN[st];
      return `<div class="bln ${sisa <= 0 ? 'lunas' : ''} ${st === 'MENUNGGAK' ? 'tunggak' : ''} ${dipilih ? 'pilih' : ''}" ${sisa > 0 ? `data-act="byToggle" data-p="${t[0]}" role="checkbox" aria-checked="${dipilih}" tabindex="0"` : ''}>
        <input type="checkbox" class="form-check-input" ${dipilih ? 'checked' : ''} ${sisa <= 0 ? 'disabled' : ''} tabindex="-1" aria-label="${bulanLabel(t[0])}">
        <div><div class="bln-nama">${bulanLabel(t[0])} ${chip(t[5] !== ta.ID ? 'Tunggakan lama' : c[0], t[5] !== ta.ID ? 'warn' : c[1])}</div><div class="bln-ket">${ket}</div></div>
        <div class="bln-nom"><div>${rp(sisa > 0 ? sisa : t[1])}</div><div class="lbl-sm text-mut">${sisa <= 0 ? 'Terbayar' : t[2] > 0 ? 'Sisa tagihan' : 'Tarif SPP'}</div></div></div>`;
    }).join('') || kosong('Siswa belum memiliki tagihan. Operator dapat membuat tagihan di menu Tagihan & Tunggakan.', 'calendar-x')}</div>
    <div class="kartu-2 mt-3 d-flex justify-content-between align-items-center flex-wrap gap-2"><span><i class="bi bi-ui-checks text-pri"></i> Terpilih: <b>${k.pilih.length} bulan</b>${k.pilih.length ? ' (' + k.pilih.map(t => bulanPendek(t[0])).join(', ') + ')' : ''}</span><b class="rp-lg text-pri">${rp(k.subtotal)}</b></div>`;
}
function renderByPanel() {
  const u = S.ui.by, s = S.idx.siswa.get(u.sid), me = S.me;
  const jamNow = new Date().getHours(), sesi = jamNow < 12 ? 'Sesi pagi' : jamNow < 15 ? 'Sesi siang' : 'Sesi sore';
  const bankOps = String(S.set.BANK_PILIHAN || 'BSI').split(',').map(x => x.trim()).filter(Boolean);
  const bisaEmail = s && emailValid(s.EmailWali) && S.set.EMAIL_TANDA_TERIMA === 'Y';
  $('#byPanel').innerHTML = `
    <div class="kartu-2 d-flex align-items-center gap-3">${avatar(me.nama, 'sedang')}<div style="flex:1;min-width:0"><div class="sel-utama">${esc(me.nama)}</div><div class="sel-sub">${esc(LABEL_PERAN[me.peran])}</div></div><div class="text-end"><span class="chip chip-info">${esc(me.drawer || 'LOKET')}</span><div class="sel-sub mt-1">${sesi} aktif</div></div></div>
    <div><div class="label mb-2">Metode Pembayaran</div><div class="metode-pilih" role="radiogroup" aria-label="Metode pembayaran">
      ${[['TUNAI', 'cash-stack', 'Tunai Loket', 'Cash • F4'], ['TRANSFER', 'bank', 'Transfer Bank', 'Perlu verifikasi'], ['QRIS', 'qr-code', 'QRIS Kasir', 'Perlu verifikasi']].map(m => `<button class="${u.metode === m[0] ? 'aktif' : ''}" data-act="byMetode" data-m="${m[0]}" role="radio" aria-checked="${u.metode === m[0]}"><i class="bi bi-${m[1]}"></i>${m[2]}<small>${m[3]}</small></button>`).join('')}</div></div>
    <div class="kartu-2" id="byRingkas"></div>
    <div><a href="#" data-act="bySebagian" style="font-size:13px"><i class="bi bi-${u.sebagian ? 'dash' : 'plus'}-circle"></i> ${u.sebagian ? 'Batalkan pembayaran sebagian' : 'Bayar sebagian (dialokasikan ke bulan terlama)'}</a>
      ${u.sebagian ? `<div class="mt-2"><label class="form-label" for="byJumlah">Jumlah yang dibayar</label><div class="rp-group"><span class="rp-tag">Rp</span><input id="byJumlah" inputmode="numeric" data-inp="byJumlah" value="${u.jumlah ? ribu(u.jumlah) : ''}" autocomplete="off"></div><div class="form-text">Tidak boleh melebihi total tagihan terpilih.</div></div>` : ''}</div>
    ${u.metode === 'TUNAI' ? `<div><div class="d-flex justify-content-between"><label class="label" for="byDiterima">Nominal uang diterima (cash in)</label><span class="lbl-sm text-mut">Fokus [F4]</span></div>
      <div class="rp-group besar mt-1"><span class="rp-tag">Rp</span><input id="byDiterima" inputmode="numeric" data-inp="byDiterima" value="${u.diterima ? ribu(u.diterima) : ''}" autocomplete="off" aria-describedby="byKembali"></div>
      <div class="chip-cepat" id="byChipCepat"></div><div id="byKembali" aria-live="polite"></div></div>`
    : `<div class="tumpuk" style="--x:0"><div class="grid-2s" style="gap:.75rem"><div><label class="form-label" for="byBank">${u.metode === 'QRIS' ? 'Kanal' : 'Bank pengirim'}</label><select class="form-select" id="byBank" data-chg="byBank">${opsi(u.metode === 'QRIS' ? ['QRIS'] : bankOps, u.bank || (u.metode === 'QRIS' ? 'QRIS' : bankOps[0]))}</select></div><div><label class="form-label" for="byRef">No. referensi</label><input class="form-control" id="byRef" data-inp="byTeks" data-k="ref" value="${esc(u.ref)}" placeholder="opsional"></div></div>
      <div><label class="form-label">Bukti transfer (maks ${esc(S.set.MAKS_LAMPIRAN || 3)} berkas, JPG/PNG/PDF ≤ ${esc(S.set.MAKS_BERKAS_MB || 5)} MB)</label><div class="unggah" data-act="byPilihBerkas" id="byUnggah" tabindex="0" role="button"><i class="bi bi-cloud-arrow-up" style="font-size:22px"></i><div>Klik atau seret berkas ke sini</div></div><div class="berkas-list" id="byBerkas"></div></div>
      ${peringatan('Transaksi tercatat <b>Menunggu Verifikasi</b>. Saldo tagihan baru berubah setelah diverifikasi terhadap mutasi rekening.', 'info', 'info-circle')}</div>`}
    <div><label class="form-label" for="byPenyetor">Nama penyetor</label><input class="form-control" id="byPenyetor" data-inp="byTeks" data-k="penyetor" value="${esc(u.penyetor)}" placeholder="Wali murid / siswa"></div>
    <div><div class="label mb-2">Kelengkapan bukti &amp; notifikasi</div>
      <div class="form-check mb-2"><input class="form-check-input" type="checkbox" id="byCetak" data-chg="byCek" data-k="cetak" ${u.cetak ? 'checked' : ''}><label class="form-check-label" for="byCetak"><b>Cetak bukti pembayaran resmi otomatis</b><div class="sel-sub">Format A5 lanskap dengan kop yayasan & kode verifikasi</div></label></div>
      <div class="form-check mb-2"><input class="form-check-input" type="checkbox" id="byEmail" data-chg="byCek" data-k="email" ${u.email && bisaEmail ? 'checked' : ''} ${bisaEmail ? '' : 'disabled'}><label class="form-check-label" for="byEmail"><b>Kirim tanda terima email</b><div class="sel-sub">${s ? (emailValid(s.EmailWali) ? esc(s.EmailWali) + (S.set.EMAIL_TANDA_TERIMA === 'Y' ? '' : ' • fitur nonaktif di Pengaturan') : 'Email wali belum diisi') : '—'}</div></label></div>
      <div class="form-check"><input class="form-check-input" type="checkbox" disabled id="byWa"><label class="form-check-label text-mut" for="byWa"><b>WhatsApp tanda terima</b><div class="sel-sub">${S.set.WA_PROVIDER === 'NONAKTIF' ? 'Pengembangan lanjutan (PRD 4.3)' : 'Diatur di Notifikasi & Kuitansi'}</div></label></div></div>
    <div><label class="form-label" for="byCatatan">Catatan audit loket</label><textarea class="form-control" id="byCatatan" rows="2" data-inp="byTeks" data-k="catatan" placeholder="mis. pembayaran tunai oleh wali di loket">${esc(u.catatan)}</textarea></div>
    <button class="btn btn-primary btn-lg w-100" id="bySimpan" data-act="bySimpan"><i class="bi bi-printer"></i> Simpan Transaksi &amp; Terbitkan Bukti <kbd class="ms-1">F8</kbd></button>
    <div class="grid-2s" style="gap:.5rem"><button class="btn btn-soft" data-act="byDraft"><i class="bi bi-floppy"></i> Simpan draft</button><button class="btn btn-soft" data-act="byReset"><i class="bi bi-arrow-counterclockwise"></i> Batal / Reset <kbd>Esc</kbd></button></div>`;
  renderBerkasBy(); perbaruiRingkasBy();
  const z = $('#byUnggah');
  if (z) {
    ['dragenter', 'dragover'].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.add('seret'); }));
    ['dragleave', 'drop'].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.remove('seret'); }));
    z.addEventListener('drop', e => tambahBerkasBy(e.dataTransfer.files));
  }
}
/** Pembaruan terarah (tanpa merender ulang input) agar mengetik tetap mulus */
function perbaruiRingkasBy() {
  const u = S.ui.by, k = hitungBy(), r = $('#byRingkas'); if (!r) return;
  r.innerHTML = `<div class="ringkas-baris"><span>Subtotal tagihan terpilih (${k.pilih.length} bulan)</span><b>${rp(k.subtotal)}</b></div>
    ${u.sebagian && k.jumlah < k.subtotal ? `<div class="ringkas-baris"><span>Dibayar sebagian</span><b class="text-warn">${rp(k.jumlah)}</b></div>` : ''}
    <div class="ringkas-baris"><span>Biaya administrasi loket</span><b class="${k.admin ? '' : 'text-ok'}">${k.admin ? rp(k.admin) : 'Rp 0 (bebas biaya)'}</b></div>
    <div class="total-besar"><span class="label" style="color:var(--text)">Total harus dibayar</span><span class="nilai">${rp(k.total)}</span></div>`;
  const cc = $('#byChipCepat');
  if (cc) {
    const cand = [k.total]; [50000, 100000, 500000, 1000000, 2000000, 5000000].forEach(b => { const v = Math.floor(k.total / b) * b + b; if (!cand.includes(v) && cand.length < 4) cand.push(v); });
    const vals = cand.slice(0, 4);
    cc.innerHTML = vals.map((v, i) => `<button data-act="byCepat" data-v="${v}" class="${angka(u.diterima) === v ? 'aktif' : ''}">${i === 0 ? 'Uang pas' : ribu(v)}</button>`).join('');
  }
  const kb = $('#byKembali');
  if (kb) kb.innerHTML = !u.diterima ? '' : `<div class="kembalian ${k.kembali < 0 ? 'kurang' : ''}"><div class="d-flex justify-content-between align-items-center"><span class="lbl-sm"><i class="bi bi-${k.kembali < 0 ? 'exclamation-circle' : 'arrow-return-left'}"></i> ${k.kembali < 0 ? 'Uang kurang' : 'Uang kembalian siswa'}</span><span class="lbl-sm">${k.kembali < 0 ? 'Belum cukup' : 'Tervalidasi sesuai'}</span></div><div class="nilai">${rp(Math.abs(k.kembali))}</div><div class="text-end" style="font-size:12px;opacity:.85">Dihitung otomatis: ${rp(k.diterima)} − ${rp(k.total)}</div></div>`;
  const ok = u.sid && k.pilih.length && k.jumlah > 0 && (u.metode !== 'TUNAI' || k.kembali >= 0);
  const b = $('#bySimpan'); if (b) b.disabled = !ok;
  $('#byBarBawah').innerHTML = u.sid ? `<div style="flex:1"><div class="lbl-sm text-mut">Total</div><b class="rp-md">${rp(k.total)}</b></div><button class="btn btn-primary" data-act="bySimpan" ${ok ? '' : 'disabled'}><i class="bi bi-check2-circle"></i> Simpan (F8)</button>` : '';
}
function renderByRekap() {
  const saya = S.db.hariIni.filter(p => p.PetugasID === S.me.id && p.Status !== 'DIBATALKAN');
  const tunai = saya.filter(p => p.Metode === 'TUNAI').reduce((a, p) => a + angka(p.Jumlah) + angka(p.Admin), 0), target = angka(S.set.TARGET_SETORAN) || 1;
  $('#byRekap').innerHTML = `<div class="d-flex justify-content-between align-items-center mb-2"><span class="label">Rekap kas masuk sesi ini</span><span class="chip chip-ok">${saya.length} transaksi</span></div>
    <div class="ringkas-baris"><span>Total tunai di laci kasir</span><b class="rp-md">${rp(tunai)}</b></div><div class="bar ok mt-1"><span style="width:${Math.min(100, pct(tunai, target))}%"></span></div>
    <div class="text-end text-mut mt-1" style="font-size:12px">Target setoran bank harian: ${rp(target)}</div>`;
}
// Pencarian siswa di loket (pemindai: Enter pada NIS persis → langsung pilih)
let byFokus = 0, byList = [];
function renderHasilBy(q) {
  const h = $('#byHasil'); byList = cariSiswaLokal(q, 8); byFokus = 0;
  if (!q.trim()) { h.classList.add('hidden'); return; }
  h.innerHTML = byList.length ? byList.map((s, i) => { const x = statSiswa(s.ID); return `<div class="cari-item ${i === byFokus ? 'fokus' : ''}" data-act="byPilih" data-id="${s.ID}" role="option">${avatar(s.Nama, 'lembut')}<div style="min-width:0"><div class="sel-utama">${esc(s.Nama)} ${s.Status !== 'AKTIF' ? chip(s.Status) : ''}</div><div class="sel-sub num">NIS ${esc(s.NIS)} • ${esc(namaKelas(s.KelasID))}</div></div><div class="ms-auto text-end">${chipStatusSiswa(x)}${x.sisaDue ? `<div class="sel-sub text-err num">${rp(x.sisaDue)}</div>` : ''}</div></div>`; }).join('') : '<div class="p-3 text-mut">Siswa tidak ditemukan.</div>';
  h.classList.remove('hidden');
}
document.addEventListener('input', e => { if (e.target.id === 'byCari') renderHasilBy(e.target.value); });
document.addEventListener('keydown', e => {
  if (e.target.id !== 'byCari') return;
  const h = $('#byHasil');
  if (e.key === 'Enter') {
    e.preventDefault();
    const q = e.target.value.trim(), persis = S.idx.nis.get(q);
    const s = persis || byList[byFokus];
    if (s) { e.target.value = ''; h.classList.add('hidden'); pilihSiswaBy(s.ID); if (persis) toast('Kartu terbaca: ' + s.Nama, 'ok', '', 1800); }
  } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && byList.length) {
    e.preventDefault(); byFokus = (byFokus + (e.key === 'ArrowDown' ? 1 : -1) + byList.length) % byList.length;
    $$('.cari-item', h).forEach((x, i) => x.classList.toggle('fokus', i === byFokus));
  }
});
ACT.byPilih = el => { $('#byCari').value = ''; pilihSiswaBy(el.dataset.id); };
ACT.byGanti = () => { S.ui.by = Object.assign(defaultBy(), { idem: S.ui.by.idem, metode: S.ui.by.metode, cetak: S.ui.by.cetak }); HAL.bayar.render(); };
ACT.byToggle = el => { const u = S.ui.by, p = el.dataset.p, i = u.pilih.indexOf(p); if (i >= 0) u.pilih.splice(i, 1); else u.pilih.push(p); renderByBulan(); perbaruiRingkasBy(); simpanDraftBy(); };
ACT.byPilihTunggak = () => { const u = S.ui.by; u.pilih = (S.db.tg[u.sid] || []).filter(t => sisaEf(t) > 0 && t[4] < hariIni()).map(t => t[0]); renderByBulan(); perbaruiRingkasBy(); simpanDraftBy(); };
ACT.byBulanIni = () => { const u = S.ui.by; u.pilih = (S.db.tg[u.sid] || []).filter(t => sisaEf(t) > 0 && t[0] === periodeKini()).map(t => t[0]); renderByBulan(); perbaruiRingkasBy(); simpanDraftBy(); };
ACT.byKosongkan = () => { S.ui.by.pilih = []; renderByBulan(); perbaruiRingkasBy(); simpanDraftBy(); };
ACT.byMetode = el => { const u = S.ui.by; u.metode = el.dataset.m; u.bank = u.metode === 'QRIS' ? 'QRIS' : ''; if (S.hal === 'bayar') { renderByPanel(); simpanDraftBy(); } };
ACT.bySebagian = () => { S.ui.by.sebagian = !S.ui.by.sebagian; S.ui.by.jumlah = ''; renderByPanel(); if (S.ui.by.sebagian) setTimeout(() => $('#byJumlah').focus(), 30); };
ACT.byCepat = el => { S.ui.by.diterima = Number(el.dataset.v); $('#byDiterima').value = ribu(el.dataset.v); perbaruiRingkasBy(); simpanDraftBy(); };
INP.byDiterima = el => { formatInputRp(el); S.ui.by.diterima = angka(el.value); perbaruiRingkasBy(); simpanDraftBy(); };
INP.byJumlah = el => { formatInputRp(el); S.ui.by.jumlah = angka(el.value); perbaruiRingkasBy(); };
INP.byTeks = el => { S.ui.by[el.dataset.k] = el.value; simpanDraftBy(); };
CHG.byBank = el => { S.ui.by.bank = el.value; simpanDraftBy(); };
CHG.byCek = el => { S.ui.by[el.dataset.k] = el.checked; simpanDraftBy(); };
ACT.byDraft = () => { simpanDraftBy(); toast('Draft disimpan di perangkat ini. Akan dipulihkan saat loket dibuka lagi.', 'ok'); };
ACT.byReset = async () => {
  const u = S.ui.by;
  if (u.sid && u.pilih.length && !(await konfirmasi('Batalkan transaksi ini?', 'Isian formulir loket akan dikosongkan. Tidak ada data yang tersimpan ke server.', { ok: 'Ya, kosongkan' }))) return;
  S.ui.by = Object.assign(defaultBy(), { metode: u.metode, cetak: u.cetak }); LS.del('draft.bayar'); HAL.bayar.render();
};
ACT.byPilihBerkas = () => { const f = $('#berkasTersembunyi'); f.multiple = true; f.accept = '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf'; f.value = ''; f.onchange = () => tambahBerkasBy(f.files); f.click(); };
/** Baca & kompres berkas bukti (gambar diperkecil di browser → unggah cepat) */
async function bacaBerkas(fileList, sudah = 0) {
  const maks = angka(S.set.MAKS_LAMPIRAN) || 3, mb = angka(S.set.MAKS_BERKAS_MB) || 5, out = [];
  for (const f of Array.from(fileList)) {
    if (sudah + out.length >= maks) { toast('Maksimal ' + maks + ' lampiran per transaksi.', 'warn'); break; }
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) { toast(`"${f.name}" ditolak: format harus JPG, JPEG, PNG, atau PDF.`, 'err'); continue; }
    let mime = f.type || (ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg');
    let dataUrl = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
    if (mime !== 'application/pdf' && f.size > 400 * 1024) {
      try {
        const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = dataUrl; });
        const sk = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * sk); c.height = Math.round(img.height * sk); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        dataUrl = c.toDataURL('image/jpeg', 0.82); mime = 'image/jpeg';
      } catch (e) { /* pakai berkas asli */ }
    }
    const b64 = dataUrl.split(',')[1], ukuran = Math.floor(b64.length * 3 / 4);
    if (ukuran > mb * 1048576) { toast(`"${f.name}" melebihi batas ${mb} MB.`, 'err'); continue; }
    out.push({ nama: mime === 'image/jpeg' && ext === 'png' ? f.name.replace(/\.png$/i, '.jpg') : f.name, mime, b64, ukuran, pratinjau: mime === 'application/pdf' ? '' : dataUrl });
  }
  return out;
}
async function tambahBerkasBy(files) { const baru = await bacaBerkas(files, S.ui.by.berkas.length); S.ui.by.berkas.push(...baru); renderBerkasBy(); }
function renderBerkasBy() {
  const el = $('#byBerkas'); if (!el) return;
  el.innerHTML = S.ui.by.berkas.map((b, i) => `<div class="berkas">${b.pratinjau ? `<img src="${b.pratinjau}" alt="">` : '<i class="bi bi-file-earmark-pdf text-err" style="font-size:22px"></i>'}<div style="flex:1;min-width:0"><div class="text-truncate fw-semibold">${esc(b.nama)}</div><div class="text-mut">${(b.ukuran / 1024).toFixed(0)} KB</div></div><button class="btn btn-ghost btn-sm btn-icon" data-act="byHapusBerkas" data-i="${i}" aria-label="Hapus berkas"><i class="bi bi-trash"></i></button></div>`).join('');
}
ACT.byHapusBerkas = el => { S.ui.by.berkas.splice(Number(el.dataset.i), 1); renderBerkasBy(); };

/** Terapkan alokasi FIFO ke tagihan lokal (pratinjau optimistis, server tetap otoritatif) */
function terapkanAlokasiLokal(payload, sementara) {
  const tg = S.db.tg[payload.siswaId] || [];
  let sisa = payload.jumlah; const alok = [];
  tg.filter(t => payload.periode.includes(t[0])).sort((a, b) => a[0] < b[0] ? -1 : 1).forEach(t => {
    const a = Math.min(sisaEf(t), sisa); if (a <= 0) return; sisa -= a;
    if (payload.metode === 'TUNAI') t[2] += a; else t[3] += a;
    alok.push(t[0] + ':' + a);
  });
  if (sementara) sementara.Alokasi = alok.join(';');
  S.memo.delete(payload.siswaId);
}
ACT.bySimpan = async () => {
  const u = S.ui.by, k = hitungBy(), s = S.idx.siswa.get(u.sid);
  if (!s) { toast('Pilih siswa terlebih dahulu (F2).', 'warn'); return; }
  if (!k.pilih.length) { toast('Pilih minimal satu bulan tagihan.', 'warn'); return; }
  if (k.jumlah <= 0) { toast('Jumlah pembayaran harus lebih dari nol.', 'warn'); return; }
  if (u.metode === 'TUNAI' && k.kembali < 0) { toast('Uang diterima kurang ' + rp(-k.kembali) + '.', 'warn'); $('#byDiterima').focus(); return; }
  if (u.metode !== 'TUNAI' && S.set.WAJIB_BUKTI_TRANSFER === 'Y' && !u.berkas.length) { toast('Unggah minimal satu bukti transfer.', 'warn'); return; }
  const payload = { idem: u.idem, siswaId: s.ID, periode: k.pilih.map(t => t[0]), jumlah: k.jumlah, metode: u.metode, diterima: k.diterima, bank: u.metode === 'TUNAI' ? '' : (u.bank || (u.metode === 'QRIS' ? 'QRIS' : String(S.set.BANK_PILIHAN || 'BSI').split(',')[0])), penyetor: u.penyetor, catatan: (u.ref ? 'Ref. ' + u.ref + '. ' : '') + u.catatan, lampiran: u.berkas.map(b => ({ nama: b.nama, mime: b.mime, b64: b.b64 })) };
  // 1) Optimistis: tampilkan transaksi & saldo baru seketika
  const sementara = { ID: 'tmp-' + u.idem, NoBukti: 'Menyinkronkan…', Idem: u.idem, Waktu: hariIni() + ' ' + new Date().toTimeString().slice(0, 8), Tanggal: hariIni(), SiswaID: s.ID, NIS: s.NIS, Nama: s.Nama, KelasID: s.KelasID, JurusanID: s.JurusanID, Alokasi: '', Jumlah: k.jumlah, Admin: k.admin, Diterima: k.diterima, Kembali: Math.max(0, k.kembali), Metode: u.metode, Bank: payload.bank, Status: 'SINKRON', PetugasID: S.me.id, Petugas: S.me.nama, Penyetor: u.penyetor, Catatan: payload.catatan, SisaSetelah: '', Kode: '' };
  const item = { idem: u.idem, payload, sementara, snapshot: JSON.parse(JSON.stringify(S.db.tg[s.ID] || [])), cetak: u.cetak, email: u.email, waktu: Date.now() };
  terapkanAlokasiLokal(payload, sementara);
  S.db.hariIni.unshift(sementara);
  S.outbox.push(item); simpanOutbox();
  // 2) Antrean berikutnya siap (idem baru), bukti tampil
  S.ui.by = Object.assign(defaultBy(), { metode: u.metode, cetak: u.cetak }); LS.del('draft.bayar');
  HAL.bayar.render({ segar: true }); renderKerangka();
  tampilkanBukti(sementara);
  // 3) Sinkron latar (idempoten)
  kirimSatuOutbox(item);
};
async function kirimSatuOutbox(item) {
  if (item.kirim) return; item.kirim = true;
  try {
    const r = await api('simpanPembayaran', item.payload);
    const resmi = keObj('Pembayaran', r.pembayaran);
    S.outbox = S.outbox.filter(o => o.idem !== item.idem); simpanOutbox();
    const i = S.db.hariIni.findIndex(p => p.ID === item.sementara.ID);
    if (i >= 0) S.db.hariIni[i] = resmi; else S.db.hariIni.unshift(resmi);
    if (r.tagihan) S.db.tg[resmi.SiswaID] = r.tagihan;
    if (resmi.Status === 'MENUNGGU' && !S.db.pending.some(p => p.ID === resmi.ID)) S.db.pending.unshift(resmi);
    if (r.lampiran && r.lampiran.length) S.db.lampiran[resmi.ID] = r.lampiran;
    S.memo.delete(resmi.SiswaID);
    if (S.ui.kwId === item.sementara.ID) tampilkanBukti(resmi, { otomatisCetak: item.cetak && resmi.Status === 'TERVERIFIKASI' });
    toast(`${resmi.NoBukti} • ${resmi.Nama} • ${rp(resmi.Jumlah)}${resmi.Status === 'MENUNGGU' ? ' — menunggu verifikasi' : ''}`, 'ok', r.duplikat ? 'Sudah tercatat sebelumnya (tidak ganda)' : 'Transaksi tersimpan');
    if (resmi.Status === 'TERVERIFIKASI') {
      qrDataUrl(teksQr(resmi)).then(qr => apiLatar('siapkanPdf', resmi.ID, qr)); // PDF resmi disiapkan di latar (US-17)
      if (item.email) apiLatar('kickAntrean');
    }
    rerenderHalaman();
  } catch (e) {
    item.kirim = false;
    if (e.jaringan) { item.status = 'TERTUNDA'; simpanOutbox(); if (S.ui.kwId === item.sementara.ID) $('#kwStatus').innerHTML = peringatan('Koneksi terputus. Transaksi tersimpan di antrean perangkat dan akan dikirim ulang otomatis dengan ID idempoten yang sama.', 'warn', 'wifi-off'); return; }
    // Ditolak server → kembalikan seperti semula
    S.outbox = S.outbox.filter(o => o.idem !== item.idem); simpanOutbox();
    S.db.tg[item.payload.siswaId] = item.snapshot; S.memo.delete(item.payload.siswaId);
    S.db.hariIni = S.db.hariIni.filter(p => p.ID !== item.sementara.ID);
    if (S.ui.kwId === item.sementara.ID) modalBs('mdlKw').hide();
    S.ui.by = Object.assign(defaultBy(), { sid: item.payload.siswaId, pilih: item.payload.periode, metode: item.payload.metode, diterima: item.payload.diterima, penyetor: item.payload.penyetor, catatan: item.payload.catatan, idem: item.idem });
    toast(e.message + ' Formulir dipulihkan untuk diperbaiki.', 'err', 'Transaksi ditolak server');
    go('bayar');
  }
}

// ── Bukti pembayaran resmi (render instan di klien; PDF resmi via server) ──
const teksQr = p => `SIMSPP|${p.NoBukti}|${p.Kode}|${angka(p.Jumlah) + angka(p.Admin)}`;
function kopDokumen() {
  const s = S.set, logo = s.LOGO_URL ? `<img src="${esc(s.LOGO_URL)}" alt="">` : 'GH';
  return `<div class="kop"><div class="kop-logo">${logo}</div><div style="min-width:0"><div class="kop-yys">${esc(String(s.NAMA_YAYASAN || '').toUpperCase())}</div><div class="kop-nama">${esc(String(s.NAMA_SEKOLAH || '').toUpperCase())}</div><div class="kop-alamat">${esc(s.ALAMAT || '')}${s.TELEPON ? ' • Telp ' + esc(s.TELEPON) : ''}${s.NPSN ? ' • NPSN ' + esc(s.NPSN) : ''}${s.AKREDITASI ? ' • Terakreditasi "' + esc(s.AKREDITASI) + '"' : ''}</div></div>`;
}
function htmlKuitansi(p, qr) {
  const s = S.set, sw = S.idx.siswa.get(p.SiswaID) || {}, tg = S.db.tg[p.SiswaID] || [];
  const alok = alokParse(p.Alokasi), total = angka(p.Jumlah) + angka(p.Admin);
  const sisa = p.SisaSetelah !== '' && p.SisaSetelah !== undefined ? angka(p.SisaSetelah) : statSiswa(p.SiswaID).sisaDue;
  const air = p.Status === 'MENUNGGU' ? '<div class="tanda-air info">MENUNGGU<br>VERIFIKASI</div>' : p.Status === 'DIBATALKAN' ? '<div class="tanda-air">DIBATALKAN</div>' : p.Status === 'SINKRON' ? '<div class="tanda-air info">SEDANG<br>DISINKRONKAN</div>' : '';
  return `<div class="lembar">${air}${kopDokumen()}<div class="kop-no"><div class="lbl-sm" style="color:#094CB2">Lembar tanda terima kasir</div><div class="mono" style="font-size:15px;font-weight:700;color:#1A1C1E">${esc(p.NoBukti)}</div><div style="font-size:11px;color:#43474E">${tglPendek(p.Tanggal)} • ${jam(p.Waktu)} WIB</div></div></div>
    <div class="judul-dok">KUITANSI PEMBAYARAN SPP RESMI</div><div class="sub-dok">(TANDA TERIMA KASIR LOKET — DITERBITKAN OLEH SISTEM SIMSPP)</div>
    <div class="kv"><div><span>Nama siswa</span><b>: ${esc(p.Nama)}</b></div><div><span>Penyetor / wali</span><b>: ${esc(p.Penyetor || '-')}</b></div>
      <div><span>NIS / NISN</span><b>: ${esc(p.NIS)}${sw.NISN ? ' / ' + esc(sw.NISN) : ''}</b></div><div><span>Metode bayar</span><b>: ${esc({ TUNAI: 'Tunai loket', TRANSFER: 'Transfer ' + (p.Bank || ''), QRIS: 'QRIS kasir' }[p.Metode] || p.Metode)}</b></div>
      <div><span>Kelas / program</span><b>: ${esc(namaKelas(p.KelasID))} • ${esc(kodeJurusan(p.JurusanID))}</b></div><div><span>Kasir / penerima</span><b>: ${esc(p.Petugas)}</b></div></div>
    <table><thead><tr><th style="width:44px">No</th><th>Uraian pembayaran SPP</th><th>Status</th><th class="r">Jumlah nominal</th></tr></thead><tbody>
      ${alok.map((a, i) => { const t = tg.find(x => x[0] === a.p), lunas = t && t[1] - t[2] <= 0; return `<tr><td>${pad(i + 1)}</td><td><div style="font-weight:600">SPP ${bulanLabel(a.p)}</div><div style="font-size:11px;color:#43474E">${t && a.j < t[1] ? 'Pembayaran sebagian dari tagihan ' + rp(t[1]) : 'Iuran SPP ' + (a.p < periodeKini() ? 'pelunasan bulan lalu' : a.p === periodeKini() ? 'bulan berjalan' : 'dibayar di muka')}</div></td><td><span class="chip ${p.Status === 'TERVERIFIKASI' ? (lunas ? 'chip-ok' : 'chip-warn') : 'chip-info'}">${p.Status === 'TERVERIFIKASI' ? (lunas ? 'Lunas' : 'Sebagian') : 'Proses'}</span></td><td class="r"><b>${rp(a.j)}</b></td></tr>`; }).join('') || '<tr><td colspan="4">Alokasi sedang dihitung server…</td></tr>'}
    </tbody></table>
    <div class="bawah"><div><div class="terbilang"><div class="lbl-sm" style="color:#43474E">Terbilang:</div><i>"${esc(terbilang(total))}"</i></div>
      <div class="sisa-ok" style="${sisa > 0 ? 'background:#FFEDEA;color:#BA1A1A' : ''}"><span><i class="bi bi-${sisa > 0 ? 'exclamation-circle' : 'check-circle'}"></i> Status sisa tunggakan SPP</span><span>${sisa > 0 ? rp(sisa) : 'Rp 0 (lunas s/d ' + bulanLabel(periodeKini()) + ')'}</span></div></div>
      <div class="total-kotak"><div class="ringkas-baris" style="color:#43474E"><span>Subtotal tagihan</span><b style="color:#1A1C1E">${rp(p.Jumlah)}</b></div><div class="ringkas-baris" style="color:#43474E"><span>Biaya administrasi</span><b style="color:#107C41">${angka(p.Admin) ? rp(p.Admin) : 'Rp 0 (bebas biaya)'}</b></div>
        <div class="tot"><span class="lbl-sm">Total pembayaran</span><b>${rp(total)}</b></div>
        ${p.Metode === 'TUNAI' ? `<div class="ringkas-baris" style="color:#43474E"><span>Uang diterima (cash in)</span><b style="color:#1A1C1E">${rp(p.Diterima)}</b></div><div class="ringkas-baris" style="color:#094CB2"><span>Kembalian diserahkan</span><b style="color:#094CB2">${rp(p.Kembali)}</b></div>` : ''}</div></div>
    <div class="ttd"><div class="qr">${qr ? `<img src="${qr}" alt="QR verifikasi">` : '<div style="width:74px;height:74px;background:#F5F3F4;border-radius:4px"></div>'}<div><div class="mono" style="font-size:10.5px">${esc(p.Kode || '—')}</div><div style="font-size:9.5px;color:#094CB2;font-weight:700;letter-spacing:.04em">VERIFIKASI INTEGRITAS SIMSPP</div></div></div>
      <div><div class="lbl-sm" style="color:#43474E">Penyetor / wali murid,</div><div class="nm">${esc(p.Penyetor || '..................')}</div><div style="color:#43474E">Wali siswa</div></div>
      <div><div class="lbl-sm" style="color:#43474E">Kasir &amp; bendahara sekolah,</div><div class="nm">${esc(p.Petugas)}</div><div style="color:#43474E">${p.PetugasID === S.me.id && S.me.nip ? 'NIP. ' + esc(S.me.nip) : esc(s.KOTA || '')}</div></div></div>
    ${p.Status === 'TERVERIFIKASI' ? `<div class="cap">${esc(String(s.NAMA_SEKOLAH || '').split(' ').slice(0, 2).join(' ').toUpperCase())}<br>LUNAS<br><span style="font-size:9px">${tglPendek(p.Tanggal).toUpperCase()}</span></div>` : ''}
    <div class="catatan-kaki">* Kuitansi ini adalah bukti transaksi sah yang diproses melalui SIMSPP ${esc(s.NAMA_SEKOLAH || '')}. Pembayaran dibukukan secara idempoten ke kas sekolah. Nomor bukti tidak berubah saat dicetak ulang. Simpan dokumen ini sebagai tanda bukti resmi.</div></div>`;
}
async function tampilkanBukti(p, opsi = {}) {
  S.ui.kwId = p.ID; S.ui.kwP = p;
  const sinkron = p.Status === 'SINKRON', sah = p.Status === 'TERVERIFIKASI';
  $('#kwIkon').className = 'kpi-ikon ' + (sah ? 'ok' : sinkron ? '' : p.Status === 'DIBATALKAN' ? 'err' : 'warn');
  $('#kwIkon').innerHTML = `<i class="bi bi-${sah ? 'check2-circle' : sinkron ? 'arrow-repeat' : p.Status === 'DIBATALKAN' ? 'x-circle' : 'hourglass-split'}"></i>`;
  $('#kwJudul').textContent = sah ? 'Kuitansi Pembayaran Berhasil Diterbitkan' : sinkron ? 'Mencatat Transaksi…' : p.Status === 'DIBATALKAN' ? 'Transaksi Dibatalkan' : 'Transfer Tercatat — Menunggu Verifikasi';
  $('#kwSub').innerHTML = `${sah ? chip('Transaksi sah & masuk kas (terverifikasi)', 'ok') : chipStatusTrx(p.Status)} <span class="ms-2">No. bukti: <b class="mono">${esc(p.NoBukti)}</b></span> • <span class="mono">${esc(p.Idem || '')}</span>`;
  const bolehCetak = sah && isKasir();
  $('#kwAksi').innerHTML = `<button class="btn btn-primary" data-act="kwCetak" ${bolehCetak ? '' : 'disabled'}><i class="bi bi-printer"></i> ${sinkron ? '<span class="putar"></span> Menunggu nomor resmi…' : 'Cetak Sekarang (Ctrl+P)'}</button>
    <button class="btn btn-soft" data-act="kwPdf" ${bolehCetak ? '' : 'disabled'}><i class="bi bi-file-earmark-pdf text-err"></i> Unduh PDF Resmi</button>
    <button class="btn btn-ok" data-act="kwEmail" ${sah && isKasir() ? '' : 'disabled'}><i class="bi bi-send"></i> Kirim Ulang Tanda Terima</button>`;
  $('#kwLembar').innerHTML = htmlKuitansi(p, '');
  const sw = S.idx.siswa.get(p.SiswaID) || {};
  $('#kwStatus').innerHTML = sinkron ? peringatan('Transaksi sudah tercatat di perangkat dan sedang dikirim ke server. Nomor bukti resmi akan muncul dalam beberapa detik.', 'info', 'cloud-upload')
    : p.Status === 'MENUNGGU' ? peringatan('Bukti PDF resmi tersedia setelah transfer diverifikasi di menu Verifikasi Transfer.', 'warn', 'hourglass-split')
    : sah ? (emailValid(sw.EmailWali) && S.set.EMAIL_TANDA_TERIMA === 'Y' ? peringatan(`<b>Status pengiriman digital:</b> tanda terima email dijadwalkan ke ${esc(sw.EmailWali)} dengan lampiran PDF (mode <b>${esc(S.set.MODE_KIRIM)}</b>).`, 'ok', 'envelope-check') : peringatan('Email wali belum diisi — tanda terima digital tidak dikirim. Lengkapi kontak di Data Siswa.', 'info', 'envelope-x')) : '';
  $('#kwKaki').innerHTML = `<span class="text-mut" style="font-size:12px"><i class="bi bi-keyboard"></i> Ctrl+P (Cetak) • F2 (Antrean baru) • Esc (Tutup)</span><div class="d-flex gap-2">${isKasir() ? `<button class="btn btn-soft" data-bs-dismiss="modal" data-act="nav" data-hal="dashboard"><i class="bi bi-arrow-left"></i> Kembali ke Dashboard</button><button class="btn btn-primary" data-act="kwBerikutnya"><i class="bi bi-person-plus"></i> Transaksi Berikutnya [F2]</button>` : '<button class="btn btn-soft" data-bs-dismiss="modal">Tutup</button>'}</div>`;
  if (!$('#mdlKw').classList.contains('show')) { tutupModal(); modalBs('mdlKw').show(); }
  if (!sinkron) { const qr = await qrDataUrl(teksQr(p)); if (qr && S.ui.kwId === p.ID) { S.ui.kwQr = qr; $('#kwLembar').innerHTML = htmlKuitansi(p, qr); } }
  if (opsi.otomatisCetak) setTimeout(() => ACT.kwCetak(), 350);
}
ACT.kwCetak = async () => { const p = S.ui.kwP; if (!p || p.Status !== 'TERVERIFIKASI') return; const qr = S.ui.kwQr || await qrDataUrl(teksQr(p)); cetakHtml(htmlKuitansi(p, qr), 'A5 landscape'); };
ACT.kwPdf = async btn => {
  const p = S.ui.kwP; if (!p) return;
  sibuk(btn, true, 'Menyiapkan PDF…');
  try { const r = await api('unduhPdf', p.ID, S.ui.kwQr || await qrDataUrl(teksQr(p))); unduhB64(r.nama, 'application/pdf', r.b64); toast('PDF resmi diunduh (' + r.nama + ').', 'ok'); }
  catch (e) { toast(e.message, 'err'); } finally { sibuk(btn, false); }
};
ACT.kwEmail = async btn => {
  const p = S.ui.kwP; if (!p) return;
  sibuk(btn, true, 'Mengirim…');
  try { await api('kirimTandaTerima', p.ID); toast('Tanda terima diproses (' + (S.set.MODE_KIRIM === 'LIVE' ? 'dikirim' : 'mode simulasi') + ').', 'ok'); }
  catch (e) { toast(e.message, 'err'); } finally { sibuk(btn, false); }
};
ACT.kwBerikutnya = () => { modalBs('mdlKw').hide(); go('bayar'); setTimeout(() => $('#byCari').focus(), 250); };
$('#mdlKw').addEventListener('hidden.bs.modal', () => { S.ui.kwId = null; });

// ── Verifikasi Transfer ──
S.ui.vf = { q: '', metode: '', urut: 'lama' };
HAL.verifikasi = {
  judul: 'Verifikasi Transfer',
  render() {
    const u = S.ui.vf, q = u.q.toLowerCase();
    let rows = S.db.pending.filter(p => (!u.metode || p.Metode === u.metode) && (!q || (p.Nama + ' ' + p.NIS + ' ' + p.NoBukti + ' ' + p.Penyetor + ' ' + p.Catatan).toLowerCase().includes(q)));
    urutkan(rows, p => p.Waktu, u.urut === 'lama' ? 1 : -1);
    const tot = S.db.pending.reduce((a, p) => a + angka(p.Jumlah), 0);
    $('#vfRingkas').innerHTML = `<span class="chip chip-warn">${S.db.pending.length} menunggu</span><span class="rp-md">${rp(tot)}</span>`;
    if (!$('#vfQ')) $('#vfFilter').innerHTML = `<div class="input-ikon cari"><i class="bi bi-search"></i><input class="form-control" id="vfQ" data-inp="vfQ" placeholder="Cari nama, NIS, no. bukti, referensi…" aria-label="Cari antrean"></div><select class="form-select" data-chg="vfF" data-k="metode" aria-label="Metode">${opsi([['TRANSFER', 'Transfer bank'], ['QRIS', 'QRIS']], u.metode, 'Semua metode')}</select><select class="form-select" data-chg="vfF" data-k="urut" aria-label="Urutan">${opsi([['lama', 'Terlama dulu'], ['baru', 'Terbaru dulu']], u.urut)}</select>`;
    $('#vfDaftar').innerHTML = rows.length ? `<div class="grid-2s">${rows.map(p => {
      const lamp = S.db.lampiran[p.ID] || [], umur = selisihHari(String(p.Tanggal).slice(0, 10), hariIni());
      return `<div class="kartu" id="vf-${p.ID}">
        <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap"><div><div class="mono fw-bold">${esc(p.NoBukti)}</div><div class="sel-sub">${tglPendek(p.Tanggal)} • ${jam(p.Waktu)} WIB • dicatat ${esc(p.Petugas)}</div></div><div class="text-end">${chip('Menunggu verifikasi', 'warn')}${umur >= 2 ? `<div class="sel-sub text-err mt-1">${umur} hari dalam antrean</div>` : ''}</div></div>
        <div class="d-flex gap-3 align-items-center mt-3">${avatar(p.Nama, 'sedang lembut')}<div style="min-width:0;flex:1"><div class="sel-utama" role="button" data-act="detailSiswa" data-id="${p.SiswaID}">${esc(p.Nama)}</div><div class="sel-sub num">NIS ${esc(p.NIS)} • ${esc(namaKelas(p.KelasID))}</div></div><div class="text-end"><div class="rp-lg">${rp(p.Jumlah)}</div><div class="sel-sub">${labelMetode(p.Metode, p.Bank)}</div></div></div>
        <div class="d-flex flex-wrap gap-1 mt-3">${alokParse(p.Alokasi).map(a => chip(bulanPendek(a.p) + ' • ' + ribu(a.j), 'info')).join('')}</div>
        <div class="kartu-2 mt-3" style="font-size:13px"><div><span class="text-mut">Penyetor:</span> ${esc(p.Penyetor || '-')}</div>${p.Catatan ? `<div><span class="text-mut">Catatan:</span> ${esc(p.Catatan)}</div>` : ''}</div>
        <div class="d-flex flex-wrap gap-2 mt-3">${lamp.map((l, i) => `<button class="btn btn-soft btn-sm" data-act="lihatLampiran" data-id="${l[0]}"><i class="bi bi-${String(l[2]).includes('pdf') ? 'file-earmark-pdf' : 'image'}"></i> Bukti ${i + 1}</button>`).join('') || '<span class="chip chip-err"><i class="bi bi-exclamation-circle"></i> Belum ada bukti</span>'}${lamp.length < (angka(S.set.MAKS_LAMPIRAN) || 3) ? `<button class="btn btn-ghost btn-sm" data-act="vfTambahBukti" data-id="${p.ID}"><i class="bi bi-plus"></i> Tambah bukti</button>` : ''}</div>
        <div class="d-flex gap-2 mt-3 pt-3" style="border-top:1px solid var(--border-subtle)"><button class="btn btn-outline-danger" data-act="vfTolak" data-id="${p.ID}"><i class="bi bi-x-circle"></i> Tolak</button><button class="btn btn-primary ms-auto" data-act="vfTerima" data-id="${p.ID}"><i class="bi bi-patch-check"></i> Verifikasi &amp; Akui Pembayaran</button></div></div>`;
    }).join('')}</div>` : `<div class="kartu">${kosong(S.db.pending.length ? 'Tidak ada yang cocok dengan pencarian.' : 'Semua transfer sudah diverifikasi. Antrean kosong.', 'patch-check')}</div>`;
  }
};
INP.vfQ = debounce(el => { S.ui.vf.q = el.value; HAL.verifikasi.render(); }, 150);
CHG.vfF = el => { S.ui.vf[el.dataset.k] = el.value; HAL.verifikasi.render(); };
async function prosesVerifikasi(id, keputusan, catatan) {
  const p = S.db.pending.find(x => x.ID === id); if (!p) return;
  const kartu = $('#vf-' + id); if (kartu) { kartu.style.opacity = '.55'; kartu.style.pointerEvents = 'none'; }
  const snap = JSON.parse(JSON.stringify(S.db.tg[p.SiswaID] || []));
  // optimistis
  alokParse(p.Alokasi).forEach(a => { const t = (S.db.tg[p.SiswaID] || []).find(x => x[0] === a.p); if (t) { t[3] = Math.max(0, t[3] - a.j); if (keputusan === 'TERIMA') t[2] += a.j; } });
  S.db.pending = S.db.pending.filter(x => x.ID !== id); S.memo.delete(p.SiswaID);
  rerenderHalaman();
  try {
    const r = await api('verifikasiPembayaran', id, keputusan, catatan || '');
    const resmi = keObj('Pembayaran', r.pembayaran);
    if (r.tagihan) S.db.tg[resmi.SiswaID] = r.tagihan;
    const i = S.db.hariIni.findIndex(x => x.ID === id); if (i >= 0) S.db.hariIni[i] = resmi;
    S.memo.delete(resmi.SiswaID);
    toast(`${resmi.NoBukti} ${keputusan === 'TERIMA' ? 'diverifikasi — saldo tagihan diperbarui' : 'ditolak & dibatalkan'}.`, keputusan === 'TERIMA' ? 'ok' : 'warn');
    if (keputusan === 'TERIMA') { qrDataUrl(teksQr(resmi)).then(qr => apiLatar('siapkanPdf', resmi.ID, qr)); apiLatar('kickAntrean'); }
    if (keputusan === 'TOLAK') apiLatar('getBootstrap'); // koreksi tercatat di server
    rerenderHalaman();
  } catch (e) {
    S.db.tg[p.SiswaID] = snap; S.db.pending.push(p); S.memo.delete(p.SiswaID); rerenderHalaman();
    toast(e.message, 'err', 'Verifikasi gagal — dikembalikan');
  }
}
ACT.vfTerima = async el => {
  const p = S.db.pending.find(x => x.ID === el.dataset.id); if (!p) return;
  if (!(await konfirmasi('Verifikasi pembayaran?', `Pastikan dana <b>${rp(p.Jumlah)}</b> dari ${esc(p.Penyetor || p.Nama)} sudah masuk di mutasi rekening ${esc(p.Bank || '')}. Setelah diverifikasi, pembayaran diakui dan saldo tagihan diperbarui.`, { ok: 'Ya, verifikasi' }))) return;
  prosesVerifikasi(p.ID, 'TERIMA');
};
ACT.vfTolak = async el => {
  const p = S.db.pending.find(x => x.ID === el.dataset.id); if (!p) return;
  const alasan = await konfirmasi('Tolak pembayaran transfer?', `Transaksi ${esc(p.NoBukti)} akan berstatus <b>Dibatalkan</b> (tidak dihapus) dan tagihan kembali terbuka.`, { ok: 'Tolak transfer', bahaya: true, input: { label: 'Alasan penolakan', ph: 'mis. nominal di bukti tidak sesuai mutasi', min: 5 } });
  if (alasan) prosesVerifikasi(p.ID, 'TOLAK', alasan);
};
ACT.vfTambahBukti = el => {
  const id = el.dataset.id, f = $('#berkasTersembunyi');
  f.multiple = true; f.accept = '.jpg,.jpeg,.png,.pdf'; f.value = '';
  f.onchange = async () => {
    const files = await bacaBerkas(f.files, (S.db.lampiran[id] || []).length); if (!files.length) return;
    toast('Mengunggah ' + files.length + ' berkas…', 'info', '', 2000);
    try { const r = await api('tambahLampiran', id, files.map(b => ({ nama: b.nama, mime: b.mime, b64: b.b64 }))); S.db.lampiran[id] = (S.db.lampiran[id] || []).concat(r); toast('Bukti ditambahkan.', 'ok'); rerenderHalaman(); }
    catch (e) { toast(e.message, 'err'); }
  };
  f.click();
};
ACT.lihatLampiran = async el => {
  const btn = el; sibuk(btn, true, 'Membuka…');
  try {
    const r = await api('getLampiran', el.dataset.id);
    const url = 'data:' + r.mime + ';base64,' + r.b64;
    let isi;
    if (r.mime === 'application/pdf') { const bin = atob(r.b64), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); isi = `<iframe src="${URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }))}" style="width:100%;height:70vh;border:0;border-radius:6px" title="Pratinjau PDF"></iframe>`; }
    else isi = `<div class="text-center"><img src="${url}" alt="Bukti transfer ${esc(r.nama)}" style="max-width:100%;max-height:70vh;border-radius:6px;border:1px solid var(--border)"></div>`;
    S.ui.lampiranAktif = r;
    if ($('#mdl').classList.contains('show') && !$('#mdlJudul').textContent.startsWith('Bukti:')) S.ui.modalSebelum = null;
    bukaModal({ judul: 'Bukti: ' + r.nama, ukuran: 'lg', isi, kaki: `<button class="btn btn-soft" data-bs-dismiss="modal"><i class="bi bi-x-lg"></i> Tutup</button><button class="btn btn-primary" data-act="unduhLampiran"><i class="bi bi-download"></i> Unduh</button>` });
  } catch (e) { toast(e.message, 'err'); } finally { sibuk(btn, false); }
};
ACT.unduhLampiran = () => { const r = S.ui.lampiranAktif; if (r) unduhB64(r.nama, r.mime, r.b64); };

// ── Riwayat Transaksi (filter & paginasi di server, hasil di-cache 60 dtk) ──
function defaultRw() { return { q: '', preset: 'bulan', dari: '', sampai: '', periode: '', jur: '', kelas: '', metode: '', petugas: '', status: '', urut: 'Waktu', arah: 'desc', page: 1 }; }
S.ui.rw = defaultRw();
function filterRw() {
  const u = S.ui.rw, t = hariIni();
  const r = { hari: [t, t], '7': [tambahHari(t, -6), t], bulan: [t.slice(0, 7) + '-01', t], semua: ['', ''] }[u.preset] || [u.dari, u.sampai];
  return { q: u.q, dari: r[0], sampai: r[1], periode: u.periode, jurusan: u.jur, kelas: u.kelas, metode: u.metode, petugas: u.petugas, status: u.status, urut: u.urut, arah: u.arah, page: u.page, size: 25 };
}
HAL.riwayat = {
  judul: 'Riwayat Transaksi',
  render() {
    const u = S.ui.rw, ta = taAktif();
    $('#rwFilter').innerHTML = `<div class="input-ikon cari"><i class="bi bi-search"></i><input class="form-control" id="rwQ" data-inp="rwQ" value="${esc(u.q)}" placeholder="Nama, NIS, no. bukti, penyetor…" aria-label="Cari transaksi"></div>
      <div class="seg" role="group" aria-label="Rentang tanggal">${[['hari', 'Hari ini'], ['7', '7 hari'], ['bulan', 'Bulan ini'], ['semua', 'Semua'], ['kustom', 'Kustom']].map(p => `<button data-act="rwPreset" data-v="${p[0]}" class="${u.preset === p[0] ? 'aktif' : ''}">${p[1]}</button>`).join('')}</div>
      ${u.preset === 'kustom' ? `<input type="date" class="form-control" data-chg="rwF" data-k="dari" value="${esc(u.dari)}" aria-label="Dari"><input type="date" class="form-control" data-chg="rwF" data-k="sampai" value="${esc(u.sampai)}" aria-label="Sampai">` : ''}
      <select class="form-select" data-chg="rwF" data-k="periode" aria-label="Periode tagihan">${opsi(periodeTA(ta).map(p => [p, 'Periode ' + bulanLabel(p)]), u.periode, 'Semua periode')}</select>
      <select class="form-select" data-chg="rwF" data-k="jur" aria-label="Jurusan">${opsi(S.db.jurusan.map(j => [j.ID, j.Nama]), u.jur, 'Semua jurusan')}</select>
      <select class="form-select" data-chg="rwF" data-k="kelas" aria-label="Kelas">${opsi(S.db.kelas.filter(k => !u.jur || k.JurusanID === u.jur).map(k => [k.ID, k.Nama]), u.kelas, 'Semua kelas')}</select>
      <select class="form-select" data-chg="rwF" data-k="metode" aria-label="Metode">${opsi([['TUNAI', 'Tunai'], ['TRANSFER', 'Transfer'], ['QRIS', 'QRIS']], u.metode, 'Semua metode')}</select>
      <select class="form-select" data-chg="rwF" data-k="petugas" aria-label="Petugas">${opsi(S.db.users.filter(x => x.Peran !== PERAN.YAY).map(x => [x.ID, x.Nama]), u.petugas, 'Semua petugas')}</select>
      <select class="form-select" data-chg="rwF" data-k="status" aria-label="Status">${opsi([['TERVERIFIKASI', 'Terverifikasi'], ['MENUNGGU', 'Menunggu verifikasi'], ['DIBATALKAN', 'Dibatalkan']], u.status, 'Semua status')}</select>`;
    const chips = [];
    ['periode', 'jur', 'kelas', 'metode', 'petugas', 'status', 'q'].forEach(k => { if (u[k]) chips.push([k, k === 'jur' ? namaJurusan(u[k]) : k === 'kelas' ? namaKelas(u[k]) : k === 'petugas' ? (S.idx.users.get(u[k]) || {}).Nama : k === 'periode' ? bulanLabel(u[k]) : u[k]]); });
    $('#rwChip').innerHTML = chips.length ? '<span class="label">Filter:</span>' + chips.map(c => `<span class="chip chip-info" data-act="rwHapusF" data-k="${c[0]}">${esc(c[1])} <i class="bi bi-x"></i></span>`).join('') + '<a href="#" data-act="rwReset" style="font-size:12px">Hapus semua filter</a>' : '';
    muatRw();
  }
};
async function muatRw() {
  const f = filterRw(), key = JSON.stringify(f), c = S.cacheRw.get(key);
  if (c && Date.now() - c.t < 60000) { renderRwTabel(c.d); return; }
  if (c) renderRwTabel(c.d, true); else $('#rwTabel').innerHTML = `<div class="p-3">${'<div class="skeleton mb-2" style="height:36px"></div>'.repeat(6)}</div>`;
  try { const d = await api('cariPembayaran', f); S.cacheRw.set(key, { t: Date.now(), d }); if (JSON.stringify(filterRw()) === key) renderRwTabel(d); }
  catch (e) { $('#rwTabel').innerHTML = `<div class="p-3">${peringatan(esc(e.message), 'err')}</div>`; }
}
function renderRwTabel(d, lama) {
  const u = S.ui.rw, rows = d.rows.map(r => keObj('Pembayaran', r));
  $('#rwTabel').innerHTML = `<div class="kartu-head px-3 pt-3 mb-2"><span class="label">${d.n} transaksi ${lama ? '<span class="putar ms-1"></span>' : ''}</span><span>Total terverifikasi: <b class="rp-md text-ok">${rp(d.total)}</b></span></div>
    <div class="tbl-scroll"><table class="tbl tbl-kartu"><thead><tr>${thUrut('Waktu', 'Waktu', u, 'rwUrut')}${thUrut('No. bukti', 'NoBukti', u, 'rwUrut')}${thUrut('Siswa', 'Nama', u, 'rwUrut')}<th>Periode</th>${thUrut('Metode', 'Metode', u, 'rwUrut')}<th>Petugas</th>${thUrut('Jumlah', 'Jumlah', u, 'rwUrut', 'r')}${thUrut('Status', 'Status', u, 'rwUrut')}<th></th></tr></thead>
    <tbody>${rows.length ? rows.map(p => `<tr class="klik ${p.Status === 'DIBATALKAN' ? 'batal' : p.Status === 'MENUNGGU' ? 'sorot' : ''}" data-act="detailTrx" data-id="${p.ID}">
      <td data-l="Waktu" class="num">${tglPendek(p.Tanggal)}<div class="sel-sub">${jam(p.Waktu)} WIB</div></td>
      <td class="utama"><span class="mono fw-bold">${esc(p.NoBukti)}</span></td>
      <td data-l="Siswa"><div class="sel-utama">${esc(p.Nama)}</div><div class="sel-sub">${esc(p.NIS)} • ${esc(namaKelas(p.KelasID))}</div></td>
      <td data-l="Periode">${alokParse(p.Alokasi).map(a => bulanPendek(a.p)).join(', ')}</td>
      <td data-l="Metode">${labelMetode(p.Metode, p.Bank)}</td><td data-l="Petugas">${esc(p.Petugas)}</td>
      <td data-l="Jumlah" class="r num"><b class="coret">${rp(p.Jumlah)}</b></td><td data-l="Status">${chipStatusTrx(p.Status)}</td><td data-l="" class="r"><i class="bi bi-chevron-right text-mut"></i></td></tr>`).join('') : `<tr><td colspan="9">${kosong('Tidak ada transaksi pada filter ini.', 'receipt')}</td></tr>`}</tbody></table></div>
    <div class="tbl-foot"><span>Halaman ${d.page || 1} • ${d.size || 25} per halaman</span>${pager('rwHal', d.page || 1, d.n, d.size || 25)}</div>`;
}
INP.rwQ = debounce(el => { S.ui.rw.q = el.value.trim(); S.ui.rw.page = 1; muatRw(); }, 350);
CHG.rwF = el => { S.ui.rw[el.dataset.k] = el.value; S.ui.rw.page = 1; HAL.riwayat.render(); };
ACT.rwPreset = el => { S.ui.rw.preset = el.dataset.v; S.ui.rw.page = 1; HAL.riwayat.render(); };
ACT.rwUrut = el => { const u = S.ui.rw; u.arah = u.urut === el.dataset.k && u.arah === 'desc' ? 'asc' : 'desc'; u.urut = el.dataset.k; u.page = 1; muatRw(); };
ACT.rwHal = el => { S.ui.rw.page = Number(el.dataset.page); muatRw(); };
ACT.rwHapusF = el => { S.ui.rw[el.dataset.k] = ''; S.ui.rw.page = 1; HAL.riwayat.render(); };
ACT.rwReset = () => { S.ui.rw = defaultRw(); HAL.riwayat.render(); };
ACT.rwEkspor = async btn => {
  sibuk(btn, true, 'Menyiapkan…');
  try {
    const d = await api('cariPembayaran', Object.assign(filterRw(), { semua: true }));
    const rows = d.rows.map(r => keObj('Pembayaran', r));
    const f = filterRw();
    eksporXlsx('Riwayat_Transaksi_' + hariIni() + '.xlsx', [
      { nama: 'Transaksi', lebar: [18, 18, 10, 12, 28, 12, 18, 30, 14, 10, 12, 16, 20, 20], rows: [['No. Bukti', 'Waktu', 'Tanggal', 'NIS', 'Nama', 'Kelas', 'Jurusan', 'Alokasi Periode', 'Jumlah', 'Admin', 'Metode', 'Status', 'Petugas', 'Penyetor', 'Verifikator', 'Catatan']].concat(rows.map(p => [p.NoBukti, p.Waktu, p.Tanggal, p.NIS, p.Nama, namaKelas(p.KelasID), namaJurusan(p.JurusanID), alokParse(p.Alokasi).map(a => a.p + ' (' + a.j + ')').join(', '), angka(p.Jumlah), angka(p.Admin), p.Metode + (p.Bank ? ' ' + p.Bank : ''), p.Status, p.Petugas, p.Penyetor, p.Verifikator, p.Catatan])) },
      { nama: 'Info', rows: [['Laporan', 'Riwayat Transaksi SIMSPP'], ['Dibuat', new Date().toLocaleString('id-ID')], ['Oleh', S.me.nama], ['Rentang', (f.dari || 'awal') + ' s/d ' + (f.sampai || 'akhir')], ['Filter', JSON.stringify(f)], ['Jumlah baris', rows.length], ['Total terverifikasi', d.total]] }]);
  } catch (e) { toast(e.message, 'err'); } finally { sibuk(btn, false); }
};

// ── Detail transaksi + jejak audit ──
ACT.detailTrx = async el => {
  const id = el.dataset.id;
  if (String(id).startsWith('tmp-')) { const p = S.db.hariIni.find(x => x.ID === id); if (p) tampilkanBukti(p); return; }
  bukaModal({ judul: 'Detail Transaksi & Kwitansi', ukuran: 'xl', isi: '<div class="skeleton mb-3" style="height:120px"></div><div class="skeleton" style="height:220px"></div>' });
  try {
    const d = await api('detailPembayaran', id), p = keObj('Pembayaran', d.p);
    S.ui.detailP = p;
    const x = statSiswa(p.SiswaID), tg = S.db.tg[p.SiswaID] || [];
    const milikSaya = p.PetugasID === S.me.id, opr = isOpr();
    const info = (l, v, sub = '') => `<div class="info-sel"><span class="lbl-sm">${l}</span><div class="sel-utama">${v}</div>${sub ? `<div class="sel-sub">${sub}</div>` : ''}</div>`;
    $('#mdlIsi').innerHTML = `<div class="d-flex align-items-center gap-2 flex-wrap mb-3">${chipStatusTrx(p.Status)}<span class="chip">Posting ref ${esc(p.ID)}</span>${p.Kode ? `<span class="chip chip-info mono" style="text-transform:none">${esc(p.Kode)}</span>` : ''}</div>
      <div class="grid-2" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)"><div class="tumpuk">
        <div class="kartu"><div class="kartu-head"><div class="h-sm"><i class="bi bi-journal-text"></i> Informasi Pembukuan</div></div><div class="info-grid">
          ${info('Nomor bukti resmi', `<span class="mono">${esc(p.NoBukti)}</span>`)}${info('ID idempoten', `<span class="mono">${esc(p.Idem)}</span>`, '<i class="bi bi-check2"></i> Mutasi unik terverifikasi')}
          ${info('Waktu transaksi', esc(tglLabel(p.Tanggal)) + ', ' + jam(p.Waktu) + ' WIB', 'Dicatat ' + esc(String(p.Waktu)))}${info('Kanal pembayaran', labelMetode(p.Metode, p.Bank), p.Metode === 'TUNAI' ? 'Diterima ' + rp(p.Diterima) + ' • kembali ' + rp(p.Kembali) : '')}
          ${info('Kasir pencatat', esc(p.Petugas))}${info('Verifikator', esc(p.Verifikator || '—'), p.WaktuVerif ? esc(String(p.WaktuVerif)) : '')}
          ${info('Penyetor', esc(p.Penyetor || '-'))}${info('Catatan', esc(p.Catatan || '-'))}</div></div>
        <div class="kartu"><div class="kartu-head"><div class="h-sm"><i class="bi bi-list-check"></i> Rincian Alokasi Tagihan</div><span class="text-mut" style="font-size:12px">FIFO — bulan terlama dilunasi lebih dulu</span></div>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Periode</th><th class="r">Nilai tagihan</th><th class="r">Dialokasikan</th><th>Status bulan kini</th></tr></thead><tbody>${alokParse(p.Alokasi).map(a => { const t = tg.find(y => y[0] === a.p); const c = t ? CHIP_BULAN[statusBulan(t)] : ['-', '']; return `<tr><td>SPP ${bulanLabel(a.p)}</td><td class="r num">${t ? rp(t[1]) : '-'}</td><td class="r num"><b>${rp(a.j)}</b></td><td>${chip(c[0], c[1])}</td></tr>`; }).join('')}</tbody>
          <tfoot><tr><td colspan="2">Total pembayaran${angka(p.Admin) ? ' (+ admin ' + rp(p.Admin) + ')' : ''}</td><td class="r num">${rp(angka(p.Jumlah) + angka(p.Admin))}</td><td></td></tr></tfoot></table></div></div>
        ${d.lampiran.length ? `<div class="kartu"><div class="h-sm mb-2"><i class="bi bi-paperclip"></i> Lampiran Bukti (${d.lampiran.length})</div><div class="d-flex gap-2 flex-wrap">${d.lampiran.map((l, i) => `<button class="btn btn-soft btn-sm" data-act="lihatLampiran" data-id="${l[0]}"><i class="bi bi-file-earmark"></i> ${esc(l[3])}</button>`).join('')}</div></div>` : ''}
      </div><div class="tumpuk">
        <div class="kartu"><div class="kartu-head"><div class="h-sm">Profil Siswa</div>${chipStatusSiswa(x)}</div><div class="d-flex gap-3 align-items-center">${avatar(p.Nama, 'sedang')}<div><div class="sel-utama">${esc(p.Nama)}</div><div class="sel-sub num">NIS ${esc(p.NIS)} • ${esc(namaKelas(p.KelasID))}</div><div class="sel-sub">${esc(namaJurusan(p.JurusanID))}</div></div></div>
          <div class="kembalian ${x.sisaDue ? 'kurang' : ''}" style="padding:.75rem 1rem"><div class="lbl-sm">Sisa tunggakan berjalan</div><div class="nilai" style="font-size:24px">${rp(x.sisaDue)}</div></div></div>
        ${d.koreksi.length ? `<div class="kartu"><div class="h-sm mb-2"><i class="bi bi-arrow-left-right"></i> Koreksi &amp; Pembatalan</div>${d.koreksi.map(r => htmlKoreksiRingkas(keObj('KoreksiTransaksi', r))).join('')}</div>` : ''}
        <div class="kartu"><div class="kartu-head"><div class="h-sm"><i class="bi bi-shield-check"></i> Jejak Audit</div><span class="lbl-sm text-mut">Tambah-saja</span></div>
          <div class="timeline">${d.jejak.map(j => `<div class="tl ${/TOLAK|BATAL/.test(j[4]) ? 'err' : /VERIFIKASI_TERIMA|TERAPKAN/.test(j[4]) ? 'ok' : /AJUKAN/.test(j[4]) ? 'warn' : ''}"><div class="d-flex justify-content-between gap-2"><b style="font-size:13px">${esc(String(j[4]).replace(/_/g, ' '))}</b><span class="mono text-mut">${esc(String(j[0]).slice(5, 16))}</span></div><div class="sel-sub">${esc(j[2])} • ${esc(String(j[7]).slice(0, 180))}</div></div>`).join('') || '<div class="text-mut">Belum ada jejak.</div>'}</div></div>
      </div></div>`;
    const k = [];
    if (isKasir() && p.Status === 'TERVERIFIKASI') k.push(`<button class="btn btn-primary" data-act="dtBukti"><i class="bi bi-printer"></i> Cetak / PDF Bukti</button>`);
    if (isKasir() && p.Status === 'MENUNGGU') k.push(`<button class="btn btn-primary" data-act="nav" data-hal="verifikasi" data-bs-dismiss="modal"><i class="bi bi-patch-check"></i> Ke antrean verifikasi</button>`);
    if ((opr || (S.me.peran === PERAN.BEN && milikSaya)) && p.Status !== 'DIBATALKAN') k.unshift(`<button class="btn btn-outline-danger me-auto" data-act="formKoreksi"><i class="bi bi-pencil-square"></i> ${opr ? 'Koreksi / Batalkan' : 'Ajukan koreksi / pembatalan'}</button>`);
    if (opr && p.Status === 'DIBATALKAN') k.unshift(`<button class="btn btn-outline-primary me-auto" data-act="formPulihkan"><i class="bi bi-arrow-counterclockwise"></i> Pulihkan transaksi</button>`);
    if (!k.length || !k[0].includes('me-auto')) k.unshift('<span class="me-auto"></span>');
    k.push('<button class="btn btn-soft" data-bs-dismiss="modal">Tutup</button>');
    $('#mdlKaki').innerHTML = k.join(''); $('#mdlKaki').classList.remove('hidden');
  } catch (e) { $('#mdlIsi').innerHTML = peringatan(esc(e.message), 'err'); }
};
ACT.dtBukti = () => { const p = S.ui.detailP; tutupModal(); setTimeout(() => tampilkanBukti(p), 200); };

// ── Koreksi / pembatalan / pemulihan ──
function htmlDiff(sebelum, sesudah) {
  let a = {}, b = {}; try { a = JSON.parse(sebelum || '{}'); b = JSON.parse(sesudah || '{}'); } catch (e) { /* abaikan */ }
  return `<div class="diff">${Object.keys(b).map(k => `<div><span class="text-mut">${esc(k)}:</span> <del>${esc(k === 'Jumlah' ? rp(a[k]) : a[k] === undefined ? '-' : a[k])}</del> → <ins>${esc(k === 'Jumlah' ? rp(b[k]) : b[k] === 'PULIH' ? 'Dipulihkan' : b[k])}</ins></div>`).join('')}</div>`;
}
function htmlKoreksiRingkas(k) {
  return `<div class="kartu-2 mb-2"><div class="d-flex justify-content-between gap-2 flex-wrap">${chip(k.Jenis, k.Jenis === 'PEMBATALAN' ? 'err' : k.Jenis === 'PEMULIHAN' ? 'info' : 'warn')}${chip(k.Status, k.Status === 'DITERAPKAN' ? 'ok' : k.Status === 'DITOLAK' ? 'err' : 'warn')}</div>${htmlDiff(k.Sebelum, k.Sesudah)}<div class="sel-sub mt-1">“${esc(k.Alasan)}” — ${esc(k.Pengaju)}, ${tglPendek(k.Waktu)}</div></div>`;
}
ACT.formKoreksi = () => {
  const p = S.ui.detailP, opr = isOpr();
  bukaModal({
    judul: (opr ? 'Koreksi / Pembatalan ' : 'Ajukan Koreksi / Pembatalan ') + p.NoBukti, ukuran: 'lg',
    isi: `${opr ? peringatan('Sebagai Operator, perubahan <b>langsung diterapkan</b> dan dicatat di log audit dengan nilai sebelum & sesudah.', 'info', 'shield-check') : peringatan('Pengajuan Anda akan ditinjau Operator. Transaksi tidak berubah sampai disetujui.', 'info', 'hourglass')}
      <div class="mt-3 mb-3"><label class="form-label">Jenis</label><div class="seg" id="krJenis"><button class="aktif" data-act="krJenis" data-v="KOREKSI">Koreksi nilai</button><button data-act="krJenis" data-v="PEMBATALAN">Pembatalan</button></div></div>
      <div id="krBidang" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem">
        <div><label class="form-label" for="krJumlah">Jumlah (Rp)</label><div class="rp-group"><span class="rp-tag">Rp</span><input id="krJumlah" inputmode="numeric" data-inp="fmtRp" value="${ribu(p.Jumlah)}"></div></div>
        <div><label class="form-label" for="krMetode">Metode</label><select class="form-select" id="krMetode">${opsi([['TUNAI', 'Tunai'], ['TRANSFER', 'Transfer'], ['QRIS', 'QRIS']], p.Metode)}</select></div>
        <div><label class="form-label" for="krTanggal">Tanggal bayar</label><input type="date" class="form-control" id="krTanggal" value="${esc(String(p.Tanggal).slice(0, 10))}" max="${hariIni()}"></div>
        <div><label class="form-label" for="krPenyetor">Penyetor</label><input class="form-control" id="krPenyetor" value="${esc(p.Penyetor)}"></div>
        <div style="grid-column:span 2"><label class="form-label" for="krCatatan">Catatan</label><input class="form-control" id="krCatatan" value="${esc(p.Catatan)}"></div></div>
      <div class="mt-3"><label class="form-label" for="krAlasan">Alasan <span class="text-err">*</span></label><textarea class="form-control" id="krAlasan" rows="3" placeholder="Jelaskan alasan koreksi/pembatalan (minimal 10 karakter)"></textarea></div><div class="invalid-msg" id="krPesan"></div>`,
    kaki: `<button class="btn btn-soft" data-bs-dismiss="modal">Batal</button><button class="btn btn-primary" data-act="krKirim" data-jenis="KOREKSI"><i class="bi bi-send"></i> ${opr ? 'Terapkan' : 'Ajukan'}</button>`
  });
};
ACT.krJenis = el => { $$('#krJenis button').forEach(b => b.classList.toggle('aktif', b === el)); $('#krBidang').classList.toggle('hidden', el.dataset.v !== 'KOREKSI'); const b = $('[data-act=krKirim]'); b.dataset.jenis = el.dataset.v; b.className = 'btn ' + (el.dataset.v === 'PEMBATALAN' ? 'btn-danger' : 'btn-primary'); };
ACT.formPulihkan = async () => {
  const p = S.ui.detailP;
  const alasan = await konfirmasi('Pulihkan transaksi ' + p.NoBukti + '?', 'Transaksi dikembalikan ke status sebelum dibatalkan dan saldo tagihan diterapkan ulang (ditolak bila bulan tersebut sudah dibayar transaksi lain).', { ok: 'Pulihkan', input: { label: 'Alasan pemulihan', min: 10 } });
  if (alasan) kirimKoreksi({ id: p.ID, jenis: 'PEMULIHAN', alasan });
};
ACT.krKirim = btn => {
  const p = S.ui.detailP, jenis = btn.dataset.jenis, alasan = $('#krAlasan').value.trim();
  if (alasan.length < 10) { $('#krPesan').textContent = 'Alasan wajib diisi minimal 10 karakter.'; return; }
  const sesudah = jenis === 'KOREKSI' ? { Jumlah: angka($('#krJumlah').value), Metode: $('#krMetode').value, Tanggal: $('#krTanggal').value, Penyetor: $('#krPenyetor').value.trim(), Catatan: $('#krCatatan').value.trim() } : undefined;
  kirimKoreksi({ id: p.ID, jenis, sesudah, alasan }, btn);
};
async function kirimKoreksi(req, btn) {
  sibuk(btn, true, 'Mengirim…');
  try {
    const r = await api('ajukanKoreksi', req);
    S.db.koreksi.push(keObj('KoreksiTransaksi', r.koreksi));
    if (r.tagihan) { const p = keObj('Pembayaran', r.pembayaran); S.db.tg[p.SiswaID] = r.tagihan; S.memo.delete(p.SiswaID); const i = S.db.hariIni.findIndex(x => x.ID === p.ID); if (i >= 0) S.db.hariIni[i] = p; }
    S.cacheRw.clear(); tutupModal();
    toast(r.koreksi[10] === 'DITERAPKAN' ? 'Perubahan diterapkan & tercatat di log audit.' : 'Pengajuan terkirim ke Operator untuk ditinjau.', 'ok');
    rerenderHalaman();
  } catch (e) { const m = $('#krPesan'); if (m) m.textContent = e.message; else toast(e.message, 'err'); }
  finally { sibuk(btn, false); }
}
S.ui.kr = { tab: 'menunggu', jenis: '' };
HAL.koreksi = {
  judul: 'Persetujuan Koreksi',
  render() {
    const u = S.ui.kr, opr = isOpr();
    $('#krJudul').textContent = S.me.peran === PERAN.BEN ? 'Pengajuan Koreksi Saya' : 'Persetujuan Koreksi';
    const menunggu = S.db.koreksi.filter(k => k.Status === 'DIAJUKAN');
    $('#krTab').innerHTML = `<button data-act="krTab" data-v="menunggu" class="${u.tab === 'menunggu' ? 'aktif' : ''}">Menunggu tinjauan <span class="lencana ${menunggu.length ? 'pri' : ''}">${menunggu.length}</span></button><button data-act="krTab" data-v="semua" class="${u.tab === 'semua' ? 'aktif' : ''}">Seluruh riwayat <span class="lencana">${S.db.koreksi.length}</span></button>`;
    let rows = (u.tab === 'menunggu' ? menunggu : S.db.koreksi.slice()).sort((a, b) => a.Waktu < b.Waktu ? 1 : -1);
    $('#krDaftar').innerHTML = rows.length ? `<div class="tbl-wrap"><div class="tbl-scroll"><table class="tbl tbl-kartu"><thead><tr><th>Jenis</th><th>No. bukti</th><th>Perubahan (sebelum → sesudah)</th><th>Alasan</th><th>Pengaju</th><th>Status</th><th></th></tr></thead><tbody>
      ${rows.map(k => `<tr><td data-l="Jenis">${chip(k.Jenis, k.Jenis === 'PEMBATALAN' ? 'err' : k.Jenis === 'PEMULIHAN' ? 'info' : 'warn')}</td>
        <td class="utama"><a href="#" class="mono fw-bold" data-act="detailTrx" data-id="${k.PembayaranID}">${esc(k.NoBukti)}</a></td>
        <td data-l="Perubahan">${htmlDiff(k.Sebelum, k.Sesudah)}</td><td data-l="Alasan" style="max-width:280px">${esc(k.Alasan)}</td>
        <td data-l="Pengaju"><div class="sel-utama">${esc(k.Pengaju)}</div><div class="sel-sub">${tglPendek(k.Waktu)} ${jam(k.Waktu)}</div></td>
        <td data-l="Status">${chip(k.Status, k.Status === 'DITERAPKAN' ? 'ok' : k.Status === 'DITOLAK' ? 'err' : 'warn')}${k.Peninjau ? `<div class="sel-sub">${esc(k.Peninjau)}${k.CatatanTinjau ? ': ' + esc(k.CatatanTinjau) : ''}</div>` : ''}</td>
        <td data-l="" class="r" style="white-space:nowrap">${opr && k.Status === 'DIAJUKAN' ? `<button class="btn btn-outline-danger btn-sm" data-act="krTinjau" data-id="${k.ID}" data-k="TOLAK">Tolak</button> <button class="btn btn-primary btn-sm" data-act="krTinjau" data-id="${k.ID}" data-k="TERAPKAN">Terapkan</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`
      : `<div class="kartu">${kosong(u.tab === 'menunggu' ? 'Tidak ada pengajuan yang menunggu tinjauan.' : 'Belum ada koreksi atau pembatalan.', 'check2-all')}</div>`;
  }
};
ACT.krTab = el => { S.ui.kr.tab = el.dataset.v; HAL.koreksi.render(); };
ACT.krTinjau = async el => {
  const k = S.db.koreksi.find(x => x.ID === el.dataset.id), terap = el.dataset.k === 'TERAPKAN';
  const cat = await konfirmasi(terap ? 'Terapkan ' + k.Jenis.toLowerCase() + '?' : 'Tolak pengajuan?', `<b>${esc(k.NoBukti)}</b>${htmlDiff(k.Sebelum, k.Sesudah)}<div class="mt-2">“${esc(k.Alasan)}”</div>`, { ok: terap ? 'Terapkan' : 'Tolak', bahaya: !terap || k.Jenis === 'PEMBATALAN', input: { label: 'Catatan peninjau (opsional)' } });
  if (cat === false) return;
  try {
    const r = await api('tinjauKoreksi', k.ID, el.dataset.k, cat || '');
    Object.assign(k, keObj('KoreksiTransaksi', r.koreksi));
    if (r.tagihan && r.pembayaran) { const p = keObj('Pembayaran', r.pembayaran); S.db.tg[p.SiswaID] = r.tagihan; S.memo.delete(p.SiswaID); }
    S.cacheRw.clear(); toast(terap ? 'Diterapkan. Saldo & laporan diperbarui.' : 'Pengajuan ditolak.', 'ok'); rerenderHalaman();
  } catch (e) { toast(e.message, 'err'); }
};
