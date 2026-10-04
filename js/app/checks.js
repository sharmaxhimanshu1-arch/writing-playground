/*
 * Running the checks on the draft and the Checks panel: score, highlight filters, rule cards, sentence rhythm, one thing at a time.
 */
(function (WP) {
  'use strict';

  const A = WP.app;
  const {
    $, LEVELS, STATUS_LABEL, STATUS_ORDER, T, doc, editor, esc, frameworkDef, genre, levelRank,
    prefs, savePrefs, state, trackWords
  } = A;

  let analysisTimer = null;
  function scheduleAnalysis() {
    clearTimeout(analysisTimer);
    analysisTimer = setTimeout(analyze, 350);
  }

  function updateCursorNote(pos) {
    const ta = $('editor');
    const at = pos == null ? ta.selectionStart : pos;
    const note = document.activeElement === ta || pos != null
      ? editor.marksAt(at).sort((a, b) => levelRank(b.level) - levelRank(a.level))[0]
      : null;
    $('cursorNote').innerHTML = note ? `<b>${esc(note.checkTitle)}:</b> ${esc(A.noteText(note))}` : '';
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
    const { results, score } = WP.checks.run(checks, ctx, { force, ignore: A.ignoredIn(d) });
    // Show how an edit moved the score, but not when opening a draft or switching genre.
    const same = state.scoreKey === d.id + ':' + g.id + ':' + (d.framework || '');
    state.scoreDelta = same && state.score != null && score != null && score !== state.score ? { v: score - state.score, at: Date.now() } : state.scoreDelta;
    state.scoreKey = d.id + ':' + g.id + ':' + (d.framework || '');
    state.ctx = ctx;
    state.results = results;
    state.score = score;
    state.allMarks = results.flatMap((r) => r.marks);
    state.allMarks.forEach((m, i) => (m.idx = i));
    if (state.spotlight && !results.some((r) => r.id === state.spotlight)) state.spotlight = null;
    editor.setMarks(state.allMarks);
    updateCursorNote();
    trackWords(d.id, ctx.wordCount);
    A.checkDrill(d, results);
    A.checkChallenge(d, ctx.wordCount);
    A.checkGame(d, results);
    A.checkPiece(d, score, ctx.wordCount);
    if (prefs.oneThing) pickOneThing(results);
    A.autoVersion(d, score, ctx.wordCount);
    renderChecks();
    A.renderStatus();
    if (prefs.rightTab === 'frameworks') A.renderFrameworks();
    if (prefs.leftTab === 'practice') A.renderPractice();
    A.renderGuide();
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
    $('railScore').textContent = state.score == null ? '' : state.score;
    $('railScore').className = 'rail-score' + (state.score == null ? '' : state.score >= 75 ? ' good' : state.score >= 50 ? ' ok' : ' low');
    $('rail-checks').title = state.score == null ? 'Checks' : `Checks: score ${state.score}, ${needsCount(results)} to fix`;

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
          <div class="score-num" aria-label="Draft score">${state.score == null ? '<span class="score-none">No score yet</span>' : `${state.score}<small>/100</small>${renderDelta()}`}</div>
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
        ${empty ? '' : `<div class="filters" role="group" aria-label="Show highlights">
          <span class="filters-label">Highlights</span>
          ${LEVELS.filter((l) => markCounts[l.id] || !prefs.levels[l.id]).map((l) => `<button type="button" class="filter" data-level="${l.id}" aria-pressed="${prefs.levels[l.id]}"><span class="swatch swatch-${l.id}"></span>${l.label} <span class="count">${markCounts[l.id]}</span></button>`).join('')}
        </div>`}
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
      ${(() => { const r = empty ? '' : renderRhythm(state.ctx); return r ? `<section class="section">${r}</section>` : ''; })()}
      ${renderIgnored()}
      ${renderMuted()}`;
    pane.scrollTop = scroll;
  }

  function renderDelta() {
    const dl = state.scoreDelta;
    if (!dl || Date.now() - dl.at > 2400) return '';
    clearTimeout(state.deltaTimer);
    state.deltaTimer = setTimeout(() => {
      const el = document.querySelector('.score-delta');
      if (el) el.remove();
    }, 2400 - (Date.now() - dl.at));
    return `<span class="score-delta ${dl.v > 0 ? 'up' : 'down'}" aria-hidden="true">${dl.v > 0 ? '+' : '−'}${Math.abs(dl.v)}</span>`;
  }

  function needsCount(results) {
    return results.filter((r) => r.status === 'fail' || r.status === 'warn').length;
  }

  /** Highlights dismissed as intentional in this draft, each with a way back. */
  function renderIgnored() {
    const d = doc();
    const list = A.ignoredIn(d);
    if (!list.length) return '';
    return `<section class="section">
        <details class="fold" data-fold="ignored">
          <summary><span class="badge badge-na">Intentional</span> ${list.length} ${list.length === 1 ? 'highlight' : 'highlights'} you kept on purpose</summary>
          <ul class="muted-list">${list.map((x, i) => `<li><span><b>${esc(x.title || x.check)}</b> <span class="small muted">“${esc(x.text.length > 50 ? x.text.slice(0, 48) + '…' : x.text)}”</span></span><button class="btn btn-small" type="button" data-unignore="${i}">Check it again</button></li>`).join('')}</ul>
        </details>
      </section>`;
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
              <span class="hit-note">${esc(A.noteText(m))}</span>
            </button>
            ${m.fixes || A.canIgnore(m) ? `<span class="hit-fixes">${(m.fixes || []).map((f, i) => `<button type="button" class="btn btn-small" data-fix="${m.idx}:${i}">${esc(f.label)}</button>`).join('')}${A.canIgnore(m) ? `<button type="button" class="btn btn-quiet btn-small" data-ignore="${m.idx}" title="Stop flagging these words for this rule, in this draft only">Intentional</button>` : ''}</span>` : ''}
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

  Object.assign(A, {
    scheduleAnalysis, updateCursorNote, analyze, renderRhythm, issuesInOrder, pickOneThing,
    nextOneThing, renderChecks, renderDelta, needsCount, renderMuted, setMuted, renderCheck,
    snippet, applyFilters
  });
})(window.WP = window.WP || {});
