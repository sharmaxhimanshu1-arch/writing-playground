(function (WP) {
  'use strict';
  const T = WP.text;
  const lex = WP.lex;
  const { C, mark, plural, quote, band, DELETE } = WP.checks;

  const WPM = 150; // typical YouTube narration pace

  const GREETING = /^(?:hi|hey|hello|what's up|whats up|what is up|yo|welcome(?: back)?|good (?:morning|afternoon|evening)|my name is|in (?:this|today's|todays) video|before we (?:start|begin|get started|dive in)|today (?:i|we)(?:'m| am| are|'re| will|'ll)? (?:going to|gonna)|so,? (?:today|guys))\b[^.!?]*/i;

  const HOOK_SIGNALS = ['secret', 'mistake', 'mistakes', 'never', 'nobody', 'no one', 'why', 'how', 'stop', 'worst',
    'best', 'truth', 'wrong', 'what if', 'imagine', 'only', 'nobody tells you', 'here is', "here's", 'this is',
    'most people', 'everyone', 'until', 'changed', 'dangerous', 'free', 'fastest', 'easiest', 'hardest'];

  const OPEN_LOOPS = ['stick around', 'later in this video', 'by the end of this video', 'by the end', 'in a minute',
    'in a second', "i'll show you", 'i will show you', 'but first', 'wait until', "here's the thing", 'coming up',
    "we'll get to", 'we will get to', 'keep watching', 'stay until', 'more on that', 'the last one', 'number one',
    "you won't believe", 'the real reason', 'but that’s not', "but that's not", 'there’s a catch', "there's a catch",
    'plot twist', 'spoiler'];

  const CTA = /\b(subscribe|hit (?:the )?(?:like|bell)|like (?:this|the) video|smash (?:that )?like|comment below|leave a comment|drop a comment|let me know in the comments|link (?:is )?in the description|links? below|check out|sign up|download|follow (?:me|us)|join (?:the|our|my)|grab (?:your|the)|share this|watch (?:this|that|the next) video|click (?:here|the|on)|tap (?:the|here))\b/gi;

  function fmtTime(words) {
    const secs = Math.round((words / WPM) * 60);
    return Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
  }

  const checks = [
    C.structure(),

    {
      id: 'hook',
      title: 'Hook in the first seconds',
      group: 'Retention',
      minWords: 8,
      why: 'Viewers decide in the first 5–10 seconds whether to stay. Open with a question, a bold claim, a surprising number or a promise about the viewer, never a greeting. “Welcome back to my channel” is the most skipped sentence on YouTube.',
      run(ctx) {
        const first = ctx.sentences[0];
        const zoneEnd = (ctx.sentences[1] || first).end;
        const marks = [];
        const g = first.text.match(GREETING);
        if (g && g.index === 0) {
          marks.push(mark({ start: first.start, end: first.start + g[0].length }, 'bad', 'Opening with a greeting or intro. Lead with the hook; say hello after you have earned attention.'));
        }
        let signals = 0;
        const zone = { start: first.start, end: zoneEnd };
        const hits = T.findAll(ctx, T.phraseRegex(HOOK_SIGNALS.concat(['you', 'your'])), zone);
        hits.forEach((h) => {
          signals++;
          marks.push(mark(h, 'good', `Hook signal ${quote(h.text)}. It pulls the viewer in.`));
        });
        if (/\?/.test(ctx.masked.slice(zone.start, zone.end))) signals++;
        T.findAll(ctx, /\b\d[\d,.%$]*\b/g, zone).forEach((h) => {
          signals++;
          marks.push(mark(h, 'good', 'A number in the hook makes the promise concrete.'));
        });
        const status = g && g.index === 0 ? 'fail' : signals >= 2 ? 'pass' : signals === 1 ? 'warn' : 'fail';
        const summary = g && g.index === 0 ? 'The script opens with a greeting instead of a hook.'
          : signals >= 2 ? 'Strong opening: it speaks to the viewer and creates curiosity.'
          : 'The opening is flat. Add a question, a number, a bold claim or a “you”.';
        return { status, summary, marks };
      },
    },

    {
      id: 'runtime',
      title: 'Estimated runtime',
      group: 'Pacing',
      minWords: 1,
      why: `Spoken narration runs around ${WPM} words per minute. Use this to hit your target length: Shorts under 60 seconds (~140 words), a typical explainer 8–12 minutes (1,200–1,800 words).`,
      run(ctx) {
        const words = ctx.wordCount;
        let label = 'Long-form';
        if (words <= 150) label = 'Short / Reel length';
        else if (words <= 600) label = 'Short video (1–4 min)';
        else if (words <= 1800) label = 'Standard explainer';
        return { status: 'info', summary: `≈ ${fmtTime(words)} at ${WPM} words/min · ${label}. ${plural(ctx.cues.length, 'visual cue')}.`, marks: [] };
      },
    },

    C.longSentences({
      max: 20,
      title: 'Speakable sentences',
      why: 'A script is read aloud. Sentences over 20 words are hard to say in one breath and harder to follow by ear. Write the way you talk.',
      note: 'Hard to say in one breath. Split it at a comma or an “and”.',
    }),

    {
      id: 'you-focus',
      title: 'Talk to the viewer',
      group: 'Connection',
      minWords: 40,
      why: 'Viewers stay for what is in it for them. Say “you” more than “I”: “You’ll save an hour” lands better than “I found a way to save an hour”.',
      run(ctx) {
        const you = T.findAll(ctx, new RegExp(lex.youWords.source, 'gi'));
        const me = T.findAll(ctx, new RegExp(lex.meWords.source, 'gi'));
        const status = you.length >= me.length ? 'pass' : you.length >= me.length / 2 ? 'warn' : 'fail';
        const marks = status === 'pass' ? [] : me.map((h) => mark(h, 'info', 'Self-focused. Could this be about the viewer instead?'));
        return { status, summary: `“You” ${you.length} times vs “I/me” ${me.length} times.`, marks };
      },
    },

    {
      id: 'cta',
      title: 'Call to action',
      group: 'Conversion',
      minWords: 80,
      why: 'Tell viewers exactly what to do next: subscribe, comment, click a link, watch another video. Ask after you have delivered value, usually near the end, or right after a big payoff.',
      run(ctx) {
        const hits = T.findAll(ctx, CTA);
        const len = ctx.text.length || 1;
        const late = hits.filter((h) => h.start / len >= 0.6);
        const early = hits.filter((h) => h.start / len < 0.15);
        const marks = hits.map((h) => mark(h, early.includes(h) ? 'warn' : 'good', early.includes(h) ? 'A CTA this early asks before giving. Move it after your first payoff.' : `Call to action: ${quote(h.text)}.`));
        return {
          status: !hits.length ? 'fail' : late.length ? (early.length ? 'warn' : 'pass') : 'warn',
          summary: !hits.length ? 'No call to action. What should the viewer do when the video ends?' : late.length ? `${plural(hits.length, 'call to action')}, including one near the end.` : 'Your CTA comes early; add one near the end too.',
          marks,
        };
      },
    },

    C.phrases({
      id: 'open-loops',
      title: 'Open loops',
      group: 'Retention',
      minWords: 120,
      why: 'An open loop promises something later (“…and the third tip is the one that actually worked”). Curiosity keeps people watching through the middle, where most viewers drop off.',
      list: OPEN_LOOPS,
      level: 'good',
      note: 'Open loop: you promised a payoff. Make sure you deliver it.',
      grade: (n, ctx) => ({
        status: n >= Math.max(1, Math.floor(ctx.wordCount / 400)) ? 'pass' : 'warn',
        summary: n ? `${plural(n, 'open loop')}.` : 'No open loops. Tease something coming later to keep viewers past the middle.',
      }),
    }),

    {
      id: 'but-therefore',
      title: 'But / Therefore, not “and then”',
      group: 'Story',
      minWords: 60,
      why: 'South Park creators Trey Parker and Matt Stone’s rule: if beats connect with “and then”, the story is a list. Connect them with “but” or “therefore” so each beat causes the next.',
      run(ctx) {
        const andThen = T.findAll(ctx, /\band then\b/gi);
        const causal = T.findAll(ctx, /(?:^|(?<=[.!?…]\s+)|(?<=\n))(but|so|therefore|which means|that's why|that’s why|because of that|except)\b/gim);
        const marks = andThen.map((h) => Object.assign(mark(h, 'warn', '“And then” just lists events. Could this be “but” (a problem) or “so” (a consequence)?'), { fixes: [{ label: 'Change to “but”', text: 'but' }, { label: 'Change to “so”', text: 'so' }] }))
          .concat(causal.map((h) => mark(h, 'good', `${quote(h.text)} links cause and effect. The story drives itself.`)));
        return {
          status: andThen.length <= 1 || causal.length >= andThen.length * 2 ? 'pass' : 'warn',
          summary: `${plural(causal.length, 'causal link')} vs ${andThen.length} “and then”.`,
          marks,
        };
      },
    },

    {
      id: 'visual-cues',
      title: 'Visual cues',
      group: 'Pacing',
      minWords: 150,
      why: 'Change something on screen every few seconds: B-roll, text, a cut, a graphic. Write them into the script in square brackets, like [B-ROLL: messy desk] or [ON SCREEN: 3 tips], so the edit is planned.',
      run(ctx) {
        const perCue = ctx.cues.length ? ctx.wordCount / ctx.cues.length : Infinity;
        const marks = ctx.cues.map((c) => mark(c, 'good', 'Visual cue. The editor knows what goes on screen here.'));
        return {
          status: perCue <= 120 ? 'pass' : perCue <= 250 ? 'warn' : 'fail',
          summary: ctx.cues.length ? `${plural(ctx.cues.length, 'cue')}, one every ~${Math.round(perCue)} words (~${Math.round((perCue / WPM) * 60)} seconds).` : 'No [visual cues] yet. Add [B-ROLL], [ON SCREEN] or [CUT] notes in brackets.',
          marks,
        };
      },
    },

    {
      id: 'mouthfuls',
      title: 'Easy to say',
      group: 'Clarity',
      minWords: 40,
      why: 'Long words trip the tongue and slow the listener. If a word has four or more syllables, ask whether a shorter one says the same thing.',
      run(ctx) {
        const hits = ctx.words.filter((w) => w.syllables >= 4 && w.text.length >= 9);
        return {
          status: band(WP.checks.per100(hits.length, ctx), 2, 4),
          summary: hits.length ? `${plural(hits.length, 'mouthful')}.` : 'Plain, speakable words.',
          marks: hits.map((w) => mark(w, 'warn', `${quote(w.text)} has ${w.syllables} syllables. Is there a shorter word?`)),
        };
      },
    },

    {
      id: 'segments',
      title: 'Segments',
      group: 'Pacing',
      minWords: 300,
      why: 'Break longer scripts into clear segments (## headings) so the video has chapters, and so you can check that each part earns its place.',
      run(ctx) {
        const per = ctx.wordCount / Math.max(1, ctx.headings.length);
        return {
          status: ctx.headings.length >= 2 && per <= 350 ? 'pass' : ctx.headings.length ? 'warn' : 'fail',
          summary: ctx.headings.length ? `${plural(ctx.headings.length, 'segment')}, ~${Math.round(per)} words each.` : 'No segments. Add ## headings for each part (Hook, Intro, Point 1…).',
          marks: [],
        };
      },
    },

    C.readability({ min: 4, max: 8, audience: 'viewers who are listening, not reading' }),
    C.filler({ ok: 1.5, warn: 3 }),
    C.passive(),
    C.repetition(),
  ];

  const frameworks = [
    {
      id: 'hook-value-cta',
      name: 'Hook · Value · CTA',
      summary: 'The core YouTube structure: grab attention, deliver on the promise in clear segments, then tell viewers what to do next.',
      bestFor: 'Explainers, tips, reviews, any talking-head video',
      beats: [
        { name: 'Hook', hint: '0–10 seconds. A question, bold claim or result that makes the viewer need the answer.' },
        { name: 'Intro', hint: 'Why should they trust you, and what exactly will they get? Keep it under 20 seconds.' },
        { name: 'Point 1', hint: 'First piece of value. Open a loop about what is coming later.' },
        { name: 'Point 2', hint: 'Second piece of value. Use a story or example.' },
        { name: 'Point 3', hint: 'The best one. This is the payoff you teased.' },
        { name: 'Recap', hint: 'One or two sentences that tie it together.', min: 8 },
        { name: 'CTA', hint: 'One clear next action: subscribe, comment, watch the next video.', min: 8 },
      ],
      example: `## Hook\nYou're probably watering your plants wrong, and it's the number one reason they die.\n\n## Intro\nI've killed forty-two plants so you don't have to. Here are three fixes that brought my jungle back.\n[B-ROLL: wall of healthy plants]\n\n## Point 1\nFirst, stop watering on a schedule. Stick a finger two inches into the soil. Dry? Water. Damp? Walk away. But the second fix is the one nobody talks about.\n\n## Point 2\nDrainage. If your pot has no hole, the roots sit in water and rot. [ON SCREEN: pot with hole vs. no hole] So drill a hole or use a nursery pot inside.\n\n## Point 3\nAnd the big one: light beats water. A thirsty plant in a bright window survives. A watered plant in a dark corner dies slowly.\n\n## Recap\nCheck the soil, drain the pot, chase the light.\n\n## CTA\nComment the plant you're trying to save, and I'll tell you what it needs.`,
    },
    {
      id: 'short-form',
      name: 'Short-form (Shorts / Reels / TikTok)',
      summary: 'Built for 15–60 seconds: hook in the first line, payoff fast, and an ending that loops back to the start.',
      bestFor: 'Shorts, Reels, TikTok',
      minWordsPerBeat: 5,
      beats: [
        { name: 'Hook', hint: 'The first 1–3 seconds. A claim, a visual, or “POV:”. No intro.', min: 5 },
        { name: 'Context', hint: 'One sentence that sets up the problem.', min: 5 },
        { name: 'Payoff', hint: 'Deliver the tip, reveal or punchline quickly.', min: 8 },
        { name: 'Loop', hint: 'End with a line that flows back into the first line, so it replays.', min: 4 },
      ],
      example: `## Hook\nThis 10-second trick makes any room look twice as big.\n[B-ROLL: before shot]\n\n## Context\nMost people hang their curtains right on top of the window.\n\n## Payoff\nMount the rod six inches below the ceiling and let the curtains touch the floor. Your eye reads the whole wall as window. [B-ROLL: after shot]\n\n## Loop\nAnd that's why everyone thinks my tiny apartment is huge. This 10-second trick...`,
    },
    {
      id: 'pas-video',
      name: 'Problem · Agitate · Solve',
      summary: 'Name a pain the viewer feels, make it sting, then hand them the fix.',
      bestFor: 'Tutorials, product videos, “how to fix X” content',
      beats: [
        { name: 'Problem', hint: 'Describe the problem in the viewer’s own words.' },
        { name: 'Agitate', hint: 'Show what it costs them: time, money, embarrassment. Make it vivid.' },
        { name: 'Solve', hint: 'Your solution, step by step. Show it working.' },
        { name: 'Proof', hint: 'A result, a before/after, a number.' },
        { name: 'CTA', hint: 'What to do next.', min: 8 },
      ],
      example: `## Problem\nYour phone is at 20% by lunch, every single day.\n\n## Agitate\nYou're hunting for outlets in cafés, carrying a power bank like a brick, and missing calls because your phone died on the bus.\n\n## Solve\nThree settings fix most of it. First, turn on adaptive battery. [ON SCREEN: Settings > Battery] Second, kill background refresh for social apps. Third, drop your screen timeout to 30 seconds.\n\n## Proof\nI did this a week ago. I now end the day at 45%. [ON SCREEN: battery graph]\n\n## CTA\nTry it today and comment your end-of-day battery tomorrow.`,
    },
    {
      id: 'story-video',
      name: 'Story arc (But / Therefore)',
      summary: 'A narrative video where each beat causes the next. Used for vlogs, documentaries and “I tried X for 30 days”.',
      bestFor: 'Vlogs, challenges, mini-docs',
      beats: [
        { name: 'Cold open', hint: 'Start in the most dramatic moment, then rewind.' },
        { name: 'Goal', hint: 'What were you trying to do, and why does it matter?' },
        { name: 'Obstacle', hint: '“But…” what went wrong?' },
        { name: 'Escalation', hint: '“Therefore…” what did you try, and how did it make things worse or better?' },
        { name: 'Climax', hint: 'The moment of truth. Did it work?' },
        { name: 'Lesson', hint: 'What should the viewer take from this?' },
        { name: 'CTA', hint: 'Next video, comment prompt, or subscribe.', min: 8 },
      ],
      example: `## Cold open\nDay 23. It's 5 a.m., it's raining, and I'm about to quit. [B-ROLL: alarm clock, dark window]\n\n## Goal\nA month ago I promised to run every morning for 30 days, because my doctor said my resting heart rate was "concerning".\n\n## Obstacle\nBut on day four I could barely run to the corner.\n\n## Escalation\nSo I stopped trying to run fast and started trying to run slow. Therefore my runs got longer, but my shins started screaming.\n\n## Climax\nDay 30. Five kilometers without stopping. [ON SCREEN: 5.02 km]\n\n## Lesson\nYou don't need motivation. You need a plan so easy you can't say no.\n\n## CTA\nSubscribe, because next month I'm trying cold showers, and that one did not go well.`,
    },
    {
      id: 'listicle-video',
      name: 'Countdown / Listicle',
      summary: 'A numbered list that saves the best for last, with open loops between items.',
      bestFor: 'Top-5s, tips, recommendations',
      beats: [
        { name: 'Hook', hint: 'Promise the list and tease number one.' },
        { name: 'Item 5', hint: 'Good, but not your best.' },
        { name: 'Item 4', hint: 'Add an example.' },
        { name: 'Item 3', hint: 'Open a loop: “but the next one surprised me.”' },
        { name: 'Item 2', hint: 'Strong. Build anticipation for number one.' },
        { name: 'Item 1', hint: 'The payoff the whole video promised.' },
        { name: 'CTA', hint: 'Ask viewers to share their own pick.', min: 8 },
      ],
      example: `## Hook\nHere are five free apps that replaced paid ones on my laptop. Number one saved me $240 a year.\n\n## Item 5\nOBS for screen recording. It does everything Camtasia does, minus the price tag.\n\n## Item 4\nLibreOffice. Not pretty, but it opens every Word file I've ever thrown at it.\n\n## Item 3\nGIMP for photo edits. It has a learning curve, but the next one surprised me most.\n\n## Item 2\nDaVinci Resolve. Hollywood colorists use this. It's free.\n\n## Item 1\nBitwarden. I was paying for a password manager. This one is free, open source, and syncs everywhere. [ON SCREEN: $240/year saved]\n\n## CTA\nWhat free app should be on this list? Tell me in the comments.`,
    },
    {
      id: 'tutorial',
      name: 'Tutorial (Result first)',
      summary: 'Show the finished result first so viewers know it is worth their time, then teach step by step.',
      bestFor: 'How-to, cooking, software, DIY',
      beats: [
        { name: 'Result', hint: 'Show the end result in the first seconds.' },
        { name: 'What you need', hint: 'Tools, ingredients, prerequisites. Keep it quick.' },
        { name: 'Step 1', hint: 'One action per step. Say what to do and why.' },
        { name: 'Step 2', hint: 'Mention the common mistake at this step.' },
        { name: 'Step 3', hint: 'Finish and show it again.' },
        { name: 'Troubleshooting', hint: 'The two questions everyone asks.' },
        { name: 'CTA', hint: 'Ask them to share their result.', min: 8 },
      ],
      example: `## Result\nThis is a no-knead loaf with a crackly crust, and you can make it with four ingredients. [B-ROLL: bread cracking open]\n\n## What you need\nFlour, water, salt, yeast, and a pot with a lid.\n\n## Step 1\nMix three cups of flour, a teaspoon of salt and half a teaspoon of yeast. Add a cup and a half of warm water.\n\n## Step 2\nCover and leave it for twelve hours. The mistake everyone makes is putting it somewhere cold. Find a warm spot.\n\n## Step 3\nBake it in the lidded pot at 230°C for thirty minutes, then lid off for fifteen.\n\n## Troubleshooting\nDense loaf? Your yeast was old. Pale crust? Leave the lid off longer.\n\n## CTA\nBake it this weekend and tag me in a photo of your crumb.`,
    },
  ];

  WP.genres.push({
    id: 'video',
    name: 'Video Script',
    tagline: 'YouTube, Shorts, Reels and explainers',
    checks,
    frameworks,
    prompts: [
      'Script a 60-second Short: “The one habit that changed my mornings.”',
      'Explain something you know well to a complete beginner in under 3 minutes.',
      'Write the first 30 seconds of a video called “I tried ___ for 7 days”.',
      'Script a “5 mistakes beginners make” video for your hobby.',
      'Review the last thing you bought online: worth it or not?',
      'Write a video that answers a question your friends always ask you.',
      'Script a day-in-the-life video with a twist at the end.',
      'Make a tutorial for a recipe you can cook without looking.',
      'Script a myth-busting video: one thing everyone believes that is wrong.',
      'Write a 45-second Reel that teaches one keyboard shortcut.',
      'Script a “before vs after” video about something you improved.',
      'Write a video essay intro about why a childhood cartoon was secretly brilliant.',
    ],
    generator: {
      template: 'A {format} about {topic} for {audience}. Hook idea: “{hook}”',
      parts: {
        format: ['60-second Short', '5-minute explainer', 'top-5 countdown', 'tutorial', '“I tried it for 30 days” vlog', 'myth-busting video', 'reaction-free review'],
        topic: ['saving money on groceries', 'learning a language', 'home workouts', 'budget travel', 'studying smarter', 'cheap phone photography', 'cooking for one', 'decluttering', 'productivity apps', 'sleep'],
        audience: ['complete beginners', 'busy parents', 'college students', 'people who tried and gave up', 'remote workers', 'people on a tight budget'],
        hook: ['You are doing this wrong.', 'Nobody tells you this.', 'I wasted $500 so you don’t have to.', 'This takes 10 seconds.', 'Stop doing this immediately.', 'Here’s what nobody tells you.'],
      },
    },
    nudges: [
      'What will the viewer be able to do after watching that they can’t do now?',
      'What is the single most surprising fact in your topic? Can it be your hook?',
      'Where would a viewer get bored? Add a visual cue or an open loop there.',
      'Read your first sentence out loud. Would you keep watching?',
      'Can you replace a sentence about yourself with a sentence about the viewer?',
      'What would you show on screen during this paragraph?',
      'What is the one action you want viewers to take at the end?',
      'Is there a story (yours or someone else’s) that proves this point?',
      'Connect two beats with “but” or “so” instead of “and then”.',
    ],
    guide: {
      intro: 'A video script is writing for the ear and the eye. People can’t re-read, so sentences must be short and conversational, and something must change on screen every few seconds. Retention (how long people watch) is the score that matters most.',
      principles: [
        { title: 'Hook first, hello later', body: 'The first 5–10 seconds decide if people stay. Open with the promise, the problem or the most interesting moment. Introduce yourself afterwards, briefly.' },
        { title: 'Write how you talk', body: 'Read every line out loud. Contractions, short sentences and simple words sound natural. If you stumble, rewrite.' },
        { title: 'One idea per sentence', body: 'Listeners can’t scan back. Give them one thought at a time.' },
        { title: 'Open loops', body: 'Tease what is coming (“the last tip is the one that actually worked”) so viewers stay through the middle of the video.' },
        { title: 'But / Therefore', body: 'Connect beats with conflict and consequence, not “and then”. It makes even an explainer feel like a story.' },
        { title: 'Plan the visuals', body: 'Write [B-ROLL], [ON SCREEN] and [CUT] cues in brackets. A visual change every 5–15 seconds keeps attention.' },
        { title: 'Talk to one person', body: 'Say “you”, not “you guys” or “everyone”. Each viewer watches alone.' },
        { title: 'One clear CTA', body: 'Ask for one action, at the right moment, usually after a payoff or at the end.' },
      ],
      mistakes: [
        'Opening with “Hey guys, welcome back to my channel”.',
        'Long intros before any value.',
        'Writing in essay sentences that are hard to say aloud.',
        'No visual plan, so the edit is a talking head for ten minutes.',
        'Asking viewers to subscribe before giving them anything.',
        'Several CTAs competing at the end.',
      ],
      glossary: [
        { term: 'Hook', def: 'The opening line or moment that stops the scroll.' },
        { term: 'Retention', def: 'The percentage of the video people actually watch.' },
        { term: 'Open loop', def: 'A question or promise left unresolved to keep viewers watching.' },
        { term: 'B-roll', def: 'Supporting footage shown over narration.' },
        { term: 'Cold open', def: 'Starting in the middle of the action before the intro.' },
        { term: 'CTA', def: 'Call to action: the next step you ask the viewer to take.' },
        { term: 'Pattern interrupt', def: 'A sudden change (cut, sound, zoom, graphic) that re-grabs attention.' },
        { term: 'Payoff', def: 'The moment you deliver what the hook promised.' },
      ],
    },
    sample: {
      title: 'Example: Budget meal-prep video',
      framework: 'hook-value-cta',
      text: `> Example draft. Edit it and watch the checks react.

## Hook
Hey guys, welcome back to my channel, today I'm going to talk about meal prep.

## Intro
I've been meal prepping for about three years and I've learned a lot of things and I really want to share all of the different things I learned with you today so that you can basically save money too.
[B-ROLL: fridge full of containers]

## Point 1
First, cook one grain for the whole week. Rice, quinoa, whatever. And then you portion it out. But the second tip is the one that actually saves the most money.

## Point 2
Buy frozen vegetables. They're picked at peak freshness, they don't go bad, and they cost half as much. [ON SCREEN: $1.20 vs $2.80]

## Point 3
And then the big one: cook proteins two ways. Same chicken, two sauces. So you never get bored by Wednesday.

## Recap
One grain, frozen veg, two sauces.

## CTA
Comment your go-to cheap meal and subscribe for next week's grocery haul.`,
    },
  });
})(window.WP = window.WP || {});
