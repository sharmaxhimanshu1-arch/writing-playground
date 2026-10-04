/*
 * The Drafts panel: the list, opening and deleting, version history, import, export, backup and restore.
 */
(function (WP) {
  'use strict';

  const A = WP.app;
  const {
    $, STORAGE_TOTAL, T, dayKey, doc, editor, esc, genre, genreById, newDoc, openModal, persist,
    prefs, relTime, savePrefs, state, storageUsed, toast
  } = A;

  /* ---------- import ---------- */

  function importFile(file) {
    if (!file) return;
    if (file.size > 1024 * 1024) return toast('That file is over 1 MB. Paste the part you want to work on instead.');
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '').replace(/\r\n?/g, '\n');
      const d = newDoc(genre().id, { title: file.name.replace(/\.(txt|md|markdown)$/i, ''), text });
      persist(true);
      openDoc(d.id);
      toast(`Opened “${file.name}” as a new draft.`);
    };
    reader.onerror = () => toast('That file could not be read. Try a plain .txt or .md file.');
    reader.readAsText(file);
  }

  /* ---------- version history ---------- */

  const VERSION_GAP = 10 * 60 * 1000;
  const MAX_VERSIONS = 30;

  function pushVersion(d, label) {
    d.versions = d.versions || [];
    const last = d.versions[d.versions.length - 1];
    if (last && last.text === d.text) return false;
    const ctx = T.parse(d.text, { framework: d.framework, genre: d.genre });
    ctx.frameworkDef = genreById(d.genre).frameworks.find((f) => f.id === d.framework) || null;
    const score = d.id === state.currentId ? state.score : WP.checks.run(genreById(d.genre).checks, ctx).score;
    d.versions.push({ at: Date.now(), text: d.text, words: ctx.wordCount, score, label: label || '' });
    if (d.versions.length > MAX_VERSIONS) d.versions.splice(0, d.versions.length - MAX_VERSIONS);
    persist();
    return true;
  }

  function autoVersion(d, score, words) {
    if (words < 20) return;
    const vs = d.versions || [];
    const last = vs[vs.length - 1];
    if (!last) {
      d.versions = [{ at: Date.now(), text: d.text, words, score, label: 'First saved' }];
      persist();
    } else if (Date.now() - last.at > VERSION_GAP && last.text !== d.text) {
      pushVersion(d, 'Auto-saved');
    }
  }

  function renderHistory(d) {
    const vs = (d.versions || []).slice().reverse();
    const points = (d.versions || []).map((v) => v.score).filter((x) => x != null).concat(state.score != null ? [state.score] : []);
    let spark = '';
    // A flat line between two equal scores says nothing, so wait for a change.
    if (points.length >= 3 || (points.length === 2 && points[0] !== points[1])) {
      const W = 260;
      const H = 48;
      const x = (i) => (i / (points.length - 1)) * (W - 8) + 4;
      const y = (v) => H - 4 - (v / 100) * (H - 8);
      const pts = points.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      const lastI = points.length - 1;
      spark = `<svg class="score-spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Score across versions, from ${points[0]} to ${points[lastI]}">
        <line class="grid" x1="0" x2="${W}" y1="${y(50)}" y2="${y(50)}"></line>
        <polyline points="${pts}"></polyline>
        ${points.map((v, i) => `<circle class="${i === lastI ? 'end' : 'pt'}" cx="${x(i)}" cy="${y(v)}" r="${i === lastI ? 4.5 : 2.5}"></circle><rect class="bar-hit" x="${x(i) - 8}" y="0" width="16" height="${H}" data-tip="${i === lastI ? 'Now' : 'Version ' + (i + 1)}: score ${v}"></rect>`).join('')}
      </svg>
      <p class="small muted">Score ${points[0]} → <b>${points[lastI]}</b> across ${points.length - 1} saved ${points.length - 1 === 1 ? 'version' : 'versions'}.</p>`;
    }
    return `<section class="section">
        <p class="eyebrow">History of this draft</p>
        ${spark}
        <div class="btn-row"><button class="btn" type="button" data-act="save-version">Save a version now</button>${(d.versions || []).length ? '<button class="btn" type="button" data-act="improved">What improved?</button>' : ''}</div>
        ${vs.length ? `<ul class="version-list">${vs.map((v) => {
          const i = d.versions.indexOf(v);
          return `<li class="version">
            <span class="version-meta"><b>${esc(new Date(v.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</b>
            <span>${v.words} words${v.score != null ? ` · score ${v.score}` : ''}${v.label ? ` · ${esc(v.label)}` : ''}</span></span>
            <span class="btn-row"><button class="btn btn-small" type="button" data-compare="${i}">Compare</button><button class="btn btn-small" type="button" data-restore="${i}">Restore</button></span>
          </li>`;
        }).join('')}</ul>` : '<p class="small muted">Versions are saved automatically every 10 minutes while you write. Save one yourself before a big rewrite.</p>'}
      </section>`;
  }

  function compareVersion(i) {
    const d = doc();
    const v = d.versions[i];
    const r = WP.diff(v.text, d.text, esc);
    openModal(`Changes since ${new Date(v.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`, `
      <p class="small muted"><ins>${r.added} words added</ins> · <del>${r.removed} removed</del> · score ${v.score != null ? v.score : '–'} → ${state.score != null ? state.score : '–'}</p>
      <pre class="diff">${r.html || '<span class="muted">No changes.</span>'}</pre>`);
  }

  function restoreVersion(i) {
    const d = doc();
    const v = d.versions[i];
    pushVersion(d, 'Before restoring');
    const ta = $('editor');
    ta.focus();
    ta.setSelectionRange(0, ta.value.length);
    editor.insert(v.text);
    ta.setSelectionRange(0, 0);
    A.analyze();
    renderDrafts();
    toast('Version restored. Your previous text was saved in History, and Ctrl+Z (⌘Z) undoes this.');
  }

  function renderDrafts() {
    const q = (state.draftQuery || '').trim().toLowerCase();
    const matches = (d) => !q || (d.title || '').toLowerCase().includes(q) || d.text.toLowerCase().includes(q) || genreById(d.genre).name.toLowerCase().includes(q);
    const items = state.docs.slice().sort((a, b) => b.updated - a.updated).filter(matches).map((d) => {
      const words = T.parse(d.text).wordCount;
      const confirming = state.confirmDelete === d.id;
      return `<li class="draft-item ${d.id === state.currentId ? 'current' : ''}">
        <button class="draft-open" type="button" data-open="${d.id}">
          <span class="draft-title">${esc(d.title || 'Untitled draft')}</span>
          <span class="draft-meta">${esc(genreById(d.genre).name)} · ${words} words · ${relTime(d.updated)}</span>
        </button>
        ${confirming
          ? `<span class="btn-row"><button class="btn btn-danger" type="button" data-delete="${d.id}">Delete</button><button class="btn btn-quiet" type="button" data-cancel-delete>Keep</button></span>`
          : `<button class="btn btn-quiet" type="button" data-ask-delete="${d.id}" aria-label="Delete ${esc(d.title || 'Untitled draft')}">✕</button>`}
      </li>`;
    }).join('');
    const canDownload = !!state.downloads || !WP.ARTIFACT;
    $('pane-drafts').innerHTML = `
      <section class="section">
        <div class="btn-row">
          <button class="btn btn-primary" type="button" data-act="new-draft">New ${esc(genre().name)} draft</button>
          <label class="btn" for="importFile">Open a file</label>
          <input type="file" id="importFile" accept=".txt,.md,.markdown,text/plain,text/markdown" hidden>
        </div>
        ${state.docs.length > 5 ? `<label class="sr-only" for="draftSearch">Search drafts</label><input class="search" id="draftSearch" type="search" placeholder="Search ${state.docs.length} drafts" value="${esc(state.draftQuery || '')}" autocomplete="off">` : ''}
        <ul class="draft-list">${items || '<li class="small muted">No drafts match.</li>'}</ul>
      </section>
      ${renderHistory(doc())}
      <section class="section">
        <p class="eyebrow">This draft</p>
        <label class="field" for="checkAsSelect">Check it as
          <select id="checkAsSelect" title="Which genre’s rules check this draft">${WP.genres.map((x) => `<option value="${x.id}" ${x.id === genre().id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        </label>
        <div class="btn-row">
          <button class="btn" type="button" data-act="copy">Copy text</button>
          <button class="btn" type="button" data-act="duplicate">Make a copy</button>
          ${canDownload ? '<button class="btn" type="button" data-act="download" data-ext="txt">Download .txt</button><button class="btn" type="button" data-act="download" data-ext="md">Download .md</button>' : ''}
        </div>
      </section>
      ${renderStorage(canDownload)}`;
  }

  function renderStorage(canDownload) {
    const used = storageUsed();
    const pct = used == null ? 0 : Math.min(100, (used / STORAGE_TOTAL) * 100);
    const mb = (n) => (n / 1e6).toFixed(1);
    return `<section class="section">
        <p class="eyebrow">Keep your work safe</p>
        <p class="small muted">Drafts live only in this browser. Clearing browser data, a private window or a different device means they’re not there. Download a backup now and then.</p>
        ${used == null || pct < 25 ? '' : `<div class="storage"><span class="goal-track storage-track"><span class="goal-fill ${pct > 70 ? 'warn' : ''}" style="width:${pct.toFixed(1)}%"></span></span><span class="small muted">${mb(used)} MB of about ${mb(STORAGE_TOTAL)} MB used</span></div>`}
        <div class="btn-row">
          ${canDownload ? '<button class="btn" type="button" data-act="backup">Download a backup</button>' : ''}
          <label class="btn" for="restoreFile">Restore a backup</label>
          <input type="file" id="restoreFile" accept=".json,application/json" hidden>
        </div>
      </section>`;
  }

  function backupData() {
    const keep = ['days', 'drillsDone', 'challenges', 'pieces', 'warmups', 'learned', 'muted'];
    const p = {};
    keep.forEach((k) => (p[k] = prefs[k]));
    return JSON.stringify({ app: 'writing-playground', format: 1, exported: new Date().toISOString(), docs: state.docs, progress: p }, null, 1);
  }

  function downloadBackup() {
    const name = `writing-playground-backup-${dayKey()}.json`;
    saveFile(name, backupData(), 'application/json', 'Backup saved. Keep it somewhere safe, like your cloud drive.');
  }

  function restoreBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try {
        data = JSON.parse(String(reader.result));
      } catch (e) {
        return toast('That file isn’t a Writing Playground backup.');
      }
      if (!data || data.app !== 'writing-playground' || !Array.isArray(data.docs)) return toast('That file isn’t a Writing Playground backup.');
      let added = 0;
      let updated = 0;
      for (const d of data.docs) {
        if (!d || typeof d.id !== 'string' || typeof d.text !== 'string') continue;
        if (!WP.genres.some((g) => g.id === d.genre)) d.genre = WP.genres[0].id;
        const mine = state.docs.find((x) => x.id === d.id);
        if (!mine) {
          state.docs.push(d);
          added++;
        } else if ((d.updated || 0) > (mine.updated || 0)) {
          Object.assign(mine, d);
          updated++;
        }
      }
      const p = data.progress || {};
      for (const k of ['drillsDone']) if (Array.isArray(p[k])) prefs[k] = [...new Set(prefs[k].concat(p[k]))];
      for (const k of ['challenges', 'pieces', 'warmups', 'learned', 'muted']) if (p[k] && typeof p[k] === 'object') prefs[k] = Object.assign({}, p[k], prefs[k]);
      if (p.days && typeof p.days === 'object') for (const [k, v] of Object.entries(p.days)) prefs.days[k] = Math.max(prefs.days[k] || 0, Number(v) || 0);
      savePrefs();
      persist(true);
      A.renderAll();
      renderDrafts();
      toast(`Backup restored: ${added} new ${added === 1 ? 'draft' : 'drafts'}, ${updated} updated. Nothing was deleted.`);
    };
    reader.readAsText(file);
  }

  function duplicateDoc() {
    const d = doc();
    const copy = newDoc(d.genre, { title: `${d.title || 'Untitled draft'} (copy)`, framework: d.framework, text: d.text });
    persist(true);
    openDoc(copy.id);
    toast('Copy made. Experiment freely; the original is unchanged.');
  }

  function openDoc(id) {
    state.currentId = id;
    state.spotlight = null;
    state.expanded.clear();
    state.openFramework = null;
    state.confirmDelete = null;
    const d = doc();
    editor.value = d.text;
    $('docTitle').value = d.title;
    A.hideFixCard();
    A.stopSpeaking();
    if (WP.coach) WP.coach.reset();
    A.renderAll();
    prefs.lastDoc = id;
    savePrefs();
  }

  function deleteDoc(id) {
    const genreId = genre().id;
    state.docs = state.docs.filter((d) => d.id !== id);
    state.confirmDelete = null;
    if (!state.docs.length) newDoc(genreId);
    if (id === state.currentId || !doc()) openDoc(state.docs[0].id);
    else renderDrafts();
    persist(true);
    toast('Draft deleted.');
  }

  function copyText() {
    const text = doc().text;
    const fallback = () => {
      const ta = $('editor');
      ta.focus();
      ta.select();
      toast('Text selected. Press Ctrl+C (or ⌘C) to copy.');
    };
    try {
      navigator.clipboard.writeText(text).then(() => toast('Draft copied.'), fallback);
    } catch (e) {
      fallback();
    }
  }

  function saveFile(name, body, type, okMsg) {
    if (state.downloads) {
      state.downloads.save({ filename: name, data: body }).then(
        () => toast(okMsg || 'File saved.'),
        (e) => {
          if (e && e.code !== 'declined') toast('This page can’t save files here. Use Copy text instead.');
        }
      );
      return;
    }
    const blob = new Blob([body], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
    if (okMsg) toast(okMsg);
  }

  function downloadText(ext) {
    const d = doc();
    const name = ((d.title || 'draft').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'draft') + '.' + ext;
    const body = ext === 'md' ? `# ${d.title || 'Untitled draft'}\n\n${d.text}\n` : d.text;
    saveFile(name, body, ext === 'md' ? 'text/markdown' : 'text/plain');
  }

  Object.assign(A, {
    importFile, VERSION_GAP, MAX_VERSIONS, pushVersion, autoVersion, renderHistory, compareVersion,
    restoreVersion, renderDrafts, renderStorage, backupData, downloadBackup, restoreBackup,
    duplicateDoc, openDoc, deleteDoc, copyText, saveFile, downloadText
  });
})(window.WP = window.WP || {});
