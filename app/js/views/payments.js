/* DORAMIK GESTION CLIENTS — Paiements (journal des encaissements) */
(function () {
  'use strict';
  const { esc, t, icon } = App;

  App.views.payments = async (root) => {
    root.innerHTML = `<div class="page-head"><div><h1>${t('nav.payments')}</h1><div class="sub">${t('payments.subtitle')}</div></div>
      <div class="actions">${App.exportButtons()}<button class="btn success" data-new>${icon('plus')} ${t('pay.new')}</button></div></div>
      <div class="kpis" data-kpis style="margin-bottom:16px"></div>
      <div class="card"><div class="filters" data-filters>
        <div class="field wide"><label>${t('field.client')}</label>${App.clientPicker('client_id', '', { placeholder: t('common.allClients'), sticky: true })}</div>
        <div class="field"><label>${t('common.year')}</label><select class="input" name="year">${App.yearsOptions(App.state.year, true)}</select></div>
        <div class="field"><label>${t('common.from')}</label><input class="input" type="date" name="from"></div>
        <div class="field"><label>${t('common.to')}</label><input class="input" type="date" name="to"></div>
        <div class="field"><label>${t('field.mode')}</label><select class="input" name="mode_id">${App.options(App.lk('payment_modes'), '', { empty: t('common.all') })}</select></div>
        <div class="field"><label>${t('common.search')}</label><input class="input" name="q" placeholder="${esc(t('payments.searchPh'))}"></div>
        <label class="check" style="align-self:center"><input type="checkbox" name="include_voided"> ${t('payments.showVoided')}</label>
      </div><div data-t></div></div>`;
    App.bindClientPicker(root, () => load());
    let rows = [];
    const table = new App.Table(root.querySelector('[data-t]'), {
      rows: [], columns: App.paymentColumns({ client: true }), rowClass: (p) => (p.voided ? 'muted-row' : ''),
      onAction: async (act, p) => {
        if (act === 'client') App.go('#/client/' + p.client_id);
        if (act === 'receipt') return App.receipt.open(p.id);
        if (act === 'void' && await App.forms.voidPayment(p)) load();
      },
      onRowClick: (p) => App.go(`#/client/${p.client_id}?tab=payments`),
      empty: t('payments.empty'),
    });
    const filters = () => {
      const d = App.formData(root.querySelector('[data-filters]'));
      Object.keys(d).forEach((k) => { if (d[k] === '' || d[k] === false) delete d[k]; });
      return d;
    };
    const load = async () => {
      rows = await App.api('payments.list', Object.assign(filters(), { with_allocations: true }));
      const valid = rows.filter((p) => !p.voided);
      table.setRows(rows, { pay_date: t('common.totalN', { n: valid.length }), amount: App.sum(valid, 'amount') });
      const byMode = App.lk('payment_modes').map((m) => ({ m, v: App.sum(valid.filter((p) => p.mode_id === m.id), 'amount'), n: valid.filter((p) => p.mode_id === m.id).length })).filter((x) => x.n);
      root.querySelector('[data-kpis]').innerHTML = App.kpi({ label: t('payments.total'), value: App.money(App.sum(valid, 'amount')), sub: t('payments.nPayments', { n: valid.length }), ic: 'banknote', tone: 'green' }) +
        byMode.map((x) => App.kpi({ label: App.nm(x.m), value: App.money(x.v), sub: t('payments.nPayments', { n: x.n }), ic: x.m.kind === 'CHEQUE' ? 'receipt' : x.m.kind === 'TRANSFER' ? 'refresh-cw' : 'coins', tone: 'blue' })).join('') +
        App.kpi({ label: t('payments.advances'), value: App.money(App.sum(valid, (p) => p.amount - p.allocated)), sub: t('payments.advancesSub'), ic: 'wallet', tone: 'orange' });
    };
    const fEl = root.querySelector('[data-filters]');
    fEl.addEventListener('change', (e) => { if (!e.target.closest('[data-picker]') && e.target.name !== 'q') load(); });
    fEl.querySelector('[name=q]').addEventListener('input', App.debounce(load, 250));
    root.querySelector('[data-new]').addEventListener('click', async () => { if (await App.forms.payment({ clientId: App.state.clientId || '' })) App.refresh(); });
    App.on(root, 'click', '[data-exp]', (e, b) => App.reports.exportPayments(b.dataset.exp, rows.filter((p) => !p.voided), filters()));
    await load();
  };
})();
