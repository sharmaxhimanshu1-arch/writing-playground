(function (WP) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = WP.esc;
  const T = WP.text;

  const STORE_DOCS = 'wp.docs.v1';
  const STORE_PREFS = 'wp.prefs.v1';
  const LEVELS = [
    { id: 'good', label: 'Following' },
    { id: 'warn', label: 'Consider' },
    { id: 'bad', label: 'Breaking' },
    { id: 'info', label: 'Info' },
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
    showLeft: true,
    showRight: true,
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

  const state = {
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
  let downloads = null;

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
      hideFixCard();
      scheduleAnalysis();
      renderStatusLight();
      if (!$('starter').hidden || !text.trim()) renderStarter();
    },
    onCaret(pos) {
      const here = editor.marksAt(pos);
      const note = here.sort((a, b) => levelRank(b.level) - levelRank(a.level))[0];
      $('cursorNote').innerHTML = note ? `<b>${esc(note.checkTitle)}:</b> ${esc(note.note)}` : '';
    },
    onHover(info) {
      const tip = $('tooltip');
      if (!info || !info.marks.length) {
        tip.hidden = true;
        return;
      }
      tip.innerHTML = info.marks.slice(0, 3).map((m) => `
        <div class="tip-row">
          <span class="tip-title"><span class="swatch swatch-${m.level}"></span>${esc(m.checkTitle)}</span>
          <span>${esc(m.note)}</span>
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

  let analysisTimer = null;
  function scheduleAnalysis() {
    clearTimeout(analysisTimer);
    analysisTimer = setTimeout(analyze, 350);
  }

  function analyze() {
    const d = doc();
    const g = genre();
    const ctx = T.parse(d.text, { framework: d.framework, genre: g.id });
    ctx.frameworkDef = frameworkDef();
    const game = d.game && WP.warmups.get(d.game.id);
    const gameChecks = game ? game.checks(d.game.params || {}) : [];
    const muted = new Set(prefs.muted[g.id] || []);
    const checks = game ? gameChecks : g.checks.filter((c) => !muted.has(c.id));
    const force = (d.drill ? [d.drill.rule] : []).concat(gameChecks.map((c) => c.id));
    const { results, score } = WP.checks.run(checks, ctx, { force });
    state.ctx = ctx;
    state.results = results;
    state.score = score;
    state.allMarks = results.flatMap((r) => r.marks);
    state.allMarks.forEach((m, i) => (m.idx = i));
    if (state.spotlight && !results.some((r) => r.id === state.spotlight)) state.spotlight = null;
    editor.setMarks(state.allMarks);
    trackWords(d.id, ctx.wordCount);
    checkDrill(d, results);
    checkChallenge(d, ctx.wordCount);
    checkGame(d, results);
    checkPiece(d, score, ctx.wordCount);
    if (prefs.oneThing) pickOneThing(results);
    autoVersion(d, score, ctx.wordCount);
    renderChecks();
    renderStatus();
    if (prefs.rightTab === 'frameworks') renderFrameworks();
    if (prefs.leftTab === 'practice') renderPractice();
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
        if (prefs.leftTab === 'ideas') renderProgress();
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

  function renderProgress() {
    const el = $('progressBox');
    if (!el) return;
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ date: d, words: prefs.days[dayKey(d)] || 0 });
    }
    const max = Math.max(50, ...days.map((x) => x.words));
    const W = 280;
    const H = 40;
    const gap = 3;
    const bw = (W - gap * 13) / 14;
    const fmt = (d) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    const bars = days.map((x, i) => {
      const xPos = i * (bw + gap);
      const h = x.words ? Math.max(4, (x.words / max) * (H - 4)) : 2;
      const y = H - h;
      const cls = x.words ? 'bar' : 'bar-empty';
      const top = x.words && h > 4 ? `<rect class="${cls}" x="${xPos}" y="${y}" width="${bw}" height="${h}" rx="3"></rect><rect class="${cls}" x="${xPos}" y="${H - Math.min(h, 4)}" width="${bw}" height="${Math.min(h, 4)}"></rect>`
        : `<rect class="${cls}" x="${xPos}" y="${y}" width="${bw}" height="${h}"></rect>`;
      return `<g>${top}<rect class="bar-hit" x="${xPos - gap / 2}" y="0" width="${bw + gap}" height="${H}" data-tip="${esc(fmt(x.date))}: ${x.words} words"></rect></g>`;
    }).join('');
    const today = prefs.days[dayKey()] || 0;
    const st = streak();
    const total = days.reduce((a, x) => a + x.words, 0);
    if (!total) {
      el.innerHTML = `<p class="small muted">Nothing written yet in the last 14 days. Your daily words and streak will show up here.</p>`;
      return;
    }
    el.innerHTML = `
      <div class="progress-stats">
        <span><b>${today}</b> words today</span>
        <span><b>${st}</b> day streak</span>
        <span><b>${total}</b> in 14 days</span>
      </div>
      <svg class="progress-chart" viewBox="0 0 ${W} ${H + 14}" role="img" aria-label="Words written per day for the last 14 days. Today ${today} words, ${total} in total.">
        ${bars}
        <text class="axis-label" x="0" y="${H + 12}">${esc(days[0].date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))}</text>
        <text class="axis-label" x="${W}" y="${H + 12}" text-anchor="end">Today</text>
      </svg>
      <p class="small muted">${st >= 2 ? `Keep it going: write anything today to make it ${st + (today ? 0 : 1)} days.` : 'Writing a little every day beats a lot once a week. Even 50 words counts.'}</p>`;
  }

  /* ---------- top bar ---------- */

  const SHORT_NAMES = { video: 'Video', story: 'Story', essay: 'Essay', copy: 'Copy' };

  function renderGenreTabs() {
    const g = genre();
    $('genreTabs').innerHTML = WP.genres.map((x) => `
      <button type="button" class="genre-tab" data-genre="${x.id}" aria-pressed="${x.id === g.id}" title="${esc(x.name)}: ${esc(x.tagline)}">${esc(SHORT_NAMES[x.id] || x.name)}</button>`).join('');
    $('genreSelect').innerHTML = WP.genres.map((x) => `<option value="${x.id}" ${x.id === g.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    fitTopbar();
  }

  /** Swaps the genre tabs for a dropdown when they don't fit. */
  function fitTopbar() {
    const bar = document.querySelector('.topbar');
    bar.classList.remove('compact');
    const tabs = $('genreTabs');
    if (tabs.scrollWidth > tabs.clientWidth + 2) bar.classList.add('compact');
  }

  /** Genre tabs open that genre's workspace: its latest draft, or an example on first visit. */
  function setGenre(id) {
    const d = doc();
    if (d.genre === id) return;
    const g = genreById(id);
    if (!d.text.trim()) {
      d.genre = g.id;
      d.framework = g.frameworks[0].id;
      d.updated = Date.now();
      persist(true);
      openDoc(d.id);
    } else {
      const existing = state.docs.filter((x) => x.genre === g.id).sort((a, b) => b.updated - a.updated)[0];
      openDoc((existing || sampleDoc(g.id)).id);
      persist(true);
    }
  }

  /** Re-checks the current draft against another genre's rules. */
  function checkAs(id) {
    const d = doc();
    const g = genreById(id);
    d.genre = g.id;
    if (!g.frameworks.some((f) => f.id === d.framework)) d.framework = g.frameworks[0].id;
    d.updated = Date.now();
    persist(true);
    state.spotlight = null;
    state.expanded.clear();
    state.openFramework = null;
    renderAll();
    toast(`This draft is now checked as ${g.name}.`);
  }

  function applyLayout() {
    const layout = $('layout');
    const narrow = window.matchMedia('(max-width: 960px)').matches;
    document.querySelector('.app').classList.toggle('focus', prefs.focus);
    $('focusBtn').setAttribute('aria-pressed', String(prefs.focus));
    if (narrow) {
      layout.classList.remove('no-left', 'no-right');
      const l = layout.classList.contains('show-left');
      const r = layout.classList.contains('show-right');
      $('scrim').hidden = !(l || r);
      $('toggleLeft').setAttribute('aria-expanded', String(l));
      $('toggleRight').setAttribute('aria-expanded', String(r));
    } else {
      layout.classList.remove('show-left', 'show-right');
      $('scrim').hidden = true;
      layout.classList.toggle('no-left', !prefs.showLeft);
      layout.classList.toggle('no-right', !prefs.showRight);
      $('toggleLeft').setAttribute('aria-expanded', String(prefs.showLeft && !prefs.focus));
      $('toggleRight').setAttribute('aria-expanded', String(prefs.showRight && !prefs.focus));
    }
    $('sheet').classList.toggle('wide', prefs.wide);
    $('widthBtn').setAttribute('aria-pressed', String(prefs.wide));
  }

  function togglePanel(side) {
    const narrow = window.matchMedia('(max-width: 960px)').matches;
    if (prefs.focus) {
      prefs.focus = false;
      if (side === 'left') prefs.showLeft = true;
      else prefs.showRight = true;
    } else if (narrow) {
      const layout = $('layout');
      const cls = side === 'left' ? 'show-left' : 'show-right';
      const other = side === 'left' ? 'show-right' : 'show-left';
      layout.classList.remove(other);
      layout.classList.toggle(cls);
    } else if (side === 'left') prefs.showLeft = !prefs.showLeft;
    else prefs.showRight = !prefs.showRight;
    savePrefs();
    applyLayout();
  }

  function applyTheme() {
    if (prefs.theme) document.documentElement.setAttribute('data-theme', prefs.theme);
    else document.documentElement.removeAttribute('data-theme');
  }

  function toggleTheme() {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const current = prefs.theme || (systemDark ? 'dark' : 'light');
    prefs.theme = current === 'dark' ? 'light' : 'dark';
    savePrefs();
    applyTheme();
  }

  /* ---------- plan this piece ---------- */

  function planFor(g) {
    return (WP.plans && WP.plans[g.id]) || [];
  }

  function renderPlan(d) {
    const g = genreById(d.genre);
    const qs = planFor(g);
    if (!qs.length || d.game) return '';
    const plan = d.plan || {};
    const answered = qs.filter((q) => (plan[q.id] || '').trim()).length;
    const open = answered < qs.length && !d.sample && !d.example;
    return `<section class="section">
        <details class="plan" id="planBox" ${open ? 'open' : ''}>
          <summary><span><b>Plan this piece</b> <span class="small muted">${answered} of ${qs.length} answered</span></span></summary>
          <p class="small muted">Answer these before you write, in a few words each. A clear plan is the difference between staring at the page and knowing your next sentence. The coach reads your plan too.</p>
          <div class="plan-fields">${qs.map((q) => `<label class="plan-field" for="plan-${q.id}">
            <span><b>${esc(q.q)}</b> <span class="small muted">${esc(q.hint)}</span></span>
            <textarea id="plan-${q.id}" data-plan="${q.id}" rows="2" placeholder="${esc(q.ph)}">${esc(plan[q.id] || '')}</textarea>
          </label>`).join('')}</div>
        </details>
      </section>`;
  }

  /* ---------- writing habits ---------- */

  function realDrafts() {
    return state.docs.filter((d) => !d.sample && !d.example && !d.drill && !d.game);
  }

  function openHabits() {
    const docs = realDrafts().filter((d) => T.parse(d.text).wordCount >= 50);
    if (!docs.length) {
      return openModal('Your writing habits', '<p>Write at least one draft of 50 words or more (not an example or a drill), and this report will show the patterns across everything you write.</p>');
    }
    const tally = new Map();
    const words = new Map();
    let total = 0;
    for (const d of docs) {
      const g = genreById(d.genre);
      const ctx = T.parse(d.text, { framework: d.framework, genre: g.id });
      ctx.frameworkDef = g.frameworks.find((f) => f.id === d.framework) || null;
      total += ctx.wordCount;
      for (const w of ctx.words) {
        if (w.lower.length < 4 || WP.lex.stopwords.has(w.lower) || /^\d/.test(w.lower)) continue;
        words.set(w.lower, (words.get(w.lower) || 0) + 1);
      }
      for (const r of WP.checks.run(g.checks, ctx).results) {
        if (r.id === 'structure' || !(r.status === 'fail' || r.status === 'warn')) continue;
        const t = tally.get(r.id) || { id: r.id, title: r.title, why: r.why, drafts: 0, genres: new Set() };
        t.drafts++;
        t.genres.add(g.id);
        tally.set(r.id, t);
      }
    }
    const top = [...tally.values()].sort((a, b) => b.drafts - a.drafts).slice(0, 5);
    const drillFor = (t) => {
      for (const gid of [genre().id, ...t.genres, ...WP.genres.map((g) => g.id)]) {
        const dr = ((WP.drills || {})[gid] || []).find((x) => x.rule === t.id);
        if (dr) return { gid, dr };
      }
      return null;
    };
    const lean = [...words.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 10);
    openModal('Your writing habits', `
      <p class="small muted">Across ${docs.length} ${docs.length === 1 ? 'draft' : 'drafts'} and ${total.toLocaleString()} words. Examples, drills and warm-ups aren’t counted.</p>
      ${top.length ? `<p class="eyebrow">Your most common issues</p>
      <ol class="habits">${top.map((t) => {
        const link = drillFor(t);
        return `<li>
          <div><b>${esc(t.title)}</b> <span class="small muted">in ${t.drafts} of ${docs.length} ${docs.length === 1 ? 'draft' : 'drafts'}</span></div>
          <p class="small muted">${esc(t.why || '')}</p>
          ${link ? `<button class="btn btn-small btn-primary" type="button" data-habit-drill="${link.gid}:${link.dr.id}">Practice: ${esc(link.dr.title)}</button>` : ''}
        </li>`;
      }).join('')}</ol>` : '<p>No repeated issues. Your drafts follow their genre’s rules. Try a new genre or a harder framework.</p>'}
      <p class="eyebrow">Words you lean on</p>
      <p class="small muted">Your most-used words (ignoring short, common ones). If a word here isn’t central to what you write about, it may be a habit.</p>
      ${lean.length && total >= 300 ? `<div class="lean">${lean.map(([w, n]) => `<span class="chip">${esc(w)} <b>${n}</b></span>`).join('')}</div>` : '<p class="small">Write a few hundred words in total and your most-repeated words will show up here.</p>'}`);
  }

  /* ---------- what improved ---------- */

  function resultsFor(d, text) {
    const g = genreById(d.genre);
    const ctx = T.parse(text, { framework: d.framework, genre: g.id });
    ctx.frameworkDef = g.frameworks.find((f) => f.id === d.framework) || null;
    const muted = new Set(prefs.muted[g.id] || []);
    return WP.checks.run(g.checks.filter((c) => !muted.has(c.id)), ctx);
  }

  function openImproved() {
    const d = doc();
    const first = (d.versions || [])[0];
    if (!first) return;
    const a = resultsFor(d, first.text);
    const b = resultsFor(d, d.text);
    const bad = (r) => r && (r.status === 'fail' || r.status === 'warn');
    const fixed = [];
    const worse = [];
    const still = [];
    for (const r of b.results) {
      const old = a.results.find((x) => x.id === r.id);
      if (!old || old.status === 'na' || r.status === 'na') continue;
      if (bad(old) && r.status === 'pass') fixed.push(r);
      else if (!bad(old) && bad(r)) worse.push(r);
      else if (bad(old) && bad(r)) still.push(r);
    }
    const list = (items, cls) => items.length ? `<ul class="improved ${cls}">${items.map((r) => `<li><b>${esc(r.title)}</b> <span class="small muted">${esc(r.summary)}</span></li>`).join('')}</ul>` : '<p class="small muted">None.</p>';
    openModal('What improved', `
      <p class="small muted">Comparing your first saved version (${esc(new Date(first.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}, ${first.words} words) with today (${T.parse(d.text).wordCount} words). Score <b>${a.score == null ? '–' : a.score}</b> → <b>${b.score == null ? '–' : b.score}</b>.</p>
      <p class="eyebrow">Fixed since then</p>${list(fixed, 'fixed')}
      <p class="eyebrow">Still to work on</p>${list(still, 'still')}
      <p class="eyebrow">New since then</p>${list(worse, 'worse')}`);
  }

  /* ---------- preview ---------- */

  function cleanText(text) {
    return text.split('\n').filter((l) => !/^\s*>/.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function openPreview() {
    const d = doc();
    const blocks = cleanText(d.text).split(/\n\s*\n/);
    const html = blocks.map((b) => {
      const h = b.match(/^#{1,6}\s+(.*)$/);
      if (h && !b.includes('\n')) return `<h3>${esc(h[1])}</h3>`;
      const inner = esc(b).replace(/\[[^\]\n]*\]/g, (m) => `<span class="preview-cue">${m}</span>`).replace(/^#{1,6}\s+(.*)$/gm, '<b>$1</b>');
      return `<p>${inner}</p>`;
    }).join('');
    const words = T.parse(d.text).wordCount;
    const g = genre();
    const spoken = ['video', 'comedy', 'speech'].includes(g.id);
    openModal('Preview', `
      <article class="preview">
        <h2>${esc(d.title || 'Untitled draft')}</h2>
        <p class="small muted">${words} words · ${spoken ? `about ${Math.max(1, Math.round(words / 140))} min spoken` : `about ${Math.max(1, Math.round(words / 230))} min to read`} · notes hidden</p>
        ${html || '<p class="muted">Nothing to preview yet.</p>'}
      </article>
      <div class="btn-row"><button class="btn" type="button" data-act="copy-clean">Copy without notes</button></div>`);
  }

  /* ---------- display settings ---------- */

  const DISPLAY = {
    size: { s: ['Small', '1.0625rem'], m: ['Medium', '1.1875rem'], l: ['Large', '1.375rem'], xl: ['Extra large', '1.5625rem'] },
    spacing: { normal: ['Normal', '1.75'], relaxed: ['Relaxed', '2.05'] },
    font: {
      serif: ['Book serif', 'var(--font-editor)'],
      easy: ['Easy-read', 'var(--font-ui)'],
      mono: ['Typewriter', 'var(--font-mono)'],
    },
  };

  function applyDisplay() {
    const d = Object.assign({ size: 'm', spacing: 'normal', font: 'serif' }, prefs.display);
    const root = document.documentElement.style;
    if (d.size === 'm') root.removeProperty('--editor-size');
    else root.setProperty('--editor-size', DISPLAY.size[d.size][1]);
    root.setProperty('--editor-leading', DISPLAY.spacing[d.spacing][1]);
    root.setProperty('--font-page', DISPLAY.font[d.font][1]);
    editor.render();
  }

  function openDisplay() {
    const d = Object.assign({ size: 'm', spacing: 'normal', font: 'serif' }, prefs.display);
    const group = (key, label) => `<fieldset class="seg">
        <legend>${label}</legend>
        ${Object.entries(DISPLAY[key]).map(([v, [name]]) => `<label><input type="radio" name="disp-${key}" value="${v}" ${d[key] === v ? 'checked' : ''}><span>${name}</span></label>`).join('')}
      </fieldset>`;
    openModal('Display', `
      <form id="displayForm" class="display-form">
        ${group('size', 'Text size')}
        ${group('spacing', 'Line spacing')}
        ${group('font', 'Font')}
        <p class="small muted">Easy-read uses Atkinson Hyperlegible, a typeface designed for readers with low vision. These settings only change how the page looks to you.</p>
      </form>`);
  }

  /* ---------- keyboard shortcuts ---------- */

  const MOD = /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl';

  function openShortcuts() {
    const rows = [
      [`${MOD} + S`, 'Save now (drafts also save automatically)'],
      [`${MOD} + Z`, 'Undo, including one-click fixes and rewrites'],
      [`${MOD} + .`, 'Next issue (turns on “One thing at a time”)'],
      [`${MOD} + Shift + F`, 'Focus mode: hide both panels'],
      [`${MOD} + Shift + L`, 'Listen: read the draft or selection aloud'],
      [`${MOD} + /`, 'Show these shortcuts'],
      ['Tab', 'Insert a tab in the draft'],
      ['Esc', 'Close a popup, dismiss a fix card, or clear a spotlight'],
    ];
    openModal('Keyboard shortcuts', `<dl class="shortcuts">${rows.map(([k, v]) => `<div><dt><kbd>${esc(k)}</kbd></dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`);
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

  function openStudy(id) {
    const g = genre();
    const fw = g.frameworks.find((f) => f.id === id);
    const secs = sectionsOf(fw.example);
    const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const body = secs.length
      ? fw.beats.map((b, i) => {
        const sec = secs.find((x) => norm(x.title).includes(norm(b.name)) || norm(b.name).includes(norm(x.title))) || secs[i];
        return `<div class="study-beat">
          <div class="study-label"><span class="path-num">${i + 1}</span><b>${esc(b.name)}</b></div>
          <p class="small muted"><b>This beat’s job:</b> ${esc(b.hint)}</p>
          <pre class="study-text">${esc(sec ? sec.body.replace(/^>.*$/gm, '').trim() || sec.body : '')}</pre>
        </div>`;
      }).join('')
      : `<pre class="study-text">${esc(fw.example)}</pre>
         <ol class="plain-list">${fw.beats.map((b) => `<li><b>${esc(b.name)}:</b> ${esc(b.hint)}</li>`).join('')}</ol>`;
    openModal(`Study: ${fw.name}`, `
      <p class="small muted">${esc(fw.summary)} Read each beat and its job, then try writing your own version.</p>
      ${body}
      <div class="btn-row"><button class="btn btn-primary" type="button" data-study-insert="${fw.id}">Write my own with this outline</button></div>`);
  }

  /* ---------- outline of the current draft ---------- */

  function renderOutline(ctx) {
    if (!ctx || ctx.paragraphs.length < 2) return '';
    const items = [];
    let hi = 0;
    for (const p of ctx.paragraphs) {
      while (hi < ctx.headings.length && ctx.headings[hi].start < p.start) {
        const h = ctx.headings[hi++];
        items.push(`<li class="ol-head"><button type="button" data-jump="${h.start}:${h.end}">${esc(h.title)}</button></li>`);
      }
      const s0 = p.sentences[0];
      if (!s0) continue;
      const t = s0.text.replace(/\s+/g, ' ').trim();
      items.push(`<li><button type="button" data-jump="${s0.start}:${s0.end}"><span>${esc(t.length > 90 ? t.slice(0, 88) + '…' : t)}</span><span class="ol-words">${p.words.length}</span></button></li>`);
    }
    return `<section class="section">
        <p class="eyebrow">Your draft’s outline</p>
        <p class="small muted">The first sentence of each paragraph. Read them in order: if the story or argument still makes sense, your structure works. Click one to jump to it.</p>
        <ol class="outline">${items.join('')}</ol>
      </section>`;
  }

  /* ---------- sentence rhythm chart ---------- */

  function renderRhythm(ctx) {
    if (!ctx || ctx.sentences.length < 3 || doc().game) return '';
    const g = genre();
    const limit = { video: 20, speech: 20, copy: 18, comedy: 22 }[g.id] || 25;
    const lens = ctx.sentences.map((x) => x.words.length);
    const n = lens.length;
    const W = 360;
    const H = 72;
    const gap = n > 60 ? 1 : 2;
    const bw = Math.max(1, (W - gap * (n - 1)) / n);
    const top = Math.max(limit + 5, ...lens);
    const y = (v) => H - (v / top) * (H - 6);
    const bars = lens.map((v, i) => {
      const x = i * (bw + gap);
      const h = Math.max(2, H - y(v));
      return `<rect class="${v > limit ? 'over' : 'ok'}" x="${x.toFixed(1)}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${bw > 6 ? 2 : 0}"></rect>
        <rect class="bar-hit" x="${(x - gap / 2).toFixed(1)}" y="0" width="${(bw + gap).toFixed(1)}" height="${H}" data-sent="${i}" data-tip="Sentence ${i + 1}: ${v} words"></rect>`;
    }).join('');
    const mean = lens.reduce((a, b) => a + b, 0) / n;
    return `<details class="rhythm" id="rhythmBox" ${prefs.rhythmOpen ? 'open' : ''}>
        <summary>Sentence rhythm <span class="small muted">${n} sentences</span></summary>
        <svg class="rhythm-chart" viewBox="0 0 ${W} ${H + 2}" role="img" aria-label="Sentence lengths: shortest ${Math.min(...lens)}, longest ${Math.max(...lens)}, average ${mean.toFixed(0)} words.">
          <line class="limit" x1="0" x2="${W}" y1="${y(limit).toFixed(1)}" y2="${y(limit).toFixed(1)}"></line>
          ${bars}
        </svg>
        <p class="small muted">Each bar is one sentence, in order; taller means longer. Bars above the dashed line are over ${limit} words. Shortest ${Math.min(...lens)}, longest ${Math.max(...lens)}, average ${mean.toFixed(0)}. A good rhythm looks like a skyline, not a flat wall. Writing teacher Gary Provost made the point that same-length sentences drone; mix short and long, and prose starts to sound like music. Click a bar to find that sentence.</p>
      </details>`;
  }

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

  /* ---------- tabs ---------- */

  function setTab(side, tab) {
    if (side === 'left') prefs.leftTab = tab;
    else prefs.rightTab = tab;
    savePrefs();
    renderTabs();
  }

  function renderTabs() {
    document.querySelectorAll('#leftPanel .panel-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === prefs.leftTab)));
    document.querySelectorAll('#rightPanel .panel-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === prefs.rightTab)));
    $('pane-ideas').hidden = prefs.leftTab !== 'ideas';
    $('pane-drafts').hidden = prefs.leftTab !== 'drafts';
    $('pane-practice').hidden = prefs.leftTab !== 'practice';
    $('pane-coach').hidden = prefs.rightTab !== 'coach';
    $('pane-checks').hidden = prefs.rightTab !== 'checks';
    $('pane-frameworks').hidden = prefs.rightTab !== 'frameworks';
    $('pane-learn').hidden = prefs.rightTab !== 'learn';
    if (prefs.leftTab === 'drafts') renderDrafts();
    if (prefs.leftTab === 'practice') renderPractice();
    if (prefs.rightTab === 'coach') WP.coach.render();
    if (prefs.rightTab === 'frameworks') renderFrameworks();
    if (prefs.rightTab === 'learn') renderLearn();
  }

  /* ---------- Ideas pane ---------- */

  function buildIdea(g, keep) {
    const parts = {};
    for (const [k, list] of Object.entries(g.generator.parts)) parts[k] = keep && keep[k] ? keep[k] : pick(list);
    return parts;
  }

  function ideaText(g, parts, asHtml) {
    return g.generator.template.replace(/\{(\w+)\}/g, (_, k) =>
      asHtml ? `<span class="slot" role="button" tabindex="0" data-slot="${k}" title="Swap this part">${esc(parts[k])}</span>` : parts[k]);
  }

  function renderIdeas() {
    const g = genre();
    if (state.ideaGenre !== g.id) {
      state.ideaGenre = g.id;
      state.prompt = state.idea = state.nudge = null;
    }
    if (!state.prompt) state.prompt = pick(g.prompts);
    if (!state.idea) state.idea = buildIdea(g);
    const sprint = state.sprint;
    $('pane-ideas').innerHTML = `
      <section class="section">
        <p class="eyebrow">Your writing</p>
        <div id="progressBox"></div>
        <div class="btn-row"><button class="btn" type="button" data-act="habits">See my writing habits</button></div>
      </section>

      ${renderChallengeCard(g)}

      <section class="section">
        <p class="eyebrow">Prompt · ${esc(g.name)}</p>
        <div class="idea-card">
          <p class="idea-text">${esc(state.prompt)}</p>
          <div class="btn-row">
            <button class="btn" type="button" data-act="next-prompt">Another prompt</button>
            <button class="btn btn-primary" type="button" data-act="use-prompt">Use this</button>
          </div>
        </div>
      </section>

      <section class="section">
        <p class="eyebrow">Idea builder</p>
        <div class="idea-card">
          <p class="idea-text">${ideaText(g, state.idea, true)}</p>
          <p class="small muted">Tap any highlighted part to swap just that piece.</p>
          <div class="btn-row">
            <button class="btn" type="button" data-act="shuffle-idea">Shuffle all</button>
            <button class="btn btn-primary" type="button" data-act="use-idea">Use this</button>
          </div>
        </div>
      </section>

      <section class="section">
        <p class="eyebrow">Stuck mid-draft?</p>
        ${state.nudge ? `<div class="idea-card"><p class="idea-text">${esc(state.nudge)}</p>
          <div class="btn-row"><button class="btn" type="button" data-act="nudge">Ask another</button>
          <button class="btn" type="button" data-act="use-nudge">Add as a note</button></div></div>`
          : `<p class="small muted">Get a question that pushes the draft forward. Answer it in a sentence or two, then keep going.</p>
          <div class="btn-row"><button class="btn" type="button" data-act="nudge">Ask me a question</button></div>`}
      </section>

      <section class="section">
        <p class="eyebrow">Writing sprint</p>
        ${sprint ? `<div class="idea-card">
            <span class="sprint-clock" id="sprintClock">${fmtClock(sprint.end - Date.now())}</span>
            <p class="small muted" id="sprintWords">${Math.max(0, wordCount() - sprint.startWords)} words so far. Don’t stop, don’t edit.</p>
            <div class="btn-row"><button class="btn btn-danger" type="button" data-act="stop-sprint">Stop sprint</button></div>
          </div>`
          : `<p class="small muted">The fastest cure for a blank page: set a timer and write without stopping or deleting. Quality comes later, in the edit.</p>
          <div class="btn-row">
            ${[5, 10, 15, 25].map((m) => `<button class="btn" type="button" data-act="sprint" data-min="${m}">${m} min</button>`).join('')}
          </div>`}
        <label class="field" for="goalInput">Word goal
          <input id="goalInput" type="number" min="0" step="50" inputmode="numeric" value="${prefs.goal || ''}" placeholder="e.g. 300">
        </label>
      </section>`;
    renderProgress();
  }

  /* ---------- daily challenge ---------- */

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function todaysChallenge(g) {
    const key = dayKey();
    const h = hash(key + ':' + g.id);
    return { key, prompt: g.prompts[h % g.prompts.length], fw: g.frameworks[(h >>> 8) % g.frameworks.length], words: 100 + ((h >>> 16) % 3) * 50 };
  }

  function renderChallengeCard(g) {
    const c = todaysChallenge(g);
    const done = prefs.challenges[c.key + ':' + g.id];
    return `<section class="section">
        <p class="eyebrow">Today’s challenge · ${esc(g.name)}</p>
        <div class="idea-card challenge ${done ? 'done' : ''}">
          <p class="idea-text">${esc(c.prompt)}</p>
          <p class="small muted">Use the <b>${esc(c.fw.name)}</b> framework and write at least <b>${c.words}</b> words. A new challenge arrives tomorrow.</p>
          <div class="btn-row">
            ${done ? '<span class="drill-done">Done today ✓</span><button class="btn" type="button" data-act="challenge">Open it</button>' : '<button class="btn btn-primary" type="button" data-act="challenge">Start today’s challenge</button>'}
          </div>
        </div>
      </section>`;
  }

  function startChallenge() {
    const g = genre();
    const c = todaysChallenge(g);
    let d = state.docs.find((x) => x.challenge && x.challenge.key === c.key && x.genre === g.id);
    if (!d) {
      const outline = c.fw.structure === false
        ? c.fw.beats.map((b) => `> ${b.name}: ${b.hint}`).join('\n') + '\n\n'
        : c.fw.beats.map((b) => `## ${b.name}\n> ${b.hint}\n\n`).join('');
      d = newDoc(g.id, {
        title: `Challenge: ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`,
        framework: c.fw.id,
        text: `> Today’s challenge: ${c.prompt}\n> Write at least ${c.words} words using the ${c.fw.name} framework.\n\n${outline}`,
        challenge: { key: c.key, words: c.words },
      });
      persist(true);
    }
    openDoc(d.id);
    closeDrawers();
    const ta = $('editor');
    const firstHint = ta.value.search(/\n> (?!Today|Write at least)[^\n]*\n/);
    const pos = firstHint >= 0 ? ta.value.indexOf('\n', firstHint + 1) + 1 : ta.value.length;
    ta.focus();
    ta.setSelectionRange(pos, pos);
  }

  function checkChallenge(d, words) {
    if (!d.challenge) return;
    const id = d.challenge.key + ':' + d.genre;
    if (prefs.challenges[id] || words < d.challenge.words) return;
    prefs.challenges[id] = true;
    savePrefs();
    toast(`Challenge complete: ${words} words. Come back tomorrow for a new one.`);
    if (prefs.leftTab === 'ideas') renderIdeas();
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
    if (points.length >= 2) {
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
    analyze();
    renderDrafts();
    toast('Version restored. Your previous text was saved in History, and Ctrl+Z (⌘Z) undoes this.');
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

  const TOUR = [
    { title: 'Welcome to your writing playground', body: 'A place to practice writing with guidance. Pick a kind of writing, use a proven structure, and get feedback as you type. This tour takes 30 seconds.' },
    { target: '#genreTabs', title: '1. Pick what you’re writing', body: 'Comedy, video scripts, stories, essays, poetry, copy, speeches and screenplays. Each one has its own rules, frameworks, lessons and drafts.' },
    { target: '#leftPanel', side: 'left', title: '2. Never face a blank page', body: 'Ideas gives you prompts, a daily challenge and timed sprints. Practice has short drills that each teach one rule.' },
    { target: '#sheet', title: '3. Write, and watch the highlights', body: 'Green means you’re following a rule, amber means take a look, red means it breaks a rule. Click a highlight to see why and fix it in one click. Listen reads your draft aloud.' },
    { target: '#rightPanel', side: 'right', title: '4. Your toolkit', body: 'Checks shows your score and every rule. Frameworks gives you outlines to fill in. Coach (inside Claude) reviews your draft like an editor. Learn explains the basics.' },
    { title: 'Start small', body: 'The best first step is a five-minute win. Try one drill, or take today’s challenge.', final: true },
  ];
  let tourStep = -1;

  function startTour() {
    tourStep = 0;
    renderTour();
  }

  function endTour() {
    tourStep = -1;
    document.querySelectorAll('.tour-target').forEach((el) => el.classList.remove('tour-target'));
    $('tour').hidden = true;
    prefs.toured = true;
    savePrefs();
  }

  function renderTour() {
    document.querySelectorAll('.tour-target').forEach((el) => el.classList.remove('tour-target'));
    const step = TOUR[tourStep];
    if (!step) return endTour();
    const narrow = window.matchMedia('(max-width: 960px)').matches;
    if (step.side && !narrow) {
      if (step.side === 'left') prefs.showLeft = true;
      else prefs.showRight = true;
      prefs.focus = false;
      applyLayout();
    }
    const target = step.target && document.querySelector(step.target);
    if (target && target.offsetParent !== null && !(narrow && step.side)) target.classList.add('tour-target');
    $('tour').innerHTML = `
      <p class="eyebrow">${tourStep + 1} of ${TOUR.length}</p>
      <h3>${esc(step.title)}</h3>
      <p>${esc(step.body)}</p>
      <div class="btn-row">
        ${step.final
          ? '<button class="btn btn-primary" type="button" data-tour="drill">Try a drill</button><button class="btn" type="button" data-tour="challenge">Today’s challenge</button><button class="btn btn-quiet" type="button" data-tour="end">Just write</button>'
          : `${tourStep > 0 ? '<button class="btn btn-quiet" type="button" data-tour="back">Back</button>' : '<button class="btn btn-quiet" type="button" data-tour="end">Skip</button>'}<button class="btn btn-primary" type="button" data-tour="next">${tourStep === 0 ? 'Show me' : 'Next'}</button>`}
      </div>`;
    $('tour').hidden = false;
    $('tour').querySelector('.btn-primary').focus();
  }

  /* ---------- ask the coach ---------- */

  function askCoachAbout(m) {
    const text = $('editor').value.slice(m.start, m.end).replace(/\s+/g, ' ').trim().slice(0, 300);
    const q = `In my draft, the "${m.checkTitle}" rule flags this: "${text}". The checker says: ${m.note} Explain in simple words why this is a problem in my ${genre().name.toLowerCase()} piece, and show me two better ways to write it.`;
    hideFixCard();
    if (window.matchMedia('(max-width: 960px)').matches) {
      $('layout').classList.remove('show-left');
      $('layout').classList.add('show-right');
    } else {
      prefs.showRight = true;
      prefs.focus = false;
    }
    setTab('right', 'coach');
    applyLayout();
    WP.coach.askAbout(q);
  }

  /* ---------- Practice pane ---------- */

  function drillsFor(g) {
    return (WP.drills && WP.drills[g.id]) || [];
  }

  /* ---------- learning path ---------- */

  const pieceWords = (g) => (g.id === 'poetry' ? 40 : g.id === 'comedy' ? 100 : 150);
  const LEVEL_NAMES = ['Just starting', 'Learning', 'Learning', 'Practicing', 'Practicing', 'Almost there', 'Confident'];

  function pathSteps(g) {
    const done = new Set(prefs.drillsDone);
    return [
      { kind: 'learn', title: 'Read the basics', detail: 'Open the Learn tab and read the core principles and common mistakes.', done: !!prefs.learned[g.id] },
      ...drillsFor(g).map((x) => ({ kind: 'drill', id: x.id, title: `Drill: ${x.title}`, detail: x.task, done: done.has(x.id) })),
      { kind: 'piece', title: 'Write a full piece', detail: `A ${g.name.toLowerCase()} draft of at least ${pieceWords(g)} words that scores 75 or more.`, done: !!prefs.pieces[g.id] },
    ];
  }

  function renderPath(g) {
    const steps = pathSteps(g);
    const n = steps.filter((x) => x.done).length;
    const next = steps.find((x) => !x.done);
    const level = LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, Math.round((n / steps.length) * (LEVEL_NAMES.length - 1)))];
    return `<section class="section">
        <p class="eyebrow">Your path in ${esc(g.name)}</p>
        <div class="path-head"><span class="path-level">${esc(level)}</span><span class="small muted">${n} of ${steps.length} steps</span></div>
        <div class="path-bar" aria-hidden="true">${steps.map((x) => `<span class="${x.done ? 'done' : x === next ? 'next' : ''}"></span>`).join('')}</div>
        <ol class="path-steps">${steps.map((x, i) => `<li class="${x.done ? 'done' : x === next ? 'next' : ''}">
          <span class="path-num" aria-hidden="true">${x.done ? '✓' : i + 1}</span>
          <span class="path-text"><b>${esc(x.title)}</b>${x === next ? `<span class="small muted">${esc(x.detail)}</span>` : ''}</span>
          ${x === next ? `<button class="btn btn-primary btn-small" type="button" data-path="${i}">${x.kind === 'learn' ? 'Open Learn' : x.kind === 'drill' ? 'Start' : 'Start a draft'}</button>` : ''}
        </li>`).join('')}</ol>
        ${!next ? '<p class="small">Path complete. Keep the habit with today’s challenge, or try another genre.</p>' : ''}
      </section>`;
  }

  function runPathStep(i) {
    const g = genre();
    const step = pathSteps(g)[i];
    if (!step) return;
    if (step.kind === 'learn') {
      if (window.matchMedia('(max-width: 960px)').matches) {
        $('layout').classList.remove('show-left');
        $('layout').classList.add('show-right');
      } else prefs.showRight = true;
      prefs.focus = false;
      setTab('right', 'learn');
      applyLayout();
    } else if (step.kind === 'drill') startDrill(step.id);
    else {
      const d = newDoc(g.id, { title: `My first ${g.name.toLowerCase()} piece` });
      openDoc(d.id);
      closeDrawers();
      insertOutline(g.frameworks[0].id);
    }
  }

  function checkPiece(d, score, words) {
    const g = genreById(d.genre);
    if (prefs.pieces[g.id] || d.sample || d.drill || d.game || d.example) return;
    if (score == null || score < 75 || words < pieceWords(g)) return;
    prefs.pieces[g.id] = true;
    savePrefs();
    toast(`Path step complete: a full ${g.name.toLowerCase()} piece scoring ${score}.`);
    if (prefs.leftTab === 'practice') renderPractice();
  }

  /* ---------- warm-up games ---------- */

  function renderWarmups() {
    return `<section class="section">
        <p class="eyebrow">Warm-ups · 3 to 5 minutes</p>
        <p class="small muted">Quick writing games with one hard rule, checked as you type. A timer starts with each one. Great for getting going before real work.</p>
        <ul class="drill-list">${WP.warmups.list.map((x) => `<li class="drill">
          <button type="button" class="drill-open" data-game="${x.id}">
            <span class="drill-title">${prefs.warmups[x.id] ? '<span class="tick" aria-label="Done">✓</span>' : ''}${esc(x.title)} <span class="small muted">· ${x.minutes} min</span></span>
            <span class="drill-task">${esc(WP.warmups.rulesText(x, { words: ['three', 'random', 'words'] }))}</span>
          </button>
        </li>`).join('')}</ul>
      </section>`;
  }

  function startGame(id) {
    const game = WP.warmups.get(id);
    if (!game) return;
    const g = genre();
    const params = game.setup ? game.setup() : {};
    const d = newDoc(g.id, {
      title: `Warm-up: ${game.title}`,
      text: `> Warm-up: ${WP.warmups.rulesText(game, params)}\n> Tip: ${game.tip}\n\n`,
      game: { id, params },
    });
    persist(true);
    openDoc(d.id);
    closeDrawers();
    prefs.rightTab = 'checks';
    renderTabs();
    const ta = $('editor');
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    startSprint(game.minutes);
    $('pane-practice').scrollTop = 0;
  }

  function checkGame(d, results) {
    if (!d.game || d.game.done) return;
    const game = WP.warmups.get(d.game.id);
    if (!game || !results.length || !results.every((r) => r.status === 'pass')) return;
    d.game.done = true;
    prefs.warmups[game.id] = (prefs.warmups[game.id] || 0) + 1;
    savePrefs();
    persist();
    toast(`Warm-up complete: ${game.title}. Your brain is warm. Time for the real thing.`);
  }

  /* ---------- one thing at a time ---------- */

  function issuesInOrder(results) {
    const order = { fail: 0, warn: 1 };
    return results.filter((r) => r.status in order && r.marks.some((m) => m.level === 'bad' || m.level === 'warn'))
      .sort((a, b) => order[a.status] - order[b.status]);
  }

  function pickOneThing(results) {
    const issues = issuesInOrder(results);
    if (!issues.some((r) => r.id === state.spotlight)) state.spotlight = issues.length ? issues[0].id : null;
    if (state.spotlight) state.expanded.add(state.spotlight);
    editor.setFilters(prefs.levels, state.spotlight);
  }

  function nextOneThing() {
    const issues = issuesInOrder(state.results);
    if (!issues.length) return;
    const i = issues.findIndex((r) => r.id === state.spotlight);
    if (state.spotlight) state.expanded.delete(state.spotlight);
    state.spotlight = issues[(i + 1) % issues.length].id;
    state.expanded.add(state.spotlight);
    applyFilters();
    renderChecks();
  }

  function renderPractice() {
    const g = genre();
    const d = doc();
    const drills = drillsFor(g);
    const done = new Set(prefs.drillsDone);
    const current = d.drill && drills.find((x) => x.id === d.drill.id);
    const result = current && state.results.find((r) => r.id === current.rule);
    const doneCount = drills.filter((x) => done.has(x.id)).length;
    const game = d.game && WP.warmups.get(d.game.id);
    $('pane-practice').innerHTML = `
      ${game ? `<section class="section">
        <p class="eyebrow">Current warm-up</p>
        <div class="idea-card drill-current ${d.game.done ? 'challenge done' : ''}">
          <h3>${esc(game.title)}</h3>
          <p>${esc(WP.warmups.rulesText(game, d.game.params))}</p>
          ${state.results.map((r) => `<p class="drill-status"><span class="badge badge-${r.status}">${STATUS_LABEL[r.status]}</span> <span class="small">${esc(r.summary)}</span></p>`).join('')}
          <div class="btn-row"><button class="btn" type="button" data-game="${game.id}">Play again</button></div>
        </div>
      </section>` : ''}

      ${current ? `<section class="section">
        <p class="eyebrow">Current drill</p>
        <div class="idea-card drill-current">
          <h3>${esc(current.title)}</h3>
          <p>${esc(current.task)}</p>
          ${result ? `<p class="drill-status"><span class="badge badge-${result.status}">${STATUS_LABEL[result.status]}</span> <span class="small">${esc(result.title)}: ${esc(result.summary)}</span></p>` : ''}
          <details class="lesson"><summary>Hint</summary><p>${esc(current.hint)}</p></details>
          <div class="btn-row">
            <button class="btn" type="button" data-act="toggle-model">${state.showModel ? 'Hide model answer' : 'Show a model answer'}</button>
            ${done.has(current.id) ? '<span class="small drill-done">Done</span>' : '<button class="btn btn-primary" type="button" data-act="drill-done">Mark as done</button>'}
          </div>
          ${state.showModel ? `<pre class="fw-example">${esc(current.model)}</pre><p class="small muted">One possible answer. Yours can be different and still follow the rule.</p>` : ''}
        </div>
      </section>` : ''}
      ${renderPath(g)}
      <section class="section">
        <p class="eyebrow">${esc(g.name)} drills · ${doneCount} of ${drills.length} done</p>
        <p class="small muted">Short exercises that train one rule at a time. Each one opens a flawed passage with its check turned on. Fix it until the check says “Following”, then compare with a model answer.</p>
        <ul class="drill-list">${drills.map((x) => `<li class="drill ${current && current.id === x.id ? 'current' : ''}">
          <button type="button" class="drill-open" data-drill="${x.id}">
            <span class="drill-title">${done.has(x.id) ? '<span class="tick" aria-label="Done">✓</span>' : ''}${esc(x.title)}</span>
            <span class="drill-task">${esc(x.task)}</span>
          </button>
        </li>`).join('')}</ul>
      </section>
      ${renderWarmups()}`;
  }

  function startDrill(id, genreId) {
    const g = genreId ? genreById(genreId) : genre();
    const drill = drillsFor(g).find((x) => x.id === id);
    if (!drill) return;
    let d = state.docs.find((x) => x.drill && x.drill.id === id);
    if (!d) {
      d = newDoc(g.id, {
        title: `Drill: ${drill.title}`,
        framework: drill.framework || g.frameworks[0].id,
        text: `> Drill: ${drill.task}\n\n${drill.text}`,
        drill: { id: drill.id, rule: drill.rule, start: drill.text },
      });
    }
    state.showModel = false;
    openDoc(d.id);
    $('pane-practice').scrollTop = 0;
    state.spotlight = drill.rule;
    state.expanded.add(drill.rule);
    applyFilters();
    renderChecks();
    prefs.rightTab = 'checks';
    savePrefs();
    renderTabs();
    persist(true);
    if (window.matchMedia('(max-width: 960px)').matches) {
      $('layout').classList.remove('show-left');
      applyLayout();
    }
  }

  function checkDrill(d, results) {
    if (!d.drill || prefs.drillsDone.includes(d.drill.id)) return;
    const r = results.find((x) => x.id === d.drill.rule);
    if (r && r.status === 'pass' && !d.text.includes(d.drill.start)) {
      prefs.drillsDone.push(d.drill.id);
      savePrefs();
      toast('Drill complete: the check is green. Compare with the model answer.');
    }
  }

  function insertNote(text) {
    const ta = $('editor');
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const prefix = before && !before.endsWith('\n') ? '\n' : '';
    editor.insert(`${prefix}> ${text}\n`);
  }

  function useStarter(text) {
    const d = doc();
    if (isUntouchedSample(d)) {
      startFreshDraft();
    }
    const ta = $('editor');
    if (!ta.value.trim()) {
      ta.focus();
      ta.setSelectionRange(0, ta.value.length);
      editor.insert(`> ${text}\n\n`);
    } else {
      insertNote(text);
    }
    toast('Added to your draft as a note. Notes are ignored by the checks.');
  }

  function startFreshDraft() {
    const d = newDoc(genre().id);
    openDoc(d.id);
  }

  function wordCount() {
    return state.ctx ? state.ctx.wordCount : T.parse(doc().text).wordCount;
  }

  function fmtClock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  let sprintTimer = null;
  function startSprint(min) {
    state.sprint = { end: Date.now() + min * 60000, startWords: wordCount(), minutes: min };
    clearInterval(sprintTimer);
    sprintTimer = setInterval(tickSprint, 1000);
    renderIdeas();
    tickSprint();
    $('editor').focus();
  }

  function stopSprint(done) {
    clearInterval(sprintTimer);
    const s = state.sprint;
    state.sprint = null;
    $('statSprint').hidden = true;
    renderIdeas();
    if (s && done) toast(`Sprint done: ${Math.max(0, wordCount() - s.startWords)} words in ${s.minutes} minutes. Now take a break, then edit.`);
  }

  function tickSprint() {
    const s = state.sprint;
    if (!s) return;
    const left = s.end - Date.now();
    const words = Math.max(0, wordCount() - s.startWords);
    const clock = $('sprintClock');
    if (clock) clock.textContent = fmtClock(left);
    const w = $('sprintWords');
    if (w) w.textContent = `${words} words so far. Don’t stop, don’t edit.`;
    $('statSprint').hidden = false;
    $('statSprint').textContent = `Sprint ${fmtClock(left)} · +${words}`;
    if (left <= 0) stopSprint(true);
  }

  /* ---------- Drafts pane ---------- */

  function relTime(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return new Date(t).toLocaleDateString();
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
    const canDownload = !!downloads || !WP.ARTIFACT;
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
        ${used == null ? '' : `<div class="storage"><span class="goal-track storage-track"><span class="goal-fill ${pct > 70 ? 'warn' : ''}" style="width:${pct.toFixed(1)}%"></span></span><span class="small muted">${mb(used)} MB of about ${mb(STORAGE_TOTAL)} MB used</span></div>`}
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
      renderAll();
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
    hideFixCard();
    stopSpeaking();
    if (WP.coach) WP.coach.reset();
    renderAll();
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
    if (downloads) {
      downloads.save({ filename: name, data: body }).then(
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

  /* ---------- Checks pane ---------- */

  function renderChecks() {
    const pane = $('pane-checks');
    const scroll = pane.scrollTop;
    const results = state.results;
    const counts = { pass: 0, warn: 0, fail: 0 };
    results.forEach((r) => {
      if (r.status in counts) counts[r.status]++;
    });
    const scored = counts.pass + counts.warn + counts.fail;
    const markCounts = { good: 0, warn: 0, bad: 0, info: 0 };
    results.forEach((r) => r.marks.forEach((m) => markCounts[m.level]++));
    const g = genre();
    $('tabScore').textContent = state.score == null ? '' : state.score;

    // Issues first; what's already fine, tips and not-yet-active checks fold away below.
    const needs = results.filter((r) => r.status === 'fail' || r.status === 'warn').sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    const tips = results.filter((r) => r.status === 'info');
    const passing = results.filter((r) => r.status === 'pass');
    const waiting = results.filter((r) => r.status === 'na');
    const openIf = (list) => list.some((r) => state.expanded.has(r.id) || state.spotlight === r.id);

    const empty = !state.ctx || state.ctx.wordCount === 0;
    const spot = state.spotlight && results.find((r) => r.id === state.spotlight);

    pane.innerHTML = `
      <section class="section">
        <div class="score-head">
          <div class="score-num" aria-label="Draft score">${state.score == null ? '<span class="score-none">No score yet</span>' : `${state.score}<small>/100</small>`}</div>
          <div ${state.score == null ? 'hidden' : ''}>
            <div class="meter" aria-hidden="true">
              ${scored ? `<span class="m-pass" style="width:${(counts.pass / scored) * 100}%"></span><span class="m-warn" style="width:${(counts.warn / scored) * 100}%"></span><span class="m-fail" style="width:${(counts.fail / scored) * 100}%"></span>` : ''}
            </div>
            <div class="score-legend">
              <span><b>${counts.pass}</b> following</span><span><b>${counts.warn}</b> to improve</span><span><b>${counts.fail}</b> breaking</span>
            </div>
          </div>
        </div>
        <p class="small muted">${doc().game ? 'Checked against this warm-up’s rules only. Genre checks come back when you open a normal draft.' : empty ? `Start writing and ${esc(g.name.toLowerCase())} checks will mark your draft as you type.` : `Checked against ${esc(g.name)} rules${frameworkDef() && frameworkDef().structure !== false ? ` and the “${esc(frameworkDef().name)}” framework` : ''}. Hover a highlight to see why.`}</p>
        ${renderRhythm(state.ctx)}
        <div class="filters" role="group" aria-label="Show highlights">
          ${LEVELS.map((l) => `<button type="button" class="filter" data-level="${l.id}" aria-pressed="${prefs.levels[l.id]}"><span class="swatch swatch-${l.id}"></span>${l.label} <span class="count">${markCounts[l.id]}</span></button>`).join('')}
        </div>
        <label class="toggle"><input type="checkbox" id="oneThingToggle" ${prefs.oneThing ? 'checked' : ''}> <span><b>One thing at a time.</b> Show only the most important problem, then the next.</span></label>
        ${prefs.oneThing ? (spot ? `<div class="spotlight-bar"><span>Fix this first: ${esc(spot.title)} <span class="small">(${issuesInOrder(results).findIndex((r) => r.id === spot.id) + 1} of ${issuesInOrder(results).length})</span></span><button class="btn btn-quiet" type="button" data-act="next-thing">Next issue</button></div>` : '<div class="spotlight-bar"><span>Nothing to fix right now. Nice work.</span></div>')
          : spot ? `<div class="spotlight-bar"><span>Showing only: ${esc(spot.title)}</span><button class="btn btn-quiet" type="button" data-act="clear-spot">Show all</button></div>` : ''}
      </section>
      ${needs.length ? `<section class="section check-group">
          <p class="eyebrow">Needs work · ${needs.length}</p>
          ${needs.map(renderCheck).join('')}
        </section>` : empty ? '' : `<section class="section"><p class="all-good">Nothing to fix. Every active rule is being followed.</p></section>`}
      ${tips.length ? `<section class="section check-group">
          <p class="eyebrow">Tips · ${tips.length}</p>
          ${tips.map(renderCheck).join('')}
        </section>` : ''}
      ${passing.length ? `<section class="section check-group">
          <details class="fold" ${openIf(passing) || prefs.showPassing ? 'open' : ''} data-fold="passing">
            <summary><span class="badge badge-pass">Following</span> ${passing.length} ${passing.length === 1 ? 'rule' : 'rules'} you’re already following</summary>
            <div class="check-group">${passing.map(renderCheck).join('')}</div>
          </details>
        </section>` : ''}
      ${waiting.length ? `<section class="section">
          <details class="fold" data-fold="waiting">
            <summary><span class="badge badge-na">Waiting</span> ${waiting.length} more ${waiting.length === 1 ? 'check starts' : 'checks start'} as you write</summary>
            <ul class="waiting-list">${waiting.map((r) => `<li><b>${esc(r.title)}</b> <span class="small muted">${esc(r.summary)}</span></li>`).join('')}</ul>
          </details>
        </section>` : ''}
      ${renderMuted()}`;
    pane.scrollTop = scroll;
  }

  function renderMuted() {
    const g = genre();
    const ids = prefs.muted[g.id] || [];
    if (!ids.length || doc().game) return '';
    return `<section class="section">
        <p class="eyebrow">Turned off</p>
        <ul class="muted-list">${ids.map((id) => {
          const c = g.checks.find((x) => x.id === id);
          return c ? `<li><span>${esc(c.title)}</span><button class="btn btn-small" type="button" data-unmute="${id}">Turn back on</button></li>` : '';
        }).join('')}</ul>
      </section>`;
  }

  function setMuted(id, on) {
    const g = genre();
    const list = new Set(prefs.muted[g.id] || []);
    if (on) list.add(id);
    else list.delete(id);
    prefs.muted[g.id] = [...list];
    savePrefs();
    if (state.spotlight === id) state.spotlight = null;
    state.expanded.delete(id);
    analyze();
    applyFilters();
  }

  function renderCheck(r) {
    const open = state.expanded.has(r.id);
    const issues = r.marks.filter((m) => m.level !== 'info');
    const list = (issues.length ? issues : r.marks).slice().sort((a, b) => levelRank(b.level) - levelRank(a.level) || a.start - b.start);
    const text = doc().text;
    const fixable = r.marks.filter((m) => m.fixes && m.fixes.length);
    return `<div class="check ${state.spotlight === r.id ? 'spot' : ''}">
      <button type="button" class="check-head" data-check="${r.id}" aria-expanded="${open}">
        <span class="badge badge-${r.status}">${STATUS_LABEL[r.status]}</span>
        <span><span class="check-title">${esc(r.title)}</span><span class="check-summary">${esc(r.summary)}</span></span>
        <span class="check-count">${r.marks.length || ''}</span>
      </button>
      ${open ? `<div class="check-body">
        <p class="check-why"><b>The rule:</b> ${esc(r.why || '')}</p>
        ${doc().game ? '' : `<div class="btn-row"><button class="btn btn-quiet btn-small" type="button" data-mute="${r.id}">Turn off this check</button></div>`}
        ${fixable.length >= 2 ? `<div class="btn-row"><button class="btn" type="button" data-fix-all="${r.id}">${esc(fixable[0].fixes[0].label)}: all ${fixable.length}</button></div>` : ''}
        ${list.length ? `<ul class="hits">${list.slice(0, 14).map((m) => `
          <li class="hit hit-${m.level}">
            <button type="button" class="hit-main" data-hit="${m.start}:${m.end}">
              <span class="hit-text">${esc(snippet(text, m))}</span>
              <span class="hit-note">${esc(m.note)}</span>
            </button>
            ${m.fixes ? `<span class="hit-fixes">${m.fixes.map((f, i) => `<button type="button" class="btn btn-small" data-fix="${m.idx}:${i}">${esc(f.label)}</button>`).join('')}</span>` : ''}
          </li>`).join('')}</ul>
          ${list.length > 14 ? `<p class="small muted">+ ${list.length - 14} more highlighted in the draft.</p>` : ''}` : ''}
      </div>` : ''}
    </div>`;
  }

  function snippet(text, m) {
    const s = text.slice(m.start, m.end).replace(/\s+/g, ' ').trim();
    return s.length > 70 ? s.slice(0, 67) + '…' : s;
  }

  function applyFilters() {
    editor.setFilters(prefs.levels, state.spotlight);
  }

  /* ---------- Frameworks pane ---------- */

  function renderFrameworks() {
    const g = genre();
    const d = doc();
    const activeId = d.framework;
    if (state.openFramework == null) state.openFramework = activeId;
    const ctx = state.ctx || T.parse(d.text);
    $('pane-frameworks').innerHTML = `
      <section class="section">
        <p class="eyebrow">${esc(g.name)} frameworks</p>
        <p class="small muted">A framework is a proven shape for a piece of writing. Pick one, insert its outline, and fill each beat. The checker tracks which beats you have written.</p>
      </section>
      ${renderPlan(d)}
      ${renderOutline(ctx)}
      <section class="section">
        ${g.frameworks.map((fw) => {
          const open = state.openFramework === fw.id;
          const active = fw.id === activeId;
          const tracked = active && fw.structure !== false ? WP.checks.beatStatus(ctx, fw) : null;
          return `<div class="fw ${active ? 'active' : ''}">
            <button type="button" class="fw-head" data-fw="${fw.id}" aria-expanded="${open}">
              <span class="fw-name">${esc(fw.name)} ${active ? '<span class="fw-tag">In use</span>' : ''}</span>
              <span class="fw-summary">${esc(fw.summary)}</span>
            </button>
            ${open ? `<div class="fw-body">
              <p class="small"><b>Best for:</b> ${esc(fw.bestFor)}</p>
              <ol class="beats">${fw.beats.map((b, i) => {
                const t = tracked && tracked[i];
                const cls = t ? (t.filled ? 'done' : t.section ? 'started' : '') : '';
                const name = t && t.section ? `<button type="button" class="beat-jump" data-beat-jump="${t.section.heading.start}:${t.section.heading.end}" title="Go to this beat">${esc(b.name)}</button>` : `<b>${esc(b.name)}</b>`;
                return `<li class="beat ${cls}"><span>${name}<span>${esc(b.hint)}</span></span></li>`;
              }).join('')}</ol>
              <div class="btn-row">
                ${active ? '' : `<button class="btn btn-primary" type="button" data-fw-use="${fw.id}">Use this framework</button>`}
                <button class="btn ${active ? 'btn-primary' : ''}" type="button" data-fw-insert="${fw.id}">${fw.structure === false ? 'Insert line guide' : 'Insert outline'}</button>
                <button class="btn" type="button" data-fw-study="${fw.id}">Study the example</button>
                <button class="btn" type="button" data-fw-example="${fw.id}">Open example</button>
              </div>
              <details class="lesson"><summary>Example</summary><pre class="fw-example">${esc(fw.example)}</pre></details>
            </div>` : ''}
          </div>`;
        }).join('')}
      </section>`;
  }

  function useFramework(id) {
    const d = doc();
    d.framework = id;
    d.updated = Date.now();
    state.openFramework = id;
    persist(true);
    analyze();
    renderFrameworks();
    renderSheetMeta();
  }

  function insertOutline(id) {
    const g = genre();
    const fw = g.frameworks.find((f) => f.id === id);
    if (isUntouchedSample(doc())) startFreshDraft();
    if (doc().framework !== id) useFramework(id);
    const ta = $('editor');
    const before = ta.value.slice(0, ta.selectionStart);
    const lead = before.trim() ? (before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n') : '';
    const body = fw.structure === false
      ? fw.beats.map((b) => `> ${b.name}: ${b.hint}`).join('\n') + '\n\n'
      : fw.beats.map((b) => `## ${b.name}\n> ${b.hint}\n\n`).join('');
    editor.insert(lead + body);
    toast(`${fw.name} outline inserted. Write under each heading; the > lines are hints and can stay.`);
    if (window.matchMedia('(max-width: 960px)').matches) {
      $('layout').classList.remove('show-right');
      applyLayout();
    }
  }

  function openExample(id) {
    const g = genre();
    const fw = g.frameworks.find((f) => f.id === id);
    const d = newDoc(g.id, { example: true, title: `Example: ${fw.name}`, framework: fw.id, text: `> Example of the ${fw.name} framework. Study it, then try your own version.\n\n${fw.example}` });
    openDoc(d.id);
    toast('Example opened as a new draft. Your other drafts are in the Drafts tab.');
  }

  /* ---------- Learn pane ---------- */

  function renderLearn() {
    const g = genre();
    const gd = g.guide;
    if (!prefs.learned[g.id]) {
      prefs.learned[g.id] = true;
      savePrefs();
      if (prefs.leftTab === 'practice') setTimeout(renderPractice, 0);
    }
    $('pane-learn').innerHTML = `
      <section class="section">
        <p class="eyebrow">${esc(g.name)} basics</p>
        <p class="lead">${esc(gd.intro)}</p>
        <div class="btn-row"><button class="btn" type="button" data-act="tour">Take the tour of this page</button></div>
      </section>
      <section class="section">
        <p class="eyebrow">Core principles</p>
        <div>${gd.principles.map((p, i) => `<details class="lesson" ${i === 0 ? 'open' : ''}><summary>${esc(p.title)}</summary><p>${esc(p.body)}</p></details>`).join('')}</div>
      </section>
      <section class="section">
        <p class="eyebrow">Common beginner mistakes</p>
        <ul class="plain-list">${gd.mistakes.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      </section>
      <section class="section">
        <p class="eyebrow">Words to know</p>
        <dl class="glossary">${gd.glossary.map((x) => `<div><dt>${esc(x.term)}</dt><dd>${esc(x.def)}</dd></div>`).join('')}</dl>
      </section>
      <section class="section">
        <p class="eyebrow">Reading the highlights</p>
        <div class="legend">
          <div class="legend-row"><span class="badge badge-pass">Following</span><span>Green underline: this part follows a rule. Keep doing it.</span></div>
          <div class="legend-row"><span class="badge badge-warn">Improve</span><span>Amber wavy line: worth a second look. Sometimes it is fine on purpose.</span></div>
          <div class="legend-row"><span class="badge badge-fail">Breaking</span><span>Red wavy line: this goes against a core rule of the genre.</span></div>
          <div class="legend-row"><span class="badge badge-info">Tip</span><span>Dotted line: information, like a syllable count.</span></div>
        </div>
        <p class="small muted">The checks are rules of thumb, not laws. Professional writers break every one of them, on purpose. Learn the rule first, then decide when to break it.</p>
      </section>
      <section class="section">
        <p class="eyebrow">How the editor reads your draft</p>
        <ul class="plain-list">
          <li><code>## Heading</code> starts a section or framework beat.</li>
          <li><code>&gt; note</code> is a private note or hint. Checks ignore it.</li>
          <li><code>[B-ROLL: city at night]</code> is a cue or stage direction, not spoken text.</li>
          <li>A blank line separates paragraphs, jokes (bits) and stanzas.</li>
        </ul>
        <div class="btn-row"><button class="btn" type="button" data-act="shortcuts">Keyboard shortcuts</button></div>
      </section>`;
  }

  /* ---------- sheet + status ---------- */

  function renderSheetMeta() {
    const g = genre();
    const fw = frameworkDef();
    $('genreChip').innerHTML = WP.genres.map((x) => `<option value="${x.id}" ${x.id === g.id ? 'selected' : ''}>${esc(x.name)} rules</option>`).join('');
    $('frameworkChip').innerHTML = fw ? `<span class="tool-pill-label">Framework</span> ${esc(fw.name)}` : 'Choose a framework';
    $('frameworkChip').title = 'Open the Frameworks tab';
  }

  function renderStatusLight() {
    const words = T.count(doc().text, /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
    $('statWords').innerHTML = `<b>${words}</b> words`;
    renderGoal(words);
  }

  function renderStatus() {
    const ctx = state.ctx;
    const g = genre();
    const words = ctx.wordCount;
    $('statWords').innerHTML = `<b>${words}</b> words · ${ctx.sentences.length} sentences`;
    if (g.id === 'video' || g.id === 'comedy') {
      const secs = Math.round((words / 150) * 60);
      $('statTime').innerHTML = `<b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b> spoken`;
    } else {
      $('statTime').innerHTML = `<b>${Math.max(1, Math.round(words / 230))} min</b> read`;
    }
    if (words >= 30 && g.id !== 'poetry') {
      $('statGrade').innerHTML = `Grade <b>${T.readability(ctx).grade.toFixed(1)}</b>`;
    } else $('statGrade').textContent = '';
    renderGoal(words);
  }

  function renderGoal(words) {
    const goal = Number(prefs.goal) || 0;
    $('statGoal').hidden = !goal;
    if (!goal) return;
    const pct = Math.min(100, (words / goal) * 100);
    $('goalFill').style.width = pct + '%';
    $('goalText').innerHTML = words >= goal ? '<b>Goal reached</b>' : `<b>${words}</b> / ${goal}`;
  }

  /* ---------- fixes ---------- */

  /** Turns a fix into a concrete edit, tidying spaces and capitals around deletions. */
  function fixEdit(text, start, end, replacement) {
    if (replacement) {
      const orig = text.slice(start, end);
      const rep = /^\p{Lu}/u.test(orig) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
      return { start, end, text: rep };
    }
    let a = start;
    let b = end;
    const before = text.slice(0, a).replace(/[ \t]+$/, '');
    const atStart = !before || /[.!?…\n"“(]$/.test(before);
    if (text[b] === ',') b++;
    if (text[b] === ' ') b++;
    else if (a > 0 && text[a - 1] === ' ') a--;
    let out = '';
    if (atStart && /\p{Ll}/u.test(text[b] || '')) {
      out = text[b].toUpperCase();
      b++;
    }
    return { start: a, end: b, text: out };
  }

  function applyFix(m, fix) {
    const ta = $('editor');
    const e = fixEdit(ta.value, m.start, m.end, fix.text);
    hideFixCard();
    ta.focus();
    ta.setSelectionRange(e.start, e.end);
    editor.insert(e.text);
    analyze();
  }

  function applyAll(marks) {
    const ta = $('editor');
    const text = ta.value;
    const edits = marks.map((m) => fixEdit(text, m.start, m.end, m.fixes[0].text)).sort((x, y) => y.start - x.start);
    let out = text;
    let floor = Infinity;
    let n = 0;
    for (const e of edits) {
      if (e.end > floor) continue;
      out = out.slice(0, e.start) + e.text + out.slice(e.end);
      floor = e.start;
      n++;
    }
    ta.focus();
    ta.setSelectionRange(0, text.length);
    editor.insert(out);
    ta.setSelectionRange(0, 0);
    analyze();
    toast(`Fixed ${n} ${n === 1 ? 'spot' : 'spots'}. Press Ctrl+Z (⌘Z) to undo.`);
  }

  function showFixCard() {
    const ta = $('editor');
    const pos = ta.selectionStart;
    if (ta.selectionEnd !== pos) return hideFixCard();
    const here = editor.marksAt(pos).filter((x) => x.level !== 'info' || x.fixes);
    const m = here.filter((x) => x.fixes && x.fixes.length).sort((a, b) => levelRank(b.level) - levelRank(a.level))[0]
      || here.filter((x) => x.level !== 'good').sort((a, b) => levelRank(b.level) - levelRank(a.level))[0];
    if (!m) return hideFixCard();
    state.fixMark = m;
    const card = $('fixCard');
    card.innerHTML = `
      <p class="tip-title"><span class="swatch swatch-${m.level}"></span>${esc(m.checkTitle)}</p>
      <p>${esc(m.note)}</p>
      <div class="btn-row">
        ${(m.fixes || []).map((f, i) => `<button class="btn btn-primary" type="button" data-card-fix="${i}">${esc(f.label)}</button>`).join('')}
        ${WP.coach.isReady() ? '<button class="btn" type="button" data-card-coach>Ask the coach</button>' : ''}
        <button class="btn btn-quiet" type="button" data-card-close>Dismiss</button>
      </div>`;
    card.hidden = false;
    placeFixCard();
    $('tooltip').hidden = true;
  }

  function placeFixCard() {
    const m = state.fixMark;
    const card = $('fixCard');
    if (!m || card.hidden) return;
    const r = editor.rectAt(m.start);
    const box = $('desk').getBoundingClientRect();
    if (r.bottom < box.top || r.top > box.bottom) return hideFixCard();
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    let x = r.left;
    let y = r.bottom + 10;
    if (x + w > window.innerWidth - 12) x = window.innerWidth - w - 12;
    if (y + h > window.innerHeight - 12) y = r.top - h - 10;
    card.style.left = Math.max(12, x) + 'px';
    card.style.top = Math.max(12, y) + 'px';
  }

  function hideFixCard() {
    state.fixMark = null;
    const card = $('fixCard');
    if (card) card.hidden = true;
  }

  /* ---------- read aloud ---------- */

  const canSpeak = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

  function stopSpeaking() {
    if (canSpeak && state.speaking) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function setSpeaking(on) {
    state.speaking = on;
    const b = $('listenBtn');
    b.querySelector('.tool-label').textContent = on ? 'Stop' : 'Listen';
    b.title = on ? 'Stop reading aloud' : 'Read aloud (Ctrl/⌘+Shift+L)';
    b.setAttribute('aria-pressed', String(on));
  }

  function toggleListen() {
    if (state.speaking) return stopSpeaking();
    const ta = $('editor');
    const raw = ta.selectionEnd > ta.selectionStart ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : ta.value;
    const spoken = T.parse(raw).masked.replace(/\n\s*\n/g, '. ').replace(/\s+/g, ' ').replace(/(\.\s*){2,}/g, '. ').trim();
    if (!/[\p{L}]/u.test(spoken)) return toast('Nothing to read yet. Notes, headings and [cues] are skipped.');
    const u = new SpeechSynthesisUtterance(spoken);
    u.rate = 0.98;
    u.onend = u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
    toast(ta.selectionEnd > ta.selectionStart ? 'Reading your selection aloud.' : 'Reading your draft aloud. Listen for where you stumble.');
  }

  function closeDrawers() {
    if (window.matchMedia('(max-width: 960px)').matches) {
      $('layout').classList.remove('show-left', 'show-right');
      applyLayout();
    }
  }

  /* ---------- coach bridge ---------- */

  function findQuote(q) {
    const text = $('editor').value;
    if (!q) return null;
    const i = text.indexOf(q);
    if (i >= 0) return { start: i, end: i + q.length };
    const words = q.trim().split(/\s+/).map((w) => T.escapeRe(w.replace(/[“”"]/g, '')));
    if (!words.length) return null;
    const m = new RegExp(words.join('[\\s“”"]+'), 'i').exec(text);
    return m ? { start: m.index, end: m.index + m[0].length } : null;
  }

  const api = {
    doc: () => doc(),
    genre: () => genre(),
    frameworkDef: () => frameworkDef(),
    results: () => state.results,
    wordCount: () => wordCount(),
    currentPrompt: () => state.prompt || '',
    persist: () => persist(true),
    toast: (m) => toast(m),
    insertNote: (t) => insertNote(t),
    selection() {
      const ta = $('editor');
      return { start: ta.selectionStart, end: ta.selectionEnd, text: ta.value.slice(ta.selectionStart, ta.selectionEnd) };
    },
    replaceRange(sel, text) {
      const ta = $('editor');
      if (ta.value.slice(sel.start, sel.end) !== sel.text) {
        toast('That passage changed since you asked. Select it again and retry.');
        return false;
      }
      closeDrawers();
      ta.focus();
      ta.setSelectionRange(sel.start, sel.end);
      editor.insert(text);
      toast('Replaced. Press Ctrl+Z (⌘Z) to undo.');
      return true;
    },
    locate(q) {
      const r = findQuote(q);
      if (!r) return toast('Couldn’t find that passage. It may have changed.');
      closeDrawers();
      editor.reveal(r.start, r.end);
    },
    replaceQuote(q, rewrite) {
      const r = findQuote(q);
      if (!r) {
        toast('Couldn’t find that passage. It may have changed.');
        return false;
      }
      return api.replaceRange({ start: r.start, end: r.end, text: $('editor').value.slice(r.start, r.end) }, rewrite);
    },
  };

  /* ---------- toast ---------- */

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3200);
  }

  /* ---------- render all ---------- */

  /* ---------- blank-page starter ---------- */

  function renderStarter() {
    const d = doc();
    const box = $('starter');
    const show = !d.text.trim() && !d.game;
    box.hidden = !show;
    if (!show) return;
    const fw = frameworkDef();
    box.innerHTML = `
      <p class="starter-title">How do you want to start?</p>
      <div class="starter-grid">
        <button type="button" data-start="prompt"><b>Give me a prompt</b><span>A ready-made idea to write about</span></button>
        <button type="button" data-start="plan"><b>Plan it first</b><span>${planFor(genre()).length} quick questions about your piece</span></button>
        <button type="button" data-start="outline"><b>Use an outline</b><span>${fw ? esc(fw.name) + ': fill in each beat' : 'A proven structure to fill in'}</span></button>
        <button type="button" data-start="warmup"><b>Warm up first</b><span>A 3-minute writing game</span></button>
      </div>
      <button type="button" class="starter-skip" data-start="type">Or just start typing</button>`;
  }

  function runStarter(kind) {
    if (kind === 'prompt') {
      if (!state.prompt) state.prompt = pick(genre().prompts);
      useStarter('Prompt: ' + state.prompt);
    } else if (kind === 'plan') {
      if (window.matchMedia('(max-width: 960px)').matches) {
        $('layout').classList.remove('show-left');
        $('layout').classList.add('show-right');
      } else prefs.showRight = true;
      prefs.focus = false;
      setTab('right', 'frameworks');
      applyLayout();
      const box = $('planBox');
      if (box) {
        box.open = true;
        const first = box.querySelector('textarea');
        if (first) first.focus();
      }
    } else if (kind === 'outline') insertOutline(doc().framework);
    else if (kind === 'warmup') startGame(pick(WP.warmups.list.filter((x) => x.minutes <= 3)).id);
    else $('editor').focus();
    renderStarter();
  }

  function renderAll() {
    renderStarter();
    renderGenreTabs();
    renderSheetMeta();
    renderTabs();
    renderIdeas();
    analyze();
    applyFilters();
    if (prefs.leftTab === 'drafts') renderDrafts();
  }

  /* ---------- events ---------- */

  function bind() {
    $('genreTabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-genre]');
      if (b) setGenre(b.dataset.genre);
    });
    $('toggleLeft').addEventListener('click', () => togglePanel('left'));
    $('toggleRight').addEventListener('click', () => togglePanel('right'));
    $('focusBtn').addEventListener('click', () => {
      prefs.focus = !prefs.focus;
      savePrefs();
      applyLayout();
    });
    $('themeBtn').addEventListener('click', toggleTheme);
    $('widthBtn').addEventListener('click', () => {
      prefs.wide = !prefs.wide;
      savePrefs();
      applyLayout();
      editor.render();
    });
    $('frameworkChip').addEventListener('click', () => {
      if (window.matchMedia('(max-width: 960px)').matches) $('layout').classList.add('show-right');
      else prefs.showRight = true;
      prefs.focus = false;
      setTab('right', 'frameworks');
      applyLayout();
    });
    $('scrim').addEventListener('click', () => {
      $('layout').classList.remove('show-left', 'show-right');
      applyLayout();
    });
    window.addEventListener('resize', () => {
      applyLayout();
      fitTopbar();
      editor.render();
    });

    document.querySelectorAll('.panel-tabs').forEach((tabs) => tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      setTab(tabs.closest('.panel').id === 'leftPanel' ? 'left' : 'right', b.dataset.tab);
    }));

    $('genreChip').addEventListener('change', (e) => checkAs(e.target.value));
    $('listenBtn').hidden = !canSpeak;
    $('listenBtn').addEventListener('click', toggleListen);
    $('editor').addEventListener('click', showFixCard);
    $('editor').addEventListener('keyup', (e) => {
      if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') hideFixCard();
    });
    $('fixCard').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-card-close')) return hideFixCard();
      if (b.hasAttribute('data-card-coach') && state.fixMark) return askCoachAbout(state.fixMark);
      if (b.dataset.cardFix && state.fixMark) applyFix(state.fixMark, state.fixMark.fixes[Number(b.dataset.cardFix)]);
    });
    document.addEventListener('mousedown', (e) => {
      if (!e.target.closest('#fixCard') && e.target.id !== 'editor') hideFixCard();
    });
    $('desk').addEventListener('scroll', placeFixCard, { passive: true });

    $('displayBtn').addEventListener('click', openDisplay);
    $('modalBody').addEventListener('change', (e) => {
      const m = e.target.name && e.target.name.match(/^disp-(\w+)$/);
      if (!m) return;
      prefs.display = Object.assign({ size: 'm', spacing: 'normal', font: 'serif' }, prefs.display, { [m[1]]: e.target.value });
      savePrefs();
      applyDisplay();
    });
    $('modalBody').addEventListener('click', (e) => {
      const hd = e.target.closest('[data-habit-drill]');
      if (hd) {
        const [gid, did] = hd.dataset.habitDrill.split(':');
        closeModal();
        if (window.matchMedia('(max-width: 960px)').matches) $('layout').classList.remove('show-left', 'show-right');
        setTab('left', 'practice');
        startDrill(did, gid);
        return;
      }
      if (e.target.closest('[data-act="copy-clean"]')) {
        const text = cleanText(doc().text);
        try {
          navigator.clipboard.writeText(text).then(() => toast('Copied without notes.'), () => toast('Copy was blocked. Select the preview text and copy it.'));
        } catch (err) {
          toast('Copy was blocked. Select the preview text and copy it.');
        }
        return;
      }
      const b = e.target.closest('[data-study-insert]');
      if (!b) return;
      closeModal();
      closeDrawers();
      insertOutline(b.dataset.studyInsert);
    });
    $('pane-drafts').addEventListener('change', (e) => {
      if (e.target.id === 'importFile') importFile(e.target.files && e.target.files[0]);
      if (e.target.id === 'restoreFile') restoreBackup(e.target.files && e.target.files[0]);
    });
    $('pane-drafts').addEventListener('input', (e) => {
      if (e.target.id !== 'draftSearch') return;
      state.draftQuery = e.target.value;
      const pos = e.target.selectionStart;
      renderDrafts();
      const box = $('draftSearch');
      if (box) {
        box.focus();
        box.setSelectionRange(pos, pos);
      }
    });
    $('pane-checks').addEventListener('toggle', (e) => {
      if (e.target.id === 'rhythmBox') {
        prefs.rhythmOpen = e.target.open;
        savePrefs();
      }
    }, true);
    $('modalClose').addEventListener('click', closeModal);
    $('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') closeModal();
    });
    // Keep Tab inside the dialog while it is open.
    $('modal').addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [...$('modal').querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
    $('tour').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tour]');
      if (!b) return;
      const a = b.dataset.tour;
      if (a === 'next') {
        tourStep++;
        renderTour();
      } else if (a === 'back') {
        tourStep--;
        renderTour();
      } else if (a === 'end') endTour();
      else if (a === 'drill') {
        endTour();
        const first = drillsFor(genre())[0];
        if (window.matchMedia('(max-width: 960px)').matches) $('layout').classList.add('show-left');
        setTab('left', 'practice');
        applyLayout();
        if (first) startDrill(first.id);
      } else if (a === 'challenge') {
        endTour();
        startChallenge();
      }
    });
    $('pane-learn').addEventListener('click', (e) => {
      if (e.target.closest('[data-act="shortcuts"]')) return openShortcuts();
      if (e.target.closest('[data-act="tour"]')) {
        closeDrawers();
        startTour();
      }
    });
    const chartTip = (pane) => {
      pane.addEventListener('mousemove', (e) => {
        const hit = e.target.closest && e.target.closest('.bar-hit');
        const tip = $('tooltip');
        if (!hit) {
          if (tip.dataset.src === 'chart') tip.hidden = true;
          return;
        }
        tip.textContent = hit.dataset.tip;
        tip.dataset.src = 'chart';
        tip.hidden = false;
        const r = hit.getBoundingClientRect();
        tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 12, Math.max(12, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
        tip.style.top = Math.max(12, r.top - tip.offsetHeight - 8) + 'px';
      });
      pane.addEventListener('mouseleave', () => {
        if ($('tooltip').dataset.src === 'chart') $('tooltip').hidden = true;
      });
    };
    chartTip($('pane-drafts'));
    chartTip($('pane-checks'));

    $('pane-checks').addEventListener('change', (e) => {
      if (e.target.id !== 'oneThingToggle') return;
      prefs.oneThing = e.target.checked;
      savePrefs();
      if (!prefs.oneThing) {
        state.spotlight = null;
        state.expanded.clear();
      } else pickOneThing(state.results);
      applyFilters();
      renderChecks();
    });
    $('genreSelect').addEventListener('change', (e) => setGenre(e.target.value));
    $('pane-frameworks').addEventListener('input', (e) => {
      const key = e.target.dataset && e.target.dataset.plan;
      if (!key) return;
      const d = doc();
      d.plan = Object.assign({}, d.plan, { [key]: e.target.value });
      d.updated = Date.now();
      persist();
      const qs = planFor(genre());
      const n = qs.filter((q) => (d.plan[q.id] || '').trim()).length;
      const sum = document.querySelector('#planBox summary .small');
      if (sum) sum.textContent = `${n} of ${qs.length} answered`;
    });
    $('previewBtn').addEventListener('click', openPreview);
    $('starter').addEventListener('click', (e) => {
      const b = e.target.closest('[data-start]');
      if (b) runStarter(b.dataset.start);
      else $('editor').focus();
    });
    $('pane-checks').addEventListener('toggle', (e) => {
      if (e.target.dataset && e.target.dataset.fold === 'passing') {
        prefs.showPassing = e.target.open;
        savePrefs();
      }
    }, true);

    $('pane-practice').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.drill) startDrill(b.dataset.drill);
      else if (b.dataset.game) startGame(b.dataset.game);
      else if (b.dataset.path) runPathStep(Number(b.dataset.path));
      else if (b.dataset.act === 'toggle-model') {
        state.showModel = !state.showModel;
        renderPractice();
      } else if (b.dataset.act === 'drill-done') {
        const d = doc();
        if (d.drill && !prefs.drillsDone.includes(d.drill.id)) prefs.drillsDone.push(d.drill.id);
        savePrefs();
        renderPractice();
        toast('Drill marked as done.');
      }
    });

    $('pane-ideas').addEventListener('mousemove', (e) => {
      const hit = e.target.closest && e.target.closest('.bar-hit');
      const tip = $('tooltip');
      if (!hit) {
        if (tip.dataset.src === 'chart') tip.hidden = true;
        return;
      }
      tip.textContent = hit.dataset.tip;
      tip.dataset.src = 'chart';
      tip.hidden = false;
      const r = hit.getBoundingClientRect();
      tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 12, Math.max(12, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
      tip.style.top = Math.max(12, r.top - tip.offsetHeight - 8) + 'px';
    });
    $('pane-ideas').addEventListener('mouseleave', () => {
      if ($('tooltip').dataset.src === 'chart') $('tooltip').hidden = true;
    });
    $('docTitle').addEventListener('input', (e) => {
      const d = doc();
      d.title = e.target.value;
      d.updated = Date.now();
      persist();
    });

    $('pane-ideas').addEventListener('click', (e) => {
      const slot = e.target.closest('[data-slot]');
      const g = genre();
      if (slot) {
        const k = slot.dataset.slot;
        const options = g.generator.parts[k].filter((x) => x !== state.idea[k]);
        state.idea[k] = pick(options.length ? options : g.generator.parts[k]);
        renderIdeas();
        return;
      }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'next-prompt') {
        const options = g.prompts.filter((p) => p !== state.prompt);
        state.prompt = pick(options);
      } else if (act === 'use-prompt') useStarter('Prompt: ' + state.prompt);
      else if (act === 'shuffle-idea') state.idea = buildIdea(g);
      else if (act === 'use-idea') useStarter('Idea: ' + ideaText(g, state.idea, false));
      else if (act === 'nudge') {
        const options = g.nudges.filter((n) => n !== state.nudge);
        state.nudge = pick(options);
      } else if (act === 'use-nudge') {
        insertNote(state.nudge);
        toast('Question added as a note. Answer it on the next line.');
      } else if (act === 'challenge') return startChallenge();
      else if (act === 'habits') return openHabits();
      else if (act === 'sprint') return startSprint(Number(b.dataset.min));
      else if (act === 'stop-sprint') return stopSprint(false);
      renderIdeas();
    });
    $('pane-ideas').addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-slot]')) {
        e.preventDefault();
        const k = e.target.dataset.slot;
        e.target.click();
        const again = document.querySelector(`#pane-ideas [data-slot="${k}"]`);
        if (again) again.focus();
      }
    });
    $('pane-ideas').addEventListener('input', (e) => {
      if (e.target.id === 'goalInput') {
        prefs.goal = Math.max(0, Number(e.target.value) || 0);
        savePrefs();
        renderGoal(wordCount());
      }
    });

    $('pane-drafts').addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.open) openDoc(t.dataset.open);
      else if (t.dataset.askDelete) {
        state.confirmDelete = t.dataset.askDelete;
        renderDrafts();
      } else if (t.hasAttribute('data-cancel-delete')) {
        state.confirmDelete = null;
        renderDrafts();
      } else if (t.dataset.delete) deleteDoc(t.dataset.delete);
      else if (t.dataset.act === 'new-draft') {
        startFreshDraft();
        $('docTitle').focus();
      } else if (t.dataset.act === 'copy') copyText();
      else if (t.dataset.act === 'download') downloadText(t.dataset.ext || 'txt');
      else if (t.dataset.act === 'backup') downloadBackup();
      else if (t.dataset.act === 'improved') openImproved();
      else if (t.dataset.act === 'duplicate') duplicateDoc();
      else if (t.dataset.act === 'save-version') {
        if (pushVersion(doc(), 'Saved by you')) toast('Version saved.');
        else toast('This version is already saved. Keep writing and save again.');
        renderDrafts();
      } else if (t.dataset.compare) compareVersion(Number(t.dataset.compare));
      else if (t.dataset.restore) restoreVersion(Number(t.dataset.restore));
    });

    $('pane-checks').addEventListener('click', (e) => {
      const f = e.target.closest('[data-level]');
      if (f) {
        prefs.levels[f.dataset.level] = !prefs.levels[f.dataset.level];
        savePrefs();
        applyFilters();
        renderChecks();
        return;
      }
      const mute = e.target.closest('[data-mute]');
      if (mute) {
        setMuted(mute.dataset.mute, true);
        toast('Check turned off for this genre. Turn it back on at the bottom of the list.');
        return;
      }
      const unmute = e.target.closest('[data-unmute]');
      if (unmute) return setMuted(unmute.dataset.unmute, false);
      if (e.target.closest('[data-act="next-thing"]')) return nextOneThing();
      const sent = e.target.closest('[data-sent]');
      if (sent && state.ctx) {
        const x = state.ctx.sentences[Number(sent.dataset.sent)];
        if (x) {
          closeDrawers();
          editor.reveal(x.start, x.end);
        }
        return;
      }
      const fixBtn = e.target.closest('[data-fix]');
      if (fixBtn) {
        const [mi, fi] = fixBtn.dataset.fix.split(':').map(Number);
        const m = state.allMarks[mi];
        if (m && m.fixes) applyFix(m, m.fixes[fi]);
        return;
      }
      const fixAll = e.target.closest('[data-fix-all]');
      if (fixAll) {
        const r = state.results.find((x) => x.id === fixAll.dataset.fixAll);
        if (r) applyAll(r.marks.filter((m) => m.fixes && m.fixes.length));
        return;
      }
      const hit = e.target.closest('[data-hit]');
      if (hit) {
        const [s, en] = hit.dataset.hit.split(':').map(Number);
        if (window.matchMedia('(max-width: 960px)').matches) {
          $('layout').classList.remove('show-right');
          applyLayout();
        }
        editor.reveal(s, en);
        return;
      }
      const head = e.target.closest('[data-check]');
      if (head) {
        const id = head.dataset.check;
        if (state.expanded.has(id)) {
          state.expanded.delete(id);
          if (state.spotlight === id) state.spotlight = null;
        } else {
          state.expanded.add(id);
          const r = state.results.find((x) => x.id === id);
          state.spotlight = r && r.marks.length ? id : state.spotlight;
        }
        applyFilters();
        renderChecks();
        return;
      }
      const b = e.target.closest('[data-act="clear-spot"]');
      if (b) {
        state.spotlight = null;
        applyFilters();
        renderChecks();
      }
    });

    $('pane-frameworks').addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.beatJump) {
        const [a, b] = t.dataset.beatJump.split(':').map(Number);
        closeDrawers();
        editor.reveal(a, b);
      } else if (t.dataset.fw) {
        state.openFramework = state.openFramework === t.dataset.fw ? '' : t.dataset.fw;
        renderFrameworks();
      } else if (t.dataset.fwUse) {
        useFramework(t.dataset.fwUse);
        toast('Framework set. Insert its outline to track each beat.');
      } else if (t.dataset.fwInsert) insertOutline(t.dataset.fwInsert);
      else if (t.dataset.fwStudy) openStudy(t.dataset.fwStudy);
      else if (t.dataset.jump) {
        const [a, b] = t.dataset.jump.split(':').map(Number);
        closeDrawers();
        editor.reveal(a, b);
      }
      else if (t.dataset.fwExample) openExample(t.dataset.fwExample);
    });

    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && !e.shiftKey && k === 's') {
        e.preventDefault();
        persist(true);
        toast('Saved in this browser.');
      } else if (mod && k === '/') {
        e.preventDefault();
        openShortcuts();
      } else if (mod && k === '.') {
        e.preventDefault();
        if (!prefs.oneThing) {
          prefs.oneThing = true;
          savePrefs();
          pickOneThing(state.results);
          applyFilters();
          renderChecks();
        } else nextOneThing();
      } else if (mod && e.shiftKey && k === 'f') {
        e.preventDefault();
        prefs.focus = !prefs.focus;
        savePrefs();
        applyLayout();
      } else if (mod && e.shiftKey && k === 'l' && canSpeak) {
        e.preventDefault();
        toggleListen();
      } else if (e.key === 'Escape' && !$('modal').hidden) {
        closeModal();
      } else if (e.key === 'Escape' && tourStep >= 0) {
        endTour();
      } else if (e.key === 'Escape' && state.fixMark) {
        hideFixCard();
      } else if (e.key === 'Escape' && state.spotlight) {
        state.spotlight = null;
        applyFilters();
        renderChecks();
      }
    });
  }

  /* ---------- boot ---------- */

  function boot() {
    state.docs = (Array.isArray(state.docs) ? state.docs : []).filter((d) => d && typeof d.text === 'string');
    state.docs.forEach((d) => {
      if (!WP.genres.some((g) => g.id === d.genre)) d.genre = WP.genres[0].id;
    });
    if (!state.docs.length) sampleDoc('comedy');
    applyTheme();
    bind();
    applyDisplay();
    WP.coach.init(api);
    if (window.claude && typeof window.claude.use === 'function') {
      window.claude.use('downloads').then((d) => {
        downloads = d;
        if (prefs.leftTab === 'drafts') renderDrafts();
      }, () => {});
    }
    const first = state.docs.find((d) => d.id === prefs.lastDoc) || state.docs[0];
    openDoc(first.id);
    applyLayout();
    persist(true);
    if (!prefs.toured) setTimeout(startTour, 500);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTopbar, () => {});
  }

  boot();
})(window.WP = window.WP || {});
