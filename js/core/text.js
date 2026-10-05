/*
 * Text analysis core.
 *
 * Turns a raw draft into a context object that every check reads from.
 * Offsets always point into the original text so marks line up with the editor.
 *
 * Draft conventions understood by the parser:
 *   ## Heading      section / framework beat (not analysed as prose)
 *   > note          writer's note or hint (ignored by checks)
 *   [B-ROLL: ...]   cue / stage direction (ignored as prose, counted as a cue)
 */
(function (WP) {
  'use strict';

  const ABBREVIATIONS = new Set([
    'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'e.g', 'i.e',
    'approx', 'dept', 'est', 'fig', 'inc', 'ltd', 'no', 'vol', 'mt', 'ft', 'u.s',
  ]);

  const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}\p{M}'’-]*/gu;

  function blankOut(chars, start, end) {
    for (let i = start; i < end; i++) if (chars[i] !== '\n') chars[i] = ' ';
  }

  function parse(text, opts) {
    opts = opts || {};
    const chars = text.split('');
    const lines = [];
    const headings = [];
    const cues = [];

    let pos = 0;
    for (const raw of text.split('\n')) {
      const start = pos;
      const end = pos + raw.length;
      let kind = 'prose';
      if (/^\s*$/.test(raw)) kind = 'blank';
      else if (/^\s*#{1,6}\s/.test(raw)) kind = 'heading';
      else if (/^\s*>/.test(raw)) kind = 'note';
      const line = { start, end, text: raw, kind, index: lines.length };
      lines.push(line);
      if (kind === 'heading' || kind === 'note') blankOut(chars, start, end);
      if (kind === 'heading') {
        const m = raw.match(/^\s*(#{1,6})\s+(.*)$/);
        headings.push({ start, end, level: m[1].length, title: m[2].trim(), line: line.index });
      }
      pos = end + 1;
    }

    // [cues] inside prose lines
    const cueRe = /\[[^\]\n]*\]/g;
    let m;
    while ((m = cueRe.exec(text))) {
      const line = lineAtOffset(lines, m.index);
      if (line && line.kind === 'prose') {
        cues.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
        blankOut(chars, m.index, m.index + m[0].length);
      }
    }

    const masked = chars.join('');

    // A prose line that is empty once cues are removed is a cue-only line.
    for (const line of lines) {
      if (line.kind === 'prose' && !/\S/.test(masked.slice(line.start, line.end))) line.kind = 'cue';
    }

    // Paragraphs: runs of prose lines.
    const paragraphs = [];
    let cur = null;
    for (const line of lines) {
      if (line.kind === 'prose') {
        if (!cur) cur = { start: line.start, end: line.end, lines: [] };
        cur.end = line.end;
        cur.lines.push(line);
      } else if (cur) {
        paragraphs.push(cur);
        cur = null;
      }
    }
    if (cur) paragraphs.push(cur);

    const sentences = [];
    const words = [];
    paragraphs.forEach((p, pi) => {
      p.index = pi;
      p.text = masked.slice(p.start, p.end);
      p.sentences = [];
      splitSentences(masked, p.start, p.end, (s, e) => {
        const sentence = { start: s, end: e, text: masked.slice(s, e), paragraph: pi, index: sentences.length, words: [] };
        WORD_RE.lastIndex = 0;
        let wm;
        while ((wm = WORD_RE.exec(sentence.text))) {
          const clean = wm[0].replace(/['’-]+$/, '');
          const w = {
            start: s + wm.index,
            end: s + wm.index + clean.length,
            text: clean,
            lower: clean.toLowerCase().replace(/’/g, "'"),
            sentence: sentence.index,
            paragraph: pi,
            index: words.length,
          };
          sentence.words.push(w);
          words.push(w);
        }
        if (sentence.words.length) {
          sentences.push(sentence);
          p.sentences.push(sentence);
        }
      });
      p.words = words.filter((w) => w.paragraph === pi);
    });

    let syllableTotal = 0;
    for (const w of words) {
      w.syllables = syllables(w.text);
      syllableTotal += w.syllables;
    }

    return {
      text,
      masked,
      lines,
      headings,
      cues,
      paragraphs,
      sentences,
      words,
      wordCount: words.length,
      syllableTotal,
      framework: opts.framework || null,
      genre: opts.genre || null,
    };
  }

  function splitSentences(masked, from, to, emit) {
    let s = from;
    const push = (a, b) => {
      while (a < b && /\s/.test(masked[a])) a++;
      while (b > a && /\s/.test(masked[b - 1])) b--;
      if (b > a && /[\p{L}\p{N}]/u.test(masked.slice(a, b))) emit(a, b);
    };
    for (let i = from; i < to; i++) {
      const c = masked[i];
      if (c === '\n') {
        push(s, i);
        s = i + 1;
        continue;
      }
      if (c === '.' || c === '!' || c === '?' || c === '…') {
        let j = i + 1;
        while (j < to && /[.!?…"'”’)\]]/.test(masked[j])) j++;
        if (j >= to || /\s/.test(masked[j])) {
          if (c === '.') {
            const before = masked.slice(s, i).match(/([\p{L}.]+)$/u);
            if (before && ABBREVIATIONS.has(before[1].toLowerCase())) {
              i = j - 1;
              continue;
            }
          }
          push(s, j);
          s = j;
        }
        i = j - 1;
      }
    }
    push(s, to);
  }

  function lineAtOffset(lines, offset) {
    let lo = 0;
    let hi = lines.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const l = lines[mid];
      if (offset < l.start) hi = mid - 1;
      else if (offset > l.end) lo = mid + 1;
      else return l;
    }
    return null;
  }

  const SYLLABLE_OVERRIDES = {
    the: 1, every: 2, everything: 3, everyone: 3, different: 3, family: 3, evening: 2,
    business: 2, chocolate: 3, interesting: 3, beautiful: 3, poem: 2, poet: 2, poetry: 3,
    quiet: 2, science: 2, people: 2, little: 2, idea: 3, area: 3, real: 1, really: 2,
    being: 2, create: 2, fire: 1, hour: 1, our: 1, flower: 2, power: 2, heaven: 2,
    lion: 2, radio: 3, video: 3, piano: 3, violin: 3, ocean: 2, naive: 2, cruel: 2,
    fuel: 2, going: 2, doing: 2, seeing: 2, saying: 2, toward: 2, towards: 2,
    wednesday: 2, comfortable: 3, vegetable: 3, giant: 2, million: 2, onion: 2, union: 2, temperature: 4, usually: 4, actually: 4,
  };

  /** Estimated English syllable count for a single word. */
  function syllables(word) {
    let w = String(word).toLowerCase().replace(/’/g, "'").replace(/[^a-z']/g, '').replace(/'s$/, '').replace(/'/g, '');
    if (!w) return /\d/.test(word) ? String(word).replace(/\D/g, '').length : 0;
    if (SYLLABLE_OVERRIDES[w]) return SYLLABLE_OVERRIDES[w];
    if (w.length <= 3) return 1;
    // A final "es" is silent (makes, hopes) except after s, x, z, ch, sh, ce and ge (loses, boxes, wishes, pages).
    if (/(?:[sxz]|[cs]h|[cg])es$/.test(w)) w = w.replace(/es$/, 'is');
    else w = w.replace(/(?:[^laeiouy]es|[^laeiouytd]ed|[^laeiouy]e)$/, '');
    w = w.replace(/^y/, '');
    const groups = w.match(/[aeiouy]{1,2}/g);
    let n = groups ? groups.length : 1;
    // Split vowel pairs that are usually two syllables (radiator, piano, radio).
    n += (w.match(/[^cgst]ia|[^cgstnl]io|eo(?!u)|(?<![qg])ua(?!r)/g) || []).length;
    if (/[^aeiou]le$/.test(word.toLowerCase()) && n === 0) n = 1;
    return Math.max(1, n);
  }

  function readability(ctx) {
    const s = Math.max(1, ctx.sentences.length);
    const w = Math.max(1, ctx.wordCount);
    const wps = w / s;
    const spw = ctx.syllableTotal / w;
    return {
      wordsPerSentence: wps,
      ease: 206.835 - 1.015 * wps - 84.6 * spw,
      grade: Math.max(0, 0.39 * wps + 11.8 * spw - 15.59),
    };
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Build a case-insensitive whole-word regex from a list of phrases. */
  function phraseRegex(list) {
    const parts = list
      .slice()
      .sort((a, b) => b.length - a.length)
      .map((p) => escapeRe(p).replace(/\s+/g, '\\s+').replace(/'/g, "['’]"));
    return new RegExp('(?<![\\p{L}\\p{N}\'’])(?:' + parts.join('|') + ')(?![\\p{L}\\p{N}])', 'giu');
  }

  /** Like phraseRegex, but single words also match -s, -es, -ed, -d and -ing forms. */
  function formsRegex(list) {
    const parts = list
      .slice()
      .sort((a, b) => b.length - a.length)
      .map((p) => escapeRe(p).replace(/\s+/g, '\\s+').replace(/'/g, "['’]") + (/\s/.test(p) ? '' : '(?:s|es|ed|d|ing)?'));
    return new RegExp('(?<![\\p{L}\\p{N}\'’])(?:' + parts.join('|') + ')(?![\\p{L}\\p{N}])', 'giu');
  }

  /** All matches of a regex in the prose (masked) text. */
  function findAll(ctx, re, range) {
    const out = [];
    const src = range ? ctx.masked.slice(range.start, range.end) : ctx.masked;
    const base = range ? range.start : 0;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      out.push({ start: base + m.index, end: base + m.index + m[0].length, text: m[0], groups: m });
      if (!re.global) break;
    }
    return out;
  }

  function sentenceAt(ctx, offset) {
    return ctx.sentences.find((s) => offset >= s.start && offset <= s.end) || null;
  }

  /** Lines that carry prose (used by poetry and scripts). */
  function proseLines(ctx) {
    return ctx.lines.filter((l) => l.kind === 'prose').map((l) => {
      const maskedLine = ctx.masked.slice(l.start, l.end);
      const words = ctx.words.filter((w) => w.start >= l.start && w.end <= l.end);
      return Object.assign({}, l, { masked: maskedLine, words });
    });
  }

  /** Sections delimited by headings, with their prose word counts. */
  function sections(ctx) {
    const out = [];
    ctx.headings.forEach((h, i) => {
      const next = ctx.headings[i + 1];
      const start = h.end + 1;
      const end = next ? next.start - 1 : ctx.text.length;
      const words = ctx.words.filter((w) => w.start >= start && w.end <= end);
      out.push({ heading: h, start, end: Math.max(start, end), words: words.length });
    });
    return out;
  }

  function count(text, re) {
    const m = text.match(re);
    return m ? m.length : 0;
  }

  WP.text = {
    parse,
    syllables,
    readability,
    phraseRegex,
    formsRegex,
    findAll,
    sentenceAt,
    proseLines,
    sections,
    lineAtOffset,
    count,
    escapeRe,
  };
})(window.WP = window.WP || {});
