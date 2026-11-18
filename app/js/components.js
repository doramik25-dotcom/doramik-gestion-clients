/* DORAMIK GESTION CLIENTS — composants réutilisables : tableau, KPI, graphique, sélecteur de client */
(function () {
  'use strict';
  const { esc, t, icon } = App;

  // ------------------------------------------------------------ tableau triable
  class Table {
    constructor(el, opts) {
      this.el = el;
      this.o = Object.assign({ pageSize: 300, empty: t('common.noData') }, opts);
      this.limit = this.o.pageSize;
      this.sort = this.o.sort || null; // {key, dir}
      if (el.__table) el.removeEventListener('click', el.__table._h);
      el.__table = this;
      this._h = (e) => this.onClick(e);
      el.addEventListener('click', this._h);
      this.render();
    }
    setRows(rows, totals) {
      this.o.rows = rows;
      if (totals !== undefined) this.o.totals = totals;
      this.limit = this.o.pageSize;
      this.render();
    }
    sorted() {
      const rows = this.o.rows.slice();
      if (!this.sort) return rows;
      const col = this.o.columns.find((c) => c.key === this.sort.key);
      if (!col) return rows;
      const get = col.sortValue || ((r) => r[col.key]);
      const dir = this.sort.dir === 'desc' ? -1 : 1;
      return rows.sort((a, b) => {
        const va = get(a); const vb = get(b);
        if (va === vb) return 0;
        if (va === null || va === undefined || va === '') return 1;
        if (vb === null || vb === undefined || vb === '') return -1;
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va).localeCompare(String(vb), App.state.lang, { numeric: true, sensitivity: 'base' }) * dir;
      });
    }
    cell(c, r) {
      if (c.render) return c.render(r);
      const v = r[c.key];
      if (c.type === 'money') return App.money(v, false);
      if (c.type === 'date') return App.date(v);
      return esc(v);
    }
    render() {
      const { columns, totals, rowClass, onRowClick } = this.o;
      const rows = this.sorted();
      this.view = rows;
      const shown = rows.slice(0, this.limit);
      const isNum = (c) => c.type === 'money' || c.type === 'number' || c.align === 'end';
      const head = columns.map((c) => {
        const s = this.sort && this.sort.key === c.key ? `<span class="arrow">${this.sort.dir === 'desc' ? '▼' : '▲'}</span>` : '';
        const sortable = c.sortable !== false && c.key && !c.actions;
        return `<th class="${isNum(c) ? 'num' : ''} ${sortable ? 'sortable' : ''}" ${sortable ? `data-sort="${c.key}"` : ''} ${c.width ? `style="width:${c.width}"` : ''}>${esc(c.label || '')}${s}</th>`;
      }).join('');
      const body = shown.length ? shown.map((r, i) => `<tr data-idx="${i}" class="${onRowClick ? 'click' : ''} ${rowClass ? rowClass(r) : ''}">${columns.map((c) =>
        `<td class="${isNum(c) ? 'num' : ''} ${c.actions ? 'actions' : ''} ${c.cls || ''}">${this.cell(c, r)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${columns.length}" class="empty">${esc(this.o.empty)}</td></tr>`;
      const foot = totals && rows.length ? `<tfoot><tr>${columns.map((c) => `<td class="${isNum(c) ? 'num' : ''}">${totals[c.key] !== undefined ? (c.type === 'money' && typeof totals[c.key] === 'number' ? App.money(totals[c.key], false) : totals[c.key]) : ''}</td>`).join('')}</tr></tfoot>` : '';
      const more = rows.length > this.limit ? `<div class="more-row"><button class="btn sm" data-more>${t('common.showMore', { n: rows.length - this.limit })}</button></div>` : '';
      this.el.innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table></div>${more}`;
    }
    onClick(e) {
      const th = e.target.closest('th[data-sort]');
      if (th) {
        const k = th.dataset.sort;
        if (this.sort && this.sort.key === k) this.sort = { key: k, dir: this.sort.dir === 'asc' ? 'desc' : 'asc' };
        else this.sort = { key: k, dir: 'asc' };
        this.render();
        return;
      }
      if (e.target.closest('[data-more]')) { this.limit += this.o.pageSize * 3; this.render(); return; }
      const btn = e.target.closest('[data-act]');
      const tr = e.target.closest('tr[data-idx]');
      if (!tr) return;
      const row = this.view[Number(tr.dataset.idx)];
      if (btn) {
        e.stopPropagation();
        if (this.o.onAction) this.o.onAction(btn.dataset.act, row, btn);
        return;
      }
      if (e.target.closest('a,button,input,select')) return;
      if (this.o.onRowClick) this.o.onRowClick(row);
    }
  }
  App.Table = Table;

  // ------------------------------------------------------------ cartes KPI
  App.kpi = ({ label, value, sub = '', ic = 'info', tone = 'blue', href = '' }) =>
    `<div class="kpi tone-${tone} ${href ? 'click' : ''}" ${href ? `data-href="${esc(href)}"` : ''}><div class="ki">${icon(ic)}</div><div class="grow"><div class="kl">${esc(label)}</div><div class="kv">${value}</div>${sub ? `<div class="ks">${sub}</div>` : ''}</div></div>`;

  // ------------------------------------------------------------ graphique en barres (SVG)
  App.barChart = ({ labels, series, height = 260 }) => {
    const W = 860; const H = height; const padL = 64; const padR = 14; const padT = 14; const padB = 34;
    const max = Math.max(1, ...series.flatMap((s) => s.values));
    const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); const m = max / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; })();
    const n = labels.length;
    const gw = (W - padL - padR) / n;
    const bw = Math.min(22, (gw - 10) / series.length);
    const y = (v) => padT + (H - padT - padB) * (1 - v / nice);
    const rtl = App.isAr();
    const xg = (i) => padL + (rtl ? (n - 1 - i) : i) * gw;
    let s = `<svg class="chart" style="direction:ltr" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">`;
    for (let k = 0; k <= 4; k++) {
      const v = (nice / 4) * k;
      const yy = y(v);
      s += `<line x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" stroke="#e5e7eb"/>`;
      s += `<text x="${padL - 8}" y="${yy + 4}" text-anchor="end">${esc(App.fmtNumber(v).replace(/,00$/, ''))}</text>`;
    }
    labels.forEach((lb, i) => {
      const gx = xg(i);
      const start = gx + (gw - bw * series.length) / 2;
      series.forEach((se, j) => {
        const v = se.values[i] || 0;
        const yy = y(v);
        s += `<rect x="${start + j * bw}" y="${yy}" width="${bw - 2}" height="${Math.max(0, H - padB - yy)}" rx="3" fill="${se.color}"><title>${esc(se.name)} — ${esc(lb)} : ${esc(App.moneyText(v))}</title></rect>`;
      });
      s += `<text x="${gx + gw / 2}" y="${H - padB + 18}" text-anchor="middle">${esc(lb)}</text>`;
    });
    s += '</svg>';
    const legend = `<div class="legend">${series.map((se) => `<span><i class="dot" style="background:${se.color}"></i>${esc(se.name)}</span>`).join('')}</div>`;
    return legend + s;
  };

  // ------------------------------------------------------------ sélecteur de client (recherche)
  /**
   * Champ de sélection de client avec recherche. Retourne du HTML ; appeler App.bindClientPicker(root)
   * après insertion. La valeur est stockée dans l'input caché name=<name>.
   */
  App.clientPicker = (name, clientId, { allowEmpty = true, placeholder = '', status = 'ALL', actions = true, sticky = false } = {}) => {
    const list = App.state.clientCache || [];
    // Filtre « collant » : on reprend le client courant si aucune valeur n'est imposée
    const value = sticky ? App.clientFilterValue(clientId) : clientId;
    const cur = list.find((c) => String(c.id) === String(value));
    return `<div class="picker" data-picker data-status="${status}" data-allow-empty="${allowEmpty ? 1 : 0}" data-actions="${actions ? 1 : 0}" data-sticky="${sticky ? 1 : 0}">
      <input type="hidden" name="${name}" value="${esc(cur ? cur.id : (sticky ? '' : (clientId || '')))}">
      <div class="picker-row">
        <input class="input" data-picker-text autocomplete="off" placeholder="${esc(placeholder || t('common.searchClient'))}" value="${esc(cur ? cur.name : '')}">
        ${actions ? `<button type="button" class="btn icon" data-pick-view title="${esc(t('picker.view'))}" ${cur ? '' : 'disabled'}>${icon('eye')}</button>
        <button type="button" class="btn icon" data-pick-edit title="${esc(t('picker.edit'))}" ${cur ? '' : 'disabled'}>${icon('pencil')}</button>
        <button type="button" class="btn icon primary" data-pick-new title="${esc(t('picker.new'))}">${icon('plus')}</button>` : ''}
      </div>
      <div class="search-results hidden" data-picker-list></div></div>`;
  };
  App.loadClientCache = async () => {
    App.state.clientCache = await App.api('clients.list', { status: 'ALL' });
    // Le client courant disparaît seulement s'il n'existe plus (suppression, restauration)
    if (App.state.clientId && !App.state.clientCache.some((c) => c.id === App.state.clientId)) App.setCurrentClient(null);
    return App.state.clientCache;
  };

  /**
   * Active un sélecteur de client : recherche, sélection, consultation, modification,
   * changement de client et création d'un nouveau client — sans quitter le module courant.
   */
  App.bindClientPicker = (root, onChange) => {
    root.querySelectorAll('[data-picker]').forEach((pk) => {
      if (pk.dataset.bound === '1') return;
      pk.dataset.bound = '1';
      const hidden = pk.querySelector('input[type=hidden]');
      const txt = pk.querySelector('[data-picker-text]');
      const listEl = pk.querySelector('[data-picker-list]');
      const status = pk.dataset.status;
      let sel = -1;
      let items = [];
      const current = () => (App.state.clientCache || []).find((c) => String(c.id) === hidden.value);
      const syncButtons = () => {
        const has = !!current();
        pk.querySelectorAll('[data-pick-view],[data-pick-edit]').forEach((b) => { b.disabled = !has; });
      };
      const draw = () => {
        const q = txt.value.trim().toLowerCase();
        items = (App.state.clientCache || []).filter((c) => (status === 'ALL' || c.status === status) &&
          (!q || [c.name, c.code, c.ice, c.if_code, c.phone, c.email, c.rc].some((v) => v && String(v).toLowerCase().includes(q)))).slice(0, 40);
        const newRow = `<div class="it it-new" data-new-client>${icon('user-check')}<div class="grow"><div class="t">${esc(t('picker.new'))}</div>
          <div class="s">${esc(t('picker.newHint'))}</div></div></div>`;
        listEl.innerHTML = newRow + (items.length ? items.map((c, i) => `<div class="it ${i === sel ? 'sel' : ''}" data-i="${i}"><div class="grow"><div class="t">${esc(c.name)}</div>
          <div class="s">${esc([c.code, c.ice ? 'ICE ' + c.ice : '', c.phone, c.status === 'INACTIVE' ? t('status.INACTIVE') : ''].filter(Boolean).join(' · '))}</div></div>
          <div class="s">${c.total_rest ? App.moneyText(c.total_rest) : ''}</div></div>`).join('')
          : `<div class="notif-empty">${t('common.noResult')}</div>`);
        listEl.classList.remove('hidden');
      };
      const sticky = pk.dataset.sticky === '1';
      const pick = (c, { silent = false } = {}) => {
        hidden.value = c ? c.id : '';
        txt.value = c ? c.name : '';
        listEl.classList.add('hidden');
        syncButtons();
        // Filtre collant : le client choisi devient le client courant de l'application
        if (sticky) App.setCurrentClient(c ? c.id : null);
        if (!silent && onChange) onChange(c ? c.id : '', c);
      };
      // Le filtre reprend le client courant dès l'ouverture du module
      if (sticky) App.setCurrentClient(hidden.value || null);
      App.pickerSelect = (el, id) => {
        const c = (App.state.clientCache || []).find((x) => String(x.id) === String(id));
        if (c) pick(c);
      };
      txt.addEventListener('mousedown', () => { if (listEl.classList.contains('hidden')) { sel = -1; setTimeout(draw, 0); } });
      txt.addEventListener('focus', () => txt.select());
      txt.addEventListener('input', () => {
        sel = 0;
        draw();
        // Champ vidé : retour volontaire à « tous les clients »
        if (!txt.value && pk.dataset.allowEmpty === '1') {
          hidden.value = '';
          syncButtons();
          if (sticky) App.setCurrentClient(null);
          if (onChange) onChange('', null);
        }
      });
      txt.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); draw(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
        else if (e.key === 'Enter') { if (items[sel]) pick(items[sel]); e.preventDefault(); }
        else if (e.key === 'Escape') { listEl.classList.add('hidden'); }
      });
      listEl.addEventListener('mousedown', async (e) => {
        if (e.target.closest('[data-new-client]')) {
          e.preventDefault();
          listEl.classList.add('hidden');
          await App.pickerCreateClient(pick);
          return;
        }
        const it = e.target.closest('[data-i]');
        if (it) { e.preventDefault(); pick(items[Number(it.dataset.i)]); }
      });
      txt.addEventListener('blur', () => setTimeout(() => {
        if (listEl.matches(':hover')) return;
        listEl.classList.add('hidden');
        const cur = current();
        txt.value = cur ? cur.name : '';
      }, 150));
      // Boutons : voir la fiche, modifier, nouveau client — tout reste dans le module
      const btnNew = pk.querySelector('[data-pick-new]');
      if (btnNew) btnNew.addEventListener('click', () => App.pickerCreateClient(pick));
      const btnView = pk.querySelector('[data-pick-view]');
      if (btnView) btnView.addEventListener('click', async () => { const c = current(); if (c) await App.clientCard(c.id, pick); });
      const btnEdit = pk.querySelector('[data-pick-edit]');
      if (btnEdit) btnEdit.addEventListener('click', async () => {
        const c = current();
        if (!c) return;
        const full = await App.api('clients.get', c.id);
        if (await App.forms.client(full)) {
          await App.loadClientCache();
          pick((App.state.clientCache || []).find((x) => x.id === c.id));
          App.toast(t('msg.saved'));
        }
      });
      syncButtons();
    });
  };

  /** Création d'un client depuis n'importe quel module : on reste dans le module et le client est sélectionné. */
  App.pickerCreateClient = async (pick) => {
    const id = await App.forms.client();
    if (!id) return null;
    await App.loadClientCache();
    const c = (App.state.clientCache || []).find((x) => String(x.id) === String(id));
    if (c && pick) pick(c);
    App.toast(t('picker.created', { n: c ? c.name : '' }));
    return id;
  };

  /** Fiche client en aperçu rapide (sans quitter le module) : informations, soldes, modification. */
  App.clientCard = (clientId, pick) => new Promise(async (resolve) => {
    let c;
    let sit;
    try {
      c = await App.api('clients.get', clientId);
      sit = await App.api('situation.get', clientId, {});
    } catch (e) { App.toast(App.errorText(e), 'err'); return resolve(false); }
    const kv = (k, v) => `<div><div class="k">${esc(k)}</div><div class="v">${v || '<span class="muted">—</span>'}</div></div>`;
    App.modal({
      title: c.name,
      size: 'lg',
      body: `<div class="stack">
        <div class="row">${App.badge(c.status)}${c.legal_form ? `<span class="badge b-blue">${esc(App.nm(c, 'legal_form'))}</span>` : ''}
          <span class="muted small ltr">${esc([c.code, c.ice && 'ICE ' + c.ice, c.if_code && 'IF ' + c.if_code].filter(Boolean).join(' · '))}</span></div>
        <div class="kpis">
          ${App.kpi({ label: t('client.totalDue'), value: App.money(sit.totals.due), ic: 'receipt', tone: 'blue' })}
          ${App.kpi({ label: t('client.totalPaid'), value: App.money(sit.totals.paid), ic: 'banknote', tone: 'green' })}
          ${App.kpi({ label: t('client.totalRest'), value: App.money(sit.totals.rest), ic: 'wallet', tone: 'orange' })}
        </div>
        <div class="kv-list">
          ${kv(t('field.phone'), `<span class="ltr">${esc(c.phone || '')}</span>`)}${kv(t('field.email'), `<span class="ltr">${esc(c.email || '')}</span>`)}
          ${kv(t('field.address'), esc(c.address || ''))}${kv(t('field.rc'), `<span class="ltr">${esc(c.rc || '')}</span>`)}
          ${kv(t('field.cnss'), `<span class="ltr">${esc(c.cnss || '')}</span>`)}${kv(t('field.start_date'), App.date(c.start_date))}
        </div>
        ${c.notes ? `<div><div class="section-title">${t('field.notes')}</div><div style="white-space:pre-wrap">${esc(c.notes)}</div></div>` : ''}
      </div>`,
      footer: `<div class="left"><button class="btn" data-full>${icon('external-link')} ${t('picker.openFull')}</button></div>
        <button class="btn" data-close>${t('btn.close')}</button><button class="btn primary" data-edit>${icon('pencil')} ${t('btn.edit')}</button>`,
      onMount: (m) => {
        m.el.querySelector('[data-full]').addEventListener('click', () => { m.close(); App.go('#/client/' + c.id); });
        m.el.querySelector('[data-edit]').addEventListener('click', async () => {
          m.close();
          if (await App.forms.client(c)) {
            await App.loadClientCache();
            if (pick) pick((App.state.clientCache || []).find((x) => x.id === c.id));
            App.toast(t('msg.saved'));
            resolve(true);
          } else resolve(false);
        });
      },
      onClose: () => resolve(false),
    });
  });

  // ------------------------------------------------------------ colonnes standard des échéances
  App.dueColumns = ({ client = true, actions = true, category = false, filing = true, fees = false } = {}) => {
    const cols = [];
    if (client) cols.push({ key: 'client', label: t('col.client'), render: (d) => `<a data-act="client">${esc(d.client)}</a>${d.client_status === 'INACTIVE' ? ` <span class="badge b-gray">${t('status.INACTIVE')}</span>` : ''}` });
    cols.push({ key: 'service', label: t('col.service'), sortValue: (d) => App.serviceName(d), render: (d) => `${esc(App.serviceName(d))}${category ? `<div class="cell-sub">${esc(App.isAr() && d.category_ar ? d.category_ar : d.category || '')}</div>` : ''}` });
    cols.push({ key: 'period_start', label: t('col.period'), sortValue: (d) => d.ref_date, render: (d) => esc(App.periodLabel(d)) + (d.kind === 'ONE_OFF' ? ` <span class="badge b-gray">${t('period.oneoffShort')}</span>` : '') });
    // 1. date de dépôt / réalisation (automatique)  2. échéance des honoraires (facultative)
    if (filing) cols.push({ key: 'filing_date', label: t('col.filingDate'), type: 'date' });
    cols.push({ key: 'amount', label: fees ? t('col.fees') : t('col.due'), type: 'money' });
    cols.push({ key: 'due_date', label: t('col.dueDateFees'), type: 'date', render: (d) => (d.due_date ? App.date(d.due_date) : `<span class="muted small">${esc(t('timing.NO_DUE'))}</span>`) });
    cols.push({ key: 'paid', label: t('col.paid'), type: 'money' });
    cols.push({ key: 'rest', label: t('col.rest'), type: 'money', render: (d) => `<b>${App.money(d.rest, false)}</b>` });
    cols.push({ key: 'status', label: t('col.status'), sortValue: (d) => ({ LATE: 0, PARTIAL: 1, UNPAID: 2, PAID: 3 })[d.status],
      render: (d) => App.dueBadge(d) + (d.days_late > 0 ? `<div class="cell-sub" style="color:var(--red);font-weight:600">${t('col.late')} : ${t('common.days', { n: d.days_late })}</div>` : '') });
    if (actions) {
      cols.push({ key: '', actions: true, label: '', render: (d) => `${d.rest > 0 ? `<button class="btn sm icon success" data-act="pay" title="${esc(t('btn.pay'))}">${icon('hand-coins')}</button>` : ''}<button class="btn sm icon" data-act="detail" title="${esc(t('btn.view'))}">${icon('eye')}</button><button class="btn sm icon" data-act="edit" title="${esc(t('btn.edit'))}">${icon('pencil')}</button>${d.paid === 0 ? `<button class="btn sm icon danger" data-act="del" title="${esc(t('btn.delete'))}">${icon('trash-2')}</button>` : ''}` });
    }
    return cols;
  };
  App.dueTotals = (rows) => ({ amount: App.sum(rows, 'amount'), paid: App.sum(rows, 'paid'), rest: App.sum(rows, 'rest') });
})();
