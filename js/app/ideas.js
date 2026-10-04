/*
 * The Ideas panel (challenge, prompts, idea builder, sprints, progress) and the blank-page starter.
 */
(function (WP) {
  'use strict';

  const A = WP.app;
  const {
    $, dayKey, doc, editor, esc, fmtClock, frameworkDef, genre, hash, insertNote, isUntouchedSample,
    newDoc, persist, pick, prefs, savePrefs, state, streak, toast, wordCount
  } = A;

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
      el.innerHTML = `<p class="small muted">Your daily word count and streak show up here once you start writing.</p>`;
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
    const build = prefs.ideaMode === 'build';
    $('pane-ideas').innerHTML = `
      ${renderChallengeCard(g)}

      <section class="section">
        <div class="eyebrow-row">
          <p class="eyebrow">Get an idea</p>
          <div class="mode-switch" role="group" aria-label="Kind of idea">
            <button type="button" data-act="idea-mode" data-mode="prompt" aria-pressed="${!build}">Prompt</button>
            <button type="button" data-act="idea-mode" data-mode="build" aria-pressed="${build}">Build one</button>
          </div>
        </div>
        ${build ? `<div class="idea-card">
          <p class="idea-text">${ideaText(g, state.idea, true)}</p>
          <p class="small muted">Tap any highlighted part to swap just that piece.</p>
          <div class="btn-row">
            <button class="btn" type="button" data-act="shuffle-idea">Shuffle all</button>
            <button class="btn btn-primary" type="button" data-act="use-idea">Use this</button>
          </div>
        </div>` : `<div class="idea-card">
          <p class="idea-text">${esc(state.prompt)}</p>
          <div class="btn-row">
            <button class="btn" type="button" data-act="next-prompt">Another prompt</button>
            <button class="btn btn-primary" type="button" data-act="use-prompt">Use this</button>
          </div>
        </div>`}
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
        <p class="eyebrow">Sprint &amp; goal</p>
        ${sprint ? `<div class="idea-card">
            <span class="sprint-clock" id="sprintClock">${fmtClock(sprint.end - Date.now())}</span>
            <p class="small muted" id="sprintWords">${Math.max(0, wordCount() - sprint.startWords)} words so far. Don’t stop, don’t edit.</p>
            <div class="btn-row"><button class="btn btn-danger" type="button" data-act="stop-sprint">Stop sprint</button></div>
          </div>`
          : `<p class="small muted">Set a timer and write without stopping or deleting. Quality comes later, in the edit.</p>
          <div class="btn-row sprint-row">
            ${[5, 10, 15, 25].map((m) => `<button class="btn" type="button" data-act="sprint" data-min="${m}">${m} min</button>`).join('')}
          </div>`}
        <label class="field" for="goalInput">Word goal
          <input id="goalInput" type="number" min="0" step="50" inputmode="numeric" value="${prefs.goal || ''}" placeholder="e.g. 300">
        </label>
      </section>

      <section class="section">
        <p class="eyebrow">Your writing</p>
        <div id="progressBox"></div>
        <div class="btn-row"><button class="btn" type="button" data-act="habits">See my writing habits</button></div>
      </section>`;
    renderProgress();
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
    A.openDoc(d.id);
    A.closeDrawers();
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
    A.openDoc(d.id);
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
        <button type="button" data-start="plan"><b>Plan it first</b><span>${A.planFor(genre()).length} quick questions about your piece</span></button>
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
      A.setTab('right', 'frameworks');
      A.applyLayout();
      const box = $('planBox');
      if (box) {
        box.open = true;
        const first = box.querySelector('textarea');
        if (first) first.focus();
      }
    } else if (kind === 'outline') A.insertOutline(doc().framework);
    else if (kind === 'warmup') A.startGame(pick(WP.warmups.list.filter((x) => x.minutes <= 3)).id);
    else $('editor').focus();
    renderStarter();
  }

  Object.assign(A, {
    renderProgress, buildIdea, ideaText, renderIdeas, todaysChallenge, renderChallengeCard,
    startChallenge, checkChallenge, useStarter, startFreshDraft, startSprint, stopSprint,
    tickSprint, renderStarter, runStarter
  });
})(window.WP = window.WP || {});
