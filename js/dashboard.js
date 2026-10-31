
// ════════════════════════════════════════════════════════════
// BAGIAN 3 — DASHBOARD, DATA SISWA, TAGIHAN & TUNGGAKAN
// ════════════════════════════════════════════════════════════

// ── Grafik (Chart.js) mengikuti token tema ──
function grafik(id, cfg) {
  if (S.charts[id]) { S.charts[id].destroy(); delete S.charts[id]; }
  const el = document.getElementById(id);
  if (!el || !window.Chart) return;
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = warna('text-2');
  Chart.defaults.borderColor = warna('border-subtle');
  S.charts[id] = new Chart(el, cfg);
}
const tooltipRp = { callbacks: { label: c => ' ' + c.dataset.label + ': ' + rp(c.parsed.y !== undefined ? c.parsed.y : c.parsed) } };
const sumbuRp = { ticks: { callback: v => rpS(v).replace('Rp ', '') }, grid: { color: () => warna('border-subtle') }, border: { display: false } };

// ── Dashboard (W-04) ──
S.ui.db = LS.get('ui.db', { preset: '7', dari: '', sampai: '', jur: '', tingkat: '', kelas: '', st: '', tren: 'harian' });
function rentangDb(u) {
  const t = hariIni();
  const m = { hari: [t, t], '7': [tambahHari(t, -6), t], '30': [tambahHari(t, -29), t], bulan: [t.slice(0, 7) + '-01', t], ta: [String(taAktif().Mulai || t).slice(0, 10), t] };
  return m[u.preset] || [u.dari || tambahHari(t, -6), u.sampai || t];
}
function siswaTerfilter(u) {
  return S.db.siswa.filter(s => s.Status === 'AKTIF' && (!u.jur || s.JurusanID === u.jur) && (!u.kelas || s.KelasID === u.kelas) && (!u.tingkat || tingkatKelas(s.KelasID) === u.tingkat) && (!u.st || statSiswa(s.ID).status === u.st));
}
function aggTerfilter(u, dari, sampai, status = 'TERVERIFIKASI') {
  return S.db.agg.filter(a => a[0] >= dari && a[0] <= sampai && (!status || a[4] === status) && (!u.jur || a[2] === u.jur) && (!u.kelas || a[1] === u.kelas) && (!u.tingkat || tingkatKelas(a[1]) === u.tingkat));
}
const jumlahAgg = rows => rows.reduce((s, a) => s + angka(a[6]), 0);
const nAgg = rows => rows.reduce((s, a) => s + angka(a[5]), 0);

