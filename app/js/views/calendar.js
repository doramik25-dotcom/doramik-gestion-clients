/* DORAMIK GESTION CLIENTS — Calendrier des échéances et paiements */
(function () {
  'use strict';
  const { esc, t, icon } = App;

  App.views.calendar = async (root, params, query) => {
    const today = App.today();
    let ym = query.m && /^\d{4}-\d{2}$/.test(query.m) ? query.m : today.slice(0, 7);
    const st = { filings: true, dues: true, payments: true };

    const draw = async () => {
      const raw = await App.api('calendar.get', ym);
      // Filtre client courant : le calendrier reste sur le client sélectionné
      const cid = App.state.clientId;
      const keep = (x) => !cid || String(x.client_id) === String(cid);
      const data = cid
        ? { filings: raw.filings.filter(keep), dues: raw.dues.filter(keep), payments: raw.payments.filter(keep) }
        : raw;
      const [y, m] = ym.split('-').map(Number);
      const first = new Date(Date.UTC(y, m - 1, 1));
      const startDow = (first.getUTCDay() + 6) % 7; // lundi = 0
      const start = App.addDays(`${ym}-01`, -startDow);
      const byDay = {};
      const add = (d, item) => { (byDay[d] = byDay[d] || []).push(item); };
      if (st.filings) data.filings.forEach((d) => add(d.filing_date, { type: 'filing', d }));
      if (st.dues) data.dues.forEach((d) => { if (d.due_date) add(d.due_date, { type: 'due', d }); });
      if (st.payments) data.payments.forEach((p) => add(p.pay_date, { type: 'pay', p }));
      const chip = (it, idx, day) => {
        if (it.type === 'filing') {
          const f = it.d;
          return `<span class="chip b-blue" data-client="${f.client_id}" title="${esc(`${t('cal.filing')} : ${f.client} — ${App.serviceName(f)} ${App.periodLabel(f)}`)}">${icon('calendar-plus')} ${esc(f.client)}</span>`;
        }
        if (it.type === 'pay') return `<span class="chip b-green" data-client="${it.p.client_id}" title="${esc(`${it.p.client} — ${App.moneyText(it.p.amount)} (${App.nm(it.p, 'mode')})`)}">+ ${esc(App.fmtNumber(it.p.amount))} · ${esc(it.p.client)}</span>`;
        const d = it.d;
        const tone = App.statusTone(d.status === 'UNPAID' || d.status === 'PARTIAL' ? (d.timing === 'UPCOMING' ? (d.status === 'PARTIAL' ? 'PARTIAL' : 'DUE') : d.status) : d.status);
        return `<span class="chip b-${tone}" data-client="${d.client_id}" title="${esc(`${d.client} — ${App.serviceName(d)} ${App.periodLabel(d)} — ${t('col.rest')} ${App.moneyText(d.rest)} — ${t('status.' + d.status)}`)}">${esc(d.client)} · ${esc(App.fmtNumber(d.rest > 0 ? d.rest : d.amount))}</span>`;
      };
      let cells = '';
      const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const total = Math.ceil((startDow + dim) / 7) * 7;
      for (let i = 0; i < total; i++) {
        const day = App.addDays(start, i);
        const items = byDay[day] || [];
        const out = day.slice(0, 7) !== ym;
        cells += `<div class="day ${out ? 'out' : ''} ${day === today ? 'today' : ''}"><div class="dn">${Number(day.slice(8))}</div>
          ${items.slice(0, 4).map((it) => chip(it, i, day)).join('')}${items.length > 4 ? `<span class="chip more" data-day="${day}">${t('cal.more', { n: items.length - 4 })}</span>` : ''}</div>`;
      }
      const sumDue = App.sum(data.dues, 'amount');
      const sumRest = App.sum(data.dues, 'rest');
      const sumPay = App.sum(data.payments, 'amount');
      root.innerHTML = `<div class="page-head"><div><h1>${t('nav.calendar')}</h1><div class="sub">${t('cal.subtitle')}</div></div>
        <div class="actions"><button class="btn icon" data-nav="-1" title="${esc(t('cal.prev'))}">${icon(App.isAr() ? 'chevron-right' : 'chevron-left')}</button>
        <button class="btn" data-nav="0">${t('cal.today')}</button>
        <button class="btn icon" data-nav="1" title="${esc(t('cal.next'))}">${icon(App.isAr() ? 'chevron-left' : 'chevron-right')}</button>
        <input class="input" type="month" data-month value="${ym}" style="width:170px"></div></div>
        <div class="card" style="margin-bottom:16px"><div class="filters">
          <div class="field wide"><label>${t('field.client')}</label>${App.clientPicker('client_id', '', { placeholder: t('common.allClients'), sticky: true })}</div>
        </div></div>
        <div class="card"><div class="card-h"><h3>${esc(App.monthName(m))} ${y}</h3><span class="spacer"></span>
          <label class="check"><input type="checkbox" data-show="filings" ${st.filings ? 'checked' : ''}> ${t('cal.showFilings')}</label>
          <label class="check"><input type="checkbox" data-show="dues" ${st.dues ? 'checked' : ''}> ${t('cal.showDues')}</label>
          <label class="check"><input type="checkbox" data-show="payments" ${st.payments ? 'checked' : ''}> ${t('cal.showPayments')}</label></div>
          <div class="card-b" style="padding:10px 18px;border-bottom:1px solid var(--border)"><div class="row small">
            <span>${t('cal.filingsMonth', { n: data.filings.length })}</span><span>${t('cal.duesMonth', { n: data.dues.length })} : <b>${App.money(sumDue)}</b></span><span>${t('col.rest')} : <b>${App.money(sumRest)}</b></span><span>${t('cal.paysMonth', { n: data.payments.length })} : <b style="color:var(--green)">${App.money(sumPay)}</b></span>
            <span class="spacer"></span><span class="legend"><span><i class="dot" style="background:var(--red)"></i>${t('status.LATE')}</span><span><i class="dot" style="background:var(--orange)"></i>${t('status.PARTIAL')}</span><span><i class="dot" style="background:var(--blue)"></i>${t('cal.filing')}</span><span><i class="dot" style="background:var(--yellow)"></i>${t('cal.toPay')}</span><span><i class="dot" style="background:var(--green)"></i>${t('cal.paidOrReceived')}</span></span></div></div>
          <div class="cal">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<div class="dh">${t('dow.' + d)}</div>`).join('')}${cells}</div></div>`;
      App.bindClientPicker(root, () => draw());
    };

    root.addEventListener('click', async (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) {
        const k = Number(nav.dataset.nav);
        if (k === 0) ym = today.slice(0, 7);
        else { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + k, 1)); ym = d.toISOString().slice(0, 7); }
        return draw();
      }
      const cl = e.target.closest('[data-client]');
      if (cl) { App.go('#/client/' + cl.dataset.client); return; }
      const more = e.target.closest('[data-day]');
      if (more) App.go(`#/echeances?day=${more.dataset.day}`);
    });
    root.addEventListener('change', (e) => {
      if (e.target.matches('[data-month]') && e.target.value) { ym = e.target.value; draw(); }
      if (e.target.matches('[data-show]')) { st[e.target.dataset.show] = e.target.checked; draw(); }
    });
    await draw();
  };
})();
