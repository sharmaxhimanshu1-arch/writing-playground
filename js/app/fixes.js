/*
 * One-click fixes and the fix card that opens when a highlight is clicked.
 */
(function (WP) {
  'use strict';

  const A = WP.app;
  const { $, editor, esc, levelRank, prefs, state, toast } = A;

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
    A.analyze();
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
    A.analyze();
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
    openFixCard(m);
  }

  /** Issues the reader can currently see, in document order. */
  function visibleIssues() {
    return state.allMarks
      .filter((m) => (m.level === 'warn' || m.level === 'bad') && prefs.levels[m.level] && (!state.spotlight || m.checkId === state.spotlight))
      .sort((a, b) => a.start - b.start || levelRank(b.level) - levelRank(a.level));
  }

  function openFixCard(m) {
    state.fixMark = m;
    const issues = visibleIssues();
    const others = issues.filter((x) => x.start !== m.start).length;
    const card = $('fixCard');
    card.innerHTML = `
      <p class="tip-title"><span class="swatch swatch-${m.level}"></span>${esc(m.checkTitle)}</p>
      <p>${esc(noteText(m))}</p>
      <div class="btn-row">
        ${(m.fixes || []).map((f, i) => `<button class="btn btn-primary" type="button" data-card-fix="${i}">${esc(f.label)}</button>`).join('')}
        ${WP.coach.isReady() ? '<button class="btn" type="button" data-card-coach>Ask the coach</button>' : ''}
        ${others ? '<button class="btn" type="button" data-card-next title="Next issue (Ctrl/⌘ + .)">Next issue ›</button>' : ''}
        <button class="btn btn-quiet" type="button" data-card-close>Dismiss</button>
      </div>`;
    card.hidden = false;
    placeFixCard();
    $('tooltip').hidden = true;
  }

  /** Moves to the next visible issue after the current card (or the caret), wrapping at the end. */
  function nextIssueCard() {
    const issues = visibleIssues();
    if (!issues.length) return hideFixCard();
    const from = state.fixMark ? state.fixMark.start : $('editor').selectionEnd;
    const next = issues.find((x) => x.start > from) || issues[0];
    editor.reveal(next.start, next.end);
    openFixCard(next);
  }

  /** A mark's note without a leading label that repeats its check's title ("Filler: …" under "Filler words"). */
  function noteText(m) {
    const lead = m.note.match(/^([A-Za-z][\w -]{1,24}):\s+/);
    if (lead && m.checkTitle && m.checkTitle.toLowerCase().startsWith(lead[1].toLowerCase())) {
      const rest = m.note.slice(lead[0].length);
      return rest.charAt(0).toUpperCase() + rest.slice(1);
    }
    return m.note;
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

  Object.assign(A, {
    fixEdit, applyFix, applyAll, showFixCard, visibleIssues, openFixCard, nextIssueCard, noteText,
    placeFixCard, hideFixCard
  });
})(window.WP = window.WP || {});
