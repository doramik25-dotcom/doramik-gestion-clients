/* DORAMIK GESTION CLIENTS — construction des rapports (aperçu, PDF, Excel, impression) */
(function () {
  'use strict';
  const { t } = App;
  const R = (App.reports = {});

  const TONE = { PAID: 'green', PARTIAL: 'orange', UNPAID: 'gray', LATE: 'red' };
  const statusCell = (d) => ({
    text: t('status.' + d.status) + (d.status === 'LATE' && d.paid > 0 ? ' (' + t('status.PARTIAL').toLowerCase() + ')' : '') + (d.timing === 'NO_DUE' ? ' — ' + t('timing.NO_DUE') : ''),
    tone: TONE[d.status],
  });

  /** Complète un document de rapport avec la langue, le cabinet et les libellés. */
  R.doc = (base) => {
    const s = App.state.settings;
    return Object.assign({
      lang: App.state.lang,
      dir: App.isAr() ? 'rtl' : 'ltr',
      landscape: true,
      cabinet: { name: s.cabinet_name, address: s.cabinet_address, phone: s.cabinet_phone, email: s.cabinet_email, ice: s.cabinet_ice },
      labels: { generated: t('report.generated'), empty: t('common.noData'), print: t('btn.print'), close: t('btn.close') },
    }, base);
  };

  R.run = async (exp, doc) => {
    try {
      const d = R.doc(doc);
      if (exp === 'pdf') { const p = await window.doramik.exporter.pdf(d); if (p) App.toast(t('msg.savedTo', { p })); }
      else if (exp === 'excel') { const p = await window.doramik.exporter.excel(d); if (p) App.toast(t('msg.savedTo', { p })); }
      else await window.doramik.exporter.print(d);
    } catch (e) { App.toast(App.errorText(e), 'err'); }
  };

  const cur = () => ` (${t('currency')})`;

  // ------------------------------------------------------------ sections types
  R.duesSection = (rows, { client = true, title = '', details = false } = {}) => {
    const columns = [];
    if (client) columns.push({ label: t('col.client'), type: 'text' });
    columns.push({ label: t('col.service'), type: 'text' }, { label: t('col.period'), type: 'text' },
      { label: t('col.filingDate'), type: 'date' }, { label: t('col.dueDateFees'), type: 'date' },
      { label: t('col.fees') + cur(), type: 'money' }, { label: t('col.paid') + cur(), type: 'money' }, { label: t('col.rest') + cur(), type: 'money' });
    if (details) columns.push({ label: t('col.paymentsDone'), type: 'text' });
    columns.push({ label: t('col.lateDays'), type: 'number' }, { label: t('col.status'), type: 'text' });
    const data = rows.map((d) => {
      const r = [];
      if (client) r.push(d.client);
      r.push(App.serviceName(d), App.periodLabel(d), d.filing_date, d.due_date || { text: t('timing.NO_DUE'), tone: 'gray' }, d.amount, d.paid, d.rest);
      if (details) r.push((d.allocations || []).map((a) => `${App.dateText(a.pay_date)} ${App.fmtNumber(a.amount)} ${App.nm(a, 'mode')}`).join(' | '));
      r.push(d.days_late || '', statusCell(d));
      return r;
    });
    const moneyCols = columns.filter((x) => x.type === 'money');
    const totals = columns.map((c, i) => {
      if (i === 0) return t('common.totalN', { n: rows.length });
      if (c.type === 'money') { const k = ['amount', 'paid', 'rest'][moneyCols.indexOf(c)]; return App.sum(rows, k); }
      return '';
    });
    return { title, columns, rows: data, totals };
  };

  R.paymentsSection = (rows, { client = true, title = '' } = {}) => {
    const columns = [{ label: t('col.payDate'), type: 'date' }];
    if (client) columns.push({ label: t('col.client'), type: 'text' });
    columns.push({ label: t('col.amount') + cur(), type: 'money' }, { label: t('col.mode'), type: 'text' }, { label: t('col.details'), type: 'text' },
      { label: t('field.reference'), type: 'text' }, { label: t('col.allocations'), type: 'text' }, { label: t('pay.advance') + cur(), type: 'money' });
    const data = rows.map((p) => {
      const r = [p.pay_date];
      if (client) r.push(p.client);
      r.push(p.amount, App.nm(p, 'mode') + (p.voided ? ' — ' + t('pay.voided') : ''),
        [p.cheque_no && t('field.cheque_no') + ' ' + p.cheque_no, p.bank, p.cheque_date && App.dateText(p.cheque_date), p.transfer_ref].filter(Boolean).join(' · '),
        p.reference || '', (p.allocations || []).map((a) => `${App.isAr() && a.service_ar ? a.service_ar : a.service} ${App.periodLabel(a)} : ${App.fmtNumber(a.amount)}`).join(' | '),
        p.voided ? 0 : p.amount - (p.allocated || 0));
      return r;
    });
    const valid = rows.filter((p) => !p.voided);
    const amountIdx = client ? 2 : 1;
    const totals = columns.map((c, i) => (i === 0 ? t('common.totalN', { n: valid.length }) : i === amountIdx ? App.sum(valid, 'amount') : i === columns.length - 1 ? App.sum(valid, (p) => p.amount - (p.allocated || 0)) : ''));
    return { title, columns, rows: data, totals };
  };

  const clientsSection = (rows) => ({
    columns: [{ label: t('col.code'), type: 'text' }, { label: t('col.name'), type: 'text' }, { label: t('field.legal_form'), type: 'text' }, { label: t('field.phone'), type: 'text' },
      { label: t('field.email'), type: 'text' }, { label: 'ICE', type: 'text' }, { label: t('field.if_code'), type: 'text' }, { label: t('field.rc'), type: 'text' }, { label: t('field.cnss'), type: 'text' },
      { label: t('field.start_date'), type: 'date' }, { label: t('col.status'), type: 'text' }, { label: t('col.rest') + cur(), type: 'money' }],
    rows: rows.map((c) => [c.code, c.name, App.nm(c, 'legal_form'), c.phone, c.email, c.ice, c.if_code, c.rc, c.cnss, c.start_date,
      { text: t('status.' + c.status) + (c.status === 'INACTIVE' && c.status_date ? ' (' + App.dateText(c.status_date) + ')' : ''), tone: c.status === 'ACTIVE' ? 'green' : 'gray' }, c.total_rest]),
    totals: [t('common.totalN', { n: rows.length }), '', '', '', '', '', '', '', '', '', '', App.sum(rows, 'total_rest')],
  });

  const caSection = (label, rows, keyLabel, withCash = true) => {
    const columns = [{ label, type: 'text' }, { label: t('ca.due') + cur(), type: 'money' }, { label: t('ca.paid') + cur(), type: 'money' }, { label: t('ca.rest') + cur(), type: 'money' }];
    if (withCash) columns.push({ label: t('ca.cash') + cur(), type: 'money' });
    const data = rows.map((r) => { const x = [keyLabel(r), r.due, r.paid, r.rest]; if (withCash) x.push(r.cash); return x; });
    const totals = [t('common.total'), App.sum(rows, 'due'), App.sum(rows, 'paid'), App.sum(rows, 'rest')];
    if (withCash) totals.push(App.sum(rows, 'cash'));
    return { columns, rows: data, totals };
  };

  // ------------------------------------------------------------ exports depuis les écrans
  R.exportDues = (exp, title, rows, f) => R.run(exp, { title, fileName: title, filters: App.filterLabels(f), sections: [R.duesSection(rows)] });
  R.exportPayments = (exp, rows, f) => R.run(exp, {
    title: t('report.payments_journal'), fileName: t('report.payments_journal'),
    filters: [[t('field.client'), f.client_id ? ((App.state.clientCache || []).find((c) => String(c.id) === String(f.client_id)) || {}).name : t('common.allClients')], [t('common.year'), f.year || ''], [t('common.from'), App.dateText(f.from)], [t('common.to'), App.dateText(f.to)], [t('field.mode'), f.mode_id ? App.nm(App.lkById('payment_modes', f.mode_id)) : '']],
    sections: [R.paymentsSection(rows)],
  });
  R.exportRecovery = (exp, synth, f) => R.run(exp, {
    title: t('report.recovery') + ' — ' + t('recovery.byClient'), fileName: t('report.recovery'), filters: App.filterLabels(f),
    sections: [{
      columns: [{ label: t('col.client'), type: 'text' }, { label: t('col.openDues'), type: 'number' }, { label: t('col.oldestDue'), type: 'date' }, { label: t('col.due') + cur(), type: 'money' }, { label: t('col.paid') + cur(), type: 'money' }, { label: t('col.rest') + cur(), type: 'money' }, { label: t('col.lateAmount') + cur(), type: 'money' }, { label: t('col.maxLate'), type: 'number' }],
      rows: synth.map((r) => [r.client, r.count, r.oldest, r.due, r.paid, r.rest, r.late !== undefined ? r.late : r.overdue, r.max_late || '']),
      totals: [t('common.totalN', { n: synth.length }), App.sum(synth, 'count'), '', App.sum(synth, 'due'), App.sum(synth, 'paid'), App.sum(synth, 'rest'), App.sum(synth, (r) => (r.late !== undefined ? r.late : r.overdue)), ''],
    }],
  });
  R.exportCa = (exp, tab, data, f) => {
    const cl = f.client_id ? ((App.state.clientCache || []).find((c) => String(c.id) === String(f.client_id)) || {}).name : t('common.allClients');
    const filters = [[t('common.exercice'), data.year], [t('col.period'), f.period ? (f.period[0] === 'T' ? t('period.T', { n: f.period.slice(1), y: '' }).trim() : App.monthName(Number(f.period.slice(1)))) : ''], [t('field.client'), cl], [t('field.service'), f.service_id ? App.nm(App.lkById('services', f.service_id)) : ''], [t('field.category'), f.category_id ? App.nm(App.lkById('categories', f.category_id)) : '']];
    const map = {
      month: () => ({ title: t('report.ca_month'), s: caSection(t('ca.month'), data.months, (m) => `${App.monthName(m.month)} ${data.year}`) }),
      quarter: () => ({ title: t('report.ca_quarter'), s: caSection(t('ca.quarter'), data.quarters, (q) => t('period.T', { n: q.quarter, y: data.year })) }),
      client: () => ({ title: t('report.ca_client'), s: caSection(t('col.client'), data.by_client, (r) => r.client, false) }),
      service: () => ({ title: t('ca.by.service'), s: caSection(t('col.service'), data.by_service, (r) => App.nm(r, 'service'), false) }),
      year: () => ({ title: t('report.ca_year'), s: caSection(t('common.exercice'), data.by_year, (r) => String(r.year), false) }),
    };
    const x = map[tab]();
    R.run(exp, { title: x.title, fileName: x.title + ' ' + data.year, filters, landscape: false,
      kpis: [[t('ca.totalDue', { y: data.year }), App.moneyText(data.total.due)], [t('ca.totalPaid'), App.moneyText(data.total.paid)], [t('ca.totalRest'), App.moneyText(data.total.rest)], [t('ca.totalCash', { y: data.year }), App.moneyText(data.total.cash)]],
      sections: [x.s] });
  };

  // ------------------------------------------------------------ catalogue des rapports
  const clientName = (id) => ((App.state.clientCache || []).find((c) => String(c.id) === String(id)) || {}).name || '';
  const yearOr = (f) => (f.year ? Number(f.year) : null);

  R.catalog = [
    { id: 'clients_active', ic: 'user-check', filters: ['legal_form'], build: async (f) => {
      const rows = await App.api('clients.list', { status: 'ACTIVE', legal_form_id: f.legal_form_id });
      return { landscape: true, sections: [clientsSection(rows)] };
    } },
    { id: 'clients_inactive', ic: 'user-x', filters: ['legal_form'], build: async (f) => {
      const rows = await App.api('clients.list', { status: 'INACTIVE', legal_form_id: f.legal_form_id });
      return { sections: [clientsSection(rows)] };
    } },
    { id: 'client_situation', ic: 'user', filters: ['client*', 'yearAll'], build: async (f) => {
      if (!f.client_id) throw Object.assign(new Error('REQUIRED'), { code: 'REQUIRED', params: { field: 'client' } });
      const s = await App.api('situation.get', Number(f.client_id), { year: yearOr(f) });
      const c = s.client;
      return {
        subtitle: `${c.name} — ${[c.code, App.nm(c, 'legal_form'), c.ice && 'ICE ' + c.ice, c.if_code && 'IF ' + c.if_code, c.rc && 'RC ' + c.rc].filter(Boolean).join(' · ')}`,
        fileName: t('report.client_situation') + ' - ' + c.name,
        kpis: [[t('client.totalDue'), App.moneyText(s.totals.due)], [t('client.totalPaid'), App.moneyText(s.totals.paid)], [t('client.totalRest'), App.moneyText(s.totals.rest)],
          ...(f.year ? [[t('client.previousShort'), App.moneyText(s.previous_balance)], [t('client.totalGeneral'), App.moneyText(s.previous_balance + s.totals.rest)]] : []),
          [t('client.credit'), App.moneyText(s.credit)]],
        sections: [R.duesSection(s.dues, { client: false, details: true, title: t('client.situation') }), R.paymentsSection(s.payments.filter((p) => !p.voided && (!f.year || p.pay_date.startsWith(String(f.year)) || (p.allocations || []).some((a) => String(a.year) === String(f.year)))), { client: false, title: t('client.paymentsTitle') })],
      };
    } },
    { id: 'unpaid', ic: 'circle-alert', filters: ['yearAll', 'client', 'service', 'client_status'], build: async (f) => {
      const rows = await App.api('dues.list', Object.assign({}, f, { overdue_only: true, order: 'client' }));
      return { sections: [R.duesSection(rows)] };
    } },
    { id: 'payments_state', ic: 'wallet', filters: ['year', 'client', 'service', 'status', 'client_status'], build: async (f) => {
      const rows = await App.api('dues.list', Object.assign({}, f, { order: 'client' }));
      return { kpis: [[t('col.due'), App.moneyText(App.sum(rows, 'amount'))], [t('col.paid'), App.moneyText(App.sum(rows, 'paid'))], [t('col.rest'), App.moneyText(App.sum(rows, 'rest'))]], sections: [R.duesSection(rows, { details: false })] };
    } },
    { id: 'dues_state', ic: 'calendar-clock', filters: ['from', 'to', 'yearAll', 'client', 'service', 'status'], build: async (f) => {
      const rows = await App.api('dues.list', Object.assign({}, f, { order: 'date' }));
      return { sections: [R.duesSection(rows)] };
    } },
    { id: 'late', ic: 'triangle-alert', filters: ['yearAll', 'client', 'service', 'client_status'], build: async (f) => {
      const rows = await App.api('dues.list', Object.assign({}, f, { status: 'LATE', order: 'late' }));
      return { sections: [R.duesSection(rows)] };
    } },
    { id: 'recovery', ic: 'hand-coins', filters: ['yearAll', 'client_status'], build: async (f) => {
      const rows = await App.api('reports.recovery', { year: yearOr(f), client_status: f.client_status });
      return {
        kpis: [[t('recovery.toRecover'), App.moneyText(App.sum(rows, 'rest'))], [t('dash.unpaid'), App.moneyText(App.sum(rows, 'overdue'))], [t('recovery.nClients', { n: rows.length }), '']],
        sections: [{
          columns: [{ label: t('col.client'), type: 'text' }, { label: t('col.openDues'), type: 'number' }, { label: t('col.oldestDue'), type: 'date' }, { label: t('col.due') + cur(), type: 'money' }, { label: t('col.paid') + cur(), type: 'money' }, { label: t('col.rest') + cur(), type: 'money' }, { label: t('dash.unpaid') + cur(), type: 'money' }, { label: t('dash.noDue') + cur(), type: 'money' }, { label: t('col.maxLate'), type: 'number' }],
          rows: rows.map((r) => [r.client, r.count, r.oldest, r.due, r.paid, r.rest, r.overdue, r.no_due || 0, r.max_late || '']),
          totals: [t('common.totalN', { n: rows.length }), App.sum(rows, 'count'), '', App.sum(rows, 'due'), App.sum(rows, 'paid'), App.sum(rows, 'rest'), App.sum(rows, 'overdue'), App.sum(rows, 'no_due'), ''],
        }],
      };
    } },
    { id: 'ca_client', ic: 'users', filters: ['year', 'service', 'client_status'], build: async (f) => {
      const d = await App.api('ca.get', f);
      return { landscape: false, sections: [caSection(t('col.client'), d.by_client, (r) => r.client, false)] };
    } },
    { id: 'ca_month', ic: 'chart-column', filters: ['year', 'client', 'service'], build: async (f) => {
      const d = await App.api('ca.get', f);
      return { landscape: false, sections: [caSection(t('ca.month'), d.months, (m) => `${App.monthName(m.month)} ${d.year}`)] };
    } },
    { id: 'ca_quarter', ic: 'chart-column', filters: ['year', 'client', 'service'], build: async (f) => {
      const d = await App.api('ca.get', f);
      return { landscape: false, sections: [caSection(t('ca.quarter'), d.quarters, (q) => t('period.T', { n: q.quarter, y: d.year }))] };
    } },
    { id: 'ca_year', ic: 'trending-up', filters: ['client', 'service'], build: async (f) => {
      const d = await App.api('ca.get', Object.assign({ year: App.state.year }, f));
      return { landscape: false, sections: [caSection(t('common.exercice'), d.by_year, (r) => String(r.year), false)] };
    } },
    { id: 'year_situation', ic: 'layers', filters: ['year', 'client_status'], build: async (f) => {
      const rows = await App.api('reports.yearSituation', { year: f.year, client_status: f.client_status });
      return {
        sections: [{
          columns: [{ label: t('col.client'), type: 'text' }, { label: t('col.status'), type: 'text' }, { label: t('client.previousShort') + cur(), type: 'money' }, { label: t('col.due') + ' ' + f.year + cur(), type: 'money' }, { label: t('col.paid') + cur(), type: 'money' }, { label: t('col.rest') + ' ' + f.year + cur(), type: 'money' }, { label: t('client.totalGeneral') + cur(), type: 'money' }],
          rows: rows.map((r) => [r.client, { text: t('status.' + r.status), tone: r.status === 'ACTIVE' ? 'green' : 'gray' }, r.previous, r.due, r.paid, r.rest, r.total]),
          totals: [t('common.totalN', { n: rows.length }), '', App.sum(rows, 'previous'), App.sum(rows, 'due'), App.sum(rows, 'paid'), App.sum(rows, 'rest'), App.sum(rows, 'total')],
        }],
      };
    } },
    { id: 'payments_journal', ic: 'receipt', filters: ['from', 'to', 'yearAll', 'client', 'mode'], build: async (f) => {
      const q = Object.assign({}, f, { with_allocations: true });
      const rows = await App.api('payments.list', q);
      return { sections: [R.paymentsSection(rows)] };
    } },
  ];

  /** Libellés des filtres d'un rapport. */
  R.filterText = (f) => {
    const out = [];
    if (f.client_id) out.push([t('field.client'), clientName(f.client_id)]);
    if (f.year) out.push([t('common.exercice'), f.year]);
    if (f.from) out.push([t('common.from'), App.dateText(f.from)]);
    if (f.to) out.push([t('common.to'), App.dateText(f.to)]);
    if (f.service_id) out.push([t('field.service'), App.nm(App.lkById('services', f.service_id))]);
    if (f.status) out.push([t('col.status'), ['UPCOMING', 'DUE'].includes(f.status) ? t('timing.' + f.status) : t('status.' + f.status)]);
    if (f.client_status) out.push([t('field.clientStatus'), t('status.' + f.client_status)]);
    if (f.mode_id) out.push([t('field.mode'), App.nm(App.lkById('payment_modes', f.mode_id))]);
    if (f.legal_form_id) out.push([t('field.legal_form'), App.nm(App.lkById('legal_forms', f.legal_form_id))]);
    return out;
  };
})();
