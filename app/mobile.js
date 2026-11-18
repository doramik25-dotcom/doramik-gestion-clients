// Menu tiroir de la version téléphone (bouton ☰, fond sombre, fermeture au choix d'un écran).
(function () {
  var btn = document.createElement('button');
  btn.id = 'menu-btn'; btn.type = 'button'; btn.setAttribute('aria-label', 'Menu'); btn.textContent = '☰';
  var back = document.createElement('div'); back.className = 'nav-backdrop';
  document.body.appendChild(btn); document.body.appendChild(back);
  var set = function (v) { document.body.classList.toggle('nav-open', v); };
  btn.addEventListener('click', function () { set(true); });
  back.addEventListener('click', function () { set(false); });
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.sidebar a')) set(false); });
  window.addEventListener('hashchange', function () { set(false); });
})();
