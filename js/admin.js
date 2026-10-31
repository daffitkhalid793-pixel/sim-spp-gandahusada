
// ════════════════════════════════════════════════════════════
// BAGIAN 5 — SIARAN, NOTIFIKASI, AKADEMIK, TARIF, IMPOR, LAPORAN,
//            PENGGUNA, PENGATURAN & LOG
// ════════════════════════════════════════════════════════════

// ── Data templat (sama dengan server) ──
function dataTpl(sw, extra = {}) {
  const s = S.set;
  return Object.assign({ nama_wali: sw.NamaWali || 'Wali Murid', nama_siswa: sw.Nama, nis: sw.NIS, kelas: namaKelas(sw.KelasID), jurusan: namaJurusan(sw.JurusanID), nama_sekolah: s.NAMA_SEKOLAH, bank: s.BANK, rekening: s.REKENING || '(lihat loket)', atas_nama: s.ATAS_NAMA }, extra);
}
const isiTpl = (tpl, d) => String(tpl || '').replace(/\{\{(\w+)\}\}/g, (m, k) => d[k] !== undefined ? d[k] : m);
const VAR_PENGINGAT = ['nama_wali', 'nama_siswa', 'nis', 'kelas', 'jurusan', 'bulan_tagihan', 'nominal', 'jatuh_tempo', 'total_tunggakan', 'nama_sekolah', 'bank', 'rekening', 'atas_nama'];
const VAR_TERIMA = ['nama_wali', 'nama_siswa', 'nis', 'kelas', 'no_bukti', 'tanggal_bayar', 'rincian', 'jumlah_bayar', 'metode', 'sisa_tunggakan', 'nama_sekolah'];
let _fokusTpl = null;
document.addEventListener('focusin', e => { if (e.target.dataset && e.target.dataset.tpl) _fokusTpl = e.target; });
ACT.sisipVar = el => {
  const t = _fokusTpl && document.body.contains(_fokusTpl) ? _fokusTpl : $('[data-tpl]'); if (!t) return;
  const v = '{{' + el.dataset.v + '}}', a = t.selectionStart || t.value.length, b = t.selectionEnd || a;
  t.value = t.value.slice(0, a) + v + t.value.slice(b); t.focus(); t.selectionStart = t.selectionEnd = a + v.length;
  t.dispatchEvent(new Event('input', { bubbles: true }));
};
const chipVar = list => `<div class="d-flex flex-wrap gap-1 mt-2"><span class="lbl-sm text-mut me-1">Variabel:</span>${list.map(v => `<span class="var-chip" data-act="sisipVar" data-v="${v}" role="button" tabindex="0">{{${v}}}</span>`).join('')}</div>`;
function pratinjauEmail(subjek, isi, ke) {
  return `<div class="email-prev"><div class="ep-head"><div><span class="text-mut">Dari:</span> ${esc(S.set.NAMA_SEKOLAH)}</div><div><span class="text-mut">Kepada:</span> ${esc(ke || '-')}</div><div><span class="text-mut">Subjek:</span> <b>${esc(subjek)}</b></div></div>
    <div class="ep-band"><div class="lbl-sm" style="opacity:.8">${esc(String(S.set.NAMA_YAYASAN || '').toUpperCase())}</div><div class="serif">${esc(S.set.NAMA_SEKOLAH)}</div></div><div class="ep-body">${esc(isi)}</div></div>`;
}

