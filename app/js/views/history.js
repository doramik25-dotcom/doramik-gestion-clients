/* DORAMIK GESTION CLIENTS — Historique des opérations et anciens clients */
(function () {
  'use strict';
  const { esc, t, icon } = App;

  const svcName = (id) => { const s = App.lkById('services', id); return s ? App.nm(s) : ''; };
  const perName = (id) => { const p = App.lkById('periodicities', id); return p ? App.nm(p) : ''; };

  /** Texte lisible d'une entrée d'historique. */
  App.historyText = (h) => {
    const d = h.data || {};
    const mt = App.moneyText;
    const per = (x) => App.periodLabel({ period_key: x.period_key, year: x.year, label: x.label, kind: x.period_key ? 'RECURRING' : 'ONE_OFF' });
    switch (h.action) {
      case 'CLIENT_CREATED': return { title: t('hist.CLIENT_CREATED'), detail: esc(d.name || ''), tone: 'green' };
      case 'CLIENT_UPDATED': return { title: t('hist.CLIENT_UPDATED'), detail: esc((d.fields || []).map((f) => t('field.' + f)).join(', ')), tone: '' };
      case 'CLIENT_STATUS': return { title: d.status === 'ACTIVE' ? t('hist.CLIENT_ACTIVATED') : t('hist.CLIENT_DEACTIVATED'), detail: d.date ? App.date(d.date) : '', tone: d.status === 'ACTIVE' ? 'green' : 'gray' };
      case 'CLIENT_DELETED': return { title: t('hist.CLIENT_DELETED'), detail: esc(d.name || ''), tone: 'red' };
      case 'YEAR_CONFIG': return { title: t('hist.YEAR_CONFIG', { y: d.year }), detail: esc(perName(d.periodicity_id)) + (d.start_date ? ' · ' + t('field.start_date') + ' ' + App.date(d.start_date) : ''), tone: '' };
      case 'SUB_CREATED': return { title: t('hist.SUB_CREATED', { s: svcName(d.service_id) }), detail: `${esc(perName(d.periodicity_id))} · ${esc(mt(d.amount))} · ${t('common.exercice')} ${d.year}${d.from_year ? ' · ' + t('hist.copiedFrom', { y: d.from_year }) : ''}`, tone: 'green' };
      case 'SUB_UPDATED': return { title: t('hist.SUB_UPDATED', { s: svcName(d.service_id) }), detail: `${d.prev_periodicity_id !== d.periodicity_id ? esc(perName(d.prev_periodicity_id)) + ' → ' : ''}${esc(perName(d.periodicity_id))} · ${d.prev_amount !== d.amount ? esc(mt(d.prev_amount)) + ' → ' : ''}${esc(mt(d.amount))} · ${t('common.exercice')} ${d.year}`, tone: '' };
      case 'SUB_STOPPED': return { title: t('hist.SUB_STOPPED', { s: svcName(d.service_id) }), detail: `${t('common.exercice')} ${d.year}`, tone: 'gray' };
      case 'SUB_RESUMED': return { title: t('hist.SUB_RESUMED', { s: svcName(d.service_id) }), detail: `${t('common.exercice')} ${d.year}`, tone: 'green' };
      case 'DUE_CREATED': return { title: t(d.one_off ? 'hist.ONEOFF_CREATED' : 'hist.DUE_CREATED'), detail: `${esc(svcName(d.service_id))} · ${esc(per(d))} · ${t('col.due')} ${esc(mt(d.amount))}`, tone: '' };
      case 'DUE_UPDATED': return { title: t('hist.DUE_UPDATED'), detail: `${esc(svcName(d.service_id))} · ${esc(per(d))} · ${d.prev_amount !== d.amount ? esc(mt(d.prev_amount)) + ' → ' : ''}${esc(mt(d.amount))}${d.prev_due_date !== d.due_date ? ' · ' + App.date(d.prev_due_date) + ' → ' + App.date(d.due_date) : ''} · ${t('col.rest')} ${esc(mt(d.rest))}`, tone: 'orange' };
      case 'DUE_CANCELLED': return { title: t('hist.DUE_CANCELLED'), detail: `${esc(svcName(d.service_id))} · ${esc(per(d))} · ${esc(mt(d.amount))} · ${esc(['PERIODICITY_CHANGED', 'SCHEDULE_CHANGED'].includes(d.reason) ? t('reason.' + d.reason) : d.reason || '')}`, tone: 'gray' };
      case 'PAYMENT': {
        const lines = (d.allocations || []).map((a) => `${esc(svcName(a.service_id))} · ${esc(per(a))} : ${t('hist.allocated')} ${esc(mt(a.amount))} → ${t('col.rest')} <b>${esc(mt(a.rest))}</b>${a.rest === 0 ? ' ✓' : ''}`);
        if (d.advance) lines.push(`${t('pay.advance')} : ${esc(mt(d.advance))}`);
        if (d.balance !== undefined) lines.push(`${t('hist.balance')} : <b>${esc(mt(d.balance))}</b>`);
        const mode = App.lkById('payment_modes', d.mode_id);
        return { title: t('hist.PAYMENT', { a: mt(d.amount), m: mode ? App.nm(mode) : '' }) + (d.pay_date ? ' — ' + App.dateText(d.pay_date) : ''), detail: lines.join('<br>'), tone: 'green' };
      }
      case 'PAYMENT_VOIDED': return { title: t('hist.PAYMENT_VOIDED', { a: mt(d.amount) }), detail: `${App.date(d.pay_date)} · ${esc(d.reason || '')}${d.balance !== undefined ? '<br>' + t('hist.balance') + ' : <b>' + esc(mt(d.balance)) + '</b>' : ''}`, tone: 'red' };
      case 'CREDIT_APPLIED': return { title: t('hist.CREDIT_APPLIED', { a: mt(d.amount) }), detail: (d.allocations || []).map((a) => `${esc(svcName(a.service_id))} · ${esc(per(a))} : ${esc(mt(a.amount))} → ${t('col.rest')} ${esc(mt(a.rest))}`).join('<br>'), tone: 'green' };
      case 'DOC_ADDED': return { title: t('hist.DOC_ADDED'), detail: esc(d.title || d.file || ''), tone: '' };
      case 'DOC_REMOVED': return { title: t('hist.DOC_REMOVED'), detail: esc(d.title || ''), tone: 'gray' };
      case 'YEAR_OPENED': return { title: t('hist.YEAR_OPENED', { y: d.year }), detail: t('hist.yearOpenedDetail', { c: d.copied || 0, g: d.generated || 0 }), tone: 'green' };
      case 'YEAR_STATUS': return { title: t(d.status === 'CLOSED' ? 'hist.YEAR_CLOSED' : 'hist.YEAR_REOPENED', { y: d.year }), detail: '', tone: '' };
      default: return { title: h.action, detail: '', tone: '' };
    }
  };

  const ACTIONS = ['CLIENT_CREATED', 'CLIENT_UPDATED', 'CLIENT_STATUS', 'SUB_CREATED', 'SUB_UPDATED', 'DUE_CREATED', 'DUE_UPDATED', 'DUE_CANCELLED', 'PAYMENT', 'PAYMENT_VOIDED', 'CREDIT_APPLIED', 'DOC_ADDED', 'YEAR_OPENED'];

  App.views.history = async (root, params, query) => {
    const st = { tab: query.tab || 'log', limit: 500 };
    root.innerHTML = `<div class="page-head"><div><h1>${t('nav.history')}</h1><div class="sub">${t('history.subtitle')}</div></div></div>
      <div class="tabs"><button data-tab="log">${icon('history')} ${t('history.log')}</button><button data-tab="old">${icon('archive')} ${t('history.oldClients')}</button></div>
      <div data-body></div>`;
    const body = root.querySelector('[data-body]');
    const draw = async () => {
      root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === st.tab));
      if (st.tab === 'log') {
        body.innerHTML = `<div class="card"><div class="filters" data-f>
          <div class="field wide"><label>${t('field.client')}</label>${App.clientPicker('client_id', '', { placeholder: t('common.allClients') })}</div>
          <div class="field"><label>${t('history.operation')}</label><select class="input" name="action"><option value="">${t('common.all')}</option>${ACTIONS.map((a) => `<option value="${a}">${esc(t('histType.' + a))}</option>`).join('')}</select></div>
        </div><div data-t></div></div>`;
        const fEl = body.querySelector('[data-f]');
        const table = new App.Table(body.querySelector('[data-t]'), {
          rows: [],
          columns: [
            { key: 'ts', label: t('col.date'), render: (h) => `<span class="ltr">${App.dateTime(h.ts)}</span>` },
            { key: 'client', label: t('col.client'), render: (h) => (h.client_id && h.client ? `<a data-act="client">${esc(h.client)}</a>` : '<span class="muted">—</span>') },
            { key: 'action', label: t('history.operation'), sortValue: (h) => App.historyText(h).title, render: (h) => `<b>${esc(App.historyText(h).title)}</b>` },
            { key: 'data', label: t('col.details'), sortable: false, render: (h) => `<span class="small">${App.historyText(h).detail}</span>` },
          ],
          onAction: (act, h) => { if (act === 'client') App.go('#/client/' + h.client_id); },
          empty: t('common.noData'),
        });
        const load = async () => {
          const f = App.formData(fEl);
          const rows = await App.api('history.list', { client_id: f.client_id || null, action: f.action || null, limit: 2000 });
          table.setRows(rows);
        };
        App.bindClientPicker(fEl, () => load());
        fEl.addEventListener('change', (e) => { if (!e.target.closest('[data-picker]')) load(); });
        await load();
      } else {
        const rows = await App.api('clients.list', { status: 'INACTIVE' });
        body.innerHTML = `<div class="notice info" style="margin-bottom:14px">${icon('info')}<div>${t('history.oldHelp')}</div></div><div class="card"><div data-t></div></div>`;
        new App.Table(body.querySelector('[data-t]'), {
          rows,
          columns: [
            { key: 'code', label: t('col.code'), render: (c) => `<span class="ltr muted">${esc(c.code)}</span>` },
            { key: 'name', label: t('col.name'), render: (c) => `<b>${esc(c.name)}</b>` },
            { key: 'legal_form', label: t('field.legal_form'), render: (c) => esc(App.nm(c, 'legal_form')) },
            { key: 'start_date', label: t('field.start_date'), type: 'date' },
            { key: 'status_date', label: t('history.inactiveSince'), type: 'date' },
            { key: 'total_due', label: t('col.due'), type: 'money' },
            { key: 'total_paid', label: t('col.paid'), type: 'money' },
            { key: 'total_rest', label: t('col.rest'), type: 'money', render: (c) => (c.total_rest ? `<b style="color:var(--red)">${App.money(c.total_rest, false)}</b>` : App.money(0, false)) },
          ],
          totals: { name: t('common.totalN', { n: rows.length }), total_due: App.sum(rows, 'total_due'), total_paid: App.sum(rows, 'total_paid'), total_rest: App.sum(rows, 'total_rest') },
          onRowClick: (c) => App.go('#/client/' + c.id),
          empty: t('history.noOld'),
        });
      }
    };
    App.on(root, 'click', '[data-tab]', (e, b) => { st.tab = b.dataset.tab; draw(); });
    await draw();
  };
})();
