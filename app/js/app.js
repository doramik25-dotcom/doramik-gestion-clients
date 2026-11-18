/* DORAMIK GESTION CLIENTS — démarrage, barre latérale, barre supérieure, recherche globale */
(function () {
  'use strict';
  const { esc, t, icon } = App;

  const NAV = [
    { id: 'dashboard', ic: 'layout-dashboard', href: '#/dashboard' },
    { id: 'clients', ic: 'users', href: '#/clients', match: /^\/(clients|client)/ },
    { id: 'fees', ic: 'briefcase', href: '#/honoraires' },
    { id: 'dues', ic: 'calendar-clock', href: '#/echeances' },
    { id: 'payments', ic: 'wallet', href: '#/paiements' },
    { id: 'recovery', ic: 'hand-coins', href: '#/recouvrement', badge: true },
    { id: 'ca', ic: 'chart-column', href: '#/ca' },
    { id: 'calendar', ic: 'calendar-days', href: '#/calendrier' },
    { id: 'reports', ic: 'file-text', href: '#/rapports', match: /^\/rapport/ },
    'sep',
    { id: 'history', ic: 'history', href: '#/historique' },
    { id: 'settings', ic: 'settings', href: '#/parametres' },
    { id: 'backup', ic: 'database-backup', href: '#/sauvegarde' },
  ];

  App.renderNav = () => {
    const path = App.current.path || '';
    const el = document.getElementById('sidebar');
    el.innerHTML = `<div class="brand"><img src="assets/logo.png" alt=""><div><div class="bn">DORAMIK</div><div class="bs">${esc(t('app.subtitle'))}</div></div></div>
      <nav class="nav">${NAV.map((n) => {
        if (n === 'sep') return '<div class="sep"></div>';
        const active = n.match ? n.match.test(path) : path === n.href.slice(1);
        const badge = n.badge && App.state.lateCount ? `<span class="badge-count">${App.state.lateCount}</span>` : '';
        return `<a href="${n.href}" title="${esc(t('nav.' + n.id))}" class="${active ? 'active' : ''}">${icon(n.ic)}<span>${esc(t('nav.' + n.id))}</span>${badge}</a>`;
      }).join('')}</nav>
      <div class="side-foot">DORAMIK GESTION CLIENTS<br>${esc(t('app.version'))} ${esc(App.state.info.version || '')}</div>`;
  };

  function renderTopbar() {
    const el = document.getElementById('topbar');
    el.innerHTML = `<div class="search-box">${icon('search')}<input id="gsearch" placeholder="${esc(t('search.placeholder'))}" autocomplete="off">
        <div class="search-results hidden" id="gresults"></div></div>
      <div class="spacer"></div>
      <button class="gd-pill hidden" id="gdpill" type="button"></button>
      <label class="year-select">${esc(t('common.exercice'))}<select class="input" id="gyear">${App.yearsOptions(App.state.year)}</select></label>
      <div class="lang-switch" role="group" aria-label="Langue / اللغة">
        <button data-lang="fr" class="${App.state.lang === 'fr' ? 'on' : ''}">Français</button>
        <button data-lang="ar" class="${App.state.lang === 'ar' ? 'on' : ''}">العربية</button>
      </div>`;
    el.querySelector('#gyear').addEventListener('change', (e) => {
      App.state.year = Number(e.target.value);
      App.api('settings.set', { current_year: App.state.year }).catch(() => {});
      App.refresh();
    });
    el.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => App.setLang(b.dataset.lang)));
    bindSearch();
    if (App.gd) App.gd.drawPill();
  }
  App.renderTopbar = renderTopbar;

  function bindSearch() {
    const input = document.getElementById('gsearch');
    const box = document.getElementById('gresults');
    let items = [];
    let sel = -1;
    const draw = (r) => {
      items = [];
      let html = '';
      if (r.clients.length) {
        html += `<div class="grp">${t('search.clients')}</div>`;
        r.clients.forEach((c) => {
          items.push('#/client/' + c.id);
          html += `<div class="it" data-i="${items.length - 1}">${icon(c.status === 'ACTIVE' ? 'building-2' : 'user-x')}<div class="grow"><div class="t">${esc(c.name)} ${c.status === 'INACTIVE' ? App.badge('INACTIVE') : ''}</div>
            <div class="s ltr">${esc([c.code, c.legal_form, c.ice && 'ICE ' + c.ice, c.if_code && 'IF ' + c.if_code, c.rc && 'RC ' + c.rc, c.phone].filter(Boolean).join(' · '))}</div></div></div>`;
        });
      }
      if (r.services.length) {
        html += `<div class="grp">${t('search.services')}</div>`;
        r.services.forEach((s) => {
          items.push('#/client/' + s.client_id);
          html += `<div class="it" data-i="${items.length - 1}">${icon('briefcase')}<div class="grow"><div class="t">${esc(App.isAr() && s.service_ar ? s.service_ar : s.service)}</div><div class="s">${esc(s.client)}</div></div></div>`;
        });
      }
      if (r.payments.length) {
        html += `<div class="grp">${t('search.payments')}</div>`;
        r.payments.forEach((p) => {
          items.push('#/client/' + p.client_id + '?tab=payments');
          html += `<div class="it" data-i="${items.length - 1}">${icon('receipt')}<div class="grow"><div class="t">${esc(p.client)} — ${App.money(p.amount)}</div><div class="s ltr">${App.dateText(p.pay_date)} · ${esc([p.cheque_no, p.transfer_ref, p.reference].filter(Boolean).join(' · '))}${p.voided ? ' · ' + t('pay.voided') : ''}</div></div></div>`;
        });
      }
      if (!items.length) html = `<div class="notif-empty">${t('common.noResult')}</div>`;
      box.innerHTML = html;
      box.classList.remove('hidden');
      sel = -1;
    };
    const run = App.debounce(async () => {
      const q = input.value.trim();
      if (!q) { box.classList.add('hidden'); return; }
      try { draw(await App.api('search', q)); } catch (e) { /* */ }
    }, 180);
    const highlight = () => box.querySelectorAll('.it').forEach((el, i) => el.classList.toggle('sel', i === sel));
    input.addEventListener('input', run);
    input.addEventListener('focus', () => { if (input.value.trim()) run(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); highlight(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); highlight(); e.preventDefault(); }
      else if (e.key === 'Enter') { const h = items[sel >= 0 ? sel : 0]; if (h) { App.go(h); box.classList.add('hidden'); input.blur(); } }
      else if (e.key === 'Escape') { box.classList.add('hidden'); input.blur(); }
    });
    box.addEventListener('mousedown', (e) => {
      const it = e.target.closest('[data-i]');
      if (!it) return;
      e.preventDefault();
      App.go(items[Number(it.dataset.i)]);
      box.classList.add('hidden');
      input.blur();
    });
    input.addEventListener('blur', () => setTimeout(() => box.classList.add('hidden'), 150));
  }

  App.applyLang = () => {
    const ar = App.state.lang === 'ar';
    document.documentElement.lang = ar ? 'ar' : 'fr';
    document.documentElement.dir = ar ? 'rtl' : 'ltr';
    document.title = ar ? 'دوراميك — تدبير الزبناء' : 'DORAMIK GESTION CLIENTS';
  };

  /** Changement de langue : l'interface est reconstruite, les données ne sont pas modifiées. */
  App.setLang = async (lang) => {
    if (lang === App.state.lang) return;
    App.state.lang = lang;
    try { await App.api('settings.set', { lang }); } catch (e) { /* */ }
    App.applyLang();
    renderTopbar();
    App.render();
  };

  App.updateBadges = async () => {
    try {
      const r = await App.api('dues.list', { status: 'LATE' });
      App.state.lateCount = new Set(r.map((d) => d.client_id)).size;
    } catch (e) { App.state.lateCount = 0; }
  };

  // ------------------------------------------------------------ routes
  App.route('/dashboard', 'dashboard');
  App.route('/clients', 'clients');
  App.route('/client/:id', 'client');
  App.route('/honoraires', 'honoraires');
  App.route('/echeances', 'dues');
  App.route('/paiements', 'payments');
  App.route('/recouvrement', 'recovery');
  App.route('/ca', 'ca');
  App.route('/calendrier', 'calendar');
  App.route('/rapports', 'reports');
  App.route('/rapport/:id', 'report');
  App.route('/historique', 'history');
  App.route('/parametres', 'settings');
  App.route('/sauvegarde', 'backup');

  async function boot() {
    document.addEventListener('submit', (e) => e.preventDefault());
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); const s = document.getElementById('gsearch'); if (s) s.focus(); }
    });
    try {
      App.state.info = await window.doramik.info();
      const b = await App.refreshLookups();
      App.state.lang = b.settings.lang === 'ar' ? 'ar' : 'fr';
      const years = b.years.map((y) => y.year);
      const cur = Number(b.settings.current_year);
      const thisYear = new Date().getFullYear();
      App.state.year = years.includes(cur) ? cur : (years.includes(thisYear) ? thisYear : years[0]);
      App.applyLang();
      await App.loadClientCache();
      await App.updateBadges();
      renderTopbar();
      window.addEventListener('hashchange', async () => {
        await App.updateBadges();
        App.render();
      });
      App.render();
      // Google Drive : état, comparaison avec Drive au démarrage (jamais bloquant)
      if (App.gd) App.gd.init();
    } catch (e) {
      console.error(e);
      document.getElementById('content').innerHTML = `<div class="notice err">${esc(App.errorText(e))}</div>`;
    }
  }
  const baseRefresh = App.refresh;
  App.refresh = async () => {
    await App.refreshLookups().catch(() => {});
    await App.loadClientCache().catch(() => {});
    await App.updateBadges();
    App._keepScroll = true;
    return baseRefresh();
  };

  boot();
})();