// ── Siaran Pengingat (W-22) ──
function defaultSr() {
  const jt = angka(S.set.JATUH_TEMPO_HARI) || 10, t = hariIni();
  let p = periodeKini(); if (Number(t.slice(8)) > jt) { const d = new Date(p + '-15T00:00:00'); d.setMonth(d.getMonth() + 1); p = isoTgl(d).slice(0, 7); }
  return { step: 1, periode: p, jur: [], tingkat: [], kecDisp: true, kecTahan: true, kanal: 'EMAIL', subjek: S.set.TPL_PENGINGAT_SUBJEK, isi: S.set.TPL_PENGINGAT_ISI, wa: S.set.TPL_PENGINGAT_WA, sampel: 0, aktifId: null, filterMan: 'SEMUA', siswaIds: [], daftar: null, status: null };
}
function sasaranLokal(u) {
  const p = u.periode, today = hariIni(), out = [];
  S.db.siswa.forEach(sw => {
    if (sw.Status !== 'AKTIF' || (u.kecDisp && sw.Kategori === 'DISPENSASI')) return;
    if (u.jur.length && !u.jur.includes(sw.JurusanID)) return;
    if (u.tingkat.length && !u.tingkat.includes(tingkatKelas(sw.KelasID))) return;
    if (u.siswaIds && u.siswaIds.length && !u.siswaIds.includes(sw.ID)) return;
    const rows = S.db.tg[sw.ID] || [], pr = rows.find(x => x[0] === p); if (!pr) return;
    const sisa = pr[1] - pr[2]; if (sisa <= 0 || (u.kecTahan && pr[3] > 0)) return;
    const total = rows.reduce((a, x) => a + ((x[0] <= p || x[4] <= today) ? Math.max(0, x[1] - x[2]) : 0), 0);
    out.push({ sw, sisa, total, jt: pr[4], d: dataTpl(sw, { bulan_tagihan: bulanLabel(p), nominal: rp(sisa), jatuh_tempo: tglLabel(pr[4]), total_tunggakan: rp(total) }) });
  });
  return out;
}
HAL.siaran = {
  judul: 'Siaran Pengingat',
  render() {
    S.ui.sr = Object.assign(defaultSr(), S.ui.sr || {});
    const u = S.ui.sr;
    $('#srMode').innerHTML = `${chip('Mode kirim: ' + S.set.MODE_KIRIM, S.set.MODE_KIRIM === 'LIVE' ? 'ok' : 'warn', S.set.MODE_KIRIM === 'LIVE' ? 'broadcast' : 'shield')}${chip('WhatsApp: ' + (S.set.WA_PROVIDER === 'NONAKTIF' ? 'pengembangan lanjutan' : S.set.WA_PROVIDER), S.set.WA_PROVIDER === 'NONAKTIF' ? '' : 'info', 'whatsapp')}`;
    const langkah = [['Filter sasaran & penunggak', 'Tahap 1'], ['Kanal & templat pesan', 'Tahap 2'], ['Pratinjau & simulasi', 'Tahap 3'], ['Eksekusi & monitor', 'Tahap 4']];
    $('#srStepper').innerHTML = langkah.map((l, i) => `<button class="step ${u.step === i + 1 ? 'aktif' : u.step > i + 1 ? 'selesai' : ''}" data-act="srStep" data-v="${i + 1}"><span class="no">${u.step > i + 1 ? '<i class="bi bi-check-lg"></i>' : i + 1}</span><span><span class="lbl-sm d-block">${l[1]}${u.step === i + 1 ? ' • berjalan' : u.step > i + 1 ? ' • selesai' : ''}</span><b style="font-size:13px">${l[0]}</b></span></button>`).join('');
    [renderSr1, renderSr2, renderSr3, renderSr4][u.step - 1]();
  }
};
ACT.srStep = el => { const v = Number(el.dataset.v); if (v === 4 || v <= S.ui.sr.step || sasaranLokal(S.ui.sr).length) { S.ui.sr.step = v; HAL.siaran.render(); } else toast('Tidak ada sasaran pada filter ini.', 'warn'); };
function kpiSasaran(sas) {
  const u = S.ui.sr, nEmail = sas.filter(x => emailValid(x.sw.EmailWali)).length, nWa = sas.filter(x => hpValid(x.sw.HPWali)).length;
  const jeda = (angka(S.set.JEDA_MIN_MS) + angka(S.set.JEDA_MAKS_MS)) / 2000, batch = angka(S.set.BATCH_SIARAN) || 20;
  const menit = Math.ceil(sas.length / batch) + Math.ceil(sas.length * jeda / 60);
  const valid = u.kanal === 'EMAIL' ? nEmail : u.kanal === 'WA' ? nWa : sas.filter(x => emailValid(x.sw.EmailWali) || hpValid(x.sw.HPWali)).length;
  return kpi({ label: 'Total sasaran', ikon: 'people', nilai: `${sas.length} <small>siswa</small>`, sub: 'Belum lunas ' + bulanLabel(u.periode) }) +
    kpi({ label: 'Nominal tertagih', ikon: 'wallet2', tone: 'warn', nilai: `<small>Rp</small> ${ribu(sas.reduce((a, x) => a + x.sisa, 0))}`, sub: `${sas.filter(x => x.total > x.sisa).length} siswa juga punya tunggakan lama` }) +
    kpi({ label: 'Kontak valid', ikon: 'person-check', tone: 'ok', nilai: `${valid} <small>${u.kanal === 'EMAIL' ? 'email' : u.kanal === 'WA' ? 'nomor WA' : 'kontak'}</small>`, sub: `<b class="${sas.length - valid ? 'text-err' : 'text-ok'}">${pctL(valid, sas.length)}</b> • ${sas.length - valid} tanpa kontak (tidak diantrekan)` }) +
    kpi({ label: 'Estimasi waktu kirim', ikon: 'stopwatch', nilai: `~${menit} <small>menit</small>`, sub: `${Math.ceil(sas.length / batch)} putaran × ${batch} pesan • jeda acak ${S.set.JEDA_MIN_MS / 1000}–${S.set.JEDA_MAKS_MS / 1000} dtk` });
}
function renderSr1() {
  const u = S.ui.sr, sas = sasaranLokal(u), ta = taAktif();
  $('#srIsi').innerHTML = `<div class="grid-kpi">${kpiSasaran(sas)}</div><div class="grid-2"><div class="kartu">
    <div class="kartu-head"><div class="h-sm"><i class="bi bi-funnel"></i> Parameter Segmentasi Sasaran</div><a href="#" data-act="srResetF" style="font-size:12px">Reset ke standar</a></div>
    ${u.siswaIds && u.siswaIds.length ? `<div class="mb-3">${peringatan(`Sasaran dibatasi pada <b>${u.siswaIds.length} siswa</b> yang dipilih dari Data Siswa. <a href="#" data-act="srHapusPilihan">Hapus batasan</a>`, 'info', 'person-check')}</div>` : ''}
    <div class="grid-2s" style="gap:1rem"><div><label class="form-label" for="srPer">Siklus tagihan</label><select class="form-select" id="srPer" data-chg="srF" data-k="periode">${opsi(periodeTA(ta).map(p => [p, 'SPP ' + bulanLabel(p) + ' (jatuh tempo ' + (angka(S.set.JATUH_TEMPO_HARI) || 10) + ' ' + BLN3[Number(p.slice(5)) - 1] + ')']), u.periode)}</select></div>
      <div><span class="form-label d-block">Jendela pengiriman</span><div class="kartu-2" style="padding:.55rem .75rem"><i class="bi bi-clock"></i> Pekerja berjalan otomatis setiap menit; ${S.set.MODE_KIRIM === 'LIVE' ? 'pesan sungguhan' : '<b>simulasi</b> (tidak mengirim)'}</div></div></div>
    <div class="grid-2s mt-3" style="gap:1rem"><div class="kartu-2"><div class="label mb-2">Kompetensi keahlian</div>${S.db.jurusan.map(j => `<div class="form-check"><input class="form-check-input" type="checkbox" id="srJ${j.ID}" data-chg="srArr" data-k="jur" value="${j.ID}" ${!u.jur.length || u.jur.includes(j.ID) ? 'checked' : ''}><label class="form-check-label d-flex justify-content-between" for="srJ${j.ID}" style="width:100%"><span>${esc(j.Nama)}</span><span class="text-mut num">${S.db.siswa.filter(s => s.Status === 'AKTIF' && s.JurusanID === j.ID).length} siswa</span></label></div>`).join('')}</div>
      <div class="kartu-2"><div class="label mb-2">Tingkat akademik</div><div class="d-flex gap-3">${['X', 'XI', 'XII'].map(t => `<div class="form-check"><input class="form-check-input" type="checkbox" id="srT${t}" data-chg="srArr" data-k="tingkat" value="${t}" ${!u.tingkat.length || u.tingkat.includes(t) ? 'checked' : ''}><label class="form-check-label" for="srT${t}">${t}</label></div>`).join('')}</div></div></div>
    <div class="kartu-2 mt-3"><div class="label mb-2">Klausul proteksi & pengecualian aman</div>
      <div class="form-check mb-2"><input class="form-check-input" type="checkbox" id="srKD" data-chg="srCek" data-k="kecDisp" ${u.kecDisp ? 'checked' : ''}><label class="form-check-label" for="srKD"><b>Kecualikan siswa dispensasi yayasan</b><div class="sel-sub">${S.db.siswa.filter(s => s.Status === 'AKTIF' && s.Kategori === 'DISPENSASI').length} siswa dalam beasiswa / tenggat khusus</div></label></div>
      <div class="form-check"><input class="form-check-input" type="checkbox" id="srKT" data-chg="srCek" data-k="kecTahan" ${u.kecTahan ? 'checked' : ''}><label class="form-check-label" for="srKT"><b>Kecualikan antrean verifikasi kasir</b><div class="sel-sub">${S.db.pending.length} transfer menunggu verifikasi bendahara</div></label></div></div>
    <div class="d-flex justify-content-end mt-3"><button class="btn btn-primary" data-act="srStep" data-v="2" ${sas.length ? '' : 'disabled'}>Lanjut: kanal & templat <i class="bi bi-arrow-right"></i></button></div></div>
    <div class="kartu"><div class="kartu-head"><div class="h-sm">Riwayat siaran</div><button class="btn btn-ghost btn-sm" data-act="srStep" data-v="4">Monitor <i class="bi bi-arrow-right"></i></button></div><div id="srRiwayat">${(u.daftar || []).length ? '' : '<div class="skeleton" style="height:120px"></div>'}</div></div></div>`;
  muatDaftarSiaran().then(renderRiwayatSiaran);
}
async function muatDaftarSiaran(paksa) { if (S.ui.sr.daftar && !paksa) return; try { S.ui.sr.daftar = (await api('siaranDaftar')).map(r => keObj('Siaran', r)); } catch (e) { S.ui.sr.daftar = []; } }
function chipSiaran(st) { return chip(st, { SELESAI: 'ok', BERJALAN: 'info', JEDA: 'warn', DIHENTIKAN: 'err', SIAP: '' }[st] || ''); }
function renderRiwayatSiaran() {
  const el = $('#srRiwayat'); if (!el) return;
  const d = S.ui.sr.daftar || [];
  el.innerHTML = d.length ? d.slice(0, 8).map(s => `<div class="notif-item" data-act="srBuka" data-id="${s.ID}"><span class="kpi-ikon ${s.Status === 'SELESAI' ? 'ok' : s.Status === 'DIHENTIKAN' ? 'err' : ''}"><i class="bi bi-megaphone"></i></span><div style="flex:1;min-width:0"><div class="sel-utama mono" style="font-size:12.5px">${esc(s.Kode)}</div><div class="sel-sub">${bulanLabel(s.Periode)} • ${esc(s.Kanal)} • ${s.Terkirim}/${s.Total} terkirim</div></div>${chipSiaran(s.Status)}</div>`).join('') : kosong('Belum ada siaran.', 'megaphone');
}
CHG.srF = el => { S.ui.sr[el.dataset.k] = el.value; HAL.siaran.render(); };
CHG.srCek = el => { S.ui.sr[el.dataset.k] = el.checked; HAL.siaran.render(); };
CHG.srArr = el => { const k = el.dataset.k; S.ui.sr[k] = $$(`[data-chg=srArr][data-k=${k}]`).filter(x => x.checked).map(x => x.value); if (S.ui.sr[k].length === $$(`[data-chg=srArr][data-k=${k}]`).length) S.ui.sr[k] = []; HAL.siaran.render(); };
ACT.srResetF = () => { const d = defaultSr(); Object.assign(S.ui.sr, { periode: d.periode, jur: [], tingkat: [], kecDisp: true, kecTahan: true, siswaIds: [] }); HAL.siaran.render(); };
ACT.srHapusPilihan = () => { S.ui.sr.siswaIds = []; HAL.siaran.render(); };
function renderSr2() {
  const u = S.ui.sr, waOk = S.set.WA_PROVIDER !== 'NONAKTIF';
  const kartuKanal = (v, ikon, j, k, aktifB) => `<button class="kpi text-start ${u.kanal === v ? '' : ''}" style="cursor:${aktifB ? 'pointer' : 'not-allowed'};${u.kanal === v ? 'border-color:var(--primary);box-shadow:inset 0 0 0 1px var(--primary);background:var(--primary-soft)' : ''};opacity:${aktifB ? 1 : .55}" ${aktifB ? `data-act="srKanal" data-v="${v}"` : 'disabled'}><div class="d-flex gap-2 align-items-center"><i class="bi bi-${ikon} text-pri" style="font-size:20px"></i><b>${j}</b>${u.kanal === v ? '<i class="bi bi-check-circle-fill text-pri ms-auto"></i>' : ''}</div><div class="sel-sub">${k}</div></button>`;
  $('#srIsi').innerHTML = `<div class="grid-3 mb-4">${kartuKanal('EMAIL', 'envelope', 'Email (Gmail)', 'Tahap 2 PRD — aktif. Kuota harian Gmail berlaku.', true)}${kartuKanal('WA', 'whatsapp', 'WhatsApp resmi', waOk ? 'Penyedia: ' + S.set.WA_PROVIDER : 'Pengembangan lanjutan — aktifkan penyedia di Pengaturan', waOk)}${kartuKanal('WA+EMAIL', 'arrow-left-right', 'WhatsApp + fallback email', waOk ? 'WA gagal → otomatis kirim email' : 'Butuh penyedia WhatsApp', waOk)}</div>
    <div class="grid-2"><div class="kartu"><div class="kartu-head"><div class="h-sm"><i class="bi bi-pencil-square"></i> Penyunting Templat Pesan</div>${chip('Variabel otomatis per siswa', 'info')}</div>
      ${u.kanal !== 'WA' ? `<label class="form-label" for="srSubjek">Subjek email</label><input class="form-control mb-3" id="srSubjek" data-tpl="1" data-inp="srTpl" data-k="subjek" value="${esc(u.subjek)}">
      <label class="form-label" for="srIsiTpl">Isi email</label><textarea class="form-control mono" id="srIsiTpl" rows="12" data-tpl="1" data-inp="srTpl" data-k="isi" style="font-size:12.5px">${esc(u.isi)}</textarea>` : ''}
      ${u.kanal !== 'EMAIL' ? `<label class="form-label mt-3" for="srWaTpl">Isi pesan WhatsApp</label><textarea class="form-control" id="srWaTpl" rows="4" data-tpl="1" data-inp="srTpl" data-k="wa">${esc(u.wa)}</textarea>` : ''}
      ${chipVar(VAR_PENGINGAT)}<div class="d-flex justify-content-between mt-3"><span class="text-mut" style="font-size:12px" id="srHitung">${(u.isi || '').length} karakter</span><button class="btn btn-ghost btn-sm" data-act="srTplBawaan"><i class="bi bi-arrow-counterclockwise"></i> Pakai templat bawaan</button></div></div>
    <div class="kartu"><div class="kartu-head"><div class="h-sm"><i class="bi bi-eye"></i> Pratinjau langsung</div></div><div id="srPrev"></div>
      <div class="d-flex justify-content-between mt-3"><button class="btn btn-soft" data-act="srStep" data-v="1"><i class="bi bi-arrow-left"></i> Kembali</button><button class="btn btn-primary" data-act="srStep" data-v="3">Lanjut: pratinjau & simulasi <i class="bi bi-arrow-right"></i></button></div></div></div>`;
  perbaruiPrevSr();
}
function perbaruiPrevSr() {
  const u = S.ui.sr, sas = sasaranLokal(u), el = $('#srPrev'); if (!el) return;
  const x = sas[Math.min(u.sampel, sas.length - 1)] || { sw: { Nama: 'Siswa Contoh', NamaWali: 'Bpk. Contoh', EmailWali: 'wali@contoh.sch.id', HPWali: '0812…' }, d: dataTpl({ Nama: 'Siswa Contoh', NamaWali: 'Bpk. Contoh', NIS: '00000000', KelasID: '', JurusanID: '' }, { bulan_tagihan: bulanLabel(u.periode), nominal: rp(450000), jatuh_tempo: tglLabel(u.periode + '-10'), total_tunggakan: rp(900000) }) };
  el.innerHTML = `<div class="d-flex justify-content-between align-items-center mb-2"><span class="text-2" style="font-size:12.5px">Simulasi untuk: <b>${esc(x.sw.Nama)}</b></span><span><button class="btn btn-ghost btn-sm btn-icon" data-act="srSampel" data-d="-1" aria-label="Sebelumnya"><i class="bi bi-chevron-left"></i></button><button class="btn btn-ghost btn-sm btn-icon" data-act="srSampel" data-d="1" aria-label="Berikutnya"><i class="bi bi-chevron-right"></i></button></span></div>` +
    (u.kanal !== 'WA' ? pratinjauEmail(isiTpl(u.subjek, x.d), isiTpl(u.isi, x.d), x.sw.EmailWali) : '') +
    (u.kanal !== 'EMAIL' ? `<div class="wa-prev mt-3"><div class="wa-bubble">${esc(isiTpl(u.wa, x.d))}<div class="text-end" style="font-size:10px;opacity:.6">${new Date().toTimeString().slice(0, 5)} ✓✓</div></div></div>` : '');
}
ACT.srKanal = el => { S.ui.sr.kanal = el.dataset.v; HAL.siaran.render(); };
INP.srTpl = el => { S.ui.sr[el.dataset.k] = el.value; const h = $('#srHitung'); if (h) h.textContent = (S.ui.sr.isi || '').length + ' karakter'; perbaruiPrevSr(); };
ACT.srSampel = el => { const n = sasaranLokal(S.ui.sr).length || 1; S.ui.sr.sampel = (S.ui.sr.sampel + Number(el.dataset.d) + n) % n; perbaruiPrevSr(); };
ACT.srTplBawaan = () => { Object.assign(S.ui.sr, { subjek: S.set.TPL_PENGINGAT_SUBJEK, isi: S.set.TPL_PENGINGAT_ISI, wa: S.set.TPL_PENGINGAT_WA }); HAL.siaran.render(); };
function renderSr3() {
  const u = S.ui.sr, sas = sasaranLokal(u);
  $('#srIsi').innerHTML = `<div class="grid-kpi">${kpiSasaran(sas)}</div><div class="grid-2"><div class="tbl-wrap"><div class="kartu-head px-3 pt-3 mb-2"><div class="h-sm">Daftar Antrean Target</div><span class="text-mut" style="font-size:12px">${sas.length} siswa siap dieksekusi berurutan</span></div>
      <div class="tbl-scroll" style="max-height:460px"><table class="tbl tbl-kartu"><thead><tr><th>#</th><th>Siswa & kelas</th><th>Wali & kontak</th><th class="r">Sisa tagihan</th><th>Status kontak</th></tr></thead><tbody>
      ${sas.map((x, i) => { const ok = u.kanal === 'EMAIL' ? emailValid(x.sw.EmailWali) : u.kanal === 'WA' ? hpValid(x.sw.HPWali) : emailValid(x.sw.EmailWali) || hpValid(x.sw.HPWali); return `<tr><td data-l="Urut" class="num">${i + 1}</td><td class="utama"><div class="sel-utama">${esc(x.sw.Nama)}</div><div class="sel-sub">NIS ${esc(x.sw.NIS)} • ${esc(namaKelas(x.sw.KelasID))}</div></td><td data-l="Wali"><div>${esc(x.sw.NamaWali || '-')}</div><div class="sel-sub">${esc(u.kanal === 'WA' ? x.sw.HPWali : x.sw.EmailWali || x.sw.HPWali || '-')}</div></td><td data-l="Sisa" class="r num"><b>${rp(x.sisa)}</b>${x.total > x.sisa ? `<div class="sel-sub text-err">total ${rp(x.total)}</div>` : ''}</td><td data-l="Kontak">${ok ? chip(u.kanal === 'EMAIL' ? 'Email valid' : 'Kontak valid', 'ok') : chip('Dilewati — kontak kosong', 'err')}</td></tr>`; }).join('')}</tbody></table></div></div>
    <div class="tumpuk"><div class="kartu"><div class="h-sm mb-2"><i class="bi bi-eye"></i> Pratinjau nyata pesan</div><div id="srPrev"></div></div>
      <div class="kartu"><div class="h-sm mb-2"><i class="bi bi-flask"></i> Uji kirim 1 pesan</div><p class="text-2" style="font-size:13px">Kirim contoh ke email Anda sendiri sebelum siaran massal${S.set.MODE_KIRIM !== 'LIVE' ? ' (mode <b>Simulasi</b>: hanya ditampilkan, tidak dikirim)' : ''}.</p><div class="d-flex gap-2"><input class="form-control" id="srUjiEmail" type="email" placeholder="email.anda@sekolah.sch.id"><button class="btn btn-soft" data-act="srUji"><i class="bi bi-send"></i> Uji</button></div></div>
      ${peringatan(`Protokol anti-spam: maks <b>${esc(S.set.BATCH_SIARAN)}</b> pesan per putaran, jeda acak ${S.set.JEDA_MIN_MS / 1000}–${S.set.JEDA_MAKS_MS / 1000} detik. Sebelum setiap pesan, sistem memeriksa ulang pelunasan di loket — siswa yang baru lunas otomatis dilewati. Pengingat yang sama tidak dikirim dua kali.`, 'info', 'shield-check')}
      <div class="d-flex justify-content-between"><button class="btn btn-soft" data-act="srStep" data-v="2"><i class="bi bi-arrow-left"></i> Kembali</button><button class="btn btn-primary" data-act="srBuat" ${sas.length ? '' : 'disabled'}><i class="bi bi-rocket-takeoff"></i> Buat &amp; Mulai Siaran (${sas.length} pesan)</button></div></div></div>`;
  perbaruiPrevSr();
}
ACT.srUji = async btn => {
  const e = $('#srUjiEmail').value.trim(); if (!emailValid(e)) { toast('Isi alamat email uji yang valid.', 'warn'); return; }
  sibuk(btn, true, 'Mengirim…');
  try { const r = await api('siaranUji', e, S.ui.sr.subjek, S.ui.sr.isi); toast(r.terkirim ? 'Email uji terkirim ke ' + e + '.' : 'Mode simulasi: email tidak dikirim. Subjek: ' + r.subjek, r.terkirim ? 'ok' : 'info'); }
  catch (er) { toast(er.message, 'err'); } finally { sibuk(btn, false); }
};
ACT.srBuat = async btn => {
  const u = S.ui.sr, n = sasaranLokal(u).length;
  if (!(await konfirmasi('Mulai siaran pengingat?', `<b>${n} pesan</b> ${u.kanal} untuk SPP ${bulanLabel(u.periode)} akan diproses bertahap oleh pekerja latar. Mode: <b>${esc(S.set.MODE_KIRIM)}</b>. Anda dapat menjeda atau menghentikan kapan saja.`, { ok: 'Mulai siaran' }))) return;
  sibuk(btn, true, 'Membuat siaran…');
  try {
    const r = await api('siaranBuat', { periode: u.periode, jurusan: u.jur, tingkat: u.tingkat, kecualiDispensasi: u.kecDisp, kecualiTertahan: u.kecTahan, kanal: u.kanal, subjek: u.subjek, isi: u.isi, isiWa: u.wa, siswaIds: u.siswaIds, label: 'MANUAL' });
    const sr = keObj('Siaran', r.siaran);
    await api('siaranAksi', sr.ID, 'MULAI');
    apiLatar('kickAntrean');
    toast(`Siaran ${sr.Kode} dimulai (${sr.Total} pesan${r.dilewati ? ', ' + r.dilewati + ' dilewati karena sudah pernah dikirim' : ''}${r.tanpaKontak ? ', ' + r.tanpaKontak + ' dilewati karena kontak tidak valid' : ''}).`, 'ok');
    Object.assign(u, { step: 4, aktifId: sr.ID, siswaIds: [] }); await muatDaftarSiaran(true); HAL.siaran.render();
  } catch (e) { toast(e.message, 'err'); } finally { sibuk(btn, false); }
};
ACT.srBuka = el => { S.ui.sr.aktifId = el.dataset.id; S.ui.sr.step = 4; HAL.siaran.render(); };
let _pollSiaran = null, _pollN = 0;
function renderSr4() {
  const u = S.ui.sr;
  muatDaftarSiaran().then(() => {
    if (!u.aktifId && u.daftar && u.daftar[0]) u.aktifId = u.daftar[0].ID;
    if (!u.aktifId) { $('#srIsi').innerHTML = `<div class="kartu">${kosong('Belum ada siaran. Buat siaran baru dari Tahap 1.', 'megaphone')}<div class="text-center"><button class="btn btn-primary" data-act="srStep" data-v="1">Buat siaran</button></div></div>`; return; }
    $('#srIsi').innerHTML = `<div class="d-flex gap-2 flex-wrap mb-3 align-items-center"><select class="form-select" style="max-width:420px" data-chg="srPilih" aria-label="Pilih siaran">${opsi((u.daftar || []).map(s => [s.ID, s.Kode + ' • ' + bulanLabel(s.Periode) + ' • ' + s.Status]), u.aktifId)}</select><div class="ms-auto d-flex gap-2" id="srKontrol"></div></div><div class="grid-kpi" id="srKpi"></div>
      <div class="grid-2 mb-4"><div class="konsol"><div class="konsol-head"><span class="lampu"><i style="background:#FF5F57"></i><i style="background:#FEBC2E"></i><i style="background:#28C840"></i></span><span>GAS_RUNTIME_STDOUT // PEKERJA_ANTREAN</span><span class="ms-auto" id="srLive" style="font-weight:500"></span></div><div class="konsol-isi" id="srLog" aria-live="polite"></div><div class="konsol-kaki" id="srKaki"></div></div>
      <div class="kartu" id="srTopologi"></div></div>
      <div class="tbl-wrap" id="srManifes"><div class="p-3"><div class="skeleton" style="height:160px"></div></div></div>`;
    _pollN = 0; pollSiaran(true);
  });
}
CHG.srPilih = el => { S.ui.sr.aktifId = el.value; S.ui.sr.status = null; renderSr4(); };
async function pollSiaran(lengkap) {
  clearTimeout(_pollSiaran);
  const u = S.ui.sr; if (S.hal !== 'siaran' || u.step !== 4 || !u.aktifId) return;
  try {
    const r = await api('siaranStatus', u.aktifId, lengkap || _pollN % 3 === 0);
    if (r.items) u.items = r.items;
    u.status = r; renderMonitor();
    const st = r.siaran[K_SIARAN.Status];
    if (st === 'BERJALAN') { _pollN++; _pollSiaran = setTimeout(() => pollSiaran(false), 4000); }
  } catch (e) { $('#srLog') && ($('#srLog').innerHTML = `<div class="er">${esc(e.message)}</div>`); }
}
const K_SIARAN = { ID: 0, Kode: 1, Dibuat: 2, Operator: 4, Periode: 6, Kanal: 7, Filter: 8, Total: 10, Terkirim: 11, Dilewati: 12, Gagal: 13, Status: 14, Checkpoint: 15, Mulai: 16, Selesai: 17 };
function renderMonitor() {
  const u = S.ui.sr, r = u.status; if (!r || !$('#srKpi')) return;
  const s = keObj('Siaran', r.siaran), items = u.items || [];
  const sel = Number(s.Terkirim) + Number(s.Dilewati) + Number(s.Gagal), tot = Number(s.Total) || 1;
  const nSim = items.filter(i => i[5] === 'SIMULASI').length;
  $('#srKontrol').innerHTML = `${s.Status === 'SIAP' ? '<button class="btn btn-primary" data-act="srAksi" data-v="MULAI"><i class="bi bi-play-fill"></i> Mulai</button>' : ''}${s.Status === 'BERJALAN' ? '<button class="btn btn-soft" data-act="srAksi" data-v="JEDA"><i class="bi bi-pause-fill"></i> Jeda siaran</button>' : ''}${s.Status === 'JEDA' ? '<button class="btn btn-primary" data-act="srAksi" data-v="LANJUT"><i class="bi bi-skip-forward-fill"></i> Lanjutkan dari checkpoint</button>' : ''}${['SIAP', 'BERJALAN', 'JEDA'].includes(s.Status) ? '<button class="btn btn-danger" data-act="srAksi" data-v="HENTIKAN"><i class="bi bi-sign-stop"></i> Kill switch darurat</button>' : ''}<button class="btn btn-ghost" data-act="srEkspor"><i class="bi bi-download"></i> Manifes (.xlsx)</button>`;
  $('#srKpi').innerHTML = kpi({ label: 'Progres kumulatif', ikon: 'activity', nilai: `${sel} <small>/ ${s.Total}</small>`, sub: `<div style="flex:1"><div class="bar mt-1"><span style="width:${pct(sel, tot)}%"></span></div><div class="mt-1">${chipSiaran(s.Status)} ${pctL(sel, tot)}</div></div>` }) +
    kpi({ label: 'Terkirim', ikon: 'send-check', tone: 'ok', nilai: `${s.Terkirim} <small>pesan</small>`, sub: nSim ? `<span class="chip chip-warn">${nSim} simulasi</span>` : esc(s.Kanal) }) +
    kpi({ label: 'Perlindungan kasir', ikon: 'shield-check', tone: 'warn', nilai: `${s.Dilewati} <small>dilewati</small>`, sub: 'Lunas di loket — tidak ditagih ganda' }) +
    kpi({ label: 'Gagal / kuota email', ikon: 'exclamation-octagon', tone: Number(s.Gagal) ? 'err' : '', nilai: `${s.Gagal} <small>gagal</small>`, sub: `Sisa kuota email hari ini: <b>${r.kuotaEmail < 0 ? '—' : r.kuotaEmail}</b>` });
  $('#srLive').innerHTML = s.Status === 'BERJALAN' ? '<span class="dot berdenyut" style="color:#7EE2A8"></span> LIVE' : esc(s.Status);
  const log = (r.log || []).slice(-60);
  $('#srLog').innerHTML = `<div class="t">[${esc(String(s.Dibuat).slice(11))}] <span class="in">SIARAN_DIBUAT</span> ${esc(s.Kode)} • ${s.Total} sasaran • kanal ${esc(s.Kanal)} • oleh ${esc(s.Operator)}</div>` + (s.Mulai ? `<div class="t">[${esc(String(s.Mulai).slice(11))}] <span class="in">MUTEX_LOCK</span> pekerja antrean memperoleh kunci eksklusif</div>` : '') +
    log.map(l => `<div><span class="t">[${esc(l[0])}]</span> <span class="${l[4] === 'TERKIRIM' ? 'ok' : l[4] === 'SIMULASI' ? 'wr' : l[4] === 'DILEWATI' ? 'wr' : 'er'}">${l[4] === 'DILEWATI' ? 'MUTATION_GUARD' : l[4] === 'GAGAL' ? 'DISPATCH_FAIL' : 'DISPATCH_OK'}</span> ${esc(l[1])} ${esc(l[2])} → ${esc(l[3])} • ${esc(l[5])}</div>`).join('') +
    (s.Status === 'SELESAI' ? `<div class="ok">[${esc(String(s.Selesai).slice(11))}] SIARAN_SELESAI — checkpoint final ${esc(String(s.Checkpoint).slice(0, 12))}…</div>` : s.Status === 'DIHENTIKAN' ? `<div class="er">KILL_SWITCH — sisa antrean dibatalkan</div>` : s.Status === 'BERJALAN' ? '<div class="in">▌ menunggu putaran pekerja berikutnya…</div>' : '');
  const lg = $('#srLog'); lg.scrollTop = lg.scrollHeight;
  $('#srKaki').innerHTML = `<span>Checkpoint: <b>${esc(String(s.Checkpoint).split(':')[0].slice(0, 10))}…:${esc(String(s.Checkpoint).split(':')[1] || '0')}</b></span><span>Mulai: ${esc(String(s.Mulai || '-').slice(11))}</span><span>Mode: ${esc(S.set.MODE_KIRIM)}</span>`;
  const flt = JSON.parse(s.Filter || '{}');
  $('#srTopologi').innerHTML = `<div class="h-sm mb-3"><i class="bi bi-diagram-3"></i> Rincian siaran</div><div class="info-grid" style="grid-template-columns:1fr 1fr">
    <div class="info-sel"><span class="lbl-sm">Siklus tagihan</span>${bulanLabel(s.Periode)}</div><div class="info-sel"><span class="lbl-sm">Kanal</span>${esc(s.Kanal)}</div>
    <div class="info-sel"><span class="lbl-sm">Dikecualikan</span>${flt.kecualiDispensasi ? 'Dispensasi' : '—'}${flt.kecualiTertahan ? ' • Antrean verifikasi' : ''}</div><div class="info-sel"><span class="lbl-sm">Tidak diantrekan</span>${flt.dilewatiDedup || 0} sudah pernah • ${flt.tanpaKontak || 0} tanpa kontak</div>
    <div class="info-sel"><span class="lbl-sm">Batch / jeda</span>${esc(S.set.BATCH_SIARAN)} pesan • ${S.set.JEDA_MIN_MS / 1000}–${S.set.JEDA_MAKS_MS / 1000} dtk</div><div class="info-sel"><span class="lbl-sm">Pekerja</span>Pemicu 1 menit + dorongan klien</div></div>
    ${peringatan('Status otomatis tercatat di sheet <b>Notifikasi</b> dan <b>LogAudit</b>. Melanjutkan dari checkpoint memvalidasi token HMAC agar tidak ada pesan ganda.', 'info', 'journal-check')}`;
  const fm = u.filterMan, list = items.filter(i => fm === 'SEMUA' || (fm === 'TERKIRIM' ? ['TERKIRIM', 'SIMULASI'].includes(i[5]) : i[5] === fm));
  const cnt = k => items.filter(i => k === 'TERKIRIM' ? ['TERKIRIM', 'SIMULASI'].includes(i[5]) : i[5] === k).length;
  $('#srManifes').innerHTML = `<div class="kartu-head px-3 pt-3 mb-0"><div class="h-sm">Manifes Antrean Siaran <span class="chip chip-info">${items.length} siswa</span></div><div class="seg">${[['SEMUA', 'Semua', items.length], ['TERKIRIM', 'Terkirim', cnt('TERKIRIM')], ['ANTRE', 'Antrean', cnt('ANTRE')], ['DILEWATI', 'Dilewati kasir', cnt('DILEWATI')], ['GAGAL', 'Gagal', cnt('GAGAL')]].map(x => `<button data-act="srMan" data-v="${x[0]}" class="${fm === x[0] ? 'aktif' : ''}">${x[1]} (${x[2]})</button>`).join('')}</div></div>
    <div class="tbl-scroll" style="max-height:420px"><table class="tbl tbl-kartu"><thead><tr><th>#</th><th>Siswa</th><th>Tujuan</th><th>Kanal</th><th>Status</th><th>Respons</th><th></th></tr></thead><tbody>${list.slice(0, 300).map((i, n) => `<tr class="${i[5] === 'DILEWATI' ? 'sorot' : ''}"><td data-l="#" class="num">${n + 1}</td><td class="utama"><div class="sel-utama ${i[5] === 'DILEWATI' ? 'text-decoration-line-through' : ''}">${esc(i[2])}</div><div class="sel-sub num">NIS ${esc(i[1])}</div></td><td data-l="Tujuan">${esc(i[3] || '-')}</td><td data-l="Kanal">${esc(i[4])}</td><td data-l="Status">${chip(i[5], { TERKIRIM: 'ok', SIMULASI: 'warn', DILEWATI: 'warn', GAGAL: 'err', ANTRE: 'info', DIBATALKAN: '' }[i[5]])}</td><td data-l="Respons" class="sel-sub" style="max-width:300px">${esc(i[6] || '')}<div>${esc(String(i[7] || '').slice(11))}</div></td><td data-l="" class="r">${['GAGAL', 'SIMULASI', 'DIBATALKAN'].includes(i[5]) ? `<button class="btn btn-ghost btn-sm" data-act="ntUlang" data-id="${i[0]}">Ulangi</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="7">${kosong('Tidak ada baris.', 'list')}</td></tr>`}</tbody></table></div>`;
}
ACT.srMan = el => { S.ui.sr.filterMan = el.dataset.v; renderMonitor(); };
ACT.srAksi = async el => {
  const a = el.dataset.v, s = keObj('Siaran', S.ui.sr.status.siaran);
  if (a === 'HENTIKAN' && !(await konfirmasi('Aktifkan kill switch?', `Siaran <b>${esc(s.Kode)}</b> dihentikan permanen. Pesan yang masih di antrean dibatalkan; yang sudah terkirim tetap tercatat.`, { ok: 'Hentikan sekarang', bahaya: true }))) return;
  sibuk(el, true, '…');
  try { await api('siaranAksi', s.ID, a); if (a === 'MULAI' || a === 'LANJUT') apiLatar('kickAntrean'); toast({ MULAI: 'Siaran dimulai.', JEDA: 'Siaran dijeda — checkpoint disimpan.', LANJUT: 'Dilanjutkan dari checkpoint.', HENTIKAN: 'Kill switch aktif. Siaran dihentikan.' }[a], a === 'HENTIKAN' ? 'warn' : 'ok'); await muatDaftarSiaran(true); pollSiaran(true); }
  catch (e) { toast(e.message, 'err'); sibuk(el, false); }
};
ACT.srEkspor = () => { const s = keObj('Siaran', S.ui.sr.status.siaran); eksporXlsx('Manifes_' + s.Kode + '.xlsx', [{ nama: 'Manifes', rows: [['ID', 'NIS', 'Nama', 'Tujuan', 'Kanal', 'Status', 'Respons', 'Waktu kirim']].concat(S.ui.sr.items || []) }]); };

// ── Notifikasi & Kuitansi ──
S.ui.nt = { tab: 'terima', log: { page: 1, status: '', jenis: '', q: '' }, data: null };
HAL.notifikasi = {
  judul: 'Notifikasi & Kuitansi',
  render() {
    const s = S.set, u = S.ui.nt;
    const st = u.data ? u.data.statistik : null;
    $('#ntKpi').innerHTML = kpi({ label: 'Kuitansi terkirim (bulan ini)', ikon: 'envelope-check', tone: 'ok', nilai: st ? `${st.terkirimBulanIni} <small>email</small>` : '<span class="skeleton d-inline-block" style="width:60px;height:24px"></span>', sub: st ? `${st.simulasi} simulasi tercatat` : '' }) +
      kpi({ label: 'Sisa kuota email hari ini', ikon: 'speedometer2', nilai: u.data ? `${u.data.kuotaEmail < 0 ? '—' : u.data.kuotaEmail} <small>email</small>` : '…', sub: 'Kuota MailApp akun pemilik skrip' }) +
      kpi({ label: 'Antrean pengiriman', ikon: 'hourglass-split', tone: 'warn', nilai: st ? `${st.antre} <small>pesan</small>` : '…', sub: st && st.gagal ? `<span class="text-err">${st.gagal} gagal — dapat dicoba ulang</span>` : 'Diproses pekerja tiap 5 menit' }) +
      kpi({ label: 'Mode kirim', ikon: s.MODE_KIRIM === 'LIVE' ? 'broadcast' : 'shield', tone: s.MODE_KIRIM === 'LIVE' ? 'ok' : 'warn', nilai: esc(s.MODE_KIRIM), sub: s.MODE_KIRIM === 'LIVE' ? 'Pesan benar-benar dikirim' : 'Aman untuk uji — tidak mengirim' });
    const sw = (k, l, ket) => `<div class="d-flex justify-content-between align-items-start gap-3 py-2" style="border-bottom:1px solid var(--border-subtle)"><div><div class="sel-utama">${l}</div><div class="sel-sub">${ket}</div></div><div class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" id="nt_${k}" ${s[k] === 'Y' ? 'checked' : ''} aria-label="${esc(l)}"></div></div>`;
    $('#ntPemicu').innerHTML = `<div class="kartu-head"><div class="h-sm"><i class="bi bi-lightning-charge"></i> Pemicu Otomatis</div>${chip('Pekerja terjadwal', 'info')}</div>
      ${sw('EMAIL_TANDA_TERIMA', 'Tanda terima seketika setelah pembayaran sah', 'Email + PDF bukti ke wali saat tunai dicatat / transfer diverifikasi')}
      ${sw('EMAIL_PENGINGAT_OTOMATIS', 'Pengingat tunggakan terjadwal', 'Dijalankan setiap pagi 07.00 sesuai jadwal di bawah; tidak berulang untuk siswa & periode yang sama')}
      <div class="grid-2s mt-3" style="gap:1rem"><div><label class="form-label" for="nt_PENGINGAT_JADWAL">Jadwal (hari relatif jatuh tempo)</label><input class="form-control" id="nt_PENGINGAT_JADWAL" value="${esc(s.PENGINGAT_JADWAL)}"><div class="form-text">-3 = H-3, 7 = H+7. Pisahkan dengan koma.</div></div>
        <div><label class="form-label" for="nt_KANAL_PENGINGAT">Kanal pengingat</label><select class="form-select" id="nt_KANAL_PENGINGAT">${opsi([['EMAIL', 'Email'], ['WA', 'WhatsApp'], ['WA+EMAIL', 'WhatsApp + fallback email']], s.KANAL_PENGINGAT)}</select></div></div>
      <div class="mt-3"><span class="form-label d-block">Mode kirim</span><div class="seg" id="ntMode"><button data-act="ntMode" data-v="SIMULASI" class="${s.MODE_KIRIM !== 'LIVE' ? 'aktif' : ''}"><i class="bi bi-shield"></i> Simulasi</button><button data-act="ntMode" data-v="LIVE" class="${s.MODE_KIRIM === 'LIVE' ? 'aktif' : ''}"><i class="bi bi-broadcast"></i> Live</button></div><div class="form-text">Gunakan Simulasi selama data contoh masih ada. Live mengirim email sungguhan ke wali.</div></div>
      <div class="grid-3 mt-3" style="gap:1rem"><div><label class="form-label" for="nt_BATCH_SIARAN">Pesan per putaran</label><input class="form-control" id="nt_BATCH_SIARAN" type="number" min="1" max="60" value="${esc(s.BATCH_SIARAN)}"></div><div><label class="form-label" for="nt_JEDA_MIN_MS">Jeda min (ms)</label><input class="form-control" id="nt_JEDA_MIN_MS" type="number" min="0" value="${esc(s.JEDA_MIN_MS)}"></div><div><label class="form-label" for="nt_JEDA_MAKS_MS">Jeda maks (ms)</label><input class="form-control" id="nt_JEDA_MAKS_MS" type="number" min="0" value="${esc(s.JEDA_MAKS_MS)}"></div></div>`;
    const tabs = { terima: ['Tanda terima', 'TPL_TERIMA_SUBJEK', 'TPL_TERIMA_ISI', VAR_TERIMA], pengingat: ['Pengingat email', 'TPL_PENGINGAT_SUBJEK', 'TPL_PENGINGAT_ISI', VAR_PENGINGAT], wa: ['Pengingat WhatsApp', '', 'TPL_PENGINGAT_WA', VAR_PENGINGAT] };
    const t = tabs[u.tab];
    $('#ntTemplat').innerHTML = `<div class="kartu-head"><div class="h-sm"><i class="bi bi-file-earmark-richtext"></i> Konten &amp; Templat</div>${chip('Tersimpan di Pengaturan', 'ok')}</div>
      <div class="tab-garis">${Object.keys(tabs).map(k => `<button data-act="ntTab" data-v="${k}" class="${u.tab === k ? 'aktif' : ''}">${tabs[k][0]}</button>`).join('')}</div>
      ${t[1] ? `<label class="form-label" for="nt_${t[1]}">Subjek</label><input class="form-control mb-2" id="nt_${t[1]}" data-tpl="1" data-inp="ntPrev" value="${esc(s[t[1]])}">` : ''}
      <label class="form-label" for="nt_${t[2]}">Isi pesan</label><textarea class="form-control mono" rows="9" id="nt_${t[2]}" data-tpl="1" data-inp="ntPrev" style="font-size:12.5px">${esc(s[t[2]])}</textarea>${chipVar(t[3])}<div class="mt-3" id="ntPrevIsi"></div>`;
    INP.ntPrev();
    muatLogNotif();
  }
};
INP.ntPrev = () => {
  const u = S.ui.nt, el = $('#ntPrevIsi'); if (!el) return;
  const sw = S.db.siswa.find(x => x.EmailWali) || { Nama: 'Siswa Contoh', NamaWali: 'Bpk. Contoh', NIS: '0000', KelasID: '', JurusanID: '', EmailWali: 'wali@contoh.sch.id' };
  const d = dataTpl(sw, { bulan_tagihan: bulanLabel(periodeKini()), nominal: rp(450000), jatuh_tempo: tglLabel(periodeKini() + '-10'), total_tunggakan: rp(900000), no_bukti: 'KW-' + periodeKini().replace('-', '') + '-00123', tanggal_bayar: tglLabel(hariIni()), rincian: bulanLabel(periodeKini()) + ' (Rp 450.000)', jumlah_bayar: rp(450000), metode: 'TUNAI', sisa_tunggakan: 'Rp 0' });
  if (u.tab === 'wa') el.innerHTML = `<div class="wa-prev"><div class="wa-bubble">${esc(isiTpl($('#nt_TPL_PENGINGAT_WA').value, d))}</div></div>`;
  else { const pre = u.tab === 'terima' ? 'TPL_TERIMA_' : 'TPL_PENGINGAT_'; el.innerHTML = pratinjauEmail(isiTpl($('#nt_' + pre + 'SUBJEK').value, d), isiTpl($('#nt_' + pre + 'ISI').value, d), sw.EmailWali); }
};
ACT.ntTab = el => { simpanSementaraTpl(); S.ui.nt.tab = el.dataset.v; HAL.notifikasi.render(); };
function simpanSementaraTpl() { $$('#ntTemplat [id^=nt_TPL_]').forEach(i => { S.set[i.id.slice(3)] = i.value; }); }
ACT.ntMode = async el => {
  const v = el.dataset.v;
  if (v === 'LIVE' && !(await konfirmasi('Aktifkan mode LIVE?', 'Email tanda terima & pengingat akan <b>benar-benar dikirim</b> ke alamat wali. Pastikan data contoh sudah dihapus dan alamat email wali benar.', { ok: 'Aktifkan LIVE', bahaya: true }))) return;
  $$('#ntMode button').forEach(b => b.classList.toggle('aktif', b === el)); S.ui.nt.mode = v;
};
ACT.ntSimpan = async btn => {
  simpanSementaraTpl();
  const o = {}; ['PENGINGAT_JADWAL', 'KANAL_PENGINGAT', 'BATCH_SIARAN', 'JEDA_MIN_MS', 'JEDA_MAKS_MS'].forEach(k => { const el = $('#nt_' + k); if (el) o[k] = el.value; });
  ['EMAIL_TANDA_TERIMA', 'EMAIL_PENGINGAT_OTOMATIS'].forEach(k => { const el = $('#nt_' + k); if (el) o[k] = el.checked ? 'Y' : 'N'; });
  ['TPL_TERIMA_SUBJEK', 'TPL_TERIMA_ISI', 'TPL_PENGINGAT_SUBJEK', 'TPL_PENGINGAT_ISI', 'TPL_PENGINGAT_WA'].forEach(k => { o[k] = S.set[k]; });
  if (S.ui.nt.mode) o.MODE_KIRIM = S.ui.nt.mode;
  sibuk(btn, true, 'Menyimpan…');
  try { S.set = await api('simpanPengaturan', o); S.ui.nt.mode = null; toast('Konfigurasi notifikasi disimpan.', 'ok'); HAL.notifikasi.render(); }
  catch (e) { toast(e.message, 'err'); } finally { sibuk(btn, false); }
};
async function muatLogNotif() {
  const u = S.ui.nt, el = $('#ntLog');
  if (!u.data) el.innerHTML = '<div class="p-3"><div class="skeleton" style="height:140px"></div></div>';
  try { u.data = await api('getNotifLog', u.log); renderLogNotif(); if (!$('#ntKpi .skeleton')) return; HAL.notifikasi.render(); }
  catch (e) { el.innerHTML = `<div class="p-3">${peringatan(esc(e.message), 'err')}</div>`; }
}
function renderLogNotif() {
  const u = S.ui.nt, d = u.data, rows = d.rows;
  $('#ntLog').innerHTML = `<div class="kartu-head px-3 pt-3 mb-2"><div><div class="h-sm">Log Pengiriman &amp; Antrean</div><div class="text-mut" style="font-size:12px">Status setiap pesan, respons layanan, dan percobaan ulang</div></div>
    <div class="d-flex gap-2 flex-wrap"><input class="form-control form-control-sm" style="width:200px" placeholder="Cari nama, email, ref…" value="${esc(u.log.q)}" data-inp="ntQ" aria-label="Cari log"><select class="form-select form-select-sm" style="width:auto" data-chg="ntLogF" data-k="status" aria-label="Status">${opsi([['TERKIRIM', 'Terkirim'], ['SIMULASI', 'Simulasi'], ['ANTRE', 'Antrean'], ['GAGAL', 'Gagal'], ['DILEWATI', 'Dilewati'], ['DIBATALKAN', 'Dibatalkan']], u.log.status, 'Semua status')}</select><select class="form-select form-select-sm" style="width:auto" data-chg="ntLogF" data-k="jenis" aria-label="Jenis">${opsi([['TANDA_TERIMA', 'Tanda terima'], ['PENGINGAT', 'Pengingat']], u.log.jenis, 'Semua jenis')}</select><button class="btn btn-soft btn-sm" data-act="ntMuat"><i class="bi bi-arrow-clockwise"></i></button></div></div>
    <div class="tbl-scroll"><table class="tbl tbl-kartu"><thead><tr><th>Waktu</th><th>Penerima &amp; siswa</th><th>Jenis &amp; ref</th><th>Kanal</th><th>Status</th><th>Respons</th><th></th></tr></thead><tbody>
    ${rows.map(r => { const n = keObj('Notifikasi', r); return `<tr><td data-l="Waktu" class="num">${tglPendek(n.Waktu)}<div class="sel-sub">${jam(n.WaktuKirim || n.Waktu)}</div></td><td class="utama"><div class="sel-utama">${esc(n.Nama)}</div><div class="sel-sub">${esc(n.Tujuan)}</div></td><td data-l="Jenis">${esc(n.Jenis === 'TANDA_TERIMA' ? 'Tanda terima' : 'Pengingat')}<div class="sel-sub mono">${esc(n.Ref)}</div></td><td data-l="Kanal">${esc(n.Kanal)}</td><td data-l="Status">${chip(n.Status, { TERKIRIM: 'ok', SIMULASI: 'warn', ANTRE: 'info', GAGAL: 'err', DILEWATI: 'warn' }[n.Status] || '')}</td><td data-l="Respons" class="sel-sub" style="max-width:280px">${esc(n.Respons)}</td><td data-l="" class="r">${['GAGAL', 'SIMULASI', 'DIBATALKAN'].includes(n.Status) ? `<button class="btn btn-ghost btn-sm" data-act="ntUlang" data-id="${n.ID}"><i class="bi bi-arrow-repeat"></i> Ulangi</button>` : ''}</td></tr>`; }).join('') || `<tr><td colspan="7">${kosong('Belum ada riwayat pengiriman.', 'envelope')}</td></tr>`}</tbody></table></div>
    <div class="tbl-foot"><span>${d.n} catatan (3.000 terakhir)</span>${pager('ntHal', d.page, d.n, d.size)}</div>`;
}
INP.ntQ = debounce(el => { S.ui.nt.log.q = el.value; S.ui.nt.log.page = 1; muatLogNotif(); }, 400);
CHG.ntLogF = el => { S.ui.nt.log[el.dataset.k] = el.value; S.ui.nt.log.page = 1; muatLogNotif(); };
ACT.ntHal = el => { S.ui.nt.log.page = Number(el.dataset.page); muatLogNotif(); };
ACT.ntMuat = () => muatLogNotif();
ACT.ntUlang = async el => { sibuk(el, true, '…'); try { const r = await api('ulangiNotif', el.dataset.id); toast('Dijadwalkan ulang' + (r && r.diproses ? ' & diproses (' + r.terkirim + ' terkirim)' : '') + '.', 'ok'); if (S.hal === 'notifikasi') muatLogNotif(); else pollSiaran(true); } catch (e) { toast(e.message, 'err'); sibuk(el, false); } };