HAL.dashboard = {
  judul: 'Dashboard',
  render() {
    const u = S.ui.db, [dari, sampai] = rentangDb(u);
    $('#dbTA').innerHTML = '<i class="bi bi-calendar3"></i> TA ' + esc(taAktif().Nama || '—');
    $('#dbWaktu').textContent = 'Diperbarui ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    // Filter (US-23)
    const kelasOps = S.db.kelas.filter(k => k.TAID === taAktif().ID && (!u.jur || k.JurusanID === u.jur) && (!u.tingkat || k.Tingkat === u.tingkat)).map(k => [k.ID, k.Nama]);
    $('#dbFilter').innerHTML = `
      <select class="form-select" data-chg="dbF" data-k="preset" aria-label="Periode">${opsi([['hari', 'Hari ini'], ['7', '7 hari terakhir'], ['30', '30 hari terakhir'], ['bulan', 'Bulan ini'], ['ta', 'Tahun ajaran aktif'], ['kustom', 'Rentang kustom']], u.preset)}</select>
      ${u.preset === 'kustom' ? `<input type="date" class="form-control" data-chg="dbF" data-k="dari" value="${esc(u.dari || dari)}" aria-label="Dari tanggal"><input type="date" class="form-control" data-chg="dbF" data-k="sampai" value="${esc(u.sampai || sampai)}" aria-label="Sampai tanggal">` : ''}
      <select class="form-select" data-chg="dbF" data-k="jur" aria-label="Jurusan">${opsi(S.db.jurusan.map(j => [j.ID, j.Nama]), u.jur, 'Semua jurusan')}</select>
      <select class="form-select" data-chg="dbF" data-k="tingkat" aria-label="Tingkat">${opsi(['X', 'XI', 'XII'], u.tingkat, 'Semua tingkat')}</select>
      <select class="form-select" data-chg="dbF" data-k="kelas" aria-label="Kelas">${opsi(kelasOps, u.kelas, 'Semua kelas')}</select>
      <select class="form-select" data-chg="dbF" data-k="st" aria-label="Status pembayaran">${opsi([['LUNAS', 'Lunas'], ['SEBAGIAN', 'Sebagian'], ['BELUM', 'Belum bayar'], ['MENUNGGAK', 'Menunggak']], u.st, 'Semua status')}</select>
      ${u.jur || u.tingkat || u.kelas || u.st || u.preset !== '7' ? '<button class="btn btn-ghost btn-sm" data-act="dbReset"><i class="bi bi-x-circle"></i> Atur ulang</button>' : ''}`;

    const siswa = siswaTerfilter(u), st = siswa.map(s => statSiswa(s.ID));
    const ag = aggTerfilter(u, dari, sampai), total = jumlahAgg(ag), nTrx = nAgg(ag);
    const len = selisihHari(dari, sampai) + 1, pDari = tambahHari(dari, -len), pSampai = tambahHari(dari, -1);
    const totalLalu = jumlahAgg(aggTerfilter(u, pDari, pSampai));
    const delta = totalLalu ? (total - totalLalu) / totalLalu * 100 : null;
    const deltaL = d => Math.abs(d) > 999 ? '> 999%' : Math.abs(d).toFixed(1).replace('.', ',') + '%';
    const tagihan = st.reduce((a, x) => a + x.tagihanDue, 0), diterima = st.reduce((a, x) => a + x.terbayarDue, 0), sisa = st.reduce((a, x) => a + x.sisaDue, 0);
    const nMenunggak = st.filter(x => x.nTunggak > 0).length, nKritis = st.filter(x => x.nTunggak >= 2).length, nLunas = st.filter(x => x.status === 'LUNAS').length;
    const pend = S.db.pending, totalPend = pend.reduce((a, p) => a + angka(p.Jumlah), 0);

    // Aksi cepat sesuai peran
    const kartuAksi = (ikon, judul, sub, act, extra = '', utama = false) => `<button class="kpi text-start ${utama ? '' : ''}" style="${utama ? 'background:var(--primary);border-color:var(--primary);color:#fff' : ''};cursor:pointer" data-act="${act}" ${extra}><div class="d-flex align-items-center gap-3"><span class="kpi-ikon" style="${utama ? 'background:rgba(255,255,255,.15);color:#fff' : ''}"><i class="bi bi-${ikon}"></i></span><div style="min-width:0"><div class="sel-utama" style="${utama ? 'color:#fff' : ''}">${judul}</div><div class="sel-sub" style="${utama ? 'color:rgba(255,255,255,.8)' : ''}">${sub}</div></div><i class="bi bi-arrow-right ms-auto"></i></div></button>`;
    $('#dbAksi').innerHTML = isKasir()
      ? kartuAksi('cash-coin', '+ Catat Pembayaran', 'Loket tunai & transfer • F2', 'nav', 'data-hal="bayar"', true) +
        kartuAksi('patch-check', 'Verifikasi Transfer', pend.length ? `<span class="lencana warn">${pend.length} menunggu</span> ${rpS(totalPend)}` : 'Tidak ada antrean', 'nav', 'data-hal="verifikasi"') +
        kartuAksi('exclamation-triangle', 'Tunggakan Kritis', `<b class="text-err">${nKritis} siswa</b> menunggak ≥ 2 bulan`, 'dbKritis') +
        kartuAksi('receipt', 'Transaksi Hari Ini', `${S.db.hariIni.length} transaksi • ${rpS(S.db.hariIni.filter(p => p.Status === 'TERVERIFIKASI').reduce((a, p) => a + angka(p.Jumlah), 0))}`, 'dbHariIni')
      : kartuAksi('graph-up-arrow', 'Laporan Keuangan', 'Penerimaan, tunggakan, PDF & Excel', 'nav', 'data-hal="laporan"', true) +
        kartuAksi('exclamation-triangle', 'Tunggakan Kritis', `<b class="text-err">${nKritis} siswa</b> ≥ 2 bulan`, 'dbKritis') +
        kartuAksi('receipt', 'Riwayat Transaksi', 'Telusuri buku kas pembayaran', 'nav', 'data-hal="riwayat"') +
        kartuAksi('journal-text', 'Ringkasan Koreksi', `${S.db.koreksi.length} pengajuan tercatat`, 'nav', 'data-hal="koreksi"');

    // KPI (US-21)
    $('#dbKpi').innerHTML =
      kpi({ label: 'Total Penerimaan SPP', ikon: 'wallet2', nilai: `<small>Rp</small> ${ribu(total)}`, sub: `${nTrx} transaksi${delta === null ? '' : ` • <span class="${delta >= 0 ? 'delta-up' : 'delta-down'}"><i class="bi bi-arrow-${delta >= 0 ? 'up' : 'down'}-right"></i> ${deltaL(delta)}</span> vs periode lalu`}` }) +
      kpi({ label: 'Total Tagihan Jatuh Tempo', ikon: 'file-earmark-text', nilai: `<small>Rp</small> ${ribu(tagihan)}`, sub: `<div style="flex:1"><div class="d-flex justify-content-between"><span>Realisasi</span><b class="text-ok">${pctL(diterima, tagihan)}</b></div><div class="bar ok mt-1"><span style="width:${Math.min(100, pct(diterima, tagihan))}%"></span></div></div>` }) +
      kpi({ label: 'Total Tunggakan', ikon: 'exclamation-diamond', tone: 'err', aksen: nKritis ? 'err' : '', nilai: `<span class="text-err"><small>Rp</small> ${ribu(sisa)}</span>`, sub: `${nMenunggak} siswa menunggak • <b class="text-err">${nKritis}</b> kritis ≥ 2 bln` }) +
      kpi({ label: 'Siswa Aktif', ikon: 'mortarboard', tone: 'ok', nilai: `${siswa.length} <small>siswa</small>`, sub: `<span class="chip chip-ok">${nLunas} lunas</span><span class="chip chip-warn">${siswa.length - nLunas} belum lunas</span>` });

    // Tren penerimaan (harian / bulanan / tahunan)
    $$('#dbTrenMode button').forEach(b => b.classList.toggle('aktif', b.dataset.v === u.tren));
    let labels = [], tunai = [], non = [];
    const semuaAg = aggTerfilter(u, '0000-00-00', '9999-99-99');
    if (u.tren === 'harian') {
      const d0 = len > 62 ? tambahHari(sampai, -61) : dari;
      for (let d = d0; d <= sampai; d = tambahHari(d, 1)) { labels.push(d === hariIni() ? 'Hari ini' : Number(d.slice(8)) + ' ' + BLN3[Number(d.slice(5, 7)) - 1]); const r = semuaAg.filter(a => a[0] === d); tunai.push(jumlahAgg(r.filter(a => a[3] === 'TUNAI'))); non.push(jumlahAgg(r.filter(a => a[3] !== 'TUNAI'))); }
    } else if (u.tren === 'bulanan') {
      periodeTA().forEach(p => { labels.push(BLN3[Number(p.slice(5)) - 1] + ' ' + p.slice(2, 4)); const r = semuaAg.filter(a => a[0].slice(0, 7) === p); tunai.push(jumlahAgg(r.filter(a => a[3] === 'TUNAI'))); non.push(jumlahAgg(r.filter(a => a[3] !== 'TUNAI'))); });
    } else {
      S.db.ta.slice().sort((a, b) => a.Mulai < b.Mulai ? -1 : 1).forEach(t => { labels.push(t.Nama); const r = semuaAg.filter(a => a[0] >= String(t.Mulai).slice(0, 10) && a[0] <= String(t.Selesai).slice(0, 10)); tunai.push(jumlahAgg(r.filter(a => a[3] === 'TUNAI'))); non.push(jumlahAgg(r.filter(a => a[3] !== 'TUNAI'))); });
    }
    grafik('chTren', { type: 'bar', data: { labels, datasets: [{ label: 'Tunai loket', data: tunai, backgroundColor: warna('primary-deep') === '#0E2C66' ? '#4677DC' : '#094CB2', borderRadius: 3, stack: 's' }, { label: 'Transfer / QRIS', data: non, backgroundColor: warna('secondary-c'), borderRadius: 3, stack: 's' }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 10, boxHeight: 10 } }, tooltip: tooltipRp }, scales: { x: { stacked: true, grid: { display: false } }, y: Object.assign({ stacked: true }, sumbuRp) } } });

    // Status pembayaran siswa
    const cnt = k => st.filter(x => x.status === k).length;
    const dataSt = [cnt('LUNAS'), cnt('SEBAGIAN'), cnt('BELUM'), cnt('MENUNGGAK')];
    const wSt = [warna('success'), '#D9A800', warna('secondary-c'), warna('error')];
    grafik('chStatus', { type: 'doughnut', data: { labels: ['Lunas', 'Sebagian', 'Belum bayar', 'Menunggak'], datasets: [{ data: dataSt, backgroundColor: wSt, borderWidth: 2, borderColor: warna('surface') }] }, options: { maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } } });
    $('#dbStatusLeg').innerHTML = ['Lunas', 'Sebagian', 'Belum bayar', 'Menunggak'].map((l, i) => `<div class="d-flex justify-content-between align-items-center py-1"><span class="d-flex align-items-center gap-2"><span class="dot" style="width:10px;height:10px;background:${wSt[i]}"></span>${l}</span><span class="num"><b>${dataSt[i]}</b> <span class="text-mut">(${pctL(dataSt[i], siswa.length)})</span></span></div>`).join('');

    // Perbandingan jurusan (penerimaan vs tunggakan)
    const jurs = S.db.jurusan.filter(j => aktif(j.Aktif) && (!u.jur || j.ID === u.jur));
    const perJ = jurs.map(j => { const x = siswa.filter(s => s.JurusanID === j.ID).map(s => statSiswa(s.ID)); return [x.reduce((a, y) => a + y.tagihanDue, 0), x.reduce((a, y) => a + y.terbayarDue, 0), x.reduce((a, y) => a + y.sisaDue, 0)]; });
    grafik('chJurusan', { type: 'bar', data: { labels: jurs.map(j => j.Nama), datasets: [{ label: 'Tagihan', data: perJ.map(x => x[0]), backgroundColor: warna('border'), borderRadius: 3 }, { label: 'Diterima', data: perJ.map(x => x[1]), backgroundColor: warna('success'), borderRadius: 3 }, { label: 'Sisa tunggakan', data: perJ.map(x => x[2]), backgroundColor: warna('error'), borderRadius: 3 }] }, options: { maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 10, boxHeight: 10 } }, tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + rp(c.parsed.x) } } }, scales: { x: Object.assign({}, sumbuRp), y: { grid: { display: false } } } } });

    // Tunggakan prioritas
    const prio = siswa.map(s => [s, statSiswa(s.ID)]).filter(x => x[1].sisaDue > 0).sort((a, b) => b[1].sisaDue - a[1].sisaDue).slice(0, 6);
    $('#dbPrioritas').innerHTML = `<div class="kartu-head"><div><div class="h-sm d-flex align-items-center gap-2">Tunggakan Prioritas ${prio.length ? chip('Mendesak', 'err') : ''}</div><div class="text-mut" style="font-size:12px">Siswa dengan sisa tunggakan terbesar</div></div><button class="btn btn-ghost btn-sm" data-act="dbKritis">Semua <i class="bi bi-arrow-right"></i></button></div>` +
      (prio.length ? prio.map(([s, x]) => `<div class="d-flex align-items-center gap-3 py-2" style="border-bottom:1px solid var(--border-subtle)">
        <span class="lencana ${x.nTunggak >= 2 ? 'err' : 'warn'}" style="min-width:34px;height:26px">${x.nTunggak}B</span>
        <div style="min-width:0;flex:1"><div class="sel-utama text-truncate" role="button" data-act="detailSiswa" data-id="${s.ID}">${esc(s.Nama)}</div><div class="sel-sub">${esc(namaKelas(s.KelasID))} • <b class="text-err num">${rp(x.sisaDue)}</b></div></div>
        ${isKasir() ? `<button class="btn btn-soft btn-sm" data-act="tagihSiswa" data-id="${s.ID}" title="Kirim pengingat"><i class="bi bi-send"></i></button><button class="btn btn-outline-primary btn-sm" data-act="bayarSiswa" data-id="${s.ID}">Bayar</button>` : ''}</div>`).join('') + `<div class="d-flex justify-content-between pt-3 text-2" style="font-size:12px"><span>Total ${prio.length} siswa: <b class="num">${rp(prio.reduce((a, x) => a + x[1].sisaDue, 0))}</b></span></div>`
        : kosong('Tidak ada tunggakan pada filter ini.', 'emoji-smile'));

    // Aktivitas hari ini & antrean validasi
    const peta = new Map(); S.db.hariIni.concat(S.db.pending).forEach(p => peta.set(p.ID, p));
    const akt = [...peta.values()].sort((a, b) => a.Waktu < b.Waktu ? 1 : -1).slice(0, 8);
    $('#dbAktivitas').innerHTML = `<div class="kartu-head px-3 pt-3 mb-2"><div><div class="h-sm">Pembayaran Terbaru &amp; Antrean Validasi</div><div class="text-mut" style="font-size:12px">Transaksi hari ini (${tglLabel(hariIni())}) dan transfer yang menunggu verifikasi</div></div><button class="btn btn-ghost btn-sm" data-act="nav" data-hal="riwayat">Riwayat lengkap <i class="bi bi-arrow-right"></i></button></div>` +
      (akt.length ? `<div class="tbl-scroll"><table class="tbl tbl-kartu"><thead><tr><th>No. bukti / waktu</th><th>Siswa</th><th>Metode</th><th class="r">Nominal</th><th>Status</th><th></th></tr></thead><tbody>${akt.map(p => `<tr class="${p.Status === 'MENUNGGU' ? 'sorot' : ''}">
        <td class="utama"><div class="sel-utama mono">${esc(p.NoBukti)}</div><div class="sel-sub">${tglPendek(p.Tanggal)} • ${jam(p.Waktu)} WIB</div></td>
        <td data-l="Siswa"><div class="sel-utama">${esc(p.Nama)}</div><div class="sel-sub">${esc(namaKelas(p.KelasID))}</div></td>
        <td data-l="Metode">${labelMetode(p.Metode, p.Bank)}</td><td data-l="Nominal" class="r num"><b>${rp(p.Jumlah)}</b></td><td data-l="Status">${chipStatusTrx(p.Status)}</td>
        <td data-l="" class="r">${p.Status === 'MENUNGGU' && isKasir() ? `<button class="btn btn-primary btn-sm" data-act="nav" data-hal="verifikasi"><i class="bi bi-patch-check"></i> Periksa</button>` : p.Status !== 'SINKRON' ? `<button class="btn btn-ghost btn-sm" data-act="detailTrx" data-id="${p.ID}">Detail</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : kosong('Belum ada transaksi hari ini.', 'cup-hot'));

    // Panel kasir / ringkasan
    const tunaiSaya = S.db.hariIni.filter(p => p.PetugasID === S.me.id && p.Metode === 'TUNAI' && p.Status !== 'DIBATALKAN').reduce((a, p) => a + angka(p.Jumlah) + angka(p.Admin), 0);
    const target = angka(S.set.TARGET_SETORAN) || 1;
    $('#dbKasir').innerHTML = isKasir() ? `<div class="kartu-head mb-2"><span class="label">Status Loket &amp; Kasir</span>${chip('Buka', 'ok')}</div>
      <div class="kartu-2 d-flex gap-3 align-items-center">${avatar(S.me.nama, 'sedang')}<div><div class="sel-utama">${esc(S.me.nama)}</div><div class="sel-sub">${esc(LABEL_PERAN[S.me.peran])}${S.me.drawer ? ' • ' + esc(S.me.drawer) : ''}</div></div></div>
      <div class="mt-3"><div class="ringkas-baris"><span>Tunai di laci (sistem)</span><b>${rp(tunaiSaya)}</b></div><div class="bar mt-1"><span style="width:${Math.min(100, pct(tunaiSaya, target))}%"></span></div><div class="d-flex justify-content-between mt-1 text-mut" style="font-size:12px"><span>Target setor bank</span><span class="num">${rp(target)}</span></div></div>
      <div class="d-grid gap-2 mt-3"><button class="btn btn-primary" data-act="nav" data-hal="bayar"><i class="bi bi-plus-circle"></i> Catat Pembayaran Baru <kbd class="ms-auto">F2</kbd></button><button class="btn btn-soft" data-act="tutupKasir"><i class="bi bi-safe"></i> Tutup Kasir &amp; Rekonsiliasi Laci</button></div>`
      : `<div class="label mb-2">Ringkasan Hari Ini</div><div class="rp-lg">${rp(S.db.hariIni.filter(p => p.Status === 'TERVERIFIKASI').reduce((a, p) => a + angka(p.Jumlah), 0))}</div><div class="text-2">${S.db.hariIni.length} transaksi tercatat hari ini</div>
      ${['TUNAI', 'TRANSFER', 'QRIS'].map(m => { const r = S.db.hariIni.filter(p => p.Metode === m && p.Status === 'TERVERIFIKASI'); return `<div class="ringkas-baris"><span>${labelMetode(m)}</span><b>${rp(r.reduce((a, p) => a + angka(p.Jumlah), 0))}</b></div>`; }).join('')}`;

    // Insight otomatis
    $('#dbInsight').innerHTML = `<div class="kartu-head mb-2"><div class="h-sm"><i class="bi bi-stars"></i> Analisis Otomatis</div></div><ul class="mb-0 ps-3 text-2" style="line-height:1.7">${insightDashboard({ u, dari, sampai, total, totalLalu, delta, siswa, st, jurs, perJ, sisa, nKritis }).map(x => `<li>${x}</li>`).join('')}</ul>`;
  }
};
function insightDashboard(c) {
  const out = [];
  out.push(`Penerimaan ${tglPendek(c.dari)}–${tglPendek(c.sampai)}: <b>${rp(c.total)}</b>${c.delta === null ? '' : `, ${c.delta >= 0 ? 'naik' : 'turun'} <b>${Math.abs(c.delta) > 999 ? 'lebih dari 999%' : Math.abs(c.delta).toFixed(1).replace('.', ',') + '%'}</b> dibanding periode sebelumnya`}.`);
  if (c.jurs.length > 1) {
    const r = c.jurs.map((j, i) => [j.Nama, pct(c.perJ[i][1], c.perJ[i][0])]).sort((a, b) => a[1] - b[1]);
    out.push(`Realisasi terendah: <b>${esc(r[0][0])}</b> (${r[0][1].toFixed(1).replace('.', ',')}%), tertinggi ${esc(r[r.length - 1][0])} (${r[r.length - 1][1].toFixed(1).replace('.', ',')}%).`);
  }
  const perKelas = {};
  c.siswa.forEach((s, i) => { perKelas[s.KelasID] = (perKelas[s.KelasID] || 0) + c.st[i].sisaDue; });
  const top = Object.entries(perKelas).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] > 0) out.push(`Kelas dengan tunggakan terbesar: <b>${esc(namaKelas(top[0]))}</b> (${rp(top[1])}).`);
  if (c.nKritis) out.push(`<span class="text-err"><b>${c.nKritis} siswa</b></span> menunggak ≥ 2 bulan — prioritaskan pengingat & panggilan wali.`);
  if (S.db.pending.length) out.push(`${S.db.pending.length} transfer menunggu verifikasi senilai ${rp(S.db.pending.reduce((a, p) => a + angka(p.Jumlah), 0))}; saldo tagihan baru berubah setelah diverifikasi.`);
  const hari = {}; aggTerfilter(c.u, c.dari, c.sampai).forEach(a => { hari[a[0]] = (hari[a[0]] || 0) + angka(a[6]); });
  const puncak = Object.entries(hari).sort((a, b) => b[1] - a[1])[0];
  if (puncak) out.push(`Hari penerimaan tertinggi: ${tglLabel(puncak[0])} (${rp(puncak[1])}).`);
  return out;
}
CHG.dbF = el => { S.ui.db[el.dataset.k] = el.value; if (el.dataset.k === 'jur' || el.dataset.k === 'tingkat') S.ui.db.kelas = ''; LS.set('ui.db', S.ui.db); HAL.dashboard.render(); };
ACT.dbReset = () => { S.ui.db = { preset: '7', dari: '', sampai: '', jur: '', tingkat: '', kelas: '', st: '', tren: S.ui.db.tren }; LS.set('ui.db', S.ui.db); HAL.dashboard.render(); };
ACT.dbTren = el => { S.ui.db.tren = el.dataset.v; LS.set('ui.db', S.ui.db); HAL.dashboard.render(); };
ACT.dbKritis = () => { S.ui.tg = Object.assign(defaultTg(), { st: 'KRITIS' }); go('tagihan'); };
ACT.dbHariIni = () => { S.ui.rw = Object.assign(defaultRw(), { preset: 'hari' }); go('riwayat'); };
ACT.tutupKasir = () => {
  const sistem = S.db.hariIni.filter(p => p.PetugasID === S.me.id && p.Metode === 'TUNAI' && p.Status !== 'DIBATALKAN').reduce((a, p) => a + angka(p.Jumlah) + angka(p.Admin), 0);
  bukaModal({
    judul: 'Tutup Kasir & Rekonsiliasi Laci', ukuran: 'md',
    isi: `<div class="kartu-2 mb-3"><div class="ringkas-baris"><span>Tunai tercatat sistem (${esc(S.me.nama)})</span><b>${rp(sistem)}</b></div></div>
      <label class="form-label" for="tkFisik">Uang fisik di laci</label><div class="rp-group besar"><span class="rp-tag">Rp</span><input id="tkFisik" inputmode="numeric" data-inp="tkFisik" autocomplete="off" autofocus></div>
      <div id="tkSelisih" class="kembalian mt-3"><div class="lbl-sm">Selisih</div><div class="nilai">Rp 0</div></div>
      <label class="form-label mt-3" for="tkCatatan">Catatan (opsional)</label><input class="form-control" id="tkCatatan" placeholder="mis. disetor ke BSI pukul 14.00">`,
    kaki: `<button class="btn btn-soft" data-bs-dismiss="modal">Batal</button><button class="btn btn-primary" data-act="tkSimpan" data-sistem="${sistem}"><i class="bi bi-safe"></i> Simpan Berita Acara</button>`
  });
};
INP.tkFisik = el => { formatInputRp(el); const b = $('[data-act=tkSimpan]'), sel = angka(el.value) - angka(b.dataset.sistem), box = $('#tkSelisih'); box.classList.toggle('kurang', sel !== 0); box.querySelector('.nilai').textContent = (sel > 0 ? '+' : '') + rp(sel) + (sel === 0 ? ' (SEIMBANG)' : ''); };
ACT.tkSimpan = async btn => {
  sibuk(btn, true, 'Menyimpan…');
  try { const r = await api('tutupKasir', angka($('#tkFisik').value), $('#tkCatatan').value); tutupModal(); toast(`Sistem ${rp(r.sistem)} • fisik ${rp(r.fisik)} • selisih ${rp(r.selisih)} (${r.n} trx). Tercatat di log audit.`, r.selisih === 0 ? 'ok' : 'warn', 'Kasir ditutup'); }
  catch (e) { toast(e.message, 'err'); } finally { sibuk(btn, false); }
};

// ── Data Siswa ──
const defaultSw = () => ({ q: '', jur: '', kelas: '', st: '', status: 'AKTIF', urut: 'Nama', arah: 1, page: 1, pilih: new Set() });
S.ui.sw = defaultSw();
function siswaSaring() {
  const u = S.ui.sw, q = u.q.toLowerCase().trim();
  let rows = S.db.siswa.filter(s => (!u.status || s.Status === u.status) && (!u.jur || s.JurusanID === u.jur) && (!u.kelas || s.KelasID === u.kelas));
  if (u.st) rows = rows.filter(s => { const x = statSiswa(s.ID); return u.st === 'KRITIS' ? x.nTunggak >= 2 : x.status === u.st; });
  if (q) rows = rows.filter(s => (s.NIS + ' ' + s.Nama + ' ' + s.NamaWali + ' ' + s.HPWali + ' ' + s.NISN).toLowerCase().includes(q));
  const f = { NIS: s => String(s.NIS), Nama: s => s.Nama.toLowerCase(), Kelas: s => namaKelas(s.KelasID), Sisa: s => statSiswa(s.ID).sisaDue }[u.urut] || (s => s.Nama);
  return urutkan(rows, f, u.arah);
}
HAL.siswa = {
  judul: 'Data Siswa',
  render() {
    const u = S.ui.sw, aktifS = S.db.siswa.filter(s => s.Status === 'AKTIF'), st = aktifS.map(s => statSiswa(s.ID));
    $('#swJumlah').textContent = aktifS.length + ' siswa aktif';
    $('#swAksi').innerHTML = `<button class="btn btn-outline-primary" data-act="swEkspor"><i class="bi bi-file-earmark-spreadsheet"></i> Ekspor Excel</button>` +
      (isOpr() ? `<button class="btn btn-outline-primary" data-act="nav" data-hal="impor"><i class="bi bi-file-earmark-arrow-up"></i> Impor Excel</button><button class="btn btn-primary" data-act="formSiswa"><i class="bi bi-person-plus"></i> Tambah Siswa</button>` : '');
    const perJ = S.db.jurusan.map(j => `<span><span class="dot text-pri"></span> ${aktifS.filter(s => s.JurusanID === j.ID).length} ${esc(j.Kode)}</span>`).join('');
    const nLunas = st.filter(x => x.status === 'LUNAS').length, nSeb = st.filter(x => x.status === 'SEBAGIAN' || x.status === 'BELUM').length, nKrit = st.filter(x => x.nTunggak >= 2).length, n1 = st.filter(x => x.nTunggak === 1).length;
    $('#swKpi').innerHTML =
      kpi({ label: 'Total Siswa Aktif', ikon: 'people', nilai: `${aktifS.length} <small>siswa</small>`, sub: perJ }) +
      kpi({ label: 'Bebas Tunggakan (Lunas)', ikon: 'check2-circle', tone: 'ok', nilai: `${nLunas} <small>siswa</small>`, sub: `<span class="chip chip-info">${pctL(nLunas, aktifS.length)} kepatuhan</span>` }) +
      kpi({ label: 'Sebagian / Belum Bayar', ikon: 'hourglass-split', tone: 'warn', nilai: `${nSeb + n1} <small>siswa</small>`, sub: `${n1} menunggak 1 bulan` }) +
      kpi({ label: 'Tunggakan Kritis (≥ 2 bln)', ikon: 'exclamation-triangle', tone: 'err', aksen: 'err', nilai: `<span class="text-err">${nKrit}</span> <small>siswa</small>`, sub: `<a href="#" data-act="swSaringKritis" class="text-err">Lihat daftar <i class="bi bi-arrow-right"></i></a>` });
    if (!$('#swQ')) {
      $('#swFilter').innerHTML = `<div class="input-ikon cari"><i class="bi bi-search"></i><input class="form-control" id="swQ" data-inp="swQ" placeholder="Cari nama, NIS, wali, atau HP…" autocomplete="off" aria-label="Cari siswa"></div>
        <select class="form-select" id="swJur" data-chg="swF" data-k="jur" aria-label="Jurusan"></select><select class="form-select" id="swKelas" data-chg="swF" data-k="kelas" aria-label="Kelas"></select>
        <select class="form-select" id="swSt" data-chg="swF" data-k="st" aria-label="Status SPP"></select><select class="form-select" id="swStatus" data-chg="swF" data-k="status" aria-label="Status siswa"></select>
        <button class="btn btn-ghost" data-act="swReset"><i class="bi bi-arrow-counterclockwise"></i> Reset</button>`;
    }
    $('#swQ').value = u.q;
    $('#swJur').innerHTML = opsi(S.db.jurusan.map(j => [j.ID, j.Nama]), u.jur, 'Semua jurusan');
    $('#swKelas').innerHTML = opsi(S.db.kelas.filter(k => k.TAID === taAktif().ID && (!u.jur || k.JurusanID === u.jur)).map(k => [k.ID, k.Nama]), u.kelas, 'Semua kelas');
    $('#swSt').innerHTML = opsi([['LUNAS', 'Lunas'], ['SEBAGIAN', 'Sebagian'], ['BELUM', 'Belum bayar'], ['MENUNGGAK', 'Menunggak'], ['KRITIS', 'Kritis ≥ 2 bulan']], u.st, 'Semua status SPP');
    $('#swStatus').innerHTML = opsi([['AKTIF', 'Siswa aktif'], ['NONAKTIF', 'Nonaktif'], ['LULUS', 'Lulus'], ['KELUAR', 'Keluar']], u.status, 'Semua status siswa');
    renderSwTabel();
  }
};
function renderSwTabel() {
  const u = S.ui.sw, rows = siswaSaring(), size = 25, n = rows.length;
  u.page = Math.min(u.page, Math.max(1, Math.ceil(n / size)));
  const hal = rows.slice((u.page - 1) * size, u.page * size);
  const chips = [];
  if (u.q) chips.push(['q', 'Cari: ' + u.q]); if (u.jur) chips.push(['jur', namaJurusan(u.jur)]); if (u.kelas) chips.push(['kelas', namaKelas(u.kelas)]);
  if (u.st) chips.push(['st', { KRITIS: 'Kritis ≥ 2 bln', LUNAS: 'Lunas', SEBAGIAN: 'Sebagian', BELUM: 'Belum bayar', MENUNGGAK: 'Menunggak' }[u.st]]); if (u.status !== 'AKTIF') chips.push(['status', u.status ? 'Status: ' + u.status : 'Semua status siswa']);
  $('#swChip').innerHTML = chips.length ? '<span class="label">Filter aktif:</span>' + chips.map(c => `<span class="chip chip-info" data-act="swHapusF" data-k="${c[0]}">${esc(c[1])} <i class="bi bi-x"></i></span>`).join('') + '<a href="#" data-act="swReset" class="ms-1" style="font-size:12px">Atur ulang semua</a>' : '';
  $('#swBulk').innerHTML = u.pilih.size ? `<div class="bulk-bar"><span>${u.pilih.size} siswa dipilih</span><button class="btn btn-sm btn-soft" data-act="swCetakSurat"><i class="bi bi-printer"></i> Cetak surat tagihan</button>${isOpr() ? '<button class="btn btn-sm btn-soft" data-act="swSiaran"><i class="bi bi-megaphone"></i> Kirim pengingat</button>' : ''}<button class="btn btn-sm btn-ghost ms-auto" data-act="swBersihPilih">Batal pilih</button></div>` : '';
  const semuaDipilih = hal.length && hal.every(s => u.pilih.has(s.ID));
  $('#swTabel').innerHTML = `<div class="kartu-head px-3 pt-3 mb-2"><span class="label d-flex align-items-center gap-2"><i class="bi bi-journal-bookmark text-pri"></i> Daftar Buku Induk Keuangan Siswa</span><span class="text-mut" style="font-size:12px">Menampilkan ${n ? (u.page - 1) * size + 1 : 0}–${Math.min(n, u.page * size)} dari ${n}</span></div>
    <div class="tbl-scroll"><table class="tbl tbl-kartu"><thead><tr><th style="width:36px"><input type="checkbox" class="form-check-input" data-chg="swPilihSemua" ${semuaDipilih ? 'checked' : ''} aria-label="Pilih semua di halaman ini"></th>
      ${thUrut('NIS', 'NIS', u, 'swUrut')}${thUrut('Nama siswa', 'Nama', u, 'swUrut')}<th>Program keahlian</th>${thUrut('Kelas', 'Kelas', u, 'swUrut')}${thUrut('Sisa tunggakan', 'Sisa', u, 'swUrut', 'r')}<th>Status SPP</th><th>Kontak wali</th><th></th></tr></thead>
    <tbody>${hal.length ? hal.map(s => { const x = statSiswa(s.ID); const tarif = (S.db.tg[s.ID] || []).slice(-1)[0]; return `<tr>
      <td data-l=""><input type="checkbox" class="form-check-input" data-chg="swPilih" data-id="${s.ID}" ${u.pilih.has(s.ID) ? 'checked' : ''} aria-label="Pilih ${esc(s.Nama)}"></td>
      <td data-l="NIS" class="num"><a href="#" data-act="detailSiswa" data-id="${s.ID}" class="fw-semibold">${esc(s.NIS)}</a></td>
      <td class="utama"><div class="d-flex align-items-center gap-2">${avatar(s.Nama, 'lembut')}<div><div class="sel-utama">${esc(s.Nama)} ${s.Kategori === 'DISPENSASI' ? chip('Dispensasi', 'info') : ''}</div><div class="sel-sub">${s.JK === 'P' ? '♀ Perempuan' : '♂ Laki-laki'} • ${s.Status === 'AKTIF' ? '<span class="text-ok">Aktif</span>' : esc(s.Status)}</div></div></div></td>
      <td data-l="Jurusan">${esc(namaJurusan(s.JurusanID))}</td><td data-l="Kelas"><span class="chip">${esc(namaKelas(s.KelasID))}</span></td>
      <td data-l="Sisa" class="r num"><b class="${x.sisaDue ? 'text-err' : 'text-ok'}">${rp(x.sisaDue)}</b><div class="sel-sub">${tarif ? 'Tarif ' + rp(tarif[1]) + '/bln' : ''}</div></td>
      <td data-l="Status SPP">${chipStatusSiswa(x)}</td>
      <td data-l="Wali"><div class="sel-sub" style="color:var(--text)"><i class="bi bi-telephone"></i> ${esc(s.HPWali || '-')}</div><div class="sel-sub">${esc(s.NamaWali || '')}</div></td>
      <td data-l="" class="r" style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-act="detailSiswa" data-id="${s.ID}">Detail</button>${isKasir() && s.Status === 'AKTIF' ? `<button class="btn btn-outline-primary btn-sm" data-act="bayarSiswa" data-id="${s.ID}">Bayar</button>` : ''}${isOpr() ? `<button class="btn btn-ghost btn-sm btn-icon" data-act="formSiswa" data-id="${s.ID}" aria-label="Ubah"><i class="bi bi-pencil"></i></button>` : ''}</td></tr>`; }).join('') : `<tr><td colspan="9">${kosong('Tidak ada siswa yang cocok dengan filter.', 'search')}</td></tr>`}</tbody></table></div>
    <div class="tbl-foot"><span>Total sisa tunggakan (hasil filter): <b class="num text-err">${rp(rows.reduce((a, s) => a + statSiswa(s.ID).sisaDue, 0))}</b></span>${pager('swHal', u.page, n, size)}</div>`;
}
INP.swQ = debounce(el => { S.ui.sw.q = el.value; S.ui.sw.page = 1; renderSwTabel(); }, 150);
CHG.swF = el => { S.ui.sw[el.dataset.k] = el.value; if (el.dataset.k === 'jur') S.ui.sw.kelas = ''; S.ui.sw.page = 1; HAL.siswa.render(); };
CHG.swPilih = el => { el.checked ? S.ui.sw.pilih.add(el.dataset.id) : S.ui.sw.pilih.delete(el.dataset.id); renderSwTabel(); };
CHG.swPilihSemua = el => { const rows = siswaSaring().slice((S.ui.sw.page - 1) * 25, S.ui.sw.page * 25); rows.forEach(s => el.checked ? S.ui.sw.pilih.add(s.ID) : S.ui.sw.pilih.delete(s.ID)); renderSwTabel(); };
ACT.swBersihPilih = () => { S.ui.sw.pilih.clear(); renderSwTabel(); };
ACT.swUrut = el => { const u = S.ui.sw; u.arah = u.urut === el.dataset.k ? -u.arah : (el.dataset.k === 'Sisa' ? -1 : 1); u.urut = el.dataset.k; renderSwTabel(); };
ACT.swHal = el => { S.ui.sw.page = Number(el.dataset.page); renderSwTabel(); $('#swTabel').scrollIntoView({ block: 'start' }); };
ACT.swHapusF = el => { const k = el.dataset.k; S.ui.sw[k] = k === 'status' ? 'AKTIF' : ''; HAL.siswa.render(); };
ACT.swReset = () => { S.ui.sw = defaultSw(); HAL.siswa.render(); };
ACT.swSaringKritis = () => { S.ui.sw.st = 'KRITIS'; S.ui.sw.page = 1; HAL.siswa.render(); };
ACT.swEkspor = () => {
  const rows = siswaSaring();
  eksporXlsx('Data_Siswa_' + hariIni() + '.xlsx', [{ nama: 'Siswa', lebar: [12, 14, 28, 4, 28, 18, 10, 14, 16, 24, 16, 26], rows: [['NIS', 'NISN', 'Nama', 'JK', 'Jurusan', 'Kelas', 'Status', 'Status SPP', 'Sisa Tunggakan', 'Nama Wali', 'HP Wali', 'Email Wali']].concat(rows.map(s => { const x = statSiswa(s.ID); return [s.NIS, s.NISN, s.Nama, s.JK, namaJurusan(s.JurusanID), namaKelas(s.KelasID), s.Status, x.status, x.sisaDue, s.NamaWali, s.HPWali, s.EmailWali]; })) }]);
};
ACT.swCetakSurat = () => {
  const s = S.set, list = [...S.ui.sw.pilih].map(id => S.idx.siswa.get(id)).filter(Boolean);
  const html = list.map(sw => { const x = statSiswa(sw.ID); return `<div class="lembar dok" style="page-break-after:always">${kopDokumen()}<h2>SURAT PEMBERITAHUAN TAGIHAN SPP</h2><div class="meta">Tanggal: ${tglLabel(hariIni())}</div>
    <p style="margin-top:18px">Kepada Yth.<br><b>${esc(sw.NamaWali || 'Orang Tua/Wali')}</b><br>Orang tua/wali dari <b>${esc(sw.Nama)}</b> (NIS ${esc(sw.NIS)}, ${esc(namaKelas(sw.KelasID))})</p>
    <p>Dengan hormat, berdasarkan catatan administrasi keuangan sekolah, berikut rincian kewajiban SPP yang belum diselesaikan:</p>
    <table><thead><tr><th>No</th><th>Periode</th><th>Jatuh tempo</th><th class="r">Sisa (Rp)</th></tr></thead><tbody>${(S.db.tg[sw.ID] || []).filter(t => t[1] - t[2] > 0 && t[4] < hariIni()).map((t, i) => `<tr><td>${i + 1}</td><td>SPP ${bulanLabel(t[0])}</td><td>${tglLabel(t[4])}</td><td class="r">${ribu(t[1] - t[2])}</td></tr>`).join('') || '<tr><td colspan="4">Tidak ada tunggakan jatuh tempo.</td></tr>'}</tbody><tfoot><tr><td colspan="3">Total tunggakan</td><td class="r">${ribu(x.sisaDue)}</td></tr></tfoot></table>
    <p style="margin-top:14px">Pembayaran dapat dilakukan di loket bendahara sekolah${s.REKENING ? ` atau transfer ke ${esc(s.BANK)} ${esc(s.REKENING)} a.n. ${esc(s.ATAS_NAMA)}` : ''}. Abaikan surat ini apabila telah melakukan pembayaran. Atas perhatiannya kami ucapkan terima kasih.</p>
    <div class="ttd" style="grid-template-columns:1fr 1fr"><div></div><div>${esc(s.KOTA)}, ${tglLabel(hariIni())}<br>Bendahara,<div class="nm">${esc(s.BENDAHARA)}</div></div></div></div>`; }).join('');
  cetakHtml(html);
};
ACT.swSiaran = () => { S.ui.sr = Object.assign(S.ui.sr || {}, { step: 1, siswaIds: [...S.ui.sw.pilih] }); go('siaran'); toast(S.ui.sw.pilih.size + ' siswa terpilih dijadikan sasaran siaran.', 'info'); };

/** Profil & buku bantu SPP siswa */
ACT.detailSiswa = el => detailSiswa(el.dataset.id);
function detailSiswa(id) {
  const s = S.idx.siswa.get(id); if (!s) return;
  const x = statSiswa(id), rows = S.db.tg[id] || [];
  const tot = rows.reduce((a, t) => [a[0] + t[1], a[1] + t[2], a[2] + Math.max(0, t[1] - t[2])], [0, 0, 0]);
  bukaModal({
    judul: 'Profil & Buku Bantu SPP', ukuran: 'xl',
    isi: `<div class="grid-2" style="grid-template-columns:300px minmax(0,1fr)">
      <div class="tumpuk"><div class="kartu-2 text-center">${avatar(s.Nama, 'besar')}<div class="h-sm mt-2">${esc(s.Nama)}</div><div class="text-2 num">NIS ${esc(s.NIS)}${s.NISN ? ' • NISN ' + esc(s.NISN) : ''}</div><div class="mt-2 d-flex justify-content-center gap-1 flex-wrap">${chipStatusSiswa(x)}${chip(s.Status, s.Status === 'AKTIF' ? 'ok' : '')}${s.Kategori === 'DISPENSASI' ? chip('Dispensasi', 'info') : ''}</div></div>
        <div class="info-grid" style="grid-template-columns:1fr">
          <div class="info-sel"><span class="lbl-sm">Kelas • Jurusan</span>${esc(namaKelas(s.KelasID))} • ${esc(namaJurusan(s.JurusanID))}</div>
          <div class="info-sel"><span class="lbl-sm">Wali murid</span>${esc(s.NamaWali || '-')}<div class="sel-sub"><i class="bi bi-telephone"></i> ${esc(s.HPWali || '-')}</div><div class="sel-sub"><i class="bi bi-envelope"></i> ${esc(s.EmailWali || 'email belum diisi')}</div></div>
          <div class="info-sel"><span class="lbl-sm">Sisa tunggakan</span><span class="rp-md ${x.sisaDue ? 'text-err' : 'text-ok'}">${rp(x.sisaDue)}</span>${x.tertahan ? `<div class="sel-sub text-pri">${rp(x.tertahan)} menunggu verifikasi</div>` : ''}</div>
        </div></div>
      <div><div class="kartu-head mb-2"><div class="h-sm">Buku Bantu SPP</div><span class="text-mut" style="font-size:12px">${rows.length} periode tagihan</span></div>
        <div class="tbl-wrap"><div class="tbl-scroll" style="max-height:340px"><table class="tbl"><thead><tr><th>Periode</th><th>Jatuh tempo</th><th class="r">Nominal</th><th class="r">Terbayar</th><th class="r">Sisa</th><th>Status</th></tr></thead><tbody>
        ${rows.map(t => { const sb = statusBulan(t), c = CHIP_BULAN[sb]; return `<tr><td class="sel-utama">${bulanLabel(t[0])}</td><td>${tglPendek(t[4])}</td><td class="r num">${ribu(t[1])}</td><td class="r num">${ribu(t[2])}</td><td class="r num ${t[1] - t[2] > 0 ? 'text-err' : ''}">${ribu(Math.max(0, t[1] - t[2]))}</td><td>${chip(c[0], c[1])}${t[3] ? ' ' + chip('Tertahan ' + ribu(t[3]), 'info') : ''}</td></tr>`; }).join('') || `<tr><td colspan="6">${kosong('Belum ada tagihan.')}</td></tr>`}
        </tbody><tfoot><tr><td colspan="2">Total</td><td class="r num">${ribu(tot[0])}</td><td class="r num">${ribu(tot[1])}</td><td class="r num">${ribu(tot[2])}</td><td></td></tr></tfoot></table></div></div>
        <div class="kartu-head mt-4 mb-2"><div class="h-sm">Riwayat Pembayaran</div></div><div id="dsRiwayat"><div class="skeleton" style="height:90px"></div></div></div></div>`,
    kaki: `${isOpr() ? `<button class="btn btn-soft me-auto" data-act="formSiswa" data-id="${id}"><i class="bi bi-pencil"></i> Ubah data</button>` : '<span class="me-auto"></span>'}${isKasir() && x.sisaDue ? `<button class="btn btn-soft" data-act="tagihSiswa" data-id="${id}"><i class="bi bi-send"></i> Kirim pengingat</button>` : ''}${isKasir() && s.Status === 'AKTIF' ? `<button class="btn btn-primary" data-act="bayarSiswa" data-id="${id}"><i class="bi bi-cash-coin"></i> Catat Pembayaran</button>` : ''}`
  });
  api('cariPembayaran', { siswaId: id, size: 10 }).then(r => {
    const el = $('#dsRiwayat'); if (!el) return;
    el.innerHTML = r.rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>No. bukti</th><th>Tanggal</th><th>Periode</th><th>Metode</th><th class="r">Jumlah</th><th>Status</th></tr></thead><tbody>${r.rows.map(row => { const p = keObj('Pembayaran', row); return `<tr class="klik ${p.Status === 'DIBATALKAN' ? 'batal' : ''}" data-act="detailTrx" data-id="${p.ID}"><td class="mono">${esc(p.NoBukti)}</td><td>${tglPendek(p.Tanggal)}</td><td>${alokParse(p.Alokasi).map(a => bulanPendek(a.p)).join(', ')}</td><td>${labelMetode(p.Metode)}</td><td class="r num"><span class="coret">${rp(p.Jumlah)}</span></td><td>${chipStatusTrx(p.Status)}</td></tr>`; }).join('')}</tbody></table></div>` : kosong('Belum ada pembayaran tercatat.', 'receipt');
  }).catch(e => { const el = $('#dsRiwayat'); if (el) el.innerHTML = peringatan(esc(e.message), 'err'); });
}
ACT.bayarSiswa = el => { tutupModal(); go('bayar', { sid: el.dataset.id, periode: el.dataset.p }); };
ACT.tagihSiswa = async el => {
  const s = S.idx.siswa.get(el.dataset.id); if (!s) return;
  if (!(await konfirmasi('Kirim pengingat tunggakan?', `Pengingat untuk wali <b>${esc(s.Nama)}</b> dikirim ke ${esc(s.EmailWali || s.HPWali || '(kontak kosong)')}. Mode kirim: <b>${esc(S.set.MODE_KIRIM)}</b>.`, { ok: 'Kirim pengingat' }))) return;
  try { const r = await api('kirimPengingatSiswa', s.ID); toast(r.terkirim ? 'Pengingat diproses (' + (S.set.MODE_KIRIM === 'LIVE' ? 'terkirim' : 'simulasi') + ').' : 'Pengingat dijadwalkan di antrean.', 'ok'); }
  catch (e) { toast(e.message, 'err'); }
};

