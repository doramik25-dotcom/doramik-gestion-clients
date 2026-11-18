/* DORAMIK GESTION CLIENTS — Rapports : catalogue, filtres, aperçu et exports */
(function () {
  'use strict';
  const { esc, t, icon } = App;

  App.views.reports = async (root) => {
    root.innerHTML = `<div class="page-head"><div><h1>${t('nav.reports')}</h1><div class="sub">${t('reports.subtitle')}</div></div></div>
      <div class="report-cards">${App.reports.catalog.map((r) => `<div class="report-card" data-id="${r.id}"><div class="ri">${icon(r.ic)}</div><div><div class="rt">${esc(t('report.' + r.id))}</div><div class="rd">${esc(t('reportDesc.' + r.id))}</div></div></div>`).join('')}</div>`;
    App.on(root, 'click', '[data-id]', (e, el) => App.go('#/rapport/' + el.dataset.id));
  };

  const TONES = { red: 'var(--red)', orange: 'var(--orange)', green: 'var(--green)', gray: 'var(--text-3)', yellow: 'var(--yellow)', blue: 'var(--blue)' };
  function cellHtml(v, type) {
    if (v && typeof v === 'object' && 'text' in v) return `<span style="color:${TONES[v.tone] || 'inherit'};font-weight:600">${esc(v.text)}</span>`;
    if (type === 'money') return v === '' || v === null || v === undefined ? '' : App.money(v, false);
    if (type === 'date') return App.date(v);
    return esc(v === null || v === undefined ? '' : v);
  }
  function sectionHtml(s) {
    const num = (c) => c.type === 'money' || c.type === 'number';
    return `${s.title ? `<div class="section-title" style="margin:16px 18px 8px">${esc(s.title)}</div>` : ''}<div class="table-wrap"><table class="tbl"><thead><tr>${s.columns.map((c) => `<th class="${num(c) ? 'num' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${s.rows.length ? s.rows.map((r) => `<tr>${r.map((v, i) => `<td class="${num(s.columns[i]) ? 'num' : ''}">${cellHtml(v, s.columns[i].type)}</td>`).join('')}</tr>`).join('') : `<tr><td class="empty" colspan="${s.columns.length}">${t('common.noData')}</td></tr>`}</tbody>
      ${s.totals && s.rows.length ? `<tfoot><tr>${s.totals.map((v, i) => `<td class="${num(s.columns[i]) ? 'num' : ''}">${cellHtml(v, s.columns[i].type)}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
  }

  function filterField(k, f) {
    const req = k.endsWith('*');
    const key = k.replace('*', '');
    switch (key) {
      case 'client': return `<div class="field wide"><label>${t('field.client')}${req ? '<span class="req">*</span>' : ''}</label>${App.clientPicker('client_id', f.client_id || '', { placeholder: req ? t('common.searchClient') : t('common.allClients'), sticky: true })}</div>`;
      case 'year': return `<div class="field"><label>${t('common.exercice')}</label><select class="input" name="year">${App.yearsOptions(f.year || App.state.year)}</select></div>`;
      case 'yearAll': return `<div class="field"><label>${t('common.exercice')}</label><select class="input" name="year">${App.yearsOptions(f.year !== undefined ? f.year : '', true)}</select></div>`;
      case 'from': return `<div class="field"><label>${t('common.from')}</label><input class="input" type="date" name="from" value="${esc(f.from || '')}"></div>`;
      case 'to': return `<div class="field"><label>${t('common.to')}</label><input class="input" type="date" name="to" value="${esc(f.to || '')}"></div>`;
      case 'service': return `<div class="field"><label>${t('field.service')}</label><select class="input" name="service_id"><option value="">${t('common.all')}</option>${App.forms.serviceOptions(f.service_id)}</select></div>`;
      case 'status': return `<div class="field"><label>${t('col.status')}</label><select class="input" name="status"><option value="">${t('common.all')}</option>${['PAID', 'PARTIAL', 'UNPAID', 'LATE'].map((s) => `<option value="${s}">${esc(t('status.' + s))}</option>`).join('')}</select></div>`;
      case 'client_status': return `<div class="field"><label>${t('field.clientStatus')}</label><select class="input" name="client_status"><option value="">${t('common.all')}</option><option value="ACTIVE">${t('clients.actives')}</option><option value="INACTIVE">${t('clients.inactives')}</option></select></div>`;
      case 'mode': return `<div class="field"><label>${t('field.mode')}</label><select class="input" name="mode_id">${App.options(App.lk('payment_modes'), '', { empty: t('common.all') })}</select></div>`;
      case 'legal_form': return `<div class="field"><label>${t('field.legal_form')}</label><select class="input" name="legal_form_id">${App.options(App.lk('legal_forms'), '', { empty: t('common.all') })}</select></div>`;
      default: return '';
    }
  }

  App.views.report = async (root, params, query) => {
    const def = App.reports.catalog.find((r) => r.id === params.id);
    if (!def) return App.go('#/rapports');
    const init = { client_id: query.client || '', year: query.year !== undefined ? query.year : undefined };
    if (def.filters.includes('year')) init.year = query.year || App.state.year;
    root.innerHTML = `<div class="page-head"><div><a href="#/rapports" class="small">${icon(App.isAr() ? 'chevron-right' : 'chevron-left')} ${t('nav.reports')}</a><h1>${esc(t('report.' + def.id))}</h1><div class="sub">${esc(t('reportDesc.' + def.id))}</div></div>
      <div class="actions">${App.exportButtons()}</div></div>
      <div class="card">${def.filters.length ? `<div class="filters" data-filters>${def.filters.map((k) => filterField(k, init)).join('')}</div>` : ''}
        <div data-out><div class="loading">${t('common.loading')}</div></div></div>`;
    let doc = null;
    const fEl = root.querySelector('[data-filters]');
    const filters = () => {
      if (!fEl) return {};
      const d = App.formData(fEl);
      Object.keys(d).forEach((k) => { if (d[k] === '') delete d[k]; });
      return d;
    };
    const out = root.querySelector('[data-out]');
    const load = async () => {
      const f = filters();
      try {
        const res = await def.build(f);
        doc = Object.assign({ title: t('report.' + def.id), fileName: t('report.' + def.id), filters: App.reports.filterText(f) }, res);
        out.innerHTML = `${doc.subtitle ? `<div class="card-b" style="padding-bottom:0"><b>${esc(doc.subtitle)}</b></div>` : ''}
          ${doc.kpis ? `<div class="card-b"><div class="row">${doc.kpis.map((k) => `<div class="kpi" style="min-width:170px"><div class="grow"><div class="kl">${esc(k[0])}</div><div class="kv" style="font-size:17px">${esc(k[1])}</div></div></div>`).join('')}</div></div>` : ''}
          ${doc.sections.map(sectionHtml).join('')}`;
      } catch (e) {
        doc = null;
        out.innerHTML = `<div class="card-b"><div class="notice ${e.code === 'REQUIRED' ? 'info' : 'err'}">${icon('info')}<div>${esc(e.code === 'REQUIRED' ? t('reports.chooseClient') : App.errorText(e))}</div></div></div>`;
      }
    };
    if (fEl) {
      App.bindClientPicker(fEl, () => load());
      fEl.addEventListener('change', (e) => { if (!e.target.closest('[data-picker]')) load(); });
    }
    App.on(root, 'click', '[data-exp]', (e, b) => {
      if (!doc) return App.toast(t('reports.chooseClient'), 'warn');
      App.reports.run(b.dataset.exp, doc);
    });
    await load();
  };
})();
