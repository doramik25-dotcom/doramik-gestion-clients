/* DORAMIK GESTION CLIENTS — Tableau de bord */
(function () {
  'use strict';
  const { esc, t, icon } = App;

  App.views.dashboard = async (root) => {
    const year = App.state.year;
    const d = await App.api('dashboard.get', year);
    const s = App.state.settings;
    const m = (v) => App.money(v);
    const monthLabel = `${App.monthName(d.ref_month)} ${year}`;

    const notifBlock = (tone, ic, title, items, total, renderItem, empty) => `<div class="notif ${tone}">
      <div class="notif-h">${icon(ic)} ${esc(title)}<span class="cnt">${total}</span></div>
      <div class="notif-list">${items.length ? items.map(renderItem).join('') : `<div class="notif-empty">${esc(empty)}</div>`}</div></div>`;
    const dueItem = (x) => `<div class="notif-it" data-client="${x.client_id}" data-due="${x.id}"><div class="grow">
      <div class="row nowrap" style="gap:8px;align-items:flex-start"><span class="t grow">${esc(x.client)}</span><b class="amt-v">${App.money(x.rest)}</b></div>
      <div class="s">${esc(App.serviceName(x))} · ${esc(App.periodLabel(x))}</div>
      <div class="s">${t('col.filingDate')} ${App.date(x.filing_date)}${x.due_date ? ` · ${t('col.dueDateFees')} ${App.date(x.due_date)}` : ''} · ${t('col.fees')} ${App.money(x.amount)} · ${t('col.paid')} ${App.money(x.paid)}</div>
      <div class="row" style="gap:6px;margin-top:3px">${App.dueBadge(x)}${x.days_late ? `<span class="s" style="color:var(--red);font-weight:600">${t('common.days', { n: x.days_late })}</span>` : ''}</div></div></div>`;
    const filingItem = (x) => `<div class="notif-it" data-client="${x.client_id}" data-due="${x.id}"><div class="grow">
      <div class="row nowrap" style="gap:8px;align-items:flex-start"><span class="t grow">${esc(x.client)}</span><b class="amt-v">${App.date(x.filing_date)}</b></div>
      <div class="s">${esc(App.serviceName(x))} · ${esc(App.periodLabel(x))}</div>
      <div class="s">${t('col.fees')} ${App.money(x.amount)} · ${t('col.rest')} ${App.money(x.rest)}</div></div></div>`;
    const payItem = (p) => `<div class="notif-it" data-client="${p.client_id}"><div class="grow">
      <div class="row nowrap" style="gap:8px;align-items:flex-start"><span class="t grow">${esc(p.client)}</span><b class="amt-v" style="color:var(--green)">+ ${App.money(p.amount)}</b></div>
      <div class="s">${App.date(p.pay_date)} · ${esc(App.nm(p, 'mode'))}</div>
      ${p.allocations && p.allocations.length ? `<div class="s">${esc(p.allocations.map((a) => `${App.isAr() && a.service_ar ? a.service_ar : a.service} ${App.periodLabel(a)}`).join(', '))}</div>` : ''}</div></div>`;

    const blocks = [];
    if (s.notif_late !== '0') blocks.push(notifBlock('red', 'circle-alert', t('dash.nLate'), d.notifications.late, d.notifications.late_total, dueItem, t('dash.nLateEmpty')));
    if (s.notif_partial !== '0') blocks.push(notifBlock('orange', 'coins', t('dash.nPartial'), d.notifications.partial, d.payments.partial_count, dueItem, t('dash.nPartialEmpty')));
    if (s.notif_upcoming !== '0') blocks.push(notifBlock('yellow', 'clock', t('dash.nUpcoming', { n: s.upcoming_days || 30 }), d.notifications.upcoming, d.notifications.upcoming_total, dueItem, t('dash.nUpcomingEmpty')));
    if (s.notif_upcoming !== '0') blocks.push(notifBlock('blue', 'calendar-plus', t('dash.nFiling'), d.notifications.filing, d.notifications.filing_total, filingItem, t('dash.nFilingEmpty')));
    blocks.push(notifBlock('gray', 'circle-alert', t('dash.nNoDue'), d.notifications.no_due, d.notifications.no_due_total, dueItem, t('dash.nNoDueEmpty')));
    if (s.notif_received !== '0') blocks.push(notifBlock('green', 'circle-check-big', t('dash.nReceived'), d.notifications.received, d.notifications.received.length, payItem, t('dash.nReceivedEmpty')));

    root.innerHTML = `
      <div class="page-head"><div><h1>${t('nav.dashboard')}</h1><div class="sub">${t('dash.subtitle', { y: year, d: App.dateText(d.today) })}</div></div>
        <div class="actions">
          <button class="btn" data-new-client>${icon('plus')} ${t('client.new')}</button>
          <button class="btn" data-oneoff>${icon('file-plus')} ${t('oneoff.new')}</button>
          <button class="btn success" data-pay>${icon('hand-coins')} ${t('pay.new')}</button>
        </div></div>
      ${d.clients.total === 0 && App.gd && !(App.gd.st && App.gd.st.connected) ? `<div class="notice info gd-banner" data-gd-banner>${icon('cloud-download')}<div class="grow"><b>${t('gd.banner.title')}</b><br>${t('gd.banner.body')}</div><button class="btn primary" data-gd-recover>${icon('cloud-download')} ${t('gd.banner.btn')}</button></div>` : ''}

      <div class="kpi-group"><div class="section-title">${icon('users')} ${t('dash.clients')}</div><div class="kpis">
        ${App.kpi({ label: t('dash.totalClients'), value: d.clients.total, ic: 'users', tone: 'blue', href: '#/clients' })}
        ${App.kpi({ label: t('dash.activeClients'), value: d.clients.active, ic: 'user-check', tone: 'green', href: '#/clients?status=ACTIVE' })}
        ${App.kpi({ label: t('dash.inactiveClients'), value: d.clients.inactive, ic: 'user-x', tone: 'gray', href: '#/clients?status=INACTIVE' })}
      </div></div>

      <div class="kpi-group"><div class="section-title">${icon('wallet')} ${t('dash.payments')}</div><div class="kpis">
        ${App.kpi({ label: t('dash.cash'), value: m(d.payments.cash), sub: t('dash.cashSub', { y: year }), ic: 'banknote', tone: 'green', href: '#/paiements' })}
        ${App.kpi({ label: t('dash.rest'), value: m(d.payments.rest), sub: d.payments.rest_previous ? t('dash.restSub', { a: App.moneyText(d.payments.rest_previous) }) : t('dash.restSub0'), ic: 'wallet', tone: 'blue', href: '#/recouvrement' })}
        ${App.kpi({ label: t('dash.unpaid'), value: m(d.payments.unpaid), sub: t('dash.unpaidSub'), ic: 'circle-alert', tone: 'red', href: '#/recouvrement?overdue=1' })}
        ${App.kpi({ label: t('dash.partial'), value: d.payments.partial_count, sub: t('dash.partialSub', { a: App.moneyText(d.payments.partial_rest) }), ic: 'coins', tone: 'orange', href: '#/recouvrement?status=PARTIAL' })}
      </div></div>

      <div class="kpi-group"><div class="section-title">${icon('calendar-clock')} ${t('dash.dues')}</div><div class="kpis">
        ${App.kpi({ label: t('dash.filing', { n: s.upcoming_days || 30 }), value: d.dues.filing.n, sub: t('dash.filingSub'), ic: 'calendar-plus', tone: 'blue', href: '#/echeances?view=filing' })}
        ${App.kpi({ label: t('dash.upcoming', { n: s.upcoming_days || 30 }), value: d.dues.upcoming.n, sub: m(d.dues.upcoming.amount), ic: 'clock', tone: 'yellow', href: '#/echeances?status=UPCOMING' })}
        ${App.kpi({ label: t('dash.today'), value: d.dues.today.n, sub: m(d.dues.today.amount), ic: 'calendar-days', tone: 'blue', href: '#/echeances?day=today' })}
        ${App.kpi({ label: t('dash.late'), value: d.dues.late.n, sub: t('dash.lateSub', { a: App.moneyText(d.dues.late.amount), n: d.dues.late.clients }), ic: 'triangle-alert', tone: 'red', href: '#/recouvrement?status=LATE' })}
        ${App.kpi({ label: t('dash.noDue'), value: d.dues.no_due.n, sub: m(d.dues.no_due.amount), ic: 'circle-alert', tone: 'gray', href: '#/recouvrement?status=NO_DUE' })}
      </div></div>

      <div class="kpi-group"><div class="section-title">${icon('trending-up')} ${t('dash.ca')}</div><div class="kpis">
        ${App.kpi({ label: t('dash.caMonth', { m: monthLabel }), value: m(d.ca.month.due), sub: t('dash.caSub', { p: App.moneyText(d.ca.month.paid), c: App.moneyText(d.ca.month.cash) }), ic: 'chart-column', tone: 'blue', href: '#/ca' })}
        ${App.kpi({ label: t('dash.caQuarter', { q: d.ref_quarter, y: year }), value: m(d.ca.quarter.due), sub: t('dash.caSub', { p: App.moneyText(d.ca.quarter.paid), c: App.moneyText(d.ca.quarter.cash) }), ic: 'chart-column', tone: 'blue', href: '#/ca' })}
        ${App.kpi({ label: t('dash.caYear', { y: year }), value: m(d.ca.year.due), sub: t('dash.caSub', { p: App.moneyText(d.ca.year.paid), c: App.moneyText(d.ca.year.cash) }), ic: 'trending-up', tone: 'green', href: '#/ca' })}
      </div></div>

      <div class="card" style="margin-bottom:18px"><div class="card-h"><h3>${icon('info')} ${t('dash.notifications')}</h3></div><div class="card-b"><div class="notif-grid">${blocks.join('') || `<div class="muted">${t('dash.notifDisabled')}</div>`}</div></div></div>
      <div class="card"><div class="card-h"><h3>${t('dash.chartTitle', { y: year })}</h3></div><div class="card-b">
          ${App.barChart({ labels: d.chart.map((x) => t('monthShort.' + x.month)), height: 240, series: [
            { name: t('ca.due'), color: '#93c5fd', values: d.chart.map((x) => x.due) },
            { name: t('ca.paid'), color: '#1e40af', values: d.chart.map((x) => x.paid) },
            { name: t('ca.cash'), color: '#16a34a', values: d.chart.map((x) => x.cash) },
          ] })}</div></div>`;

    root.querySelectorAll('[data-href]').forEach((el) => el.addEventListener('click', () => App.go(el.dataset.href)));
    App.on(root, 'click', '.notif-it', (e, el) => {
      if (el.dataset.due) App.forms.due(Number(el.dataset.due)).then((ch) => ch && App.refresh());
      else App.go('#/client/' + el.dataset.client);
    });
    const gdb = root.querySelector('[data-gd-recover]');
    if (gdb) gdb.addEventListener('click', async () => { await App.gd.connect(); });
    root.querySelector('[data-new-client]').addEventListener('click', async () => { const id = await App.forms.client(); if (id) App.go('#/client/' + id); });
    root.querySelector('[data-pay]').addEventListener('click', async () => { if (await App.forms.payment()) App.refresh(); });
    root.querySelector('[data-oneoff]').addEventListener('click', async () => { if (await App.forms.oneOff()) App.refresh(); });
  };
})();