// ── Form data master generik (optimistis untuk respons instan) ──
const FORM = {
  Siswa: [
    { k: 'NIS', l: 'NIS', req: 1, ph: '25260001', pola: '^\\d{4,20}$', bantu: '4–20 digit angka, unik' }, { k: 'NISN', l: 'NISN', ph: 'opsional' },
    { k: 'Nama', l: 'Nama lengkap', req: 1, lebar: 2 }, { k: 'JK', l: 'Jenis kelamin', t: 'sel', opsi: [['L', 'Laki-laki'], ['P', 'Perempuan']], req: 1 },
    { k: 'KelasID', l: 'Kelas', t: 'kelas', req: 1 }, { k: 'Status', l: 'Status siswa', t: 'sel', opsi: [['AKTIF', 'Aktif'], ['NONAKTIF', 'Nonaktif'], ['LULUS', 'Lulus'], ['KELUAR', 'Keluar']] },
    { k: 'Kategori', l: 'Kategori', t: 'sel', opsi: [['REGULER', 'Reguler'], ['DISPENSASI', 'Dispensasi yayasan']] }, { k: 'NamaWali', l: 'Nama wali', ph: 'Bpk./Ibu …' },
    { k: 'HPWali', l: 'HP / WA wali', ph: '0812…', t: 'tel' }, { k: 'EmailWali', l: 'Email wali', t: 'email', ph: 'untuk tanda terima & pengingat' }, { k: 'Alamat', l: 'Alamat', lebar: 2 }
  ],
  Jurusan: [{ k: 'Kode', l: 'Kode', req: 1, ph: 'FKK' }, { k: 'Nama', l: 'Nama jurusan', req: 1, lebar: 2 }, { k: 'Aktif', l: 'Status', t: 'aktif' }],
  TahunAjaran: [{ k: 'Nama', l: 'Nama (YYYY/YYYY)', req: 1, ph: '2027/2028' }, { k: 'Mulai', l: 'Tanggal mulai', t: 'date', req: 1 }, { k: 'Selesai', l: 'Tanggal selesai', t: 'date', req: 1 }, { k: 'Aktif', l: 'Jadikan tahun ajaran aktif', t: 'aktif' }],
  Kelas: [{ k: 'Nama', l: 'Nama kelas', req: 1, ph: 'XI Farmasi 1' }, { k: 'Tingkat', l: 'Tingkat', t: 'sel', opsi: ['X', 'XI', 'XII'], req: 1 }, { k: 'JurusanID', l: 'Jurusan', t: 'jur', req: 1 }, { k: 'TAID', l: 'Tahun ajaran', t: 'ta', req: 1 }, { k: 'WaliKelas', l: 'Wali kelas' }, { k: 'Aktif', l: 'Status', t: 'aktif' }],
  TarifSPP: [{ k: 'TAID', l: 'Tahun ajaran', t: 'ta', req: 1 }, { k: 'JurusanID', l: 'Jurusan', t: 'jur', req: 1 }, { k: 'Tingkat', l: 'Tingkat', t: 'sel', opsi: ['X', 'XI', 'XII'], req: 1 }, { k: 'Nominal', l: 'Nominal per bulan', t: 'rp', req: 1 }, { k: 'Aktif', l: 'Status', t: 'aktif' }]
};
const TABEL_DB = { Siswa: 'siswa', Jurusan: 'jurusan', TahunAjaran: 'ta', Kelas: 'kelas', TarifSPP: 'tarif' };
function bidang(f, v) {
  const id = 'fm_' + f.k, req = f.req ? 'required' : '', val = v === undefined || v === null ? '' : v;
  let inp;
  if (f.t === 'sel') inp = `<select class="form-select" id="${id}" ${req}>${opsi(f.opsi, val)}</select>`;
  else if (f.t === 'kelas') inp = `<select class="form-select" id="${id}" ${req}>${opsi(S.db.kelas.filter(k => aktif(k.Aktif)).sort((a, b) => (a.TAID === taAktif().ID ? 0 : 1) - (b.TAID === taAktif().ID ? 0 : 1) || a.Nama.localeCompare(b.Nama)).map(k => [k.ID, k.Nama + ' — ' + ((S.idx.ta.get(k.TAID) || {}).Nama || '')]), val, 'Pilih kelas')}</select>`;
  else if (f.t === 'jur') inp = `<select class="form-select" id="${id}" ${req}>${opsi(S.db.jurusan.map(j => [j.ID, j.Nama]), val, 'Pilih jurusan')}</select>`;
  else if (f.t === 'ta') inp = `<select class="form-select" id="${id}" ${req}>${opsi(S.db.ta.map(t => [t.ID, t.Nama + (aktif(t.Aktif) ? ' (aktif)' : '')]), val || taAktif().ID, 'Pilih tahun ajaran')}</select>`;
  else if (f.t === 'aktif') inp = `<div class="form-check form-switch mt-2"><input class="form-check-input" type="checkbox" id="${id}" ${val === '' || aktif(val) ? 'checked' : ''}><label class="form-check-label" for="${id}">${f.k === 'Aktif' && f.l.indexOf('Jadikan') === 0 ? 'Ya' : 'Aktif'}</label></div>`;
  else if (f.t === 'rp') inp = `<div class="rp-group"><span class="rp-tag">Rp</span><input id="${id}" inputmode="numeric" value="${val ? ribu(val) : ''}" data-inp="fmtRp" ${req}></div>`;
  else inp = `<input class="form-control" id="${id}" type="${f.t || 'text'}" value="${esc(String(val).slice(0, f.t === 'date' ? 10 : 300))}" placeholder="${esc(f.ph || '')}" ${f.pola ? `pattern="${f.pola}"` : ''} ${req}>`;
  return `<div style="grid-column:span ${f.lebar || 1}"><label class="form-label" for="${id}">${esc(f.l)}${f.req ? ' <span class="text-err">*</span>' : ''}</label>${inp}${f.bantu ? `<div class="form-text">${esc(f.bantu)}</div>` : ''}</div>`;
}
INP.fmtRp = el => formatInputRp(el);
function bukaFormMaster(entitas, rec, tambahan = '') {
  rec = rec || {};
  bukaModal({
    judul: (rec.ID ? 'Ubah ' : 'Tambah ') + { Siswa: 'Data Siswa', Jurusan: 'Jurusan', TahunAjaran: 'Tahun Ajaran', Kelas: 'Kelas', TarifSPP: 'Tarif SPP' }[entitas], ukuran: entitas === 'Siswa' ? 'lg' : '',
    isi: `<form id="fmMaster" novalidate><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem">${FORM[entitas].map(f => bidang(f, rec[f.k])).join('')}</div>${tambahan}<div class="invalid-msg mt-2" id="fmPesan"></div></form>`,
    kaki: `<button class="btn btn-soft" data-bs-dismiss="modal">Batal</button><button class="btn btn-primary" data-act="fmSimpan" data-e="${entitas}" data-id="${esc(rec.ID || '')}"><i class="bi bi-check2"></i> Simpan</button>`
  });
}
ACT.fmSimpan = async btn => {
  const ent = btn.dataset.e, id = btn.dataset.id, data = id ? { ID: id } : {}, msg = $('#fmPesan');
  let salah = '';
  FORM[ent].forEach(f => {
    const el = $('#fm_' + f.k); el.classList.remove('is-invalid');
    let v = f.t === 'aktif' ? (el.checked ? 'Y' : 'N') : f.t === 'rp' ? angka(el.value) : el.value.trim();
    if (f.req && (v === '' || v === 0)) { el.classList.add('is-invalid'); salah = salah || f.l + ' wajib diisi.'; }
    if (f.pola && v && !new RegExp(f.pola).test(v)) { el.classList.add('is-invalid'); salah = salah || f.l + ' tidak sesuai format.'; }
    if (f.t === 'email' && v && !emailValid(v)) { el.classList.add('is-invalid'); salah = salah || 'Email tidak valid.'; }
    if (f.t === 'tel' && v && !hpValid(v)) { el.classList.add('is-invalid'); salah = salah || 'Nomor HP tidak valid (contoh 081234567890).'; }
    data[f.k] = v;
  });
  if (ent === 'Siswa' && data.NIS && S.db.siswa.some(s => String(s.NIS) === data.NIS && s.ID !== id)) { $('#fm_NIS').classList.add('is-invalid'); salah = 'NIS ' + data.NIS + ' sudah terdaftar. NIS tidak boleh ganda.'; }
  if (salah) { msg.textContent = salah; return; }
  const opsiSv = ent === 'Siswa' && !id ? { buatTagihan: !!($('#fmTagihan') && $('#fmTagihan').checked) } : {};
  // Optimistis: tutup form & tampilkan perubahan seketika, lalu sinkron
  const kunciDb = TABEL_DB[ent], lama = id ? Object.assign({}, S.db[kunciDb].find(r => r.ID === id)) : null;
  const sementara = Object.assign({}, lama || {}, data, { ID: id || 'tmp-' + acak(6) });
  if (ent === 'Siswa') { const k = S.idx.kelas.get(data.KelasID); if (k) sementara.JurusanID = k.JurusanID; if (!sementara.Status) sementara.Status = 'AKTIF'; if (!sementara.Kategori) sementara.Kategori = 'REGULER'; }
  if (id) Object.assign(S.db[kunciDb].find(r => r.ID === id), sementara); else S.db[kunciDb].push(sementara);
  bangunIndeks(); tutupModal(); rerenderHalaman();
  toast('Menyimpan ' + (data.Nama || data.Kode || data.Nama || '') + '…', 'info', '', 2000);
  try {
    const r = await api('simpanMaster', ent, data, opsiSv);
    const resmi = keObj(ent, r.row), arr = S.db[kunciDb], i = arr.findIndex(x => x.ID === sementara.ID);
    if (i >= 0) arr[i] = resmi; else arr.push(resmi);
    if (ent === 'TahunAjaran' && aktif(resmi.Aktif)) { arr.forEach(t => { if (t.ID !== resmi.ID) t.Aktif = 'N'; }); S.set.TA_AKTIF = resmi.ID; }
    bangunIndeks();
    toast('Data tersimpan.' + (r.tagihan ? ' ' + r.tagihan.dibuat + ' tagihan dibuat.' : ''), 'ok');
    if (r.tagihan || ent === 'TahunAjaran') await muatUlang(true); else rerenderHalaman();
  } catch (e) {
    const arr = S.db[kunciDb], i = arr.findIndex(x => x.ID === sementara.ID);
    if (lama && i >= 0) arr[i] = lama; else if (i >= 0) arr.splice(i, 1);
    bangunIndeks(); rerenderHalaman();
    toast(e.message, 'err', 'Gagal menyimpan — perubahan dibatalkan');
    bukaFormMaster(ent, Object.assign({}, data, { ID: id || '' }));
  }
};
ACT.formSiswa = el => {
  const s = el.dataset && el.dataset.id ? S.idx.siswa.get(el.dataset.id) : null;
  bukaFormMaster('Siswa', s, s ? '' : `<div class="form-check mt-3"><input class="form-check-input" type="checkbox" id="fmTagihan" checked><label class="form-check-label" for="fmTagihan">Buat tagihan TA ${esc(taAktif().Nama || '')} mulai bulan ini (${bulanLabel(periodeKini())})</label></div>`);
};