// ── Data Akademik ──
S.ui.ak = { tab: 'Kelas', ta: '' };
HAL.akademik = {
  judul: 'Data Akademik',
  render() {
    const u = S.ui.ak; if (!u.ta) u.ta = taAktif().ID;
    const label = { Jurusan: 'Jurusan', TahunAjaran: 'Tahun Ajaran', Kelas: 'Kelas & Rombel' };
    $('#akTab').innerHTML = Object.keys(label).map(k => `<button data-act="akTab" data-v="${k}" class="${u.tab === k ? 'aktif' : ''}">${label[k]} <span class="lencana">${S.db[TABEL_DB[k]].length}</span></button>`).join('');
    $('#akAksi').innerHTML = isOpr() ? `<button class="btn btn-primary" data-act="akTambah"><i class="bi bi-plus-lg"></i> Tambah ${label[u.tab]}</button>` : '';
    const aksiEdit = (ent, id) => isOpr() ? `<button class="btn btn-ghost btn-sm" data-act="akUbah" data-e="${ent}" data-id="${id}"><i class="bi bi-pencil"></i> Ubah</button>` : '';
    const stChip = v => aktif(v) ? chip('Aktif', 'ok') : chip('Nonaktif');
    let html;
    if (u.tab === 'Jurusan') html = `<table class="tbl tbl-kartu"><thead><tr><th>Kode</th><th>Nama jurusan</th><th class="r">Siswa aktif</th><th class="r">Kelas</th><th>Status</th><th></th></tr></thead><tbody>${S.db.jurusan.map(j => `<tr><td data-l="Kode"><span class="chip chip-info">${esc(j.Kode)}</span></td><td class="utama sel-utama">${esc(j.Nama)}</td><td data-l="Siswa" class="r num">${S.db.siswa.filter(s => s.JurusanID === j.ID && s.Status === 'AKTIF').length}</td><td data-l="Kelas" class="r num">${S.db.kelas.filter(k => k.JurusanID === j.ID && k.TAID === taAktif().ID).length}</td><td data-l="Status">${stChip(j.Aktif)}</td><td data-l="" class="r">${aksiEdit('Jurusan', j.ID)}</td></tr>`).join('')}</tbody></table>`;
    else if (u.tab === 'TahunAjaran') html = `<table class="tbl tbl-kartu"><thead><tr><th>Tahun ajaran</th><th>Mulai</th><th>Selesai</th><th class="r">Periode tagihan</th><th>Status</th><th></th></tr></thead><tbody>${S.db.ta.slice().sort((a, b) => a.Mulai < b.Mulai ? 1 : -1).map(t => `<tr><td class="utama sel-utama">TA ${esc(t.Nama)}</td><td data-l="Mulai">${tglLabel(t.Mulai)}</td><td data-l="Selesai">${tglLabel(t.Selesai)}</td><td data-l="Periode" class="r num">${periodeTA(t).length} bulan</td><td data-l="Status">${aktif(t.Aktif) ? chip('Aktif', 'ok', 'star-fill') : chip('Arsip')}</td><td data-l="" class="r">${aksiEdit('TahunAjaran', t.ID)}</td></tr>`).join('')}</tbody></table>`;
    else html = `<div class="px-3 pt-3"><select class="form-select" style="max-width:280px" data-chg="akTa" aria-label="Tahun ajaran">${opsi(S.db.ta.map(t => [t.ID, 'TA ' + t.Nama]), u.ta)}</select></div><table class="tbl tbl-kartu mt-2"><thead><tr><th>Kelas</th><th>Tingkat</th><th>Jurusan</th><th>Wali kelas</th><th class="r">Siswa aktif</th><th class="r">Tarif</th><th>Status</th><th></th></tr></thead><tbody>${S.db.kelas.filter(k => k.TAID === u.ta).sort((a, b) => a.Nama.localeCompare(b.Nama, 'id', { numeric: true })).map(k => { const tr = S.db.tarif.find(t => t.TAID === k.TAID && t.JurusanID === k.JurusanID && t.Tingkat === k.Tingkat); return `<tr><td class="utama sel-utama">${esc(k.Nama)}</td><td data-l="Tingkat">${esc(k.Tingkat)}</td><td data-l="Jurusan">${esc(namaJurusan(k.JurusanID))}</td><td data-l="Wali">${esc(k.WaliKelas || '-')}</td><td data-l="Siswa" class="r num">${S.db.siswa.filter(s => s.KelasID === k.ID && s.Status === 'AKTIF').length}</td><td data-l="Tarif" class="r num">${tr ? rp(tr.Nominal) : '<span class="text-err">Belum diatur</span>'}</td><td data-l="Status">${stChip(k.Aktif)}</td><td data-l="" class="r">${aksiEdit('Kelas', k.ID)}</td></tr>`; }).join('') || `<tr><td colspan="8">${kosong('Belum ada kelas untuk tahun ajaran ini.')}</td></tr>`}</tbody></table>`;
    $('#akTabel').innerHTML = `<div class="tbl-scroll">${html}</div>`;
  }
};
ACT.akTab = el => { S.ui.ak.tab = el.dataset.v; HAL.akademik.render(); };
CHG.akTa = el => { S.ui.ak.ta = el.value; HAL.akademik.render(); };
ACT.akTambah = () => bukaFormMaster(S.ui.ak.tab, S.ui.ak.tab === 'Kelas' ? { TAID: S.ui.ak.ta } : null);
ACT.akUbah = el => bukaFormMaster(el.dataset.e, S.db[TABEL_DB[el.dataset.e]].find(r => r.ID === el.dataset.id));

