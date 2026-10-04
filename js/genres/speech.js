(function (WP) {
  'use strict';
  const T = WP.text;
  const lex = WP.lex;
  const { C, mark, plural, quote, DELETE } = WP.checks;

  const WPM = 130; // speeches are delivered slower than video narration

  const FLAT_OPENING = /^(?:hi|hello|good (?:morning|afternoon|evening)|thank you(?: so much)? for (?:having|inviting) me|thanks for having me|my name is|today i(?:'m| am| will|'ll)? (?:going to |gonna )?(?:talk|speak)|i(?:'m| am) here (?:today )?to (?:talk|speak)|i want to (?:talk|speak) (?:to you )?about|the topic of my (?:speech|talk))\b[^.!?]*/i;

  const SIGNPOSTS = ['first', 'second', 'third', 'finally', "here's why", 'here is why', 'let me tell you', 'the point is',
    "here's the thing", 'so what does this mean', 'which brings me to', 'that brings me to', 'my second point',
    'my last point', 'in other words', "let's start with", 'imagine', 'think about', 'picture this'];

  const STORY = ['when i was', 'years ago', 'one day', 'i remember', 'last year', 'last summer', 'last week', 'the first time',
    'a few months ago', 'one night', 'one morning', 'back then', 'i was standing', 'i still remember'];

  const checks = [
    C.structure(),

    {
      id: 'speech-opening',
      title: 'Open strong',
      group: 'Delivery',
      minWords: 8,
      why: 'The first ten seconds decide whether the room listens. “Thank you for having me” and “Today I’m going to talk about…” waste them. Start with a story, a question, a surprising fact or a bold line. Thank the host after.',
      run(ctx) {
        const first = ctx.sentences[0];
        const m = first.text.match(FLAT_OPENING);
        if (m && m.index === 0) {
          return {
            status: 'fail',
            summary: 'The speech opens with a formality instead of a hook.',
            marks: [mark({ start: first.start, end: first.start + m[0].length }, 'bad', 'Flat opening. Lead with your hook; thank people or introduce yourself a few lines later.')],
          };
        }
        const signals = T.findAll(ctx, /\b(you|imagine|picture|what if|why|how|\d[\d,.%]*)\b|\?/gi, first);
        return {
          status: signals.length ? 'pass' : 'warn',
          summary: signals.length ? 'The opening pulls the audience in.' : 'The opening avoids clichés. Could it be a question, a story or a striking fact?',
          marks: signals.map((h) => mark(h, 'good', 'Hook signal in your first line.')),
        };
      },
    },

    {
      id: 'speech-runtime',
      title: 'Speaking time',
      group: 'Delivery',
      minWords: 1,
      why: `Speeches are delivered at about ${WPM} words per minute, slower than conversation, with pauses. A wedding toast runs 2–3 minutes (300–400 words); a TED talk is at most 18 minutes.`,
      run(ctx) {
        const secs = Math.round((ctx.wordCount / WPM) * 60);
        const pauses = ctx.cues.filter((c) => /pause|beat|breath/i.test(c.text)).length;
        return {
          status: 'info',
          summary: `≈ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} at ${WPM} words/min · ${plural(pauses, 'planned pause')}.`,
          marks: ctx.cues.filter((c) => /pause|beat|breath/i.test(c.text)).map((c) => mark(c, 'good', 'Planned pause. Silence gives the line time to land.')),
        };
      },
    },

    C.longSentences({
      max: 20,
      title: 'Sayable sentences',
      why: 'Listeners hear a sentence once. Over about 20 words, they lose the thread and you run out of breath. Short sentences sound confident.',
      note: 'Too long to say in one breath. Split it.',
    }),

    C.phrases({
      id: 'signposts',
      title: 'Signposting',
      group: 'Structure',
      minWords: 150,
      why: 'Readers can see paragraphs; listeners can’t. Tell the audience where they are: “First…”, “Here’s why…”, “Which brings me to…”. It feels repetitive on paper and clear out loud.',
      list: SIGNPOSTS,
      level: 'good',
      note: 'Signpost: the audience knows where they are in your talk.',
      grade: (n, ctx) => ({
        status: n >= Math.max(2, Math.floor(ctx.wordCount / 200)) ? 'pass' : n ? 'warn' : 'fail',
        summary: n ? `${plural(n, 'signpost')}.` : 'No signposts. Number your points out loud: “First… Second… Finally…”.',
      }),
    }),

    {
      id: 'triads',
      title: 'Rule of three',
      group: 'Rhetoric',
      minWords: 60,
      why: 'Three is the most memorable number in speech: “Government of the people, by the people, for the people.” Group ideas, adjectives and phrases in threes.',
      run(ctx) {
        const re = /((?:[^,.!?;:\n]+,\s*){2,})(?:and|or)\s+([^,.!?;:\n]+)/gi;
        const marks = [];
        for (const h of T.findAll(ctx, re)) {
          const items = h.groups[1].split(',').map((x) => x.trim()).filter(Boolean);
          if (items.length + 1 === 3 && items.slice(1).every((x) => x.split(/\s+/).length <= 7)) {
            marks.push(mark(h, 'good', 'A triad. Three items are easy to remember and satisfying to hear.'));
          }
        }
        return {
          status: marks.length ? 'pass' : 'warn',
          summary: marks.length ? `${plural(marks.length, 'triad')}.` : 'No groups of three yet. Try listing three reasons, three images or three words.',
          marks,
        };
      },
    },

    {
      id: 'anaphora',
      title: 'Repetition for emphasis',
      group: 'Rhetoric',
      minWords: 80,
      why: 'Starting several sentences with the same words (“We will… We will… We will…”) is called anaphora. On paper it looks repetitive; in a speech it builds power. Martin Luther King Jr. repeated “I have a dream” eight times.',
      run(ctx) {
        const marks = [];
        const key = (s) => s.words.slice(0, 2).map((w) => w.lower).join(' ');
        for (let i = 1; i < ctx.sentences.length; i++) {
          const a = ctx.sentences[i - 1];
          const b = ctx.sentences[i];
          if (a.words.length >= 2 && b.words.length >= 2 && key(a) === key(b)) {
            marks.push(mark({ start: b.words[0].start, end: b.words[1].end }, 'good', `Repeated opening “${key(b)}” builds rhythm.`));
          }
        }
        return {
          status: marks.length ? 'pass' : 'info',
          summary: marks.length ? `${plural(marks.length, 'repeated opening')}.` : 'No deliberate repetition yet. Try starting two or three sentences with the same phrase at your key moment.',
          marks,
        };
      },
    },

    C.phrases({
      id: 'speech-story',
      title: 'A story',
      group: 'Connection',
      minWords: 120,
      why: 'People forget statistics and remember stories. A short, specific personal story (“Last summer, I…”) makes your point human and makes the audience trust you.',
      list: STORY,
      level: 'good',
      note: 'Story opener. Keep it specific: a time, a place, a detail.',
      grade: (n) => ({
        status: n ? 'pass' : 'warn',
        summary: n ? `${plural(n, 'story moment')}.` : 'No story yet. What happened to you that proves your point?',
      }),
    }),

    {
      id: 'speech-audience',
      title: 'Speak to the room',
      group: 'Connection',
      minWords: 60,
      why: 'Say “you” and “we” to bring the audience in. A speech full of “I” sounds like a diary read aloud.',
      run(ctx) {
        const you = T.findAll(ctx, new RegExp(lex.youWords.source, 'gi')).length + T.findAll(ctx, new RegExp(lex.weWords.source, 'gi')).length;
        const me = T.findAll(ctx, new RegExp(lex.meWords.source, 'gi')).length;
        return {
          status: you >= me ? 'pass' : you >= me / 2 ? 'warn' : 'fail',
          summary: `“You/we” ${you} times vs “I/me” ${me} times.`,
          marks: [],
        };
      },
    },

    {
      id: 'speech-ending',
      title: 'End on your message',
      group: 'Structure',
      minWords: 80,
      why: 'The last line is what people repeat in the car home. End with your key message, a call to action or a callback to your opening. Never end on “That’s all I have” or “Any questions?”; say your closing line, then open for questions.',
      run(ctx) {
        const last = ctx.paragraphs[ctx.paragraphs.length - 1];
        const weak = T.findAll(ctx, /\b(that's all i have|that’s all i have|that's it|that’s it|any questions\??|i guess that's it|so yeah|thanks for listening|thank you for listening)\b/gi, last);
        const strong = T.findAll(ctx, T.phraseRegex(['remember', 'together', "let's", 'let us', 'raise your glass', 'raise a glass', "here's to", 'here is to', 'cheers', 'join me', 'from now on', 'start today', 'this week', 'tomorrow', 'never forget', 'i dare you', 'try it']), last).slice(0, 2);
        const marks = weak.map((h) => Object.assign(mark(h, 'bad', `${quote(h.text)} lets the energy drain away. End on your strongest line.`), { fixes: [DELETE] }))
          .concat(strong.map((h) => mark(h, 'good', 'Strong closing language.')));
        return {
          status: weak.length ? 'fail' : strong.length ? 'pass' : 'warn',
          summary: weak.length ? 'The speech fizzles out at the end.' : strong.length ? 'The ending lands on a message or a call.' : 'What should the audience remember or do? Say it in your last line.',
          marks,
        };
      },
    },

    C.strongWords(),

    C.filler({ ok: 1.5, warn: 3 }),
    C.readability({ min: 4, max: 8, audience: 'listeners' }),
    C.passive(),
  ];

  const frameworks = [
    {
      id: 'toast',
      name: 'Toast',
      summary: 'Short and warm: connect, tell one story, say something true about them, raise a glass. For weddings, birthdays, retirements.',
      bestFor: 'Weddings, birthdays, farewells (2–3 minutes)',
      beats: [
        { name: 'Opening', hint: 'One line that grabs attention and says who you are to them, without “For those who don’t know me…”.' },
        { name: 'Story', hint: 'One specific story that shows who this person is. A time, a place, a detail.' },
        { name: 'What it shows', hint: 'What does the story say about them? Keep it sincere.' },
        { name: 'Wish', hint: 'What you hope for them next.' },
        { name: 'Raise a glass', hint: 'Ask everyone to stand or raise a glass, then say the toast in a few words.', min: 5 },
      ],
      example: `## Opening\nI have known Priya for twenty-two years, and for twenty of them she has been telling me what to do.\n\n## Story\nWhen we were nine, she organized a strike at summer camp because the pancakes were cold. She made signs. She had demands. By Thursday, the pancakes were hot.\n\n## What it shows\nThat is Priya. When something matters to her, she does not complain. She fixes it, and she brings everyone along.\n\n## Wish\nSam, you have married someone who will fight for you every single day. I hope you both always have hot pancakes and a cause worth making signs for.\n\n## Raise a glass\nPlease raise your glasses. To Priya and Sam: may every Thursday be this good.`,
    },
    {
      id: 'ted',
      name: 'Idea talk (TED-style)',
      summary: 'One idea, built step by step: hook, why it matters, the idea, a story, evidence, and what to do with it.',
      bestFor: 'Talks, keynotes, class presentations (5–18 minutes)',
      beats: [
        { name: 'Hook', hint: 'A story, a question or a surprising fact. No introduction.' },
        { name: 'Why it matters', hint: 'Why should this audience care, right now?' },
        { name: 'The idea', hint: 'Your one idea, in a single sentence the audience could repeat.' },
        { name: 'Story', hint: 'A personal or real story that shows the idea in action.' },
        { name: 'Evidence', hint: 'A fact, study or example that proves it is not just your story.' },
        { name: 'Call to action', hint: 'What should people think or do differently tomorrow?' },
      ],
      example: `## Hook\nHow many of you have a drawer full of chargers for phones you no longer own?\n\n## Why it matters\nThe world throws away more than fifty million tonnes of electronics every year, and a lot of it still works.\n\n## The idea\nRepair is not a skill for experts. It is a habit anyone can start this weekend.\n\n## Story\nLast spring, my toaster died. Instead of buying a new one, I opened it with a screwdriver and a video. The problem was one loose wire. It took eleven minutes.\n\n## Evidence\nAt my local repair café last month, volunteers fixed nine of the twelve broken things people carried in.\n\n## Call to action\nSo this week, before you throw something away, open it. Look inside. You might be eleven minutes away from fixing it.`,
    },
    {
      id: 'monroe',
      name: 'Monroe’s Motivated Sequence',
      summary: 'A persuasive structure from speech professor Alan Monroe (1930s): attention, need, satisfaction, visualization, action.',
      bestFor: 'Persuasive speeches, pitches, debates',
      beats: [
        { name: 'Attention', hint: 'Grab the audience with a story, question or startling fact.' },
        { name: 'Need', hint: 'Show the problem and why it affects them.' },
        { name: 'Satisfaction', hint: 'Present your solution.' },
        { name: 'Visualization', hint: 'Paint the picture: what life looks like if they act, and if they don’t.' },
        { name: 'Action', hint: 'Tell them exactly what to do now.' },
      ],
      example: `## Attention\nRaise your hand if you have ever waited more than twenty minutes for the 14 bus.\n\n## Need\nThat bus carries three thousand students a day, and half of them arrive late at least once a week.\n\n## Satisfaction\nA dedicated bus lane on Main Street would cut the trip from forty minutes to fifteen.\n\n## Visualization\nImagine arriving on time, every day, with time to grab breakfast. Now imagine another year of running for a bus that is already full.\n\n## Action\nSign the petition at the back of the room today, and come to the council meeting on Thursday at six.`,
    },
    {
      id: 'pitch',
      name: 'Elevator pitch',
      summary: 'Thirty to sixty seconds: who you are, the problem, your solution, proof, and the ask.',
      bestFor: 'Networking, interviews, startup pitches',
      minWordsPerBeat: 6,
      beats: [
        { name: 'Hook', hint: 'One line about the problem or a striking result.' },
        { name: 'Problem', hint: 'Who has the problem and how much it costs them.' },
        { name: 'Solution', hint: 'What you do, in plain words.' },
        { name: 'Proof', hint: 'One number or result.' },
        { name: 'Ask', hint: 'What you want from this listener.' },
      ],
      example: `## Hook\nEvery week, small restaurants throw away food worth more than their rent.\n\n## Problem\nThey order by guesswork, so they overbuy, and the extra spoils.\n\n## Solution\nShelfWise reads last month's sales and tells the chef exactly what to order each morning.\n\n## Proof\nOur first ten restaurants cut waste by a third in eight weeks.\n\n## Ask\nI'm looking for two more restaurants to join our pilot. Could I show you a demo next week?`,
    },
    {
      id: 'tell-three',
      name: 'Tell them three times',
      summary: 'The classic teaching structure: tell them what you will tell them, tell them, then tell them what you told them.',
      bestFor: 'Presentations, lessons, briefings',
      beats: [
        { name: 'Preview', hint: 'Say your topic and your three points in one or two sentences.' },
        { name: 'Point 1', hint: 'Explain it, with an example.' },
        { name: 'Point 2', hint: 'Explain it, with an example.' },
        { name: 'Point 3', hint: 'Explain it, with an example.' },
        { name: 'Review', hint: 'Repeat the three points and the one thing to remember.' },
      ],
      example: `## Preview\nIn the next five minutes, I'll show you three ways to remember names: say it, link it, use it.\n\n## Point 1\nFirst, say it back. "Nice to meet you, Marco." Hearing your own voice say a name doubles your chance of remembering it.\n\n## Point 2\nSecond, link it. Marco plays the drums? Picture him drumming on a map, like Marco Polo.\n\n## Point 3\nThird, use it once more before you leave. "Great talking to you, Marco."\n\n## Review\nSay it, link it, use it. Try it on the next three people you meet.`,
    },
  ];

  WP.genres.push({
    id: 'speech',
    name: 'Speech',
    tagline: 'Toasts, talks, presentations and pitches',
    checks,
    frameworks,
    prompts: [
      'Write a two-minute toast for a friend’s birthday, built around one story.',
      'Give a five-minute talk on a skill you taught yourself.',
      'Persuade your class or team to change one small rule.',
      'Write a farewell speech for a coworker who is retiring.',
      'Write a 60-second pitch for an app you wish existed.',
      'Give a talk titled “The best mistake I ever made”.',
      'Write a speech thanking someone who never got enough credit.',
      'Explain why your hobby matters, to people who think it is boring.',
      'Write the opening two minutes of a graduation speech.',
      'Write a toast for a wedding where you barely know the couple.',
      'Persuade your neighbors to start a community garden.',
    ],
    generator: {
      template: 'A {kind} for {audience} about {topic}. Open with {opener}.',
      parts: {
        kind: ['2-minute toast', '5-minute talk', '60-second pitch', 'persuasive speech', 'graduation speech', 'farewell speech'],
        audience: ['your class', 'a wedding party', 'your team at work', 'a room of strangers', 'your family', 'a town meeting'],
        topic: ['learning to fail', 'why we should walk more', 'the person who taught you to cook', 'saying no', 'your first job', 'starting over in a new city', 'being kind online'],
        opener: ['a question to the room', 'a one-line story', 'a surprising number', 'a moment of silence', 'a quote you disagree with', 'an object you hold up'],
      },
    },
    nudges: [
      'What is the one sentence you want people to repeat afterwards?',
      'Which story from your own life proves your point?',
      'Where would you pause for effect? Mark it with [PAUSE].',
      'Read your first line out loud. Would the room look up from their phones?',
      'Can you group your points into three?',
      'What do you want the audience to do tomorrow because of this speech?',
      'Is there a line you could repeat at the start and end?',
      'Cut the warm-up. Does the speech start better at your second paragraph?',
    ],
    guide: {
      intro: 'A speech is writing for the ear. Your audience can’t re-read a sentence, so structure must be obvious, sentences short and the message repeated. Write it, then read it aloud and rewrite everything you stumble on.',
      principles: [
        { title: 'One message', body: 'Every good speech can be summed up in one sentence. Write that sentence first and cut anything that doesn’t serve it.' },
        { title: 'Hook first, thanks later', body: 'Start with a story, a question or a striking fact. Thank the host and introduce yourself after you have their attention.' },
        { title: 'Tell a story', body: 'Stories are how audiences remember. Use one specific, personal story per main point.' },
        { title: 'Signpost', body: 'Say where you are: “First…”, “Here’s why…”, “Finally…”. It sounds clear out loud even though it looks clunky on paper.' },
        { title: 'Rule of three', body: 'Group ideas, examples and phrases in threes. It is the most memorable pattern in speech.' },
        { title: 'Repeat on purpose', body: 'Repetition is a tool in speech: repeat your key line, or start several sentences the same way at your climax.' },
        { title: 'Plan your pauses', body: 'A pause before or after a key line lets it land. Write [PAUSE] into the script.' },
        { title: 'Land the ending', body: 'Finish on your message or a call to action, then stop. Questions come after the closing line, not instead of it.' },
      ],
      mistakes: [
        'Opening with “Thank you for having me” or “Today I’m going to talk about…”.',
        'Too many points: the audience remembers one or two.',
        'Long written sentences that are hard to say.',
        'Reading statistics with no story behind them.',
        'Inside jokes at a toast that half the room won’t get.',
        'Ending with “So… yeah. Any questions?”.',
      ],
      glossary: [
        { term: 'Hook', def: 'The opening line that grabs the audience.' },
        { term: 'Signpost', def: 'A phrase that tells listeners where they are in the speech.' },
        { term: 'Triad', def: 'A group of three words, phrases or ideas.' },
        { term: 'Anaphora', def: 'Starting several sentences with the same words for emphasis.' },
        { term: 'Callback', def: 'Returning to an image or line from the opening at the end.' },
        { term: 'Call to action', def: 'What you ask the audience to do.' },
        { term: 'Toast', def: 'A short speech honoring someone, ending with raised glasses.' },
      ],
    },
    sample: {
      title: 'Example: Retirement toast',
      framework: 'toast',
      text: `> Example draft. Edit it and watch the checks change. Use [PAUSE] to plan a pause.

Good evening everyone, thank you so much for having me here tonight to say a few words about Ray.

For those who don't know me, I have worked with Ray in the accounts department for about fifteen years, and during that time I have learned a lot of things from him that I would like to share with all of you this evening.

I remember my first week. I broke the printer. Ray didn't yell. He handed me a screwdriver, a coffee, and a manual from 1998. [PAUSE] We fixed it together, and he never told anyone.

That is Ray. He fixes things quietly, and he makes you feel like you did it yourself.

Ray, we will miss your patience. We will miss your terrible puns. We will miss your coffee, which was honestly also terrible.

So yeah, that's all I have.`,
    },
  });
})(window.WP = window.WP || {});
