(function (WP) {
  'use strict';
  const T = WP.text;
  const lex = WP.lex;
  const { C, mark, plural, quote, band, DELETE } = WP.checks;

  const CLAIM = ['should', 'must', 'need to', 'the key', 'the truth is', "here's why", 'here is why', 'this is why',
    'in this post', 'in this article', 'in this essay', "i'll show", 'i will show', "you'll learn", 'you will learn',
    'i argue', 'the real reason', 'the problem is', 'the answer is', 'the best way', 'the secret', 'is not', "isn't",
    'matters because', 'the point is'];

  const EVIDENCE = /\b(according to|a study|studies|research(?:ers)?|survey(?:ed)?|data|report(?:ed)?|for example|for instance|such as|e\.g\.|in \d{4}|percent|\d+(?:[.,]\d+)?\s*%|\d{2,}(?:[.,]\d+)*|one (?:study|survey)|found that|showed that)\b/gi;

  const TAKEAWAY = ['so next time', 'next time', 'remember', 'try', 'start', 'the lesson', "that's why", 'which is why',
    'the takeaway', 'from now on', 'today', 'this week', 'tomorrow', 'your turn', 'so', 'in the end'];

  const MARKED_TRANSITIONS = lex.transitions.filter((t) => !['so', 'then', 'still', 'yet', 'because', 'first', 'next'].includes(t));

  const checks = [
    C.structure(),

    {
      id: 'thesis',
      title: 'Main point up front',
      group: 'Structure',
      minWords: 30,
      why: 'Readers decide in the first paragraph whether to keep going. Tell them what you claim or what they will get, early. A thesis is a sentence someone could disagree with.',
      run(ctx) {
        const p = ctx.paragraphs[0];
        const hits = T.findAll(ctx, T.phraseRegex(CLAIM), p);
        const question = /\?/.test(p.text);
        const marks = hits.map((h) => mark(h, 'good', `Claim signal ${quote(h.text)}. Your reader knows where this is going.`));
        if (p.words.length > 100) marks.push(mark(p.sentences[0], 'warn', `Your opening paragraph runs ${p.words.length} words. Get to the point sooner.`));
        return {
          status: hits.length ? (p.words.length > 100 ? 'warn' : 'pass') : question ? 'warn' : 'fail',
          summary: hits.length ? 'The first paragraph states a clear point.' : question ? 'You open with a question. Answer it with a clear claim in the same paragraph.' : 'No clear thesis in the first paragraph. What is the one thing you want the reader to believe or do?',
          marks,
        };
      },
    },

    {
      id: 'headings',
      title: 'Scannable headings',
      group: 'Structure',
      minWords: 350,
      why: 'Online readers scan before they read. Subheadings (## in this editor) every 200–300 words let them find what they need and make long pieces feel shorter.',
      run(ctx) {
        const per = ctx.wordCount / Math.max(1, ctx.headings.length);
        return {
          status: ctx.headings.length && per <= 300 ? 'pass' : ctx.headings.length ? 'warn' : 'fail',
          summary: ctx.headings.length ? `${plural(ctx.headings.length, 'heading')}, one every ~${Math.round(per)} words.` : 'No headings yet. Add ## subheadings to break the piece into parts.',
          marks: [],
        };
      },
    },

    {
      id: 'transitions',
      title: 'Transitions',
      group: 'Flow',
      minWords: 100,
      why: 'Transitions (“however”, “for example”, “as a result”) show how ideas connect. Without them, paragraphs read like a pile of separate notes.',
      run(ctx) {
        const all = T.findAll(ctx, T.phraseRegex(lex.transitions));
        const shown = T.findAll(ctx, T.phraseRegex(MARKED_TRANSITIONS));
        const ratio = all.length / Math.max(1, ctx.sentences.length);
        return {
          status: ratio >= 0.15 ? 'pass' : ratio >= 0.07 ? 'warn' : 'fail',
          summary: `${plural(all.length, 'transition')} across ${plural(ctx.sentences.length, 'sentence')}.`,
          marks: shown.map((h) => mark(h, 'good', `Transition ${quote(h.text)} links this idea to the last.`)),
        };
      },
    },

    {
      id: 'evidence',
      title: 'Evidence and examples',
      group: 'Persuasion',
      minWords: 150,
      why: 'Claims need support: a number, a source, a concrete example or a short story. One specific example persuades more than three general statements.',
      run(ctx) {
        const hits = T.findAll(ctx, EVIDENCE);
        const target = Math.max(2, Math.floor(ctx.wordCount / 250));
        return {
          status: hits.length >= target ? 'pass' : hits.length ? 'warn' : 'fail',
          summary: hits.length ? `${plural(hits.length, 'piece')} of evidence or examples.` : 'No evidence yet. Add a number, a source or a “for example”.',
          marks: hits.map((h) => mark(h, 'good', `Support: ${quote(h.text)}.`)),
        };
      },
    },

    C.phrases({
      id: 'weasel',
      title: 'Weasel words and hedges',
      group: 'Persuasion',
      why: '“Some people say” and “studies show” sound like evidence but aren’t. “I think that” weakens a claim you already own by writing it. Name the source, or state the claim plainly.',
      list: lex.weasel,
      level: 'warn',
      fixes: (h) => (/^(i think that|i believe that|i feel that|in my opinion|needless to say|it seems that|it appears that|arguably)$/i.test(h.text.replace(/\s+/g, ' ')) ? [DELETE] : []),
      note: (h) => `${quote(h.text)}: who exactly? Name the source or state it directly.`,
      grade: (n) => ({ status: n === 0 ? 'pass' : n <= 2 ? 'warn' : 'fail', summary: n ? `${plural(n, 'hedge')}.` : 'Claims are stated with confidence.' }),
    }),

    {
      id: 'conclusion',
      title: 'Strong ending',
      group: 'Structure',
      minWords: 200,
      why: 'End with a takeaway, a call to action, or a line that circles back to your opening. Skip “In conclusion”: your reader can see it is the end.',
      run(ctx) {
        if (ctx.paragraphs.length < 3) return { status: 'na', summary: 'Needs at least three paragraphs.', marks: [] };
        const last = ctx.paragraphs[ctx.paragraphs.length - 1];
        const announce = T.findAll(ctx, /\b(in conclusion|to sum up|in summary|to conclude|all in all|to summarize|to wrap up)\b/gi, last);
        const take = T.findAll(ctx, T.phraseRegex(TAKEAWAY), last);
        const marks = announce.map((h) => Object.assign(mark(h, 'warn', `${quote(h.text)} announces the ending. Just end.`), { fixes: [DELETE] }))
          .concat(take.slice(0, 3).map((h) => mark(h, 'good', 'Takeaway: the reader leaves with something to do or remember.')));
        return {
          status: take.length ? (announce.length ? 'warn' : 'pass') : 'warn',
          summary: take.length ? 'The last paragraph leaves the reader with a takeaway.' : 'The ending summarizes but doesn’t land. What should the reader do or remember?',
          marks,
        };
      },
    },

    C.readability({ min: 6, max: 10, audience: 'online readers' }),
    C.longSentences({ max: 25 }),
    C.paragraphLength({ max: 100 }),
    C.passive(),
    C.weakOpeners(),
    C.filler(),
    C.cliches(),
    C.repetition(),
  ];

  const frameworks = [
    {
      id: 'hook-thesis',
      name: 'Classic Essay',
      summary: 'Hook, thesis, three supporting points, and a conclusion that goes one step further. The school essay done well.',
      bestFor: 'Opinion pieces, school essays, argument',
      beats: [
        { name: 'Hook', hint: 'A surprising fact, a short story, or a question.' },
        { name: 'Thesis', hint: 'One sentence someone could disagree with. This is your claim.' },
        { name: 'Point 1', hint: 'Your strongest reason, with evidence.' },
        { name: 'Point 2', hint: 'A second reason, with a concrete example.' },
        { name: 'Counterargument', hint: 'The best objection, and why it doesn’t change your conclusion.' },
        { name: 'Conclusion', hint: 'Restate the thesis in new words and say why it matters now.' },
      ],
      example: `## Hook\nMost office workers check email dozens of times a day, including at the dinner table.\n\n## Thesis\nCompanies should ban internal email after 6 p.m., because constant availability makes people worse at their jobs.\n\n## Point 1\nFor example, researchers at Virginia Tech found that the mere expectation of answering email after hours raised employees' anxiety, even on evenings when no email arrived.\n\n## Point 2\nFrance has given workers a "right to disconnect" since 2017. The sky has not fallen.\n\n## Counterargument\nSome teams work across time zones. However, a cutoff can follow the sender's local time, and real emergencies have phones.\n\n## Conclusion\nWe treat attention as unlimited. It isn't. Protecting evenings is not a perk; it's how we get good work in the morning.`,
    },
    {
      id: 'prep',
      name: 'PREP',
      summary: 'Point, Reason, Example, Point. A compact structure for any paragraph, answer or short post.',
      bestFor: 'Short posts, answers, single paragraphs, speeches',
      beats: [
        { name: 'Point', hint: 'State your main point in one sentence.', min: 6 },
        { name: 'Reason', hint: 'Why is this true?' },
        { name: 'Example', hint: 'A specific case, story or number.' },
        { name: 'Point again', hint: 'Restate the point, now proven.', min: 6 },
      ],
      example: `## Point\nEveryone should learn to cook five basic meals.\n\n## Reason\nCooking saves money, improves health, and makes you less dependent on delivery apps that charge you twice for the same food.\n\n## Example\nWhen I learned to make a stir-fry, a chili, an omelette, a pasta and a soup, my food spending dropped from $600 to $280 a month.\n\n## Point again\nFive meals is a weekend of practice, and it pays you back every week.`,
    },
    {
      id: 'inverted-pyramid',
      name: 'Inverted Pyramid',
      summary: 'Journalism’s structure: the most important information first, details after, background last.',
      bestFor: 'News, announcements, updates, emails',
      beats: [
        { name: 'Lede', hint: 'Who, what, when, where, why in one or two sentences.' },
        { name: 'Key details', hint: 'The facts readers need next, most important first.' },
        { name: 'Quote or evidence', hint: 'A voice or source that supports the story.' },
        { name: 'Background', hint: 'Context and history for readers who keep going.' },
      ],
      example: `## Lede\nThe city library will open 24 hours a day starting March 1, the council announced Tuesday, after a student petition gathered 4,000 signatures.\n\n## Key details\nThe main branch will stay open overnight on weekdays. Study rooms can be booked online, and a security guard will be on site from 10 p.m.\n\n## Quote or evidence\n"Students told us the library was the only quiet place they had," said council member Priya Shah.\n\n## Background\nThe library cut evening hours in 2019 to save money. Since then, visits by students have dropped by a third.`,
    },
    {
      id: 'how-to',
      name: 'How-to / Listicle Post',
      summary: 'A promise in the title, a short intro, numbered steps or tips, and a clear next action.',
      bestFor: 'Blog posts, guides, newsletters',
      beats: [
        { name: 'Intro', hint: 'The problem and the result the reader will get. Under 80 words.' },
        { name: 'Tip 1', hint: 'Lead with the tip as a heading-like sentence, then explain.' },
        { name: 'Tip 2', hint: 'Add an example or a number.' },
        { name: 'Tip 3', hint: 'The most surprising or useful tip.' },
        { name: 'Wrap-up', hint: 'One thing to try today.' },
      ],
      example: `## Intro\nYou don't need a new app to stop procrastinating. You need three small changes to how you start. Here's what worked for me after years of missed deadlines.\n\n## Tip 1\nShrink the first step. "Write the report" is scary. "Open the doc and write one ugly sentence" isn't.\n\n## Tip 2\nUse a 25-minute timer. For example, I finish more in two focused 25-minute blocks than in a whole distracted afternoon.\n\n## Tip 3\nDecide the night before. Write tomorrow's first task on a sticky note and put it on your keyboard.\n\n## Wrap-up\nTonight, write one sticky note. Tomorrow, do only that. Then see what happens next.`,
    },
    {
      id: 'problem-solution',
      name: 'Problem → Solution → Benefit',
      summary: 'Define a problem, propose a solution, show what life looks like afterwards.',
      bestFor: 'Proposals, persuasive posts, product blogs',
      beats: [
        { name: 'Problem', hint: 'Describe the problem and who it affects. Use a real example.' },
        { name: 'Cause', hint: 'Why does this problem exist?' },
        { name: 'Solution', hint: 'Your proposal, specifically.' },
        { name: 'Benefit', hint: 'What changes for the reader if they adopt it?' },
        { name: 'Next step', hint: 'One action they can take now.' },
      ],
      example: `## Problem\nOur team spends four hours a week in status meetings, and most people leave without learning anything new.\n\n## Cause\nMeetings default to an hour, and the agenda is whatever comes up.\n\n## Solution\nReplace the Monday meeting with a written update: three bullets per person, posted by 10 a.m.\n\n## Benefit\nThat's 200 hours a year back for a team of five, and a searchable record of every decision.\n\n## Next step\nTry it for two weeks. If nobody misses the meeting, we keep the change.`,
    },
    {
      id: 'personal-essay',
      name: 'Personal Essay',
      summary: 'A real moment from your life, reflected on until it reveals something true for other people too.',
      bestFor: 'Memoir, reflective blog posts, college essays',
      beats: [
        { name: 'Scene', hint: 'Drop the reader into a specific moment with sensory detail.' },
        { name: 'Context', hint: 'What led to this moment? Keep it brief.' },
        { name: 'Turn', hint: 'The moment something shifted, a realization or a choice.' },
        { name: 'Reflection', hint: 'What do you understand now that you didn’t then?' },
        { name: 'Insight', hint: 'Widen it: what is true for the reader too?' },
      ],
      example: `## Scene\nThe piano in my grandmother's hallway had one dead key, the F above middle C, and she played around it like a pothole she'd driven past for years.\n\n## Context\nI spent every summer at her house. I thought the key was broken because she was too poor to fix it.\n\n## Turn\nAt her funeral, the tuner told me she'd refused to repair it. My grandfather had broken it, and she wanted to keep the silence where his hand had been.\n\n## Reflection\nI had read her life as a list of things she couldn't afford. She had been choosing all along.\n\n## Insight\nWhat looks like damage from the outside is sometimes the most carefully kept thing in a house.`,
    },
  ];

  WP.genres.push({
    id: 'essay',
    name: 'Essay & Blog',
    tagline: 'Articles, opinion pieces and personal essays',
    checks,
    frameworks,
    prompts: [
      'Argue for an unpopular opinion you actually hold.',
      'Write a how-to post about something you learned the hard way.',
      'What is one piece of advice you would give your younger self, and why?',
      'Explain a complex idea from your field to a smart 12-year-old.',
      'Write about an object in your home and what it says about you.',
      'Make the case for a small change your town or school should make.',
      'What is a common piece of advice that is wrong?',
      'Write a review of a place you go every week.',
      'Describe the moment you changed your mind about something important.',
      'Write a guide to surviving your first week at a new job.',
      'Compare two things people think are the same.',
      'Write about a skill that took you embarrassingly long to learn.',
    ],
    generator: {
      template: '{form}: {claim}. Open with {opener}.',
      parts: {
        form: ['Opinion piece', 'How-to post', 'Personal essay', 'Myth-buster', 'Listicle', 'Proposal'],
        claim: ['homework should be optional', 'everyone should learn to cook five meals', 'boredom is good for you', 'meetings should be 15 minutes', 'cities should ban cars from downtown', 'you should read the book after the movie', 'failing a class taught me more than passing', 'phones should stay out of bedrooms'],
        opener: ['a surprising number', 'a one-line story', 'a question', 'a quote you disagree with', 'a confession', 'a specific scene'],
      },
    },
    nudges: [
      'Can you say your main point in one sentence? Write that sentence first.',
      'Who would disagree with you, and what would they say?',
      'Where is the example? Replace one general statement with a specific case.',
      'Which paragraph would you cut if you had to lose one? Cut it.',
      'What does the reader need to know first?',
      'Add a number, a name or a date to your weakest paragraph.',
      'Does your last line give the reader something to do or remember?',
      'Read only your first sentence of each paragraph. Does the argument still make sense?',
    ],
    guide: {
      intro: 'Nonfiction is about making a reader understand or believe something. Know your one main point, back it with specific evidence, and organize it so the reader is never lost.',
      principles: [
        { title: 'One main point', body: 'Before you write, finish this sentence: “I want the reader to understand that…”. Everything in the piece serves that sentence.' },
        { title: 'Lead with the point', body: 'Don’t make readers wait. State your claim or promise early, then prove it.' },
        { title: 'Specific beats general', body: 'One concrete example, number or quote persuades more than paragraphs of general statements.' },
        { title: 'Paragraph = one idea', body: 'Start each paragraph with its point (a topic sentence), then support it.' },
        { title: 'Signpost', body: 'Use headings and transitions so readers always know where they are and how ideas connect.' },
        { title: 'Address the objection', body: 'The strongest arguments answer the reader’s “yes, but…” before they think it.' },
        { title: 'Cut ruthlessly', body: 'First drafts are for you; second drafts are for the reader. Remove anything that doesn’t serve the main point.' },
        { title: 'End with a takeaway', body: 'Close with what the reader should do, think or remember. Not a summary of what they just read.' },
      ],
      mistakes: [
        'A long warm-up before the main point.',
        'Claims with no evidence or examples.',
        '“Some people say…” instead of naming a source.',
        'Walls of text with no headings.',
        'Ending with “In conclusion,” followed by a repeat of the intro.',
        'Trying to make five points instead of one.',
      ],
      glossary: [
        { term: 'Thesis', def: 'The main claim of your piece, in one sentence.' },
        { term: 'Topic sentence', def: 'The first sentence of a paragraph that states its point.' },
        { term: 'Lede', def: 'Journalism term for the opening sentence or paragraph.' },
        { term: 'Counterargument', def: 'The strongest objection to your claim.' },
        { term: 'Evidence', def: 'Facts, data, examples or quotes that support a claim.' },
        { term: 'Signposting', def: 'Words and headings that tell the reader where they are in the argument.' },
        { term: 'Hedge', def: 'A word that softens a claim (“perhaps”, “I think”). Useful sometimes, weak when overused.' },
      ],
    },
    sample: {
      title: 'Example: Why you should walk to work',
      framework: 'hook-thesis',
      text: `> Example draft. Revise it and watch the checks update.

## Hook
There is a lot of research about walking and it is very interesting and many people believe it is good for you, which is something that I think most of us have probably heard about at some point in our lives.

## Thesis
If you live within three kilometers of work, you should walk at least twice a week.

## Point 1
Walking is free exercise. For example, when I started walking 20 minutes each way, my resting heart rate dropped from 78 to 66 in three months.

## Point 2
It also clears your head. Some people say it makes them more creative. My best ideas arrive somewhere between the bakery and the second traffic light.

## Counterargument
However, not everyone can walk. Distance, weather and disability are real limits, and nobody should feel guilty for driving.

## Conclusion
In conclusion, walking is good. So next time the weather is decent, leave the car keys on the hook and try it once this week.`,
    },
  });
})(window.WP = window.WP || {});
