/* DORAMIK GESTION CLIENTS — reçu / justificatif de paiement (A4, ticket 80 mm, ticket 58 mm) */
(function () {
  'use strict';
  const { esc, t, icon } = App;
  const R = (App.receipt = {});

  const FORMATS = [
    ['A4', 'file-text'],
    ['T80', 'receipt'],
    ['T58', 'receipt'],
  ];

  /** Construit le document du reçu à partir des données du paiement et des options d'impression. */
  R.doc = (data, { format, show_app, show_cabinet }) => {
    const s = App.state.settings;
    const p = data.payment;
    const mode = App.isAr() && p.mode_ar ? p.mode_ar : p.mode || '';
    const details = [p.cheque_no ? t('field.cheque_no') + ' ' + p.cheque_no : '', p.bank, p.cheque_date ? App.dateText(p.cheque_date) : '', p.transfer_ref ? t('field.transfer_ref') + ' ' + p.transfer_ref : ''].filter(Boolean).join(' · ');
    return {
      format,
      lang: App.state.lang,
      dir: App.isAr() ? 'rtl' : 'ltr',
      currency: t('currency'),
      number: data.number,
      date: App.dateText(p.pay_date),
      fileName: `Recu-${data.number}-${p.client}`,
      show_app: !!show_app,
      show_cabinet: !!show_cabinet,
      app_name: 'DORAMIK GESTION CLIENTS',
      cabinet: { name: s.cabinet_name, address: s.cabinet_address, phone: s.cabinet_phone, email: s.cabinet_email, ice: s.cabinet_ice },
      client: { name: p.client, code: p.client_code, ice: p.ice },
      mode,
      mode_details: details,
      reference: p.reference || '',
      payment_amount: p.amount,
      allocated: data.allocated,
      advance: data.advance,
      rest_after: data.rest_after,
      footer: s.receipt_footer || '',
      lines: data.lines.map((l) => ({
        service: App.isAr() && l.service_ar ? l.service_ar : l.service || '',
        period: App.periodLabel(l),
        due_amount: l.due_amount,
        paid_before: l.paid_before,
        amount: l.amount,
        rest_after: l.rest_after,
      })),
      labels: {
        title: t('receipt.title'), number: t('receipt.number'), client: t('col.client'), code: t('col.code'),
        mode: t('field.mode'), details: t('col.details'), reference: t('field.reference'),
        service: t('col.service'), period: t('col.period'), due: t('col.fees'), before: t('receipt.before'),
        allocated: t('receipt.allocated'), rest: t('col.rest'), settled: t('receipt.settled'),
        total_paid: t('receipt.totalPaid'), advance: t('pay.advance'), rest_after: t('receipt.restAfter'),
        no_lines: t('receipt.noLines'), thanks: t('receipt.thanks'),
        sign_client: t('receipt.signClient'), sign_cabinet: t('receipt.signCabinet'),
        print: t('btn.print'), close: t('btn.close'),
      },
    };
  };

  /** Fenêtre du reçu : choix du format, options d'affichage des noms, aperçu / impression / PDF. */
  R.open = async (paymentId, { afterPayment = false } = {}) => {
    let data;
    try {
      data = await App.api('payments.receipt', paymentId);
    } catch (e) {
      App.toast(App.errorText(e), 'err');
      return;
    }
    const s = App.state.settings;
    const st = {
      format: ['A4', 'T80', 'T58'].includes(s.receipt_format) ? s.receipt_format : 'A4',
      show_app: s.receipt_show_app === '1',
      show_cabinet: s.receipt_show_cabinet !== '0',
    };
    const p = data.payment;
    const lines = data.lines.map((l) => `<tr><td>${esc(App.isAr() && l.service_ar ? l.service_ar : l.service)}</td><td>${esc(App.periodLabel(l))}</td>
      <td class="num">${App.money(l.due_amount, false)}</td><td class="num"><b>${App.money(l.amount, false)}</b></td>
      <td class="num">${l.rest_after <= 0 ? `<span class="badge b-green">${t('receipt.settled')}</span>` : `<b style="color:var(--red)">${App.money(l.rest_after, false)}</b>`}</td></tr>`).join('');
    App.modal({
      title: afterPayment ? t('receipt.savedTitle') : t('receipt.title') + ' — ' + data.number,
      size: 'lg',
      body: `<div class="stack">
        ${afterPayment ? `<div class="notice ok">${icon('circle-check-big')}<div>${t('receipt.savedText', { a: App.moneyText(p.amount), c: esc(p.client) })}</div></div>` : ''}
        <div class="row small"><span><b>${esc(p.client)}</b></span><span>${t('col.payDate')} : ${App.date(p.pay_date)}</span><span>${t('field.mode')} : ${esc(App.nm(p, 'mode'))}</span><span>${t('receipt.number')} ${esc(data.number)}</span></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>${t('col.service')}</th><th>${t('col.period')}</th><th class="num">${t('col.fees')}</th><th class="num">${t('receipt.allocated')}</th><th class="num">${t('receipt.restLine')}</th></tr></thead>
          <tbody>${lines || `<tr><td colspan="5" class="empty">${t('receipt.noLines')}</td></tr>`}</tbody>
          <tfoot><tr><td colspan="3">${t('receipt.totalPaid')}</td><td class="num">${App.money(p.amount, false)}</td><td class="num">${App.money(data.rest_after, false)}</td></tr></tfoot></table></div>
        ${data.advance ? `<div class="notice warn">${icon('coins')}<div>${t('receipt.advanceNote', { a: App.moneyText(data.advance) })}</div></div>` : ''}
        <div><div class="section-title">${t('receipt.format')}</div>
          <div class="receipt-opt">${FORMATS.map(([f, ic]) => `<div class="receipt-fmt ${st.format === f ? 'on' : ''}" data-fmt="${f}">${icon(ic)}<div class="rf-t">${esc(t('receipt.fmt.' + f))}</div><div class="rf-s">${esc(t('receipt.fmtHint.' + f))}</div></div>`).join('')}</div></div>
        <div class="row">
          <label class="check"><input type="checkbox" data-opt="show_app" ${st.show_app ? 'checked' : ''}> ${t('receipt.showApp')}</label>
          <label class="check"><input type="checkbox" data-opt="show_cabinet" ${st.show_cabinet ? 'checked' : ''}> ${t('receipt.showCabinet')}</label>
          <span class="spacer"></span><label class="check"><input type="checkbox" data-remember> ${t('receipt.remember')}</label>
        </div>
      </div>`,
      footer: `<button class="btn" data-close>${t('btn.close')}</button>
        <button class="btn" data-pdf>${icon('file-down')} PDF</button>
        <button class="btn primary" data-print>${icon('printer')} ${t('btn.print')}</button>`,
      onMount: (m) => {
        const q = (sel) => m.el.querySelector(sel);
        App.on(m.el, 'click', '[data-fmt]', (e, el) => {
          st.format = el.dataset.fmt;
          m.el.querySelectorAll('[data-fmt]').forEach((x) => x.classList.toggle('on', x === el));
        });
        m.el.querySelectorAll('[data-opt]').forEach((cb) => cb.addEventListener('change', () => { st[cb.dataset.opt] = cb.checked; }));
        const remember = async () => {
          if (!q('[data-remember]').checked) return;
          App.state.settings = await App.api('settings.set', { receipt_format: st.format, receipt_show_app: st.show_app ? 1 : 0, receipt_show_cabinet: st.show_cabinet ? 1 : 0 });
        };
        q('[data-print]').addEventListener('click', async () => {
          await remember();
          try { await window.doramik.receipt.print(R.doc(data, st)); } catch (e) { App.toast(App.errorText(e), 'err'); }
        });
        q('[data-pdf]').addEventListener('click', async () => {
          await remember();
          try {
            const f = await window.doramik.receipt.pdf(R.doc(data, st));
            if (f) App.toast(t('msg.savedTo', { p: f }));
          } catch (e) { App.toast(App.errorText(e), 'err'); }
        });
      },
    });
  };
})();
