/* DORAMIK GESTION CLIENTS — Détermination des honoraires (catalogue des services + honoraires par client) */
(function () {
  'use strict';
  const { esc, t, icon } = App;

  App.forms.service = (s = null) => new Promise((resolve) => {
    const sv = s || { amount: 0, filing_months: 1, filing_day: 0, due_mode: 'NONE', due_offset: 0, category_id: (App.lk('categories')[0] || {}).id, periodicity_id: (App.lk('periodicities').find((p) => p.months === 0) || {}).id };
    let ok = false;
    App.modal({
      title: sv.id ? t('service.edit') : t('service.new'),
      size: 'lg',
      body: `<form class="form-grid">
        ${App.field(t('field.serviceName'), `<input class="input" name="name" value="${esc(sv.name || '')}">`, { required: true })}
        ${App.field(t('field.serviceNameAr'), `<input class="input" name="name_ar" dir="rtl" value="${esc(sv.name_ar || '')}">`)}
        ${App.field(t('field.category'), `<select class="input" name="category_id">${App.options(App.lk('categories').filter((c) => c.active || c.id === sv.category_id), sv.category_id)}</select>`, { required: true })}
        ${App.field(t('field.periodicity'), `<select class="input" name="periodicity_id">${App.options(App.lk('periodicities').filter((p) => p.active || p.id === sv.periodicity_id), sv.periodicity_id)}</select>`, { required: true, hint: t('hint.servicePeriodicity') })}
        ${App.field(t('field.defaultAmount'), App.moneyField('amount', sv.amount), { required: true })}
        ${App.forms.filingFields(sv)}
        ${App.field(t('field.notes'), `<textarea class="input" name="notes">${esc(sv.notes || '')}</textarea>`, { full: true })}
      </form>`,
      footer: `<button class="btn" data-close>${t('btn.cancel')}</button><button class="btn primary" data-save>${icon('save')} ${t('btn.save')}</button>`,
      onMount: (m) => {
        App.forms.bindFilingFields(m.el.querySelector('form'));
        m.el.querySelector('[data-save]').addEventListener('click', async () => {
        const form = m.el.querySelector('form');
        const d = App.formData(form);
        if (!d.name.trim()) return App.markInvalid(form, 'name');
        const amount = App.parseMoney(d.amount);
        if (Number.isNaN(amount)) return App.markInvalid(form, 'amount');
        try {
          await App.safe(() => App.api('services.save', Object.assign({ id: sv.id }, d, { amount })));
          await App.refreshLookups();
          App.toast(t('msg.saved'));
          ok = true;
          m.close();
        } catch (e) { /* */ }
        });
      },
      onClose: () => resolve(ok),
    });
  });

  App.views.honoraires = async (root, params, query) => {
    const st = { tab: query.tab || 'catalog' };
    const year = App.state.year;
    root.innerHTML = `<div class="page-head"><div><h1>${t('nav.fees')}</h1><div class="sub">${t('fees.subtitle')}</div></div>
      <div class="actions"><button class="btn" data-a="cat">${icon('layers')} ${t('category.new')}</button><button class="btn primary" data-a="new">${icon('plus')} ${t('service.new')}</button></div></div>
      <div class="tabs"><button data-tab="catalog">${icon('briefcase')} ${t('fees.catalog')}</button><button data-tab="clients">${icon('users')} ${t('fees.byClient', { y: year })}</button></div>
      <div data-body></div>`;
    const body = root.querySelector('[data-body]');

    const draw = async () => {
      root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === st.tab));
      if (st.tab === 'catalog') {
        const services = await App.api('services.list');
        const cats = App.lk('categories');
        body.innerHTML = `<div class="stack">${cats.map((c) => `<div class="card"><div class="card-h"><h3>${esc(App.nm(c))}</h3>${c.active ? '' : App.badge('INACTIVE')}<span class="spacer"></span><span class="muted small">${t('fees.nServices', { n: services.filter((s) => s.category_id === c.id).length })}</span></div><div data-cat="${c.id}"></div></div>`).join('')}</div>`;
        cats.forEach((c) => {
          new App.Table(body.querySelector(`[data-cat="${c.id}"]`), {
            rows: services.filter((s) => s.category_id === c.id),
            columns: [
              { key: 'name', label: t('col.service'), render: (s) => `<b>${esc(App.nm(s))}</b>${App.isAr() ? '' : (s.name_ar ? `<div class="cell-sub" dir="rtl" style="text-align:start">${esc(s.name_ar)}</div>` : '')}` },
              { key: 'amount', label: t('field.defaultAmount'), type: 'money' },
              { key: 'periodicity', label: t('field.periodicity'), render: (s) => esc(App.nm(s, 'periodicity')) },
              { key: 'filing_months', label: t('col.filingDate'), sortable: false, render: (s) => (s.months > 0 ? esc(App.filingRuleText(s)) : `<span class="muted">${t('due.fixed')}</span>`) },
              { key: 'due_mode', label: t('col.dueDateFees'), sortable: false, render: (s) => esc(t('due.mode.' + (s.due_mode || 'NONE')) + (s.due_mode === 'OFFSET' ? ` (+${s.due_offset} ${t('common.daysShort')})` : '')) },
              { key: 'notes', label: t('field.notes') },
              { key: 'active', label: t('col.status'), render: (s) => (s.active ? App.badge('ACTIVE') : App.badge('INACTIVE')) },
              { key: '', actions: true, render: (s) => `<button class="btn sm" data-act="edit">${icon('pencil')} ${t('btn.edit')}</button><button class="btn sm" data-act="toggle">${s.active ? t('btn.disable') : t('btn.enable')}</button><button class="btn sm icon danger" data-act="del" title="${esc(t('service.delete'))}">${icon('trash-2')}</button>` },
            ],
            empty: t('fees.noService'),
            onAction: async (act, s) => {
              if (act === 'edit') { if (await App.forms.service(s)) draw(); }
              if (act === 'toggle') { await App.safe(() => App.api('services.setActive', s.id, !s.active)); await App.refreshLookups(); draw(); }
              if (act === 'del') {
                if (!await App.confirm(t('msg.confirmDelete', { n: App.nm(s) }), { danger: true, okLabel: t('btn.delete') })) return;
                try {
                  await App.api('services.remove', s.id);
                  App.toast(t('msg.deleted'));
                } catch (e) {
                  App.toast(App.errorText(e), 'err');
                  if (e.code === 'SERVICE_IN_USE' && s.active && await App.confirm(t('msg.archiveInstead'), { okLabel: t('btn.archive') })) {
                    await App.safe(() => App.api('services.setActive', s.id, false));
                  }
                }
                await App.refreshLookups();
                draw();
              }
            },
          });
        });
      } else {
        // Le client courant reste sélectionné dans ce module après chaque opération
        const cid = App.state.clientId;
        const subs = await App.api('subscriptions.list', cid ? { year, client_id: cid } : { year });
        body.innerHTML = `<div class="card"><div class="card-h"><h3>${t('fees.byClient', { y: year })}</h3><span class="spacer"></span>
          <button class="btn sm" data-a="genall">${icon('refresh-cw')} ${t('fees.generateAll', { y: year })}</button></div>
          <div class="filters"><div class="field wide"><label>${t('field.client')}</label>${App.clientPicker('client_id', '', { placeholder: t('common.allClients'), sticky: true })}</div></div>
          <div data-t></div></div>`;
        App.bindClientPicker(body, () => draw());
        const byId = Object.fromEntries((App.state.clientCache || []).map((c) => [c.id, c]));
        new App.Table(body.querySelector('[data-t]'), {
          rows: subs.map((s) => Object.assign(s, { client: (byId[s.client_id] || {}).name || '', client_status: (byId[s.client_id] || {}).status })),
          columns: [
            { key: 'client', label: t('col.client'), render: (s) => `<a data-act="client">${esc(s.client)}</a> ${s.client_status === 'INACTIVE' ? App.badge('INACTIVE') : ''}` },
            { key: 'service', label: t('col.service'), render: (s) => `${esc(App.nm(s, 'service'))}<div class="cell-sub">${esc(App.nm(s, 'category'))}</div>` },
            { key: 'periodicity', label: t('field.periodicity'), render: (s) => esc(App.nm(s, 'periodicity')) },
            { key: 'amount', label: t('col.amountPerPeriod'), type: 'money' },
            { key: 'start_date', label: t('field.start_date'), type: 'date' },
            { key: 'dues_count', label: t('col.duesCount'), type: 'number' },
            { key: 'paid', label: t('col.paid'), type: 'money' },
            { key: 'active', label: t('col.status'), render: (s) => (s.active ? App.badge('ACTIVE', t('sub.active')) : App.badge('INACTIVE', t('sub.stopped'))) },
          ],
          empty: t('fees.noSubsYear'),
          onRowClick: (s) => App.go(`#/client/${s.client_id}?tab=fees`),
          onAction: (act, s) => { if (act === 'client') App.go('#/client/' + s.client_id); },
        });
      }
    };

    root.addEventListener('click', async (e) => {
      const tb = e.target.closest('[data-tab]');
      if (tb) { st.tab = tb.dataset.tab; draw(); return; }
      const a = e.target.closest('[data-a]');
      if (!a) return;
      try {
        if (a.dataset.a === 'new') { if (await App.forms.service()) draw(); }
        if (a.dataset.a === 'cat') { if (await App.forms.lookup('categories')) { st.tab = 'catalog'; draw(); } }
        if (a.dataset.a === 'genall') { const n = await App.safe(() => App.api('years.generateAll', year)); App.toast(t('msg.generated', { n })); draw(); }
      } catch (err) { /* */ }
    });
    await draw();
  };
})();
