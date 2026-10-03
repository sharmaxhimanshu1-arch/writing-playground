/*
 * Highlighting editor.
 *
 * A transparent <textarea> sits on top of a "backdrop" div that renders the same text
 * with colored marks. The backdrop is in normal flow, so it sets the height; the textarea
 * stretches over it. Because both use identical font metrics and wrapping, every mark
 * lines up with the text the writer is typing.
 */
(function (WP) {
  'use strict';

  const PRIORITY = { bad: 4, warn: 3, good: 2, info: 1 };

  function esc(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  class Editor {
    constructor({ textarea, backdrop, scroller, onChange, onCaret, onHover }) {
      this.ta = textarea;
      this.bd = backdrop;
      this.scroller = scroller;
      this.onChange = onChange;
      this.onCaret = onCaret;
      this.onHover = onHover;
      this.marks = [];
      this.visibleLevels = { good: true, warn: true, bad: true, info: true };
      this.spotlight = null;
      this.prevText = this.ta.value;

      this.ta.addEventListener('input', () => this.handleInput());
      this.ta.addEventListener('scroll', () => {
        if (this.ta.scrollTop) this.ta.scrollTop = 0;
      });
      const caret = () => this.onCaret && this.onCaret(this.ta.selectionStart, this.ta.selectionEnd);
      this.ta.addEventListener('keyup', caret);
      this.ta.addEventListener('click', caret);
      this.ta.addEventListener('select', caret);
      this.ta.addEventListener('mousemove', (e) => this.handleHover(e));
      this.ta.addEventListener('mouseleave', () => this.onHover && this.onHover(null));
      this.ta.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          this.insert('\t');
        }
      });
      this.render();
    }

    get value() {
      return this.ta.value;
    }

    set value(v) {
      this.ta.value = v;
      this.prevText = v;
      this.marks = [];
      this.render();
    }

    /** Inserts text at the cursor, keeping native undo where the browser supports it. */
    insert(text, { selectInserted = false } = {}) {
      this.ta.focus();
      if (text === '' && this.ta.selectionStart === this.ta.selectionEnd) return;
      const start = this.ta.selectionStart;
      let ok = false;
      try {
        ok = text === '' ? document.execCommand('delete', false) : document.execCommand('insertText', false, text);
      } catch (e) {
        ok = false;
      }
      if (!ok) {
        this.ta.setRangeText(text, this.ta.selectionStart, this.ta.selectionEnd, 'end');
        this.handleInput();
      }
      if (selectInserted) this.ta.setSelectionRange(start, start + text.length);
    }

    handleInput() {
      const next = this.ta.value;
      this.shiftMarks(this.prevText, next);
      this.prevText = next;
      this.render({ caret: this.ta.selectionStart });
      this.keepCaretVisible();
      if (this.onChange) this.onChange(next);
    }

    /** Moves existing marks to follow an edit so highlights stay put while typing. */
    shiftMarks(prev, next) {
      if (!this.marks.length) return;
      let p = 0;
      const max = Math.min(prev.length, next.length);
      while (p < max && prev.charCodeAt(p) === next.charCodeAt(p)) p++;
      let s = 0;
      while (s < max - p && prev.charCodeAt(prev.length - 1 - s) === next.charCodeAt(next.length - 1 - s)) s++;
      const oldEnd = prev.length - s;
      const delta = next.length - prev.length;
      this.marks = this.marks.filter((m) => m.end <= p || m.start >= oldEnd).map((m) => {
        if (m.start >= oldEnd) return Object.assign({}, m, { start: m.start + delta, end: m.end + delta });
        return m;
      });
    }

    setMarks(marks) {
      this.marks = marks;
      this.render();
    }

    setFilters(levels, spotlight) {
      this.visibleLevels = levels;
      this.spotlight = spotlight;
      this.render();
    }

    shownMarks() {
      return this.marks.filter((m) => this.visibleLevels[m.level] && (!this.spotlight || m.checkId === this.spotlight));
    }

    render(opts = {}) {
      const text = this.ta.value;
      const marks = this.shownMarks().slice().sort((a, b) => a.start - b.start);
      this.rendered = marks;
      const caret = opts.caret;
      const lines = text.split('\n');
      let pos = 0;
      let mi = 0;
      const out = [];
      for (const line of lines) {
        const start = pos;
        const end = pos + line.length;
        let cls = '';
        if (/^\s*#{1,6}\s/.test(line)) cls = 'ln-h';
        else if (/^\s*>/.test(line)) cls = 'ln-note';

        while (mi < marks.length && marks[mi].end <= start) mi++;
        const lineMarks = [];
        for (let j = mi; j < marks.length && marks[j].start < end; j++) {
          if (marks[j].end > start) lineMarks.push({ m: marks[j], i: j });
        }
        const cues = [];
        if (!cls) {
          const re = /\[[^\]\n]*\]/g;
          let c;
          while ((c = re.exec(line))) cues.push({ start: start + c.index, end: start + c.index + c[0].length });
        }

        const points = new Set([start, end]);
        lineMarks.forEach(({ m }) => {
          points.add(Math.max(start, m.start));
          points.add(Math.min(end, m.end));
        });
        cues.forEach((c) => {
          points.add(c.start);
          points.add(c.end);
        });
        if (caret != null && caret >= start && caret <= end) points.add(caret);
        const sorted = [...points].sort((a, b) => a - b);

        let html = '';
        for (let k = 0; k < sorted.length; k++) {
          const a = sorted[k];
          if (caret === a) html += '<span class="caret-probe"></span>';
          const b = sorted[k + 1];
          if (b === undefined || b <= a) continue;
          const seg = esc(text.slice(a, b));
          let best = null;
          const ids = [];
          for (const { m, i } of lineMarks) {
            if (m.start <= a && m.end >= b) {
              ids.push(i);
              if (!best || PRIORITY[m.level] > PRIORITY[best.level]) best = m;
            }
          }
          const inCue = cues.some((c) => c.start <= a && c.end >= b);
          let piece = seg;
          if (best) piece = `<span class="m m-${best.level}" data-ids="${ids.join(',')}" data-start="${best.start}">${piece}</span>`;
          if (inCue) piece = `<span class="cue">${piece}</span>`;
          html += piece;
        }
        out.push(cls ? `<span class="${cls}">${html}</span>` : html);
        pos = end + 1;
      }
      // A trailing zero-width space keeps the height of a final empty line.
      this.bd.innerHTML = out.join('\n') + '\n​';
    }

    /** Screen rectangle of a text offset, measured through the backdrop. */
    rectAt(offset) {
      this.render({ caret: offset });
      const probe = this.bd.querySelector('.caret-probe');
      const r = probe ? probe.getBoundingClientRect() : this.ta.getBoundingClientRect();
      const line = parseFloat(getComputedStyle(this.bd).lineHeight) || 24;
      return { left: r.left, top: r.top, bottom: r.top + line };
    }

    keepCaretVisible() {
      const probe = this.bd.querySelector('.caret-probe');
      if (!probe || !this.scroller) return;
      const r = probe.getBoundingClientRect();
      const box = this.scroller.getBoundingClientRect();
      const pad = 80;
      if (r.bottom > box.bottom - pad) this.scroller.scrollTop += r.bottom - (box.bottom - pad);
      else if (r.top < box.top + pad) this.scroller.scrollTop -= box.top + pad - r.top;
    }

    handleHover(e) {
      if (!this.onHover) return;
      if (this.hoverFrame) return;
      this.hoverFrame = requestAnimationFrame(() => {
        this.hoverFrame = null;
        const els = document.elementsFromPoint(e.clientX, e.clientY);
        const el = els.find((x) => x.classList && x.classList.contains('m'));
        if (!el) return this.onHover(null);
        const ids = el.dataset.ids.split(',').map(Number);
        this.onHover({ marks: ids.map((i) => this.rendered[i]).filter(Boolean), x: e.clientX, y: e.clientY });
      });
    }

    marksAt(offset) {
      return this.marks.filter((m) => offset >= m.start && offset <= m.end);
    }

    /** Selects a range in the editor and scrolls it into view with a brief flash. */
    reveal(start, end) {
      this.ta.focus({ preventScroll: true });
      this.ta.setSelectionRange(start, end);
      const el = this.bd.querySelector(`.m[data-start="${start}"]`);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');
      } else {
        this.render({ caret: start });
        const probe = this.bd.querySelector('.caret-probe');
        if (probe) probe.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      if (this.onCaret) this.onCaret(start, end);
    }
  }

  WP.Editor = Editor;
  WP.esc = esc;
})(window.WP = window.WP || {});