// ── Tarif SPP ──
S.ui.tr = { ta: '' };
HAL.tarif = {
  judul: 'Tarif SPP',
  render() {
    const u = S.ui.tr; if (!u.ta) u.ta = taAktif().ID;
    const ta = S.idx.ta.get(u.ta) || taAktif(), nBln = periodeTA(ta).length;
    $('#trAksi').innerHTML = `<select class="form-select" style="width:auto" data-chg="trTa" aria-label="Tahun ajaran">${opsi(S.db.ta.map(t => [t.ID, 'TA ' + t.Nama]), u.ta)}</select>` + (isOpr() ? `<button class="btn btn-primary" data-act="trTambah"><i class="bi bi-plus-lg"></i> Tambah Tarif</button>` : '');
    let potensi = 0;
    const baris = S.db.jurusan.map(j => ['X', 'XI', 'XII'].map(tk => {
      const t = S.db.tarif.find(x => x.TAID === ta.ID && x.JurusanID === j.ID && x.Tingkat === tk);
      const n = S.db.siswa.filter(s => s.Status === 'AKTIF' && s.JurusanID === j.ID && (S.idx.kelas.get(s.KelasID) || {}).Tingkat === tk && (S.idx.kelas.get(s.KelasID) || {}).TAID === ta.ID).length;
      if (t && aktif(t.Aktif)) potensi += n * angka(t.Nominal) * nBln;
      return `<tr><td class="utama"><div class="sel-utama">${esc(j.Nama)}</div></td><td data-l="Tingkat"><span class="chip">${tk}</span></td><td data-l="Nominal" class="r num">${t ? `<b class="rp-md">${rp(t.Nominal)}</b><span class="text-mut"> /bulan</span>` : '<span class="text-err">Belum diatur</span>'}</td><td data-l="Siswa" class="r num">${n}</td><td data-l="Potensi/TA" class="r num">${t ? rp(n * angka(t.Nominal) * nBln) : '-'}</td><td data-l="Status">${t ? (aktif(t.Aktif) ? chip('Aktif', 'ok') : chip('Nonaktif')) : ''}</td><td data-l="" class="r">${isOpr() ? (t ? `<button class="btn btn-ghost btn-sm" data-act="trUbah" data-id="${t.ID}"><i class="bi bi-pencil"></i> Ubah</button>` : `<button class="btn btn-outline-primary btn-sm" data-act="trBaru" data-j="${j.ID}" data-t="${tk}">Atur</button>`) : ''}</td></tr>`;
    }).join('')).join('');
    $('#trIsi').innerHTML = `<div class="grid-kpi"><div style="grid-column:span 2">${peringatan('<b>US-05:</b> Mengubah tarif tidak mengubah tagihan yang sudah dibuat. Tarif baru dipakai saat Operator membuat tagihan periode berikutnya.', 'info', 'info-circle')}</div>${kpi({ label: 'Potensi penerimaan TA', ikon: 'cash-stack', tone: 'ok', nilai: `<small>Rp</small> ${ribu(potensi)}`, sub: nBln + ' bulan × siswa aktif × tarif' })}${kpi({ label: 'Kombinasi tarif', ikon: 'tags', nilai: `${S.db.tarif.filter(t => t.TAID === ta.ID).length} <small>/ ${S.db.jurusan.length * 3}</small>`, sub: 'Jurusan × tingkat' })}</div>
      <div class="tbl-wrap"><div class="tbl-scroll"><table class="tbl tbl-kartu"><thead><tr><th>Jurusan</th><th>Tingkat</th><th class="r">Nominal SPP</th><th class="r">Siswa aktif</th><th class="r">Potensi per TA</th><th>Status</th><th></th></tr></thead><tbody>${baris}</tbody></table></div></div>`;
  }
};
CHG.trTa = el => { S.ui.tr.ta = el.value; HAL.tarif.render(); };
ACT.trTambah = () => bukaFormMaster('TarifSPP', { TAID: S.ui.tr.ta });
ACT.trBaru = el => bukaFormMaster('TarifSPP', { TAID: S.ui.tr.ta, JurusanID: el.dataset.j, Tingkat: el.dataset.t });
ACT.trUbah = el => bukaFormMaster('TarifSPP', S.db.tarif.find(t => t.ID === el.dataset.id));

