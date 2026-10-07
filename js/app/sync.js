/*
 * Sync: keeps drafts and progress the same on every device, through the reader's own Claude account.
 * Only on the copy hosted on claude.ai, where the page can keep data in a private space that belongs
 * to whoever is signed in (nobody else can read it, the page's owner included). Off until the writer
 * turns it on, once per device, from the Drafts tab.
 *
 * Each draft is one document; the newest change wins. A deleted draft leaves a small marker so other
 * devices delete it too instead of sending it back.
 */
(function (WP) {
  'use strict';

  const A = WP.app;
  const { $, doc, editor, esc, isUntouchedSample, load, persist, prefs, relTime, save, savePrefs, state, toast } = A;

  const STORE_SYNC = 'wp.sync.v1';
  const MAX_BYTES = 240000; // a stored document holds 256 KiB; keep room for the wrapper
  const PAUSE = 2000; // wait this long after the last change before sending it
  const MAX_WAIT = 15000; // but never longer than this while someone keeps typing

  const S = {
    db: null,
    uid: null,
    on: false,
    ready: false, // the first look at what is stored has been merged in
    busy: false,
    again: false,
    timer: null,
    firstAsk: 0,
    status: 'off', // off | connecting | synced | syncing | paused | error
    message: '',
    unsubs: [],
    meta: Object.assign({ docs: {}, tomb: {}, sent: {}, progress: null, at: 0 }, load(STORE_SYNC, {})),
  };
  state.sync = S;

  /* A short fingerprint, so unchanged drafts are never sent twice. */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36) + ':' + str.length;
  }

  /** The draft as it is stored: oldest automatic versions dropped if it would not fit. */
  function bodyOf(d) {
    const copy = JSON.parse(JSON.stringify(d));
    let json = JSON.stringify(copy);
    while (json.length > MAX_BYTES && copy.versions && copy.versions.length) {
      copy.versions.shift();
      json = JSON.stringify(copy);
    }
    return json.length > MAX_BYTES ? null : copy;
  }

  const sigOf = (d) => hash(JSON.stringify(d));
  const saveMeta = () => save(STORE_SYNC, S.meta);
  const syncable = (d) => !isUntouchedSample(d);

  function drafts() {
    return S.db.doc(`data/users/${S.uid}/library`).collection('drafts');
  }

  function progressRef() {
    return S.db.doc(`data/users/${S.uid}/progress`);
  }

  function setStatus(status, message) {
    S.status = status;
    S.message = message || '';
    const el = $('saveState');
    if (el && S.on) {
      el.textContent = status === 'synced' ? 'Saved and synced'
        : status === 'syncing' || status === 'connecting' ? 'Saved in this browser · syncing…'
          : 'Saved in this browser · sync paused';
    }
    if (prefs.leftTab === 'drafts' && $('pane-drafts')) {
      const box = $('syncStatus');
      if (box) box.textContent = statusText();
    }
  }

  function statusText() {
    if (S.status === 'synced') return `Up to date${S.meta.at ? ` · last synced ${relTime(S.meta.at)}` : ''}.`;
    if (S.status === 'syncing' || S.status === 'connecting') return 'Syncing…';
    if (S.status === 'paused' || S.status === 'error') return S.message || 'Sync is paused. Your drafts are still saved in this browser.';
    return '';
  }

  /* ---------- receiving ---------- */

  /** Brings one stored draft into this device, unless the copy here is newer. Returns true if anything changed. */
  function applyRemote(id, body) {
    if (!body || typeof body !== 'object') return false;
    const ru = Number(body.updated) || 0;
    const local = state.docs.find((d) => d.id === id);
    const known = S.meta.docs[id];
    const dirty = local && known && sigOf(local) !== known.h;
    if (body.deleted) {
      S.meta.tomb[id] = Math.max(S.meta.tomb[id] || 0, ru);
      S.meta.sent[id] = true;
      if (!local || (local.updated || 0) > ru) return false; // edited here after it was deleted there: keep it
      state.docs = state.docs.filter((d) => d.id !== id);
      delete S.meta.docs[id];
      if (state.currentId === id) {
        if (!state.docs.length) A.newDoc(A.genre().id);
        A.openDoc(state.docs[0].id);
        toast('This draft was deleted on another device.');
      }
      return true;
    }
    if (!body.doc || typeof body.doc.text !== 'string' || body.doc.id !== id) return false;
    const rd = JSON.parse(JSON.stringify(body.doc)); // stored data arrives frozen; the app edits drafts in place
    if (!WP.genres.some((g) => g.id === rd.genre)) rd.genre = WP.genres[0].id;
    if ((S.meta.tomb[id] || 0) >= ru) return false; // deleted here after that change
    const rsig = sigOf(rd);
    if (local && sigOf(local) === rsig) {
      S.meta.docs[id] = { h: rsig, u: local.updated || 0 };
      return false;
    }
    if (local && (dirty || (local.updated || 0) >= ru)) return false; // this device's change is newer; it goes out next
    if (!local) {
      state.docs.push(rd);
    } else {
      Object.keys(local).forEach((k) => delete local[k]);
      Object.assign(local, rd);
      if (state.currentId === id) refreshOpenDoc(local);
    }
    S.meta.docs[id] = { h: rsig, u: ru };
    return true;
  }

  /** The open draft changed on another device and has no unsent edits here: show the new text, keeping the caret near where it was. */
  function refreshOpenDoc(d) {
    const ta = $('editor');
    const pos = Math.min(ta.selectionStart, d.text.length);
    editor.value = d.text;
    $('docTitle').value = d.title || '';
    if (document.activeElement === ta) ta.setSelectionRange(pos, pos);
    A.renderAll();
    toast('Updated with changes from another device.');
  }

  function onDrafts(snap) {
    let changed = false;
    // Nothing is sent until the store has given a definitive answer, so a stale cache can't overwrite newer work.
    const firstLook = !S.ready && !snap.metadata.fromCache;
    const before = state.docs.length;
    for (const c of snap.docChanges()) {
      if (c.type === 'removed') continue;
      if (applyRemote(c.doc.id, c.doc.data())) changed = true;
    }
    if (firstLook) {
      S.ready = true;
      // A brand-new device opens on its starter sample: show the latest synced draft instead.
      const cur = doc();
      if (state.docs.length > before && cur && isUntouchedSample(cur)) {
        const latest = state.docs.filter((d) => !isUntouchedSample(d)).sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
        if (latest) A.openDoc(latest.id);
      }
    }
    saveMeta();
    if (changed) {
      persist(true);
      if (prefs.leftTab === 'drafts') A.renderDrafts();
    }
    if (firstLook) {
      if (state.docs.length > before) toast(`Synced: ${state.docs.length - before} ${state.docs.length - before === 1 ? 'draft' : 'drafts'} from your other devices.`);
      flushSoon(true);
    }
  }

  function onProgress(snap) {
    if (!snap.exists) return;
    const p = JSON.parse(JSON.stringify(snap.data().progress || {}));
    const was = JSON.stringify(A.progressData());
    A.mergeProgress(p);
    if (JSON.stringify(A.progressData()) !== was) savePrefs();
  }

  function onError(e) {
    const code = e && e.code;
    if (code === 'unavailable') {
      // The bridge stopped answering: listen again shortly.
      setTimeout(() => S.on && listen(), 5000);
      return;
    }
    stop(code === 'revoked' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed'
      ? 'Sync isn’t available on this page right now. Your drafts are still saved in this browser.'
      : 'Sync stopped because of an error. Your drafts are still saved in this browser.');
  }

  function listen() {
    S.unsubs.forEach((u) => u());
    S.unsubs = [drafts().onSnapshot(onDrafts, onError), progressRef().onSnapshot(onProgress, () => {})];
  }

  /* ---------- sending ---------- */

  function flushSoon(now) {
    if (!S.on) return;
    clearTimeout(S.timer);
    if (!S.firstAsk) S.firstAsk = Date.now();
    const wait = now ? 0 : Math.max(0, Math.min(PAUSE, S.firstAsk + MAX_WAIT - Date.now()));
    S.timer = setTimeout(flush, wait);
  }

  async function write(ref, body) {
    try {
      await ref.set(body);
    } catch (e) {
      if (e && e.code === 'unavailable') {
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
        await ref.set(body);
      } else throw e;
    }
  }

  async function flush() {
    if (!S.on || !S.ready) return;
    if (S.busy) {
      S.again = true;
      return;
    }
    S.busy = true;
    S.firstAsk = 0;
    let sent = 0;
    try {
      const col = drafts();
      for (const d of state.docs.slice()) {
        if (!syncable(d)) continue;
        const known = S.meta.docs[d.id];
        let sig = sigOf(d);
        if (known && known.h === sig) continue;
        // A change that didn't move the timestamp still has to win on the other devices.
        if (known && (d.updated || 0) <= known.u) {
          d.updated = Date.now();
          sig = sigOf(d);
        }
        const body = bodyOf(d);
        if (!body) {
          if (!known || !known.big) toast(`“${d.title || 'Untitled draft'}” is too long to sync. It stays saved in this browser.`);
          S.meta.docs[d.id] = { h: sig, u: d.updated || 0, big: true };
          continue;
        }
        if (sent++ === 0) setStatus('syncing');
        await write(col.doc(d.id), { updated: d.updated || Date.now(), doc: body });
        S.meta.docs[d.id] = { h: sig, u: d.updated || 0 };
      }
      for (const [id, at] of Object.entries(S.meta.tomb)) {
        if (S.meta.sent[id]) continue;
        if (sent++ === 0) setStatus('syncing');
        await write(col.doc(id), { updated: at, deleted: true });
        S.meta.sent[id] = true;
      }
      const p = A.progressData();
      const ph = hash(JSON.stringify(p));
      if (ph !== S.meta.progress) {
        await write(progressRef(), { progress: p });
        S.meta.progress = ph;
      }
      S.meta.at = Date.now();
      saveMeta();
      setStatus('synced');
    } catch (e) {
      saveMeta();
      const code = e && e.code;
      if (code === 'quota_exceeded') setStatus('error', 'Your synced space is full. Delete drafts you no longer need, or download a backup.');
      else if (code === 'resource_exhausted' || code === 'unavailable') {
        setStatus('paused', 'Sync is catching its breath. It will try again in a moment.');
        setTimeout(() => flushSoon(true), 20000);
      } else if (code === 'invalid_argument') stop('This account can’t save synced drafts on this page. Your drafts are still saved in this browser.');
      else onError(e);
    } finally {
      S.busy = false;
      if (S.again) {
        S.again = false;
        flushSoon(true);
      }
    }
  }

  /* ---------- turning it on and off ---------- */

  /** Called at start-up once the page knows whether it can sync here. */
  function syncAvailable(db, uid) {
    S.db = db;
    S.uid = uid;
    if (prefs.sync) start();
    else if (prefs.leftTab === 'drafts') A.renderDrafts();
  }

  function start() {
    if (!S.db || !S.uid) return;
    S.on = true;
    S.ready = false;
    prefs.sync = true;
    savePrefs();
    setStatus('connecting');
    listen();
    if (prefs.leftTab === 'drafts') A.renderDrafts();
  }

  function stop(message) {
    S.unsubs.forEach((u) => u());
    S.unsubs = [];
    clearTimeout(S.timer);
    S.on = false;
    S.ready = false;
    if (message) {
      setStatus('error', message);
      toast(message);
    } else {
      prefs.sync = false;
      savePrefs();
      S.status = 'off';
      toast('Sync is off on this device. Your drafts stay here and on your other devices.');
    }
    $('saveState').textContent = 'Saved in this browser';
    if (prefs.leftTab === 'drafts') A.renderDrafts();
  }

  /** Records a deleted draft so other devices delete it too. */
  function syncDeleted(id) {
    if (!S.on && !S.meta.docs[id]) return;
    S.meta.tomb[id] = Date.now();
    delete S.meta.sent[id];
    delete S.meta.docs[id];
    saveMeta();
    flushSoon();
  }

  /** The sync part of Drafts → Keep your work safe. */
  function renderSync() {
    if (!S.db || !S.uid) return '';
    if (!S.on) {
      return `<div class="sync-box">
          <p class="small"><b>Use your drafts on every device.</b> Sync keeps them in your Claude account, private to you, so they’re there wherever you open this page signed in.</p>
          ${S.status === 'error' && S.message ? `<p class="small muted">${esc(S.message)}</p>` : ''}
          <div class="btn-row"><button class="btn btn-primary" type="button" data-act="sync-on">Sync my drafts</button></div>
        </div>`;
    }
    return `<div class="sync-box on">
        <p class="small"><b><span class="sync-dot" aria-hidden="true"></span>Synced with your Claude account.</b> Open this page on any device where you’re signed in and your drafts are there. Only you can see them.</p>
        <p class="small muted" id="syncStatus" aria-live="polite">${esc(statusText())}</p>
        <div class="btn-row"><button class="btn btn-quiet" type="button" data-act="sync-off">Stop syncing on this device</button></div>
      </div>`;
  }

  Object.assign(A, { syncAvailable, startSync: start, stopSync: () => stop(), syncSoon: () => flushSoon(), syncDeleted, renderSync });
})(window.WP = window.WP || {});
