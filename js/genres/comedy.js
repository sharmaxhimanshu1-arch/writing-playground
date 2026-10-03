(function (WP) {
  'use strict';
  const T = WP.text;
  const { C, mark, plural, quote, band, DELETE } = WP.checks;

  /** A "bit" is a paragraph with at least two sentences or a dozen words. */
  function bits(ctx) {
    return ctx.paragraphs.filter((p) => p.sentences.length >= 2 || p.words.length >= 12);
  }

  const ATTITUDE = ['weird', 'weirdest', 'strange', 'scary', 'scariest', 'terrifying', 'frightening', 'hard',
    'hardest', 'difficult', 'impossible', 'stupid', 'stupidest', 'dumb', 'dumbest', 'idiotic', 'ridiculous',
    'insane', 'crazy', 'hate', 'hated', 'love', 'annoying', 'worst', 'creepy', 'awkward', 'embarrassing',
    'humiliating', 'pointless', 'nobody tells you', 'why do', 'what is the deal', "what's the deal", 'have you ever noticed'];

  const TURN_WORDS = ['but', 'until', 'except', 'turns out', 'instead', 'which is why', 'so now', 'only to',
    'and then i realized', 'unfortunately', 'apparently', 'not because', 'which means'];

  const WEAK_TAIL = /(?:,?\s*(?:or something|or whatever|or anything|you know|and stuff|and everything|i guess|i think|though|anyway|lol|haha|right|honestly|basically|for real|if that makes sense|kind of|sort of))[.!?…"'”’)]*$/i;
  const WEAK_LAST = new Set(['it', 'the', 'a', 'an', 'to', 'of', 'that', 'them', 'there', 'is', 'was', 'and', 'or',
    'in', 'on', 'at', 'for', 'with', 'this', 'thing', 'things', 'too', 'now', 'then', 'again', 'here', 'though']);

  const checks = [
    C.structure(),

    C.phrases({
      id: 'self-laugh',
      title: 'Laughing at your own joke',
      group: 'Comedy rules',
      minWords: 1,
      why: 'Never tell the audience something is funny. “lol”, “haha” or “get it?” explain the joke, and an explained joke is dead. Let the punchline do the work.',
      re: /(?<![\p{L}])(lol|lmao|rofl|ha(?:ha)+|hehe+|jk|just kidding|get it\?|see what i did there|that's the joke|funny,? right\?|😂|🤣)(?![\p{L}])/giu,
      level: 'bad',
      fixes: [DELETE],
      note: (h) => `${quote(h.text)} explains the joke. Cut it and trust the punchline.`,
      grade: (n) => ({ status: n ? 'fail' : 'pass', summary: n ? `${plural(n, 'self-laugh')} found.` : 'You let the jokes speak for themselves.' }),
    }),

    {
      id: 'punch-last',
      title: 'Punch word at the end',
      group: 'Comedy rules',
      why: 'The laugh comes on the surprise, so the surprising word should be the last thing the audience hears. Anything after it (“…or something”, “…though”) steps on the laugh.',
      run(ctx) {
        const marks = [];
        let weak = 0;
        let soft = 0;
        const list = bits(ctx);
        for (const p of list) {
          const s = p.sentences[p.sentences.length - 1];
          const tail = s.text.match(WEAK_TAIL);
          if (tail) {
            weak++;
            const start = s.start + tail.index;
            const trailing = tail[0].match(/[.!?…"'”’)]*$/)[0].length;
            const m = mark({ start: start + (tail[0].match(/^[,\s]*/)[0].length), end: s.end - trailing }, 'bad', `${quote(tail[0].replace(/^[,\s]+/, '').replace(/[.!?…"'”’)]+$/, ''))} after the punch kills the laugh. End on the surprise.`);
            m.fixes = [DELETE];
            marks.push(m);
            continue;
          }
          const last = s.words[s.words.length - 1];
          if (last && WEAK_LAST.has(last.lower)) {
            soft++;
            marks.push(mark(last, 'warn', `The bit ends on ${quote(last.text)}. Rearrange so the funniest word lands last.`));
          } else if (last) {
            marks.push(mark(last, 'good', `Ends on ${quote(last.text)}. If that's the surprise, it's in the right spot.`));
          }
        }
        if (!list.length) return { status: 'na', summary: 'Write a joke with a setup and a punchline (separate bits with a blank line).', marks };
        return {
          status: weak ? 'fail' : soft ? 'warn' : 'pass',
          summary: weak || soft ? `${weak + soft} of ${plural(list.length, 'bit')} bury the punch.` : `All ${plural(list.length, 'bit')} end on a strong word.`,
          marks,
        };
      },
    },

    {
      id: 'setup-economy',
      title: 'Lean setups',
      group: 'Comedy rules',
      why: 'Brevity is the soul of wit. A setup only needs who, where and what’s wrong. Every extra word delays the laugh and drains the tension the punchline releases.',
      run(ctx) {
        const marks = [];
        const list = bits(ctx);
        let long = 0;
        for (const p of list) {
          const punch = p.sentences[p.sentences.length - 1];
          const setupWords = p.words.filter((w) => w.end <= punch.start).length;
          if (setupWords > 50) {
            long++;
            marks.push(mark(p.sentences[0], 'warn', `This setup runs ${setupWords} words before the punch. What can go?`));
          }
        }
        for (const s of ctx.sentences) {
          if (s.words.length > 22) marks.push(mark(s, 'bad', `${s.words.length} words in one breath. Spoken comedy needs shorter lines.`));
        }
        const longSentences = marks.filter((m) => m.level === 'bad').length;
        return {
          status: long === 0 && longSentences === 0 ? 'pass' : long + longSentences <= 2 ? 'warn' : 'fail',
          summary: long || longSentences ? `${plural(long, 'long setup')}, ${plural(longSentences, 'long sentence')}.` : 'Setups are tight.',
          marks,
        };
      },
    },

    {
      id: 'rule-of-three',
      title: 'Rule of three',
      group: 'Comedy tools',
      why: 'Two items set a pattern; the third breaks it. “I packed sunscreen, a towel, and my ex’s ashes.” Lists of exactly three are the most reliable joke shape in comedy.',
      run(ctx) {
        const re = /((?:[^,.!?;:\n]+,\s*){2,})(?:and|or)\s+([^,.!?;:\n]+)/gi;
        const marks = [];
        let threes = 0;
        let longer = 0;
        for (const h of T.findAll(ctx, re)) {
          const items = h.groups[1].split(',').map((x) => x.trim()).filter(Boolean);
          const n = items.length + 1;
          const middleOk = items.slice(1).every((x) => x.split(/\s+/).length <= 7);
          if (!middleOk || items[0].split(/\s+/).length > 14) continue;
          if (n === 3) {
            threes++;
            const lastStart = h.start + h.text.length - h.groups[2].length;
            marks.push(mark({ start: lastStart, end: h.end }, 'good', 'Third item of a rule-of-three. Make it the one that breaks the pattern.'));
          } else {
            longer++;
            marks.push(mark(h, 'warn', `A list of ${n}. Three lands harder; cut the weakest item.`));
          }
        }
        return {
          status: threes ? (longer ? 'warn' : 'pass') : 'info',
          summary: threes ? `${plural(threes, 'rule-of-three list')}` + (longer ? `, ${plural(longer, 'list')} with too many items.` : '.') : 'No three-item lists yet. Try one where the third item is the twist.',
          marks,
        };
      },
    },

    {
      id: 'specificity',
      title: 'Specific beats vague',
      group: 'Comedy tools',
      why: 'Specific is funny. “A car” is nothing; “a 2009 Honda Civic with one working door” is a picture. Names, numbers and brands make the audience see it.',
      run(ctx) {
        const vague = T.findAll(ctx, T.phraseRegex(['thing', 'things', 'stuff', 'something', 'someone', 'somebody', 'somewhere', 'a lot', 'various', 'whatever', 'nice', 'interesting', 'amazing', 'some guy', 'this place', 'food', 'a car', 'a store']));
        const marks = vague.map((h) => mark(h, 'warn', `${quote(h.text)} is vague. What exactly? Give it a name, a brand, a number.`));
        let specific = 0;
        for (const s of ctx.sentences) {
          s.words.forEach((w, i) => {
            const proper = i > 0 && /^\p{Lu}/u.test(w.text) && w.lower !== 'i' && !/^i'/.test(w.lower);
            if (/\d/.test(w.text) || proper) {
              specific++;
              marks.push(mark(w, 'good', `${quote(w.text)} is specific. The audience can picture it.`));
            }
          });
        }
        const status = vague.length === 0 ? 'pass' : specific >= vague.length ? 'warn' : 'fail';
        return { status, summary: `${plural(specific, 'specific detail')}, ${plural(vague.length, 'vague word')}.`, marks };
      },
    },

    C.phrases({
      id: 'attitude',
      title: 'Attitude',
      group: 'Comedy tools',
      why: 'Stand-up starts with an opinion. Judy Carter’s Comedy Bible boils attitude down to four words: weird, scary, hard, stupid. “Dating is hard because…” gives the audience a reason to listen.',
      list: ATTITUDE,
      level: 'good',
      note: (h) => `Attitude: ${quote(h.text)}. Now prove it with a specific example.`,
      grade(n, ctx, hits) {
        const list = bits(ctx);
        const withAttitude = list.filter((p) => hits.some((h) => h.start >= p.start && h.end <= p.end)).length;
        if (!list.length) return { status: 'na', summary: 'Write a bit first.' };
        return {
          status: withAttitude >= list.length / 2 ? 'pass' : n ? 'warn' : 'fail',
          summary: n ? `${withAttitude} of ${plural(list.length, 'bit')} state an attitude.` : 'No attitude yet. What about this topic is weird, scary, hard or stupid?',
        };
      },
    }),

    {
      id: 'turn',
      title: 'Twist in the punchline',
      group: 'Comedy tools',
      why: 'A punchline reinterprets the setup. Words like “but”, “until”, “turns out” or “except” often mark the moment the audience’s assumption flips.',
      run(ctx) {
        const list = bits(ctx);
        const re = T.phraseRegex(TURN_WORDS);
        const marks = [];
        let turned = 0;
        for (const p of list) {
          const punch = p.sentences[p.sentences.length - 1];
          const prev = p.sentences[p.sentences.length - 2];
          const zone = prev ? { start: prev.start, end: punch.end } : punch;
          const hits = T.findAll(ctx, re, zone);
          if (hits.length) {
            turned++;
            hits.forEach((h) => marks.push(mark(h, 'good', `Turn: ${quote(h.text)} flips the setup. The words after it should surprise.`)));
          }
        }
        if (!list.length) return { status: 'na', summary: 'Write a bit first.', marks };
        return {
          status: turned >= list.length / 2 ? 'pass' : 'warn',
          summary: `${turned} of ${plural(list.length, 'bit')} have a clear turn near the punch.`,
          marks,
        };
      },
    },

    {
      id: 'density',
      title: 'Laugh density',
      group: 'Comedy rules',
      minWords: 60,
      why: 'Club comics aim for a laugh every 15–20 seconds of stage time, about every 40–50 spoken words. Long stretches without a punchline lose the room.',
      run(ctx) {
        const list = bits(ctx);
        if (!list.length) return null;
        const avg = list.reduce((a, p) => a + p.words.length, 0) / list.length;
        const marks = list.filter((p) => p.words.length > 110).map((p) => mark(p.sentences[0], 'warn', `This bit runs ${p.words.length} words. Find a punchline in the middle, or split it.`));
        return {
          status: band(avg, 60, 110),
          summary: `About ${Math.round(avg)} words per bit (≈ ${Math.round((avg / 150) * 60)} seconds on stage).`,
          marks,
        };
      },
    },

    {
      id: 'callbacks',
      title: 'Callbacks',
      group: 'Comedy tools',
      minWords: 80,
      why: 'A callback brings back something from an earlier joke in a new context. It rewards the audience for paying attention and is often the biggest laugh of a set.',
      run(ctx) {
        const last = new Map();
        const marks = [];
        for (const w of ctx.words) {
          if (w.lower.length < 5 || WP.lex.stopwords.has(w.lower)) continue;
          const key = w.lower.replace(/s$/, '');
          const prev = last.get(key);
          if (prev && w.paragraph - prev.paragraph >= 2) {
            marks.push(mark(w, 'good', `Callback to ${quote(prev.text)} from an earlier bit.`));
          }
          last.set(key, w);
        }
        return {
          status: marks.length ? 'pass' : 'info',
          summary: marks.length ? `${plural(marks.length, 'callback')} spotted.` : 'No callbacks yet. Can a closing bit bring back an image from your opener?',
          marks,
        };
      },
    },

    C.phrases({
      id: 'act-out',
      title: 'Act-outs',
      group: 'Comedy tools',
      minWords: 40,
      why: 'An act-out shows the moment instead of describing it: you become the character and say their line. It turns “my dad was confused” into a performance.',
      re: /(“[^”\n]{2,}”|"[^"\n]{2,}"|\b(?:i'm like|i was like|he's like|she's like|they're like|he was like|she was like|and i go|and he goes|and she goes|imagine)\b)/gi,
      level: 'good',
      note: 'Act-out: you are showing the moment. Commit to the voice.',
      grade: (n) => ({
        status: n ? 'pass' : 'info',
        summary: n ? `${plural(n, 'act-out')} found.` : 'No act-outs yet. Where can you say what someone actually said?',
      }),
    }),

    C.filler({ ok: 1.5, warn: 3 }),
    C.cliches(),
  ];

  const frameworks = [
    {
      id: 'setup-punch',
      name: 'Setup → Punchline',
      summary: 'The atom of comedy. The setup creates an expectation; the punchline breaks it.',
      bestFor: 'One-liners, tweets, short jokes',
      minWordsPerBeat: 4,
      beats: [
        { name: 'Setup', hint: 'State a normal situation in as few words as possible. Lead the audience to assume something.', min: 6 },
        { name: 'Punchline', hint: 'Reveal a second meaning that flips the assumption. Put the surprise word last.', min: 3 },
        { name: 'Tag', hint: 'Optional: a second punchline on the same setup. Tags squeeze more laughs out of one premise.', min: 3 },
      ],
      example: `## Setup\nI told my therapist I keep thinking I'm a deck of cards.\n\n## Punchline\nShe said she'd deal with me later.\n\n## Tag\nWhich is fine. I've always been a little shuffled.`,
    },
    {
      id: 'dean',
      name: 'Joke Structure (Greg Dean)',
      summary: 'From Greg Dean’s “Step by Step to Stand-Up Comedy”: a setup hides a target assumption, and the punch reveals a reinterpretation.',
      bestFor: 'Understanding why a joke works, fixing jokes that fall flat',
      minWordsPerBeat: 4,
      beats: [
        { name: 'Setup', hint: 'The words that create a first story in the audience’s head.' },
        { name: 'Target assumption', hint: 'Note to self: what does the audience assume? (Write it as a > note, it stays off stage.)', min: 0 },
        { name: 'Connector', hint: 'The word or idea that can be read two ways.', min: 0 },
        { name: 'Reinterpretation', hint: 'The second, unexpected reading of the connector.', min: 0 },
        { name: 'Punch', hint: 'The line that reveals the reinterpretation. Keep it short. Surprise word last.' },
      ],
      example: `## Setup\nMy grandfather has the heart of a lion.\n\n## Target assumption\n> The audience assumes "heart of a lion" means brave.\n\n## Connector\n> "Heart of a lion"\n\n## Reinterpretation\n> He literally has a lion's heart.\n\n## Punch\nAnd a lifetime ban from the Denver Zoo.`,
    },
    {
      id: 'standup-bit',
      name: 'Stand-up Bit',
      summary: 'Based on Judy Carter’s “Comedy Bible” method: topic, attitude, premise, act-out, mix, button.',
      bestFor: 'Building a 1–3 minute stand-up chunk from real life',
      beats: [
        { name: 'Topic', hint: 'Something you know well that bugs you: your job, family, body, city.', min: 5 },
        { name: 'Attitude', hint: 'Is it weird, scary, hard or stupid? Say it out loud: “Dating apps are stupid.”', min: 5 },
        { name: 'Premise', hint: 'The insight behind the attitude. “…because they turned romance into a job interview.”' },
        { name: 'Act-out', hint: 'Show it. Become the people involved and say their lines.' },
        { name: 'Mix', hint: 'Combine two unrelated things: what if a job interview really ran your date?' },
        { name: 'Button', hint: 'A final punch or callback that ends the bit with a laugh.', min: 5 },
      ],
      example: `## Topic\nDating apps.\n\n## Attitude\nDating apps are stupid. Nobody tells you how stupid.\n\n## Premise\nThey turned romance into a job interview, except nobody is hiring.\n\n## Act-out\nEvery first date is the same. She looks up from her phone and goes, "So where do you see yourself in five years?" I'm like, "Honestly? Still on this app."\n\n## Mix\nWhat if dates had HR? A woman named Linda just sits at the end of the table taking notes. "He ordered for you. That's a write-up."\n\n## Button\nLinda's the only one who ever called me back.`,
    },
    {
      id: 'rule-of-three',
      name: 'Rule of Three',
      summary: 'Two items create a pattern, the third breaks it.',
      bestFor: 'Lists, one-liners, adding a laugh to any sentence',
      minWordsPerBeat: 2,
      beats: [
        { name: 'Pattern item 1', hint: 'A normal, expected item.', min: 1 },
        { name: 'Pattern item 2', hint: 'Another normal item in the same category. The rhythm is set.', min: 1 },
        { name: 'Break', hint: 'The third item: same rhythm, wrong category. The surprise lives here.', min: 1 },
      ],
      example: `## Pattern item 1\nFor my birthday I asked for a watch,\n\n## Pattern item 2\na new wallet,\n\n## Break\nand for my brother to finally return my kidney.`,
    },
    {
      id: 'game-of-scene',
      name: 'Sketch: Game of the Scene',
      summary: 'Improv and sketch structure taught at the Upright Citizens Brigade: find the first unusual thing, then heighten it.',
      bestFor: 'Sketches, comedic scenes, funny short videos',
      beats: [
        { name: 'Base reality', hint: 'Who are these people, where are they, what are they doing? Keep it normal.' },
        { name: 'First unusual thing', hint: 'One thing that breaks the normal world. This is your game.' },
        { name: 'Reaction', hint: 'A normal character notices and reacts. The audience needs a straight person.' },
        { name: 'Heighten 1', hint: 'Do the unusual thing again, bigger.' },
        { name: 'Heighten 2', hint: 'Bigger again. Raise the stakes or the cost.' },
        { name: 'Heighten 3', hint: 'The most extreme version. It must still follow the game’s logic.' },
        { name: 'Button', hint: 'End on a final twist or a callback. Then get out.', min: 5 },
      ],
      example: `## Base reality\nA barista takes an order at a quiet coffee shop.\n\n## First unusual thing\nThe customer orders a latte and asks the barista to "make it emotionally available."\n\n## Reaction\nBARISTA: "I'm sorry, the latte?" CUSTOMER: "My last one ghosted me. Went cold in ten minutes."\n\n## Heighten 1\nHe asks if the croissant has "done the work" on itself.\n\n## Heighten 2\nHe wants to meet the coffee beans' parents before committing to a large.\n\n## Heighten 3\nHe proposes to the oat milk. On one knee. With a ring made from a stirrer.\n\n## Button\nBARISTA: "That'll be $6.50." CUSTOMER: "Can we split it? I'm not ready for that kind of commitment."`,
    },
    {
      id: 'observational',
      name: 'Observational',
      summary: 'Notice something everyone does but nobody says out loud, then exaggerate it.',
      bestFor: 'Relatable everyday material',
      beats: [
        { name: 'Shared experience', hint: '“You ever notice…” Pick something your audience has lived through.' },
        { name: 'Specific detail', hint: 'Zoom in on the tiny, true detail nobody mentions.' },
        { name: 'Exaggeration', hint: 'Push the detail to absurd extremes.' },
        { name: 'Act-out', hint: 'Play the moment. Voices, inner monologue, the other person.' },
        { name: 'Tag', hint: 'One more punch on the same idea.', min: 4 },
      ],
      example: `## Shared experience\nHave you ever noticed nobody knows what to do in an elevator?\n\n## Specific detail\nTen strangers, all staring at the numbers like it's the season finale.\n\n## Exaggeration\nWe watch that little screen harder than surgeons watch a heart monitor. Floor four. Is he gonna make it? Floor five! He's stable!\n\n## Act-out\nThen someone gets on and says "Going up?" and we all go silent, like "Who's asking? Are you a cop?"\n\n## Tag\nThe only thing worse is when the door opens and nobody's there. Ten adults, all suddenly believing in ghosts.`,
    },
  ];

  WP.genres.push({
    id: 'comedy',
    name: 'Comedy',
    tagline: 'Stand-up, one-liners and sketches',
    checks,
    frameworks,
    prompts: [
      'Write three jokes about the most useless appliance in your kitchen.',
      'What is weird about the way your family celebrates birthdays?',
      'Write a bit about the last time you pretended to understand something.',
      'Your phone autocorrected a message at the worst possible moment. Write the bit.',
      'What is scary about being an adult that nobody warned you about?',
      'Write a rule-of-three joke about your morning routine.',
      'Pick a job you have had. What is stupid about it?',
      'Write an act-out of your parent trying to use a new app.',
      'What is hard about making friends after school ends?',
      'Write a one-liner that starts with “My doctor told me…”',
      'Observe: what does everybody do at a buffet that nobody talks about?',
      'Write a sketch where a customer service agent takes their job far too personally.',
      'What is the dumbest argument you have ever won?',
      'Write about a hobby you quit after one day.',
      'Pick a common phrase and take it literally. What happens?',
    ],
    generator: {
      template: 'Something {attitude} about {topic}: {angle}.',
      parts: {
        attitude: ['weird', 'scary', 'hard', 'stupid'],
        topic: ['group chats', 'self-checkout machines', 'your first job', 'gym memberships', 'family WhatsApp', 'airports', 'smart speakers', 'online reviews', 'dentists', 'weddings', 'house plants', 'passwords', 'meal prepping', 'your neighbors', 'public transport', 'job interviews'],
        angle: ['take it literally', 'imagine it run by your grandmother', 'treat it like a crime documentary', 'explain it to an alien', 'make it a job with an HR department', 'what would a toddler think?', 'it suddenly becomes an Olympic sport', 'give it a dramatic movie trailer voice'],
      },
    },
    nudges: [
      'What about this topic makes you angry, confused or embarrassed? Start there.',
      'Say your setup out loud. Which word could mean two different things?',
      'What would the worst possible person say in this situation?',
      'Make it more specific: replace one general word with a brand, a name or a number.',
      'What is the opposite of what the audience expects you to say next?',
      'Is there a list in this bit? Make it three items and make the last one wrong.',
      'Act it out: what did the other person actually say, word for word?',
      'Could a bit near the end call back to your first joke?',
      'What is the truth here that people think but never say?',
      'Exaggerate it ten times. Then ten times again.',
    ],
    guide: {
      intro: 'Comedy is surprise plus truth. The audience follows a setup, builds an assumption, and the punchline shatters it in a way that still makes sense. You do not need to be “a funny person”; you need structure and honest observations.',
      principles: [
        { title: 'Setup creates an assumption, punch breaks it', body: 'Every joke leads the audience down one path and then reveals a second path that was hidden all along. If the punchline can be predicted, it is not a punchline yet.' },
        { title: 'The funny word goes last', body: 'Rearrange the punch so the word that carries the surprise is the final word. “Then she married my dad” beats “She married my dad, then.”' },
        { title: 'Brevity', body: 'Cut every word the joke survives without. Tension builds during the setup; a long setup lets it leak away.' },
        { title: 'Specificity', body: 'Specific details are funnier than general ones and make the scene real. “A Volvo” beats “a car”; “Gary from accounting” beats “a guy”.' },
        { title: 'Attitude', body: 'State how you feel about the topic. Weird, scary, hard or stupid are reliable starting points because they create conflict.' },
        { title: 'Rule of three', body: 'Establish a pattern with two items, break it with the third. Keep the rhythm identical so the break hits harder.' },
        { title: 'Heighten, don’t switch', body: 'In sketches, once you find the funny thing (the game), repeat it with rising stakes rather than introducing new random jokes.' },
        { title: 'Callbacks', body: 'Bring back an earlier joke in a new context, especially at the end. It makes a set feel built rather than listed.' },
      ],
      mistakes: [
        'Explaining the joke after the punchline.',
        'Adding words after the punch word (“…or something”).',
        'Setups that take a minute to get going.',
        'Being vague: “stuff”, “a thing”, “some place”.',
        'Punching down at people with less power instead of up or at yourself.',
        'Switching games in a sketch instead of heightening the one that works.',
      ],
      glossary: [
        { term: 'Setup', def: 'The part of the joke that creates an expectation.' },
        { term: 'Punchline', def: 'The line that breaks the expectation and gets the laugh.' },
        { term: 'Tag', def: 'An extra punchline on the same setup, said right after the first.' },
        { term: 'Callback', def: 'A reference to an earlier joke later in the set.' },
        { term: 'Act-out', def: 'Performing a character or moment instead of describing it.' },
        { term: 'Premise', def: 'The insight or opinion a bit is built on.' },
        { term: 'Game', def: 'In sketch and improv: the one unusual pattern a scene repeats and heightens.' },
        { term: 'Button', def: 'The final line that ends a bit or scene on a laugh.' },
        { term: 'Bombing', def: 'When a joke or set gets no laughs. Every comic does it; it is how jokes get rewritten.' },
      ],
    },
    sample: {
      title: 'Example: Self-checkout bit',
      framework: 'standup-bit',
      text: `> Example draft. Edit it, break it, and watch the highlights change.

Self-checkout machines are stupid. Nobody tells you how stupid.

I went to buy a banana. One banana. The machine goes, "Unexpected item in the bagging area." It's a banana. What were you expecting, a lawyer?

Then it calls a human to come help me. Which is basically really the whole point of the machine, I guess.

The worker shows up and taps the screen like it owes her money. She doesn't even look at me. She just sighs, scans her badge, and walks away, which is honestly how my last three relationships ended or something.

So now I pay for groceries, I bag my own groceries, and I get judged by a robot. At this point they should be paying me, giving me a name tag, and offering me dental.

Next time I'm bringing a lawyer. Just to put him in the bagging area and see what happens.`,
    },
  });
})(window.WP = window.WP || {});
