/*
 * Shared state for the app: storage, preferences, drafts, the editor, and small helpers every panel uses.
 */
(function (WP) {
  'use strict';

  const A = (WP.app = WP.app || {});

  const $ = (id) => document.getElementById(id);
  const esc = WP.esc;
  const T = WP.text;

  const STORE_DOCS = 'wp.docs.v1';
  const STORE_PREFS = 'wp.prefs.v1';
  const LEVELS = [
    { id: 'good', label: 'Following' },
    { id: 'warn', label: 'Improve' },
    { id: 'bad', label: 'Breaking' },
    { id: 'info', label: 'Tip' },
  ];
  const STATUS_LABEL = { pass: 'Following', warn: 'Improve', fail: 'Breaking', info: 'Tip', na: 'Waiting' };
  const STATUS_ORDER = { fail: 0, warn: 1, pass: 2, info: 3, na: 4 };

  /* ---------- storage ---------- */

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- state ---------- */

  const prefs = Object.assign({
    leftTab: 'ideas',
    rightTab: 'checks',
    showLeft: false,
    showRight: false,
    focus: false,
    wide: false,
    theme: null,
    display: { size: 'm', spacing: 'normal', font: 'serif' },
    rhythmOpen: false,
    goal: 0,
    days: {},
    drillsDone: [],
    challenges: {},
    toured: false,
    muted: {},
    oneThing: false,
    learned: {},
    pieces: {},
    warmups: {},
    levels: { good: true, warn: true, bad: true, info: true },
  }, load(STORE_PREFS, {}));
  // Layout 2 starts with both side panels closed, behind the icon rails, for a calmer first screen.
  if (prefs.layout !== 2) {
    prefs.showLeft = false;
    prefs.showRight = false;
    prefs.layout = 2;
  }

  const state = {
    downloads: null, // the artifact runtime’s file saver, when there is one
    tourStep: -1, // which tour step is showing; -1 when the tour is closed
    docs: load(STORE_DOCS, []),
    currentId: null,
    results: [],
    score: null,
    ctx: null,
    spotlight: null,
    expanded: new Set(),
    openFramework: null,
    prompt: null,
    idea: null,
    nudge: null,
    sprint: null,
    confirmDelete: null,
    allMarks: [],
    lastCount: null,
    fixMark: null,
    showModel: false,
    speaking: false,
  };

  const genreById = (id) => WP.genres.find((g) => g.id === id) || WP.genres[0];
  const doc = () => state.docs.find((d) => d.id === state.currentId);
  const genre = () => genreById(doc().genre);
  const frameworkDef = () => genre().frameworks.find((f) => f.id === doc().framework) || null;

  function newDoc(genreId, fields) {
    const g = genreById(genreId);
    const d = Object.assign({
      id: uid(),
      title: '',
      genre: g.id,
      framework: g.frameworks[0].id,
      text: '',
      created: Date.now(),
      updated: Date.now(),
    }, fields || {});
    state.docs.unshift(d);
    return d;
  }

  function sampleDoc(genreId) {
    const g = genreById(genreId);
    return newDoc(g.id, { title: g.sample.title, framework: g.sample.framework, text: g.sample.text, sample: g.id });
  }

  function isUntouchedSample(d) {
    return d.sample && d.text === genreById(d.sample).sample.text;
  }

  let saveTimer = null;
  /* Browser storage holds roughly 5 million characters per site. Version history is the
     first thing to give way: the oldest automatic versions are thinned out before the
     limit is reached, and again if a save is refused for lack of space. */
  const STORAGE_SOFT_LIMIT = 3500000;
  const STORAGE_TOTAL = 5000000;

  function storageUsed() {
    let n = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        n += k.length + (localStorage.getItem(k) || '').length;
      }
    } catch (e) {
      return null;
    }
    return n;
  }

  /** Drops the oldest automatic versions (never ones you saved) until the drafts fit. */
  function pruneVersions(target) {
    let size = JSON.stringify(state.docs).length;
    let removed = 0;
    while (size > target) {
      let oldest = null;
      for (const d of state.docs) {
        for (const v of d.versions || []) {
          if (v.label === 'Saved by you') continue;
          if (!oldest || v.at < oldest.v.at) oldest = { d, v };
        }
      }
      if (!oldest) break;
      oldest.d.versions = oldest.d.versions.filter((x) => x !== oldest.v);
      size -= oldest.v.text.length + 80;
      removed++;
    }
    return removed;
  }

  function persist(immediate) {
    clearTimeout(saveTimer);
    const run = () => {
      if (JSON.stringify(state.docs).length > STORAGE_SOFT_LIMIT) pruneVersions(STORAGE_SOFT_LIMIT * 0.85);
      let ok = save(STORE_DOCS, state.docs);
      if (!ok && pruneVersions(JSON.stringify(state.docs).length * 0.7)) ok = save(STORE_DOCS, state.docs);
      if (ok) {
        state.storageWarned = false;
        $('saveState').textContent = 'Saved in this browser';
      } else {
        $('saveState').textContent = 'Not saved: browser storage is full or blocked';
        if (!state.storageWarned) {
          state.storageWarned = true;
          toast('Your drafts could not be saved. Download a backup from the Drafts tab, then delete drafts you no longer need.');
        }
      }
    };
    if (immediate) run();
    else {
      $('saveState').textContent = 'Saving…';
      saveTimer = setTimeout(run, 500);
    }
  }

  function savePrefs() {
    save(STORE_PREFS, prefs);
  }

  /* ---------- editor ---------- */

  const editor = new WP.Editor({
    textarea: $('editor'),
    backdrop: $('backdrop'),
    scroller: $('desk'),
    onChange(text) {
      const d = doc();
      d.text = text;
      d.updated = Date.now();
      persist();
      A.hideFixCard();
      A.scheduleAnalysis();
      A.renderStatusLight();
      if (!$('starter').hidden || !text.trim()) A.renderStarter();
    },
    onCaret(pos) {
      A.updateCursorNote(pos);
    },
    onHover(info) {
      const tip = $('tooltip');
      if (!info || !info.marks.length || !$('fixCard').hidden) {
        tip.hidden = true;
        return;
      }
      tip.innerHTML = info.marks.slice(0, 3).map((m) => `
        <div class="tip-row">
          <span class="tip-title"><span class="swatch swatch-${m.level}"></span>${esc(m.checkTitle)}</span>
          <span>${esc(A.noteText(m))}</span>
        </div>`).join('');
      tip.hidden = false;
      tip.dataset.src = 'editor';
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      let x = info.x + 14;
      let y = info.y + 18;
      if (x + w > window.innerWidth - 12) x = window.innerWidth - w - 12;
      if (y + h > window.innerHeight - 12) y = info.y - h - 12;
      tip.style.left = Math.max(12, x) + 'px';
      tip.style.top = Math.max(12, y) + 'px';
    },
  });

  WP.editorInstance = editor;

  function levelRank(l) {
    return { bad: 4, warn: 3, good: 2, info: 1 }[l] || 0;
  }

  /* ---------- daily progress ---------- */

  function dayKey(date) {
    const d = date || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  let prefsTimer = null;
  function trackWords(id, count) {
    const last = state.lastCount;
    if (last && last.id === id && count > last.count) {
      const key = dayKey();
      prefs.days[key] = (prefs.days[key] || 0) + Math.min(count - last.count, 400);
      const cutoff = dayKey(new Date(Date.now() - 90 * 86400000));
      for (const k of Object.keys(prefs.days)) if (k < cutoff) delete prefs.days[k];
      clearTimeout(prefsTimer);
      prefsTimer = setTimeout(() => {
        savePrefs();
        if (prefs.leftTab === 'ideas') A.renderProgress();
      }, 800);
    }
    state.lastCount = { id, count };
  }

  function streak() {
    let n = 0;
    const d = new Date();
    if (!prefs.days[dayKey(d)]) d.setDate(d.getDate() - 1);
    while (prefs.days[dayKey(d)] > 0) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  /* ---------- writing habits ---------- */

  function realDrafts() {
    return state.docs.filter((d) => !d.sample && !d.example && !d.drill && !d.game);
  }

  /* ---------- what improved ---------- */

  function resultsFor(d, text) {
    const g = genreById(d.genre);
    const ctx = T.parse(text, { framework: d.framework, genre: g.id });
    ctx.frameworkDef = g.frameworks.find((f) => f.id === d.framework) || null;
    const muted = new Set(prefs.muted[g.id] || []);
    return WP.checks.run(g.checks.filter((c) => !muted.has(c.id)), ctx);
  }

  /* ---------- preview ---------- */

  function cleanText(text) {
    return text.split('\n').filter((l) => !/^\s*>/.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ---------- study a framework example ---------- */

  function sectionsOf(text) {
    const out = [];
    let cur = null;
    for (const line of text.split('\n')) {
      const m = line.match(/^##\s+(.*)$/);
      if (m) out.push((cur = { title: m[1].trim(), body: [] }));
      else if (cur) cur.body.push(line);
    }
    return out.map((x) => ({ title: x.title, body: x.body.join('\n').trim() }));
  }

  /* ---------- daily challenge ---------- */

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  /* ---------- modal + tour ---------- */

  let modalReturnFocus = null;

  function openModal(title, html) {
    if ($('modal').hidden) modalReturnFocus = document.activeElement;
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = html;
    $('modal').hidden = false;
    $('modalClose').focus();
  }

  function closeModal() {
    $('modal').hidden = true;
    if (modalReturnFocus && document.contains(modalReturnFocus)) modalReturnFocus.focus({ preventScroll: true });
    modalReturnFocus = null;
  }

  function insertNote(text) {
    const ta = $('editor');
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const prefix = before && !before.endsWith('\n') ? '\n' : '';
    editor.insert(`${prefix}> ${text}\n`);
  }

  function wordCount() {
    return state.ctx ? state.ctx.wordCount : T.parse(doc().text).wordCount;
  }

  function fmtClock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  /* ---------- Drafts pane ---------- */

  function relTime(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return new Date(t).toLocaleDateString();
  }

  /* ---------- toast ---------- */

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3200);
  }

  Object.assign(A, {
    $, esc, T, STORE_DOCS, STORE_PREFS, LEVELS, STATUS_LABEL, STATUS_ORDER, load, save, uid, pick,
    prefs, state, genreById, doc, genre, frameworkDef, newDoc, sampleDoc, isUntouchedSample,
    STORAGE_SOFT_LIMIT, STORAGE_TOTAL, storageUsed, pruneVersions, persist, savePrefs, editor,
    levelRank, dayKey, trackWords, streak, realDrafts, resultsFor, cleanText, sectionsOf, hash,
    openModal, closeModal, insertNote, wordCount, fmtClock, relTime, toast
  });
})(window.WP = window.WP || {});
