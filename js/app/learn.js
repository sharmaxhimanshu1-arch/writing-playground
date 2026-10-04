/*
 * The Learn panel, writing habits and What improved?
 */
(function (WP) {
  'use strict';

  const A = WP.app;
  const { $, T, doc, esc, genre, genreById, openModal, prefs, realDrafts, resultsFor, savePrefs } = A;

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

  /* ---------- Learn pane ---------- */

  function renderLearn() {
    const g = genre();
    const gd = g.guide;
    if (!prefs.learned[g.id]) {
      prefs.learned[g.id] = true;
      savePrefs();
      if (prefs.leftTab === 'practice') setTimeout(A.renderPractice, 0);
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
      <section class="section" id="learnSyntax">
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

  Object.assign(A, { openHabits, openImproved, renderLearn });
})(window.WP = window.WP || {});
