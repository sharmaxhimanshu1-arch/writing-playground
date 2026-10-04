(function (WP) {
  'use strict';
  const T = WP.text;
  const { C, mark, plural, quote, band, per100 } = WP.checks;

  // The fiction checks a novel shares with a short story.
  const story = WP.genres.find((g) => g.id === 'story');
  const shared = (id) => story.checks.find((c) => c.id === id);

  /** Character offsets inside quoted dialogue, so narration-only checks can skip speech. */
  function inDialogue(ctx) {
    const spans = [];
    const re = /“[^”]*”|"[^"\n]*"/g;
    let m;
    while ((m = re.exec(ctx.masked))) spans.push([m.index, m.index + m[0].length]);
    return (pos) => spans.some(([a, b]) => pos >= a && pos < b);
  }

  // Verb pairs that show which tense the narration is in (past, present).
  const TENSE_PAIRS = [
    ['said', 'says'], ['asked', 'asks'], ['walked', 'walks'], ['looked', 'looks'], ['turned', 'turns'], ['nodded', 'nods'],
    ['smiled', 'smiles'], ['shook', 'shakes'], ['stood', 'stands'], ['sat', 'sits'], ['opened', 'opens'], ['grabbed', 'grabs'],
    ['stared', 'stares'], ['whispered', 'whispers'], ['laughed', 'laughs'], ['shrugged', 'shrugs'], ['reached', 'reaches'],
    ['pulled', 'pulls'], ['pushed', 'pushes'], ['stepped', 'steps'], ['ran', 'runs'], ['went', 'goes'], ['came', 'comes'],
    ['took', 'takes'], ['knew', 'knows'], ['thought', 'thinks'], ['felt', 'feels'], ['saw', 'sees'], ['heard', 'hears'],
  ];
  const PAST = new Set(TENSE_PAIRS.map((p) => p[0]));
  const TENSE_RE = new RegExp('\\b(' + TENSE_PAIRS.flat().join('|') + ')\\b', 'gi');

  // Chapter endings that let the reader put the book down.
  const SLEEPY_END = /\b(?:fell asleep|went to (?:bed|sleep)|drifted off|drifted into sleep|closed (?:my|her|his|their) eyes|turned off the (?:light|lamp)|the end\b|and that was that|everything was (?:fine|okay|ok|good|going to be (?:fine|okay|ok))|lived happily)/i;
  const PULL_END = /\?["”]?$|["“][^"”]+[.!?…]?["”]?$|\b(?:until|then|suddenly|someone|somebody|knock(?:ed|ing)?|rang|gone|missing|wasn['’]t there|was not there|blood|scream(?:ed)?|behind (?:me|her|him|them)|for the first time|never again|too late|lied|lie|secret|dead|alive|run)\b/i;

  const CHAPTER_HEADING = /^(?:chapter|ch\.?|part|book)\b|^(?:\d+|[ivxlc]+)\.?$/i;

  const BACKSTORY_RE = /\bhad\s+(?:(?:always|never|once|already|just|long|often|been)\s+)?(?:been|known|seen|done|gone|taken|given|made|come|grown|left|lost|found|thought|told|wanted|loved|hated|lived|worked|tried|promised|kept|met|moved|started|stopped|learned|learnt|spent|built|had|become|\w+ed)\b/gi;

  const checks = [
    C.structure(),
    shared('opening-line'),

    {
      id: 'chapter-endings',
      title: 'Chapter endings',
      group: 'Novel craft',
      minWords: 120,
      why: 'Readers decide whether to keep reading at the end of a chapter. End on a question, a turn or a threat, not on a character going to sleep or everything being fine. Headings like “## Chapter 3” split the draft into chapters, and each ending is checked; otherwise the end of the draft is.',
      run(ctx) {
        // Only chapter headings split chapters; framework beat headings (## Hook, ## Disturbance) do not.
        const secs = T.sections(ctx).filter((s) => CHAPTER_HEADING.test(s.heading.title) && s.words >= 30);
        const ends = [];
        const lastIn = (from, to) => ctx.sentences.filter((s) => s.start >= from && s.end <= to + 1).pop();
        if (secs.length) secs.forEach((s) => { const x = lastIn(s.start, s.end); if (x) ends.push(x); });
        else if (ctx.sentences.length) ends.push(ctx.sentences[ctx.sentences.length - 1]);
        if (!ends.length) return null;
        const marks = [];
        let sleepy = 0;
        let pull = 0;
        for (const s of ends) {
          const text = s.text.trim();
          if (SLEEPY_END.test(text)) {
            sleepy++;
            marks.push(mark(s, 'bad', 'This chapter ends by winding down. End on a question or a turn that makes the reader turn the page.'));
          } else if (PULL_END.test(text) || s.words.length <= 6) {
            pull++;
            marks.push(mark(s, 'good', 'Ends on a pull: a question, a turn or a short punch.'));
          } else marks.push(mark(s, 'info', 'Chapter ending. Would a tired reader keep going after this line?'));
        }
        const n = ends.length;
        return {
          status: sleepy ? (sleepy === n ? 'fail' : 'warn') : pull ? 'pass' : 'info',
          summary: sleepy ? `${plural(sleepy, 'chapter')} of ${n} ${sleepy === 1 ? 'ends' : 'end'} by winding down.` : pull ? `${pull} of ${n} ${n === 1 ? 'ending pulls' : 'endings pull'} the reader on.` : 'Endings avoid the sleepy traps. Do they raise a question?',
          marks,
        };
      },
    },

    {
      id: 'tense',
      title: 'Tense stays steady',
      group: 'Novel craft',
      minWords: 80,
      why: 'Most novels are told in past tense (“she walked”); some in present (“she walks”). Either works. Slipping between them in the narration jolts the reader out of the story. Dialogue is ignored: characters can speak in any tense.',
      run(ctx) {
        const speech = inDialogue(ctx);
        const hits = T.findAll(ctx, TENSE_RE).filter((h) => !speech(h.start));
        const past = hits.filter((h) => PAST.has(h.text.toLowerCase()));
        const present = hits.filter((h) => !PAST.has(h.text.toLowerCase()));
        if (past.length + present.length < 3) return { status: 'info', summary: 'Not enough narration yet to tell the tense.', marks: [] };
        const main = past.length >= present.length ? 'past' : 'present';
        const odd = main === 'past' ? present : past;
        const share = odd.length / (past.length + present.length);
        const marks = odd.map((h) => mark(h, 'warn', `${quote(h.text)} is ${main === 'past' ? 'present' : 'past'} tense, but the narration is mostly in ${main} tense.`));
        return {
          status: !odd.length ? 'pass' : share >= 0.2 && odd.length >= 2 ? 'fail' : 'warn',
          summary: odd.length ? `Mostly ${main} tense, with ${plural(odd.length, 'slip')} into ${main === 'past' ? 'present' : 'past'}.` : `Narration stays in ${main} tense.`,
          marks,
        };
      },
    },

    {
      id: 'backstory',
      title: 'Backstory dumps',
      group: 'Novel craft',
      minWords: 80,
      why: 'Every “had been”, “had always”, “had moved” pulls the reader out of the present scene into the past. A little backstory is fine; a pile of it, especially in chapter one, stalls the story. Show the past through what characters do now, and save the history for when the reader wants it.',
      run(ctx) {
        const speech = inDialogue(ctx);
        const hits = T.findAll(ctx, BACKSTORY_RE).filter((h) => !speech(h.start));
        const rate = per100(hits.length, ctx);
        return {
          status: band(rate, 1.2, 2.5),
          summary: hits.length ? `${plural(hits.length, '“had …” flashback verb')} (${rate.toFixed(1)} per 100 words).` : 'The story stays in the present scene.',
          marks: hits.map((h) => mark(h, rate > 1.2 ? 'warn' : 'info', `Backstory: ${quote(h.text)}. Is the reader in the scene, or in a flashback?`)),
        };
      },
    },

    shared('telling-emotion'),
    shared('filter-words'),
    shared('senses'),
    shared('dialogue'),
    shared('stakes'),
    C.adverbs(),
    C.passive(),
    C.weakOpeners(),
    C.repetition(),
    C.rhythm(),
    C.paragraphLength({ max: 180 }),
    C.cliches(),
    C.strongWords(),
    C.filler(),
  ];

  const frameworks = [
    {
      id: 'first-chapter',
      name: 'First Chapter',
      summary: 'The five jobs of a novel’s opening chapter: hook the reader, show the hero in motion, sketch their world, break it, and end on a question.',
      bestFor: 'Starting a novel, or rewriting chapter one',
      minWordsPerBeat: 20,
      beats: [
        { name: 'Hook', min: 10, hint: 'An opening line or paragraph that raises a question. No weather, no waking up.' },
        { name: 'Character in motion', hint: 'Your protagonist doing something that shows who they are and what they want.' },
        { name: 'Normal world', hint: 'Just enough of their world to stand in. One sharp detail beats a paragraph of history.' },
        { name: 'Disturbance', hint: 'Something is wrong, new or strange. This is what the novel is about.' },
        { name: 'Chapter-end question', min: 8, hint: 'End on a question or a turn that makes chapter two impossible to skip.' },
      ],
      example: `## Hook\nThe letter arrived thirty-one years after it was posted, and it was addressed to me.\n\n## Character in motion\nI held it against the post office window, trying to read the date through the paper, while the queue behind me sighed. I am the kind of person who reads the end of a book first. I wanted to know how this ended before it began.\n\n## Normal world\nMarsh End has one post office, two churches and a bus that turns around in the square at nine and never comes back before six. I sort mail there on weekdays. I know every name in the town.\n\n## Disturbance\nThe stamp showed a queen who has been dead for years. The handwriting was my mother's. My mother died the week I was born.\n\n## Chapter-end question\nInside, one line, in her looping blue ink: "Don't let them tell you I drowned."`,
    },
    {
      id: 'scene-sequel',
      name: 'Scene & Sequel (Dwight Swain)',
      summary: 'Novels move in pairs: a scene where a character tries and fails, then a sequel where they react and choose again. Use it to plan any chapter.',
      bestFor: 'Planning or fixing a chapter that drags',
      minWordsPerBeat: 10,
      beats: [
        { name: 'Goal', hint: 'What does the point-of-view character want in this scene? Make it concrete.' },
        { name: 'Conflict', hint: 'Who or what pushes back? Escalate it.' },
        { name: 'Disaster', hint: 'They fail, or win in a way that makes things worse.' },
        { name: 'Reaction', hint: 'The emotional hit. Let the character feel it, briefly.' },
        { name: 'Dilemma', hint: 'Every option left is bad. Lay them out.' },
        { name: 'Decision', hint: 'They choose. The choice becomes the next scene’s goal.' },
      ],
      example: `## Goal\nTomas needed the harbour master to sign the permit before the tide turned at four.\n\n## Conflict\nThe harbour master kept him waiting, then read every line aloud, slowly, and asked about the cargo twice. "Fish," Tomas said. "It's always fish."\n\n## Disaster\nThe harbour master opened the crate himself. Under the ice lay forty passports.\n\n## Reaction\nTomas's mouth went dry. He had promised his sister no one would ever look in the crates.\n\n## Dilemma\nHe could run and leave the boat, or stay and give up the names, or offer the man the one thing in his pocket worth more than the cargo.\n\n## Decision\nHe put his sister's ring on the desk. "Sign it," he said, "and I'll tell you who they're for."`,
    },
    {
      id: 'novel-outline',
      name: 'Novel Outline (three acts)',
      summary: 'Plan the whole book in eight paragraphs before chapter one: the turns that give a novel its shape, and roughly where they fall.',
      bestFor: 'Planning a whole novel; checking a draft that has lost its way',
      minWordsPerBeat: 15,
      beats: [
        { name: 'Opening', hint: 'Chapters 1–2. The hero, their flaw and their everyday world.' },
        { name: 'Inciting incident', hint: 'About 10% in. The event that sets the story moving.' },
        { name: 'Lock-in', hint: 'About 25% in. The hero commits, and the way back closes.' },
        { name: 'Complications', hint: 'The long middle. Each attempt costs more; allies and enemies show their colours.' },
        { name: 'Midpoint', hint: 'About 50%. A revelation flips what the hero is fighting for.' },
        { name: 'Crisis', hint: 'About 75%. Everything falls apart. The hero’s flaw is to blame.' },
        { name: 'Climax', hint: 'The hero faces the final test, changed enough to pass it, or to fail it meaningfully.' },
        { name: 'Resolution', hint: 'The last chapter. The new normal, mirroring the opening.' },
      ],
      example: `## Opening\nIris, a sharp-tongued forger, restores old maps for collectors and trusts nothing she can't fold and pocket.\n\n## Inciting incident\nA dying client pays her to forge a map of an island that, he swears, appears on no real chart.\n\n## Lock-in\nWhen the client's family accuses her of his murder, the only proof of her innocence is on that island. She buys a boat she can't sail.\n\n## Complications\nHer crew is a seasick student and a smuggler who wants the map for himself. Every port they reach has heard of the island, and every story about it contradicts the last.\n\n## Midpoint\nShe finds the island. It is real, and her own grandmother drew the original map she was hired to forge.\n\n## Crisis\nThe smuggler steals the map, the student is arrested, and Iris must admit she never cared about the truth, only about winning.\n\n## Climax\nShe forges one last map, a false one, and uses it to lead the smuggler and the police to the same harbour at the same hour.\n\n## Resolution\nIris restores maps again, but now she signs her own name in the corner of every one.`,
    },
    {
      id: 'snowflake',
      name: 'Snowflake Method',
      summary: 'Randy Ingermanson’s way of growing a novel from one sentence: summarise it, then expand step by step until you have a plan you can write from.',
      bestFor: 'Getting from an idea to a plan without a blank page',
      minWordsPerBeat: 12,
      beats: [
        { name: 'One sentence', hint: 'The whole novel in fifteen words or so: who, what they want, what stands in the way.' },
        { name: 'One paragraph', hint: 'Five sentences: the setup, three disasters, and the ending.' },
        { name: 'Characters', hint: 'For each main character: what they want, what they need, and what stops them.' },
        { name: 'One-page synopsis', hint: 'Expand each sentence of the paragraph into its own paragraph.' },
        { name: 'Scene list', hint: 'List the scenes in order, one line each: whose point of view, and what happens.' },
      ],
      example: `## One sentence\nA lonely lighthouse keeper must prove a ghost ship is real before the town closes her lighthouse.\n\n## One paragraph\nWren keeps the last working lighthouse on the coast. When she sees a ship that sank in 1912 sail past, nobody believes her. The council votes to close the lighthouse; her only witness vanishes; then the ship runs aground on the rocks below her. Inside she finds a log that names her own grandfather. She keeps the light burning, and the whole town climbs the hill to see the ship for itself.\n\n## Characters\nWren wants the lighthouse to stay open, needs to let people in, and is stopped by her pride. Councillor Hale wants the land for a hotel and is stopped by his fear of the sea. Sam, the ferry boy, wants an adventure and is stopped by nothing at all.\n\n## One-page synopsis\nWren sees the ship on the night of the storm and reports it; the council laughs. Sam sees it too, but his mother sends him inland. The ship returns closer each night, until it wrecks below the light and Wren climbs down to it alone.\n\n## Scene list\n1. Wren sees the ship (Wren). 2. The council meeting (Hale). 3. Sam's lie to his mother (Sam). 4. The second sighting (Wren). 5. The wreck (Wren).`,
    },
  ];

  WP.genres.push({
    id: 'novel',
    name: 'Novel',
    tagline: 'Chapters, long-form fiction and planning a book',
    checks,
    frameworks,
    prompts: [
      'Write the first chapter of a novel that starts with a letter arriving decades late.',
      'A family inherits a house on the condition that one of them lives there for a year. Write chapter one from the one who agrees.',
      'Write the chapter where your hero realises the mentor has been lying all along.',
      'Two sisters run rival bakeries on the same street. Open the novel on the morning one of them disappears.',
      'Plan a novel in one sentence, then write the scene that sentence is really about.',
      'A detective is assigned to investigate a crime she committed. Write the first chapter.',
      'Write the opening chapter of a fantasy novel without explaining the magic once.',
      'A town wakes to find every clock running an hour behind. Begin with the one person who isn’t surprised.',
      'Write a chapter that ends on a line of dialogue that changes everything.',
      'Your hero gets exactly what they wanted at the end of chapter one. Write chapter two, where it costs them.',
      'Start a novel in the middle of an argument about something trivial.',
      'An ordinary person finds out they are a minor character in someone else’s famous story. Write their chapter.',
    ],
    generator: {
      template: 'A {character} must {goal} before {deadline}, but {complication}. Set {setting}.',
      parts: {
        character: ['disgraced chess champion', 'teenage cartographer', 'night-ferry captain', 'retired spy who runs a bakery', 'translator who can’t lie', 'last member of a travelling circus', 'young widow with a debt', 'forger of rare books'],
        goal: ['find their missing twin', 'deliver one sealed letter', 'clear their father’s name', 'win back the family farm', 'get a stolen painting home', 'keep a promise made to a dying friend'],
        deadline: ['the last train leaves the valley', 'the wedding on Saturday', 'the river freezes', 'the election', 'their memory fades completely', 'the war reaches the town'],
        complication: ['the only person who can help them wants them dead', 'they are being blamed for a murder', 'no one believes the thing they saw', 'their own child is working against them', 'the map they rely on is a forgery'],
        setting: ['in a city built on bridges', 'on a fading seaside pier', 'in 1920s Bombay', 'in a village that floods every spring', 'aboard a cargo ship that never docks', 'in a near-future London without phones'],
      },
    },
    nudges: [
      'What question should the reader be asking at the end of this chapter?',
      'Whose point of view is this chapter in? Is there anything here they couldn’t know?',
      'Cut the last paragraph of the chapter. Does it end better a beat earlier?',
      'What does your hero want in this scene, and who stops them?',
      'Replace one paragraph of backstory with one line of dialogue that hints at it.',
      'What is the worst thing that could happen next? Put it in the next chapter.',
      'Which character has been offstage too long? Bring them back.',
      'What does your hero believe on page one that will be proved wrong by the end?',
      'Write the next scene as a sequel: how does the character react to what just happened?',
      'What small object from chapter one could matter in the final chapter?',
    ],
    guide: {
      intro: 'A novel is a long promise kept. Chapter one promises a kind of story and a question; every chapter after it raises the stakes on that question; the ending answers it in a way that feels surprising and inevitable. You don’t write a novel all at once. You write one scene, then the next, and plan just enough to keep going.',
      principles: [
        { title: 'Chapter one makes a promise', body: 'In a few pages the reader learns the tone, the hero and the question the book will answer. Start close to the disturbance, not with history.' },
        { title: 'End chapters with a pull', body: 'A question, a turn or a threat at the end of each chapter is what makes readers stay up late. Avoid ending on sleep, or on everything being fine.' },
        { title: 'Scene and sequel', body: 'Action scenes (goal, conflict, disaster) alternate with reaction scenes (feeling, dilemma, decision). Each decision drives the next scene.' },
        { title: 'Pick a point of view and keep it', body: 'In each scene, stay inside one character’s head. Readers can only see, hear and know what that character does.' },
        { title: 'Keep the tense steady', body: 'Past or present both work. Slipping between them in the narration is one of the most common beginner mistakes.' },
        { title: 'Ration the backstory', body: 'Readers care about the past only once they care about the present. Feed history in a line at a time, when it changes what a scene means.' },
        { title: 'The middle needs turns', body: 'The long middle sags without a midpoint revelation and complications that each cost more than the last.' },
        { title: 'Finish the draft', body: 'A finished rough draft is worth more than a perfect first chapter. Plan, write forward, and fix it in revision.' },
      ],
      mistakes: [
        'Opening with the hero waking up, the weather, or pages of history.',
        'Info-dumping backstory in chapter one (“She had always…”, “He had grown up…”).',
        'Slipping between past and present tense.',
        'Head-hopping: switching whose thoughts we hear mid-scene.',
        'Chapters that end with the character going to sleep.',
        'A middle where nothing gets worse.',
        'Rewriting chapter one forever instead of finishing the draft.',
      ],
      glossary: [
        { term: 'Chapter hook', def: 'The question or turn at the end of a chapter that pulls the reader into the next.' },
        { term: 'Point of view (POV)', def: 'The character through whose eyes a scene is told.' },
        { term: 'Head-hopping', def: 'Switching POV within a scene without a break.' },
        { term: 'Backstory', def: 'Events that happened before the story begins.' },
        { term: 'Info dump', def: 'A large block of backstory or explanation that stalls the scene.' },
        { term: 'Scene', def: 'A unit of action: a character pursues a goal and meets conflict.' },
        { term: 'Sequel', def: 'The reaction that follows a scene: emotion, dilemma, decision.' },
        { term: 'Midpoint', def: 'The turn halfway through a novel that changes what the hero is fighting for.' },
        { term: 'Synopsis', def: 'A short summary of the whole plot, including the ending.' },
      ],
    },
    sample: {
      title: 'Example: Chapter one',
      framework: 'first-chapter',
      text: `> Example opening chapter. Rewrite the highlighted parts and watch the score change.

## Chapter 1

Mira woke up to the sound of rain against the window.

She had always hated Mondays. She had grown up in this flat above the laundrette, and she had never once thought about leaving. Her father had worked nights at the docks for twenty years, and her mother had left when Mira was six. She had learned to cook for two by the time she was nine.

She walks to the window and looks down at the street. A van was parked outside the laundrette, its engine running. She felt very nervous. A man in a grey coat stepped out and stared straight up at her window.

"Mira Chaudhry?" he called. "I have something that belongs to your mother."

She closed the curtains. She told herself it was a mistake. Then she made tea, read for a while, and went to bed early.`,
    },
  });
})(window.WP = window.WP || {});
