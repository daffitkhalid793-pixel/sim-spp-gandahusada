// Tema terang/gelap diterapkan sebelum halaman digambar (mencegah kedip)
(function () {
  try {
    var t = JSON.parse(localStorage.getItem('simspp.tema') || 'null');
    if (t !== 'dark' && t !== 'light') t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-bs-theme', t);
  } catch (e) { document.documentElement.setAttribute('data-bs-theme', 'light'); }
})();
