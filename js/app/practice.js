/*
 * The Practice panel: learning path, drills and warm-up games.
 */
(function (WP) {
  'use strict';

  const A = WP.app;
  const { $, STATUS_LABEL, doc, esc, genre, genreById, newDoc, persist, prefs, savePrefs, state, toast } = A;

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
      A.setTab('right', 'learn');
      A.applyLayout();
    } else if (step.kind === 'drill') startDrill(step.id);
    else {
      const d = newDoc(g.id, { title: `My first ${g.name.toLowerCase()} piece` });
      A.openDoc(d.id);
      A.closeDrawers();
      A.insertOutline(g.frameworks[0].id);
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
        <p class="small muted">Quick games with one hard rule, checked as you type. Good for getting going before real work.</p>
        <ul class="game-grid">${WP.warmups.list.map((x) => `<li>
          <button type="button" class="game-tile ${prefs.warmups[x.id] ? 'done' : ''}" data-game="${x.id}" title="${esc(WP.warmups.rulesText(x, { words: ['three', 'random', 'words'] }))}">
            <span class="game-title">${prefs.warmups[x.id] ? '<span class="tick" aria-label="Done">✓</span>' : ''}${esc(x.title)}</span>
            <span class="game-task">${esc(x.short || x.title)}</span>
            <span class="game-min">${x.minutes} min</span>
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
    A.openDoc(d.id);
    A.closeDrawers();
    prefs.rightTab = 'checks';
    A.renderTabs();
    const ta = $('editor');
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    A.startSprint(game.minutes);
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
    A.openDoc(d.id);
    $('pane-practice').scrollTop = 0;
    state.spotlight = drill.rule;
    state.expanded.add(drill.rule);
    A.applyFilters();
    A.renderChecks();
    prefs.rightTab = 'checks';
    savePrefs();
    A.renderTabs();
    persist(true);
    if (window.matchMedia('(max-width: 960px)').matches) {
      $('layout').classList.remove('show-left');
      A.applyLayout();
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

  Object.assign(A, {
    drillsFor, pieceWords, LEVEL_NAMES, pathSteps, renderPath, runPathStep, checkPiece,
    renderWarmups, startGame, checkGame, renderPractice, startDrill, checkDrill
  });
})(window.WP = window.WP || {});