// ── Impor Data Excel (US-18/19) ──
const IMPOR = {
  SISWA: { label: 'Data Siswa', ikon: 'people', ket: 'Biodata, kelas, kontak wali', kolom: [['NIS', 1, '25260001', 'Angka 4–20 digit, unik'], ['NISN', 0, '0076298114', 'Opsional'], ['Nama', 1, 'Siti Nurhaliza', 'Nama lengkap'], ['JK', 1, 'P', 'L atau P'], ['Kelas', 1, 'X Farmasi 1', 'Nama kelas persis seperti di Data Akademik (TA aktif)'], ['Status', 0, 'AKTIF', 'AKTIF / NONAKTIF / LULUS / KELUAR'], ['Kategori', 0, 'REGULER', 'REGULER / DISPENSASI'], ['NamaWali', 0, 'Bp. Herman', ''], ['HPWali', 0, '081278904412', 'Format 08…'], ['EmailWali', 0, 'wali@contoh.sch.id', 'Untuk tanda terima & pengingat'], ['Alamat', 0, 'Tebing Tinggi', '']] },
  MASTER: { label: 'Kelas, Jurusan & TA', ikon: 'mortarboard', ket: 'Struktur akademik', kolom: [['Jenis', 1, 'KELAS', 'JURUSAN / TAHUN_AJARAN / KELAS'], ['Kode', 0, '', 'Wajib untuk JURUSAN (mis. FKK)'], ['Nama', 1, 'XI Farmasi 3', 'Nama jurusan / TA (2027/2028) / kelas'], ['Tingkat', 0, 'XI', 'Wajib untuk KELAS'], ['Jurusan', 0, 'FKK', 'Kode/nama jurusan untuk KELAS'], ['TahunAjaran', 0, '2026/2027', 'Untuk KELAS'], ['Mulai', 0, '', 'Untuk TAHUN_AJARAN, YYYY-MM-DD'], ['Selesai', 0, '', 'Untuk TAHUN_AJARAN, YYYY-MM-DD']] },
  TAGIHAN: { label: 'Tagihan', ikon: 'file-earmark-text', ket: 'Tagihan per siswa per periode', kolom: [['NIS', 1, '25260001', 'NIS terdaftar'], ['Periode', 1, '2026-11', 'YYYY-MM dalam tahun ajaran'], ['Nominal', 1, '450000', 'Angka tanpa titik'], ['JatuhTempo', 0, '2026-11-10', 'YYYY-MM-DD (bawaan: tanggal jatuh tempo pengaturan)']] },
  PEMBAYARAN: { label: 'Riwayat Pembayaran', ikon: 'receipt', ket: 'Transaksi lama (terverifikasi)', kolom: [['NoBukti', 0, 'KW-LAMA-001', 'Opsional; dipakai deteksi duplikat'], ['Tanggal', 1, '2026-08-05', 'YYYY-MM-DD'], ['NIS', 1, '25260001', ''], ['Periode', 1, '2026-07,2026-08', 'Satu/lebih YYYY-MM dipisah koma'], ['Jumlah', 1, '900000', 'Tidak boleh melebihi sisa tagihan'], ['Metode', 1, 'TUNAI', 'TUNAI / TRANSFER / QRIS'], ['Penyetor', 0, 'Bp. Herman', ''], ['Catatan', 0, '', '']] },
  SALDO_AWAL: { label: 'Saldo Awal Tunggakan', ikon: 'hourglass-bottom', ket: 'Tunggakan sebelum sistem', kolom: [['NIS', 1, '25260001', ''], ['Periode', 1, '2026-06', 'Bulan tunggakan lama YYYY-MM'], ['Nominal', 1, '450000', 'Sisa yang belum dibayar'], ['JatuhTempo', 0, '2026-06-10', 'YYYY-MM-DD']] }
};
S.ui.im = { jenis: 'SISWA', berkas: '', rows: null, hasil: null, ringkasan: null, filter: 'SEMUA', proses: null, log: null };
HAL.impor = {
  judul: 'Impor Data Excel',
  render() {
    const u = S.ui.im, j = IMPOR[u.jenis];
    const hasilMap = new Map((u.hasil || []).map(h => [h[0], h]));
    const rowsT = (u.rows || []).filter(r => { const h = hasilMap.get(r.__baris); return u.filter === 'SEMUA' || (h && h[1] === u.filter); });
    $('#imIsi').innerHTML = `<div class="kartu mb-4"><div class="h-sm mb-3">1. Pilih jenis data</div><div class="jenis-impor">${Object.keys(IMPOR).map(k => `<button class="${u.jenis === k ? 'aktif' : ''}" data-act="imJenis" data-v="${k}"><i class="bi bi-${IMPOR[k].ikon}"></i><b>${IMPOR[k].label}</b><small>${IMPOR[k].ket}</small></button>`).join('')}</div></div>
      <div class="grid-2s mb-4"><div class="kartu"><div class="h-sm mb-2">2. Unduh templat resmi</div><p class="text-2" style="font-size:13px">Templat berisi nama kolom, contoh pengisian, format tanggal, dan lembar <b>Petunjuk</b> (kolom wajib/opsional).</p>
        <table class="tbl mb-3"><thead><tr><th>Kolom</th><th>Wajib</th><th>Keterangan</th></tr></thead><tbody>${j.kolom.map(c => `<tr><td class="mono">${c[0]}</td><td>${c[1] ? chip('Wajib', 'err') : chip('Opsional')}</td><td class="sel-sub">${esc(c[3])}</td></tr>`).join('')}</tbody></table>
        <button class="btn btn-outline-primary" data-act="imTemplat"><i class="bi bi-download"></i> Unduh templat ${esc(j.label)} (.xlsx)</button></div>
      <div class="kartu"><div class="h-sm mb-2">3. Unggah berkas</div><div class="unggah" data-act="imPilih" id="imZona" role="button" tabindex="0" style="padding:2rem"><i class="bi bi-file-earmark-spreadsheet" style="font-size:30px"></i><div class="mt-1"><b>Klik atau seret berkas .xlsx / .csv</b></div><div class="sel-sub">Lembar "Data" atau lembar pertama dibaca • maks 10.000 baris</div></div>
        ${u.berkas ? `<div class="berkas mt-2"><i class="bi bi-file-earmark-excel text-ok" style="font-size:22px"></i><div style="flex:1"><b>${esc(u.berkas)}</b><div class="text-mut">${(u.rows || []).length} baris terbaca</div></div><button class="btn btn-ghost btn-sm" data-act="imBersih">Ganti</button></div>` : ''}
        ${peringatan('Data lama <b>tidak pernah ditimpa</b>: NIS / transaksi yang sudah ada ditandai duplikat dan dilewati. Cadangan spreadsheet dibuat otomatis sebelum menyimpan.', 'info', 'shield-check')}</div></div>
      ${u.ringkasan ? `<div class="kartu mb-4"><div class="kartu-head"><div class="h-sm">4. Pratinjau &amp; validasi</div><div class="d-flex gap-2"><button class="btn btn-soft btn-sm" data-act="imLaporanSalah" ${u.ringkasan.bermasalah + u.ringkasan.duplikat ? '' : 'disabled'}><i class="bi bi-file-earmark-x"></i> Unduh laporan kesalahan</button></div></div>
        <div class="grid-kpi">${kpi({ label: 'Total baris', ikon: 'list-ol', nilai: u.ringkasan.total })}${kpi({ label: 'Baru (akan disimpan)', ikon: 'plus-circle', tone: 'ok', nilai: `<span class="text-ok">${u.ringkasan.baru}</span>` })}${kpi({ label: 'Duplikat (dilewati)', ikon: 'files', tone: 'warn', nilai: u.ringkasan.duplikat })}${kpi({ label: 'Bermasalah', ikon: 'x-octagon', tone: 'err', aksen: u.ringkasan.bermasalah ? 'err' : '', nilai: `<span class="${u.ringkasan.bermasalah ? 'text-err' : ''}">${u.ringkasan.bermasalah}</span>` })}</div>
        <div class="seg mb-2">${[['SEMUA', 'Semua'], ['BARU', 'Baru'], ['DUPLIKAT', 'Duplikat'], ['BERMASALAH', 'Bermasalah']].map(x => `<button data-act="imFilter" data-v="${x[0]}" class="${u.filter === x[0] ? 'aktif' : ''}">${x[1]}</button>`).join('')}</div>
        <div class="tbl-wrap"><div class="tbl-scroll" style="max-height:420px"><table class="tbl"><thead><tr><th>Baris</th><th>Status</th><th>Keterangan</th>${j.kolom.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rowsT.slice(0, 300).map(r => { const h = hasilMap.get(r.__baris) || [r.__baris, '?', '']; return `<tr class="${h[1] === 'BERMASALAH' ? 'sorot' : ''}"><td class="num">${r.__baris}</td><td>${chip(h[1], h[1] === 'BARU' ? 'ok' : h[1] === 'DUPLIKAT' ? 'warn' : 'err')}</td><td class="sel-sub" style="max-width:260px">${esc(h[2])}</td>${j.kolom.map(c => `<td>${esc(r[c[0]])}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div></div>
        ${rowsT.length > 300 ? `<div class="sel-sub mt-1">Menampilkan 300 dari ${rowsT.length} baris.</div>` : ''}</div>
      <div class="kartu mb-4"><div class="h-sm mb-2">5. Konfirmasi &amp; simpan</div>
        ${u.proses ? `<div class="mb-2 d-flex justify-content-between"><span>${esc(u.proses.teks)}</span><b class="num">${Math.round(u.proses.pct)}%</b></div><div class="bar progres-impor"><span style="width:${u.proses.pct}%"></span></div>`
          : `<div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="imSetuju"><label class="form-check-label" for="imSetuju">Saya telah memeriksa pratinjau. Simpan <b>${u.ringkasan.baru} baris baru</b>; ${u.ringkasan.duplikat + u.ringkasan.bermasalah} baris lain dilewati.</label></div><button class="btn btn-primary" data-act="imSimpan" ${u.ringkasan.baru ? '' : 'disabled'}><i class="bi bi-database-add"></i> Simpan ke basis data</button>`}</div>` : ''}
      <div class="tbl-wrap"><div class="kartu-head px-3 pt-3 mb-2"><div class="h-sm">Riwayat Impor (ImportLog)</div><button class="btn btn-ghost btn-sm" data-act="imMuatLog"><i class="bi bi-arrow-clockwise"></i></button></div><div id="imLog">${u.log ? htmlImportLog(u.log) : '<div class="p-3"><div class="skeleton" style="height:80px"></div></div>'}</div></div>`;
    if (!u.log) ACT.imMuatLog();
    const z = $('#imZona');
    ['dragenter', 'dragover'].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.add('seret'); }));
    ['dragleave', 'drop'].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.remove('seret'); }));
    z.addEventListener('drop', e => { if (e.dataTransfer.files[0]) bacaExcel(e.dataTransfer.files[0]); });
  }
};
function htmlImportLog(log) {
  return `<div class="tbl-scroll"><table class="tbl tbl-kartu"><thead><tr><th>Waktu</th><th>Jenis</th><th>Berkas</th><th>Oleh</th><th class="r">Total</th><th class="r">Baru</th><th class="r">Duplikat</th><th class="r">Bermasalah</th><th>Cadangan</th></tr></thead><tbody>${log.map(r => { const x = keObj('ImportLog', r); return `<tr><td data-l="Waktu" class="num">${tglPendek(x.Waktu)} ${jam(x.Waktu)}</td><td class="utama">${chip(x.Jenis, 'info')}</td><td data-l="Berkas">${esc(x.Berkas)}</td><td data-l="Oleh">${esc(x.Nama)}</td><td data-l="Total" class="r num">${x.Total}</td><td data-l="Baru" class="r num text-ok">${x.Baru}</td><td data-l="Duplikat" class="r num">${x.Duplikat}</td><td data-l="Bermasalah" class="r num ${Number(x.Bermasalah) ? 'text-err' : ''}">${x.Bermasalah}</td><td data-l="Cadangan">${x.CadanganID ? chip('Ada', 'ok', 'cloud-check') : '-'}</td></tr>`; }).join('') || `<tr><td colspan="9">${kosong('Belum ada impor.', 'clock-history')}</td></tr>`}</tbody></table></div>`;
}
ACT.imMuatLog = async () => { try { S.ui.im.log = await api('getImportLog'); const el = $('#imLog'); if (el) el.innerHTML = htmlImportLog(S.ui.im.log); } catch (e) { const el = $('#imLog'); if (el) el.innerHTML = `<div class="p-3">${peringatan(esc(e.message), 'err')}</div>`; } };
ACT.imJenis = el => { Object.assign(S.ui.im, { jenis: el.dataset.v, berkas: '', rows: null, hasil: null, ringkasan: null, proses: null }); HAL.impor.render(); };
ACT.imBersih = () => { Object.assign(S.ui.im, { berkas: '', rows: null, hasil: null, ringkasan: null, proses: null }); HAL.impor.render(); };
ACT.imFilter = el => { S.ui.im.filter = el.dataset.v; HAL.impor.render(); };
ACT.imTemplat = () => {
  const j = IMPOR[S.ui.im.jenis];
  const contoh = S.ui.im.jenis === 'MASTER' ? [['JURUSAN', 'FKK', 'Farmasi Klinis dan Komunitas', '', '', '', '', ''], ['TAHUN_AJARAN', '', '2027/2028', '', '', '', '2027-07-01', '2028-06-30'], ['KELAS', '', 'X Farmasi 3', 'X', 'FKK', taAktif().Nama || '2026/2027', '', '']] : [j.kolom.map(c => c[2])];
  if (S.ui.im.jenis === 'SISWA' && S.db.kelas[0]) contoh[0][4] = S.db.kelas.find(k => k.TAID === taAktif().ID).Nama;
  eksporXlsx('Templat_Impor_' + S.ui.im.jenis + '.xlsx', [{ nama: 'Data', lebar: j.kolom.map(c => Math.max(14, c[0].length + 4)), rows: [j.kolom.map(c => c[0])].concat(contoh) }, { nama: 'Petunjuk', lebar: [16, 12, 60, 24], rows: [['Kolom', 'Wajib?', 'Format / keterangan', 'Contoh']].concat(j.kolom.map(c => [c[0], c[1] ? 'WAJIB' : 'Opsional', c[3], c[2]]), [[], ['Catatan', '', 'Hapus baris contoh sebelum mengisi data asli. Tanggal: YYYY-MM-DD. Angka tanpa titik ribuan. Data yang sudah ada tidak akan ditimpa.']]) }]);
};
ACT.imPilih = () => { const f = $('#berkasTersembunyi'); f.multiple = false; f.accept = '.xlsx,.xls,.csv'; f.value = ''; f.onchange = () => f.files[0] && bacaExcel(f.files[0]); f.click(); };
async function bacaExcel(file) {
  const u = S.ui.im, j = IMPOR[u.jenis];
  try {
    await muatSkrip(URL_XLSX);
    const buf = await file.arrayBuffer(), wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws = wb.Sheets['Data'] || wb.Sheets[wb.SheetNames[0]];
    const mentah = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
    if (!mentah.length) { toast('Berkas kosong.', 'warn'); return; }
    if (mentah.length > 10000) { toast('Maksimal 10.000 baris per impor.', 'err'); return; }
    const norm = s => String(s).toLowerCase().replace(/[^a-z]/g, '');
    const peta = {}; Object.keys(mentah[0]).forEach(h => { const c = j.kolom.find(k => norm(k[0]) === norm(h)); if (c) peta[h] = c[0]; });
    const hilang = j.kolom.filter(c => c[1] && !Object.values(peta).includes(c[0])).map(c => c[0]);
    if (hilang.length) { toast('Kolom wajib tidak ditemukan: ' + hilang.join(', ') + '. Gunakan templat resmi.', 'err', 'Struktur berkas tidak sesuai'); return; }
    const rows = mentah.map((r, i) => { const o = { __baris: i + 2 }; Object.keys(peta).forEach(h => { let v = r[h]; if (v instanceof Date) v = isoTgl(new Date(v.getTime() + 12 * 3600e3)); o[peta[h]] = typeof v === 'string' ? v.trim() : v; }); return o; }).filter(o => j.kolom.some(c => String(o[c[0]] || '') !== ''));
    Object.assign(u, { berkas: file.name, rows, hasil: null, ringkasan: null, filter: 'SEMUA', proses: { teks: 'Memvalidasi di server…', pct: 10 } });
    HAL.impor.render();
    const hasil = [], ring = { total: 0, valid: 0, bermasalah: 0, baru: 0, duplikat: 0 };
    for (let i = 0; i < rows.length; i += 1500) {
      const r = await api('imporData', { jenis: u.jenis, rows: rows.slice(i, i + 1500), mode: 'CEK' });
      hasil.push(...r.hasil); Object.keys(ring).forEach(k => { ring[k] += r.ringkasan[k]; });
    }
    Object.assign(u, { hasil, ringkasan: ring, proses: null, filter: ring.bermasalah ? 'BERMASALAH' : 'SEMUA' });
    HAL.impor.render();
    toast(`${ring.baru} baru, ${ring.duplikat} duplikat, ${ring.bermasalah} bermasalah.`, ring.bermasalah ? 'warn' : 'ok', 'Validasi selesai');
  } catch (e) { u.proses = null; HAL.impor.render(); toast(e.message, 'err', 'Gagal membaca berkas'); }
}
ACT.imLaporanSalah = () => {
  const u = S.ui.im, j = IMPOR[u.jenis], m = new Map(u.hasil.map(h => [h[0], h]));
  eksporXlsx('Laporan_Kesalahan_' + u.jenis + '.xlsx', [{ nama: 'Kesalahan', rows: [['Baris', 'Status', 'Keterangan'].concat(j.kolom.map(c => c[0]))].concat(u.rows.filter(r => (m.get(r.__baris) || [])[1] !== 'BARU').map(r => { const h = m.get(r.__baris) || []; return [r.__baris, h[1], h[2]].concat(j.kolom.map(c => r[c[0]])); })) }]);
};
ACT.imSimpan = async () => {
  const u = S.ui.im;
  if (!$('#imSetuju').checked) { toast('Centang konfirmasi pemeriksaan terlebih dahulu.', 'warn'); return; }
  const m = new Map(u.hasil.map(h => [h[0], h])), rows = u.rows.filter(r => (m.get(r.__baris) || [])[1] === 'BARU');
  const importId = 'IMP-' + hariIni().replace(/-/g, '') + '-' + acak(6), bagian = Math.ceil(rows.length / 500);
  let cad = '';
  try {
    if (S.set.CADANGAN_SEBELUM_IMPOR === 'Y') { u.proses = { teks: 'Membuat cadangan spreadsheet…', pct: 5 }; HAL.impor.render(); cad = (await api('buatCadangan', 'Sebelum impor ' + u.jenis + ' (' + u.berkas + ')')).id; }
    let ditulis = 0;
    for (let i = 0; i < bagian; i++) {
      u.proses = { teks: `Menyimpan bagian ${i + 1} dari ${bagian}…`, pct: 10 + 85 * i / bagian }; HAL.impor.render();
      const r = await api('imporData', { jenis: u.jenis, rows: rows.slice(i * 500, (i + 1) * 500), mode: 'SIMPAN', importId, berkas: u.berkas, bagian: i + 1, totalBagian: bagian, cadanganId: cad, akumulasi: i === bagian - 1 ? { total: u.ringkasan.total - rows.slice(i * 500).length, valid: u.ringkasan.valid - rows.slice(i * 500).length, bermasalah: u.ringkasan.bermasalah, baru: ditulis, duplikat: u.ringkasan.duplikat } : null });
      ditulis += r.ditulis;
    }
    toast(`${ditulis} baris tersimpan. Hasil tercatat di ImportLog${cad ? ' • cadangan dibuat' : ''}.`, 'ok', 'Impor selesai');
    Object.assign(u, { berkas: '', rows: null, hasil: null, ringkasan: null, proses: null, log: null });
    await muatUlang(true);
  } catch (e) { u.proses = null; HAL.impor.render(); toast(e.message + ' Bagian yang sudah tersimpan aman; ulangi impor — baris yang sama akan terdeteksi duplikat.', 'err', 'Impor terhenti'); }
};

