/* DORAMIK GESTION CLIENTS — formulaires partagés (client, honoraires, prestation ponctuelle, paiement, échéance) */
(function () {
  'use strict';
  const { esc, t, icon, field } = App;
  const F = (App.forms = {});

  const recurringPers = () => App.lk('periodicities').filter((p) => p.months > 0 && p.active);
  const activeServices = () => App.lk('services').filter((s) => s.active);
  const serviceOptions = (value, { recurringOnly = false } = {}) => {
    const cats = App.lk('categories');
    return cats.map((c) => {
      const svs = activeServices().filter((s) => s.category_id === c.id && (!recurringOnly || s.months > 0 || String(s.id) === String(value)));
      if (!svs.length) return '';
      return `<optgroup label="${esc(App.nm(c))}">${svs.map((s) => `<option value="${s.id}" ${String(s.id) === String(value) ? 'selected' : ''}>${esc(App.nm(s))}</option>`).join('')}</optgroup>`;
    }).join('');
  };
  F.serviceOptions = serviceOptions;

  /** Sélecteurs communs : règle de dépôt / réalisation et règle d'exigibilité des honoraires. */
  F.filingFields = (o = {}) => {
    const months = o.filing_months === undefined ? 1 : Number(o.filing_months);
    const day = o.filing_day === undefined ? 0 : Number(o.filing_day);
    const mode = o.due_mode || 'NONE';
    const offset = Number(o.due_offset) || 0;
    const monthOpts = [0, 1, 2, 3, 4, 6, 12].map((m) => `<option value="${m}" ${m === months ? 'selected' : ''}>${esc(m === 0 ? t('filing.same') : t('filing.after', { n: m }))}</option>`).join('');
    const dayOpts = [`<option value="0" ${day === 0 ? 'selected' : ''}>${esc(t('filing.lastDay'))}</option>`]
      .concat(Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${day === i + 1 ? 'selected' : ''}>${esc(t('filing.day', { n: i + 1 }))}</option>`)).join('');
    return field(t('field.filing_rule'), `<div class="row nowrap"><select class="input" name="filing_months">${monthOpts}</select><select class="input" name="filing_day">${dayOpts}</select></div>`, { hint: t('hint.filingRule') + ' ' + t('hint.filingDay'), full: true })
      + field(t('field.due_rule_opt'), `<div class="row nowrap"><select class="input" name="due_mode">${['NONE', 'FILING', 'OFFSET'].map((m) => `<option value="${m}" ${mode === m ? 'selected' : ''}>${esc(t('due.mode.' + m))}</option>`).join('')}</select>
        <div class="input-group" style="max-width:150px" data-off><input class="input" type="number" min="0" max="730" name="due_offset" value="${offset}"><span class="addon">${t('common.daysShort')}</span></div></div>`, { hint: t('hint.dueOptional'), full: true });
  };
  F.bindFilingFields = (form) => {
    const mode = form.querySelector('[name=due_mode]');
    const off = form.querySelector('[data-off]');
    if (!mode || !off) return;
    const upd = () => off.classList.toggle('hidden', mode.value !== 'OFFSET');
    mode.addEventListener('change', upd);
    upd();
  };


  // ================================================================= client
  F.client = (client = null, { prefill = null } = {}) => new Promise((resolve) => {
    const c = client || { status: 'ACTIVE', start_date: App.today() };
    const isNew = !c.id;
    const year = App.state.year;
    let pendingDoc = null; // document d'origine à conserver dans la fiche après enregistrement
    const defSvc = activeServices().find((s) => s.months > 0 && /honoraires/i.test(s.name)) || activeServices().find((s) => s.months > 0);
    const defPer = App.lk('periodicities').find((p) => p.code === 'QUARTERLY') || recurringPers()[0];
    let saved = null;
    const lfOpts = App.options(App.lk('legal_forms').filter((f) => f.active || f.id === c.legal_form_id), c.legal_form_id, { empty: t('common.choose') });
    const body = `<form class="stack">
      <div class="import-box" data-import-box>
        <div class="row">
          <div class="grow"><b>${t('import.title')}</b><div class="hint">${esc(t('import.hint'))}</div></div>
          <button type="button" class="btn primary" data-import>${icon('file-search')} ${t('import.btn')}</button>
        </div>
        <div data-import-state></div>
      </div>
      <div class="form-grid">
        ${field(t('field.name'), `<input class="input" name="name" value="${esc(c.name || '')}" maxlength="200">`, { required: true, full: true })}
        ${field(t('field.legal_form'), `<select class="input" name="legal_form_id">${lfOpts}</select>`)}
        ${field(t('field.status'), `<select class="input" name="status"><option value="ACTIVE" ${c.status === 'ACTIVE' ? 'selected' : ''}>${t('status.ACTIVE')}</option><option value="INACTIVE" ${c.status === 'INACTIVE' ? 'selected' : ''}>${t('status.INACTIVE')}</option></select>`)}
        ${field(t('field.phone'), `<input class="input ltr" name="phone" value="${esc(c.phone || '')}">`)}
        ${field(t('field.email'), `<input class="input ltr" name="email" type="email" value="${esc(c.email || '')}">`)}
        ${field(t('field.address'), `<input class="input" name="address" value="${esc(c.address || '')}">`, { full: true })}
        ${field(t('field.ice'), `<input class="input ltr" name="ice" value="${esc(c.ice || '')}" maxlength="20">`, { hint: t('hint.ice') })}
        ${field(t('field.if_code'), `<input class="input ltr" name="if_code" value="${esc(c.if_code || '')}">`)}
        ${field(t('field.rc'), `<input class="input ltr" name="rc" value="${esc(c.rc || '')}">`)}
        ${field(t('field.cnss'), `<input class="input ltr" name="cnss" value="${esc(c.cnss || '')}">`)}
        ${field(t('field.tp_code'), `<input class="input ltr" name="tp_code" value="${esc(c.tp_code || '')}">`, { hint: t('hint.tpCode') })}
        ${field(t('field.start_date'), `<input class="input" type="date" name="start_date" value="${esc(c.start_date || '')}">`, { hint: t('hint.startDate') })}
        ${field(t('field.notes'), `<textarea class="input" name="notes">${esc(c.notes || '')}</textarea>`, { full: true })}
      </div>
      ${isNew ? `<div class="fieldset"><label class="check legend"><input type="checkbox" name="with_fees" checked> ${t('client.setupFees', { y: year })}</label>
        <div class="form-grid cols-3" data-fees>
          ${field(t('field.service'), `<select class="input" name="service_id">${serviceOptions(defSvc && defSvc.id, { recurringOnly: true })}</select>`)}
          ${field(t('field.periodicity'), `<select class="input" name="periodicity_id">${App.options(recurringPers(), defPer && defPer.id)}</select>`)}
          ${field(t('field.amount'), App.moneyField('fee_amount', defSvc ? defSvc.amount : ''))}
        </div><div class="hint" style="margin-top:8px">${esc(t('hint.feesGeneration'))}</div></div>` : ''}
    </form>`;
    App.modal({
      title: isNew ? t('client.new') : t('client.edit'),
      size: 'lg',
      body,
      footer: `<button class="btn" data-close>${t('btn.cancel')}</button><button class="btn primary" data-save>${icon('save')} ${t('btn.save')}</button>`,
      onMount: (m) => {
        const form = m.el.querySelector('form');
        // Mode A : lecture automatique d'un document ; mode B : saisie manuelle (toujours disponible)
        const imp = App.docImport.bind(m, form, c, (file) => { pendingDoc = file; });
        // Fiche ouverte depuis un document déjà analysé : les informations lues y sont reportées
        if (prefill) imp.apply(prefill);
        const fees = form.querySelector('[data-fees]');
        const cb = form.querySelector('[name=with_fees]');
        if (cb) cb.addEventListener('change', () => fees.classList.toggle('hidden', !cb.checked));
        const svSel = form.querySelector('[name=service_id]');
        if (svSel) svSel.addEventListener('change', () => {
          const s = App.lkById('services', svSel.value);
          if (s) {
            form.querySelector('[name=fee_amount]').value = App.moneyInput(s.amount);
            if (s.months > 0) form.querySelector('[name=periodicity_id]').value = s.periodicity_id;
          }
        });
        const ice = form.querySelector('[name=ice]');
        ice.addEventListener('blur', () => {
          const v = ice.value.trim();
          if (v && !/^\d{15}$/.test(v)) App.toast(t('warn.iceFormat'), 'warn');
        });
        m.el.querySelector('[data-save]').addEventListener('click', async () => {
          const d = App.formData(form);
          if (!d.name.trim()) return App.markInvalid(form, 'name');
          let feeAmount = 0;
          if (isNew && d.with_fees) {
            feeAmount = App.parseMoney(d.fee_amount);
            if (Number.isNaN(feeAmount)) return App.markInvalid(form, 'fee_amount');
          }
          const payload = Object.assign({}, c, d);
          delete payload.years;
          try {
            const id = await App.safe((force) => App.api('clients.save', Object.assign(payload, { force })), { dupRetry: true });
            saved = id;
            c.id = id;
            payload.id = id;
            if (isNew && d.with_fees && d.status === 'ACTIVE') {
              await App.safe(() => App.api('clientYears.save', { client_id: id, year, periodicity_id: d.periodicity_id, start_date: d.start_date }));
              const r = await App.safe(() => App.api('subscriptions.save', { client_id: id, year, service_id: d.service_id, periodicity_id: d.periodicity_id, amount: feeAmount, start_date: d.start_date, generate: true }));
              App.toast(t('msg.clientCreatedFees', { n: r.generated }));
            } else {
              App.toast(isNew ? t('msg.clientCreated') : t('msg.saved'));
            }
            // Le document d'origine est conservé dans la fiche (jamais à la place d'un autre)
            if (pendingDoc && pendingDoc.path) {
              try {
                await window.doramik.extract.attach(id, pendingDoc.path, { title: pendingDoc.title || t('import.docTitle'), doc_type: 'ADMIN', notes: t('import.docNotes') });
                App.toast(t('import.docKept'));
              } catch (e) { App.toast(App.errorText(e), 'warn'); }
            }
            await App.loadClientCache();
            m.close();
          } catch (e) { /* message déjà affiché */ }
        });
      },
      onClose: () => resolve(saved),
    });
  });

  // ================================================================= périodicité par exercice
  F.clientYear = (clientId, year, current) => new Promise((resolve) => {
    let ok = false;
    const cy = current || {};
    App.modal({
      title: t('clientYear.title', { y: year }),
      body: `<form class="stack"><div class="notice info">${icon('info')}<div>${esc(t('clientYear.help'))}</div></div>
        <div class="form-grid">
        ${field(t('field.periodicity'), `<select class="input" name="periodicity_id">${App.options(recurringPers(), cy.periodicity_id)}</select>`, { required: true })}
        ${field(t('field.start_date'), `<input class="input" type="date" name="start_date" value="${esc(cy.start_date || '')}">`, { hint: t('hint.startDateYear') })}
        ${field(t('field.notes'), `<input class="input" name="notes" value="${esc(cy.notes || '')}">`, { full: true })}
        </div>
        <label class="check"><input type="checkbox" name="apply_to_subs" checked> ${esc(t('clientYear.apply'))}</label></form>`,
      footer: `<button class="btn" data-close>${t('btn.cancel')}</button><button class="btn primary" data-save>${icon('save')} ${t('btn.save')}</button>`,
      onMount: (m) => {
        m.el.querySelector('[data-save]').addEventListener('click', async () => {
          const d = App.formData(m.el.querySelector('form'));
          try {
            const r = await App.safe(() => App.api('clientYears.save', Object.assign(d, { client_id: clientId, year })));
            App.toast(r.changed ? t('msg.periodicityApplied', { n: r.changed }) : t('msg.saved'));
            ok = true;
            m.close();
          } catch (e) { /* */ }
        });
      },
      onClose: () => resolve(ok),
    });
  });

  // ================================================================= honoraire récurrent
  F.subscription = ({ clientId, sub = null, year }) => new Promise(async (resolve) => {
    const s = sub || {};
    const isNew = !s.id;
    const y = s.year || year || App.state.year;
    let cy = null;
    let client = null;
    try {
      cy = await App.api('clientYears.get', clientId, y);
      client = await App.api('clients.get', clientId);
    } catch (e) { App.toast(App.errorText(e), 'err'); return resolve(false); }
    const defSvc = s.service_id ? App.lkById('services', s.service_id) : activeServices().find((x) => x.months > 0);
    const per = s.periodicity_id || (cy && cy.periodicity_id) || (defSvc && defSvc.months > 0 ? defSvc.periodicity_id : (recurringPers()[0] || {}).id);
    const start = s.start_date || (cy && cy.start_date) || client.start_date || `${y}-01-01`;
    const locked = !isNew && s.paid > 0;
    let ok = false;
    App.modal({
      title: isNew ? t('sub.new', { y }) : t('sub.edit', { y }),
      size: 'lg',
      body: `<form class="stack">
        <div class="muted">${esc(client.name)} · ${t('common.exercice')} ${y}</div>
        <div class="form-grid">
        ${field(t('field.service'), `<select class="input" name="service_id">${serviceOptions(defSvc && defSvc.id)}</select>`, { required: true })}
        ${field(t('field.periodicity'), `<select class="input" name="periodicity_id" ${locked ? 'disabled' : ''}>${App.options(recurringPers(), per)}</select>`, { required: true, hint: locked ? t('hint.periodicityLocked') : t('hint.periodicityYear') })}
        ${field(t('field.amount'), App.moneyField('amount', s.amount !== undefined ? s.amount : (defSvc ? defSvc.amount : '')), { required: true, hint: t('hint.amountPerPeriod') })}
        ${field(t('field.start_date'), `<input class="input" type="date" name="start_date" value="${esc(start)}">`, { hint: t('hint.startDateSub') })}
        ${field(t('field.end_date'), `<input class="input" type="date" name="end_date" value="${esc(s.end_date || '')}">`, { hint: t('hint.endDate') })}
        ${F.filingFields({
          filing_months: s.filing_months !== undefined ? s.filing_months : (defSvc ? defSvc.filing_months : 1),
          filing_day: s.filing_day !== undefined ? s.filing_day : (defSvc ? defSvc.filing_day : 0),
          due_mode: s.due_mode || (defSvc ? defSvc.due_mode : 'NONE'),
          due_offset: s.due_offset !== undefined ? s.due_offset : (defSvc ? defSvc.due_offset : 0),
        })}
        ${field(t('field.notes'), `<input class="input" name="notes" value="${esc(s.notes || '')}">`, { full: true })}
        </div>
        ${!isNew ? `<label class="check"><input type="checkbox" name="apply_unpaid" checked> ${esc(t('sub.applyUnpaid'))}</label>` : ''}
        ${client.status !== 'ACTIVE' ? `<div class="notice warn">${icon('triangle-alert')}<div>${esc(t('warn.clientInactiveNoGen'))}</div></div>` : ''}
      </form>`,
      footer: `<button class="btn" data-close>${t('btn.cancel')}</button><button class="btn primary" data-save>${icon('save')} ${t('btn.saveGenerate')}</button>`,
      onMount: (m) => {
        const form = m.el.querySelector('form');
        F.bindFilingFields(form);
        const svSel = form.querySelector('[name=service_id]');
        svSel.addEventListener('change', () => {
          const sv = App.lkById('services', svSel.value);
          if (!sv) return;
          form.querySelector('[name=amount]').value = App.moneyInput(sv.amount);
          if (sv.months > 0 && !locked) form.querySelector('[name=periodicity_id]').value = sv.periodicity_id;
          form.querySelector('[name=filing_months]').value = sv.filing_months;
          form.querySelector('[name=filing_day]').value = sv.filing_day;
          form.querySelector('[name=due_mode]').value = sv.due_mode;
          form.querySelector('[name=due_offset]').value = sv.due_offset;
          F.bindFilingFields(form);
        });
        m.el.querySelector('[data-save]').addEventListener('click', async () => {
          const d = App.formData(form);
          const amount = App.parseMoney(d.amount);
          if (Number.isNaN(amount)) return App.markInvalid(form, 'amount');
          if (locked) d.periodicity_id = s.periodicity_id;
          const payload = Object.assign({}, { id: s.id, client_id: clientId, year: y }, d, { amount, generate: client.status === 'ACTIVE' });
          try {
            const r = await App.safe((force) => App.api('subscriptions.save', Object.assign(payload, { force })), { dupRetry: true });
            App.toast(t('msg.subSaved', { n: r.generated }) + (r.cancelled ? ' ' + t('msg.duesCancelled', { n: r.cancelled }) : ''));
            ok = true;
            m.close();
          } catch (e) { /* */ }
        });
      },
      onClose: () => resolve(ok),
    });
  });

  // ================================================================= prestation ponctuelle
  F.oneOff = ({ clientId = null } = {}) => new Promise(async (resolve) => {
    if (!App.state.clientCache) await App.loadClientCache();
    const oneOffSvc = activeServices().find((s) => s.months === 0);
    let ok = false;
    const openYears = App.lk('years').filter((y) => y.status === 'OPEN');
    App.modal({
      title: t('oneoff.new'),
      size: 'lg',
      body: `<form class="stack"><div class="form-grid">
        ${clientId ? '' : field(t('field.client'), App.clientPicker('client_id', '', { allowEmpty: false, status: 'ACTIVE' }), { required: true, full: true })}
        ${field(t('field.service'), `<select class="input" name="service_id">${serviceOptions(oneOffSvc && oneOffSvc.id)}</select>`, { required: true })}
        ${field(t('field.label'), `<input class="input" name="label" placeholder="${esc(t('hint.labelPh'))}">`)}
        ${field(t('field.amount'), App.moneyField('amount', oneOffSvc ? oneOffSvc.amount : ''), { required: true })}
        ${field(t('field.filing_date'), `<input class="input" type="date" name="filing_date" value="${App.today()}">`, { required: true })}
        ${field(t('field.due_date_opt'), `<input class="input" type="date" name="due_date">`, { hint: t('hint.dueDateOne') })}
        ${field(t('field.year'), `<select class="input" name="year">${openYears.map((y) => `<option value="${y.year}" ${y.year === App.state.year ? 'selected' : ''}>${y.year}</option>`).join('')}</select>`, { required: true })}
        ${field(t('field.notes'), `<input class="input" name="notes">`)}
      </div></form>`,
      footer: `<button class="btn" data-close>${t('btn.cancel')}</button><button class="btn primary" data-save>${icon('save')} ${t('btn.save')}</button>`,
      onMount: (m) => {
        const form = m.el.querySelector('form');
        App.bindClientPicker(form);
        const svSel = form.querySelector('[name=service_id]');
        svSel.addEventListener('change', () => {
          const sv = App.lkById('services', svSel.value);
          if (sv && sv.amount) form.querySelector('[name=amount]').value = App.moneyInput(sv.amount);
        });
        m.el.querySelector('[data-save]').addEventListener('click', async () => {
          const d = App.formData(form);
          const cid = clientId || d.client_id;
          if (!cid) return App.markInvalid(form, 'client_id') || form.querySelector('[data-picker-text]').focus();
          const amount = App.parseMoney(d.amount);
          if (Number.isNaN(amount) || amount <= 0) return App.markInvalid(form, 'amount');
          if (!d.filing_date) return App.markInvalid(form, 'filing_date');
          if (d.due_date && d.due_date < d.filing_date) { App.toast(t('err.DUE_BEFORE_FILING'), 'err'); return App.markInvalid(form, 'due_date'); }
          try {
            await App.safe((force) => App.api('dues.createOneOff', Object.assign({}, d, { client_id: cid, amount, force })), { dupRetry: true });
            App.toast(t('msg.oneoffCreated'));
            ok = true;
            m.close();
          } catch (e) { /* */ }
        });
      },
      onClose: () => resolve(ok),
    });
  });

  // ================================================================= paiement
  F.payment = ({ clientId = null, dueId = null } = {}) => new Promise(async (resolve) => {
    if (!App.state.clientCache) await App.loadClientCache();
    const modes = App.lk('payment_modes').filter((m) => m.active);
    let ok = false;
    let dues = [];
    let manual = false;
    let credit = 0;
    let focusDue = null;
    if (dueId) {
      try { focusDue = await App.api('dues.get', dueId); clientId = focusDue.client_id; } catch (e) { /* */ }
    }
    App.modal({
      title: t('pay.new'),
      size: 'xl',
      body: `<form class="stack">
        <div class="form-grid cols-3">
          ${field(t('field.client'), App.clientPicker('client_id', clientId || '', { allowEmpty: false }), { required: true, full: true })}
          ${field(t('field.pay_date'), `<input class="input" type="date" name="pay_date" value="${App.today()}">`, { required: true })}
          ${field(t('field.amount'), App.moneyField('amount', focusDue ? focusDue.rest : ''), { required: true })}
          ${field(t('field.mode'), `<select class="input" name="mode_id">${modes.map((m) => `<option value="${m.id}" data-kind="${m.kind}">${esc(App.nm(m))}</option>`).join('')}</select>`, { required: true })}
          <div class="field" data-k="CHEQUE"><label>${t('field.cheque_no')}<span class="req">*</span></label><input class="input ltr" name="cheque_no"></div>
          <div class="field" data-k="CHEQUE"><label>${t('field.bank')}</label><input class="input" name="bank"></div>
          <div class="field" data-k="CHEQUE"><label>${t('field.cheque_date')}</label><input class="input" type="date" name="cheque_date"></div>
          <div class="field" data-k="TRANSFER"><label>${t('field.transfer_ref')}</label><input class="input ltr" name="transfer_ref"></div>
          ${field(t('field.reference'), `<input class="input ltr" name="reference">`, { hint: t('hint.reference') })}
          ${field(t('field.notes'), `<input class="input" name="notes">`, { cls: '' })}
        </div>
        <div class="fieldset">
          <div class="legend">${icon('list-checks')} ${t('pay.allocation')}<span class="spacer"></span>
            <button class="btn sm" type="button" data-auto>${icon('refresh-cw')} ${t('pay.autoAlloc')}</button>
            <button class="btn sm" type="button" data-clear>${t('pay.clearAlloc')}</button></div>
          <div class="hint" style="margin-bottom:8px">${esc(t('pay.previewHint'))}</div>
          <div data-credit></div>
          <div data-dues class="table-wrap"><div class="muted">${t('pay.chooseClient')}</div></div>
          <div class="alloc-summary" data-summary></div>
        </div>
      </form>`,
      footer: `<button class="btn" data-close>${t('btn.cancel')}</button><button class="btn success" data-save>${icon('check')} ${t('pay.save')}</button>`,
      onMount: (m) => {
        const form = m.el.querySelector('form');
        const duesEl = form.querySelector('[data-dues]');
        const sumEl = form.querySelector('[data-summary]');
        const creditEl = form.querySelector('[data-credit]');
        const amountEl = form.querySelector('[name=amount]');
        const modeEl = form.querySelector('[name=mode_id]');
        const showMode = () => {
          const kind = modeEl.selectedOptions[0] && modeEl.selectedOptions[0].dataset.kind;
          form.querySelectorAll('[data-k]').forEach((el) => el.classList.toggle('hidden', el.dataset.k !== kind));
        };
        modeEl.addEventListener('change', showMode);
        showMode();

        const allocInputs = () => [...duesEl.querySelectorAll('[data-alloc]')];
        const summary = () => {
          const amount = App.parseMoney(amountEl.value);
          const alloc = allocInputs().reduce((s, el) => s + (App.parseMoney(el.value) || 0), 0);
          const a = Number.isNaN(amount) ? 0 : amount;
          const left = a - alloc;
          sumEl.innerHTML = `<span>${t('pay.amount')} : <b>${App.money(a)}</b></span><span>${t('pay.allocated')} : <b>${App.money(alloc)}</b></span>
            ${left > 0 ? `<span style="color:var(--orange)">${t('pay.advance')} : <b>${App.money(left)}</b></span>` : ''}
            ${left < 0 ? `<span style="color:var(--red)">${t('pay.overAllocated')} : <b>${App.money(-left)}</b></span>` : ''}
            <span>${t('pay.restAfter')} : <b>${App.money(App.sum(dues, 'rest') - alloc)}</b></span>`;
          return { amount: a, alloc, left };
        };
        const autoAlloc = () => {
          let left = App.parseMoney(amountEl.value);
          if (Number.isNaN(left)) left = 0;
          const order = focusDue ? [...dues].sort((x, y) => (x.id === focusDue.id ? -1 : y.id === focusDue.id ? 1 : 0)) : dues;
          const map = {};
          for (const d of order) { const v = Math.min(left, d.rest); map[d.id] = v; left -= v; }
          allocInputs().forEach((el) => { const v = map[el.dataset.alloc] || 0; el.value = v ? App.moneyInput(v) : ''; });
          summary();
        };
        const loadDues = async (cid) => {
          if (!cid) { dues = []; duesEl.innerHTML = `<div class="muted">${t('pay.chooseClient')}</div>`; creditEl.innerHTML = ''; summary(); return; }
          dues = await App.api('dues.list', { client_id: cid, open_only: true, order: 'date' });
          credit = await App.api('payments.credit', cid);
          creditEl.innerHTML = credit > 0 ? `<div class="notice ok" style="margin-bottom:10px">${icon('coins')}<div class="grow">${t('pay.creditAvailable', { a: App.moneyText(credit) })}</div>
            ${dues.length ? `<button class="btn sm" type="button" data-apply-credit>${t('pay.applyCredit')}</button>` : ''}</div>` : '';
          duesEl.innerHTML = dues.length ? `<table class="tbl alloc-table"><thead><tr><th>${t('col.service')}</th><th>${t('col.period')}</th><th>${t('col.filingDate')}</th><th>${t('col.dueDateFees')}</th><th class="num">${t('col.fees')}</th><th class="num">${t('col.paid')}</th><th class="num">${t('col.rest')}</th><th>${t('col.status')}</th><th class="num">${t('pay.allocate')}</th></tr></thead><tbody>
            ${dues.map((d) => `<tr ${focusDue && focusDue.id === d.id ? 'style="background:#fffbeb"' : ''}><td>${esc(App.serviceName(d))}</td><td>${esc(App.periodLabel(d))}</td><td>${App.date(d.filing_date)}</td><td>${d.due_date ? App.date(d.due_date) : `<span class="muted small">${esc(t('timing.NO_DUE'))}</span>`}</td><td class="num">${App.money(d.amount, false)}</td><td class="num">${App.money(d.paid, false)}</td><td class="num"><b>${App.money(d.rest, false)}</b></td><td>${App.dueBadge(d)}</td>
            <td class="num"><input class="input money" data-alloc="${d.id}" data-rest="${d.rest}" inputmode="decimal"></td></tr>`).join('')}</tbody></table>`
            : `<div class="notice info">${icon('info')}<div>${t('pay.noOpenDues')}</div></div>`;
          manual = false;
          autoAlloc();
        };
        App.bindClientPicker(form, (cid) => loadDues(cid));
        amountEl.addEventListener('input', () => { if (!manual) autoAlloc(); else summary(); });
        duesEl.addEventListener('input', (e) => {
          if (e.target.dataset.alloc) {
            manual = true;
            const v = App.parseMoney(e.target.value);
            e.target.classList.toggle('invalid', e.target.value !== '' && (Number.isNaN(v) || v > Number(e.target.dataset.rest)));
            summary();
          }
        });
        form.querySelector('[data-auto]').addEventListener('click', () => { manual = false; autoAlloc(); });
        form.querySelector('[data-clear]').addEventListener('click', () => { manual = true; allocInputs().forEach((el) => { el.value = ''; }); summary(); });
        creditEl.addEventListener('click', async (e) => {
          if (!e.target.closest('[data-apply-credit]')) return;
          const cid = form.querySelector('[name=client_id]').value;
          try {
            const r = await App.safe(() => App.api('payments.applyCredit', cid));
            App.toast(t('msg.creditApplied', { a: App.moneyText(r.applied) }));
            ok = true;
            loadDues(cid);
          } catch (err) { /* */ }
        });
        if (clientId) loadDues(clientId);
        else summary();

        m.el.querySelector('[data-save]').addEventListener('click', async () => {
          const d = App.formData(form);
          if (!d.client_id) { form.querySelector('[data-picker-text]').focus(); return App.toast(t('err.REQUIRED', { field: t('field.client') }), 'err'); }
          const amount = App.parseMoney(d.amount);
          if (Number.isNaN(amount) || amount <= 0) return App.markInvalid(form, 'amount');
          if (!d.pay_date) return App.markInvalid(form, 'pay_date');
          const kind = modeEl.selectedOptions[0].dataset.kind;
          if (kind === 'CHEQUE' && !d.cheque_no.trim()) return App.markInvalid(form, 'cheque_no');
          const allocations = [];
          for (const el of allocInputs()) {
            if (el.value.trim() === '') continue;
            const v = App.parseMoney(el.value);
            if (Number.isNaN(v) || v > Number(el.dataset.rest)) { el.classList.add('invalid'); el.focus(); return App.toast(t('err.ALLOCATION_EXCEEDS_REST', { rest: App.moneyText(Number(el.dataset.rest)) }), 'err'); }
            if (v > 0) allocations.push({ due_id: Number(el.dataset.alloc), amount: v });
          }
          const s = summary();
          if (s.left < 0) return App.toast(t('err.ALLOCATION_EXCEEDS_PAYMENT'), 'err');
          if (s.left > 0) {
            const go = await App.confirm(t('pay.confirmAdvance', { a: App.moneyText(s.left) }), { okLabel: t('btn.continue') });
            if (!go) return;
          }
          const payload = { client_id: d.client_id, pay_date: d.pay_date, amount, mode_id: d.mode_id, cheque_no: d.cheque_no, bank: d.bank, cheque_date: d.cheque_date, transfer_ref: d.transfer_ref, reference: d.reference, notes: d.notes, allocations };
          try {
            const r = await App.safe((force) => App.api('payments.create', Object.assign(payload, { force })), { dupRetry: true });
            const rest = r.allocations.reduce((x, a) => x + a.rest, 0);
            App.toast(t('msg.paymentSaved', { a: App.moneyText(amount) }) + (r.allocations.length ? ' · ' + t('msg.restAfter', { a: App.moneyText(rest) }) : ''));
            ok = true;
            m.close();
            App.receipt.open(r.id, { afterPayment: true });
          } catch (e) { /* */ }
        });
      },
      onClose: () => resolve(ok),
    });
  });

  // ================================================================= détail d'une échéance
  F.due = (dueId) => new Promise(async (resolve) => {
    let changed = false;
    let delegated = false;
    let d;
    try { d = await App.api('dues.get', dueId); } catch (e) { App.toast(App.errorText(e), 'err'); return resolve(false); }
    const kv = (k, v) => `<div><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`;
    App.modal({
      title: `${App.serviceName(d)} — ${App.periodLabel(d)}`,
      size: 'lg',
      body: `<div class="stack">
        <div class="kv-list">
          ${kv(t('col.client'), `<a data-client>${esc(d.client)}</a>`)}
          ${kv(t('col.service'), esc(App.serviceName(d)))}
          ${kv(t('col.period'), esc(App.periodLabel(d)))}
          ${kv(t('common.exercice'), d.year)}
          ${kv(t('col.filingDate'), App.date(d.filing_date))}
          ${kv(t('col.dueDateFees'), d.due_date ? App.date(d.due_date) : `<span class="muted">${esc(t('timing.NO_DUE'))}</span>`)}
          ${kv(t('col.status'), App.dueBadge(d))}
          ${kv(t('col.due'), App.money(d.amount))}
          ${kv(t('col.paid'), App.money(d.paid))}
          ${kv(t('col.rest'), `<b>${App.money(d.rest)}</b>`)}
          ${d.days_late ? kv(t('col.late'), `<span style="color:var(--red)">${t('common.days', { n: d.days_late })}</span>`) : ''}
          ${d.period_start && d.kind !== 'ONE_OFF' ? kv(t('field.periodRange'), `${App.date(d.period_start)} → ${App.date(d.period_end)}`) : ''}
          ${d.notes ? kv(t('field.notes'), esc(d.notes)) : ''}
        </div>
        <div><div class="section-title">${t('due.payments')}</div>
        ${d.allocations.length ? `<table class="tbl"><thead><tr><th>${t('col.payDate')}</th><th class="num">${t('col.amount')}</th><th>${t('col.mode')}</th><th>${t('col.reference')}</th></tr></thead><tbody>
          ${d.allocations.map((a) => `<tr><td>${App.date(a.pay_date)}</td><td class="num">${App.money(a.amount, false)}</td><td>${esc(App.nm(a, 'mode'))}</td><td class="ltr">${esc([a.cheque_no ? t('field.cheque_no') + ' ' + a.cheque_no : '', a.bank, a.transfer_ref].filter(Boolean).join(' · '))}</td></tr>`).join('')}</tbody></table>`
          : `<div class="muted">${t('due.noPayments')}</div>`}</div>
      </div>`,
      footer: `<div class="left row">${d.paid === 0 ? `<button class="btn danger" data-cancel>${icon('ban')} ${t('btn.cancelDue')}</button><button class="btn danger" data-del>${icon('trash-2')} ${t('btn.delete')}</button>` : ''}<button class="btn" data-edit>${icon('pencil')} ${t('btn.edit')}</button></div>
        <button class="btn" data-close>${t('btn.close')}</button>${d.rest > 0 ? `<button class="btn success" data-pay>${icon('hand-coins')} ${t('btn.pay')}</button>` : ''}`,
      onMount: (m) => {
        const q = (s) => m.el.querySelector(s);
        q('[data-client]').addEventListener('click', () => { delegated = true; m.close(); resolve(false); App.go('#/client/' + d.client_id); });
        if (q('[data-pay]')) q('[data-pay]').addEventListener('click', async () => { delegated = true; m.close(); resolve(await F.payment({ dueId: d.id })); });
        q('[data-edit]').addEventListener('click', async () => { delegated = true; m.close(); resolve(await F.dueEdit(d)); });
        if (q('[data-del]')) q('[data-del]').addEventListener('click', async () => {
          const ok = await App.confirm(t('due.deleteConfirm', { s: App.serviceName(d), p: App.periodLabel(d) }), { danger: true, okLabel: t('btn.delete') });
          if (!ok) return;
          try { await App.safe(() => App.api('dues.remove', d.id)); App.toast(t('msg.deleted')); changed = true; m.close(); } catch (e) { /* */ }
        });
        if (q('[data-cancel]')) q('[data-cancel]').addEventListener('click', async () => {
          const reason = await App.prompt(t('btn.cancelDue'), t('field.reason'));
          if (!reason) return;
          try { await App.safe(() => App.api('dues.cancel', d.id, reason)); App.toast(t('msg.dueCancelled')); changed = true; m.close(); } catch (e) { /* */ }
        });
      },
      onClose: () => { if (!delegated) resolve(changed); },
    });
  });

  F.dueEdit = (d) => new Promise((resolve) => {
    let ok = false;
    App.modal({
      title: t('due.edit'),
      size: 'lg',
      body: `<form class="stack"><div class="muted">${esc(d.client)} · ${esc(App.serviceName(d))} · ${esc(App.periodLabel(d))}</div><div class="form-grid">
        ${field(t('col.fees'), App.moneyField('amount', d.amount), { required: true, hint: d.paid ? t('hint.minAmount', { a: App.moneyText(d.paid) }) : '' })}
        ${field(t('field.filing_date'), `<input class="input" type="date" name="filing_date" value="${esc(d.filing_date || '')}">`, { required: true })}
        ${field(t('field.due_date_opt'), `<input class="input" type="date" name="due_date" value="${esc(d.due_date || '')}">`, { hint: t('hint.dueDateOne') })}
        ${field(t('field.label'), `<input class="input" name="label" value="${esc(d.label || '')}">`)}
        ${field(t('field.notes'), `<textarea class="input" name="notes">${esc(d.notes || '')}</textarea>`, { full: true })}
      </div></form>`,
      footer: `<button class="btn" data-close>${t('btn.cancel')}</button><button class="btn primary" data-save>${icon('save')} ${t('btn.save')}</button>`,
      onMount: (m) => {
        m.el.querySelector('[data-save]').addEventListener('click', async () => {
          const form = m.el.querySelector('form');
          const v = App.formData(form);
          const amount = App.parseMoney(v.amount);
          if (Number.isNaN(amount)) return App.markInvalid(form, 'amount');
          if (!v.filing_date) return App.markInvalid(form, 'filing_date');
          if (v.due_date && v.due_date < v.filing_date) { App.toast(t('err.DUE_BEFORE_FILING'), 'err'); return App.markInvalid(form, 'due_date'); }
          try { await App.safe(() => App.api('dues.update', d.id, Object.assign(v, { amount }))); App.toast(t('msg.saved')); ok = true; m.close(); } catch (e) { /* */ }
        });
      },
      onClose: () => resolve(ok),
    });
  });

  // ================================================================= annulation d'un paiement
  F.voidPayment = async (p) => {
    const reason = await App.prompt(t('pay.void'), t('pay.voidReason', { a: App.moneyText(p.amount), d: App.dateText(p.pay_date) }));
    if (!reason) return false;
    try {
      await App.safe(() => App.api('payments.void', p.id, reason));
      App.toast(t('msg.paymentVoided'));
      return true;
    } catch (e) { return false; }
  };

  /** Traitement standard des actions d'une ligne d'échéance (voir, payer, modifier, supprimer). */
  App.onDueAction = async (act, d) => {
    if (act === 'client') return App.go('#/client/' + d.client_id);
    if (act === 'pay') { if (await F.payment({ dueId: d.id })) App.refresh(); return; }
    if (act === 'detail') { if (await F.due(d.id)) App.refresh(); return; }
    if (act === 'edit') { if (await F.dueEdit(d)) App.refresh(); return; }
    if (act === 'del') {
      const ok = await App.confirm(t('due.deleteConfirm', { s: App.serviceName(d), p: App.periodLabel(d) }), { danger: true, okLabel: t('btn.delete') });
      if (!ok) return;
      try { await App.safe(() => App.api('dues.remove', d.id)); App.toast(t('msg.deleted')); App.refresh(); } catch (e) { /* */ }
    }
  };
})();
