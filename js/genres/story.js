(function (WP) {
  'use strict';
  const T = WP.text;
  const lex = WP.lex;
  const { C, mark, plural, quote, band, per100 } = WP.checks;

  const WEAK_OPENING = /^(?:it was a (?:dark|cold|beautiful|sunny|rainy|stormy|bright|normal|typical|quiet)\b|the (?:sun|rain|wind|sky|morning|alarm|weather)\b|(?:i|she|he|they|we|[a-z]+) (?:woke|wakes|wake|opened (?:my|her|his|their) eyes)\b|once upon a time|my name is|dear diary|it all started|it all began|this is the story)/i;

  const STAKES = ['want', 'wanted', 'wants', 'need', 'needed', 'needs', 'must', 'have to', 'had to', "can't", 'cannot',
    "couldn't", "won't", 'or else', 'before it', 'too late', 'lose', 'lost', 'risk', 'deadline', 'afraid', 'only chance',
    'last chance', 'if i', 'if she', 'if he', 'if they', 'if we', 'unless', 'promise', 'promised', 'secret', 'refused'];

  const checks = [
    C.structure(),

    {
      id: 'opening-line',
      title: 'Opening line',
      group: 'Story craft',
      minWords: 5,
      why: 'The first line makes a promise about the whole story. Editors see thousands of openings with weather, waking up, or “my name is”. Start with a character doing something, a strange detail, or a line of dialogue that raises a question.',
      run(ctx) {
        const first = ctx.sentences[0];
        const m = first.text.match(WEAK_OPENING);
        if (m) {
          return { status: 'warn', summary: 'The story opens with one of the most common opening clichés.', marks: [mark({ start: first.start, end: first.start + m[0].length }, 'bad', `${quote(m[0])} is a common opening. Start closer to the trouble.`)] };
        }
        if (/^["“]/.test(first.text)) {
          return { status: 'pass', summary: 'Opens on dialogue, straight into the scene.', marks: [mark(first, 'good', 'Opening on dialogue drops the reader into the scene.')] };
        }
        return { status: 'pass', summary: 'Avoids the common opening traps. Does it make the reader ask a question?', marks: [mark(first, 'info', 'Opening line. Ask yourself: what question does this make the reader ask?')] };
      },
    },

    C.phrases({
      id: 'telling-emotion',
      title: 'Show, don’t tell (emotions)',
      group: 'Story craft',
      why: '“She was angry” tells the reader what to feel. “She slammed the mug down hard enough to crack it” lets them feel it. Show emotion through action, body language, dialogue and choices.',
      re: new RegExp('\\b(?:was|were|felt|feel|feels|feeling|seemed|seems|looked|became|got|is|am|are|grew)\\s+(?:so\\s+|very\\s+|really\\s+|extremely\\s+|incredibly\\s+|a\\s+bit\\s+|a\\s+little\\s+|quite\\s+|totally\\s+)?(?:' + lex.emotions.join('|') + ')\\b', 'gi'),
      level: 'bad',
      note: (h) => `Telling: ${quote(h.text)}. What would the reader see this character do?`,
      grade: (n) => ({
        status: n === 0 ? 'pass' : n <= 2 ? 'warn' : 'fail',
        summary: n ? `${plural(n, 'named emotion')}. Turn them into actions.` : 'Emotions are shown, not named.',
      }),
    }),

    C.phrases({
      id: 'filter-words',
      title: 'Filter words',
      group: 'Story craft',
      why: 'Filter words (saw, heard, felt, noticed, realized) put a pane of glass between the reader and the story. “She heard the door creak” → “The door creaked.”',
      list: lex.filterWords,
      level: 'warn',
      note: (h) => `Filter word ${quote(h.text)}. Can you describe the thing directly?`,
      grade: (n, ctx) => ({
        status: band(per100(n, ctx), 1, 2.5),
        summary: n ? `${plural(n, 'filter word')} (${per100(n, ctx).toFixed(1)} per 100 words).` : 'The reader experiences the story directly.',
      }),
    }),

    {
      id: 'senses',
      title: 'Five senses',
      group: 'Story craft',
      minWords: 100,
      why: 'Sight is the default. Sound, smell, touch and taste make a scene feel real. Aim to use at least three senses in every scene.',
      run(ctx) {
        const marks = [];
        const used = [];
        for (const [sense, words] of Object.entries(lex.senses)) {
          const hits = T.findAll(ctx, T.formsRegex(words));
          if (hits.length) used.push(sense);
          hits.forEach((h) => marks.push(mark(h, 'good', `Sense of ${sense}: ${quote(h.text)}.`)));
        }
        const missing = Object.keys(lex.senses).filter((s) => !used.includes(s));
        return {
          status: used.length >= 3 ? 'pass' : used.length === 2 ? 'warn' : 'fail',
          summary: used.length ? `Uses ${used.join(', ')}.` + (missing.length ? ` Try adding ${missing.join(' or ')}.` : '') : 'No sensory details yet.',
          marks,
        };
      },
    },

    {
      id: 'dialogue',
      title: 'Dialogue tags',
      group: 'Story craft',
      minWords: 40,
      why: '“Said” and “asked” are invisible; readers skim them. Fancy tags (“she exclaimed”, “he retorted”) and adverbs (“said angrily”) pull focus from the words themselves. Let the dialogue carry the emotion.',
      run(ctx) {
        const quoted = (ctx.masked.match(/“[^”]*”|"[^"\n]*"/g) || []).join('').length;
        if (!quoted) return { status: 'info', summary: 'No dialogue yet. A line or two of speech can reveal character fast.', marks: [] };
        const marks = [];
        T.findAll(ctx, /\b(said|asked|replied|whispered|shouted|yelled|told|demanded|snapped|cried|called|muttered|exclaimed)\s+(\w+ly)\b/gi)
          .filter((h) => !lex.adverbExceptions.has(h.groups[2].toLowerCase()))
          .forEach((h) => marks.push(Object.assign(mark(h, 'bad', `${quote(h.text)}: the adverb tells the reader how to hear the line. Make the words do it.`), { fixes: [{ label: `Keep just “${h.groups[1]}”`, text: h.groups[1] }] })));
        const tagRe = new RegExp('[,?!…—-]\\s*[”"]\\s*(?:he|she|they|i|we|you|[A-Z][a-z]+)\\s+(' + lex.fancyTags.join('|') + ')\\b', 'gi');
        T.findAll(ctx, tagRe).forEach((m) => {
          const h = { start: m.end - m.groups[1].length, end: m.end, text: m.groups[1] };
          if (!marks.some((x) => x.start <= h.start && x.end >= h.end)) marks.push(Object.assign(mark(h, 'warn', `${quote(h.text)} as a tag draws attention. “Said” usually works better, or an action beat.`), { fixes: [{ label: 'Change to “said”', text: 'said' }] }));
        });
        T.findAll(ctx, /\b(said|asked)\b/gi).forEach((h) => {
          const near = ctx.masked.slice(Math.max(0, h.start - 30), h.end + 30);
          if (/[“”"]/.test(near)) marks.push(mark(h, 'good', 'Invisible tag. The reader stays with the dialogue.'));
        });
        const bad = marks.filter((m) => m.level !== 'good').length;
        const share = Math.round((quoted / Math.max(1, ctx.masked.replace(/\s+/g, ' ').length)) * 100);
        return {
          status: bad === 0 ? 'pass' : bad <= 2 ? 'warn' : 'fail',
          summary: `Dialogue is ~${share}% of the text. ${bad ? plural(bad, 'tag') + ' to simplify.' : 'Tags stay out of the way.'}`,
          marks,
        };
      },
    },

    C.phrases({
      id: 'stakes',
      title: 'Want, obstacle, stakes',
      group: 'Structure',
      minWords: 150,
      why: 'Story is a character who wants something, an obstacle in the way, and a cost if they fail. If the reader can’t say what the character wants and what happens if they don’t get it, the story will feel flat.',
      list: STAKES,
      level: 'good',
      note: (h) => `Stakes/desire signal: ${quote(h.text)}.`,
      grade: (n) => ({
        status: n >= 3 ? 'pass' : n >= 1 ? 'warn' : 'fail',
        summary: n ? `${plural(n, 'want or stakes signal')}.` : 'No clear want or stakes yet. What does your character need, and what happens if they don’t get it?',
      }),
    }),

    C.adverbs(),
    C.passive(),
    C.weakOpeners(),
    C.repetition(),
    C.rhythm(),
    C.paragraphLength({ max: 150 }),
    C.cliches(),
    C.strongWords(),
    C.filler(),
  ];

  const frameworks = [
    {
      id: 'three-act',
      name: 'Three-Act Structure',
      summary: 'Beginning, middle, end, with two turning points that push the story forward. The backbone of most films and novels.',
      bestFor: 'Any story, any length',
      beats: [
        { name: 'Setup', hint: 'Show the hero’s normal world and what they want. Plant what will matter later.' },
        { name: 'Inciting incident', hint: 'Something happens that upsets the normal world. The story starts here.' },
        { name: 'Plot point 1', hint: 'The hero commits. There is no going back. (About 25% in.)' },
        { name: 'Rising action', hint: 'Obstacles get harder. Each attempt costs something.' },
        { name: 'Midpoint', hint: 'A twist or revelation that changes what the hero understands.' },
        { name: 'Plot point 2', hint: 'The lowest moment. All seems lost. (About 75% in.)' },
        { name: 'Climax', hint: 'The final confrontation. The hero must use what they learned.' },
        { name: 'Resolution', hint: 'The new normal. Show how the hero has changed.' },
      ],
      example: `## Setup\nMaya repairs clocks in her grandfather's shop and hasn't left her village in ten years.\n\n## Inciting incident\nA stranger brings in a pocket watch that runs backwards and says it belonged to her mother.\n\n## Plot point 1\nWhen the stranger is arrested, Maya takes the watch and boards the night train to the city.\n\n## Rising action\nEvery clockmaker she visits refuses to touch the watch. One slams the door. Another tries to steal it.\n\n## Midpoint\nShe discovers her mother didn't die. She left, and the watch counts down to the day she'll return.\n\n## Plot point 2\nThe watch is stolen, and with it, Maya's only way to find her.\n\n## Climax\nMaya builds a second watch from memory in one night and uses it to track the first.\n\n## Resolution\nShe opens a shop in the city. The sign says "Repairs. All directions."`,
    },
    {
      id: 'story-circle',
      name: 'Story Circle (Dan Harmon)',
      summary: 'Eight steps in a loop: a character leaves comfort, gets what they wanted, pays for it, and comes back changed. Great for short stories and episodes.',
      bestFor: 'Short stories, episodes, flash fiction',
      beats: [
        { name: 'You', hint: 'A character in a zone of comfort.' },
        { name: 'Need', hint: 'But they want something.' },
        { name: 'Go', hint: 'They enter an unfamiliar situation.' },
        { name: 'Search', hint: 'They adapt to it, struggling.' },
        { name: 'Find', hint: 'They get what they wanted.' },
        { name: 'Take', hint: 'They pay a heavy price for it.' },
        { name: 'Return', hint: 'They return to their familiar situation.' },
        { name: 'Change', hint: 'Having changed.' },
      ],
      example: `## You\nRaj has run the same Thursday quiz night at the Crown pub for six years.\n\n## Need\nHe wants, just once, to be a contestant instead of the host.\n\n## Go\nHe signs up for a televised quiz show in London.\n\n## Search\nUnder studio lights he freezes on questions he wrote himself years ago.\n\n## Find\nHe wins the final round with a question about pub history.\n\n## Take\nBut the show airs, and his regulars learn he used their inside jokes as material.\n\n## Return\nHe goes back to the Crown on Thursday. Half the tables are empty.\n\n## Change\nHe hands the microphone to Dot, the oldest regular, and takes a seat in the audience.`,
    },
    {
      id: 'heros-journey',
      name: 'Hero’s Journey',
      summary: 'Joseph Campbell’s monomyth, condensed by Christopher Vogler into 12 stages. The shape of many myths and blockbusters.',
      bestFor: 'Adventure, fantasy, coming-of-age',
      beats: [
        { name: 'Ordinary world', hint: 'The hero’s everyday life and flaw.' },
        { name: 'Call to adventure', hint: 'A challenge or opportunity appears.' },
        { name: 'Refusal of the call', hint: 'Fear or duty makes the hero hesitate.' },
        { name: 'Meeting the mentor', hint: 'Someone gives advice, training or a gift.' },
        { name: 'Crossing the threshold', hint: 'The hero commits and enters the new world.' },
        { name: 'Tests, allies, enemies', hint: 'The hero learns the rules of the new world.' },
        { name: 'Approach', hint: 'Preparing for the biggest challenge.' },
        { name: 'Ordeal', hint: 'A life-or-death crisis. The hero faces their greatest fear.' },
        { name: 'Reward', hint: 'The hero survives and gains something.' },
        { name: 'The road back', hint: 'Consequences chase the hero home.' },
        { name: 'Resurrection', hint: 'A final test where the hero must use everything learned.' },
        { name: 'Return with the elixir', hint: 'The hero comes home changed, bringing something that helps others.' },
      ],
      example: `## Ordinary world\nTen-year-old Ana delivers bread at dawn and never speaks in class.\n\n## Call to adventure\nThe baker's oven goes cold, and an old map in the flour sacks shows where the "first fire" was kept.\n\n## Refusal of the call\nAna hides the map. Someone braver should go.\n\n## Meeting the mentor\nThe deaf ferryman teaches her to read the river's signs with her hands.\n\n## Crossing the threshold\nShe takes the ferry past the last lighthouse.\n\n## Tests, allies, enemies\nA goat-herder joins her; a toll-keeper demands a song she's too shy to sing.\n\n## Approach\nAt the mountain, the cave mouth whistles like a kettle.\n\n## Ordeal\nInside, the ember will only light for someone who speaks to it. Ana must speak.\n\n## Reward\nHer voice cracks, then carries. The ember glows.\n\n## The road back\nThe toll-keeper wants the ember for himself and floods the path.\n\n## Resurrection\nAna sings the song she refused, loud enough to bring the ferryman.\n\n## Return with the elixir\nThe oven burns again. Ana reads the morning orders aloud to the whole street.`,
    },
    {
      id: 'save-the-cat',
      name: 'Save the Cat (condensed)',
      summary: 'Blake Snyder’s screenwriting beat sheet, shortened to its essential beats. Very practical for pacing.',
      bestFor: 'Screenplays, commercial fiction, novels',
      beats: [
        { name: 'Opening image', hint: 'A snapshot of the hero before the change.' },
        { name: 'Theme stated', hint: 'Someone says the lesson the hero needs, though they don’t get it yet.' },
        { name: 'Catalyst', hint: 'The life-changing event.' },
        { name: 'Debate', hint: 'Should I go? The hero hesitates.' },
        { name: 'Break into two', hint: 'The hero chooses to act and enters a new world.' },
        { name: 'Fun and games', hint: 'The promise of the premise: the scenes from the trailer.' },
        { name: 'Midpoint', hint: 'A false victory or false defeat. Stakes go up.' },
        { name: 'Bad guys close in', hint: 'Outside pressure and inner doubts grow.' },
        { name: 'All is lost', hint: 'The lowest point. Something or someone is lost.' },
        { name: 'Dark night of the soul', hint: 'The hero processes the loss and finally understands the theme.' },
        { name: 'Finale', hint: 'The hero applies the lesson and wins (or loses meaningfully).' },
        { name: 'Final image', hint: 'A mirror of the opening image showing the change.' },
      ],
      example: `## Opening image\nLeo eats lunch alone in his car outside the office, rehearsing a speech he'll never give.\n\n## Theme stated\nHis sister says, "You can't win a game you won't play."\n\n## Catalyst\nHis company announces layoffs, and the only way to keep his team is to pitch to the board.\n\n## Debate\nHe drafts a resignation letter instead.\n\n## Break into two\nHe tears it up and signs up for the pitch.\n\n## Fun and games\nLeo takes an improv class to get over stage fright and is terrible at it.\n\n## Midpoint\nHis practice pitch goes viral inside the company. Now everyone is watching.\n\n## Bad guys close in\nA rival manager copies his idea and pitches first.\n\n## All is lost\nThe board cancels his slot.\n\n## Dark night of the soul\nIn the car again, Leo realizes he never needed permission to speak.\n\n## Finale\nHe walks into the board meeting uninvited and plays the improv game that made him look ridiculous.\n\n## Final image\nLeo eats lunch in the break room, surrounded by his team.`,
    },
    {
      id: 'seven-point',
      name: 'Seven-Point Structure',
      summary: 'Dan Wells’s method: plan the ending first, then the beginning as its opposite, then the turns in between.',
      bestFor: 'Plotting backwards from an ending you already know',
      beats: [
        { name: 'Hook', hint: 'The hero’s starting state: the opposite of the resolution.' },
        { name: 'Plot turn 1', hint: 'Something new enters: a person, idea or event that sets the story moving.' },
        { name: 'Pinch 1', hint: 'Pressure from the antagonist forces the hero to act.' },
        { name: 'Midpoint', hint: 'The hero moves from reacting to acting.' },
        { name: 'Pinch 2', hint: 'More pressure. The plan fails and something is lost.' },
        { name: 'Plot turn 2', hint: 'The hero finds the final piece they need.' },
        { name: 'Resolution', hint: 'The climax and the hero’s final state.' },
      ],
      example: `## Hook\nNadia is a pickpocket who trusts no one.\n\n## Plot turn 1\nShe steals a wallet that contains a photo of herself as a baby.\n\n## Pinch 1\nThe wallet's owner, a detective, starts hunting her.\n\n## Midpoint\nInstead of running, Nadia follows the detective home.\n\n## Pinch 2\nHer old crew sells her out, and the detective catches her.\n\n## Plot turn 2\nThe detective reveals he's her uncle and has been searching for her for twenty years.\n\n## Resolution\nNadia returns every wallet she stole that summer, with a note.`,
    },
  ];

  WP.genres.push({
    id: 'story',
    name: 'Short Story',
    tagline: 'Fiction, flash fiction and scenes',
    checks,
    frameworks,
    prompts: [
      'A character finds a voicemail from themselves that they don’t remember leaving.',
      'Write a scene where two people argue about something small, but the real fight is about something big.',
      'Someone returns a library book forty years late. Why now?',
      'Write the moment a character realizes they are the villain of someone else’s story.',
      'A delivery driver has one last package and it is addressed to them.',
      'Two strangers are stuck in an elevator. One of them has a secret about the other.',
      'Write a story that takes place entirely during a single phone call.',
      'A child is convinced their new neighbor is a ghost. They’re half right.',
      'A chef loses their sense of taste the night before the biggest dinner of their career.',
      'Write about a lie that gets bigger every time it is told.',
      'A town where it has never rained wakes up to clouds.',
      'Write a scene with no dialogue tags at all, only action beats.',
      'An old photograph shows someone in the background who shouldn’t be there.',
      'Write the last day of a job someone has done for thirty years.',
    ],
    generator: {
      template: 'A {character} who wants {want}, but {obstacle}. Set {setting}.',
      parts: {
        character: ['retired detective', 'nervous wedding planner', 'teenage beekeeper', 'night-shift nurse', 'failed magician', 'lighthouse keeper', 'substitute teacher', 'food truck owner', 'grieving astronaut', 'kid who can’t lie'],
        want: ['to win back an old friend', 'to keep a promise to their mother', 'one quiet day', 'to prove they’re not a fraud', 'to get home before midnight', 'to find out who sent the letters', 'to be forgiven'],
        obstacle: ['the only person who can help them hates them', 'every clock in town has stopped', 'they’ve just been arrested', 'they told everyone they already did it', 'a storm cuts the town off', 'their memory resets every night'],
        setting: ['in a 24-hour laundromat', 'on the last ferry of the season', 'during a power cut', 'at a funeral for someone nobody liked', 'in a city where it is always winter', 'inside a hospital waiting room'],
      },
    },
    nudges: [
      'What does your character want right now, in this scene?',
      'What is the worst thing that could happen next? Make it happen.',
      'What does your character believe that isn’t true?',
      'Describe the room using a sense other than sight.',
      'What is your character hiding from the person they’re talking to?',
      'Cut your first paragraph. Does the story start better at the second?',
      'Replace a sentence that names an emotion with what the character does.',
      'What small object in this scene could matter later?',
      'What does the other character want, and how does it clash?',
      'End the scene one line earlier than feels comfortable.',
    ],
    guide: {
      intro: 'A story is a character who wants something, meets resistance, and is changed by the struggle. Everything else (setting, dialogue, description) exists to make that struggle vivid and believable.',
      principles: [
        { title: 'Want + obstacle = story', body: 'Give your character a clear desire and something in the way. Without both, you have a situation, not a story.' },
        { title: 'Show, don’t tell', body: 'Let readers infer feelings from actions, body language and dialogue. Telling is fine for quick transitions; showing is for the moments that matter.' },
        { title: 'Start late, leave early', body: 'Begin scenes as close to the conflict as possible and end them before they wind down.' },
        { title: 'Specific, sensory detail', body: 'One precise detail (“a lipstick-stained coffee lid”) beats a paragraph of general description. Use sounds, smells and textures, not just sight.' },
        { title: 'Dialogue is action', body: 'People rarely say exactly what they mean. Use dialogue to reveal what characters want and hide.' },
        { title: 'Use “said”', body: 'Keep tags invisible. Use action beats (“She set the knife down.”) to show who is speaking and how.' },
        { title: 'Cause and effect', body: 'Every scene should be caused by the previous one and cause the next. “But” and “therefore”, not “and then”.' },
        { title: 'Change', body: 'By the end, something about the character or their situation should be different. That change is what the story means.' },
      ],
      mistakes: [
        'Opening with weather, waking up, or a long backstory.',
        'Naming emotions (“he was furious”) instead of showing them.',
        'Characters who agree with each other: no friction, no scene.',
        'Over-describing appearance and under-describing action.',
        'Fancy dialogue tags and adverbs (“she hissed angrily”).',
        'A resolution where the problem solves itself.',
      ],
      glossary: [
        { term: 'Protagonist', def: 'The main character whose want drives the story.' },
        { term: 'Inciting incident', def: 'The event that disrupts normal life and starts the story.' },
        { term: 'Stakes', def: 'What the character stands to lose.' },
        { term: 'POV', def: 'Point of view: whose eyes the reader experiences the story through.' },
        { term: 'Action beat', def: 'A small action placed near dialogue to show who speaks and how.' },
        { term: 'Filter word', def: 'A verb like “saw” or “felt” that reports perception instead of showing it.' },
        { term: 'Subtext', def: 'What a character means but doesn’t say.' },
        { term: 'Arc', def: 'How a character changes from beginning to end.' },
      ],
    },
    sample: {
      title: 'Example: The last bus',
      framework: 'story-circle',
      text: `> Example draft. Rewrite the highlighted parts and watch the score change.

It was a dark and stormy night when Eli woke up on the bus.

He felt very nervous. He saw that the driver was gone and he realized the doors were open. Rain hammered the roof like gravel thrown by the handful.

"Hello?" he exclaimed loudly.

Nobody answered. The air smelled of wet wool and diesel. Somewhere at the back, a phone buzzed against a metal seat, over and over, the same three short bursts.

He had to get home before his mother's shift ended, or she would know he'd snuck out again. He walked slowly down the aisle. The phone was his. He had left it on the bus a year ago, the night his father drove away.

"Pick up," said a voice behind him.`,
    },
  });
})(window.WP = window.WP || {});
