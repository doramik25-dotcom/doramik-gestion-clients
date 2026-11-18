/*
 * DORAMIK GESTION CLIENTS — saisie automatique d'une fiche client à partir d'un document.
 *
 * L'utilisateur garde toujours la main : les informations lues sont affichées dans le
 * formulaire habituel, modifiables, et rien n'est enregistré sans sa validation.
 * Une information non reconnue reste vide et est signalée ; une information déjà saisie
 * n'est jamais remplacée sans accord explicite.
 */
(function () {
  'use strict';
  const { esc, t, icon } = App;
  const I = (App.docImport = {});

  // Correspondance entre les six informations lues et les champs de la fiche client
  const MAP = [
    ['name', 'name', 'field.name'],
    ['legal_form', 'legal_form_id', 'field.legal_form'],
    ['ice', 'ice', 'field.ice'],
    ['if_code', 'if_code', 'field.if_code'],
    ['tp', 'tp_code', 'field.tp_code'],
    ['address', 'address', 'field.address'],
  ];

  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

  /** Forme juridique du document → entrée existante de la liste (jamais de doublon). */
  function matchLegalForm(code, label) {
    const list = App.lk('legal_forms');
    const wanted = norm(code || label);
    if (!wanted) return null;
    return list.find((f) => norm(f.name) === wanted)
      || list.find((f) => norm(f.name_ar) === wanted)
      || list.find((f) => norm(f.name) && (wanted.startsWith(norm(f.name) + ' ') || wanted === norm(f.name)))
      || null;
  }

  /** Valeur lue, prête pour le champ du formulaire. */
  function valueFor(key, r) {
    const f = r.fields[key];
    if (!f || !f.value) return null;
    if (key === 'legal_form') {
      const lf = matchLegalForm(r.legal_form_code, f.value);
      return lf ? { value: String(lf.id), text: App.nm(lf), confidence: f.confidence } : { value: '', text: f.value, confidence: 'low', unmatched: true };
    }
    return { value: f.value, text: f.value, confidence: f.confidence };
  }

  /**
   * Active le bouton « Importer un document » d'un formulaire client.
   * @param {object} m      fenêtre modale
   * @param {HTMLFormElement} form
   * @param {object} client fiche en cours (vide pour une création)
   * @param {function} onDoc appelée avec le document à conserver
   */
  I.bind = (m, form, client, onDoc) => {
    const btn = m.el.querySelector('[data-import]');
    if (!btn) return { apply: () => {} };
    const state = m.el.querySelector('[data-import-state]');
    const setState = (html) => { state.innerHTML = html; };

    // La saisie manuelle reprend toujours le dessus sur la valeur lue
    form.addEventListener('input', (e) => {
      const el = e.target.closest('.read-auto');
      if (el) el.classList.remove('read-auto');
    });
    form.addEventListener('change', (e) => {
      const el = e.target.closest('.read-auto');
      if (el) el.classList.remove('read-auto');
    });

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      setState(`<div class="notice info" data-prog>${icon('loader')}<div>${t('import.working')}</div></div>`);
      window.doramik.extract.onProgress((p) => {
        const node = state.querySelector('[data-prog] div');
        if (!node) return;
        const label = p.phase === 'OCR' || p.phase === 'OCR_INIT' ? t('import.ocr') : t('import.reading');
        node.textContent = `${label} ${p.pct ? p.pct + ' %' : ''}`.trim();
      });
      let r;
      try {
        r = await window.doramik.extract.pick();
      } catch (e) {
        setState(`<div class="notice err">${icon('circle-alert')}<div>${esc(App.errorText(e))}</div></div>`);
        btn.disabled = false;
        return;
      }
      btn.disabled = false;
      if (!r) { setState(''); return; }
      apply(r);
    });

    /** Remplit le formulaire et affiche le compte rendu de lecture. */
    function apply(r) {
      const filled = [];
      const kept = [];
      const missing = [];
      for (const [key, inputName, labelKey] of MAP) {
        const input = form.querySelector(`[name=${inputName}]`);
        const v = valueFor(key, r);
        if (!input) continue;
        if (!v || (!v.value && !v.unmatched)) { missing.push(t(labelKey)); continue; }
        if (v.unmatched) { missing.push(`${t(labelKey)} (${esc(v.text)})`); continue; }
        const current = String(input.value || '').trim();
        if (!current) {
          input.value = v.value;
          input.classList.add('read-auto');
          if (v.confidence === 'low') input.classList.add('read-doubt');
          filled.push({ label: t(labelKey), text: v.text, confidence: v.confidence });
        } else if (norm(current) !== norm(v.value)) {
          kept.push({ label: t(labelKey), text: v.text, current: inputName === 'legal_form_id' ? (App.lkById('legal_forms', current) ? App.nm(App.lkById('legal_forms', current)) : current) : current, input: inputName, value: v.value });
        } else {
          filled.push({ label: t(labelKey), text: v.text, confidence: v.confidence, same: true });
        }
      }
      render(r, filled, kept, missing);
      checkDuplicate(r);
      if (r.file_path) {
        onDoc({ path: r.file_path, title: t('import.docTitle') + ' — ' + (r.file_name || '') });
      }
    }

    function render(r, filled, kept, missing) {
      const mode = r.mode === 'OCR' ? t('import.modeOcr', { c: r.confidence || 0 }) : t('import.modeText');
      const doubts = filled.filter((f) => f.confidence === 'low');
      setState(`
        <div class="notice ok">${icon('circle-check-big')}<div>
          <b>${t('import.done', { n: filled.length })}</b> — ${esc(r.file_name || '')} · ${esc(mode)}
          <div class="small" style="margin-top:4px">${filled.map((f) => `${esc(f.label)} : <b>${esc(f.text)}</b>`).join(' &nbsp;·&nbsp; ') || t('import.nothing')}</div>
        </div></div>
        ${doubts.length ? `<div class="notice warn">${icon('circle-alert')}<div>${t('import.doubt', { f: doubts.map((d) => esc(d.label)).join(', ') })}</div></div>` : ''}
        ${missing.length ? `<div class="notice warn">${icon('circle-alert')}<div>${t('import.missing', { f: missing.map(esc).join(', ') })}</div></div>` : ''}
        ${kept.length ? `<div class="notice info">${icon('info')}<div><b>${t('import.diff')}</b>
          <table class="tbl sm" style="margin-top:6px"><thead><tr><th>${t('col.field')}</th><th>${t('import.current')}</th><th>${t('import.read')}</th><th></th></tr></thead>
          <tbody>${kept.map((k, i) => `<tr><td>${esc(k.label)}</td><td>${esc(k.current)}</td><td><b>${esc(k.text)}</b></td>
            <td><button type="button" class="btn sm" data-replace="${i}">${t('import.replace')}</button></td></tr>`).join('')}</tbody></table>
        </div></div>` : ''}
        <label class="check" style="margin-top:6px"><input type="checkbox" data-keep-doc checked> ${t('import.keepDoc')}</label>
        <div data-dup></div>`);
      const keep = state.querySelector('[data-keep-doc]');
      keep.addEventListener('change', () => onDoc(keep.checked && r.file_path ? { path: r.file_path, title: t('import.docTitle') + ' — ' + (r.file_name || '') } : null));
      state.querySelectorAll('[data-replace]').forEach((b) => b.addEventListener('click', () => {
        const k = kept[Number(b.dataset.replace)];
        const input = form.querySelector(`[name=${k.input}]`);
        if (!input) return;
        input.value = k.value;
        input.classList.add('read-auto');
        b.closest('tr').remove();
        App.toast(t('import.replaced', { f: k.label }));
      }));
    }

    /** Une fiche existe-t-elle déjà avec ces identifiants ? */
    async function checkDuplicate(r) {
      const box = state.querySelector('[data-dup]');
      if (!box) return;
      const v = (k) => (r.fields[k] && r.fields[k].value) || '';
      let found = [];
      try {
        found = await App.api('clients.findSimilar', { ice: v('ice'), if_code: v('if_code'), tp_code: v('tp'), name: v('name'), exclude: client && client.id });
      } catch (e) { return; }
      if (!found.length) return;
      const c0 = found[0];
      box.innerHTML = `<div class="notice warn">${icon('users')}<div>
        <b>${t('import.dupTitle')}</b> — ${esc(c0.name)} (${esc(c0.code || '')}) · ${t('import.dupBy.' + c0.match)}
        <div style="margin-top:6px"><button type="button" class="btn sm" data-open-dup>${icon('pencil')} ${t('import.dupOpen')}</button></div>
      </div></div>`;
      box.querySelector('[data-open-dup]').addEventListener('click', async () => {
        const full = await App.safe(() => App.api('clients.get', c0.id));
        m.close();
        // La fiche existante s'ouvre en modification : les informations lues y sont reportées,
        // sans écraser ce qui est déjà renseigné.
        const saved = await F2().client(full, { prefill: r });
        if (saved) App.refresh();
      });
    }

    return { apply };
  };

  // accès différé au module des formulaires (chargé après celui-ci)
  const F2 = () => App.forms;
})();
