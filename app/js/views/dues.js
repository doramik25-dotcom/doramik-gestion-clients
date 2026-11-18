/* DORAMIK GESTION CLIENTS — Échéances et Centre de recouvrement */
(function () {
  'use strict';
  const { esc, t, icon } = App;

  const periodOptions = (v) => `<option value="">${t('common.all')}</option>` +
    [1, 2, 3, 4].map((q) => `<option value="T${q}" ${v === 'T' + q ? 'selected' : ''}>${esc(t('period.T', { n: q, y: '' }).trim())}</option>`).join('') +
    Array.from({ length: 12 }, (_, i) => `<option value="M${String(i + 1).padStart(2, '0')}" ${v === 'M' + String(i + 1).padStart(2, '0') ? 'selected' : ''}>${esc(App.monthName(i + 1))}</option>`).join('');

  const statusOptions = (v, withPaid = true) => `<option value="">${t('common.all')}</option>` +
    (withPaid ? ['PAID', 'PARTIAL', 'UNPAID', 'LATE', 'UPCOMING', 'DUE', 'NO_DUE'] : ['LATE', 'PARTIAL', 'UNPAID', 'DUE', 'UPCOMING', 'NO_DUE'])
      .map((s) => `<option value="${s}" ${v === s ? 'selected' : ''}>${esc(['UPCOMING', 'DUE', 'NO_DUE'].includes(s) ? t('timing.' + s) : t('status.' + s))}</option>`).join('');

  /** Barre de filtres commune. */
  function filterBar(f, { dates = false, withPaid = true } = {}) {
    return `<div class="filters" data-filters>
      <div class="field wide">${`<label>${t('field.client')}</label>`}${App.clientPicker('client_id', f.client_id || '', { placeholder: t('common.allClients'), sticky: true })}</div>
      <div class="field"><label>${t('common.exercice')}</label><select class="input" name="year">${App.yearsOptions(f.year, true)}</select></div>
      <div class="field"><label>${t('col.period')}</label><select class="input" name="period">${periodOptions(f.period)}</select></div>
      <div class="field"><label>${t('field.service')}</label><select class="input" name="service_id"><option value="">${t('common.all')}</option>${App.forms.serviceOptions(f.service_id)}</select></div>
      <div class="field"><label>${t('col.status')}</label><select class="input" name="status">${statusOptions(f.status, withPaid)}</select></div>
      <div class="field"><label>${t('field.clientStatus')}</label><select class="input" name="client_status"><option value="">${t('common.all')}</option><option value="ACTIVE" ${f.client_status === 'ACTIVE' ? 'selected' : ''}>${t('clients.actives')}</option><option value="INACTIVE" ${f.client_status === 'INACTIVE' ? 'selected' : ''}>${t('clients.inactives')}</option></select></div>
      ${dates ? `<div class="field"><label>${t('dues.dateField')}</label><select class="input" name="date_field"><option value="filing" ${f.date_field !== 'due' ? 'selected' : ''}>${t('dues.byFiling')}</option><option value="due" ${f.date_field === 'due' ? 'selected' : ''}>${t('dues.byDue')}</option></select></div>
      <div class="field"><label>${t('common.from')}</label><input class="input" type="date" name="from" value="${esc(f.from || '')}"></div><div class="field"><label>${t('common.to')}</label><input class="input" type="date" name="to" value="${esc(f.to || '')}"></div>` : ''}
      <button class="btn sm ghost" data-reset>${icon('rotate-ccw')} ${t('common.reset')}</button>
    </div>`;
  }

  function readFilters(root) {
    const el = root.querySelector('[data-filters]');
    const d = App.formData(el);
    Object.keys(d).forEach((k) => { if (d[k] === '') delete d[k]; });
    return d;
  }

  function filterLabels(f) {
    const svc = f.service_id ? App.lkById('services', f.service_id) : null;
    const cl = f.client_id ? (App.state.clientCache || []).find((c) => String(c.id) === String(f.client_id)) : null;
    return [
      [t('field.client'), cl ? cl.name : t('common.allClients')],
      [t('common.exercice'), f.year || t('common.allYears')],
      [t('col.period'), f.period ? (f.period[0] === 'T' ? t('period.T', { n: f.period.slice(1), y: '' }).trim() : App.monthName(Number(f.period.slice(1)))) : ''],
      [t('field.service'), svc ? App.nm(svc) : ''],
      [t('col.status'), f.status ? (['UPCOMING', 'DUE', 'NO_DUE'].includes(f.status) ? t('timing.' + f.status) : t('status.' + f.status)) : ''],
      [t('dues.dateField'), f.from || f.to ? (f.date_field === 'due' ? t('dues.byDue') : t('dues.byFiling')) : ''],
      [t('field.clientStatus'), f.client_status ? t('status.' + f.client_status) : ''],
      [t('common.from'), f.from ? App.dateText(f.from) : ''], [t('common.to'), f.to ? App.dateText(f.to) : ''],
    ];
  }
  App.filterLabels = filterLabels;

  function exportButtons() {
    return `<button class="btn" data-exp="pdf">${icon('file-down')} PDF</button><button class="btn" data-exp="excel">${icon('file-spreadsheet')} Excel</button><button class="btn" data-exp="print">${icon('printer')} ${t('btn.print')}</button>`;
  }
  App.exportButtons = exportButtons;

  // ================================================================= Échéances
  App.views.dues = async (root, params, query) => {
    const f = { year: String(App.state.year), status: query.status || '' };
    if (query.day) { const dd = query.day === 'today' ? App.today() : query.day; f.from = dd; f.to = dd; f.year = ''; f.date_field = 'due'; }
    if (query.view === 'filing') { f.date_field = 'filing'; f.from = App.today(); f.to = App.addDays(App.today(), Number(App.state.settings.upcoming_days) || 30); f.year = ''; }
    if (query.status === 'UPCOMING') f.year = '';
    root.innerHTML = `<div class="page-head"><div><h1>${t('nav.dues')}</h1><div class="sub">${t('dues.subtitle')}</div></div>
      <div class="actions">${exportButtons()}<button class="btn primary" data-gen>${icon('refresh-cw')} ${t('fees.generateAll', { y: App.state.year })}</button></div></div>
      <div class="card">${filterBar(f, { dates: true })}<div data-summary class="card-b" style="padding:10px 18px;border-bottom:1px solid var(--border)"></div><div data-t></div></div>`;
    App.bindClientPicker(root, () => load());
    let rows = [];
    const table = new App.Table(root.querySelector('[data-t]'), {
      rows: [], columns: App.dueColumns(), onAction: App.onDueAction,
      onRowClick: (d) => App.forms.due(d.id).then((ch) => ch && App.refresh()),
    });
    const load = async () => {
      const fl = readFilters(root);
      rows = await App.api('dues.list', Object.assign({}, fl, { order: 'date' }));
      table.setRows(rows, { client: t('common.totalN', { n: rows.length }), ...App.dueTotals(rows) });
      const c = (s) => rows.filter((d) => d.status === s).length;
      root.querySelector('[data-summary]').innerHTML = `<div class="row small"><span>${App.badge('PAID')} ${c('PAID')}</span><span>${App.badge('PARTIAL')} ${c('PARTIAL')}</span><span>${App.badge('UNPAID')} ${c('UNPAID')}</span><span>${App.badge('LATE')} ${c('LATE')}</span><span>${App.badge('NO_DUE', t('timing.NO_DUE'))} ${rows.filter((d) => d.timing === 'NO_DUE').length}</span>
        <span class="spacer"></span><span>${t('col.due')} <b>${App.money(App.sum(rows, 'amount'))}</b></span><span>${t('col.paid')} <b>${App.money(App.sum(rows, 'paid'))}</b></span><span>${t('col.rest')} <b>${App.money(App.sum(rows, 'rest'))}</b></span></div>`;
    };
    root.querySelector('[data-filters]').addEventListener('change', (e) => { if (!e.target.closest('[data-picker]')) load(); });
    root.querySelector('[data-reset]').addEventListener('click', () => { App.setCurrentClient(null); App.go('#/echeances?r=' + Date.now()); });
    root.querySelector('[data-gen]').addEventListener('click', async () => {
      try { const n = await App.safe(() => App.api('years.generateAll', App.state.year)); App.toast(t('msg.generated', { n })); load(); } catch (e) { /* */ }
    });
    App.on(root, 'click', '[data-exp]', (e, b) => App.reports.exportDues(b.dataset.exp, t('report.dues'), rows, readFilters(root)));
    await load();
  };

  // ================================================================= Recouvrement
  App.views.recovery = async (root, params, query) => {
    const f = { year: '', status: query.status || '' };
    const st = { tab: 'detail', overdue: query.overdue === '1' };
    root.innerHTML = `<div class="page-head"><div><h1>${t('nav.recovery')}</h1><div class="sub">${t('recovery.subtitle')}</div></div>
      <div class="actions">${exportButtons()}<button class="btn success" data-pay>${icon('hand-coins')} ${t('pay.new')}</button></div></div>
      <div class="kpis" data-kpis style="margin-bottom:16px"></div>
      <div class="tabs"><button data-tab="detail" class="on">${icon('list-checks')} ${t('recovery.detail')}</button><button data-tab="synth">${icon('users')} ${t('recovery.byClient')}</button></div>
      <div class="card">${filterBar(f, { withPaid: false })}
        <div class="card-b" style="padding:10px 18px;border-bottom:1px solid var(--border)"><label class="check"><input type="checkbox" data-overdue ${st.overdue ? 'checked' : ''}> ${t('recovery.overdueOnly')}</label></div>
        <div data-t></div></div>`;
    App.bindClientPicker(root, () => load());
    let rows = [];
    let synth = [];
    const tEl = root.querySelector('[data-t]');
    let table = null;
    const load = async () => {
      const fl = readFilters(root);
      rows = await App.api('dues.list', Object.assign({}, fl, { open_only: true, overdue_only: st.overdue, order: 'late' }));
      const late = rows.filter((d) => d.status === 'LATE');
      root.querySelector('[data-kpis]').innerHTML =
        App.kpi({ label: t('recovery.toRecover'), value: App.money(App.sum(rows, 'rest')), sub: t('recovery.nDues', { n: rows.length }), ic: 'wallet', tone: 'blue' }) +
        App.kpi({ label: t('status.LATE'), value: App.money(App.sum(late, 'rest')), sub: t('recovery.nClients', { n: new Set(late.map((d) => d.client_id)).size }), ic: 'triangle-alert', tone: 'red' }) +
        App.kpi({ label: t('status.PARTIAL'), value: App.money(App.sum(rows.filter((d) => d.paid > 0), 'rest')), sub: t('recovery.nDues', { n: rows.filter((d) => d.paid > 0).length }), ic: 'coins', tone: 'orange' }) +
        App.kpi({ label: t('recovery.notDue'), value: App.money(App.sum(rows.filter((d) => d.timing === 'UPCOMING'), 'rest')), ic: 'clock', tone: 'yellow' }) +
        App.kpi({ label: t('dash.noDue'), value: App.money(App.sum(rows.filter((d) => d.timing === 'NO_DUE'), 'rest')), sub: t('dash.noDueSub'), ic: 'circle-alert', tone: 'gray' });
      // Synthèse par client
      const map = new Map();
      rows.forEach((d) => {
        let r = map.get(d.client_id);
        if (!r) { r = { client_id: d.client_id, client: d.client, count: 0, due: 0, paid: 0, rest: 0, late: 0, no_due: 0, max_late: 0, oldest: d.due_date || d.filing_date }; map.set(d.client_id, r); }
        r.count++; r.due += d.amount; r.paid += d.paid; r.rest += d.rest;
        if (d.status === 'LATE') r.late += d.rest;
        if (!d.due_date) r.no_due += d.rest;
        r.max_late = Math.max(r.max_late, d.days_late);
        const ref = d.due_date || d.filing_date;
        if (ref < r.oldest) r.oldest = ref;
      });
      synth = [...map.values()].sort((a, b) => b.rest - a.rest);
      drawTable();
    };
    const drawTable = () => {
      tEl.innerHTML = '';
      if (st.tab === 'detail') {
        table = new App.Table(tEl, { rows, columns: App.dueColumns(), totals: { client: t('common.totalN', { n: rows.length }), ...App.dueTotals(rows) }, onAction: App.onDueAction, onRowClick: (d) => App.forms.due(d.id).then((ch) => ch && App.refresh()), empty: t('recovery.empty') });
      } else {
        table = new App.Table(tEl, {
          rows: synth,
          columns: [
            { key: 'client', label: t('col.client'), render: (r) => `<a data-act="client"><b>${esc(r.client)}</b></a>` },
            { key: 'count', label: t('col.openDues'), type: 'number' },
            { key: 'oldest', label: t('col.oldestDue'), type: 'date' },
            { key: 'due', label: t('col.due'), type: 'money' },
            { key: 'paid', label: t('col.paid'), type: 'money' },
            { key: 'rest', label: t('col.rest'), type: 'money', render: (r) => `<b>${App.money(r.rest, false)}</b>` },
            { key: 'late', label: t('col.lateAmount'), type: 'money', render: (r) => (r.late ? `<span style="color:var(--red);font-weight:600">${App.money(r.late, false)}</span>` : '') },
            { key: 'no_due', label: t('dash.noDue'), type: 'money' },
            { key: 'max_late', label: t('col.maxLate'), type: 'number', render: (r) => (r.max_late ? t('common.days', { n: r.max_late }) : '') },
            { key: '', actions: true, render: () => `<button class="btn sm success" data-act="pay">${icon('hand-coins')} ${t('btn.pay')}</button>` },
          ],
          totals: { client: t('common.totalN', { n: synth.length }), count: App.sum(synth, 'count'), due: App.sum(synth, 'due'), paid: App.sum(synth, 'paid'), rest: App.sum(synth, 'rest'), late: App.sum(synth, 'late'), no_due: App.sum(synth, 'no_due') },
          onRowClick: (r) => App.go('#/client/' + r.client_id),
          onAction: async (act, r) => { if (act === 'client') App.go('#/client/' + r.client_id); if (act === 'pay' && await App.forms.payment({ clientId: r.client_id })) App.refresh(); },
          empty: t('recovery.empty'),
        });
      }
    };
    root.querySelector('[data-filters]').addEventListener('change', (e) => { if (!e.target.closest('[data-picker]')) load(); });
    root.querySelector('[data-overdue]').addEventListener('change', (e) => { st.overdue = e.target.checked; load(); });
    root.querySelector('[data-reset]').addEventListener('click', () => { App.setCurrentClient(null); App.go('#/recouvrement?r=' + Date.now()); });
    App.on(root, 'click', '[data-tab]', (e, b) => { st.tab = b.dataset.tab; root.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b)); drawTable(); });
    root.querySelector('[data-pay]').addEventListener('click', async () => { if (await App.forms.payment({ clientId: App.state.clientId || '' })) App.refresh(); });
    App.on(root, 'click', '[data-exp]', (e, b) => {
      const fl = readFilters(root);
      if (st.tab === 'detail') App.reports.exportDues(b.dataset.exp, t('report.recovery'), rows, fl);
      else App.reports.exportRecovery(b.dataset.exp, synth, fl);
    });
    await load();
  };
})();
