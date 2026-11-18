/* DORAMIK GESTION CLIENTS — Paramètres */
(function () {
  'use strict';
  const { esc, t, icon } = App;

  const MONTHS_CHOICES = [1, 3, 6, 12, 0];
  const KINDS = ['CASH', 'TRANSFER', 'CHEQUE', 'OTHER'];

  /** Formulaire générique d'une liste de référence (forme juridique, catégorie, périodicité, mode de paiement). */
  App.forms.lookup = (table, item = null) => new Promise((resolve) => {
    const o = item || {};
    let ok = false;
    const extra = table === 'periodicities'
      ? App.field(t('field.months'), `<select class="input" name="months">${MONTHS_CHOICES.map((m) => `<option value="${m}" ${Number(o.months) === m ? 'selected' : ''}>${esc(t('months.' + m))}</option>`).join('')}</select>`, { required: true, hint: t('hint.months') })
      : table === 'payment_modes'
        ? App.field(t('field.kind'), `<select class="input" name="kind">${KINDS.map((k) => `<option value="${k}" ${o.kind === k ? 'selected' : ''}>${esc(t('kind.' + k))}</option>`).join('')}</select>`, { required: true, hint: t('hint.kind') })
        : '';
    App.modal({
      title: (o.id ? t('btn.edit') : t('btn.add')) + ' — ' + t('settings.' + table),
      body: `<form class="form-grid">${App.field(t('field.nameFr'), `<input class="input" name="name" value="${esc(o.name || '')}">`, { required: true })}
        ${App.field(t('field.nameAr'), `<input class="input" name="name_ar" dir="rtl" value="${esc(o.name_ar || '')}">`)}${extra}</form>`,
      footer: `<button class="btn" data-close>${t('btn.cancel')}</button><button class="btn primary" data-save>${icon('save')} ${t('btn.save')}</button>`,
      onMount: (m) => m.el.querySelector('[data-save]').addEventListener('click', async () => {
        const form = m.el.querySelector('form');
        const d = App.formData(form);
        if (!d.name.trim()) return App.markInvalid(form, 'name');
        const api = { legal_forms: 'legalForms', categories: 'categories', periodicities: 'periodicities', payment_modes: 'paymentModes' }[table];
        try {
          await App.safe(() => App.api(api + '.save', Object.assign({ id: o.id }, d)));
          await App.refreshLookups();
          App.toast(t('msg.saved'));
          ok = true;
          m.close();
        } catch (e) { /* */ }
      }),
      onClose: () => resolve(ok),
    });
  });

  const TABS = [['cabinet', 'building-2'], ['receipt', 'receipt'], ['services', 'briefcase'], ['categories', 'layers'], ['legal_forms', 'file-text'], ['periodicities', 'calendar-clock'], ['payment_modes', 'wallet'], ['statuses', 'list-checks'], ['years', 'calendar-days'], ['notifications', 'info'], ['language', 'languages']];

  App.views.settings = async (root, params, query) => {
    const st = { tab: query.tab || 'cabinet' };
    root.innerHTML = `<div class="page-head"><div><h1>${t('nav.settings')}</h1><div class="sub">${t('settings.subtitle')}</div></div></div>
      <div class="tabs">${TABS.map(([k, ic]) => `<button data-tab="${k}">${icon(ic)} ${t('settings.' + k)}</button>`).join('')}</div><div data-body></div>`;
    const body = root.querySelector('[data-body]');
    const s = () => App.state.settings;

    const saveSettings = async (vals) => {
      try {
        App.state.settings = await App.safe(() => App.api('settings.set', vals));
        App.toast(t('msg.saved'));
      } catch (e) { /* */ }
    };

    const lookupTab = (table) => {
      const rows = App.lk(table);
      body.innerHTML = `<div class="card"><div class="card-h"><h3>${t('settings.' + table)}</h3><span class="spacer"></span><button class="btn primary sm" data-add>${icon('plus')} ${t('btn.add')}</button></div><div data-t></div></div>`;
      const cols = [{ key: 'name', label: t('field.nameFr'), render: (r) => `<b>${esc(r.name)}</b>` }, { key: 'name_ar', label: t('field.nameAr'), render: (r) => `<span dir="rtl">${esc(r.name_ar || '')}</span>` }];
      if (table === 'periodicities') cols.push({ key: 'months', label: t('field.months'), render: (r) => esc(t('months.' + r.months)) });
      if (table === 'payment_modes') cols.push({ key: 'kind', label: t('field.kind'), render: (r) => esc(t('kind.' + r.kind)) });
      cols.push({ key: 'active', label: t('col.status'), render: (r) => (r.active ? App.badge('ACTIVE') : App.badge('INACTIVE')) });
      cols.push({ key: '', actions: true, render: (r) => `<button class="btn sm" data-act="edit">${icon('pencil')} ${t('btn.edit')}</button><button class="btn sm" data-act="toggle">${r.active ? t('btn.disable') : t('btn.enable')}</button><button class="btn sm icon danger" data-act="del" title="${esc(t('btn.delete'))}">${icon('trash-2')}</button>` });
      new App.Table(body.querySelector('[data-t]'), {
        rows, columns: cols,
        onAction: async (act, r) => {
          const api = { legal_forms: 'legalForms', categories: 'categories', periodicities: 'periodicities', payment_modes: 'paymentModes' }[table];
          if (act === 'edit' && await App.forms.lookup(table, r)) draw();
          if (act === 'toggle') { try { await App.safe(() => App.api(api + '.setActive', r.id, !r.active)); await App.refreshLookups(); draw(); } catch (e) { /* */ } }
          if (act === 'del') {
            if (!await App.confirm(t('msg.confirmDelete', { n: App.nm(r) }), { danger: true, okLabel: t('btn.delete') })) return;
            try {
              await App.api(api + '.remove', r.id);
              App.toast(t('msg.deleted'));
            } catch (e) {
              App.toast(App.errorText(e), 'err');
              if (e.code === 'LOOKUP_IN_USE' && r.active && await App.confirm(t('msg.archiveInstead'), { okLabel: t('btn.archive') })) {
                await App.safe(() => App.api(api + '.setActive', r.id, false));
              }
            }
            await App.refreshLookups();
            draw();
          }
        },
      });
      body.querySelector('[data-add]').addEventListener('click', async () => { if (await App.forms.lookup(table)) draw(); });
    };

    const draw = async () => {
      root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === st.tab));
      const tab = st.tab;
      if (tab === 'cabinet') {
        body.innerHTML = `<div class="card"><div class="card-h"><h3>${t('settings.cabinet')}</h3></div><div class="card-b"><form class="form-grid" data-f>
          ${App.field(t('settings.cabinetName'), `<input class="input" name="cabinet_name" value="${esc(s().cabinet_name || '')}">`, { hint: t('settings.cabinetHint') })}
          ${App.field(t('field.phone'), `<input class="input ltr" name="cabinet_phone" value="${esc(s().cabinet_phone || '')}">`)}
          ${App.field(t('field.address'), `<input class="input" name="cabinet_address" value="${esc(s().cabinet_address || '')}">`, { full: true })}
          ${App.field(t('field.email'), `<input class="input ltr" name="cabinet_email" value="${esc(s().cabinet_email || '')}">`)}
          ${App.field('ICE', `<input class="input ltr" name="cabinet_ice" value="${esc(s().cabinet_ice || '')}">`)}
        </form><div style="margin-top:16px"><button class="btn primary" data-save>${icon('save')} ${t('btn.save')}</button></div></div></div>`;
        body.querySelector('[data-save]').addEventListener('click', () => saveSettings(App.formData(body.querySelector('[data-f]'))));
      } else if (tab === 'receipt') {
        const fmt = ['A4', 'T80', 'T58'];
        body.innerHTML = `<div class="card"><div class="card-h"><h3>${t('settings.receipt')}</h3></div><div class="card-b stack" data-f>
          <div class="muted">${t('settings.receiptHelp')}</div>
          <div class="form-grid">
            ${App.field(t('receipt.format'), `<select class="input" name="receipt_format">${fmt.map((f) => `<option value="${f}" ${s().receipt_format === f ? 'selected' : ''}>${esc(t('receipt.fmt.' + f))} — ${esc(t('receipt.fmtHint.' + f))}</option>`).join('')}</select>`)}
            ${App.field(t('settings.receiptFooter'), `<input class="input" name="receipt_footer" value="${esc(s().receipt_footer || '')}">`, { hint: t('settings.receiptFooterHint') })}
          </div>
          <label class="check"><input type="checkbox" name="receipt_show_app" ${s().receipt_show_app === '1' ? 'checked' : ''}> ${t('receipt.showApp')}</label>
          <label class="check"><input type="checkbox" name="receipt_show_cabinet" ${s().receipt_show_cabinet !== '0' ? 'checked' : ''}> ${t('receipt.showCabinet')}</label>
          <div><button class="btn primary" data-save>${icon('save')} ${t('btn.save')}</button></div></div></div>`;
        body.querySelector('[data-save]').addEventListener('click', () => {
          const d = App.formData(body.querySelector('[data-f]'));
          saveSettings({ receipt_format: d.receipt_format, receipt_footer: d.receipt_footer, receipt_show_app: d.receipt_show_app ? 1 : 0, receipt_show_cabinet: d.receipt_show_cabinet ? 1 : 0 });
        });
      } else if (tab === 'services') {
        body.innerHTML = `<div class="card"><div class="card-b row"><div class="grow">${t('settings.servicesHelp')}</div><a class="btn primary" href="#/honoraires">${icon('briefcase')} ${t('nav.fees')}</a></div></div>`;
      } else if (['categories', 'legal_forms', 'periodicities', 'payment_modes'].includes(tab)) {
        lookupTab(tab);
      } else if (tab === 'statuses') {
        const list = [['PAID', 'status'], ['PARTIAL', 'status'], ['UNPAID', 'status'], ['LATE', 'status'], ['NO_DUE', 'timing'], ['UPCOMING', 'timing'], ['DUE', 'timing'], ['ACTIVE', 'status'], ['INACTIVE', 'status']];
        body.innerHTML = `<div class="card"><div class="card-h"><h3>${t('settings.statuses')}</h3></div><div class="card-b stack">
          <table class="tbl"><thead><tr><th>${t('col.status')}</th><th>${t('settings.statusRule')}</th></tr></thead><tbody>
          ${list.map(([k, p]) => `<tr><td>${App.badge(k, t(p + '.' + k))}</td><td>${esc(t('statusRule.' + k))}</td></tr>`).join('')}</tbody></table>
          <div class="form-grid">${App.field(t('settings.graceDays'), `<div class="input-group"><input class="input" type="number" min="0" name="grace_days" value="${esc(s().grace_days || 0)}"><span class="addon">${t('common.daysShort')}</span></div>`, { hint: t('settings.graceHint') })}</div>
          <div><button class="btn primary" data-save>${icon('save')} ${t('btn.save')}</button></div></div></div>`;
        body.querySelector('[data-save]').addEventListener('click', async () => { await saveSettings({ grace_days: Math.max(0, parseInt(body.querySelector('[name=grace_days]').value, 10) || 0) }); App.updateBadges(); });
      } else if (tab === 'years') {
        await App.refreshLookups();
        const ys = App.lk('years');
        body.innerHTML = `<div class="card"><div class="card-h"><h3>${t('settings.years')}</h3><span class="spacer"></span><button class="btn primary sm" data-open>${icon('plus')} ${t('year.open')}</button></div><div data-t></div>
          <div class="card-b"><div class="notice info">${icon('info')}<div>${t('year.help')}</div></div></div></div>`;
        new App.Table(body.querySelector('[data-t]'), {
          rows: ys,
          columns: [
            { key: 'year', label: t('common.exercice'), render: (y) => `<b>${y.year}</b>${y.year === App.state.year ? ` <span class="badge b-blue">${t('year.current')}</span>` : ''}` },
            { key: 'status', label: t('col.status'), render: (y) => (y.status === 'OPEN' ? App.badge('ACTIVE', t('year.opened')) : App.badge('INACTIVE', t('year.closed'))) },
            { key: 'dues_count', label: t('col.duesCount'), type: 'number' },
            { key: 'total_due', label: t('col.due'), type: 'money' },
            { key: 'total_rest', label: t('col.rest'), type: 'money' },
            { key: '', actions: true, render: (y) => `${y.status === 'OPEN' ? `<button class="btn sm" data-act="gen">${icon('refresh-cw')} ${t('sub.generate')}</button><button class="btn sm" data-act="close">${t('year.close')}</button>` : `<button class="btn sm" data-act="reopen">${t('year.reopen')}</button>`}<button class="btn sm" data-act="use">${t('year.use')}</button>` },
          ],
          onAction: async (act, y) => {
            try {
              if (act === 'gen') { const n = await App.safe(() => App.api('years.generateAll', y.year)); App.toast(t('msg.generated', { n })); }
              if (act === 'close' && await App.confirm(t('year.closeConfirm', { y: y.year }))) await App.safe(() => App.api('years.setStatus', y.year, 'CLOSED'));
              if (act === 'reopen') await App.safe(() => App.api('years.setStatus', y.year, 'OPEN'));
              if (act === 'use') { App.state.year = y.year; await App.api('settings.set', { current_year: y.year }); App.renderTopbar(); }
              await App.refreshLookups();
              App.renderTopbar();
              draw();
            } catch (e) { /* */ }
          },
        });
        body.querySelector('[data-open]').addEventListener('click', () => openYear(draw));
      } else if (tab === 'notifications') {
        const cb = (k, label, tone) => `<label class="check"><input type="checkbox" name="${k}" ${s()[k] !== '0' ? 'checked' : ''}> <i class="dot" style="background:var(--${tone})"></i> ${esc(label)}</label>`;
        body.innerHTML = `<div class="card"><div class="card-h"><h3>${t('settings.notifications')}</h3></div><div class="card-b stack" data-f>
          <div class="muted">${t('settings.notifHelp')}</div>
          ${cb('notif_late', t('dash.nLate'), 'red')}${cb('notif_partial', t('dash.nPartial'), 'orange')}${cb('notif_upcoming', t('dash.nUpcoming', { n: s().upcoming_days || 30 }), 'yellow')}${cb('notif_received', t('dash.nReceived'), 'green')}
          <div class="form-grid">${App.field(t('settings.upcomingDays'), `<div class="input-group"><input class="input" type="number" min="1" max="365" name="upcoming_days" value="${esc(s().upcoming_days || 30)}"><span class="addon">${t('common.daysShort')}</span></div>`)}</div>
          <div><button class="btn primary" data-save>${icon('save')} ${t('btn.save')}</button></div></div></div>`;
        body.querySelector('[data-save]').addEventListener('click', () => {
          const d = App.formData(body.querySelector('[data-f]'));
          saveSettings({ notif_late: d.notif_late ? 1 : 0, notif_partial: d.notif_partial ? 1 : 0, notif_upcoming: d.notif_upcoming ? 1 : 0, notif_received: d.notif_received ? 1 : 0, upcoming_days: Math.max(1, Math.min(365, parseInt(d.upcoming_days, 10) || 30)) });
        });
      } else if (tab === 'language') {
        body.innerHTML = `<div class="card"><div class="card-h"><h3>${t('settings.language')}</h3></div><div class="card-b stack">
          <div class="muted">${t('settings.langHelp')}</div>
          <div class="row"><button class="btn ${App.state.lang === 'fr' ? 'primary' : ''}" data-lang="fr">🇫🇷 Français</button><button class="btn ${App.state.lang === 'ar' ? 'primary' : ''}" data-lang="ar">🇲🇦 العربية</button></div></div></div>`;
        App.on(body, 'click', '[data-lang]', (e, b) => App.setLang(b.dataset.lang));
      }
    };

    App.on(root, 'click', '.tabs [data-tab]', (e, b) => { st.tab = b.dataset.tab; draw(); });
    await draw();
  };

  function openYear(after) {
    const ys = App.lk('years').map((y) => y.year);
    const next = ys.length ? Math.max(...ys) + 1 : new Date().getFullYear();
    App.modal({
      title: t('year.open'),
      body: `<form class="stack"><div class="form-grid">
        ${App.field(t('common.exercice'), `<input class="input" type="number" name="year" value="${next}" min="2000" max="2100">`, { required: true })}
        ${App.field(t('year.copyFrom'), `<select class="input" name="copy_from"><option value="">${t('year.noCopy')}</option>${ys.map((y) => `<option value="${y}" ${y === Math.max(...ys) ? 'selected' : ''}>${y}</option>`).join('')}</select>`)}
        </div>
        <label class="check"><input type="checkbox" name="copy_subs" checked> ${t('year.copySubs')}</label>
        <label class="check"><input type="checkbox" name="generate" checked> ${t('year.generate')}</label>
        <div class="notice info">${icon('info')}<div>${t('year.openHelp')}</div></div></form>`,
      footer: `<button class="btn" data-close>${t('btn.cancel')}</button><button class="btn primary" data-ok>${icon('check')} ${t('year.open')}</button>`,
      onMount: (m) => m.el.querySelector('[data-ok]').addEventListener('click', async () => {
        const d = App.formData(m.el.querySelector('form'));
        try {
          const r = await App.safe(() => App.api('years.open', { year: Number(d.year), copy_from: d.copy_from ? Number(d.copy_from) : null, copy_subs: d.copy_subs, generate: d.generate }));
          App.toast(t('msg.yearOpened', { y: r.year, c: r.copied, g: r.generated }));
          await App.refreshLookups();
          App.renderTopbar();
          m.close();
          after();
        } catch (e) { /* */ }
      }),
    });
  }
})();
