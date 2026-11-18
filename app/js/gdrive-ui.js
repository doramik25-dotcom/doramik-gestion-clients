/* DORAMIK GESTION CLIENTS — Google Drive : connexion, démarrage, nouveau poste, conflits, état dans la barre supérieure */
(function () {
  'use strict';
  const { esc, t, icon } = App;
  const G = () => window.doramik.gdrive;
  const gd = (App.gd = { st: null, handlingConflict: false });

  const when = (iso) => (iso ? App.dateTime(iso) : '');

  /** Fenêtre à choix multiples : renvoie l'identifiant du bouton choisi (null si fermée par la croix). */
  const choose = ({ title, body, buttons, size = '' }) => new Promise((resolve) => {
    let result = null;
    App.modal({
      title, size, body, dismissable: false,
      footer: buttons.map((b) => `<button class="btn ${b.cls || ''}" data-ch="${b.id}">${b.icon ? icon(b.icon) + ' ' : ''}${esc(b.label)}</button>`).join(''),
      onMount: (m) => m.el.querySelectorAll('[data-ch]').forEach((el) => el.addEventListener('click', () => { result = el.dataset.ch; m.close(); })),
      onClose: () => resolve(result),
    });
  });

  const askPassword = (hint) => new Promise((resolve) => {
    let result = null;
    App.modal({
      title: t('gd.passwordAsk'), size: 'sm',
      body: `<div class="stack"><div class="small muted" style="line-height:1.5">${esc(hint || t('gd.passwordAskHint'))}</div>
        <div class="field"><label>${esc(t('gd.password'))}</label><input class="input" type="password" data-pw autocomplete="off"></div></div>`,
      footer: `<button class="btn" data-close>${t('btn.cancel')}</button><button class="btn primary" data-ok>${t('btn.confirm')}</button>`,
      onMount: (m) => {
        const inp = m.el.querySelector('[data-pw]');
        const ok = () => { if (!inp.value) { inp.classList.add('invalid'); return; } result = inp.value; m.close(); };
        m.el.querySelector('[data-ok]').addEventListener('click', ok);
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
      },
      onClose: () => resolve(result),
    });
  });
  gd.askPassword = askPassword;

  // ------------------------------------------------------------ état dans la barre supérieure
  gd.refreshStatus = async () => {
    try { gd.st = await G().status(); } catch (e) { /* ignore */ }
    gd.drawPill();
    return gd.st;
  };

  gd.pillState = (s) => {
    if (!s || (!s.connected && !s.authLost)) return null;
    if (s.authLost) return ['auth', 'cloud-off', 'orange'];
    if (s.conflict || s.paused) return ['conflict', 'triangle-alert', 'orange'];
    if (s.busy) return ['busy', 'cloud-upload', 'blue'];
    if (s.lastError && s.lastError.code === 'GDRIVE_OFFLINE') return ['offline', 'cloud-off', 'gray'];
    if (s.dirty) return ['pending', 'cloud-upload', 'blue'];
    return ['ok', 'cloud', 'green'];
  };

  gd.drawPill = () => {
    const el = document.getElementById('gdpill');
    if (!el) return;
    const p = gd.pillState(gd.st);
    if (!p) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.className = 'gd-pill tone-' + p[2];
    el.title = t('gd.pill.title') + (gd.st.lastSyncAt ? ' — ' + t('gd.lastSync') + ' : ' + when(gd.st.lastSyncAt) : '');
    el.innerHTML = `${icon(p[1])}<span>${esc(t('gd.pill.' + p[0]))}</span>`;
    el.dataset.state = p[0];
  };

  // ------------------------------------------------------------ configuration (identifiants Google, une seule fois)
  gd.configure = () => new Promise((resolve) => {
    let ok = false;
    G().status().then((st) => {
      App.modal({
        title: t('gd.cfg.title'), size: 'lg',
        body: `<div class="stack">
          <div class="notice info">${icon('info')}<div>${t('gd.cfg.intro')}</div></div>
          <ol class="gd-steps">${[1, 2, 3, 4, 5].map((i) => `<li>${esc(t(`gd.cfg.step${i}`))}</li>`).join('')}</ol>
          <div class="row"><button class="btn" data-import>${icon('file-json')} ${t('gd.cfg.import')}</button><span class="small muted">${t('gd.cfg.or')}</span></div>
          <form class="form-grid">
            ${App.field(t('gd.cfg.clientId'), `<input class="input ltr" name="clientId" autocomplete="off" spellcheck="false" placeholder="123456789-xxxx.apps.googleusercontent.com" value="${esc(st.configSource === 'user' ? st.clientId : '')}">`, { full: true })}
            ${App.field(t('gd.cfg.clientSecret'), `<input class="input ltr" name="clientSecret" type="password" autocomplete="off" spellcheck="false" placeholder="GOCSPX-…">`, { full: true })}
          </form>
          ${st.configured ? `<div class="small muted">${icon('check')} ${t('gd.cfg.current', { id: esc(st.clientId) })}</div>` : ''}
        </div>`,
        footer: `${st.configSource === 'user' && !st.connected ? `<button class="btn danger left" data-clear>${t('gd.cfg.clear')}</button>` : ''}<button class="btn" data-close>${t('btn.close')}</button><button class="btn primary" data-save>${icon('save')} ${t('btn.save')}</button>`,
        onMount: (m) => {
          const done = (s) => { App.toast(t('gd.cfg.saved')); ok = !!(s && s.configured); m.close(); };
          m.el.querySelector('[data-import]').addEventListener('click', async () => {
            try { const s = await G().importConfig(); if (s) done(s); } catch (e) { App.toast(App.errorText(e), 'err'); }
          });
          m.el.querySelector('[data-save]').addEventListener('click', async () => {
            const f = m.el.querySelector('form');
            const raw = f.clientId.value.trim();
            try {
              // un JSON collé dans le champ « ID client » est accepté
              const s = raw.startsWith('{') ? await G().importConfigText(raw) : await G().setConfig({ clientId: raw, clientSecret: f.clientSecret.value });
              done(s);
            } catch (e) { App.toast(App.errorText(e), 'err'); }
          });
          const clr = m.el.querySelector('[data-clear]');
          if (clr) clr.addEventListener('click', async () => { try { await G().clearConfig(); ok = false; m.close(); } catch (e) { App.toast(App.errorText(e), 'err'); } });
        },
        onClose: () => resolve(ok),
      });
    });
  });

  // ------------------------------------------------------------ restauration d'une version de Drive
  gd.restore = async (entry) => {
    let pw;
    for (;;) {
      try {
        const r = await G().restore(entry.id, pw);
        await G().begin();
        App.toast(t('gd.restored'));
        if (r && r.safety) App.toast(t('backup.safetyDone'), 'ok', 6000);
        setTimeout(() => window.doramik.reload(), 900);
        return true;
      } catch (e) {
        if (e.code === 'GDRIVE_PASSWORD_REQUIRED' || e.code === 'GDRIVE_BAD_PASSWORD') {
          if (e.code === 'GDRIVE_BAD_PASSWORD') App.toast(App.errorText(e), 'err');
          pw = await askPassword();
          if (!pw) return false;
          continue;
        }
        App.toast(App.errorText(e), 'err');
        return false;
      }
    }
  };

  // ------------------------------------------------------------ décisions selon l'état de Drive
  const meta = (r) => ({ r: r.rev, d: when(r.createdTime), p: r.deviceName || '?' });

  /** Traite le résultat de la comparaison poste / Drive (au démarrage ou juste après la connexion). */
  gd.handleCheck = async (c, { first = false } = {}) => {
    if (!c) return;
    if (c.other) {
      const go = await choose({
        title: t('gd.other.title'),
        body: `<div style="line-height:1.6">${esc(t('gd.other.body', { p: c.other.deviceName, s: when(c.other.since), b: when(c.other.beat) })).replace(/\n/g, '<br>')}</div>`,
        buttons: [{ id: 'quit', label: t('gd.other.quit'), icon: 'power' }, { id: 'go', label: t('gd.other.continue'), cls: 'primary' }],
      });
      if (go === 'quit') { window.doramik.quit().catch(() => {}); return; }
    }
    const st = c.state;
    if (st === 'REMOTE_NEWER') {
      const empty = gd.st && gd.st.localEmpty;
      const ch = await choose({
        title: empty ? t('gd.new.title') : t('gd.newer.title'),
        body: `<div style="line-height:1.6">${esc(t(empty ? 'gd.new.body' : 'gd.newer.body', meta(c.remote)))}</div>`,
        buttons: [{ id: 'later', label: t('gd.later') }, { id: 'use', label: empty ? t('gd.new.use') : t('gd.newer.use'), cls: 'primary', icon: 'cloud-download' }],
      });
      if (ch === 'use' && await gd.restore(c.remote)) return;
      await G().begin({ paused: true });
    } else if (st === 'CONFLICT') {
      const ch = await choose({
        title: t('gd.conflict.title'), size: 'lg',
        body: `<div class="stack"><div style="line-height:1.6">${esc(t(first ? 'gd.conflictFirst.body' : 'gd.conflict.body', meta(c.remote)))}</div>
          <div class="notice info">${icon('cloud-download')}<div><b>${t('gd.conflict.useDrive')}</b><br>${t('gd.conflict.useDriveSub')}</div></div>
          <div class="notice warn">${icon('upload')}<div><b>${t('gd.conflict.keepLocal')}</b><br>${t('gd.conflict.keepLocalSub')}</div></div></div>`,
        buttons: [{ id: 'later', label: t('gd.later') }, { id: 'keep', label: t('gd.conflict.keepLocal'), icon: 'upload' }, { id: 'use', label: t('gd.conflict.useDrive'), cls: 'primary', icon: 'cloud-download' }],
      });
      if (ch === 'use') { if (await gd.restore(c.remote)) return; await G().begin({ paused: true }); }
      else if (ch === 'keep') {
        try { await G().begin(); await G().syncNow({ force: true }); App.toast(t('gd.keptLocal')); } catch (e) { App.toast(App.errorText(e), 'err'); }
      } else await G().begin({ paused: true });
    } else if (st === 'LOCAL_NEWER' || st === 'EMPTY_REMOTE_PUSH') {
      await G().begin();
      try { await G().syncNow(); if (st === 'EMPTY_REMOTE_PUSH') App.toast(t('gd.firstPush')); } catch (e) { if (e.code !== 'GDRIVE_CONFLICT') App.toast(App.errorText(e), 'err'); }
    } else {
      await G().begin();
    }
    await gd.refreshStatus();
    if (App.current && App.current.path === '/sauvegarde') App.render();
  };

  // ------------------------------------------------------------ connexion
  /** Fenêtre « Activer Google Drive » : demande l'adresse Gmail. Renvoie l'adresse saisie, '' si « Plus tard », null si annulé. */
  gd.askEmail = ({ first = false, email = '' } = {}) => new Promise((resolve) => {
    let result = null;
    App.modal({
      title: t('gd.email.title'), size: 'md', dismissable: false,
      body: `<div class="stack"><div style="line-height:1.6">${t('gd.email.intro')}</div>
        <div class="field"><label>${esc(t('gd.email.label'))}</label><input class="input ltr" type="email" data-email autocomplete="email" spellcheck="false" placeholder="nom@gmail.com" value="${esc(email)}"><div class="field-err small" data-err style="color:var(--danger,#b42318);min-height:1em"></div></div>
        <div class="notice info">${icon('info')}<div>${t('gd.email.hint')}</div></div></div>`,
      footer: `<button class="btn" data-later>${first ? t('gd.later') : t('btn.cancel')}</button><button class="btn primary" data-go>${icon('log-in')} ${t('gd.email.continue')}</button>`,
      onMount: (m) => {
        const inp = m.el.querySelector('[data-email]');
        const err = m.el.querySelector('[data-err]');
        const go = () => {
          const v = inp.value.trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { inp.classList.add('invalid'); err.textContent = t('gd.email.invalid'); inp.focus(); return; }
          result = v;
          m.close();
        };
        m.el.querySelector('[data-go]').addEventListener('click', go);
        m.el.querySelector('[data-later]').addEventListener('click', () => { result = first ? '' : null; m.close(); });
        inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } });
        inp.addEventListener('input', () => { inp.classList.remove('invalid'); err.textContent = ''; });
        setTimeout(() => inp.focus(), 50);
      },
      onClose: () => resolve(result),
    });
  });

  gd.connect = async (opts = {}) => {
    if (gd.connectBusy) return false; // un seul parcours de connexion à la fois (double clic, double affichage)
    gd.connectBusy = true;
    try {
      return await gd.connectFlow(opts);
    } finally {
      gd.connectBusy = false;
    }
  };

  /** Premier lancement : propose d'activer Google Drive en demandant l'adresse Gmail (une seule fois). */
  gd.firstRun = async () => {
    const st = gd.st || await G().status();
    if (!st.configured || st.connected || st.authLost || st.promptDismissed || st.promptEnabled === false) return;
    if (gd.connectBusy || document.querySelector('.modal-back')) return;
    const email = await gd.askEmail({ first: true, email: st.lastEmail || '' });
    if (email === null) return; // fermée sans choix : on redemandera au prochain démarrage
    if (email === '') { await G().dismissPrompt(true); await gd.refreshStatus(); return; }
    await gd.connect({ email, asked: true });
  };

  gd.connectFlow = async ({ email, asked } = {}) => {
    let st = await G().status();
    if (!st.configured) {
      if (!await gd.configure()) return false;
      st = await G().status();
    }
    if (!asked) {
      email = await gd.askEmail({ email: st.email || st.lastEmail || '' });
      if (!email) return false;
    }
    let waiting;
    const wait = App.modal({
      title: t('gd.wait.title'), size: 'sm', dismissable: false,
      body: `<div class="stack"><div class="row"><span class="gd-spin">${icon('refresh-cw')}</span><div style="line-height:1.6">${t('gd.wait.body')}</div></div>
        <div class="notice warn">${icon('triangle-alert')}<div>${t('gd.wait.hint')}</div></div></div>`,
      footer: `<button class="btn" data-cancel>${t('btn.cancel')}</button>`,
      onMount: (m) => m.el.querySelector('[data-cancel]').addEventListener('click', () => { G().cancel().catch(() => {}); }),
      onClose: () => { if (waiting) G().cancel().catch(() => {}); },
    });
    waiting = true;
    try {
      const r = await G().connect(email);
      waiting = false;
      wait.close();
      gd.st = r.status;
      gd.drawPill();
      App.toast(t('gd.connected', { e: r.status.email }));
      if (email && r.status.email && email.toLowerCase() !== r.status.email.toLowerCase()) App.toast(t('gd.email.mismatch', { a: r.status.email, e: email }), 'warn', 9000);
      try { await G().dismissPrompt(true); } catch (_) { /* ignore */ }
      await gd.handleCheck(r.check, { first: true });
      return true;
    } catch (e) {
      waiting = false;
      wait.close();
      if (e.code !== 'GDRIVE_CANCELLED') App.toast(App.errorText(e), 'err');
      await gd.refreshStatus();
      return false;
    }
  };

  // ------------------------------------------------------------ démarrage et événements
  gd.onEvent = async (ev) => {
    if (ev.type === 'resume') { await gd.init(); return; } // version téléphone : retour dans l'application
    await gd.refreshStatus();
    if (ev.type === 'conflict' && !gd.handlingConflict) {
      gd.handlingConflict = true;
      try {
        const r = await G().check();
        gd.st = r.status;
        if (r.check.state === 'REMOTE_NEWER' || r.check.state === 'CONFLICT') await gd.handleCheck(Object.assign({}, r.check, { state: 'CONFLICT', other: null }));
      } catch (e) { /* hors connexion */ } finally { gd.handlingConflict = false; }
    } else if (ev.type === 'other') {
      App.toast(t('gd.event.other', { p: ev.other.deviceName }), 'warn', 9000);
    }
    if (App.current && App.current.path === '/sauvegarde' && !document.querySelector('.modal-back') && ev.type === 'status') App.render();
  };

  gd.init = async () => {
    G().onEvent((ev) => gd.onEvent(ev));
    await gd.refreshStatus();
    try {
      const r = await G().startup();
      gd.st = r.status;
      gd.drawPill();
      if (r.connectError) App.toast(App.errorText({ code: r.connectError, params: {} }), 'err', 9000); // version téléphone : retour de la page Google
      if (r.mode === 'AUTH_LOST') { App.toast(t('gd.authLost'), 'warn', 9000); return; }
      if (r.mode === 'ONLINE') await gd.handleCheck(r.check);
      if (r.mode === 'OFF') await gd.firstRun();
    } catch (e) { /* la synchronisation ne doit jamais empêcher le démarrage */ }
  };

  const pill = document.addEventListener('click', (e) => {
    if (e.target.closest('#gdpill')) App.go('#/sauvegarde');
  });
  void pill;
})();
