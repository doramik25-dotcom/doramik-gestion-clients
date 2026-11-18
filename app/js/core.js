/* DORAMIK GESTION CLIENTS — noyau de l'interface (utilitaires, i18n, API, fenêtres, routeur) */
(function () {
  'use strict';
  const App = (window.App = {
    // clientId : client courant, conservé d'un module à l'autre et après chaque opération
    state: { lang: 'fr', year: null, settings: {}, lookups: {}, info: {}, clientId: null, clientTab: '', clientYear: '' },
    views: {},
    routes: [],
  });

  // ------------------------------------------------------------ chaînes & formats
  App.esc = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const esc = App.esc;

  App.t = function (key, params) {
    const d = window.I18N[App.state.lang] || window.I18N.fr;
    let s = d[key];
    if (s === undefined) s = window.I18N.fr[key];
    if (s === undefined) {
      if (window.__DORAMIK_DEBUG__) console.warn('i18n missing', key);
      s = key;
    }
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
    return s;
  };
  const t = App.t;
  App.isAr = () => App.state.lang === 'ar';
  App.icon = (n) => (window.ICONS && window.ICONS[n]) || '';
  const icon = App.icon;

  /** Nom localisé d'un objet de référence (name / name_ar). */
  App.nm = (o, field = 'name') => {
    if (!o) return '';
    if (App.isAr() && o[field + '_ar']) return o[field + '_ar'];
    return o[field] || '';
  };

  App.fmtNumber = (cents) => {
    const n = Math.round(Number(cents) || 0);
    const neg = n < 0;
    const abs = Math.abs(n);
    const int = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (neg ? '-' : '') + int + ',' + String(abs % 100).padStart(2, '0');
  };
  App.money = (cents, cur = true) => {
    const s = App.fmtNumber(cents);
    return cur ? `<span class="money"><span class="ltr">${s}</span>\u00a0${t('currency')}</span>` : `<span class="money ltr">${s}</span>`;
  };
  App.moneyText = (cents) => App.fmtNumber(cents) + ' ' + t('currency');
  /** Analyse un montant saisi ("1 200,50", "1200.5") → centimes (entier) ou NaN. */
  App.parseMoney = (v) => {
    let s = String(v === null || v === undefined ? '' : v).trim().replace(/[\s  ]/g, '').replace(/(DH|MAD|درهم)$/i, '');
    if (s === '') return NaN;
    if (/,/.test(s) && /\./.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    if (!/^\d+(\.\d{0,2})?$/.test(s)) return NaN;
    return Math.round(parseFloat(s) * 100);
  };
  App.moneyInput = (cents) => (cents === null || cents === undefined || cents === '' ? '' : (Number(cents) / 100).toFixed(2).replace('.', ','));

  App.date = (s) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? `<span class="ltr">${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}</span>` : '');
  App.dateText = (s) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  App.dateTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  App.today = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  };
  App.addDays = (s, n) => {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return dt.toISOString().slice(0, 10);
  };
  App.monthName = (m) => t('month.' + m);

  /** Libellé de période d'une échéance. */
  App.periodLabel = (d) => {
    if (!d) return '';
    if (d.kind === 'ONE_OFF' || !d.period_key) return d.label || t('period.oneoff');
    const k = d.period_key;
    const y = d.year;
    if (k[0] === 'M') return `${App.monthName(Number(k.slice(1)))} ${y}`;
    if (k === 'A') return t('period.A', { y });
    return t('period.' + k[0], { n: k.slice(1), y });
  };
  /** Texte lisible d'une règle de dépôt : « fin de période » ou « 1 mois après, le 20 ». */
  App.filingRuleText = (o) => {
    const m = Number(o.filing_months) || 0;
    const d = Number(o.filing_day) || 0;
    if (!m && !d) return t('filing.same');
    const base = m ? t('filing.after', { n: m }) : t('filing.same');
    return base + ' · ' + (d ? t('filing.day', { n: d }) : t('filing.lastDay'));
  };
  App.serviceName = (d) => (App.isAr() && d.service_ar ? d.service_ar : d.service || '');

  const STATUS_TONE = { PAID: 'green', PARTIAL: 'orange', UNPAID: 'gray', LATE: 'red', UPCOMING: 'blue', DUE: 'yellow', NO_DUE: 'gray', ACTIVE: 'green', INACTIVE: 'gray' };
  App.statusTone = (s) => STATUS_TONE[s] || 'gray';
  App.badge = (status, text) => `<span class="badge b-${App.statusTone(status)}">${esc(text || t('status.' + status))}</span>`;
  /** Badge complet d'une échéance : statut de paiement + précision sur l'échéance des honoraires. */
  App.dueBadge = (d) => {
    let html = App.badge(d.status === 'LATE' ? 'LATE' : d.pay_state);
    if (d.status === 'PAID') return html;
    if (d.timing === 'NO_DUE') html += ` <span class="badge b-gray" title="${esc(t('statusRule.NO_DUE'))}">${esc(t('timing.NO_DUE'))}</span>`;
    else if (d.timing === 'DUE') html += ' ' + App.badge('DUE', t('timing.DUE'));
    else if (d.timing === 'UPCOMING') html += ' ' + App.badge('UPCOMING', t('timing.UPCOMING'));
    else if (d.timing === 'LATE' && d.paid > 0) html += ' ' + App.badge('PARTIAL');
    return html;
  };

  App.name = (o) => esc(o && o.name);
  App.initials = (s) => String(s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  // ------------------------------------------------------------ API & erreurs
  App.errorText = (e) => {
    const code = e && e.code;
    if (code && window.I18N.fr['err.' + code] !== undefined) {
      const p = Object.assign({}, e.params || {});
      if (p.field) p.field = t('field.' + p.field);
      if (p.rest !== undefined) p.rest = App.moneyText(p.rest);
      if (p.paid !== undefined) p.paid = App.moneyText(p.paid);
      if (p.excess !== undefined) p.excess = App.moneyText(p.excess);
      return t('err.' + code, p);
    }
    return t('err.UNEXPECTED') + (e && e.message ? ' (' + e.message + ')' : '');
  };

  App.api = async (method, ...args) => {
    try {
      return await window.doramik.call(method, ...args);
    } catch (e) {
      e.handled = false;
      throw e;
    }
  };

  /**
   * Appel protégé : affiche l'erreur ; en cas de doublon probable, demande confirmation
   * puis relance avec force=true.
   */
  App.safe = async (fn, { dupRetry = null } = {}) => {
    try {
      return await fn(false);
    } catch (e) {
      if (dupRetry && /^DUPLICATE_/.test(e.code) && e.code !== 'DUPLICATE') {
        const ok = await App.confirm(App.errorText(e) + '\n\n' + t('msg.continueAnyway'), { okLabel: t('btn.continue') });
        if (ok) {
          try { return await fn(true); } catch (e2) { App.toast(App.errorText(e2), 'err'); throw e2; }
        }
        const c = new Error('CANCELLED'); c.code = 'CANCELLED'; c.silent = true; throw c;
      }
      App.toast(App.errorText(e), 'err');
      e.silent = true;
      throw e;
    }
  };

  // ------------------------------------------------------------ toasts
  App.toast = (msg, type = 'ok', ms = 3800) => {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    const ic = type === 'err' ? 'circle-alert' : type === 'warn' ? 'triangle-alert' : 'circle-check-big';
    el.innerHTML = `${icon(ic)}<div>${esc(msg).replace(/\n/g, '<br>')}</div>`;
    root.appendChild(el);
    setTimeout(() => el.remove(), type === 'err' ? ms + 2500 : ms);
  };

  // ------------------------------------------------------------ fenêtres modales
  App.modal = ({ title, body, footer, size = '', onMount, onClose, dismissable = true }) => {
    const root = document.getElementById('modal-root');
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${size}" role="dialog"><div class="modal-h"><h2>${esc(title)}</h2>
      <button class="btn ghost icon" data-close title="${esc(t('btn.close'))}">${icon('x')}</button></div>
      <div class="modal-b">${body || ''}</div>${footer !== null ? `<div class="modal-f">${footer || ''}</div>` : ''}</div>`;
    root.appendChild(back);
    const el = back.querySelector('.modal');
    let closed = false;
    const close = (v) => {
      if (closed) return;
      closed = true;
      back.remove();
      document.removeEventListener('keydown', onKey);
      if (onClose) onClose(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissable && root.lastElementChild === back) close();
    };
    document.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', (e) => { if (e.target === back && dismissable) back.dataset.down = '1'; });
    back.addEventListener('mouseup', (e) => { if (e.target === back && back.dataset.down && dismissable) close(); back.dataset.down = ''; });
    el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => close()));
    const api = { el, close, body: el.querySelector('.modal-b'), foot: el.querySelector('.modal-f') };
    if (onMount) onMount(api);
    const first = el.querySelector('input:not([type=hidden]):not([readonly]), select, textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return api;
  };

  App.confirm = (msg, { title, okLabel, danger = false } = {}) => new Promise((resolve) => {
    let result = false;
    App.modal({
      title: title || t('msg.confirm'),
      size: 'sm',
      body: `<div style="line-height:1.6">${esc(msg).replace(/\n/g, '<br>')}</div>`,
      footer: `<button class="btn" data-close>${t('btn.cancel')}</button><button class="btn ${danger ? 'danger solid' : 'primary'}" data-ok>${esc(okLabel || t('btn.confirm'))}</button>`,
      onMount: (m) => m.el.querySelector('[data-ok]').addEventListener('click', () => { result = true; m.close(); }),
      onClose: () => resolve(result),
    });
  });

  App.prompt = (title, label, { value = '', required = true, multiline = false } = {}) => new Promise((resolve) => {
    let result = null;
    App.modal({
      title,
      size: 'sm',
      body: `<div class="field"><label>${esc(label)}${required ? '<span class="req">*</span>' : ''}</label>
        ${multiline ? `<textarea class="input" data-v>${esc(value)}</textarea>` : `<input class="input" data-v value="${esc(value)}">`}</div>`,
      footer: `<button class="btn" data-close>${t('btn.cancel')}</button><button class="btn primary" data-ok>${t('btn.confirm')}</button>`,
      onMount: (m) => {
        const inp = m.el.querySelector('[data-v]');
        const ok = () => {
          if (required && !inp.value.trim()) { inp.classList.add('invalid'); inp.focus(); return; }
          result = inp.value.trim();
          m.close();
        };
        m.el.querySelector('[data-ok]').addEventListener('click', ok);
        if (!multiline) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
      },
      onClose: () => resolve(result),
    });
  });

  // ------------------------------------------------------------ formulaires
  App.field = (label, input, { required = false, hint = '', full = false, cls = '' } = {}) =>
    `<div class="field ${full ? 'full' : ''} ${cls}"><label>${esc(label)}${required ? '<span class="req">*</span>' : ''}</label>${input}${hint ? `<div class="hint">${esc(hint)}</div>` : ''}</div>`;
  App.options = (items, value, { empty = null, label = (o) => App.nm(o), val = (o) => o.id } = {}) =>
    (empty !== null ? `<option value="">${esc(empty)}</option>` : '') +
    items.map((o) => `<option value="${esc(val(o))}" ${String(val(o)) === String(value) ? 'selected' : ''}>${esc(label(o))}</option>`).join('');
  App.moneyField = (name, cents, attrs = '') =>
    `<div class="input-group"><input class="input money" name="${name}" inputmode="decimal" value="${esc(App.moneyInput(cents))}" ${attrs}><span class="addon">${t('currency')}</span></div>`;
  /** Lit les valeurs d'un formulaire (inputs nommés). */
  App.formData = (root) => {
    const o = {};
    root.querySelectorAll('[name]').forEach((el) => {
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
      else o[el.name] = el.value;
    });
    return o;
  };
  App.markInvalid = (root, name) => {
    const el = root.querySelector(`[name="${name}"]`);
    if (el) { el.classList.add('invalid'); el.focus(); el.addEventListener('input', () => el.classList.remove('invalid'), { once: true }); }
  };

  // ------------------------------------------------------------ données de référence
  App.lk = (name) => App.state.lookups[name] || [];
  App.lkById = (name, id) => App.lk(name).find((x) => String(x.id) === String(id));
  App.refreshLookups = async () => {
    const b = await App.api('bootstrap');
    App.state.settings = b.settings;
    App.state.lookups = { legal_forms: b.legal_forms, categories: b.categories, periodicities: b.periodicities, payment_modes: b.payment_modes, years: b.years, services: b.services };
    App.state.today = b.today;
    return b;
  };
  App.yearsOptions = (value, withAll = false) =>
    (withAll ? `<option value="">${t('common.allYears')}</option>` : '') +
    App.lk('years').map((y) => `<option value="${y.year}" ${String(y.year) === String(value) ? 'selected' : ''}>${y.year}${y.status === 'CLOSED' ? ' (' + t('year.closed') + ')' : ''}</option>`).join('');

  // ------------------------------------------------------------ routeur
  App.route = (pattern, view) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (m, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    App.routes.push({ re, keys, view, pattern });
  };
  App.go = (hash) => {
    if (location.hash === hash) App.render();
    else location.hash = hash;
  };
  App.current = { hash: '', view: null };
  App.render = async () => {
    const hash = (location.hash || '#/dashboard').slice(1);
    const [p, qs] = hash.split('?');
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    const content = document.getElementById('content');
    const keep = App._keepScroll;
    App._keepScroll = false;
    // Vrai quand on réaffiche le même écran après une opération (et non une nouvelle navigation)
    const isRefresh = !!App._refresh;
    App._refresh = false;
    const prevScroll = content.scrollTop;
    for (const r of App.routes) {
      const m = r.re.exec(p);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      App.current = { hash, view: r.view, params, query, path: p, isRefresh };
      App.renderNav();
      // Nouveau conteneur à chaque rendu : les écouteurs de l'ancienne vue disparaissent avec elle
      const view = document.createElement('div');
      view.className = 'view';
      view.innerHTML = `<div class="loading">${t('common.loading')}</div>`;
      content.replaceChildren(view);
      const token = (App._renderToken = (App._renderToken || 0) + 1);
      try {
        await App.views[r.view](view, params, query);
      } catch (e) {
        console.error(e);
        if (token === App._renderToken) view.innerHTML = `<div class="notice err">${icon('circle-alert')}<div>${esc(App.errorText(e))}</div></div>`;
      }
      content.scrollTop = keep ? prevScroll : 0;
      return;
    }
    location.hash = '#/dashboard';
  };
  /**
   * Rafraîchit la vue courante (après une modification) : même écran, même client,
   * même onglet. Ce n'est pas une nouvelle navigation.
   */
  App.refresh = () => { App._refresh = true; return App.render(); };

  // ------------------------------------------------------------ client courant
  /**
   * Mémorise le client sélectionné. Il reste sélectionné après chaque opération
   * (enregistrement, modification, suppression) et d'un module à l'autre, tant que
   * l'utilisateur ne choisit pas lui-même un autre client (ou « tous les clients »).
   */
  App.setCurrentClient = (id) => {
    App.state.clientId = id ? Number(id) : null;
    return App.state.clientId;
  };
  /** Client courant (objet du cache) ou null. */
  App.currentClient = () => (App.state.clientCache || []).find((c) => c.id === App.state.clientId) || null;
  /** Valeur à pré-sélectionner dans un filtre client : valeur explicite, sinon client courant. */
  App.clientFilterValue = (v) => (v !== undefined && v !== null && v !== '' ? v : (App.state.clientId || ''));

  // ------------------------------------------------------------ divers
  App.debounce = (fn, ms = 250) => {
    let h;
    return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
  };
  App.on = (root, evt, selector, handler) => {
    root.addEventListener(evt, (e) => {
      const el = e.target.closest(selector);
      if (el && root.contains(el)) handler(e, el);
    });
  };
  App.sum = (arr, k) => arr.reduce((s, r) => s + (Number(typeof k === 'function' ? k(r) : r[k]) || 0), 0);
})();
