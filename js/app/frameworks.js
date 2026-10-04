/*
 * The Frameworks panel: plan this piece, the draft outline, frameworks and studying their examples.
 */
(function (WP) {
  'use strict';

  const A = WP.app;
  const {
    $, T, doc, editor, esc, genre, genreById, isUntouchedSample, newDoc, openModal, persist,
    sectionsOf, state, toast
  } = A;

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
      <div class="btn-row">${A.canGuide(fw) ? `<button class="btn btn-primary" type="button" data-study-guide="${fw.id}">Write my own, step by step</button>` : ''}<button class="btn ${A.canGuide(fw) ? '' : 'btn-primary'}" type="button" data-study-insert="${fw.id}">Insert the outline</button></div>`);
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
                ${A.canGuide(fw) ? `<button class="btn btn-primary" type="button" data-fw-guide="${fw.id}">Write it step by step</button>` : ''}
                <button class="btn ${active && !A.canGuide(fw) ? 'btn-primary' : ''}" type="button" data-fw-insert="${fw.id}">${fw.structure === false ? 'Insert line guide' : 'Insert outline'}</button>
                <button class="btn" type="button" data-fw-study="${fw.id}">Study the example</button>
                <button class="btn" type="button" data-fw-example="${fw.id}">Open example as a draft</button>
              </div>
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
    A.analyze();
    renderFrameworks();
    A.renderSheetMeta();
  }

  function insertOutline(id) {
    const g = genre();
    const fw = g.frameworks.find((f) => f.id === id);
    if (isUntouchedSample(doc())) A.startFreshDraft();
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
      A.applyLayout();
    }
  }

  function openExample(id) {
    const g = genre();
    const fw = g.frameworks.find((f) => f.id === id);
    const d = newDoc(g.id, { example: true, title: `Example: ${fw.name}`, framework: fw.id, text: `> Example of the ${fw.name} framework. Study it, then try your own version.\n\n${fw.example}` });
    A.openDoc(d.id);
    toast('Example opened as a new draft. Your other drafts are in the Drafts tab.');
  }

  Object.assign(A, {
    planFor, renderPlan, openStudy, renderOutline, renderFrameworks, useFramework, insertOutline,
    openExample
  });
})(window.WP = window.WP || {});