// ── Tagihan & Tunggakan (matriks) ──
const defaultTg = () => ({ ta: '', q: '', jur: '', kelas: '', st: '', urut: 'sisa', page: 1 });
S.ui.tg = defaultTg();
HAL.tagihan = {
  judul: 'Tagihan & Tunggakan',
  render() {
    const u = S.ui.tg; if (!u.ta) u.ta = taAktif().ID;
    const ta = S.idx.ta.get(u.ta) || taAktif(), pers = periodeTA(ta), today = hariIni();
    $('#tgAksi').innerHTML = `<button class="btn btn-outline-primary" data-act="tgEkspor"><i class="bi bi-file-earmark-spreadsheet"></i> Ekspor Matriks</button>` + (isOpr() ? `<button class="btn btn-primary" data-act="tgGenerate"><i class="bi bi-calendar-plus"></i> Buat Tagihan Periode</button>` : '');
    // KPI dari seluruh tagihan TA terpilih
    let tag = 0, ter = 0, tah = 0, sis = 0;
    S.db.siswa.forEach(s => (S.db.tg[s.ID] || []).forEach(t => { if (t[5] !== ta.ID || t[4] >= today) return; tag += t[1]; ter += Math.min(t[1], t[2]); tah += t[3]; sis += Math.max(0, t[1] - t[2]); }));
    $('#tgKpi').innerHTML = kpi({ label: 'Tagihan Jatuh Tempo (TA)', ikon: 'file-earmark-text', nilai: `<small>Rp</small> ${ribu(tag)}`, sub: 'TA ' + esc(ta.Nama || '') + ' s/d hari ini' }) +
      kpi({ label: 'Diterima (Terverifikasi)', ikon: 'check2-circle', tone: 'ok', nilai: `<small>Rp</small> ${ribu(ter)}`, sub: `<b class="text-ok">${pctL(ter, tag)}</b> realisasi` }) +
      kpi({ label: 'Sisa Tunggakan', ikon: 'exclamation-diamond', tone: 'err', aksen: 'err', nilai: `<span class="text-err"><small>Rp</small> ${ribu(sis)}</span>`, sub: 'Belum termasuk transfer menunggu verifikasi' }) +
      kpi({ label: 'Menunggu Verifikasi', ikon: 'hourglass-split', tone: 'warn', nilai: `<small>Rp</small> ${ribu(tah)}`, sub: `${S.db.pending.length} transfer dalam antrean` });
    $('#tgFilter').innerHTML = `<div class="input-ikon cari"><i class="bi bi-search"></i><input class="form-control" id="tgQ" data-inp="tgQ" value="${esc(u.q)}" placeholder="Cari nama atau NIS…" aria-label="Cari siswa"></div>
      <select class="form-select" data-chg="tgF" data-k="ta" aria-label="Tahun ajaran">${opsi(S.db.ta.map(t => [t.ID, 'TA ' + t.Nama]), u.ta)}</select>
      <select class="form-select" data-chg="tgF" data-k="jur" aria-label="Jurusan">${opsi(S.db.jurusan.map(j => [j.ID, j.Nama]), u.jur, 'Semua jurusan')}</select>
      <select class="form-select" data-chg="tgF" data-k="kelas" aria-label="Kelas">${opsi(S.db.kelas.filter(k => k.TAID === ta.ID && (!u.jur || k.JurusanID === u.jur)).map(k => [k.ID, k.Nama]), u.kelas, 'Semua kelas')}</select>
      <select class="form-select" data-chg="tgF" data-k="st" aria-label="Status">${opsi([['MENUNGGAK', 'Menunggak'], ['KRITIS', 'Kritis ≥ 2 bulan'], ['SEBAGIAN', 'Sebagian'], ['LUNAS', 'Lunas'], ['TERTAHAN', 'Ada transfer menunggu']], u.st, 'Semua status')}</select>
      <select class="form-select" data-chg="tgF" data-k="urut" aria-label="Urutkan">${opsi([['sisa', 'Tunggakan terbesar'], ['nama', 'Nama A–Z'], ['kelas', 'Kelas']], u.urut)}</select>`;
    renderTgTabel(ta, pers);
  }
};
function renderTgTabel(ta, pers) {
  const u = S.ui.tg, q = u.q.toLowerCase().trim(), size = 30;
  ta = ta || S.idx.ta.get(u.ta) || taAktif(); pers = pers || periodeTA(ta);
  let rows = S.db.siswa.filter(s => (s.Status === 'AKTIF' || statSiswa(s.ID).sisaDue > 0) && (!u.jur || s.JurusanID === u.jur) && (!u.kelas || s.KelasID === u.kelas) && (!q || (s.NIS + ' ' + s.Nama).toLowerCase().includes(q)));
  rows = rows.filter(s => { const x = statSiswa(s.ID); return !u.st || (u.st === 'KRITIS' ? x.nTunggak >= 2 : u.st === 'TERTAHAN' ? x.tertahan > 0 : u.st === 'MENUNGGAK' ? x.nTunggak > 0 : x.status === u.st); });
  urutkan(rows, { sisa: s => -statSiswa(s.ID).sisaDue, nama: s => s.Nama.toLowerCase(), kelas: s => namaKelas(s.KelasID) + s.Nama }[u.urut] || (s => s.Nama));
  const n = rows.length; u.page = Math.min(u.page, Math.max(1, Math.ceil(n / size)));
  $('#tgInfo').textContent = n + ' siswa • ' + pers.length + ' periode';
  const sel = (s, t) => {
    if (!t) return `<span class="mx-sel datang" title="Tidak ada tagihan">–</span>`;
    const st = statusBulan(t), sisa = t[1] - t[2];
    const k = { LUNAS: ['lunas', '✓'], TERTAHAN: ['tahan', '⧗'], MENUNGGAK: [t[2] > 0 ? 'tunggak' : 'tunggak', t[2] > 0 ? '½' : '!'], SEBAGIAN: ['sebagian', '½'], BERJALAN: ['belum', '○'], MENDATANG: ['belum datang', '·'] }[st];
    return `<span class="mx-sel ${k[0]}" data-act="tgSel" data-id="${s.ID}" data-p="${t[0]}" title="${bulanLabel(t[0])}: ${CHIP_BULAN[st][0]} • tagihan ${rp(t[1])}${t[2] ? ' • terbayar ' + rp(t[2]) : ''}${sisa > 0 ? ' • sisa ' + rp(sisa) : ''}${t[3] ? ' • menunggu ' + rp(t[3]) : ''}" role="button" tabindex="0">${k[1]}</span>`;
  };
  $('#tgTabel').innerHTML = `<div class="tbl-scroll"><table class="tbl"><thead><tr><th style="position:sticky;left:0;z-index:2;min-width:220px">Siswa</th><th>Kelas</th><th><div class="mx-head">${pers.map(p => `<span title="${bulanLabel(p)}">${BLN3[Number(p.slice(5)) - 1].slice(0, 3)}</span>`).join('')}</div></th><th class="r">Tunggakan lama</th><th class="r">Sisa jatuh tempo</th><th></th></tr></thead>
    <tbody>${rows.slice((u.page - 1) * size, u.page * size).map(s => { const tg = S.db.tg[s.ID] || [], x = statSiswa(s.ID); const lama = tg.filter(t => t[5] !== ta.ID && t[1] - t[2] > 0).reduce((a, t) => a + t[1] - t[2], 0); return `<tr>
      <td style="position:sticky;left:0;z-index:1"><div class="sel-utama" role="button" data-act="detailSiswa" data-id="${s.ID}">${esc(s.Nama)}</div><div class="sel-sub num">${esc(s.NIS)}</div></td>
      <td style="white-space:nowrap" class="text-2">${esc(namaKelas(s.KelasID))}</td>
      <td><div class="mx">${pers.map(p => sel(s, tg.find(t => t[0] === p))).join('')}</div></td>
      <td class="r num">${lama ? `<span class="text-warn" title="Tunggakan dari tahun ajaran sebelumnya / saldo awal">${rp(lama)}</span>` : '<span class="text-mut">–</span>'}</td>
      <td class="r num"><b class="${x.sisaDue ? 'text-err' : 'text-ok'}">${rp(x.sisaDue)}</b><div class="sel-sub">${x.nTunggak ? x.nTunggak + ' bulan' : 'Lunas'}</div></td>
      <td class="r" style="white-space:nowrap">${isKasir() && x.sisaDue ? `<button class="btn btn-ghost btn-sm btn-icon" data-act="tagihSiswa" data-id="${s.ID}" title="Kirim pengingat" aria-label="Kirim pengingat"><i class="bi bi-send"></i></button>` : ''}${isKasir() && s.Status === 'AKTIF' ? `<button class="btn btn-outline-primary btn-sm" data-act="bayarSiswa" data-id="${s.ID}">Bayar</button>` : `<button class="btn btn-ghost btn-sm" data-act="detailSiswa" data-id="${s.ID}">Detail</button>`}</td></tr>`; }).join('') || `<tr><td colspan="6">${kosong('Tidak ada data pada filter ini.', 'search')}</td></tr>`}</tbody></table></div>
    <div class="tbl-foot"><span>Total sisa (hasil filter): <b class="num text-err">${rp(rows.reduce((a, s) => a + statSiswa(s.ID).sisaDue, 0))}</b></span>${pager('tgHal', u.page, n, size)}</div>`;
}
INP.tgQ = debounce(el => { S.ui.tg.q = el.value; S.ui.tg.page = 1; renderTgTabel(); }, 150);
CHG.tgF = el => { S.ui.tg[el.dataset.k] = el.value; if (el.dataset.k === 'jur' || el.dataset.k === 'ta') S.ui.tg.kelas = ''; S.ui.tg.page = 1; HAL.tagihan.render(); };
ACT.tgHal = el => { S.ui.tg.page = Number(el.dataset.page); renderTgTabel(); };
ACT.tgSel = el => { if (isKasir()) go('bayar', { sid: el.dataset.id, periode: el.dataset.p }); else detailSiswa(el.dataset.id); };
ACT.tgEkspor = () => {
  const u = S.ui.tg, ta = S.idx.ta.get(u.ta) || taAktif(), pers = periodeTA(ta);
  const rows = S.db.siswa.filter(s => (!u.jur || s.JurusanID === u.jur) && (!u.kelas || s.KelasID === u.kelas));
  eksporXlsx('Matriks_Tagihan_' + String(ta.Nama).replace('/', '-') + '.xlsx', [{ nama: 'Matriks', rows: [['NIS', 'Nama', 'Kelas', 'Jurusan'].concat(pers.map(bulanPendek), ['Sisa jatuh tempo', 'Bulan menunggak'])].concat(rows.map(s => { const tg = S.db.tg[s.ID] || [], x = statSiswa(s.ID); return [s.NIS, s.Nama, namaKelas(s.KelasID), namaJurusan(s.JurusanID)].concat(pers.map(p => { const t = tg.find(y => y[0] === p); return t ? (t[1] - t[2] <= 0 ? 'LUNAS' : CHIP_BULAN[statusBulan(t)][0] + ' (sisa ' + (t[1] - t[2]) + ')') : '-'; }), [x.sisaDue, x.nTunggak]); })) }]);
};
ACT.tgGenerate = () => {
  const ta = taAktif(), pers = periodeTA(ta);
  bukaModal({
    judul: 'Buat Tagihan Periode', ukuran: 'md',
    isi: `<p class="text-2">Tagihan dibuat per siswa aktif per bulan berdasarkan tarif jurusan & tingkat. Kombinasi siswa+periode yang sudah ada <b>dilewati</b> (tidak pernah ganda).</p>
      <div class="mb-3"><label class="form-label" for="gtTa">Tahun ajaran</label><select class="form-select" id="gtTa" data-chg="gtHitung">${opsi(S.db.ta.map(t => [t.ID, t.Nama]), ta.ID)}</select></div>
      <div class="grid-2s" style="gap:1rem"><div><label class="form-label" for="gtDari">Dari periode</label><select class="form-select" id="gtDari" data-chg="gtHitung">${opsi(pers.map(p => [p, bulanLabel(p)]), pers.includes(periodeKini()) ? periodeKini() : pers[0])}</select></div><div><label class="form-label" for="gtSampai">Sampai periode</label><select class="form-select" id="gtSampai" data-chg="gtHitung">${opsi(pers.map(p => [p, bulanLabel(p)]), pers[pers.length - 1])}</select></div></div>
      <div id="gtPrev" class="mt-3"></div>`,
    kaki: `<button class="btn btn-soft" data-bs-dismiss="modal">Batal</button><button class="btn btn-primary" data-act="gtBuat"><i class="bi bi-calendar-plus"></i> Buat Tagihan</button>`,
    onBuka: () => CHG.gtHitung()
  });
};
CHG.gtHitung = () => {
  const taId = $('#gtTa').value, ta = S.idx.ta.get(taId), pers = periodeTA(ta);
  if (document.activeElement && document.activeElement.id === 'gtTa') { $('#gtDari').innerHTML = opsi(pers.map(p => [p, bulanLabel(p)]), pers[0]); $('#gtSampai').innerHTML = opsi(pers.map(p => [p, bulanLabel(p)]), pers[pers.length - 1]); }
  const dari = $('#gtDari').value, sampai = $('#gtSampai').value, rentang = pers.filter(p => p >= dari && p <= sampai);
  let baru = 0, ada = 0, tanpa = 0, nSiswa = 0;
  S.db.siswa.filter(s => s.Status === 'AKTIF').forEach(s => {
    const k = S.idx.kelas.get(s.KelasID); if (!k || k.TAID !== taId) return;
    const tarif = S.db.tarif.find(t => t.TAID === taId && t.JurusanID === k.JurusanID && t.Tingkat === k.Tingkat && aktif(t.Aktif));
    if (!tarif) { tanpa++; return; }
    let b = 0; rentang.forEach(p => { if ((S.db.tg[s.ID] || []).some(t => t[0] === p)) ada++; else b++; }); if (b) nSiswa++; baru += b;
  });
  $('#gtPrev').innerHTML = peringatan(`Akan membuat <b>${baru}</b> tagihan untuk <b>${nSiswa}</b> siswa (${rentang.length} bulan). <b>${ada}</b> sudah ada & dilewati.${tanpa ? ` <span class="text-err">${tanpa} siswa belum memiliki tarif</span> — atur di Tarif SPP.` : ''}`, baru ? 'info' : 'warn', 'calculator');
};
ACT.gtBuat = async btn => {
  sibuk(btn, true, 'Membuat tagihan…');
  try { const r = await api('buatTagihan', { taId: $('#gtTa').value, dari: $('#gtDari').value, sampai: $('#gtSampai').value }); tutupModal(); toast(`${r.dibuat} tagihan dibuat, ${r.dilewati} dilewati (sudah ada)${r.tanpaTarif ? ', ' + r.tanpaTarif + ' siswa tanpa tarif' : ''}.`, 'ok'); await muatUlang(true); }
  catch (e) { toast(e.message, 'err'); } finally { sibuk(btn, false); }
};
