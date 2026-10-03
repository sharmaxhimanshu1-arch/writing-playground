(function (WP) {
  'use strict';
  const T = WP.text;
  const lex = WP.lex;
  const { C, mark, plural, quote } = WP.checks;

  /*
   * Form rules. syl: allowed syllables per line (repeats if shorter than the unit).
   * unit: 'stanza' checks each stanza on its own, 'poem' treats all lines as one block.
   */
  const FORMS = {
    haiku: { unit: 'stanza', lines: 3, syl: [[5, 5], [7, 7], [5, 5]], tolerance: 1, scheme: null },
    limerick: { unit: 'stanza', lines: 5, syl: [[7, 10], [7, 10], [4, 7], [4, 7], [7, 10]], tolerance: 1, scheme: 'AABBA' },
    sonnet: { unit: 'poem', lines: 14, syl: [[9, 11]], tolerance: 1, scheme: 'ABABCDCDEFEFGG' },
    ballad: { unit: 'stanza', lines: 4, syl: [[7, 9], [5, 7], [7, 9], [5, 7]], tolerance: 1, scheme: 'ABCB' },
    couplets: { unit: 'poem', lines: null, syl: null, scheme: 'AA' },
    free: { unit: 'poem', lines: null, syl: null, scheme: null },
  };

  const VOWEL_SOUNDS = [['eigh', 'AY'], ['ee', 'EE'], ['ea', 'EE'], ['ei', 'EE'], ['ie', 'EE'], ['ai', 'AY'],
    ['ay', 'AY'], ['ey', 'AY'], ['oa', 'OH'], ['oe', 'OH'], ['ow', 'OW'], ['ou', 'OW'], ['oo', 'OO'], ['ew', 'OO'],
    ['ue', 'OO'], ['ui', 'OO'], ['au', 'AW'], ['aw', 'AW'], ['oi', 'OY'], ['oy', 'OY']];
  const LONG_VOWEL = { a: 'AY', e: 'EE', i: 'EYE', o: 'OH', u: 'OO', y: 'EYE' };
  const OPEN_VOWEL = { a: 'AH', e: 'EE', i: 'EYE', o: 'OH', u: 'OO' };
  const IRREGULAR = {
    said: 'E:d', dead: 'E:d', head: 'E:d', bread: 'E:d', thread: 'E:d', spread: 'E:d', instead: 'E:d', ahead: 'E:d', dread: 'E:d',
    one: 'U:n', done: 'U:n', none: 'U:n', won: 'U:n', son: 'U:n', ton: 'U:n', someone: 'U:n', everyone: 'U:n',
    to: 'OO', do: 'OO', who: 'OO', two: 'OO', too: 'OO', through: 'OO', you: 'OO', shoe: 'OO',
    love: 'U:v', glove: 'U:v', above: 'U:v', dove: 'U:v', of: 'U:v',
    come: 'U:m', some: 'U:m', become: 'U:m', again: 'E:n', been: 'I:n', are: 'AR', heart: 'AR:t',
  };

  /** Approximate rhyme key: the sound of the last stressed vowel plus what follows. */
  function rhymeKey(word) {
    const w0 = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!w0) return '';
    if (IRREGULAR[w0]) return IRREGULAR[w0];
    for (const k of Object.keys(IRREGULAR)) if (k.length >= 4 && w0.endsWith(k)) return IRREGULAR[k];
    if (/[^aeiou]y$/.test(w0)) return WP.text.syllables(w0) > 1 ? 'EE' : 'EYE';
    if (/[^aeiou]le$/.test(w0) && w0.length > 3) return 'LE:' + w0.slice(-4);
    let w = w0;
    const silentE = w.length > 3 && /[^aeiou]e$/.test(w);
    const magic = w.length > 2 && /(?:^|[^aeiouy])[aeiouy][^aeiouy]{1,2}e$/.test(w);
    if (silentE || magic) w = w.slice(0, -1);
    const m = w.match(/([aeiouy]+)([^aeiouy]*)$/);
    if (!m) return w;
    let v = m[1];
    let cons = m[2];
    if (v.endsWith('i') && cons.startsWith('gh')) {
      v = v === 'ei' ? 'AY' : 'EYE';
      cons = cons.slice(2);
    } else if (magic && v.length === 1) {
      v = LONG_VOWEL[v] || v;
    } else {
      const hit = VOWEL_SOUNDS.find(([spelling]) => v.endsWith(spelling));
      if (hit) v = hit[1];
      else if (!cons && v.length === 1) v = OPEN_VOWEL[v] || v;
      else v = v.toUpperCase();
    }
    return v + ':' + cons;
  }

  function rhymes(a, b) {
    if (!a || !b) return false;
    const la = a.toLowerCase().replace(/[^a-z]/g, '');
    const lb = b.toLowerCase().replace(/[^a-z]/g, '');
    if (!la || !lb) return false;
    if (la === lb) return true;
    if (rhymeKey(la) === rhymeKey(lb)) return true;
    const t2 = (s) => s.slice(-2);
    return la.length > 2 && lb.length > 2 && t2(la) === t2(lb) && /[aeiou]/.test(t2(la)) && /[^aeiou]$/.test(la);
  }

  function formOf(ctx) {
    return FORMS[ctx.framework] || FORMS.free;
  }

  function units(ctx, form) {
    const lines = T.proseLines(ctx).filter((l) => l.words.length);
    if (form.unit === 'poem') return [lines];
    const out = [];
    for (const p of ctx.paragraphs) {
      const u = lines.filter((l) => l.start >= p.start && l.end <= p.end);
      if (u.length) out.push(u);
    }
    return out;
  }

  function lineSyllables(line) {
    return line.words.reduce((a, w) => a + w.syllables, 0);
  }

  function lastWord(line) {
    return line.words[line.words.length - 1];
  }

  const checks = [
    {
      id: 'line-count',
      title: 'Lines per stanza',
      group: 'Form',
      minWords: 3,
      why: 'Fixed forms have a fixed shape: a haiku has 3 lines, a limerick 5, a ballad stanza 4, a sonnet 14. Separate stanzas with a blank line.',
      run(ctx) {
        const form = formOf(ctx);
        if (!form.lines) return null;
        const us = units(ctx, form);
        const marks = [];
        let off = 0;
        us.forEach((u) => {
          if (u.length !== form.lines) {
            off++;
            marks.push(mark(u[0], 'bad', `This ${form.unit === 'poem' ? 'poem' : 'stanza'} has ${u.length} lines. The form needs ${form.lines}.`));
          }
        });
        return {
          status: off ? 'fail' : 'pass',
          summary: off ? `${off} of ${plural(us.length, form.unit === 'poem' ? 'poem' : 'stanza')} with the wrong number of lines.` : `Every ${form.unit === 'poem' ? 'poem' : 'stanza'} has ${form.lines} lines.`,
          marks,
        };
      },
    },

    {
      id: 'syllables',
      title: 'Syllable count',
      group: 'Form',
      minWords: 3,
      why: 'Meter is the beat of a poem. Haiku counts syllables exactly (5-7-5); a sonnet line has about 10 (iambic pentameter); limerick lines bounce between long and short. Counts here are estimates, so tap out tricky words yourself.',
      run(ctx) {
        const form = formOf(ctx);
        const lines = T.proseLines(ctx).filter((l) => l.words.length);
        const marks = [];
        if (!form.syl) {
          lines.forEach((l) => marks.push(mark(l, 'info', `${lineSyllables(l)} syllables.`)));
          return { status: 'info', summary: `${plural(lines.length, 'line')}. Free verse has no syllable target; hover a line to see its count.`, marks };
        }
        let good = 0;
        let total = 0;
        units(ctx, form).forEach((u) => {
          u.forEach((l, i) => {
            const [lo, hi] = form.syl[i % form.syl.length];
            const n = lineSyllables(l);
            const target = lo === hi ? String(lo) : `${lo}–${hi}`;
            total++;
            if (n >= lo && n <= hi) {
              good++;
              marks.push(mark(l, 'good', `${n} syllables (target ${target}).`));
            } else if (n >= lo - form.tolerance && n <= hi + form.tolerance) {
              marks.push(mark(l, 'warn', `${n} syllables (target ${target}). Close: check your count.`));
            } else {
              marks.push(mark(l, 'bad', `${n} syllables (target ${target}).`));
            }
          });
        });
        return {
          status: good === total ? 'pass' : good >= total * 0.6 ? 'warn' : 'fail',
          summary: `${good} of ${plural(total, 'line')} hit the syllable target.`,
          marks,
        };
      },
    },

    {
      id: 'rhyme',
      title: 'Rhyme scheme',
      group: 'Form',
      minWords: 6,
      why: 'A rhyme scheme labels line endings with letters: lines with the same letter rhyme. Limerick = AABBA, Shakespearean sonnet = ABAB CDCD EFEF GG, ballad = ABCB. Detection is by spelling, so “love/move” may look like a rhyme to the computer and not to the ear.',
      run(ctx) {
        const form = formOf(ctx);
        const lines = T.proseLines(ctx).filter((l) => l.words.length);
        const detected = [];
        const keys = [];
        lines.forEach((l) => {
          const w = lastWord(l).text;
          let idx = keys.findIndex((k) => rhymes(k, w));
          if (idx === -1) {
            keys.push(w);
            idx = keys.length - 1;
          }
          detected.push(String.fromCharCode(65 + (idx % 26)));
        });
        const marks = [];
        if (!form.scheme) {
          return { status: 'info', summary: `Detected pattern: ${detected.join('') || '—'}. No rhyme required for this form.`, marks };
        }
        let ok = 0;
        let needed = 0;
        units(ctx, form).forEach((u) => {
          const scheme = form.scheme;
          u.forEach((l, i) => {
            const letter = scheme[i % scheme.length];
            const blockStart = i - (i % scheme.length);
            const partnerIdx = [...scheme].findIndex((c, j) => c === letter && blockStart + j < i && blockStart + j < u.length);
            if (partnerIdx === -1) return;
            needed++;
            const partner = u[blockStart + partnerIdx];
            const a = lastWord(partner);
            const b = lastWord(l);
            if (rhymes(a.text, b.text)) {
              ok++;
              marks.push(mark(b, 'good', `Rhymes with ${quote(a.text)} (${letter}).`));
            } else {
              marks.push(mark(b, 'bad', `Should rhyme with ${quote(a.text)} (${letter}).`));
            }
          });
        });
        return {
          status: needed === 0 ? 'info' : ok === needed ? 'pass' : ok >= needed / 2 ? 'warn' : 'fail',
          summary: `Target ${form.scheme}. Detected ${detected.join('')}. ${ok} of ${plural(needed, 'rhyme')} land.`,
          marks,
        };
      },
    },

    {
      id: 'imagery',
      title: 'Concrete images',
      group: 'Craft',
      minWords: 10,
      why: 'Abstract words (love, pain, soul) tell the reader what to feel. Concrete images (a cold mug, a chipped tooth) make them feel it. Ezra Pound: “Go in fear of abstractions.”',
      run(ctx) {
        const abstract = T.findAll(ctx, T.phraseRegex(lex.abstractWords));
        const concrete = [];
        for (const words of Object.values(lex.senses)) concrete.push(...T.findAll(ctx, T.phraseRegex(words)));
        const marks = abstract.map((h) => mark(h, 'warn', `${quote(h.text)} is abstract. What image could stand in for it?`))
          .concat(concrete.map((h) => mark(h, 'good', `Concrete, sensory: ${quote(h.text)}.`)));
        return {
          status: concrete.length >= abstract.length * 2 ? 'pass' : concrete.length >= abstract.length ? 'warn' : 'fail',
          summary: `${plural(concrete.length, 'sensory image')}, ${plural(abstract.length, 'abstract word')}.`,
          marks,
        };
      },
    },

    {
      id: 'line-endings',
      title: 'Strong line endings',
      group: 'Craft',
      minWords: 10,
      why: 'The last word of a line gets extra weight because the reader pauses there. Ending on “the”, “of” or “and” wastes that spot, unless you are deliberately enjambing (running the sentence onto the next line).',
      run(ctx) {
        const weak = new Set(['the', 'a', 'an', 'of', 'and', 'to', 'in', 'with', 'my', 'your', 'is', 'at', 'for', 'on', 'it']);
        const lines = T.proseLines(ctx).filter((l) => l.words.length);
        const marks = [];
        lines.forEach((l) => {
          const w = lastWord(l);
          if (weak.has(w.lower)) marks.push(mark(w, 'warn', `Line ends on ${quote(w.text)}. Is the break doing something, or could a stronger word land here?`));
        });
        return {
          status: marks.length === 0 ? 'pass' : marks.length <= Math.ceil(lines.length / 6) ? 'warn' : 'fail',
          summary: marks.length ? `${plural(marks.length, 'line')} end on a weak word.` : 'Line endings carry weight.',
          marks,
        };
      },
    },

    {
      id: 'line-breaks',
      title: 'Line breaks',
      group: 'Craft',
      minWords: 20,
      why: 'In free verse, line breaks are your rhythm. If every line is a long sentence, it reads like chopped prose. Break where you want the reader to pause or be surprised.',
      run(ctx) {
        if (ctx.framework && ctx.framework !== 'free') return null;
        const lines = T.proseLines(ctx).filter((l) => l.words.length);
        const long = lines.filter((l) => l.words.length > 14);
        return {
          status: long.length === 0 ? 'pass' : long.length <= lines.length / 4 ? 'warn' : 'fail',
          summary: long.length ? `${plural(long.length, 'line')} over 14 words.` : 'Lines are broken with intent.',
          marks: long.map((l) => mark(l, 'warn', `${l.words.length} words on one line. Where should the reader pause?`)),
        };
      },
    },

    C.phrases({
      id: 'poetic-cliches',
      title: 'Clichés',
      group: 'Craft',
      minWords: 3,
      why: 'Poems live on fresh images. “Tears like rain” and “heart of stone” have been used so often they no longer make pictures.',
      list: lex.poeticCliches.concat(lex.cliches),
      level: 'bad',
      note: (h) => `${quote(h.text)} is worn out. What did you actually see?`,
      grade: (n) => ({ status: n ? (n > 2 ? 'fail' : 'warn') : 'pass', summary: n ? `${plural(n, 'cliché')}.` : 'Fresh language.' }),
    }),

    C.filler({ ok: 0.5, warn: 2 }),
  ];

  const frameworks = [
    {
      id: 'free',
      name: 'Free Verse',
      structure: false,
      summary: 'No fixed meter or rhyme. Rhythm comes from line breaks, repetition and images.',
      bestFor: 'Starting out, personal poems, anything',
      beats: [
        { name: 'Image', hint: 'Start with one concrete thing you can see, hear, touch.' },
        { name: 'Turn', hint: 'Shift: a memory, a question, a contrast.' },
        { name: 'Close', hint: 'End on an image, not an explanation.' },
      ],
      example: `My father's boots
still wait by the back door,
laces stiff as wire,
mud from a field
that was sold in March.

Nobody moves them.
We step around them
the way you step around
a sleeping dog.`,
    },
    {
      id: 'haiku',
      name: 'Haiku',
      structure: false,
      summary: 'Three lines of 5, 7 and 5 syllables. Traditionally captures one moment in nature, often with a seasonal word and a “cut” between two images.',
      bestFor: 'Practicing precision and imagery',
      beats: [
        { name: 'Line 1 (5)', hint: 'A setting or first image.' },
        { name: 'Line 2 (7)', hint: 'Detail or action.' },
        { name: 'Line 3 (5)', hint: 'A turn or second image that shifts the first.' },
      ],
      example: `cold kitchen at dawn
the kettle starts to whisper
before I am up`,
    },
    {
      id: 'limerick',
      name: 'Limerick',
      structure: false,
      summary: 'Five lines, rhyme scheme AABBA. Lines 1, 2 and 5 are long (8–9 syllables), lines 3 and 4 are short (5–6). Usually funny.',
      bestFor: 'Comic verse, practicing rhythm and rhyme',
      beats: [
        { name: 'Line 1 (A)', hint: 'Introduce a person and place.' },
        { name: 'Line 2 (A)', hint: 'Their quirk or problem.' },
        { name: 'Line 3 (B)', hint: 'Short. Something happens.' },
        { name: 'Line 4 (B)', hint: 'Short. It escalates.' },
        { name: 'Line 5 (A)', hint: 'The punchline.' },
      ],
      example: `A baker who lived by the bay
Made bread that would float far away.
She would knead it at night,
And it rose like a kite,
So she now delivers by sleigh.`,
    },
    {
      id: 'sonnet',
      name: 'Shakespearean Sonnet',
      structure: false,
      summary: '14 lines of roughly 10 syllables (iambic pentameter: da-DUM ×5), rhyme scheme ABAB CDCD EFEF GG. The final couplet turns or resolves the poem.',
      bestFor: 'Love, argument, big feelings under tight control',
      beats: [
        { name: 'Quatrain 1 (ABAB)', hint: 'Present the situation or problem.' },
        { name: 'Quatrain 2 (CDCD)', hint: 'Develop or complicate it.' },
        { name: 'Quatrain 3 (EFEF)', hint: 'Deepen it, often with a shift (the “volta”).' },
        { name: 'Couplet (GG)', hint: 'Two rhyming lines that resolve or twist.' },
      ],
      example: `I keep your number though the line is dead,
a string of digits nothing answers to.
I know the things I should have long since said,
I know the voice that would have come back through.
Some nights I dial all but the last one,
and hold the silence like a cooling cup.
It isn't grief exactly, it's undone,
a call that waits for someone to pick up.
The phone has changed three times since you were here,
the contacts carried over every time.
Each upgrade asks me if I'd like to clear,
and every time I answer, not this time.
So keep your place, small ghost, inside my phone:
the only line on which I'm not alone.`,
    },
    {
      id: 'ballad',
      name: 'Ballad Stanza',
      structure: false,
      summary: 'Four-line stanzas alternating about 8 and 6 syllables (common meter), with lines 2 and 4 rhyming (ABCB). The form of folk songs and hymns.',
      bestFor: 'Telling a story in verse, song lyrics',
      beats: [
        { name: 'Line 1 (8)', hint: 'Set the scene.' },
        { name: 'Line 2 (6, rhymes)', hint: 'Add a detail.' },
        { name: 'Line 3 (8)', hint: 'Move the story.' },
        { name: 'Line 4 (6, rhymes)', hint: 'Land it with the rhyme.' },
      ],
      example: `The miller's daughter walked to town
with flour on her sleeve;
she sold the bread, she kept the coins,
and never thought to leave.

But on the bridge a stranger stood
and asked her for some bread;
she gave it free, and from that day
the river ran gold instead.`,
    },
    {
      id: 'couplets',
      name: 'Rhyming Couplets',
      structure: false,
      summary: 'Pairs of lines that rhyme: AA BB CC. Simple, musical, great for practicing rhyme.',
      bestFor: 'Children’s verse, light verse, song lyrics',
      beats: [
        { name: 'Couplet 1', hint: 'Two rhyming lines that introduce the subject.' },
        { name: 'Couplet 2', hint: 'Two more that develop it.' },
        { name: 'Final couplet', hint: 'A twist or closing image.' },
      ],
      example: `My cat ignores the toys I buy,
the feather wand, the plastic fly.
She'd rather chase a single sock
or stare for hours at the clock.
I spent a fortune at the shop;
she naps inside the box on top.`,
    },
  ];

  WP.genres.push({
    id: 'poetry',
    name: 'Poetry',
    tagline: 'Haiku, sonnets, limericks and free verse',
    checks,
    frameworks,
    prompts: [
      'Write about an object in your pocket or bag right now.',
      'Write a haiku about the view from the nearest window.',
      'A poem made only of things you heard today.',
      'Write a limerick about your least favorite chore.',
      'Describe a person using only their hands.',
      'Write a poem addressed to an app on your phone.',
      'A poem where every stanza is a different room of the same house.',
      'Write about a smell that takes you back to childhood.',
      'Write a sonnet to a food you love.',
      'Write a ballad about someone in your family history.',
      'A poem that starts with a question and never answers it.',
      'Write about the weather without naming it.',
    ],
    generator: {
      template: 'A {form} about {object} that is secretly about {meaning}.',
      parts: {
        form: ['haiku', 'free-verse poem', 'limerick', 'sonnet', 'ballad', 'set of couplets'],
        object: ['a broken umbrella', 'your grandmother’s recipe card', 'a parking ticket', 'the last bus home', 'a houseplant', 'an old phone charger', 'a lunchbox', 'the first snow', 'a borrowed jacket', 'a voicemail'],
        meaning: ['growing up', 'forgiveness', 'a friendship that ended', 'moving away', 'being proud of someone', 'starting over', 'time passing', 'being the new kid'],
      },
    },
    nudges: [
      'Replace one abstract word (love, pain, hope) with a thing you can hold.',
      'What sound is in this moment?',
      'Read the poem aloud. Where do you naturally pause? Break the line there.',
      'Cut the last line. Is the poem stronger without the explanation?',
      'What is the most surprising word you could end this line on?',
      'Zoom in: describe one tiny detail in the scene.',
      'Is there a simile here that has been used before? Make your own comparison.',
      'What is the poem really about, under the surface?',
    ],
    guide: {
      intro: 'Poetry compresses experience into images and sound. Every word earns its place, and the line break is a tool as powerful as punctuation. Start with something concrete, and let meaning grow out of it.',
      principles: [
        { title: 'Concrete over abstract', body: 'Instead of naming feelings, show the objects and moments that hold them. The reader feels the abstraction through the image.' },
        { title: 'Every word works', body: 'Cut filler mercilessly. Articles, adverbs and “very” rarely survive a good poem.' },
        { title: 'Lines are units of attention', body: 'A line break creates a tiny pause and gives weight to the last word. Use it to surprise, emphasise or create double meanings.' },
        { title: 'Sound matters', body: 'Read aloud. Notice repeated sounds (alliteration, assonance), rhythm, and rhyme, internal or at line ends.' },
        { title: 'Fresh comparisons', body: 'Similes and metaphors should make the reader see something new. If you’ve heard it before, don’t use it.' },
        { title: 'Form is a game', body: 'Fixed forms (haiku, sonnet) are constraints that force creative choices. Breaking a rule on purpose is different from not knowing it.' },
        { title: 'End on an image', body: 'Resist explaining the poem in the last line. Trust the reader.' },
      ],
      mistakes: [
        'Explaining the meaning in the final lines.',
        'Abstract words doing all the work: soul, heart, love, pain.',
        'Forcing a rhyme that bends the sentence into an odd shape.',
        'Clichéd images: tears like rain, heart of stone.',
        'Prose sentences chopped into random lines.',
      ],
      glossary: [
        { term: 'Stanza', def: 'A group of lines, like a paragraph in a poem.' },
        { term: 'Meter', def: 'The rhythmic pattern of stressed and unstressed syllables.' },
        { term: 'Iambic pentameter', def: 'Ten syllables in five da-DUM pairs per line. Shakespeare’s meter.' },
        { term: 'Rhyme scheme', def: 'The pattern of rhymes, labeled with letters (ABAB).' },
        { term: 'Enjambment', def: 'A sentence that continues past the end of a line without a pause.' },
        { term: 'Volta', def: 'The turn: a shift in thought or tone, especially in sonnets.' },
        { term: 'Imagery', def: 'Language that appeals to the senses.' },
        { term: 'Assonance', def: 'Repeated vowel sounds in nearby words.' },
        { term: 'Alliteration', def: 'Repeated starting consonant sounds in nearby words.' },
      ],
    },
    sample: {
      title: 'Example: Morning haiku',
      framework: 'haiku',
      text: `> Example draft: each stanza is one haiku. Hover a line to see its syllable count.

old radiator
knocks twice, wants to come inside
frost on the window

my heart is full of love
on this beautiful morning
sunlight on the floor`,
    },
  });

  WP.poetry = { rhymeKey, rhymes };
})(window.WP = window.WP || {});