// ── Laporan Keuangan (W-16) ──
const JENIS_LAP = { PENERIMAAN_HARIAN: ['Penerimaan harian', 1], PENERIMAAN_BULANAN: ['Penerimaan bulanan', 1], PENERIMAAN_TAHUNAN: ['Penerimaan tahunan (per TA)', 1], TRANSAKSI_METODE: ['Transaksi per metode & status', 1], TUNGGAKAN_SISWA: ['Tunggakan per siswa', 0], TUNGGAKAN_KELAS: ['Tunggakan per kelas', 0], TUNGGAKAN_JURUSAN: ['Tunggakan per jurusan', 0], TUNGGAKAN_TA: ['Tunggakan per tahun ajaran', 0], KOREKSI: ['Ringkasan koreksi & pembatalan', 0] };
S.ui.lp = { jenis: 'PENERIMAAN_HARIAN', preset: 'bulan', dari: '', sampai: '', jur: '', tingkat: '', kelas: '', metode: '', status: 'TERVERIFIKASI', pengesahan: true };
function rentangLp(u) {
  const t = hariIni(), ta = taAktif();
  const m = { bulan: [t.slice(0, 7) + '-01', t], triwulan: [tambahHari(t, -89), t], semester: [String(ta.Mulai).slice(0, 10), [Number(String(ta.Mulai).slice(0, 4)) + '-12-31', t].sort()[0]], ta: [String(ta.Mulai).slice(0, 10), String(ta.Selesai).slice(0, 10)] };
  return m[u.preset] || [u.dari || t.slice(0, 7) + '-01', u.sampai || t];
}
function hash32(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).toUpperCase().padStart(8, '0'); }
function dataLaporan(u) {
  const [dari, sampai] = rentangLp(u), f = { jur: u.jur, kelas: u.kelas, tingkat: u.tingkat };
  const ag = S.db.agg.filter(a => a[0] >= dari && a[0] <= sampai && (!u.status || a[4] === u.status) && (!u.metode || a[3] === u.metode) && (!f.jur || a[2] === f.jur) && (!f.kelas || a[1] === f.kelas) && (!f.tingkat || tingkatKelas(a[1]) === f.tingkat));
  const sum = (rows, m) => rows.filter(a => !m || a[3] === m).reduce((x, a) => x + angka(a[6]), 0);
  const siswa = siswaTerfilter({ jur: f.jur, kelas: f.kelas, tingkat: f.tingkat, st: '' });
  const L = { kolom: [], rows: [], foot: null, kanan: [], kpi: [] };
  const totTunai = sum(ag, 'TUNAI'), totTf = sum(ag, 'TRANSFER'), totQ = sum(ag, 'QRIS'), totAll = totTunai + totTf + totQ;
  const kpiTerima = [['Penerimaan bersih', rp(totAll)], ['Kasir loket (tunai)', rp(totTunai)], ['Transfer bank', rp(totTf)], ['QRIS', rp(totQ)]];
  if (u.jenis === 'PENERIMAAN_HARIAN' || u.jenis === 'PENERIMAAN_BULANAN' || u.jenis === 'PENERIMAAN_TAHUNAN') {
    L.kolom = [u.jenis === 'PENERIMAAN_HARIAN' ? 'Tanggal' : u.jenis === 'PENERIMAAN_BULANAN' ? 'Bulan' : 'Tahun ajaran', 'Transaksi', 'Tunai (Rp)', 'Transfer (Rp)', 'QRIS (Rp)', 'Total (Rp)']; L.kanan = [1, 2, 3, 4, 5];
    let kunci;
    if (u.jenis === 'PENERIMAAN_HARIAN') { kunci = [...new Set(ag.map(a => a[0]))].sort().map(k => [k, tglLabel(k), a => a[0] === k]); }
    else if (u.jenis === 'PENERIMAAN_BULANAN') { kunci = [...new Set(ag.map(a => a[0].slice(0, 7)))].sort().map(k => [k, bulanLabel(k), a => a[0].slice(0, 7) === k]); }
    else kunci = S.db.ta.slice().sort((a, b) => a.Mulai < b.Mulai ? -1 : 1).map(t => [t.ID, 'TA ' + t.Nama, a => a[0] >= String(t.Mulai).slice(0, 10) && a[0] <= String(t.Selesai).slice(0, 10)]);
    L.rows = kunci.map(k => { const r = ag.filter(k[2]); return [k[1], nAgg(r), sum(r, 'TUNAI'), sum(r, 'TRANSFER'), sum(r, 'QRIS'), sum(r)]; }).filter(r => r[1] || u.jenis === 'PENERIMAAN_TAHUNAN');
    L.foot = ['TOTAL', nAgg(ag), totTunai, totTf, totQ, totAll]; L.kpi = kpiTerima;
    if (u.jenis === 'PENERIMAAN_TAHUNAN') { L.foot = ['TOTAL', L.rows.reduce((a, r) => a + r[1], 0), ...[2, 3, 4, 5].map(i => L.rows.reduce((a, r) => a + r[i], 0))]; }
  } else if (u.jenis === 'TRANSAKSI_METODE') {
    const agS = S.db.agg.filter(a => a[0] >= dari && a[0] <= sampai && (!f.jur || a[2] === f.jur) && (!f.kelas || a[1] === f.kelas) && (!f.tingkat || tingkatKelas(a[1]) === f.tingkat));
    L.kolom = ['Metode', 'Status', 'Jumlah transaksi', 'Nilai (Rp)', 'Porsi']; L.kanan = [2, 3, 4];
    const total = agS.reduce((x, a) => x + angka(a[6]), 0);
    ['TUNAI', 'TRANSFER', 'QRIS'].forEach(m => ['TERVERIFIKASI', 'MENUNGGU', 'DIBATALKAN'].forEach(st => { const r = agS.filter(a => a[3] === m && a[4] === st); if (r.length) L.rows.push([m, st, nAgg(r), sum(r), pctL(sum(r), total)]); }));
    L.foot = ['TOTAL', '', nAgg(agS), total, '100%'];
    L.kpi = [['Terverifikasi', rp(agS.filter(a => a[4] === 'TERVERIFIKASI').reduce((x, a) => x + angka(a[6]), 0))], ['Menunggu verifikasi', rp(agS.filter(a => a[4] === 'MENUNGGU').reduce((x, a) => x + angka(a[6]), 0))], ['Dibatalkan', rp(agS.filter(a => a[4] === 'DIBATALKAN').reduce((x, a) => x + angka(a[6]), 0))], ['Total transaksi', String(nAgg(agS))]];
  } else if (u.jenis === 'TUNGGAKAN_SISWA') {
    L.kolom = ['No', 'NIS', 'Nama siswa', 'Kelas', 'Jurusan', 'Bulan', 'Sisa tunggakan (Rp)', 'Wali / kontak']; L.kanan = [5, 6];
    const r = siswa.map(s => [s, statSiswa(s.ID)]).filter(x => x[1].sisaDue > 0).sort((a, b) => b[1].sisaDue - a[1].sisaDue);
    L.rows = r.map((x, i) => [i + 1, x[0].NIS, x[0].Nama, namaKelas(x[0].KelasID), kodeJurusan(x[0].JurusanID), x[1].nTunggak, x[1].sisaDue, (x[0].NamaWali || '') + ' ' + (x[0].HPWali || '')]);
    const tot = r.reduce((a, x) => a + x[1].sisaDue, 0);
    L.foot = ['', '', 'TOTAL ' + r.length + ' SISWA', '', '', r.reduce((a, x) => a + x[1].nTunggak, 0), tot, ''];
    L.kpi = [['Siswa menunggak', String(r.length)], ['Kritis ≥ 2 bulan', String(r.filter(x => x[1].nTunggak >= 2).length)], ['Total tunggakan', rp(tot)], ['Rata-rata/siswa', rp(r.length ? tot / r.length : 0)]];
  } else if (['TUNGGAKAN_KELAS', 'TUNGGAKAN_JURUSAN'].includes(u.jenis)) {
    const perK = u.jenis === 'TUNGGAKAN_KELAS';
    L.kolom = [perK ? 'Kelas' : 'Jurusan', 'Siswa aktif', 'Menunggak', 'Tagihan jatuh tempo (Rp)', 'Diterima (Rp)', 'Sisa (Rp)', 'Realisasi']; L.kanan = [1, 2, 3, 4, 5, 6];
    const grup = perK ? S.db.kelas.filter(k => k.TAID === taAktif().ID && (!f.jur || k.JurusanID === f.jur) && (!f.tingkat || k.Tingkat === f.tingkat) && (!f.kelas || k.ID === f.kelas)).sort((a, b) => a.Nama.localeCompare(b.Nama, 'id', { numeric: true })).map(k => [k.Nama, s => s.KelasID === k.ID]) : S.db.jurusan.filter(j => !f.jur || j.ID === f.jur).map(j => [j.Nama, s => s.JurusanID === j.ID]);
    const t = [0, 0, 0, 0, 0];
    L.rows = grup.map(g => { const ss = siswa.filter(g[1]), st = ss.map(s => statSiswa(s.ID)); const r = [ss.length, st.filter(x => x.nTunggak).length, st.reduce((a, x) => a + x.tagihanDue, 0), st.reduce((a, x) => a + x.terbayarDue, 0), st.reduce((a, x) => a + x.sisaDue, 0)]; r.forEach((v, i) => { t[i] += v; }); return [g[0], ...r, pctL(r[3], r[2])]; });
    L.foot = ['TOTAL', ...t, pctL(t[3], t[2])];
    L.kpi = [['Tagihan jatuh tempo', rp(t[2])], ['Diterima', rp(t[3])], ['Sisa tunggakan', rp(t[4])], ['Realisasi', pctL(t[3], t[2])]];
  } else if (u.jenis === 'TUNGGAKAN_TA') {
    L.kolom = ['Tahun ajaran', 'Tagihan jatuh tempo (Rp)', 'Diterima (Rp)', 'Sisa (Rp)', 'Realisasi']; L.kanan = [1, 2, 3, 4];
    const today = hariIni(), ids = new Set(siswa.map(s => s.ID)), tot = [0, 0, 0];
    const grup = S.db.ta.map(t => [t.ID, 'TA ' + t.Nama]).concat([['SALDO_AWAL', 'Saldo awal (sebelum sistem)']]);
    L.rows = grup.map(g => { let a = 0, b = 0; Object.keys(S.db.tg).forEach(sid => { if (!ids.has(sid)) return; S.db.tg[sid].forEach(x => { if (x[5] === g[0] && x[4] < today) { a += x[1]; b += Math.min(x[1], x[2]); } }); }); tot[0] += a; tot[1] += b; tot[2] += a - b; return [g[1], a, b, a - b, pctL(b, a)]; }).filter(r => r[1]);
    L.foot = ['TOTAL', ...tot, pctL(tot[1], tot[0])];
    L.kpi = [['Tagihan', rp(tot[0])], ['Diterima', rp(tot[1])], ['Sisa', rp(tot[2])], ['Realisasi', pctL(tot[1], tot[0])]];
  } else if (u.jenis === 'KOREKSI') {
    L.kolom = ['No', 'Waktu', 'No. bukti', 'Jenis', 'Perubahan', 'Alasan', 'Pengaju', 'Status', 'Peninjau']; L.kanan = [];
    const r = S.db.koreksi.filter(k => String(k.Waktu).slice(0, 10) >= dari && String(k.Waktu).slice(0, 10) <= sampai).sort((a, b) => a.Waktu < b.Waktu ? -1 : 1);
    L.rows = r.map((k, i) => { let a = {}, b = {}; try { a = JSON.parse(k.Sebelum); b = JSON.parse(k.Sesudah); } catch (e) { /* abaikan */ } return [i + 1, String(k.Waktu).slice(0, 16), k.NoBukti, k.Jenis, Object.keys(b).map(x => x + ': ' + a[x] + ' → ' + b[x]).join('; '), k.Alasan, k.Pengaju, k.Status, k.Peninjau]; });
    L.kpi = [['Total pengajuan', String(r.length)], ['Koreksi', String(r.filter(k => k.Jenis === 'KOREKSI').length)], ['Pembatalan', String(r.filter(k => k.Jenis === 'PEMBATALAN').length)], ['Menunggu tinjauan', String(r.filter(k => k.Status === 'DIAJUKAN').length)]];
  }
  L.dari = dari; L.sampai = sampai;
  return L;
}
HAL.laporan = {
  judul: 'Laporan Keuangan',
  render() {
    const u = S.ui.lp, opr = isOpr(), ben = S.me.peran === PERAN.BEN;
    const jenisBoleh = Object.keys(JENIS_LAP).filter(k => !ben || JENIS_LAP[k][1]);
    if (!jenisBoleh.includes(u.jenis)) u.jenis = jenisBoleh[0];
    $('#lpAksi').innerHTML = `<button class="btn btn-outline-primary" data-act="lpExcel"><i class="bi bi-file-earmark-spreadsheet"></i> Ekspor Excel (.xlsx)</button>` + (!ben ? `<button class="btn btn-outline-primary" data-act="lpCetak"><i class="bi bi-printer"></i> Cetak / Simpan PDF (A4)</button><button class="btn btn-primary" data-act="lpArsip"><i class="bi bi-cloud-arrow-up"></i> Arsipkan PDF ke Drive</button>` : '');
    const kelasOps = S.db.kelas.filter(k => k.TAID === taAktif().ID && (!u.jur || k.JurusanID === u.jur)).map(k => [k.ID, k.Nama]);
    $('#lpFilter').innerHTML = `<div class="kartu-head"><div class="h-sm"><i class="bi bi-sliders"></i> Parameter &amp; Filter</div>${chip('W-16', 'info')}</div>
      <label class="form-label" for="lpJenis">Jenis laporan</label><select class="form-select mb-3" id="lpJenis" data-chg="lpF" data-k="jenis">${opsi(jenisBoleh.map(k => [k, JENIS_LAP[k][0]]), u.jenis)}</select>
      <span class="form-label d-block">Preset periode</span><div class="seg mb-2" style="display:grid;grid-template-columns:1fr 1fr">${[['bulan', 'Bulan ini'], ['triwulan', '90 hari'], ['semester', 'Semester ganjil'], ['ta', 'Tahun buku TA']].map(p => `<button data-act="lpPreset" data-v="${p[0]}" class="${u.preset === p[0] ? 'aktif' : ''}">${p[1]}</button>`).join('')}</div>
      <div class="grid-2s mb-3" style="gap:.5rem"><input type="date" class="form-control" data-chg="lpTgl" data-k="dari" value="${rentangLp(u)[0]}" aria-label="Dari"><input type="date" class="form-control" data-chg="lpTgl" data-k="sampai" value="${rentangLp(u)[1]}" aria-label="Sampai"></div>
      <label class="form-label" for="lpJur">Program keahlian</label><select class="form-select mb-3" id="lpJur" data-chg="lpF" data-k="jur">${opsi(S.db.jurusan.map(j => [j.ID, j.Nama]), u.jur, 'Semua jurusan')}</select>
      <div class="grid-2s mb-3" style="gap:.5rem"><div><label class="form-label" for="lpTk">Tingkat</label><select class="form-select" id="lpTk" data-chg="lpF" data-k="tingkat">${opsi(['X', 'XI', 'XII'], u.tingkat, 'Semua')}</select></div><div><label class="form-label" for="lpKls">Kelas</label><select class="form-select" id="lpKls" data-chg="lpF" data-k="kelas">${opsi(kelasOps, u.kelas, 'Semua')}</select></div></div>
      <label class="form-label" for="lpMet">Kanal masuk kas</label><select class="form-select mb-3" id="lpMet" data-chg="lpF" data-k="metode">${opsi([['TUNAI', 'Tunai loket'], ['TRANSFER', 'Transfer bank'], ['QRIS', 'QRIS']], u.metode, 'Semua metode')}</select>
      <label class="form-label" for="lpSt">Validitas transaksi</label><select class="form-select mb-3" id="lpSt" data-chg="lpF" data-k="status">${opsi([['TERVERIFIKASI', 'Hanya sah & terverifikasi'], ['MENUNGGU', 'Menunggu verifikasi'], ['DIBATALKAN', 'Dibatalkan']], u.status, 'Semua status')}</select>
      <div class="form-check"><input class="form-check-input" type="checkbox" id="lpSah" data-chg="lpCek" ${u.pengesahan ? 'checked' : ''}><label class="form-check-label" for="lpSah">Tampilkan lembar pengesahan pejabat</label></div>
      <div class="mt-3">${peringatan('Setiap berkas PDF yang diarsipkan tersimpan di folder Drive "Ekspor &amp; Laporan" dan tercatat di log audit.', 'info', 'shield-check')}</div>`;
    $('#lpDok').innerHTML = htmlLaporan(u);
  }
};
function htmlLaporan(u) {
  const L = dataLaporan(u), s = S.set, waktu = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
  const filt = [u.jur ? namaJurusan(u.jur) : 'Semua jurusan', u.tingkat ? 'Tingkat ' + u.tingkat : 'Semua tingkat', u.kelas ? namaKelas(u.kelas) : '', u.metode ? 'Metode ' + u.metode : '', u.status ? 'Status ' + u.status : ''].filter(Boolean).join(' • ');
  const fmt = (v, i) => typeof v === 'number' && L.kanan.includes(i) && !(L.kolom[i] || '').match(/Transaksi|Bulan|Siswa|Menunggak|^No/) ? ribu(v) : esc(v);
  const id = 'REP-' + hash32(JSON.stringify(u) + L.rows.length + (L.foot || []).join());
  S.ui.lpData = L; S.ui.lpId = id;
  return `${kopDokumen()}</div><h2>LAPORAN ${esc(JENIS_LAP[u.jenis][0].toUpperCase())}</h2><div class="meta">Periode: <b>${tglLabel(L.dari)} – ${tglLabel(L.sampai)}</b> • Tahun ajaran ${esc(taAktif().Nama || '')}</div><div class="meta">Filter: ${esc(filt)} • Dibuat ${esc(waktu)} oleh ${esc(S.me.nama)}</div>
    <div class="kpi-dok">${L.kpi.map(k => `<div><div class="l">${esc(k[0])}</div><div class="v">${esc(k[1])}</div></div>`).join('')}</div>
    <table><thead><tr>${L.kolom.map((c, i) => `<th class="${L.kanan.includes(i) ? 'r' : ''}">${esc(c)}</th>`).join('')}</tr></thead><tbody>${L.rows.map(r => `<tr>${r.map((v, i) => `<td class="${L.kanan.includes(i) ? 'r' : ''}">${fmt(v, i)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${L.kolom.length}" style="text-align:center;color:#74777F;padding:20px">Tidak ada data pada periode/filter ini.</td></tr>`}</tbody>${L.foot ? `<tfoot><tr>${L.foot.map((v, i) => `<td class="${L.kanan.includes(i) ? 'r' : ''}">${fmt(v, i)}</td>`).join('')}</tr></tfoot>` : ''}</table>
    ${u.pengesahan ? `<div class="ttd"><div>Mengetahui,<br>Ketua Yayasan<div class="nm">${esc(s.KETUA_YAYASAN)}</div></div><div>Diperiksa &amp; disetujui,<br>Operator Sekolah<div class="nm">${esc(s.OPERATOR)}</div></div><div>${esc(s.KOTA)}, ${tglLabel(hariIni())}<br>Bendahara Penerimaan<div class="nm">${esc(s.BENDAHARA)}</div>${s.NIP_BENDAHARA ? '<div>NIP. ' + esc(s.NIP_BENDAHARA) + '</div>' : ''}</div></div>` : ''}
    <div class="audit-id"><span>ID LAPORAN: ${id}</span><span>Dokumen terkomputerisasi SIMSPP • ${esc(s.NAMA_SEKOLAH)}</span></div>`;
}
CHG.lpF = el => { S.ui.lp[el.dataset.k] = el.value; if (el.dataset.k === 'jur') S.ui.lp.kelas = ''; HAL.laporan.render(); };
CHG.lpTgl = el => { S.ui.lp.preset = 'kustom'; const [d, s] = rentangLp(S.ui.lp); S.ui.lp.dari = d; S.ui.lp.sampai = s; S.ui.lp[el.dataset.k] = el.value; HAL.laporan.render(); };
CHG.lpCek = el => { S.ui.lp.pengesahan = el.checked; HAL.laporan.render(); };
ACT.lpPreset = el => { S.ui.lp.preset = el.dataset.v; HAL.laporan.render(); };
ACT.lpExcel = () => { const L = S.ui.lpData, u = S.ui.lp; eksporXlsx('Laporan_' + u.jenis + '_' + L.dari + '_' + L.sampai + '.xlsx', [{ nama: 'Laporan', rows: [L.kolom].concat(L.rows, L.foot ? [L.foot] : []) }, { nama: 'Info', rows: [['Laporan', JENIS_LAP[u.jenis][0]], ['Periode', L.dari + ' s/d ' + L.sampai], ['Filter', JSON.stringify(u)], ['Dibuat', new Date().toLocaleString('id-ID')], ['Oleh', S.me.nama], ['ID laporan', S.ui.lpId]].concat(L.kpi) }]); };
ACT.lpCetak = () => cetakHtml(`<div class="lembar dok">${$('#lpDok').innerHTML}</div>`, 'A4 portrait');
ACT.lpArsip = async btn => {
  sibuk(btn, true, 'Membuat PDF…');
  try { const r = await api('arsipLaporan', JENIS_LAP[S.ui.lp.jenis][0], $('#lpDok').innerHTML); unduhB64(r.nama, 'application/pdf', r.b64); toast('PDF diarsipkan ke Drive & diunduh.', 'ok'); }
  catch (e) { toast(e.message, 'err'); } finally { sibuk(btn, false); }
};

// ── Pengguna & Hak Akses ──
HAL.pengguna = {
  judul: 'Pengguna & Hak Akses',
  render() {
    $('#pgTabel').innerHTML = `<div class="tbl-scroll"><table class="tbl tbl-kartu"><thead><tr><th>Pengguna</th><th>Peran</th><th>NIP</th><th>Laci / loket</th><th>Kontak</th><th>Login terakhir</th><th>Status</th><th></th></tr></thead><tbody>${S.db.users.map(x => `<tr><td class="utama"><div class="d-flex align-items-center gap-2">${avatar(x.Nama)}<div><div class="sel-utama">${esc(x.Nama)}</div><div class="sel-sub mono">@${esc(x.Username)}</div></div></div></td><td data-l="Peran">${chip(LABEL_PERAN[x.Peran] || x.Peran, x.Peran === PERAN.OPR ? 'solid' : x.Peran === PERAN.BEN ? 'info' : '')}</td><td data-l="NIP">${esc(x.NIP || '-')}</td><td data-l="Laci">${esc(x.Drawer || '-')}</td><td data-l="Kontak"><div class="sel-sub">${esc(x.Email || '')}</div><div class="sel-sub">${esc(x.HP || '')}</div></td><td data-l="Login" class="num">${x.LoginTerakhir ? tglPendek(x.LoginTerakhir) + ' ' + jam(x.LoginTerakhir) : '<span class="text-mut">Belum pernah</span>'}</td><td data-l="Status">${aktif(x.Aktif) ? chip('Aktif', 'ok') : chip('Nonaktif', 'err')}${aktif(x.WajibGanti) ? ' ' + chip('Sandi sementara', 'warn') : ''}</td>
      <td data-l="" class="r" style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-act="formPengguna" data-id="${x.ID}"><i class="bi bi-pencil"></i></button><button class="btn btn-ghost btn-sm" data-act="pgReset" data-id="${x.ID}" title="Reset sandi"><i class="bi bi-key"></i></button><button class="btn btn-ghost btn-sm" data-act="pgCabut" data-id="${x.ID}" title="Cabut semua sesi"><i class="bi bi-phone-flip"></i></button></td></tr>`).join('')}</tbody></table></div>`;
    const M = [['Dashboard', 'Lihat', 'Penuh', 'Lihat'], ['Data siswa, kelas, jurusan, TA', 'Lihat', 'Penuh', 'Lihat'], ['Tarif & tagihan SPP', 'Lihat', 'Penuh', 'Lihat'], ['Catat pembayaran', '—', 'Penuh', 'Penuh'], ['Verifikasi transfer', '—', 'Penuh', 'Penuh'], ['Koreksi / pembatalan', '—', 'Penuh', 'Ajukan (milik sendiri)'], ['Pemulihan transaksi dibatalkan', '—', 'Penuh', '—'], ['Unggah bukti & cetak PDF', '—', 'Penuh', 'Penuh'], ['Laporan (lihat, PDF, Excel)', 'Lihat, unduh, cetak', 'Penuh', 'Lihat (operasional) + Excel'], ['Impor Excel', '—', 'Penuh', '—'], ['Kelola akun & hak akses', '—', 'Penuh', '—'], ['Log audit', 'Ringkasan koreksi', 'Penuh', '—'], ['Pengaturan sistem & notifikasi', '—', 'Penuh', '—']];
    const sel = v => v === 'Penuh' ? chip('Penuh', 'ok') : v === '—' ? '<span class="text-mut">—</span>' : chip(v, 'info');
    $('#pgRbac').innerHTML = `<div class="kartu-head"><div class="h-sm"><i class="bi bi-diagram-3"></i> Matriks Hak Akses (PRD 3.2)</div>${chip('Diperiksa di server untuk setiap permintaan', 'info', 'shield-lock')}</div><div class="tbl-wrap"><div class="tbl-scroll"><table class="tbl rbac"><thead><tr><th>Fitur</th><th>Ketua Yayasan</th><th>Operator Sekolah</th><th>Bendahara</th></tr></thead><tbody>${M.map(r => `<tr><td>${r[0]}</td>${r.slice(1).map(v => `<td>${sel(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  }
};
ACT.formPengguna = el => {
  const x = el.dataset && el.dataset.id ? S.idx.users.get(el.dataset.id) : {};
  bukaModal({
    judul: x.ID ? 'Ubah Pengguna' : 'Tambah Pengguna', ukuran: 'lg',
    isi: `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem">
      <div><label class="form-label" for="pgU">Nama pengguna *</label><input class="form-control" id="pgU" value="${esc(x.Username || '')}" autocapitalize="none" placeholder="huruf kecil, mis. izra"></div>
      <div><label class="form-label" for="pgN">Nama lengkap *</label><input class="form-control" id="pgN" value="${esc(x.Nama || '')}"></div>
      <div><label class="form-label" for="pgP">Peran *</label><select class="form-select" id="pgP">${opsi(Object.keys(LABEL_PERAN).map(k => [k, LABEL_PERAN[k]]), x.Peran || PERAN.BEN)}</select></div>
      <div><label class="form-label" for="pgNip">NIP</label><input class="form-control" id="pgNip" value="${esc(x.NIP || '')}"></div>
      <div><label class="form-label" for="pgE">Email</label><input class="form-control" id="pgE" type="email" value="${esc(x.Email || '')}"></div>
      <div><label class="form-label" for="pgH">HP</label><input class="form-control" id="pgH" value="${esc(x.HP || '')}"></div>
      <div><label class="form-label" for="pgD">Laci kasir / loket</label><input class="form-control" id="pgD" value="${esc(x.Drawer || '')}" placeholder="DRAWER-01"></div>
      <div><span class="form-label d-block">Status akun</span><div class="form-check form-switch mt-2"><input class="form-check-input" type="checkbox" id="pgA" ${x.ID && !aktif(x.Aktif) ? '' : 'checked'}><label class="form-check-label" for="pgA">Aktif (dapat login)</label></div></div></div>
      ${x.ID ? '' : `<div class="mt-3">${peringatan('Sandi sementara dibuat otomatis dan <b>hanya ditampilkan sekali</b>. Pengguna wajib menggantinya saat login pertama.', 'info', 'key')}</div>`}<div class="invalid-msg mt-2" id="pgPesan"></div>`,
    kaki: `<button class="btn btn-soft" data-bs-dismiss="modal">Batal</button><button class="btn btn-primary" data-act="pgSimpan" data-id="${esc(x.ID || '')}"><i class="bi bi-check2"></i> Simpan</button>`
  });
};
ACT.pgSimpan = async btn => {
  const rec = { ID: btn.dataset.id || undefined, Username: $('#pgU').value.trim().toLowerCase(), Nama: $('#pgN').value.trim(), Peran: $('#pgP').value, NIP: $('#pgNip').value.trim(), Email: $('#pgE').value.trim(), HP: $('#pgH').value.trim(), Drawer: $('#pgD').value.trim(), Aktif: $('#pgA').checked ? 'Y' : 'N' };
  sibuk(btn, true, 'Menyimpan…');
  try {
    const r = await api('simpanPengguna', rec);
    const row = keObj('Pengguna', r.row), i = S.db.users.findIndex(x => x.ID === row.ID);
    if (i >= 0) S.db.users[i] = row; else S.db.users.push(row);
    bangunIndeks(); HAL.pengguna.render();
    if (r.sandiSementara) tampilSandiSementara(row, r.sandiSementara); else { tutupModal(); toast('Pengguna diperbarui.', 'ok'); }
  } catch (e) { $('#pgPesan').textContent = e.message; } finally { sibuk(btn, false); }
};
function tampilSandiSementara(u, sandi) {
  bukaModal({ judul: 'Sandi Sementara', ukuran: 'md', isi: `<p>Berikan kredensial ini kepada <b>${esc(u.Nama)}</b> secara langsung. Sandi <b>tidak dapat ditampilkan lagi</b>.</p><div class="kartu-2"><div class="ringkas-baris"><span>Nama pengguna</span><b class="mono">${esc(u.Username)}</b></div><div class="ringkas-baris"><span>Sandi sementara</span><b class="mono" style="font-size:18px" id="sandiTmp">${esc(sandi)}</b></div></div>`, kaki: `<button class="btn btn-soft" data-act="salinSandi"><i class="bi bi-clipboard"></i> Salin</button><button class="btn btn-primary" data-bs-dismiss="modal">Selesai</button>` });
}
ACT.salinSandi = () => { try { navigator.clipboard.writeText($('#sandiTmp').textContent); toast('Disalin.', 'ok'); } catch (e) { toast('Salin manual: pilih teks sandi.', 'warn'); } };
ACT.pgReset = async el => {
  const u = S.idx.users.get(el.dataset.id);
  if (!(await konfirmasi('Reset sandi ' + u.Nama + '?', 'Sandi sementara baru dibuat dan semua sesi pengguna ini dicabut.', { ok: 'Reset sandi', bahaya: true }))) return;
  try { const r = await api('resetSandiPengguna', u.ID); u.WajibGanti = 'Y'; HAL.pengguna.render(); tampilSandiSementara(u, r.sandiSementara); } catch (e) { toast(e.message, 'err'); }
};
ACT.pgCabut = async el => {
  const u = S.idx.users.get(el.dataset.id);
  if (!(await konfirmasi('Cabut semua sesi ' + u.Nama + '?', 'Pengguna akan keluar dari semua perangkat dan harus login ulang.', { ok: 'Cabut sesi' }))) return;
  try { await api('cabutSesiPengguna', u.ID); toast('Semua sesi ' + u.Nama + ' dicabut.', 'ok'); } catch (e) { toast(e.message, 'err'); }
};

// ── Pengaturan & Log ──
S.ui.ps = { tab: '', log: { page: 1, q: '', tindakan: '' }, info: null };
const GRUP_SET = {
  identitas: ['Identitas Sekolah', [['NAMA_SEKOLAH', 'Nama sekolah', 2], ['NAMA_YAYASAN', 'Nama yayasan', 2], ['ALAMAT', 'Alamat', 2], ['KOTA', 'Kota'], ['TELEPON', 'Telepon'], ['EMAIL_SEKOLAH', 'Email resmi (balasan)'], ['NPSN', 'NPSN'], ['AKREDITASI', 'Akreditasi'], ['LOGO_URL', 'URL logo (https)'], ['KETUA_YAYASAN', 'Ketua Yayasan'], ['OPERATOR', 'Operator Sekolah'], ['BENDAHARA', 'Bendahara'], ['NIP_BENDAHARA', 'NIP Bendahara']]],
  keuangan: ['Keuangan & Berkas', [['JATUH_TEMPO_HARI', 'Tanggal jatuh tempo (1–28)', 1, 'number'], ['BIAYA_ADMIN', 'Biaya admin loket (Rp)', 1, 'number'], ['PREFIX_BUKTI', 'Awalan nomor bukti'], ['TARGET_SETORAN', 'Target setoran harian (Rp)', 1, 'number'], ['BANK', 'Bank rekening sekolah'], ['REKENING', 'Nomor rekening'], ['ATAS_NAMA', 'Atas nama rekening', 2], ['BANK_PILIHAN', 'Daftar bank transfer (koma)', 2], ['MAKS_BERKAS_MB', 'Maks ukuran berkas (MB)', 1, 'number'], ['MAKS_LAMPIRAN', 'Maks lampiran / transaksi (1–3)', 1, 'number'], ['WAJIB_BUKTI_TRANSFER', 'Wajib bukti transfer', 1, 'yn'], ['CADANGAN_SEBELUM_IMPOR', 'Cadangan sebelum impor', 1, 'yn'], ['CADANGAN_MINGGUAN', 'Cadangan otomatis tiap Senin', 1, 'yn']]],
  integrasi: ['Integrasi WhatsApp', [['WA_PROVIDER', 'Penyedia WhatsApp', 1, 'wa'], ['WA_META_TPL_PENGINGAT', 'Templat Meta: pengingat'], ['WA_META_TPL_TERIMA', 'Templat Meta: tanda terima']]]
};
HAL.pengaturan = {
  judul: 'Pengaturan & Log',
  render() {
    const u = S.ui.ps, opr = isOpr();
    const tabs = opr ? [['identitas', 'Identitas Sekolah'], ['keuangan', 'Keuangan & Berkas'], ['integrasi', 'Integrasi'], ['sistem', 'Sistem & Cadangan'], ['log', 'Log Audit']] : [['log', 'Ringkasan Koreksi (Log Audit)']];
    if (!tabs.some(t => t[0] === u.tab)) u.tab = tabs[0][0];
    $('#psTab').innerHTML = tabs.map(t => `<button data-act="psTab" data-v="${t[0]}" class="${u.tab === t[0] ? 'aktif' : ''}">${t[1]}</button>`).join('');
    if (GRUP_SET[u.tab]) {
      const g = GRUP_SET[u.tab], s = S.set;
      $('#psIsi').innerHTML = `<div class="kartu"><div class="kartu-head"><div class="h-sm">${g[0]}</div><button class="btn btn-primary" data-act="psSimpan"><i class="bi bi-floppy"></i> Simpan</button></div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem">${g[1].map(f => `<div style="grid-column:span ${f[2] || 1}"><label class="form-label" for="ps_${f[0]}">${esc(f[1])}</label>${f[3] === 'yn' ? `<select class="form-select" id="ps_${f[0]}">${opsi([['Y', 'Ya'], ['N', 'Tidak']], s[f[0]])}</select>` : f[3] === 'wa' ? `<select class="form-select" id="ps_${f[0]}">${opsi([['NONAKTIF', 'Nonaktif (pengembangan lanjutan)'], ['FONNTE', 'Fonnte (gateway lokal)'], ['META', 'Meta WhatsApp Cloud API (resmi)']], s[f[0]])}</select>` : `<input class="form-control" id="ps_${f[0]}" type="${f[3] || 'text'}" value="${esc(s[f[0]])}">`}</div>`).join('')}</div>
        ${u.tab === 'integrasi' ? `<div class="mt-4"><div class="h-sm mb-2"><i class="bi bi-key"></i> Rahasia layanan (Script Properties)</div>${peringatan('Token disimpan di <b>Script Properties</b> — tidak pernah di Sheets atau browser — dan hanya ditampilkan tersamar. Kosongkan untuk tidak mengubah.', 'info', 'shield-lock')}<div id="psRahasia" class="mt-3"><div class="skeleton" style="height:90px"></div></div></div>` : ''}</div>`;
      if (u.tab === 'integrasi') muatInfoSistem().then(renderRahasia);
    } else if (u.tab === 'sistem') {
      $('#psIsi').innerHTML = `<div class="grid-2"><div class="kartu" id="psInfo"><div class="skeleton" style="height:220px"></div></div><div class="tumpuk"><div class="kartu"><div class="h-sm mb-2"><i class="bi bi-cloud-arrow-up"></i> Cadangan &amp; pemulihan</div><p class="text-2" style="font-size:13px">Salinan lengkap spreadsheet basis data disimpan di folder Drive <b>Cadangan</b>. Untuk memulihkan: buka salinan → salin sheet yang dibutuhkan ke spreadsheet produksi (lihat panduan).</p><button class="btn btn-primary" data-act="psCadangan"><i class="bi bi-cloud-arrow-up"></i> Buat cadangan sekarang</button></div>
        <div class="kartu"><div class="h-sm mb-2"><i class="bi bi-lightning"></i> Performa</div><p class="text-2" style="font-size:13px">Data master &amp; ringkasan di-cache di server (CacheService) dan dihapus otomatis saat data berubah. Bersihkan bila Anda mengubah sheet secara manual.</p><div class="d-flex gap-2 flex-wrap"><button class="btn btn-soft" data-act="psCache"><i class="bi bi-trash3"></i> Bersihkan cache server</button><button class="btn btn-soft" data-act="segarkan"><i class="bi bi-arrow-clockwise"></i> Muat ulang data</button><button class="btn btn-soft" data-act="psLokal"><i class="bi bi-eraser"></i> Hapus cache perangkat ini</button></div></div></div></div>`;
      muatInfoSistem(true).then(renderInfoSistem);
    } else {
      $('#psIsi').innerHTML = `<div class="tbl-wrap"><div class="kartu-head px-3 pt-3 mb-2"><div><div class="h-sm">Log Audit</div><div class="text-mut" style="font-size:12px">Tambah-saja: tidak dapat diubah atau dihapus dari antarmuka (US-28)</div></div><div class="d-flex gap-2"><input class="form-control form-control-sm" style="width:220px" placeholder="Cari pengguna, tindakan, ID…" value="${esc(u.log.q)}" data-inp="psQ" aria-label="Cari log"><select class="form-select form-select-sm" style="width:auto" data-chg="psLogF" aria-label="Tindakan">${opsi(['LOGIN', 'CATAT_PEMBAYARAN', 'VERIFIKASI', 'KOREKSI', 'PEMBATALAN', 'PEMULIHAN', 'IMPOR', 'HAK_AKSES', 'PENGATURAN', 'TUTUP_KASIR', 'SIARAN', 'CADANGAN'], u.log.tindakan, 'Semua tindakan')}</select></div></div><div id="psLog"><div class="p-3"><div class="skeleton" style="height:200px"></div></div></div></div>`;
      muatLogAudit();
    }
  }
};
ACT.psTab = el => { S.ui.ps.tab = el.dataset.v; HAL.pengaturan.render(); };
ACT.psSimpan = async btn => {
  const g = GRUP_SET[S.ui.ps.tab], o = {};
  g[1].forEach(f => { const el = $('#ps_' + f[0]); if (el) o[f[0]] = el.value.trim(); });
  sibuk(btn, true, 'Menyimpan…');
  try { S.set = await api('simpanPengaturan', o); terapkanBranding(BOOT); toast('Pengaturan disimpan.', 'ok'); rerenderHalaman(); }
  catch (e) { toast(e.message, 'err'); } finally { sibuk(btn, false); }
};
async function muatInfoSistem(paksa) { if (S.ui.ps.info && !paksa) return; try { S.ui.ps.info = await api('infoSistem'); } catch (e) { toast(e.message, 'err'); } }
function renderRahasia() {
  const el = $('#psRahasia'), inf = S.ui.ps.info; if (!el || !inf) return;
  const lbl = { WA_TOKEN_FONNTE: 'Token Fonnte', WA_TOKEN_META: 'Token akses Meta (permanen)', WA_META_PHONE_ID: 'Phone Number ID Meta' };
  el.innerHTML = Object.keys(inf.rahasia).map(k => `<div class="d-flex gap-2 align-items-end mb-2 flex-wrap"><div style="flex:1;min-width:220px"><label class="form-label" for="rh_${k}">${lbl[k] || k}</label><input class="form-control" type="password" autocomplete="off" id="rh_${k}" placeholder="${inf.rahasia[k].ada ? esc(inf.rahasia[k].samar) + ' (tersimpan)' : 'belum diisi'}"></div><button class="btn btn-soft" data-act="rhSimpan" data-k="${k}">Simpan</button>${inf.rahasia[k].ada ? `<button class="btn btn-outline-danger" data-act="rhHapus" data-k="${k}">Hapus</button>` : ''}</div>`).join('');
}
ACT.rhSimpan = async btn => {
  const k = btn.dataset.k, el = $('#rh_' + k), v = el.value.trim(); if (!v) { toast('Isi nilai terlebih dahulu.', 'warn'); return; }
  sibuk(btn, true, '…');
  try { const r = await api('simpanRahasia', k, v); el.value = ''; S.ui.ps.info.rahasia[k] = { ada: r.ada, samar: r.samar }; renderRahasia(); toast('Tersimpan di Script Properties (' + r.samar + ').', 'ok'); } catch (e) { toast(e.message, 'err'); } finally { sibuk(btn, false); }
};
ACT.rhHapus = async btn => { if (!(await konfirmasi('Hapus rahasia?', 'Nilai ' + btn.dataset.k + ' dihapus dari Script Properties.', { ok: 'Hapus', bahaya: true }))) return; try { const r = await api('simpanRahasia', btn.dataset.k, '__HAPUS__'); S.ui.ps.info.rahasia[btn.dataset.k] = { ada: r.ada, samar: '' }; renderRahasia(); toast('Dihapus.', 'ok'); } catch (e) { toast(e.message, 'err'); } };
function renderInfoSistem() {
  const el = $('#psInfo'), i = S.ui.ps.info; if (!el || !i) return;
  el.innerHTML = `<div class="kartu-head"><div class="h-sm"><i class="bi bi-cpu"></i> Informasi Sistem</div>${chip('v' + i.versi, 'info')}</div><div class="info-grid mb-3"><div class="info-sel"><span class="lbl-sm">Kuota email tersisa</span>${i.kuotaEmail}</div><div class="info-sel"><span class="lbl-sm">Cadangan terakhir</span>${esc(i.cadanganTerakhir || 'Belum ada')}</div><div class="info-sel"><span class="lbl-sm">Pemicu terpasang</span>${i.pemicu.length ? i.pemicu.map(p => chip(p, 'ok')).join(' ') : chip('Belum ada', 'err')}</div><div class="info-sel"><span class="lbl-sm">Waktu server</span>${esc(i.server)} (${esc(i.zona)})</div></div>
    <table class="tbl"><thead><tr><th>Sheet</th><th class="r">Baris data</th></tr></thead><tbody>${Object.keys(i.jumlah).map(k => `<tr><td class="mono">${esc(k)}</td><td class="r num">${ribu(i.jumlah[k])}</td></tr>`).join('')}</tbody></table>
    <div class="mt-3"><a href="${esc(i.ssUrl)}" target="_blank" rel="noopener" class="btn btn-soft btn-sm"><i class="bi bi-table"></i> Buka spreadsheet basis data</a></div>`;
}
ACT.psCadangan = async btn => { sibuk(btn, true, 'Menyalin spreadsheet…'); try { const r = await api('buatCadangan', 'Cadangan manual'); toast('Cadangan dibuat: ' + r.nama, 'ok'); muatInfoSistem(true).then(renderInfoSistem); } catch (e) { toast(e.message, 'err'); } finally { sibuk(btn, false); } };
ACT.psCache = async btn => { sibuk(btn, true, '…'); try { await api('bersihkanCache'); await muatUlang(false); } catch (e) { toast(e.message, 'err'); } finally { sibuk(btn, false); } };
ACT.psLokal = () => { if (S.me) LS.del('boot.' + S.me.id); LS.del('ui.db'); toast('Cache perangkat dihapus. Data akan dimuat ulang dari server.', 'ok'); muatUlang(true); };
async function muatLogAudit() {
  const u = S.ui.ps, el = $('#psLog');
  try {
    const d = await api('getLogAudit', u.log);
    if (!$('#psLog')) return;
    $('#psLog').innerHTML = `<div class="tbl-scroll"><table class="tbl tbl-kartu"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Tindakan</th><th>Entitas</th><th>Ringkasan perubahan</th></tr></thead><tbody>${d.rows.map(r => `<tr><td data-l="Waktu" class="num mono" style="white-space:nowrap">${esc(String(r[0]).slice(0, 16))}</td><td data-l="Pengguna"><div class="sel-utama">${esc(r[2])}</div><div class="sel-sub">${esc(LABEL_PERAN[r[3]] || r[3])}</div></td><td class="utama">${chip(String(r[4]).replace(/_/g, ' '), /GAGAL|TOLAK|BATAL|HAPUS/.test(r[4]) ? 'err' : /KOREKSI|AJUKAN|RAHASIA|HAK/.test(r[4]) ? 'warn' : /LOGIN/.test(r[4]) ? '' : 'info')}</td><td data-l="Entitas"><div>${esc(r[5])}</div><div class="sel-sub mono">${esc(String(r[6]).slice(0, 22))}</div></td><td data-l="Ringkasan" class="sel-sub" style="max-width:460px;color:var(--text-2)">${esc(r[7])}</td></tr>`).join('') || `<tr><td colspan="5">${kosong('Tidak ada entri.', 'journal')}</td></tr>`}</tbody></table></div><div class="tbl-foot"><span>${d.n} entri (3.000 terakhir)</span>${pager('psHal', d.page, d.n, d.size)}</div>`;
  } catch (e) { if (el) el.innerHTML = `<div class="p-3">${peringatan(esc(e.message), 'err')}</div>`; }
}
INP.psQ = debounce(el => { S.ui.ps.log.q = el.value; S.ui.ps.log.page = 1; muatLogAudit(); }, 400);
CHG.psLogF = el => { S.ui.ps.log.tindakan = el.value; S.ui.ps.log.page = 1; muatLogAudit(); };
ACT.psHal = el => { S.ui.ps.log.page = Number(el.dataset.page); muatLogAudit(); };

// ════════════════════════════════════════════════════════════
// MULAI
// ════════════════════════════════════════════════════════════
mulai();
