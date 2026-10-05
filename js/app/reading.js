/*
 * "Read like a writer": short model pieces per genre, annotated with what they do well.
 * The reader view highlights each annotated passage and shows how the piece scores on the genre's checks.
 */
(function (WP) {
  'use strict';

  const A = WP.app;
  const { $, T, closeModal, esc, newDoc, openModal, persist, toast } = A;

  function readingsFor(g) {
    return (WP.readings && WP.readings[g.id]) || [];
  }

  function findReading(id) {
    for (const [gid, list] of Object.entries(WP.readings || {})) {
      const r = list.find((x) => x.id === id);
      if (r) return { r, g: WP.genres.find((x) => x.id === gid) };
    }
    return null;
  }

  /** How the piece does on its genre's checks, so the reader sees what a strong score looks like. */
  function scoreOf(r, g) {
    const ctx = T.parse(r.text, { framework: r.framework, genre: g.id });
    ctx.frameworkDef = g.frameworks.find((f) => f.id === r.framework) || null;
    return WP.checks.run(g.checks, ctx).score;
  }

  /** Each note's quote located in the text, in reading order, skipping any that overlap an earlier one. */
  function placeNotes(r) {
    const spots = [];
    r.notes.forEach((n) => {
      const start = r.text.indexOf(n.quote);
      if (start < 0) return;
      spots.push({ start, end: start + n.quote.length, note: n.note });
    });
    spots.sort((a, b) => a.start - b.start);
    const kept = [];
    for (const s of spots) if (!kept.length || s.start >= kept[kept.length - 1].end) kept.push(s);
    return kept;
  }

  /**
   * The piece as HTML, one line at a time so ## headings can be styled as headings.
   * A note that runs across lines becomes one mark per line; only the first carries the number.
   */
  function annotate(text, spots) {
    let offset = 0;
    return text.split('\n').map((line) => {
      const start = offset;
      offset += line.length + 1;
      const head = /^#{1,3} /.exec(line);
      const from = start + (head ? head[0].length : 0);
      const to = start + line.length;
      let out = '';
      let pos = from;
      spots.forEach((s, i) => {
        const a = Math.max(s.start, from);
        const b = Math.min(s.end, to);
        if (b <= a) return;
        out += esc(text.slice(pos, a));
        const first = s.start >= start; // the note begins on this line
        out += first
          ? `<mark class="anno" data-anno="${i}" tabindex="0" role="button" aria-label="Note ${i + 1}"><sup>${i + 1}</sup>${esc(text.slice(a, b))}</mark>`
          : `<mark class="anno" data-anno="${i}">${esc(text.slice(a, b))}</mark>`;
        pos = b;
      });
      out += esc(text.slice(pos, to));
      return head ? `<span class="reading-h">${out}</span>` : out;
    }).join('\n');
  }

  function renderReadings(g) {
    const list = readingsFor(g);
    if (!list.length) return '';
    return `<section class="section">
        <p class="eyebrow">Read like a writer</p>
        <p class="small muted">Short pieces that follow the ${esc(g.name.toLowerCase())} rules well, with notes on why each part works. Read one, then try your own.</p>
        <ul class="reading-list">${list.map((r) => `<li>
          <button type="button" class="reading-card" data-read="${r.id}">
            <span class="reading-title">${esc(r.title)}</span>
            <span class="reading-meta">${esc(r.kind)} · ${r.notes.length} notes</span>
            <span class="reading-first">${esc(r.text.replace(/^##.*\n/gm, '').split('\n').find((l) => l.trim()) || '')}</span>
          </button>
        </li>`).join('')}</ul>
      </section>`;
  }

  function openReading(id) {
    const found = findReading(id);
    if (!found) return;
    const { r, g } = found;
    const spots = placeNotes(r);
    const html = annotate(r.text, spots);
    const fw = g.frameworks.find((f) => f.id === r.framework);
    const score = scoreOf(r, g);
    openModal(r.title, `
      <p class="small muted reading-sub">${esc(r.kind)}${fw && fw.name.toLowerCase() !== r.kind.toLowerCase() ? ` · ${esc(fw.name)}` : ''} · scores <b>${score}</b> on the ${esc(g.name)} checks</p>
      <div class="reading">
        <div class="reading-text">${html}</div>
        <ol class="reading-notes">${spots.map((s, i) => `<li data-note="${i}"><button type="button" data-anno="${i}">${esc(s.note)}</button></li>`).join('')}</ol>
      </div>
      <div class="reading-try">
        <p><b>Your turn.</b> ${esc(r.tryIt)}</p>
        <div class="btn-row">
          <button class="btn btn-primary" type="button" data-read-try="${r.id}">Try your own</button>
          <button class="btn" type="button" data-read-open="${r.id}" title="See the live highlights on this piece">Open in the editor</button>
        </div>
      </div>`);
  }

  /** Lights up one annotation and its note together. */
  function focusNote(i) {
    const body = $('modalBody');
    body.querySelectorAll('.anno.active, .reading-notes li.active').forEach((el) => el.classList.remove('active'));
    const markEl = body.querySelector(`mark.anno[data-anno="${i}"]`);
    const noteEl = body.querySelector(`.reading-notes li[data-note="${i}"]`);
    if (markEl) markEl.classList.add('active');
    if (noteEl) {
      noteEl.classList.add('active');
      noteEl.scrollIntoView({ block: 'nearest' });
    }
    if (markEl) markEl.scrollIntoView({ block: 'nearest' });
  }

  /** A fresh draft in the same genre and framework, with the brief as a note. */
  function tryReading(id) {
    const found = findReading(id);
    if (!found) return;
    const { r, g } = found;
    closeModal();
    const d = newDoc(g.id, { framework: r.framework, text: `> Your turn: ${r.tryIt}\n> Model: “${r.title}” (Learn → Read like a writer)\n\n` });
    persist(true);
    A.openDoc(d.id);
    A.closeDrawers();
    const ta = $('editor');
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    toast('New draft started from the model. Write below the notes.');
  }

  /** The model piece as its own draft, so the writer can see what every check notices. */
  function openReadingDraft(id) {
    const found = findReading(id);
    if (!found) return;
    const { r, g } = found;
    closeModal();
    const d = newDoc(g.id, { example: true, framework: r.framework, title: `Model: ${r.title}`, text: `> Model piece from Read like a writer. Click the highlights to see what the checks notice.\n\n${r.text}` });
    persist(true);
    A.openDoc(d.id);
    A.closeDrawers();
    toast('Opened as a draft. Edit it freely; the original stays in Learn.');
  }

  Object.assign(A, { annotate, readingsFor, renderReadings, openReading, focusNote, tryReading, openReadingDraft, scoreOf, placeNotes });
  // Used by tests and handy from the console.
  WP.readingScore = (id) => {
    const f = findReading(id);
    return f ? scoreOf(f.r, f.g) : null;
  };
})(window.WP = window.WP || {});
