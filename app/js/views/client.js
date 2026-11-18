/* DORAMIK GESTION CLIENTS — Fiche client : situation, honoraires, paiements, documents, historique */
(function () {
  'use strict';
  const { esc, t, icon } = App;

  const TABS = [
    ['situation', 'list-checks'], ['fees', 'briefcase'], ['payments', 'wallet'], ['documents', 'paperclip'], ['history', 'history'], ['info', 'info'],
  ];
  const DOC_TYPES = ['PDF', 'IMAGE', 'ADMIN', 'CONTRACT', 'OTHER'];

  App.views.client = async (root, params, query) => {
    const id = Number(params.id);
    // Ce client devient le client courant : il le reste après chaque opération et dans les autres modules
    // Après une opération (enregistrement, modification, suppression) on revient sur le même
    // client, le même onglet et le même exercice ; une nouvelle navigation repart de la situation.
    const keepCtx = !!App.current.isRefresh && App.state.clientId === id;
    App.setCurrentClient(id);
    const state = {
      tab: query.tab || (keepCtx && App.state.clientTab) || 'situation',
      year: query.year !== undefined ? query.year : (keepCtx ? App.state.clientYear || '' : ''),
      feesYear: keepCtx && App.state.clientFeesYear ? App.state.clientFeesYear : App.state.year,
    };
    App.state.clientTab = state.tab;
    App.state.clientYear = state.year;
    App.state.clientFeesYear = state.feesYear;
    let sit;

    const load = async () => {
      sit = await App.api('situation.get', id, { year: state.year ? Number(state.year) : null });
    };
    await load();

    const draw = () => {
      const c = sit.client;
      const all = sit;
      root.innerHTML = `
        <div class="card" style="margin-bottom:16px"><div class="card-b">
          <div class="client-head">
            <div class="avatar">${esc(App.initials(c.name))}</div>
            <div class="grow">
              <div class="row"><h1>${esc(c.name)}</h1>${App.badge(c.status)}${c.legal_form ? `<span class="badge b-blue">${esc(App.nm(c, 'legal_form'))}</span>` : ''}</div>
              <div class="muted small ltr" style="margin-top:4px">${esc([c.code, c.ice && 'ICE ' + c.ice, c.if_code && 'IF ' + c.if_code, c.rc && 'RC ' + c.rc, c.cnss && 'CNSS ' + c.cnss].filter(Boolean).join(' · '))}</div>
              <div class="muted small" style="margin-top:2px">${[c.phone && `${icon('phone')} <span class="ltr">${esc(c.phone)}</span>`, c.email && `${icon('mail')} <span class="ltr">${esc(c.email)}</span>`, c.address && `${icon('map-pin')} ${esc(c.address)}`, c.start_date && `${t('field.start_date')} : ${App.date(c.start_date)}`].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>
            </div>
            <div class="stack" style="gap:8px;min-width:280px">
              <div class="field" style="min-width:260px"><label>${t('client.switch')}</label>${App.clientPicker('switch_client', c.id, { allowEmpty: false, sticky: true })}</div>
            <div class="row" style="justify-content:flex-end">
              <button class="btn" data-a="edit">${icon('pencil')} ${t('btn.edit')}</button>
              <button class="btn" data-a="status">${icon(c.status === 'ACTIVE' ? 'user-x' : 'user-check')} ${c.status === 'ACTIVE' ? t('client.deactivate') : t('client.activate')}</button>
              <button class="btn" data-a="export">${icon('printer')} ${t('client.printSituation')}</button>
            </div></div>
          </div>
          <div class="row" style="margin-top:14px">
            <button class="btn success" data-a="pay">${icon('hand-coins')} ${t('pay.new')}</button>
            <button class="btn" data-a="sub">${icon('calendar-plus')} ${t('sub.add')}</button>
            <button class="btn" data-a="oneoff">${icon('file-plus')} ${t('oneoff.new')}</button>
          </div>
        </div></div>
        <div class="kpis five" style="margin-bottom:16px">
          ${App.kpi({ label: t('client.totalDue') + (state.year ? ` (${state.year})` : ''), value: App.money(all.totals.due), ic: 'receipt', tone: 'blue' })}
          ${App.kpi({ label: t('client.totalPaid') + (state.year ? ` (${state.year})` : ''), value: App.money(all.totals.paid), ic: 'banknote', tone: 'green' })}
          ${App.kpi({ label: t('client.totalRest') + (state.year ? ` (${state.year})` : ''), value: App.money(all.totals.rest), sub: state.year && all.previous_balance ? t('client.previous', { a: App.moneyText(all.previous_balance) }) : '', ic: 'wallet', tone: 'orange' })}
          ${App.kpi({ label: t('client.overdue'), value: App.money(all.totals.late), sub: all.totals.no_due ? t('dash.noDue') + ' : ' + App.moneyText(all.totals.no_due) : t('client.globalBalance', { a: App.moneyText(all.total_balance) }), ic: 'circle-alert', tone: all.totals.late ? 'red' : 'gray' })}
          ${App.kpi({ label: t('client.credit'), value: App.money(all.credit), sub: all.credit > 0 && all.total_balance > 0 ? `<a data-a="credit">${t('pay.applyCredit')}</a>` : t('client.creditSub'), ic: 'coins', tone: all.credit > 0 ? 'green' : 'gray' })}
        </div>
        <div class="tabs">${TABS.map(([k, ic]) => `<button data-tab="${k}" class="${state.tab === k ? 'on' : ''}">${icon(ic)} ${t('client.tab.' + k)}</button>`).join('')}</div>
        <div data-body></div>`;
      // Changer de client ou en créer un sans quitter la fiche
      App.bindClientPicker(root, (cid) => { if (cid && String(cid) !== String(id)) App.go('#/client/' + cid); });
      drawTab();
    };

    const yearSeg = (cur, withAll = true) => `<div class="seg" data-yseg>${withAll ? `<button data-y="" class="${!cur ? 'on' : ''}">${t('common.allYears')}</button>` : ''}
      ${[...new Set([...sit.years, ...App.lk('years').map((y) => y.year)])].sort((a, b) => b - a).map((y) => `<button data-y="${y}" class="${String(cur) === String(y) ? 'on' : ''}">${y}</button>`).join('')}</div>`;

    const drawTab = async () => {
      const body = root.querySelector('[data-body]');
      const c = sit.client;
      if (state.tab === 'situation') {
        body.innerHTML = `<div class="card"><div class="card-h"><h3>${t('client.situation')}</h3><span class="spacer"></span>${yearSeg(state.year)}</div>
          ${state.year && sit.previous_balance ? `<div class="card-b" style="padding-bottom:0"><div class="notice warn">${icon('info')}<div>${t('client.previousNotice', { y: state.year, a: App.moneyText(sit.previous_balance), t: App.moneyText(sit.previous_balance + sit.totals.rest) })}</div></div></div>` : ''}
          <div data-t></div></div>`;
        const cols = App.dueColumns({ client: false, fees: true });
        // Détail des paiements : date, montant, mode, référence
        cols.splice(7, 0, { key: 'allocations', label: t('col.paymentsDone'), sortable: false, render: (d) => d.allocations.map((a) => `<div class="cell-sub">${App.date(a.pay_date)} · ${App.money(a.amount)}<br>${esc(App.nm(a, 'mode'))}${a.cheque_no || a.transfer_ref ? ' · <span class="ltr">' + esc(a.cheque_no || a.transfer_ref) + '</span>' : ''}</div>`).join('') });
        new App.Table(body.querySelector('[data-t]'), {
          rows: sit.dues, columns: cols, totals: { service: t('common.total'), ...App.dueTotals(sit.dues) },
          onAction: (act, d) => App.onDueAction(act, d),
          onRowClick: (d) => App.forms.due(d.id).then((ch) => ch && App.refresh()),
          empty: t('client.noDues'),
        });
      } else if (state.tab === 'fees') {
        const y = state.feesYear;
        const [subs, cy] = await Promise.all([App.api('subscriptions.list', { client_id: id, year: y }), App.api('clientYears.get', id, y)]);
        const per = cy && App.lkById('periodicities', cy.periodicity_id);
        const yearInfo = App.lk('years').find((x) => x.year === Number(y));
        body.innerHTML = `<div class="stack">
          <div class="card"><div class="card-h"><h3>${t('fees.yearConfig')}</h3><span class="spacer"></span>${yearSeg(y, false)}</div>
            <div class="card-b"><div class="row">
              <div class="grow"><div class="kv-list">
                <div><div class="k">${t('common.exercice')}</div><div class="v">${y} ${yearInfo && yearInfo.status === 'CLOSED' ? App.badge('INACTIVE', t('year.closed')) : ''}</div></div>
                <div><div class="k">${t('field.periodicity')}</div><div class="v"><b>${per ? esc(App.nm(per)) : `<span class="muted">${t('fees.notSet')}</span>`}</b></div></div>
                <div><div class="k">${t('field.start_date')}</div><div class="v">${cy && cy.start_date ? App.date(cy.start_date) : (c.start_date ? App.date(c.start_date) : '—')}</div></div>
                ${cy && cy.notes ? `<div><div class="k">${t('field.notes')}</div><div class="v">${esc(cy.notes)}</div></div>` : ''}
              </div></div>
              ${yearInfo && yearInfo.status === 'OPEN' ? `<button class="btn" data-a="cy">${icon('pencil')} ${t('fees.editPeriodicity')}</button>` : ''}
            </div></div></div>
          <div class="card"><div class="card-h"><h3>${t('fees.subs', { y })}</h3><span class="spacer"></span>
            ${yearInfo && yearInfo.status === 'OPEN' ? `<button class="btn primary sm" data-a="sub">${icon('plus')} ${t('sub.add')}</button><button class="btn sm" data-a="oneoff">${icon('file-plus')} ${t('oneoff.new')}</button>` : ''}</div>
            <div data-t></div></div></div>`;
        new App.Table(body.querySelector('[data-t]'), {
          rows: subs,
          columns: [
            { key: 'service', label: t('col.service'), render: (s) => `<b>${esc(App.nm(s, 'service'))}</b><div class="cell-sub">${esc(App.nm(s, 'category'))}</div>` },
            { key: 'periodicity', label: t('field.periodicity'), render: (s) => esc(App.nm(s, 'periodicity')) },
            { key: 'amount', label: t('col.amountPerPeriod'), type: 'money' },
            { key: 'start_date', label: t('fees.validity'), render: (s) => `${App.date(s.start_date) || '—'} → ${App.date(s.end_date) || '…'}` },
            { key: 'filing_months', label: t('col.filingDate'), sortable: false, render: (s) => esc(App.filingRuleText(s)) },
            { key: 'due_mode', label: t('col.dueDateFees'), sortable: false, render: (s) => esc(t('due.mode.' + (s.due_mode || 'NONE')) + (s.due_mode === 'OFFSET' ? ` (+${s.due_offset} ${t('common.daysShort')})` : '')) },
            { key: 'dues_count', label: t('col.duesCount'), type: 'number' },
            { key: 'active', label: t('col.status'), render: (s) => (s.active ? App.badge('ACTIVE', t('sub.active')) : App.badge('INACTIVE', t('sub.stopped'))) },
            { key: '', actions: true, render: (s) => `<button class="btn sm" data-act="edit">${icon('pencil')} ${t('btn.edit')}</button>${s.active ? `<button class="btn sm icon" data-act="gen" title="${esc(t('sub.generate') + ' — ' + t('sub.generateHint'))}">${icon('refresh-cw')}</button><button class="btn sm icon danger" data-act="stop" title="${esc(t('sub.stop'))}">${icon('ban')}</button>` : `<button class="btn sm" data-act="resume">${t('sub.resume')}</button>`}${s.dues_count === 0 ? `<button class="btn sm icon danger" data-act="del" title="${esc(t('sub.delete'))}">${icon('trash-2')}</button>` : ''}` },
          ],
          empty: t('fees.noSubs'),
          onAction: async (act, s) => {
            try {
              if (act === 'edit') { if (await App.forms.subscription({ clientId: id, sub: s })) App.refresh(); }
              if (act === 'gen') { const n = await App.safe(() => App.api('subscriptions.generate', s.id)); App.toast(t('msg.generated', { n })); App.refresh(); }
              if (act === 'stop') { if (await App.confirm(t('sub.stopConfirm'))) { await App.safe(() => App.api('subscriptions.setActive', s.id, false)); App.refresh(); } }
              if (act === 'resume') { await App.safe(() => App.api('subscriptions.setActive', s.id, true)); App.refresh(); }
              if (act === 'del' && await App.confirm(t('sub.deleteConfirm'), { danger: true, okLabel: t('btn.delete') })) {
                await App.safe(() => App.api('subscriptions.remove', s.id));
                App.toast(t('msg.deleted'));
                App.refresh();
              }
            } catch (e) { /* */ }
          },
        });
        const cyBtn = body.querySelector('[data-a=cy]');
        if (cyBtn) cyBtn.addEventListener('click', async () => { if (await App.forms.clientYear(id, y, cy)) App.refresh(); });
      } else if (state.tab === 'payments') {
        body.innerHTML = `<div class="card"><div class="card-h"><h3>${t('client.paymentsTitle')}</h3><span class="spacer"></span><button class="btn success sm" data-a="pay">${icon('plus')} ${t('pay.new')}</button></div><div data-t></div></div>`;
        const rows = sit.payments;
        new App.Table(body.querySelector('[data-t]'), {
          rows,
          rowClass: (p) => (p.voided ? 'muted-row' : ''),
          columns: App.paymentColumns({ client: false }),
          totals: { pay_date: t('common.total'), amount: App.sum(rows.filter((p) => !p.voided), 'amount') },
          empty: t('client.noPayments'),
          onAction: async (act, p) => {
            if (act === 'receipt') return App.receipt.open(p.id);
            if (act === 'void' && await App.forms.voidPayment(p)) App.refresh();
          },
        });
      } else if (state.tab === 'documents') {
        const docs = await App.api('documents.list', id);
        body.innerHTML = `<div class="card"><div class="card-h"><h3>${t('client.documents')}</h3><span class="spacer"></span><button class="btn primary sm" data-a="adddoc">${icon('upload')} ${t('docs.add')}</button></div><div data-t></div></div>`;
        new App.Table(body.querySelector('[data-t]'), {
          rows: docs,
          columns: [
            { key: 'title', label: t('docs.title'), render: (d) => `<b>${esc(d.title)}</b><div class="cell-sub">${esc(d.file_name)}</div>` },
            { key: 'doc_type', label: t('docs.type'), render: (d) => `<span class="badge b-blue">${esc(t('docType.' + (d.doc_type || 'OTHER')))}</span>` },
            { key: 'size', label: t('docs.size'), type: 'number', render: (d) => `<span class="ltr">${(d.size / 1024).toFixed(0)} Ko</span>` },
            { key: 'added_at', label: t('docs.added'), render: (d) => `<span class="ltr">${App.dateTime(d.added_at)}</span>` },
            { key: 'notes', label: t('field.notes') },
            { key: '', actions: true, render: () => `<button class="btn sm" data-act="open">${icon('external-link')} ${t('docs.open')}</button><button class="btn sm icon" data-act="save" title="${esc(t('docs.saveAs'))}">${icon('download')}</button><button class="btn sm icon danger" data-act="del" title="${esc(t('docs.remove'))}">${icon('trash-2')}</button>` },
          ],
          empty: t('docs.empty'),
          onRowClick: (d) => window.doramik.docs.open(d.id).catch((e) => App.toast(App.errorText(e), 'err')),
          onAction: async (act, d) => {
            try {
              if (act === 'open') await window.doramik.docs.open(d.id);
              if (act === 'save') { const p = await window.doramik.docs.saveAs(d.id); if (p) App.toast(t('msg.savedTo', { p })); }
              if (act === 'del' && await App.confirm(t('docs.removeConfirm', { t: d.title }), { danger: true, okLabel: t('docs.remove') })) {
                await App.api('documents.remove', d.id); App.toast(t('msg.docRemoved')); drawTab();
              }
            } catch (e) { App.toast(App.errorText(e), 'err'); }
          },
        });
      } else if (state.tab === 'history') {
        const h = await App.api('history.list', { client_id: id, limit: 1000 });
        body.innerHTML = `<div class="card"><div class="card-h"><h3>${t('client.history')}</h3></div><div class="card-b">
          ${h.length ? `<div class="timeline">${h.map((x) => { const r = App.historyText(x); return `<div class="tl-it ${r.tone}"><div class="tt">${esc(r.title)}</div><div class="ts ltr">${App.dateTime(x.ts)}</div>${r.detail ? `<div class="td">${r.detail}</div>` : ''}</div>`; }).join('')}</div>` : `<div class="muted">${t('common.noData')}</div>`}
          </div></div>`;
      } else if (state.tab === 'info') {
        const kv = (k, v) => `<div><div class="k">${esc(k)}</div><div class="v">${v || '<span class="muted">—</span>'}</div></div>`;
        body.innerHTML = `<div class="card"><div class="card-h"><h3>${t('client.tab.info')}</h3><span class="spacer"></span><button class="btn sm" data-a="edit">${icon('pencil')} ${t('btn.edit')}</button></div><div class="card-b stack">
          <div class="kv-list">
            ${kv(t('field.name'), esc(c.name))}${kv(t('col.code'), `<span class="ltr">${esc(c.code)}</span>`)}${kv(t('field.legal_form'), esc(App.nm(c, 'legal_form')))}
            ${kv(t('field.status'), App.badge(c.status) + (c.status_date ? ` <span class="muted small">${t('common.since')} ${App.date(c.status_date)}</span>` : ''))}
            ${kv(t('field.phone'), `<span class="ltr">${esc(c.phone || '')}</span>`)}${kv(t('field.email'), `<span class="ltr">${esc(c.email || '')}</span>`)}${kv(t('field.address'), esc(c.address || ''))}
            ${kv('ICE', `<span class="ltr">${esc(c.ice || '')}</span>`)}${kv(t('field.if_code'), `<span class="ltr">${esc(c.if_code || '')}</span>`)}${kv(t('field.rc'), `<span class="ltr">${esc(c.rc || '')}</span>`)}${kv(t('field.cnss'), `<span class="ltr">${esc(c.cnss || '')}</span>`)}
            ${kv(t('field.start_date'), App.date(c.start_date))}${kv(t('common.createdAt'), `<span class="ltr">${App.dateTime(c.created_at)}</span>`)}${kv(t('common.updatedAt'), `<span class="ltr">${App.dateTime(c.updated_at)}</span>`)}
          </div>
          ${c.notes ? `<div><div class="section-title">${t('field.notes')}</div><div style="white-space:pre-wrap;line-height:1.6">${esc(c.notes)}</div></div>` : ''}
          <div><div class="section-title">${t('client.yearsConfig')}</div>${c.years.length ? `<table class="tbl"><thead><tr><th>${t('common.exercice')}</th><th>${t('field.periodicity')}</th><th>${t('field.start_date')}</th></tr></thead><tbody>${c.years.map((y) => `<tr><td>${y.year}</td><td>${esc(App.nm(y, 'periodicity'))}</td><td>${App.date(y.start_date)}</td></tr>`).join('')}</tbody></table>` : `<div class="muted">—</div>`}</div>
          <div class="notice info">${icon('info')}<div>${t('client.neverDeleted')}</div></div>
          <div><button class="btn danger sm" data-a="delete">${icon('trash-2')} ${t('client.delete')}</button> <span class="muted small">${t('client.deleteHint')}</span></div>
        </div></div>`;
      }
    };

    root.addEventListener('click', async (e) => {
      const tb = e.target.closest('[data-tab]');
      if (tb) { state.tab = App.state.clientTab = tb.dataset.tab; root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b === tb)); drawTab(); return; }
      const ys = e.target.closest('[data-yseg] [data-y]');
      if (ys) {
        if (state.tab === 'fees') { state.feesYear = App.state.clientFeesYear = Number(ys.dataset.y); drawTab(); }
        else { state.year = App.state.clientYear = ys.dataset.y; await load(); draw(); }
        return;
      }
      const a = e.target.closest('[data-a]');
      if (!a) return;
      const c = sit.client;
      try {
        switch (a.dataset.a) {
          case 'edit': if (await App.forms.client(c)) App.refresh(); break;
          case 'status': {
            const to = c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
            const ok = await App.confirm(to === 'INACTIVE' ? t('client.deactivateConfirm', { n: c.name }) : t('client.activateConfirm', { n: c.name }));
            if (ok) { await App.safe(() => App.api('clients.setStatus', c.id, to)); App.toast(t('msg.saved')); App.refresh(); }
            break;
          }
          case 'pay': if (await App.forms.payment({ clientId: id })) App.refresh(); break;
          case 'sub': if (await App.forms.subscription({ clientId: id, year: state.tab === 'fees' ? state.feesYear : App.state.year })) App.refresh(); break;
          case 'oneoff': if (await App.forms.oneOff({ clientId: id })) App.refresh(); break;
          case 'credit': { const r = await App.safe(() => App.api('payments.applyCredit', id)); App.toast(t('msg.creditApplied', { a: App.moneyText(r.applied) })); App.refresh(); break; }
          case 'export': App.go(`#/rapport/client_situation?client=${id}${state.year ? '&year=' + state.year : ''}`); break;
          case 'adddoc': await addDocument(id, drawTab); break;
          case 'delete': {
            if (await App.confirm(t('client.deleteConfirm', { n: c.name }), { danger: true, okLabel: t('client.delete') })) {
              // Seule la suppression du client lui-même fait quitter sa fiche
              await App.safe(() => App.api('clients.remove', c.id)); App.toast(t('msg.clientDeleted'));
              App.setCurrentClient(null); await App.loadClientCache(); App.go('#/clients');
            }
            break;
          }
          default:
        }
      } catch (err) { /* déjà affiché */ }
    });

    draw();
  };

  function addDocument(clientId, after) {
    return new Promise((resolve) => {
      App.modal({
        title: t('docs.add'),
        body: `<div class="form-grid">
          ${App.field(t('docs.type'), `<select class="input" name="doc_type">${DOC_TYPES.map((d) => `<option value="${d}">${esc(t('docType.' + d))}</option>`).join('')}</select>`)}
          ${App.field(t('docs.title'), '<input class="input" name="title">', { hint: t('docs.titleHint') })}
          ${App.field(t('field.notes'), '<input class="input" name="notes">', { full: true })}</div>`,
        footer: `<button class="btn" data-close>${t('btn.cancel')}</button><button class="btn primary" data-go>${icon('folder-open')} ${t('docs.choose')}</button>`,
        onMount: (m) => m.el.querySelector('[data-go]').addEventListener('click', async () => {
          const meta = App.formData(m.el);
          try {
            const ids = await window.doramik.docs.add(clientId, meta);
            if (ids && ids.length) { App.toast(t('msg.docsAdded', { n: ids.length })); m.close(); after(); }
          } catch (e) { App.toast(App.errorText(e), 'err'); }
        }),
        onClose: () => resolve(),
      });
    });
  }

  /** Colonnes standard d'un tableau de paiements. */
  App.paymentColumns = ({ client = true } = {}) => {
    const cols = [{ key: 'pay_date', label: t('col.payDate'), type: 'date' }];
    if (client) cols.push({ key: 'client', label: t('col.client'), render: (p) => `<a data-act="client">${esc(p.client)}</a>` });
    cols.push(
      { key: 'amount', label: t('col.amount'), type: 'money', render: (p) => `<b>${App.money(p.amount, false)}</b>` },
      { key: 'mode', label: t('col.mode'), sortValue: (p) => App.nm(p, 'mode'), render: (p) => esc(App.nm(p, 'mode')) },
      { key: 'cheque_no', label: t('col.details'), sortable: false, render: (p) => `<span class="ltr small">${esc([p.cheque_no && t('field.cheque_no') + ' ' + p.cheque_no, p.bank, p.cheque_date && App.dateText(p.cheque_date), p.transfer_ref && t('field.transfer_ref') + ' ' + p.transfer_ref].filter(Boolean).join(' · '))}</span>` },
      { key: 'reference', label: t('field.reference'), render: (p) => `<span class="ltr">${esc(p.reference || '')}</span>` },
      { key: 'allocations', label: t('col.allocations'), sortable: false, render: (p) => (p.allocations || []).map((a) => `<div class="cell-sub">${esc(App.isAr() && a.service_ar ? a.service_ar : a.service || '')} · ${esc(App.periodLabel(a))} : ${App.money(a.amount)}</div>`).join('') + (p.amount - p.allocated > 0 && !p.voided ? `<div class="cell-sub" style="color:var(--orange)">${t('pay.advance')} : ${App.money(p.amount - p.allocated)}</div>` : '') },
      { key: 'voided', label: t('col.status'), render: (p) => (p.voided ? `${App.badge('LATE', t('pay.voided'))}<div class="cell-sub">${esc(p.void_reason || '')}</div>` : App.badge('PAID', t('pay.valid'))) },
      { key: '', actions: true, render: (p) => (p.voided ? '' : `<button class="btn sm icon" data-act="receipt" title="${esc(t('receipt.title'))}">${icon('receipt')}</button><button class="btn sm icon danger" data-act="void" title="${esc(t('pay.void'))}">${icon('ban')}</button>`) },
    );
    return cols;
  };
})();
