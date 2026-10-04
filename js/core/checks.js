/*
 * Check framework + checks shared across genres.
 *
 * A check is { id, title, group, why, minWords?, run(ctx) }.
 * run() returns { status, summary, tip?, marks[] } or null to hide itself.
 *   status: 'pass' | 'warn' | 'fail' | 'info' | 'na'
 *   mark:   { start, end, level: 'good'|'warn'|'bad'|'info', note }
 */
(function (WP) {
  'use strict';
  const T = WP.text;
  const lex = WP.lex;

  function mark(range, level, note) {
    return { start: range.start, end: range.end, level, note };
  }

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many || one + 's');
  }

  function per100(n, ctx) {
    return (n / Math.max(1, ctx.wordCount)) * 100;
  }

  /** pass when value <= ok, warn when <= warn, otherwise fail. */
  function band(value, ok, warn) {
    return value <= ok ? 'pass' : value <= warn ? 'warn' : 'fail';
  }

  function quote(s) {
    return '“' + s.replace(/\s+/g, ' ').trim() + '”';
  }

  function toGlobal(re) {
    return new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  }

  /** A fix replaces the mark's text. An empty `text` deletes it (the app tidies spaces). */
  const DELETE = { label: 'Delete it', text: '' };

  const C = {};

  /** Generic “find these phrases” check. */
  C.phrases = function (o) {
    return {
      id: o.id,
      title: o.title,
      group: o.group || 'Style',
      why: o.why,
      minWords: o.minWords,
      run(ctx) {
        const re = o.re ? toGlobal(o.re) : T.phraseRegex(o.list);
        let hits = T.findAll(ctx, re, o.range ? o.range(ctx) : null);
        if (o.filter) hits = hits.filter((h) => o.filter(h, ctx));
        const res = o.grade(hits.length, ctx, hits) || null;
        if (!res) return null;
        const note = typeof o.note === 'function' ? o.note : () => o.note;
        res.marks = (res.marks || []).concat(hits.map((h) => {
          const m = mark(h, o.level, note(h, ctx));
          const fixes = typeof o.fixes === 'function' ? o.fixes(h, ctx) : o.fixes;
          if (fixes && fixes.length) m.fixes = fixes;
          return m;
        }));
        return res;
      },
    };
  };

  /** Matches "very tired", "really big"… where one stronger word exists. */
  function intensifierRegex() {
    return new RegExp('\\b(' + lex.intensifiers.join('|') + ')\\s+(' + Object.keys(lex.strongWords).join('|') + ')\\b', 'gi');
  }

  C.strongWords = () =>
    C.phrases({
      id: 'strong-words',
      title: 'Stronger words',
      why: '“Very” and “really” prop up a weak word. One precise word is shorter and hits harder: “very tired” → “exhausted”, “really big” → “huge”. Mark Twain’s joke: substitute “damn” every time you’re inclined to write “very”; your editor will delete it and the writing will be just as it should be.',
      re: intensifierRegex(),
      level: 'warn',
      note: (h) => `${quote(h.text)} → try “${lex.strongWords[h.groups[2].toLowerCase()]}”.`,
      fixes: (h) => [{ label: `Use “${lex.strongWords[h.groups[2].toLowerCase()]}”`, text: lex.strongWords[h.groups[2].toLowerCase()] }],
      grade: (n) => ({
        status: n === 0 ? 'pass' : n <= 2 ? 'warn' : 'fail',
        summary: n ? `${plural(n, 'weak pair')} with a stronger single word.` : 'No “very + word” pairs.',
      }),
    });

  C.filler = (o = {}) =>
    C.phrases({
      id: 'filler',
      filter: (h, ctx) => !intensifierRegex().test(ctx.masked.slice(h.start, h.end + 20)),
      title: 'Filler words',
      why: 'Words like “very”, “really” and “just” pad a sentence without adding meaning. Cut them, or swap the pair for one stronger word (“very tired” → “exhausted”).',
      list: lex.filler,
      level: 'warn',
      fixes: [DELETE],
      note: (h) => `Filler: ${quote(h.text)}. Cut it or choose a stronger word.`,
      grade(n, ctx) {
        const r = per100(n, ctx);
        return {
          status: band(r, o.ok ?? 1, o.warn ?? 2.5),
          summary: n ? `${plural(n, 'filler word')} (${r.toFixed(1)} per 100 words).` : 'No filler words.',
        };
      },
    });

  C.adverbs = (o = {}) => ({
    id: 'adverbs',
    title: '-ly adverbs',
    group: 'Style',
    why: 'An adverb often props up a weak verb. “Walked quickly” is weaker than “hurried”. Keep the ones that change the meaning; replace the rest with a precise verb.',
    run(ctx) {
      const hits = ctx.words.filter(
        (w) => w.lower.length > 4 && /ly$/.test(w.lower) && !lex.adverbExceptions.has(w.lower) && !lex.stopwords.has(w.lower)
      );
      const r = per100(hits.length, ctx);
      return {
        status: band(r, o.ok ?? 2, o.warn ?? 4),
        summary: hits.length ? `${plural(hits.length, 'adverb')} (${r.toFixed(1)} per 100 words).` : 'No -ly adverbs.',
        marks: hits.map((w) => mark(w, 'warn', `Adverb ${quote(w.text)}. Is there a stronger verb that does this job alone?`)),
      };
    },
  });

  C.passive = (o = {}) => ({
    id: 'passive',
    title: 'Passive voice',
    group: 'Style',
    why: 'Passive voice hides who does the action (“The cake was eaten”). Active voice is shorter and clearer (“Sam ate the cake”). Use passive only when the doer truly does not matter.',
    run(ctx) {
      const re = new RegExp(
        "\\b(am|is|are|was|were|be|been|being|get|gets|got|gotten)\\s+(?:(?:\\w+ly|not|never|just|already|also|often)\\s+)?(\\w+ed|" +
          lex.passiveIrregulars.join('|') + ')\\b',
        'gi'
      );
      const hits = T.findAll(ctx, re).filter((h) => !lex.passiveExceptions.has(h.groups[2].toLowerCase()));
      const sentences = new Set(hits.map((h) => (T.sentenceAt(ctx, h.start) || {}).index));
      const ratio = (sentences.size / Math.max(1, ctx.sentences.length)) * 100;
      return {
        status: band(ratio, o.ok ?? 10, o.warn ?? 20),
        summary: hits.length ? `${plural(sentences.size, 'sentence')} in passive voice (${Math.round(ratio)}%).` : 'All active voice.',
        marks: hits.map((h) => mark(h, 'warn', `Passive: ${quote(h.text)}. Who is doing this? Put them first.`)),
      };
    },
  });

  C.longSentences = (o = {}) => ({
    id: 'long-sentences',
    title: o.title || 'Long sentences',
    group: 'Clarity',
    why: o.why || `Sentences over ${o.max || 25} words make the reader hold too much at once. Split them, or cut the side trips.`,
    run(ctx) {
      const max = o.max || 25;
      const long = ctx.sentences.filter((s) => s.words.length > max);
      const ratio = (long.length / Math.max(1, ctx.sentences.length)) * 100;
      return {
        status: long.length === 0 ? 'pass' : ratio <= 15 ? 'warn' : 'fail',
        summary: long.length ? `${plural(long.length, 'sentence')} over ${max} words.` : `Every sentence is ${max} words or fewer.`,
        marks: long.map((s) => mark(s, 'bad', `${s.words.length} words. ${o.note || 'Try splitting this into two sentences.'}`)),
      };
    },
  });

  C.cliches = (o = {}) =>
    C.phrases({
      id: 'cliches',
      title: 'Clichés',
      why: 'A cliché is a phrase the reader has seen so often they skip it. Replace it with a detail only you would notice.',
      list: lex.cliches.concat(o.extra || []),
      level: 'bad',
      note: (h) => `Cliché: ${quote(h.text)}. What would you say if you had never heard this phrase?`,
      grade: (n) => ({
        status: n === 0 ? 'pass' : n <= 2 ? 'warn' : 'fail',
        summary: n ? `${plural(n, 'cliché')} found.` : 'No stock phrases.',
      }),
    });

  C.repetition = (o = {}) => ({
    id: 'repetition',
    title: 'Repeated words',
    group: 'Style',
    why: 'The same word twice in a few lines sounds like an echo, unless you mean it. Use a synonym, a pronoun, or restructure.',
    run(ctx) {
      const windowSize = o.window || 40;
      const last = new Map();
      const marks = [];
      for (const w of ctx.words) {
        if (w.lower.length < 4 || lex.stopwords.has(w.lower) || /^\d/.test(w.lower)) continue;
        const first = ctx.sentences[w.sentence].words[0];
        if (/^\p{Lu}/u.test(w.text) && first !== w) continue; // names repeat on purpose
        const key = w.lower.replace(/(?:'s|s)$/, '');
        const prev = last.get(key);
        if (prev !== undefined && w.index - prev <= windowSize) {
          marks.push(mark(w, 'warn', `${quote(w.text)} was used ${w.index - prev} words ago.`));
        }
        last.set(key, w.index);
      }
      return {
        status: band(marks.length, o.ok ?? 2, o.warn ?? 6),
        summary: marks.length ? `${plural(marks.length, 'close repeat')}.` : 'No close repeats.',
        marks,
      };
    },
  });

  C.readability = (o = {}) => ({
    id: 'readability',
    title: o.title || 'Reading level',
    group: 'Clarity',
    minWords: 40,
    why: o.why || `Measured with the Flesch–Kincaid grade formula (sentence length + syllables per word). Aim for grade ${o.min ?? 5}–${o.max ?? 9} for ${o.audience || 'a general audience'}.`,
    run(ctx) {
      const r = T.readability(ctx);
      const g = r.grade;
      const lo = o.min ?? 5;
      const hi = o.max ?? 9;
      const status = g >= lo - 1 && g <= hi ? 'pass' : g <= hi + 3 ? 'warn' : 'fail';
      let summary = `Grade ${g.toFixed(1)} · ${r.wordsPerSentence.toFixed(1)} words per sentence.`;
      if (g > hi) summary += ' Shorter sentences and plainer words will bring it down.';
      return { status, summary, marks: [] };
    },
  });

  C.rhythm = (o = {}) => ({
    id: 'rhythm',
    title: 'Sentence rhythm',
    group: 'Style',
    minWords: 60,
    why: 'Readers hear your sentences. Mix short and long ones so the rhythm never drones, and avoid starting three sentences in a row with the same word.',
    run(ctx) {
      const lens = ctx.sentences.map((s) => s.words.length);
      if (lens.length < 5) return { status: 'na', summary: 'Needs at least five sentences.', marks: [] };
      const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
      const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length);
      const marks = [];
      for (let i = 2; i < ctx.sentences.length; i++) {
        const a = ctx.sentences[i - 2].words[0].lower;
        const b = ctx.sentences[i - 1].words[0].lower;
        const c = ctx.sentences[i].words[0];
        if (a === b && b === c.lower && !(o.allowAnaphora)) {
          marks.push(mark(c, 'warn', `Third sentence in a row starting with ${quote(c.text)}.`));
        }
      }
      const flat = sd < (o.minSpread ?? 4);
      let status = 'pass';
      if (flat || marks.length) status = 'warn';
      const summary = (flat ? `Sentence lengths are very even (±${sd.toFixed(1)} words). Add a short punchy one or a longer flowing one.` : `Good variety (±${sd.toFixed(1)} words around an average of ${mean.toFixed(0)}).`) +
        (marks.length ? ` ${plural(marks.length, 'repeated opener')}.` : '');
      return { status, summary, marks };
    },
  });

  C.paragraphLength = (o = {}) => ({
    id: 'paragraphs',
    title: 'Paragraph length',
    group: 'Clarity',
    why: `White space is a gift to the reader. Paragraphs over ${o.max || 120} words look like a wall, especially on a phone.`,
    run(ctx) {
      const max = o.max || 120;
      const long = ctx.paragraphs.filter((p) => p.words.length > max);
      return {
        status: long.length === 0 ? 'pass' : long.length === 1 ? 'warn' : 'fail',
        summary: long.length ? `${plural(long.length, 'paragraph')} over ${max} words.` : `All paragraphs are under ${max} words.`,
        marks: long.map((p) => mark(p.sentences[0], 'warn', `This paragraph runs ${p.words.length} words. Look for a natural place to break it.`)),
      };
    },
  });

  C.weakOpeners = () =>
    C.phrases({
      id: 'weak-openers',
      title: 'Weak sentence openers',
      why: '“There is…”, “There are…” and “It is…” delay the real subject. Start with the thing that acts: “There was a dog barking” → “A dog barked.”',
      re: /(?:^|(?<=[.!?…]\s+)|(?<=\n))(there\s+(?:is|are|was|were|will be)|it\s+(?:is|was)\b)/gim,
      level: 'warn',
      note: (h) => `Weak opener ${quote(h.text)}. Can the real subject go first?`,
      grade: (n, ctx) => ({
        status: band((n / Math.max(1, ctx.sentences.length)) * 100, 8, 18),
        summary: n ? `${plural(n, 'sentence')} open with a placeholder subject.` : 'Sentences start with real subjects.',
      }),
    });

  /** Matches each beat of a framework to a ## section in the draft. */
  function beatStatus(ctx, fw) {
    const sections = T.sections(ctx);
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return fw.beats.map((beat) => {
      const name = norm(beat.name);
      const sec = sections.find((s) => {
        const t = norm(s.heading.title);
        return t === name || t.includes(name) || (t.length > 3 && name.includes(t));
      }) || null;
      const min = beat.min ?? fw.minWordsPerBeat ?? 12;
      return { beat, section: sec, words: sec ? sec.words : 0, filled: !!sec && sec.words >= min };
    });
  }

  /** Tracks the active framework's beats against ## headings in the draft. */
  C.structure = () => ({
    id: 'structure',
    title: 'Framework beats',
    group: 'Structure',
    minWords: 0,
    why: 'Each beat of your chosen framework has a job. This check looks for a ## heading per beat (insert the outline from the Frameworks tab) and checks that each one has writing under it.',
    run(ctx) {
      const fw = ctx.frameworkDef;
      if (!fw || fw.structure === false || !fw.beats || !fw.beats.length) return null;
      const beats = beatStatus(ctx, fw);
      const found = beats.filter((b) => b.section);
      if (!found.length) {
        return {
          status: 'info',
          summary: `Insert the “${fw.name}” outline from the Frameworks tab to track its ${fw.beats.length} beats.`,
          marks: [],
        };
      }
      const marks = found.map((b) => b.filled
        ? mark(b.section.heading, 'good', `${b.beat.name}: ${b.words} words. This beat is on the page.`)
        : mark(b.section.heading, 'warn', `${b.beat.name}: ${b.words ? b.words + ' words so far' : 'empty'}. ${b.beat.hint}`));
      const filled = beats.filter((b) => b.filled).length;
      const missing = beats.filter((b) => !b.section).map((b) => b.beat.name);
      const total = beats.length;
      return {
        status: filled === total ? 'pass' : filled >= total / 2 ? 'warn' : 'fail',
        summary: `${filled} of ${total} beats written` + (missing.length ? `. Missing headings: ${missing.join(', ')}.` : '.'),
        marks,
      };
    },
  });

  /** Runs a genre's checks and computes an overall score. */
  function run(checks, ctx, opts = {}) {
    const results = [];
    const force = new Set(opts.force || []);
    for (const c of checks) {
      const base = { id: c.id, title: c.title, group: c.group || 'Style', why: c.why };
      const min = force.has(c.id) ? Math.min(1, c.minWords ?? 20) : c.minWords ?? 20;
      if (ctx.wordCount < min) {
        results.push(Object.assign(base, { status: 'na', summary: `Starts checking after ${min} words.`, marks: [] }));
        continue;
      }
      let r;
      try {
        r = c.run(ctx);
      } catch (err) {
        console.error('Check failed:', c.id, err);
        r = { status: 'na', summary: 'This check hit an error and was skipped.', marks: [] };
      }
      if (!r) continue;
      r.marks = (r.marks || []).filter((m) => m.end > m.start);
      r.marks.forEach((m) => {
        m.checkId = c.id;
        m.checkTitle = c.title;
      });
      results.push(Object.assign(base, r));
    }
    const weights = { pass: 1, warn: 0.5, fail: 0 };
    const scored = results.filter((r) => r.status in weights);
    const score = scored.length ? Math.round((scored.reduce((a, r) => a + weights[r.status], 0) / scored.length) * 100) : null;
    return { results, score };
  }

  WP.checks = { C, run, mark, plural, per100, band, quote, beatStatus, DELETE };
  WP.genres = WP.genres || [];
})(window.WP = window.WP || {});
