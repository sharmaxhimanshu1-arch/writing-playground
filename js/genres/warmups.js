/*
 * Warm-up games: short, timed writing games with a hard constraint the editor
 * checks live. They work in any genre. Each game builds its checks from params
 * chosen when the game starts (for example, three random words).
 */
(function (WP) {
  'use strict';
  const T = WP.text;
  const { mark, plural, quote } = WP.checks;

  const RANDOM_WORDS = ['umbrella', 'lighthouse', 'pancake', 'telescope', 'grandmother', 'cactus', 'elevator', 'violin',
    'passport', 'goldfish', 'thunder', 'lipstick', 'helicopter', 'sandwich', 'compass', 'skateboard', 'volcano',
    'teacup', 'dentist', 'fireworks', 'ladder', 'wedding', 'snowman', 'library', 'zipper', 'parrot', 'bicycle'];

  const pickN = (arr, n) => arr.slice().sort(() => Math.random() - 0.5).slice(0, n);

  function exactWords(n) {
    return {
      id: 'game-length',
      title: `Exactly ${n} words`,
      group: 'Warm-up rules',
      minWords: 0,
      why: `The whole game is fitting a complete story into exactly ${n} words. Every word has to earn its place.`,
      run(ctx) {
        const c = ctx.wordCount;
        return {
          status: c === n ? 'pass' : 'fail',
          summary: c === n ? `${n} words exactly.` : c < n ? `${c} words: ${n - c} to go.` : `${c} words: cut ${c - n}.`,
          marks: [],
        };
      },
    };
  }

  const GAMES = [
    {
      id: 'six-word',
      short: 'A whole story in six words.',
      title: 'Six-word story',
      minutes: 3,
      rules: 'Tell a complete story in exactly six words. The legend: “For sale: baby shoes, never worn.”',
      tip: 'Imply a before and an after. Let the reader fill the gap.',
      checks: () => [exactWords(6)],
    },
    {
      id: 'fifty',
      short: 'A whole story in exactly 50 words.',
      title: 'Fifty-word story',
      minutes: 5,
      rules: 'Write a complete story with a beginning, middle and end in exactly fifty words.',
      tip: 'Write long first, then cut. Counting is part of the fun.',
      checks: () => [exactWords(50)],
    },
    {
      id: 'lipogram',
      short: '40 words, no letter E.',
      title: 'No letter E',
      minutes: 5,
      rules: 'Write at least 40 words without using the letter “e” once. It is the most common letter in English.',
      tip: 'Swap words: “the” → “a”, “he” → “that man”, “three” → “a trio of”.',
      checks: () => [
        {
          id: 'game-no-e',
          title: 'No letter E',
          group: 'Warm-up rules',
          minWords: 0,
          why: 'A lipogram leaves out one letter. Banning “e” forces you off your usual words and into fresh ones.',
          run(ctx) {
            const hits = T.findAll(ctx, /[eéèêë]/gi);
            const ok = hits.length === 0 && ctx.wordCount >= 40;
            return {
              status: ok ? 'pass' : 'fail',
              summary: hits.length ? `${plural(hits.length, 'E')} to remove.` : ctx.wordCount < 40 ? `No E so far. ${40 - ctx.wordCount} more words to go.` : 'Not a single E. Impressive.',
              marks: hits.map((h) => mark(h, 'bad', 'An E slipped in. Find another word.')),
            };
          },
        },
      ],
    },
    {
      id: 'three-words',
      short: 'One scene, three random words.',
      title: 'Three random words',
      minutes: 5,
      rules: 'Write a short scene (at least 60 words) that uses all three of these words: {words}.',
      tip: 'Make the strangest word the most important one.',
      setup: () => ({ words: pickN(RANDOM_WORDS, 3) }),
      checks: (p) => [
        {
          id: 'game-words',
          title: 'Use all three words',
          group: 'Warm-up rules',
          minWords: 0,
          why: `Random words force connections you would never plan. Your words: ${p.words.join(', ')}.`,
          run(ctx) {
            const marks = [];
            const missing = [];
            for (const w of p.words) {
              const hits = T.findAll(ctx, new RegExp(`\\b${w}s?\\b`, 'gi'));
              if (hits.length) marks.push(mark(hits[0], 'good', `${quote(w)} used.`));
              else missing.push(w);
            }
            const ok = !missing.length && ctx.wordCount >= 60;
            return {
              status: ok ? 'pass' : 'fail',
              summary: missing.length ? `Still missing: ${missing.join(', ')}.` : ctx.wordCount < 60 ? `All three words in. ${60 - ctx.wordCount} more words to go.` : 'All three words, woven in.',
              marks,
            };
          },
        },
      ],
    },
    {
      id: 'abc',
      short: 'Five sentences, A to E.',
      title: 'ABC sentences',
      minutes: 5,
      rules: 'Write five sentences. The first starts with A, the second with B, then C, D and E.',
      tip: 'Plan the story first, then bend each sentence to its letter.',
      checks: () => [
        {
          id: 'game-abc',
          title: 'A, B, C, D, E',
          group: 'Warm-up rules',
          minWords: 0,
          why: 'Constraints on sentence openings stop you starting every sentence with “I” or “The”.',
          run(ctx) {
            const letters = 'ABCDE';
            const marks = [];
            let good = 0;
            ctx.sentences.slice(0, 5).forEach((s, i) => {
              const w = s.words[0];
              if (w.text[0].toUpperCase() === letters[i]) {
                good++;
                marks.push(mark(w, 'good', `Sentence ${i + 1} starts with ${letters[i]}.`));
              } else marks.push(mark(w, 'bad', `Sentence ${i + 1} should start with ${letters[i]}.`));
            });
            return {
              status: good === 5 && ctx.sentences.length >= 5 ? 'pass' : 'fail',
              summary: `${good} of 5 sentences start with the right letter.`,
              marks,
            };
          },
        },
      ],
    },
    {
      id: 'no-crutches',
      short: '80 words, no crutch words.',
      title: 'No crutch words',
      minutes: 5,
      rules: 'Write at least 80 words without: very, really, just, thing, stuff, nice, good, bad, a lot.',
      tip: 'When you reach for a crutch word, ask: what exactly do I mean?',
      checks: () => [
        {
          id: 'game-crutches',
          title: 'Zero crutch words',
          group: 'Warm-up rules',
          minWords: 0,
          why: 'Crutch words are the ones you use instead of thinking of the precise word. Banning them for five minutes builds the habit.',
          run(ctx) {
            const hits = T.findAll(ctx, T.phraseRegex(['very', 'really', 'just', 'thing', 'things', 'stuff', 'nice', 'good', 'bad', 'a lot']));
            const ok = !hits.length && ctx.wordCount >= 80;
            return {
              status: ok ? 'pass' : 'fail',
              summary: hits.length ? `${plural(hits.length, 'crutch word')} to replace.` : ctx.wordCount < 80 ? `Clean so far. ${80 - ctx.wordCount} more words to go.` : 'Not one crutch word.',
              marks: hits.map((h) => mark(h, 'bad', `${quote(h.text)} is banned in this game. What exactly do you mean?`)),
            };
          },
        },
      ],
    },
    {
      id: 'five-senses',
      short: 'One place, all five senses.',
      title: 'Five senses',
      minutes: 5,
      rules: 'Describe one place in five sentences, using all five senses: sight, sound, smell, taste and touch.',
      tip: 'Smell and taste are the ones beginners forget. Start with them.',
      checks: () => [
        {
          id: 'game-senses',
          title: 'All five senses',
          group: 'Warm-up rules',
          minWords: 0,
          why: 'Most writing only uses sight. Forcing all five makes a place feel real.',
          run(ctx) {
            const marks = [];
            const used = [];
            for (const [sense, words] of Object.entries(WP.lex.senses)) {
              const hits = T.findAll(ctx, T.formsRegex(words));
              if (hits.length) {
                used.push(sense);
                marks.push(mark(hits[0], 'good', `Sense of ${sense}.`));
              }
            }
            const missing = Object.keys(WP.lex.senses).filter((s) => !used.includes(s));
            return {
              status: !missing.length ? 'pass' : 'fail',
              summary: missing.length ? `Missing: ${missing.join(', ')}.` : 'All five senses.',
              marks,
            };
          },
        },
      ],
    },
    {
      id: 'dialogue-only',
      short: 'A scene told only in dialogue.',
      title: 'Dialogue only',
      minutes: 5,
      rules: 'Write a scene of at least eight lines told only through dialogue. Every line is something a character says, in quotation marks.',
      tip: 'Two people who want different things. Let the reader work out who is speaking.',
      checks: () => [
        {
          id: 'game-dialogue',
          title: 'Only dialogue',
          group: 'Warm-up rules',
          minWords: 0,
          why: 'Without narration, the words people say must carry character, conflict and setting.',
          run(ctx) {
            const lines = T.proseLines(ctx).filter((l) => l.words.length);
            const bad = lines.filter((l) => !/^\s*["“'‘]/.test(l.text) || !/["”'’][.!?]?\s*$/.test(l.text));
            return {
              status: lines.length >= 8 && !bad.length ? 'pass' : 'fail',
              summary: bad.length ? `${plural(bad.length, 'line')} not in quotation marks.` : lines.length < 8 ? `${lines.length} of 8 lines.` : `${lines.length} lines of pure dialogue.`,
              marks: bad.map((l) => mark(l, 'bad', 'Narration or a tag. Put it in a character’s mouth, in quotation marks.')),
            };
          },
        },
      ],
    },
  ];

  WP.warmups = {
    list: GAMES,
    get: (id) => GAMES.find((g) => g.id === id),
    rulesText(game, params) {
      return game.rules.replace('{words}', params && params.words ? params.words.join(', ') : '');
    },
  };
})(window.WP = window.WP || {});
