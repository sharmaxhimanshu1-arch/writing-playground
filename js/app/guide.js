/*
 * Guided write mode: walks a writer through the active framework one beat at a time.
 * A bar above the page shows the beat the caret is in, its job, an example, and how far along the piece is.
 */
(function (WP) {
  'use strict';

  const A = WP.app;
  const { $, T, doc, editor, esc, frameworkDef, isUntouchedSample, persist, prefs, sectionsOf, state, toast } = A;

  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  /** Guided mode applies to frameworks with ## beats (not line guides such as haiku). */
  function canGuide(fw) {
    return !!fw && fw.structure !== false && !!(fw.beats && fw.beats.length);
  }

  function guideOn() {
    const d = doc();
    return !!(d && d.guide && d.guide.on && canGuide(frameworkDef()) && !d.game);
  }

  function beats() {
    const ctx = state.ctx || T.parse(doc().text);
    return WP.checks.beatStatus(ctx, frameworkDef());
  }

  /** Which beat the caret is in; before the first heading counts as the first unwritten beat. */
  function currentIndex(list) {
    const pos = $('editor').selectionStart;
    const i = list.findIndex((b) => b.section && pos >= b.section.heading.start && pos <= b.section.end + 1);
    if (i >= 0) return i;
    const open = list.findIndex((b) => !b.filled);
    return open >= 0 ? open : 0;
  }

  /** The framework example's text for one beat, matched by heading name. */
  function exampleFor(fw, i) {
    const secs = sectionsOf(fw.example || '');
    if (!secs.length) return '';
    const name = norm(fw.beats[i].name);
    const sec = secs.find((x) => norm(x.title).includes(name) || name.includes(norm(x.title))) || secs[i];
    return sec ? sec.body.replace(/^>.*$/gm, '').trim() : '';
  }

  /** Moves the caret to where the writer should type for beat i, adding the heading if it is missing. */
  function gotoBeat(i) {
    const fw = frameworkDef();
    let list = beats();
    const ta = $('editor');
    if (!list[i].section) {
      const text = ta.value;
      const lead = !text.trim() ? '' : text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
      ta.focus();
      ta.setSelectionRange(text.length, text.length);
      editor.insert(`${lead}## ${fw.beats[i].name}\n> ${fw.beats[i].hint}\n\n`);
      A.analyze();
      list = beats();
    }
    const sec = list[i].section;
    if (!sec) return;
    const text = ta.value;
    const body = text.slice(sec.start, sec.end);
    let pos = sec.start + body.replace(/\s+$/, '').length;
    // Land on a fresh line rather than at the end of a > hint line or the heading itself.
    const lastLine = text.slice(text.lastIndexOf('\n', pos - 1) + 1, pos);
    if (/^\s*(>|##)/.test(lastLine) || pos <= sec.start) {
      ta.focus();
      ta.setSelectionRange(pos, pos);
      editor.insert('\n');
      pos += 1;
    }
    editor.reveal(pos, pos);
    state.guideExample = false;
    renderGuide();
  }

  /** Turns guided mode on for a framework: a fresh draft if needed, the outline, and the caret in the first beat. */
  function startGuide(fwId) {
    if (fwId && isUntouchedSample(doc())) A.startFreshDraft();
    if (fwId && doc().framework !== fwId) A.useFramework(fwId);
    const fw = frameworkDef();
    if (!canGuide(fw)) return toast('This framework is a line guide, so there are no beats to step through.');
    const d = doc();
    d.guide = { on: true };
    persist(true);
    A.closeDrawers();
    A.analyze();
    const list = beats();
    if (!list.some((b) => b.section)) {
      const ta = $('editor');
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      const text = ta.value;
      const lead = !text.trim() ? '' : text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
      editor.insert(lead + fw.beats.map((b) => `## ${b.name}\n> ${b.hint}\n\n`).join(''));
      A.analyze();
    }
    const open = beats().findIndex((b) => !b.filled);
    gotoBeat(open >= 0 ? open : 0);
    toast('Guided mode on. Write under the heading, then press Next beat.');
  }

  function stopGuide() {
    const d = doc();
    d.guide = null;
    persist(true);
    renderGuide();
    toast('Guide closed. Your writing stays as it is. Turn it back on from the Frameworks tab.');
  }

  function renderGuide() {
    const bar = $('guide');
    if (!bar) return;
    if (!guideOn()) {
      bar.hidden = true;
      bar.innerHTML = '';
      return;
    }
    const fw = frameworkDef();
    const list = beats();
    const i = currentIndex(list);
    state.guideIndex = i;
    const b = list[i];
    const done = list.filter((x) => x.filled).length;
    const all = done === list.length;
    const min = b.beat.min ?? fw.minWordsPerBeat ?? 12;
    const example = state.guideExample ? exampleFor(fw, i) : '';
    bar.hidden = false;
    bar.innerHTML = `
      <div class="guide-top">
        <p class="guide-step">Beat ${i + 1} of ${list.length} · <span class="guide-fw">${esc(fw.name)}</span></p>
        <ol class="guide-dots" aria-label="Beats">${list.map((x, j) => `<li><button type="button" class="guide-dot ${x.filled ? 'done' : x.words ? 'started' : ''} ${j === i ? 'current' : ''}" data-guide-beat="${j}" title="${esc(x.beat.name)}${x.filled ? ' (written)' : ''}" aria-label="Beat ${j + 1}: ${esc(x.beat.name)}${x.filled ? ', written' : ''}"${j === i ? ' aria-current="step"' : ''}></button></li>`).join('')}</ol>
        <button type="button" class="guide-close" data-guide="exit" aria-label="Close the guide" title="Close the guide">×</button>
      </div>
      <h2 class="guide-beat">${esc(b.beat.name)}</h2>
      <p class="guide-hint">${esc(b.beat.hint)}</p>
      ${example ? `<blockquote class="guide-example"><span class="eyebrow">In the example</span>${esc(example)}</blockquote>` : ''}
      <div class="guide-foot">
        <span class="guide-progress" aria-live="polite">${all ? `<b>All ${list.length} beats written.</b> Now revise: fix what the checks flag.` : b.filled ? `<b>✓ This beat is on the page</b> (${b.words} words).` : `${b.words} of about ${min} words`}</span>
        <span class="btn-row">
          ${i > 0 ? '<button class="btn btn-quiet btn-small" type="button" data-guide="back">‹ Back</button>' : ''}
          ${fw.example ? `<button class="btn btn-quiet btn-small" type="button" data-guide="example" aria-pressed="${!!state.guideExample}">${state.guideExample ? 'Hide example' : 'Show example'}</button>` : ''}
          ${all ? '<button class="btn btn-primary btn-small" type="button" data-guide="checks">Open Checks</button>'
            : i < list.length - 1 ? `<button class="btn ${b.filled ? 'btn-primary' : ''} btn-small" type="button" data-guide="next">Next beat ›</button>` : ''}
        </span>
      </div>`;
  }

  /** Called on every caret move: redraws the bar only when the caret crosses into another beat. */
  function syncGuide() {
    if (!guideOn()) return;
    const i = currentIndex(beats());
    if (i !== state.guideIndex) {
      state.guideExample = false;
      renderGuide();
    }
  }

  function guideAction(act, beat) {
    const list = beats();
    const i = currentIndex(list);
    if (act === 'next') gotoBeat(Math.min(list.length - 1, i + 1));
    else if (act === 'back') gotoBeat(Math.max(0, i - 1));
    else if (act === 'beat') gotoBeat(beat);
    else if (act === 'example') {
      state.guideExample = !state.guideExample;
      renderGuide();
    } else if (act === 'exit') stopGuide();
    else if (act === 'checks') {
      if (window.matchMedia('(max-width: 960px)').matches) $('layout').classList.add('show-right');
      else prefs.showRight = true;
      prefs.focus = false;
      A.setTab('right', 'checks');
      A.applyLayout();
    }
  }

  Object.assign(A, { canGuide, guideOn, startGuide, stopGuide, renderGuide, syncGuide, guideAction });
})(window.WP = window.WP || {});
