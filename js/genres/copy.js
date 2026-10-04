(function (WP) {
  'use strict';
  const T = WP.text;
  const lex = WP.lex;
  const { C, mark, plural, quote, per100 } = WP.checks;

  const BENEFIT = ['so you can', 'which means', 'so that', 'without', 'save', 'saves', 'in just', 'in under',
    'in minutes', 'never again', 'no more', 'stop', 'finally', 'imagine', 'get more', 'spend less', 'feel',
    'enjoy', 'free up', 'worry-free', 'hassle-free', 'you get', "you'll get", "you'll", 'you will'];

  const CTA_VERB = /(?:^|(?<=[.!?…]\s+)|(?<=\n)|(?<=[:—-]\s*))(buy|get|start|try|join|sign up|subscribe|download|book|claim|grab|order|shop|call|reserve|register|click|tap|learn more|discover|see|reply|dm|apply|save|upgrade|text|visit)\b/gim;

  const PROOF_URGENCY = /\b(customers|reviews?|rated|stars?|trusted by|loved by|join(?:ed)? \d[\d,]*|\d[\d,]*\+? (?:people|users|customers|readers|members|families|students)|testimonial|guarantee(?:d)?|money-back|risk-free|refund|today only|today|right now|only \d+|limited|ends (?:soon|tonight|friday|sunday|monday)|deadline|left in stock|last chance|before (?:it's|they're) gone|this week|tonight)\b/gi;

  const MARKED_POWER = ['free', 'proven', 'instantly', 'easy', 'secret', 'guaranteed', 'exclusive', 'discover',
    'effortless', 'bonus', 'imagine', 'surprising'];

  const PLAIN = {
    utilize: 'use', utilise: 'use', leverage: 'use', leveraging: 'using', seamless: 'smooth', seamlessly: 'smoothly',
    solutions: 'tools', robust: 'reliable', empower: 'help', empowering: 'helping', 'cutting-edge': 'new',
    'cutting edge': 'new', innovative: 'new', 'state-of-the-art': 'modern', 'world-class': 'excellent',
    'best-in-class': 'top-rated', revolutionary: 'new', 'next-generation': 'new',
  };

  function headline(ctx) {
    return ctx.sentences[0];
  }

  const checks = [
    C.structure(),

    {
      id: 'headline',
      title: 'Headline',
      group: 'Attention',
      minWords: 3,
      why: 'David Ogilvy estimated five times as many people read the headline as the body copy. Keep it short (under about 12 words) and make it useful, specific, or curious: a number, a “how”, a “you”, or a clear benefit.',
      run(ctx) {
        const h = headline(ctx);
        const marks = [];
        const signals = T.findAll(ctx, /\b(how|why|you|your|\d[\d,.%$]*|new|free|secret|without|stop|finally|mistakes?)\b/gi, h);
        signals.forEach((s) => marks.push(mark(s, 'good', `Headline signal ${quote(s.text)}.`)));
        const tooLong = h.words.length > 12;
        if (tooLong) marks.push(mark(h, 'warn', `${h.words.length} words. Headlines work best under about 12.`));
        return {
          status: !tooLong && signals.length ? 'pass' : !tooLong || signals.length ? 'warn' : 'fail',
          summary: `${plural(h.words.length, 'word')}, ${plural(signals.length, 'attention signal')}.`,
          marks,
        };
      },
    },

    {
      id: 'you-vs-we',
      title: '“You” over “we”',
      group: 'Connection',
      minWords: 25,
      why: 'Customers care about themselves, not your company. Count your “you”s versus your “we/our/I”s. Good copy usually has at least twice as many “you”.',
      run(ctx) {
        const you = T.findAll(ctx, new RegExp(lex.youWords.source, 'gi'));
        const we = T.findAll(ctx, new RegExp(lex.weWords.source, 'gi')).concat(T.findAll(ctx, new RegExp(lex.meWords.source, 'gi')));
        const status = you.length >= we.length * 2 ? 'pass' : you.length >= we.length ? 'warn' : 'fail';
        return {
          status,
          summary: `“You” ${you.length} times vs “we/our/I” ${we.length} times.`,
          marks: status === 'pass' ? [] : we.map((h) => mark(h, 'warn', 'Company-focused. Can you flip this to what the reader gets?')),
        };
      },
    },

    C.phrases({
      id: 'benefits',
      title: 'Benefits, not just features',
      group: 'Persuasion',
      minWords: 30,
      why: 'A feature is what it is (“10-hour battery”). A benefit is what it does for the reader (“…so you can work a full flight without hunting for a plug”). Bridge features to benefits with “so you can” and “which means”.',
      list: BENEFIT,
      level: 'good',
      note: (h) => `Benefit language: ${quote(h.text)}.`,
      grade: (n) => ({
        status: n >= 3 ? 'pass' : n >= 1 ? 'warn' : 'fail',
        summary: n ? `${plural(n, 'benefit phrase')}.` : 'All features, no benefits. Add “so you can…” after a feature.',
      }),
    }),

    {
      id: 'cta',
      title: 'Clear call to action',
      group: 'Conversion',
      minWords: 20,
      why: 'Every piece of copy needs one obvious next step, written as a command: “Start your free trial”, “Book a table”. Put it at the end, and repeat it in long copy.',
      run(ctx) {
        const hits = T.findAll(ctx, CTA_VERB);
        const len = ctx.text.length || 1;
        const late = hits.filter((h) => h.start / len > 0.6);
        return {
          status: !hits.length ? 'fail' : late.length ? 'pass' : 'warn',
          summary: !hits.length ? 'No call to action. What exactly should the reader do?' : late.length ? `${plural(hits.length, 'call to action')}, including one at the end.` : 'Add a call to action at the end.',
          marks: hits.map((h) => mark(h, 'good', `Call to action: ${quote(h.text)}.`)),
        };
      },
    },

    {
      id: 'proof',
      title: 'Proof and urgency',
      group: 'Persuasion',
      minWords: 40,
      why: 'Readers trust other customers more than they trust you (social proof), and they act when there is a reason to act now (urgency). A review count, a guarantee or a real deadline all help. Never fake them.',
      run(ctx) {
        const hits = T.findAll(ctx, PROOF_URGENCY);
        return {
          status: hits.length >= 2 ? 'pass' : hits.length ? 'warn' : 'fail',
          summary: hits.length ? `${plural(hits.length, 'proof or urgency signal')}.` : 'No proof or urgency yet. Add a guarantee, a review, a number of customers or a deadline.',
          marks: hits.map((h) => mark(h, 'good', `Proof / urgency: ${quote(h.text)}.`)),
        };
      },
    },

    C.phrases({
      id: 'buzzwords',
      title: 'Buzzwords',
      group: 'Clarity',
      why: 'Words like “innovative”, “seamless” and “solutions” are so common that readers’ eyes slide past them. Say what the thing actually does.',
      list: lex.buzzwords,
      level: 'bad',
      fixes: (h) => {
        const plain = PLAIN[h.text.toLowerCase().replace(/\s+/g, ' ')];
        return plain ? [{ label: `Change to “${plain}”`, text: plain }] : [];
      },
      note: (h) => `${quote(h.text)} is a buzzword. What does it actually mean for the customer?`,
      grade: (n) => ({ status: n === 0 ? 'pass' : n <= 2 ? 'warn' : 'fail', summary: n ? `${plural(n, 'buzzword')}.` : 'Plain, concrete language.' }),
    }),

    {
      id: 'hype',
      title: 'Hype level',
      group: 'Clarity',
      minWords: 30,
      why: 'Power words (free, proven, instantly) grab attention, but too many, plus a row of exclamation marks, reads like spam. Use one or two where they count.',
      run(ctx) {
        const power = T.findAll(ctx, T.phraseRegex(MARKED_POWER));
        const bangs = T.findAll(ctx, /!+/g);
        const marks = power.map((h) => mark(h, 'good', `Power word ${quote(h.text)}.`))
          .concat(bangs.length > 2 ? bangs.map((h) => Object.assign(mark(h, 'warn', 'Exclamation marks feel pushy. Let the words carry the energy.'), { fixes: [{ label: 'Change to a full stop', text: '.' }] })) : []);
        const rate = per100(power.length, ctx);
        return {
          status: bangs.length > 2 || rate > 6 ? 'warn' : 'pass',
          summary: `${plural(power.length, 'power word')}, ${plural(bangs.length, 'exclamation mark')}.`,
          marks,
        };
      },
    },

    C.longSentences({ max: 18, why: 'Copy is skimmed. Sentences over 18 words lose readers. One idea per sentence; fragments are fine.' }),
    C.readability({ min: 3, max: 7, audience: 'customers who are skimming' }),
    C.strongWords(),
    C.filler(),
    C.passive(),
  ];

  const frameworks = [
    {
      id: 'aida',
      name: 'AIDA',
      summary: 'Attention, Interest, Desire, Action. The oldest structure in advertising, credited to E. St. Elmo Lewis around 1898.',
      bestFor: 'Ads, landing pages, sales emails',
      beats: [
        { name: 'Attention', hint: 'A headline that stops the scroll: a benefit, a number, a question.', min: 4 },
        { name: 'Interest', hint: 'Why should they keep reading? A surprising fact or a relatable problem.' },
        { name: 'Desire', hint: 'Paint the picture of life with your product. Benefits, proof.' },
        { name: 'Action', hint: 'One clear next step, written as a command.', min: 4 },
      ],
      example: `## Attention\nCold brew in 5 minutes, not 12 hours.\n\n## Interest\nMost cold brew takes all night to steep. Our flash-chilled concentrate is brewed hot, then frozen in seconds, so the flavor locks in.\n\n## Desire\nYou get smooth, low-acid coffee every morning without planning ahead, at a third of the café price. Over 3,000 reviews, 4.8 stars, and a 30-day money-back guarantee.\n\n## Action\nGrab your first box today and get 20% off.`,
    },
    {
      id: 'pas',
      name: 'PAS',
      summary: 'Problem, Agitate, Solution. Name the reader’s pain, twist the knife, then offer relief.',
      bestFor: 'Short ads, emails, social posts',
      beats: [
        { name: 'Problem', hint: 'State the problem in the reader’s words.', min: 5 },
        { name: 'Agitate', hint: 'Make it vivid. What does it cost them?' },
        { name: 'Solution', hint: 'Your product as the way out, plus a CTA.' },
      ],
      example: `## Problem\nYour inbox has 4,000 unread emails.\n\n## Agitate\nThe important ones get buried, you miss a client's reply, and Sunday night turns into a cleanup session you never finish.\n\n## Solution\nInbox Five reads your inbox and pulls the five emails that matter to the top, so you can reach inbox zero in ten minutes a day. Try it free for 14 days.`,
    },
    {
      id: 'bab',
      name: 'Before · After · Bridge',
      summary: 'Show the reader’s world now, show the better world, then show how your product gets them there.',
      bestFor: 'Testimonial-style ads, transformation offers',
      beats: [
        { name: 'Before', hint: 'Life with the problem.' },
        { name: 'After', hint: 'Life without it. Make it specific and desirable.' },
        { name: 'Bridge', hint: 'Your product is how they get from before to after. End with a CTA.' },
      ],
      example: `## Before\nYou've bought three language apps and you still freeze when the waiter speaks Spanish.\n\n## After\nImagine ordering, joking, and asking for directions on your next trip without reaching for your phone.\n\n## Bridge\nParlaHour pairs you with a native speaker for 15 minutes a day, so you practice real conversation, not flashcards. Book your first free session today.`,
    },
    {
      id: 'fab',
      name: 'Features · Advantages · Benefits',
      summary: 'Turn product specs into reasons to buy: what it is, what it does, what it means for the customer.',
      bestFor: 'Product descriptions, spec-heavy products',
      beats: [
        { name: 'Feature', hint: 'The fact: what the product has.' },
        { name: 'Advantage', hint: 'What that feature does better than the alternative.' },
        { name: 'Benefit', hint: 'What it means for the reader’s life. Use “so you can”.' },
        { name: 'Call to action', hint: 'The next step.', min: 4 },
      ],
      example: `## Feature\nA 20,000 mAh battery in a case the size of a deck of cards.\n\n## Advantage\nIt charges a phone four times over and fits in a jeans pocket.\n\n## Benefit\nSo you can take photos all day at the festival and still call a ride home at midnight.\n\n## Call to action\nOrder by Friday for free shipping.`,
    },
    {
      id: 'four-us',
      name: 'The 4 U’s (headlines)',
      summary: 'A headline checklist from direct-response copywriting: Useful, Urgent, Unique, Ultra-specific. Score each from 1 to 4.',
      bestFor: 'Headlines, subject lines, hooks',
      minWordsPerBeat: 3,
      beats: [
        { name: 'Useful', hint: 'Write a version that promises a clear benefit.', min: 3 },
        { name: 'Urgent', hint: 'A version with a reason to act now.', min: 3 },
        { name: 'Unique', hint: 'A version that says something no competitor could.', min: 3 },
        { name: 'Ultra-specific', hint: 'A version with numbers, names or details.', min: 3 },
        { name: 'Final headline', hint: 'Combine the strongest parts into one headline.', min: 3 },
      ],
      example: `## Useful\nLearn to make sourdough at home.\n\n## Urgent\nOur last beginner sourdough class of the year starts Saturday.\n\n## Unique\nThe sourdough class taught by a baker who failed 100 loaves first.\n\n## Ultra-specific\nBake your first open-crumb sourdough in 3 hours, with 4 ingredients.\n\n## Final headline\nBake your first real sourdough this Saturday, in 3 hours, with 4 ingredients.`,
    },
    {
      id: 'hook-story-offer',
      name: 'Hook · Story · Offer',
      summary: 'A social-media structure popularised by marketer Russell Brunson: stop the scroll, tell a short true story, make the offer.',
      bestFor: 'Instagram, LinkedIn, email newsletters',
      beats: [
        { name: 'Hook', hint: 'One line that stops the scroll.', min: 4 },
        { name: 'Story', hint: 'A short, specific, true story that leads to the lesson.' },
        { name: 'Offer', hint: 'What you are offering and how to get it.' },
      ],
      example: `## Hook\nI almost closed my bakery in 2021.\n\n## Story\nSales were down 60%. One night I posted a photo of the bread we were about to throw away, and asked if anyone wanted it free. Forty people showed up. Twelve came back the next day and paid.\n\n## Offer\nNow every Friday at 6 p.m. we sell the day's last loaves at half price. Reply "BREAD" and I'll text you when they're out of the oven.`,
    },
  ];

  WP.genres.push({
    id: 'copy',
    name: 'Copywriting',
    tagline: 'Ads, landing pages, emails and social posts',
    checks,
    frameworks,
    prompts: [
      'Write an ad for the oldest thing you own, as if it were brand new.',
      'Write a landing page headline and three bullet points for a dog-walking service.',
      'Write a sales email for a local café’s new breakfast menu.',
      'Sell a pencil to someone who only uses their phone.',
      'Write an Instagram caption that gets people to sign up for a free workshop.',
      'Write a product description for a water bottle, aimed at students.',
      'Write a subject line and preview text for a 24-hour sale.',
      'Rewrite a boring app-store description so it focuses on the user.',
      'Write a flyer for a lost cat, using PAS.',
      'Write five headlines for the same product using the 4 U’s.',
      'Write a LinkedIn post that tells a story and ends with an offer.',
    ],
    generator: {
      template: 'Sell {product} to {audience} who are frustrated by {pain}. Use {framework}.',
      parts: {
        product: ['a meal-kit subscription', 'a budgeting app', 'a weekend pottery class', 'noise-cancelling earbuds', 'a standing desk', 'a local gym', 'a language tutor', 'a plant-care service', 'a used-book box'],
        audience: ['first-time parents', 'remote workers', 'students', 'retirees', 'small business owners', 'gamers', 'nurses on night shift'],
        pain: ['never having enough time', 'wasting money', 'feeling lonely', 'sore backs', 'boring routines', 'too many choices', 'being ignored by customer service'],
        framework: ['AIDA', 'PAS', 'Before · After · Bridge', 'FAB', 'Hook · Story · Offer'],
      },
    },
    nudges: [
      'Who exactly is reading this? Describe one real person.',
      'What keeps your reader up at night that this product solves?',
      'Turn one feature into a benefit by adding “so you can…”.',
      'Cut the first sentence. Does the copy start better without it?',
      'What would a skeptical customer ask? Answer it in the copy.',
      'Add a number: a price, a time, a quantity, a rating.',
      'Is there exactly one call to action? Make it a command.',
      'Replace one “we” sentence with a “you” sentence.',
    ],
    guide: {
      intro: 'Copywriting is writing that gets someone to act: click, buy, sign up, reply. It is not about clever words; it is about understanding one reader’s problem better than they can describe it, and making the next step obvious.',
      principles: [
        { title: 'Know one reader', body: 'Write to a single, specific person. What do they want, fear, and already believe?' },
        { title: 'The headline does most of the work', body: 'If the headline fails, nothing else gets read. Write ten versions and pick one.' },
        { title: 'Benefits beat features', body: 'Customers buy outcomes. Always answer “so what?” after every feature.' },
        { title: 'You, not we', body: 'Make the reader the hero. Your company is the guide.' },
        { title: 'Proof builds trust', body: 'Numbers, reviews, guarantees and specifics are more convincing than adjectives.' },
        { title: 'One goal, one CTA', body: 'Every piece of copy should ask for exactly one action, clearly, as a command.' },
        { title: 'Clarity over cleverness', body: 'A clear headline beats a clever pun almost every time.' },
        { title: 'Honesty', body: 'Never invent reviews, fake scarcity or hide terms. It breaks trust and often the law.' },
      ],
      mistakes: [
        'Talking about the company instead of the customer.',
        'Lists of features with no benefits.',
        'Buzzwords: innovative, seamless, cutting-edge.',
        'Several competing calls to action.',
        'Long paragraphs that skimmers skip.',
        'Fake urgency or made-up reviews.',
      ],
      glossary: [
        { term: 'CTA', def: 'Call to action: the specific action you ask the reader to take.' },
        { term: 'Benefit', def: 'What a feature does for the customer.' },
        { term: 'Social proof', def: 'Evidence that other people use and like the product.' },
        { term: 'Urgency', def: 'A genuine reason to act now: a deadline, limited stock.' },
        { term: 'Value proposition', def: 'The one-sentence reason a customer should choose you.' },
        { term: 'Conversion', def: 'When a reader takes the action you asked for.' },
        { term: 'Above the fold', def: 'What a visitor sees before scrolling.' },
      ],
    },
    sample: {
      title: 'Example: Plant-care app ad',
      framework: 'aida',
      text: `> Example draft for an imaginary app. Edit and watch the checks change.

## Attention
We are a leading provider of innovative, seamless plant-care solutions for the modern home.

## Interest
Our team has spent years building our app. We believe our technology is the best on the market and we are very proud of it!!

## Desire
Leafy tells you when to water each plant, so you can stop guessing. It reads the light in your room with your phone camera, which means no more yellow leaves.

## Action
Download Leafy today and get your first month free.`,
    },
  });
})(window.WP = window.WP || {});
