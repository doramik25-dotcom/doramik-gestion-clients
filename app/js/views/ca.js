/* DORAMIK GESTION CLIENTS — Chiffre d'affaires */
(function () {
  'use strict';
  const { esc, t, icon } = App;

  App.views.ca = async (root, params, query) => {
    const st = { tab: query.tab || 'month' };
    root.innerHTML = `<div class="page-head"><div><h1>${t('nav.ca')}</h1><div class="sub">${t('ca.subtitle')}</div></div><div class="actions">${App.exportButtons()}</div></div>
      <div class="card" style="margin-bottom:16px"><div class="filters" data-filters style="border-radius:var(--radius)">
        <div class="field"><label>${t('common.exercice')}</label><select class="input" name="year">${App.yearsOptions(App.state.year)}</select></div>
        <div class="field wide"><label>${t('field.client')}</label>${App.clientPicker('client_id', '', { placeholder: t('common.allClients'), sticky: true })}</div>
        <div class="field"><label>${t('field.category')}</label><select class="input" name="category_id">${App.options(App.lk('categories'), '', { empty: t('common.all') })}</select></div>
        <div class="field"><label>${t('field.service')}</label><select class="input" name="service_id"><option value="">${t('common.all')}</option>${App.forms.serviceOptions('')}</select></div>
        <div class="field"><label>${t('col.period')}</label><select class="input" name="period"><option value="">${t('common.all')}</option>${[1, 2, 3, 4].map((q) => `<option value="T${q}">${esc(t('period.T', { n: q, y: '' }).trim())}</option>`).join('')}${Array.from({ length: 12 }, (_, i) => `<option value="M${String(i + 1).padStart(2, '0')}">${esc(App.monthName(i + 1))}</option>`).join('')}</select></div>
        <div class="field"><label>${t('field.clientStatus')}</label><select class="input" name="client_status"><option value="">${t('common.all')}</option><option value="ACTIVE">${t('clients.actives')}</option><option value="INACTIVE">${t('clients.inactives')}</option></select></div>
      </div></div>
      <div class="kpis" data-kpis style="margin-bottom:16px"></div>
      <div class="card" style="margin-bottom:16px"><div class="card-h"><h3 data-ctitle></h3></div><div class="card-b" data-chart></div></div>
      <div class="notice info" style="margin-bottom:12px">${icon('info')}<div>${t('ca.help')}</div></div>
      <div class="tabs">${['month', 'quarter', 'client', 'service', 'year'].map((k) => `<button data-tab="${k}" class="${st.tab === k ? 'on' : ''}">${t('ca.by.' + k)}</button>`).join('')}</div>
      <div class="card"><div data-t></div></div>`;
    let data = null;
    const filters = () => {
      const d = App.formData(root.querySelector('[data-filters]'));
      Object.keys(d).forEach((k) => { if (d[k] === '') delete d[k]; });
      return d;
    };
    App.bindClientPicker(root, () => load());
    const tableFor = () => {
      const moneyCols = [
        { key: 'due', label: t('ca.due'), type: 'money' },
        { key: 'paid', label: t('ca.paid'), type: 'money' },
        { key: 'rest', label: t('ca.rest'), type: 'money' },
      ];
      const tot = (rows, extra = {}) => Object.assign({ due: App.sum(rows, 'due'), paid: App.sum(rows, 'paid'), rest: App.sum(rows, 'rest') }, extra);
      if (st.tab === 'month') {
        const rows = data.months.map((m) => Object.assign({ label: App.monthName(m.month) + ' ' + data.year }, m));
        return { rows, columns: [{ key: 'month', label: t('ca.month'), render: (r) => esc(r.label) }, ...moneyCols, { key: 'cash', label: t('ca.cash'), type: 'money' }], totals: tot(rows, { month: t('common.total'), cash: App.sum(rows, 'cash') }) };
      }
      if (st.tab === 'quarter') {
        const rows = data.quarters.map((q) => Object.assign({ label: t('period.T', { n: q.quarter, y: data.year }) }, q));
        return { rows, columns: [{ key: 'quarter', label: t('ca.quarter'), render: (r) => esc(r.label) }, ...moneyCols, { key: 'cash', label: t('ca.cash'), type: 'money' }], totals: tot(rows, { quarter: t('common.total'), cash: App.sum(rows, 'cash') }) };
      }
      if (st.tab === 'client') {
        const rows = data.by_client;
        return { rows, columns: [{ key: 'client', label: t('col.client'), render: (r) => `<a data-act="client">${esc(r.client)}</a> ${r.status === 'INACTIVE' ? App.badge('INACTIVE') : ''}` }, ...moneyCols, { key: 'share', label: t('ca.share'), type: 'number', sortValue: (r) => r.due, render: (r) => `${data.total.due ? ((r.due / data.total.due) * 100).toFixed(1) : '0.0'} %` }], totals: tot(rows, { client: t('common.totalN', { n: rows.length }) }) };
      }
      if (st.tab === 'service') {
        const rows = data.by_service;
        return { rows, columns: [{ key: 'service', label: t('col.service'), render: (r) => esc(App.nm(r, 'service')) }, ...moneyCols], totals: tot(rows, { service: t('common.total') }) };
      }
      const rows = data.by_year;
      return { rows, columns: [{ key: 'year', label: t('common.exercice') }, ...moneyCols], totals: tot(rows, { year: t('common.total') }) };
    };
    const drawTable = () => {
      root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === st.tab));
      const cfg = tableFor();
      new App.Table(root.querySelector('[data-t]'), Object.assign(cfg, {
        onAction: (act, r) => { if (act === 'client') App.go('#/client/' + r.id); },
        onRowClick: st.tab === 'client' ? (r) => App.go('#/client/' + r.id) : null,
      }));
    };
    const load = async () => {
      const f = filters();
      data = await App.api('ca.get', f);
      const tt = data.total;
      root.querySelector('[data-kpis]').innerHTML =
        App.kpi({ label: t('ca.totalDue', { y: data.year }), value: App.money(tt.due), ic: 'trending-up', tone: 'blue' }) +
        App.kpi({ label: t('ca.totalPaid'), value: App.money(tt.paid), sub: tt.due ? t('ca.rate', { p: ((tt.paid / tt.due) * 100).toFixed(1) }) : '', ic: 'circle-check-big', tone: 'green' }) +
        App.kpi({ label: t('ca.totalRest'), value: App.money(tt.rest), ic: 'wallet', tone: 'orange' }) +
        App.kpi({ label: t('ca.totalCash', { y: data.year }), value: App.money(tt.cash), sub: t('ca.cashSub'), ic: 'banknote', tone: 'green' });
      root.querySelector('[data-ctitle]').textContent = t('ca.chartTitle', { y: data.year });
      root.querySelector('[data-chart]').innerHTML = App.barChart({ labels: data.months.map((m) => t('monthShort.' + m.month)), series: [
        { name: t('ca.due'), color: '#93c5fd', values: data.months.map((m) => m.due) },
        { name: t('ca.paid'), color: '#1e40af', values: data.months.map((m) => m.paid) },
        { name: t('ca.cash'), color: '#16a34a', values: data.months.map((m) => m.cash) },
      ] });
      drawTable();
    };
    root.querySelector('[data-filters]').addEventListener('change', (e) => { if (!e.target.closest('[data-picker]')) load(); });
    App.on(root, 'click', '[data-tab]', (e, b) => { st.tab = b.dataset.tab; drawTable(); });
    App.on(root, 'click', '[data-exp]', (e, b) => App.reports.exportCa(b.dataset.exp, st.tab, data, filters()));
    await load();
  };
})();
