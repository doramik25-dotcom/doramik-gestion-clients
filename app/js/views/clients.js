/* DORAMIK GESTION CLIENTS — Liste des clients / sociétés */
(function () {
  'use strict';
  const { esc, t, icon } = App;

  App.views.clients = async (root, params, query) => {
    const st = { status: query.status || 'ACTIVE', legal_form_id: '', q: '' };
    root.innerHTML = `
      <div class="page-head"><div><h1>${t('nav.clients')}</h1><div class="sub">${t('clients.subtitle')}</div></div>
        <div class="actions">
          <button class="btn" data-report>${icon('file-text')} ${t('btn.export')}</button>
          <button class="btn primary" data-new>${icon('plus')} ${t('client.new')}</button></div></div>
      <div class="card">
        <div class="filters">
          <div class="field"><label>${t('field.status')}</label><div class="seg" data-seg>
            <button data-s="ALL">${t('common.all')}</button><button data-s="ACTIVE">${t('clients.actives')}</button><button data-s="INACTIVE">${t('clients.inactives')}</button></div></div>
          <div class="field"><label>${t('field.legal_form')}</label><select class="input" data-lf>${App.options(App.lk('legal_forms'), '', { empty: t('common.all') })}</select></div>
          <div class="field wide"><label>${t('common.search')}</label><input class="input" data-q placeholder="${esc(t('clients.searchPh'))}"></div>
          <div class="muted small" data-count style="align-self:center"></div>
        </div>
        <div data-table></div>
      </div>`;
    const tableEl = root.querySelector('[data-table]');
    const table = new App.Table(tableEl, {
      rows: [],
      columns: [
        { key: 'code', label: t('col.code'), render: (c) => `<span class="ltr muted">${esc(c.code)}</span>` },
        { key: 'name', label: t('col.name'), render: (c) => `<b>${esc(c.name)}</b>${c.email ? `<div class="cell-sub ltr">${esc(c.email)}</div>` : ''}` },
        { key: 'legal_form', label: t('field.legal_form'), sortValue: (c) => App.nm(c, 'legal_form'), render: (c) => esc(App.nm(c, 'legal_form')) },
        { key: 'phone', label: t('field.phone'), render: (c) => `<span class="ltr">${esc(c.phone || '')}</span>` },
        { key: 'ice', label: 'ICE', render: (c) => `<span class="ltr">${esc(c.ice || '')}</span>${c.start_date ? `<div class="cell-sub">${t('field.start_date')} ${App.dateText(c.start_date)}</div>` : ''}` },
        { key: 'status', label: t('col.status'), render: (c) => App.badge(c.status) },
        { key: 'total_due', label: t('col.due'), type: 'money' },
        { key: 'total_paid', label: t('col.paid'), type: 'money' },
        { key: 'total_rest', label: t('col.rest'), type: 'money', render: (c) => `<b>${App.money(c.total_rest, false)}</b>` },
        { key: 'total_late', label: t('col.lateAmount'), type: 'money', render: (c) => (c.total_late ? `<span style="color:var(--red);font-weight:600">${App.money(c.total_late, false)}</span>` : '') },
        { key: '', actions: true, render: (c) => `<button class="btn sm icon" data-act="view" title="${esc(t('btn.view'))}">${icon('eye')}</button><button class="btn sm icon" data-act="edit" title="${esc(t('btn.edit'))}">${icon('pencil')}</button><button class="btn sm icon" data-act="archive" title="${esc(c.status === 'ACTIVE' ? t('client.deactivate') : t('client.activate'))}">${icon(c.status === 'ACTIVE' ? 'user-x' : 'user-check')}</button><button class="btn sm icon danger" data-act="del" title="${esc(t('btn.delete'))}">${icon('trash-2')}</button>` },
      ],
      onAction: async (act, c) => {
        if (act === 'view') return App.go('#/client/' + c.id);
        if (act === 'edit') { const full = await App.api('clients.get', c.id); if (await App.forms.client(full)) load(); return; }
        if (act === 'archive') {
          const to = c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
          if (await App.confirm(to === 'INACTIVE' ? t('client.deactivateConfirm', { n: c.name }) : t('client.activateConfirm', { n: c.name }))) {
            await App.safe(() => App.api('clients.setStatus', c.id, to));
            App.toast(t('msg.saved'));
            load();
          }
          return;
        }
        if (act === 'del') {
          if (!await App.confirm(t('client.deleteConfirm', { n: c.name }), { danger: true, okLabel: t('btn.delete') })) return;
          try {
            await App.api('clients.remove', c.id);
            App.toast(t('msg.clientDeleted'));
          } catch (e) {
            App.toast(App.errorText(e), 'err');
            if (e.code === 'CLIENT_HAS_DATA' && c.status === 'ACTIVE' && await App.confirm(t('msg.archiveInstead'), { okLabel: t('btn.archive') })) {
              await App.safe(() => App.api('clients.setStatus', c.id, 'INACTIVE'));
            }
          }
          await App.loadClientCache();
          load();
        }
      },
      onRowClick: (c) => App.go('#/client/' + c.id),
      empty: t('clients.empty'),
    });
    const load = async () => {
      root.querySelectorAll('[data-seg] button').forEach((b) => b.classList.toggle('on', b.dataset.s === st.status));
      const rows = await App.api('clients.list', st);
      table.setRows(rows, { name: t('common.totalN', { n: rows.length }), total_due: App.sum(rows, 'total_due'), total_paid: App.sum(rows, 'total_paid'), total_rest: App.sum(rows, 'total_rest'), total_late: App.sum(rows, 'total_late') });
      root.querySelector('[data-count]').textContent = t('common.nResults', { n: rows.length });
    };
    App.on(root, 'click', '[data-seg] button', (e, b) => { st.status = b.dataset.s; load(); });
    root.querySelector('[data-lf]').addEventListener('change', (e) => { st.legal_form_id = e.target.value; load(); });
    root.querySelector('[data-q]').addEventListener('input', App.debounce((e) => { st.q = e.target.value; load(); }, 200));
    root.querySelector('[data-new]').addEventListener('click', async () => { const id = await App.forms.client(); if (id) App.go('#/client/' + id); });
    root.querySelector('[data-report]').addEventListener('click', () => App.go('#/rapport/' + (st.status === 'INACTIVE' ? 'clients_inactive' : 'clients_active')));
    await load();
  };
})();
