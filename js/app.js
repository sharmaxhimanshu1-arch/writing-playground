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
    goal: 0,
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
  function persist(immediate) {
    clearTimeout(saveTimer);
    const run = () => {
      const ok = save(STORE_DOCS, state.docs);
      $('saveState').textContent = ok ? 'Saved in this browser' : 'Not saved: browser storage is unavailable';
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
      scheduleAnalysis();
      renderStatusLight();
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
    const { results, score } = WP.checks.run(g.checks, ctx);
    state.ctx = ctx;
    state.results = results;
    state.score = score;
    if (state.spotlight && !results.some((r) => r.id === state.spotlight)) state.spotlight = null;
    editor.setMarks(results.flatMap((r) => r.marks));
    renderChecks();
    renderStatus();
    if (prefs.rightTab === 'frameworks') renderFrameworks();
  }

  /* ---------- top bar ---------- */

  function renderGenreTabs() {
    const g = genre();
    $('genreTabs').innerHTML = WP.genres.map((x) => `
      <button type="button" class="genre-tab" data-genre="${x.id}" aria-pressed="${x.id === g.id}" title="${esc(x.tagline)}">${esc(x.name)}</button>`).join('');
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
    $('pane-checks').hidden = prefs.rightTab !== 'checks';
    $('pane-frameworks').hidden = prefs.rightTab !== 'frameworks';
    $('pane-learn').hidden = prefs.rightTab !== 'learn';
    if (prefs.leftTab === 'drafts') renderDrafts();
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
    const items = state.docs.slice().sort((a, b) => b.updated - a.updated).map((d) => {
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
    const canDownload = !WP.ARTIFACT;
    $('pane-drafts').innerHTML = `
      <section class="section">
        <div class="btn-row">
          <button class="btn btn-primary" type="button" data-act="new-draft">New ${esc(genre().name)} draft</button>
        </div>
        <ul class="draft-list">${items}</ul>
        <p class="small muted">Drafts are saved in this browser only. Copy or download anything you want to keep elsewhere.</p>
      </section>
      <section class="section">
        <p class="eyebrow">This draft</p>
        <div class="btn-row">
          <button class="btn" type="button" data-act="copy">Copy text</button>
          ${canDownload ? '<button class="btn" type="button" data-act="download">Download .txt</button>' : ''}
        </div>
      </section>`;
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
    renderAll();
    prefs.lastDoc = id;
    savePrefs();
  }

  function deleteDoc(id) {
    state.docs = state.docs.filter((d) => d.id !== id);
    state.confirmDelete = null;
    if (!state.docs.length) newDoc(genre().id);
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

  function downloadText() {
    const d = doc();
    const blob = new Blob([d.text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (d.title || 'draft').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
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

    const groups = [];
    for (const r of results) {
      let grp = groups.find((x) => x.name === r.group);
      if (!grp) groups.push((grp = { name: r.group, items: [] }));
      grp.items.push(r);
    }
    groups.forEach((grp) => grp.items.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]));

    const empty = !state.ctx || state.ctx.wordCount === 0;
    const spot = state.spotlight && results.find((r) => r.id === state.spotlight);

    pane.innerHTML = `
      <section class="section">
        <div class="score-head">
          <div class="score-num" aria-label="Draft score">${state.score == null ? '–' : state.score}<small>/100</small></div>
          <div>
            <div class="meter" aria-hidden="true">
              ${scored ? `<span class="m-pass" style="width:${(counts.pass / scored) * 100}%"></span><span class="m-warn" style="width:${(counts.warn / scored) * 100}%"></span><span class="m-fail" style="width:${(counts.fail / scored) * 100}%"></span>` : ''}
            </div>
            <div class="score-legend">
              <span><b>${counts.pass}</b> following</span><span><b>${counts.warn}</b> to improve</span><span><b>${counts.fail}</b> breaking</span>
            </div>
          </div>
        </div>
        <p class="small muted">${empty ? `Start writing and ${esc(g.name.toLowerCase())} checks will mark your draft as you type.` : `Checked against ${esc(g.name)} rules${frameworkDef() && frameworkDef().structure !== false ? ` and the “${esc(frameworkDef().name)}” framework` : ''}. Hover a highlight to see why.`}</p>
        <div class="filters" role="group" aria-label="Show highlights">
          ${LEVELS.map((l) => `<button type="button" class="filter" data-level="${l.id}" aria-pressed="${prefs.levels[l.id]}"><span class="swatch swatch-${l.id}"></span>${l.label} <span class="count">${markCounts[l.id]}</span></button>`).join('')}
        </div>
        ${spot ? `<div class="spotlight-bar"><span>Showing only: ${esc(spot.title)}</span><button class="btn btn-quiet" type="button" data-act="clear-spot">Show all</button></div>` : ''}
      </section>
      ${groups.map((grp) => `
        <section class="section check-group">
          <p class="eyebrow">${esc(grp.name)}</p>
          ${grp.items.map(renderCheck).join('')}
        </section>`).join('')}`;
    pane.scrollTop = scroll;
  }

  function renderCheck(r) {
    const open = state.expanded.has(r.id);
    const issues = r.marks.filter((m) => m.level !== 'info');
    const list = (issues.length ? issues : r.marks).slice().sort((a, b) => levelRank(b.level) - levelRank(a.level) || a.start - b.start);
    const text = doc().text;
    return `<div class="check ${state.spotlight === r.id ? 'spot' : ''}">
      <button type="button" class="check-head" data-check="${r.id}" aria-expanded="${open}">
        <span class="badge badge-${r.status}">${STATUS_LABEL[r.status]}</span>
        <span><span class="check-title">${esc(r.title)}</span><span class="check-summary">${esc(r.summary)}</span></span>
        <span class="check-count">${r.marks.length || ''}</span>
      </button>
      ${open ? `<div class="check-body">
        <p class="check-why"><b>The rule:</b> ${esc(r.why || '')}</p>
        ${list.length ? `<ul class="hits">${list.slice(0, 14).map((m) => `
          <li><button type="button" class="hit hit-${m.level}" data-hit="${m.start}:${m.end}">
            <span class="hit-text">${esc(snippet(text, m))}</span>
            <span class="hit-note">${esc(m.note)}</span>
          </button></li>`).join('')}</ul>
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
                return `<li class="beat ${cls}"><span><b>${esc(b.name)}</b><span>${esc(b.hint)}</span></span></li>`;
              }).join('')}</ol>
              <div class="btn-row">
                ${active ? '' : `<button class="btn btn-primary" type="button" data-fw-use="${fw.id}">Use this framework</button>`}
                <button class="btn ${active ? 'btn-primary' : ''}" type="button" data-fw-insert="${fw.id}">${fw.structure === false ? 'Insert line guide' : 'Insert outline'}</button>
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
    const d = newDoc(g.id, { title: `Example: ${fw.name}`, framework: fw.id, text: `> Example of the ${fw.name} framework. Study it, then try your own version.\n\n${fw.example}` });
    openDoc(d.id);
    toast('Example opened as a new draft. Your other drafts are in the Drafts tab.');
  }

  /* ---------- Learn pane ---------- */

  function renderLearn() {
    const g = genre();
    const gd = g.guide;
    $('pane-learn').innerHTML = `
      <section class="section">
        <p class="eyebrow">${esc(g.name)} basics</p>
        <p class="lead">${esc(gd.intro)}</p>
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
      </section>`;
  }

  /* ---------- sheet + status ---------- */

  function renderSheetMeta() {
    const g = genre();
    const fw = frameworkDef();
    $('genreChip').innerHTML = WP.genres.map((x) => `<option value="${x.id}" ${x.id === g.id ? 'selected' : ''}>Checked as ${esc(x.name)}</option>`).join('');
    $('frameworkChip').textContent = fw ? `Framework: ${fw.name}` : 'Choose a framework';
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

  function renderAll() {
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
      editor.render();
    });

    document.querySelectorAll('.panel-tabs').forEach((tabs) => tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      setTab(tabs.closest('.panel').id === 'leftPanel' ? 'left' : 'right', b.dataset.tab);
    }));

    $('genreChip').addEventListener('change', (e) => checkAs(e.target.value));
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
      } else if (act === 'sprint') return startSprint(Number(b.dataset.min));
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
      else if (t.dataset.act === 'download') downloadText();
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
      if (t.dataset.fw) {
        state.openFramework = state.openFramework === t.dataset.fw ? '' : t.dataset.fw;
        renderFrameworks();
      } else if (t.dataset.fwUse) {
        useFramework(t.dataset.fwUse);
        toast('Framework set. Insert its outline to track each beat.');
      } else if (t.dataset.fwInsert) insertOutline(t.dataset.fwInsert);
      else if (t.dataset.fwExample) openExample(t.dataset.fwExample);
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        persist(true);
        toast('Saved in this browser.');
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
    const first = state.docs.find((d) => d.id === prefs.lastDoc) || state.docs[0];
    openDoc(first.id);
    applyLayout();
    persist(true);
  }

  boot();
})(window.WP = window.WP || {});
