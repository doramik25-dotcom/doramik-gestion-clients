/* DORAMIK GESTION CLIENTS — Sauvegarde et restauration */
(function () {
  'use strict';
  const { esc, t, icon } = App;
  const B = () => window.doramik.backup;

  const sizeText = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko');

  const gdCard = (g, remote, remoteErr) => {
    const ps = App.gd.pillState(g);
    const stKey = ps ? ps[0] : 'ok';
    const tone = ps ? ps[2] : 'gray';
    const head = `<div class="card-h"><h3>${icon('cloud')} ${t('gd.title')}</h3><span class="spacer"></span>${g.connected ? `<span class="badge b-${tone}">${esc(t('gd.st.' + stKey))}</span>` : ''}</div>`;
    let body;
    if (!g.configured) {
      body = `<div class="notice info">${icon('info')}<div>${t('gd.intro')}<br><br>${t('gd.notConfigured')}</div></div>
        <div class="row"><button class="btn primary" data-a="gdconfig">${icon('settings')} ${t('gd.configure')}</button></div>`;
    } else if (!g.connected) {
      body = `<div class="notice info">${icon('info')}<div>${t('gd.intro')}<br><br>${t('gd.oneAtATime')}</div></div>
        ${g.authLost ? `<div class="notice warn">${icon('triangle-alert')}<div>${t('gd.authLost')}${g.email ? ' (' + esc(g.email) + ')' : ''}</div></div>` : ''}
        <div class="row"><button class="btn primary" data-a="gdconnect">${icon('log-in')} ${t('gd.connect')}</button>
          ${g.configSource === 'user' ? `<button class="btn" data-a="gdconfig">${icon('settings')} ${t('gd.editConfig')}</button>` : ''}</div>`;
    } else {
      const err = g.lastError && g.lastError.code !== 'GDRIVE_OFFLINE' ? App.errorText({ code: g.lastError.code, params: {} }) : '';
      body = `<div class="kv-list">
          <div><div class="k">${t('gd.account')}</div><div class="v ltr">${esc(g.email)}</div></div>
          <div><div class="k">${t('gd.device')}</div><div class="v ltr">${esc(g.deviceName)}</div></div>
          <div><div class="k">${t('gd.lastSync')}</div><div class="v">${g.lastSyncAt ? `<span class="ltr">${App.dateTime(g.lastSyncAt)}</span>` : t('gd.never')}</div></div>
          <div><div class="k">${t('gd.version')}</div><div class="v">${g.localRev || '—'}</div></div>
        </div>
        ${g.conflict || g.paused ? `<div class="notice warn">${icon('triangle-alert')}<div class="grow">${t('gd.pausedInfo')}</div><button class="btn sm primary" data-a="gdresolve">${t('gd.resolve')}</button></div>` : ''}
        ${err ? `<div class="notice err">${icon('circle-alert')}<div>${esc(err)}</div></div>` : ''}
        ${g.lastError && g.lastError.code === 'GDRIVE_OFFLINE' ? `<div class="notice info">${icon('cloud-off')}<div>${t('err.GDRIVE_OFFLINE')}</div></div>` : ''}
        <div class="row"><button class="btn primary" data-a="gdsync" ${g.busy ? 'disabled' : ''}>${icon('cloud-upload')} ${t('gd.syncNow')}</button>
          <button class="btn" data-a="gdrefresh">${icon('refresh-cw')} ${t('gd.refresh')}</button>
          ${g.configSource === 'user' ? `<button class="btn" data-a="gdconfig">${icon('settings')} ${t('gd.editConfig')}</button>` : ''}
          <span class="spacer"></span><button class="btn ghost" data-a="gddisconnect">${icon('log-out')} ${t('gd.disconnect')}</button></div>
        <div class="gd-box" style="border-top:1px solid var(--border);padding-top:14px">
          <label class="check"><input type="checkbox" name="gd_auto" ${g.autoSync ? 'checked' : ''}> ${t('gd.auto')}</label><div class="small muted" style="margin-top:-8px">${t('gd.autoHint')}</div>
          <div class="form-grid">
            ${App.field(t('gd.keep'), `<input class="input" type="number" min="2" max="500" name="gd_keep" value="${esc(g.keep || 100)}">`, { hint: t('gd.keepHint') })}
            ${App.field(t('gd.password'), `<input class="input" type="password" name="gd_pw" autocomplete="off" placeholder="${g.encrypt ? '••••••••' : ''}">`, { hint: t('gd.encryptHint') })}
          </div>
          <label class="check"><input type="checkbox" name="gd_enc" ${g.encrypt ? 'checked' : ''}> ${t('gd.encrypt')}</label>
          <div><button class="btn primary sm" data-a="gdsaveopts">${icon('save')} ${t('btn.save')}</button></div>
        </div>
        <div><div class="k small muted strong" style="margin-bottom:6px">${t('gd.versions')}</div>
          ${remoteErr ? `<div class="notice err">${icon('circle-alert')}<div>${esc(App.errorText(remoteErr))}</div></div>` : '<div data-gd-t></div>'}</div>`;
    }
    return `<div class="card" style="margin-bottom:18px" data-gd-card>${head}<div class="card-b stack">${body}</div></div>`;
  };

  App.views.backup = async (root) => {
    const drawRemote = (remote) => {
      const host = root.querySelector('[data-gd-t]');
      if (!host) return;
      new App.Table(host, {
        rows: remote,
        columns: [
          { key: 'createdTime', label: t('col.date'), render: (r) => `<span class="ltr">${App.dateTime(r.createdTime)}</span>` },
          { key: 'rev', label: t('gd.version'), type: 'number', render: (r) => `<span class="ltr">${r.rev}</span>` },
          { key: 'deviceName', label: t('gd.col.device'), render: (r) => `<span class="ltr small">${esc(r.deviceName || '—')}</span>` },
          { key: 'encrypted', label: t('gd.col.enc'), render: (r) => (r.encrypted ? `<span class="badge b-blue">${icon('lock')} ${t('gd.col.enc')}</span>` : '') },
          { key: 'size', label: t('docs.size'), type: 'number', render: (r) => `<span class="ltr">${sizeText(r.size)}</span>` },
          { key: '', actions: true, render: () => `<button class="btn sm" data-act="restore">${icon('cloud-download')} ${t('gd.restoreThis')}</button>` },
        ],
        empty: t('gd.noVersions'),
        onAction: async (act, r) => {
          if (act !== 'restore') return;
          if (!await App.confirm(t('gd.restoreConfirm', { r: r.rev, d: App.dateTime(r.createdTime), p: r.deviceName || '?' }), { danger: true, okLabel: t('backup.restore') })) return;
          await App.gd.restore(r);
        },
      });
    };

    const draw = async () => {
      const [info, list] = await Promise.all([window.doramik.info(), B().list().catch(() => [])]);
      await App.refreshLookups();
      const g = await window.doramik.gdrive.status().catch(() => null);
      if (App.gd && g) { App.gd.st = g; App.gd.drawPill(); }
      let remote = [];
      let remoteErr = null;
      if (g && g.connected) { try { remote = await window.doramik.gdrive.list(); } catch (e) { remoteErr = e; } }
      const s = App.state.settings;
      root.innerHTML = `<div class="page-head"><div><h1>${t('nav.backup')}</h1><div class="sub">${t('backup.subtitle')}</div></div>
        <div class="actions"><button class="btn" data-a="restore">${icon('rotate-ccw')} ${t('backup.restore')}</button><button class="btn primary" data-a="now">${icon('save')} ${t('backup.now')}</button></div></div>
        <div class="grid-2e" style="margin-bottom:18px">
          <div class="card"><div class="card-h"><h3>${icon('database-backup')} ${t('backup.status')}</h3></div><div class="card-b stack">
            <div class="kv-list">
              <div><div class="k">${t('backup.last')}</div><div class="v">${s.last_backup_at ? `<span class="ltr">${App.dateTime(s.last_backup_at)}</span>` : `<span style="color:var(--red)">${t('backup.never')}</span>`}</div></div>
              <div><div class="k">${t('backup.count')}</div><div class="v">${list.length}</div></div>
            </div>
            <div><div class="k small muted strong">${t('backup.folder')}</div><div class="ltr small" style="word-break:break-all;margin:4px 0 8px">${esc(info.backupDir)}</div>
              <div class="row"><button class="btn sm" data-a="dir">${icon('folder')} ${t('backup.chooseDir')}</button><button class="btn sm" data-a="opendir">${icon('folder-open')} ${t('backup.openDir')}</button>
              ${s.backup_dir ? `<button class="btn sm ghost" data-a="resetdir">${t('backup.defaultDir')}</button>` : ''}</div></div>
          </div></div>
          <div class="card"><div class="card-h"><h3>${icon('clock')} ${t('backup.auto')}</h3></div><div class="card-b stack">
            <div class="form-grid">
              ${App.field(t('backup.frequency'), `<select class="input" name="auto_backup">${['daily', 'startup', 'weekly', 'off'].map((k) => `<option value="${k}" ${s.auto_backup === k ? 'selected' : ''}>${esc(t('backup.freq.' + k))}</option>`).join('')}</select>`, { hint: t('backup.autoHint') })}
              ${App.field(t('backup.keep'), `<input class="input" type="number" min="1" max="500" name="backup_keep" value="${esc(s.backup_keep || 30)}">`, { hint: t('backup.keepHint') })}
            </div>
            <div><button class="btn primary sm" data-a="saveauto">${icon('save')} ${t('btn.save')}</button></div>
            <div class="notice info">${icon('info')}<div>${t('backup.dataInfo')}<div class="ltr small" style="word-break:break-all;margin-top:4px">${esc(info.dataDir)}</div></div></div>
          </div></div>
        </div>
        ${g ? gdCard(g, remote, remoteErr) : ''}
        <div class="card"><div class="card-h"><h3>${t('backup.list')}</h3></div><div data-t></div></div>`;
      if (g && g.connected) drawRemote(remote);
      new App.Table(root.querySelector('[data-t]'), {
        rows: list,
        columns: [
          { key: 'mtime', label: t('col.date'), render: (b) => `<span class="ltr">${App.dateTime(b.mtime)}</span>` },
          { key: 'name', label: t('backup.file'), render: (b) => `<span class="ltr small">${esc(b.name)}</span>` },
          { key: 'kind', label: t('backup.type'), sortValue: (b) => b.name, render: (b) => (b.name.includes('_auto_') ? `<span class="badge b-blue">${t('backup.kindAuto')}</span>` : b.name.includes('avant-restauration') ? `<span class="badge b-orange">${t('backup.kindSafety')}</span>` : `<span class="badge b-green">${t('backup.kindManual')}</span>`) },
          { key: 'size', label: t('docs.size'), type: 'number', render: (b) => `<span class="ltr">${(b.size / 1024).toFixed(0)} Ko</span>` },
          { key: '', actions: true, render: () => `<button class="btn sm" data-act="restore">${icon('rotate-ccw')} ${t('backup.restoreThis')}</button>` },
        ],
        empty: t('backup.none'),
        onAction: (act, b) => { if (act === 'restore') confirmRestore({ path: b.path, name: b.name }); },
      });
    };

    const confirmRestore = async (file) => {
      let inspect = file;
      if (!file.manifest) {
        // inspection via le sélecteur n'est pas nécessaire pour une sauvegarde de la liste
        inspect = Object.assign({ valid: true, manifest: {} }, file);
      }
      if (!inspect.valid) return App.toast(t('backup.invalid'), 'err');
      const when = inspect.manifest && inspect.manifest.created_at ? App.dateTime(inspect.manifest.created_at) : (file.name || '');
      const ok = await App.confirm(t('backup.restoreConfirm', { d: when }), { danger: true, okLabel: t('backup.restore') });
      if (!ok) return;
      try {
        const r = await B().restore(inspect.path);
        App.toast(t('backup.restored'));
        if (r && r.safety) App.toast(t('backup.safetyDone'), 'ok', 6000);
        setTimeout(() => window.doramik.reload(), 900);
      } catch (e) {
        App.toast(e.code === 'INVALID_BACKUP' || /INVALID_BACKUP/.test(e.message) ? t('backup.invalid') : App.errorText(e), 'err');
      }
    };

    root.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      try {
        switch (a.dataset.a) {
          case 'now': { const f = await B().create(); App.toast(t('backup.done', { f })); draw(); break; }
          case 'dir': { const d = await B().chooseDir(); if (d) { App.toast(t('msg.saved')); draw(); } break; }
          case 'resetdir': await App.api('settings.set', { backup_dir: '' }); draw(); break;
          case 'opendir': await B().openDir(); break;
          case 'saveauto': {
            await App.api('settings.set', { auto_backup: root.querySelector('[name=auto_backup]').value, backup_keep: Math.max(1, parseInt(root.querySelector('[name=backup_keep]').value, 10) || 30) });
            App.toast(t('msg.saved'));
            break;
          }
          case 'gdconfig': await App.gd.configure(); draw(); break;
          case 'gdconnect': await App.gd.connect(); draw(); break;
          case 'gddisconnect': {
            if (!await App.confirm(t('gd.disconnectConfirm'), { okLabel: t('gd.disconnect') })) break;
            await window.doramik.gdrive.disconnect();
            await App.gd.refreshStatus();
            draw();
            break;
          }
          case 'gdsync': {
            a.disabled = true;
            try {
              const r = await window.doramik.gdrive.syncNow();
              App.toast(t('gd.synced', { r: r.result.rev }));
            } catch (err) {
              if (err.code === 'GDRIVE_CONFLICT') { await App.gd.onEvent({ type: 'conflict' }); } else App.toast(App.errorText(err), 'err');
            }
            await App.gd.refreshStatus();
            draw();
            break;
          }
          case 'gdrefresh': await App.gd.refreshStatus(); draw(); break;
          case 'gdresolve': {
            const r = await window.doramik.gdrive.check();
            await App.gd.handleCheck(Object.assign({}, r.check, { other: null, state: r.check.state === 'REMOTE_NEWER' || r.check.state === 'CONFLICT' ? r.check.state : 'UP_TO_DATE' }));
            draw();
            break;
          }
          case 'gdsaveopts': {
            const q = (n) => root.querySelector('[name=' + n + ']');
            try {
              await window.doramik.gdrive.options({ autoSync: q('gd_auto').checked, keep: q('gd_keep').value, encrypt: q('gd_enc').checked, password: q('gd_pw').value || undefined });
              App.toast(t('msg.saved'));
            } catch (err) { App.toast(App.errorText(err), 'err'); break; } // les valeurs saisies sont conservées pour correction
            await App.gd.refreshStatus();
            draw();
            break;
          }
          case 'restore': {
            const f = await B().pick();
            if (f) confirmRestore(f);
            break;
          }
          default:
        }
      } catch (err) { App.toast(App.errorText(err), 'err'); }
    });
    await draw();
  };
})();
