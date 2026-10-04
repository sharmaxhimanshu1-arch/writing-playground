(function (WP) {
  'use strict';
  const T = WP.text;
  const lex = WP.lex;
  const { C, mark, plural, quote } = WP.checks;

  const SLUG = /^\s*(?:int|ext|int\.?\s*\/\s*ext|i\/e|est)[.\s]/i;
  const TIME = /-\s*(?:DAY|NIGHT|MORNING|AFTERNOON|EVENING|DUSK|DAWN|CONTINUOUS|LATER|MOMENTS LATER|SAME)\b/;
  const TRANSITION = /^\s*(?:[A-Z ]+TO:|FADE IN:|FADE OUT\.?|FADE TO BLACK\.?)\s*$/;
  const CHARACTER = /^\s*[A-Z][A-Z0-9 .'’-]{0,28}(?:\s*\((?:V\.O\.|O\.S\.|O\.C\.|CONT'D|CONT’D)\))?\s*$/;

  /** Classifies each line of a screenplay: slug, action, character, parenthetical, dialogue, transition. */
  function classify(ctx) {
    const out = [];
    let mode = null;
    ctx.lines.forEach((l, i) => {
      const t = l.text.trim();
      let role;
      if (l.kind === 'blank') {
        mode = null;
        role = 'blank';
      } else if (l.kind === 'heading' || l.kind === 'note') {
        mode = null;
        role = l.kind;
      } else if (SLUG.test(t)) {
        role = 'slug';
        mode = null;
      } else if (TRANSITION.test(t)) {
        role = 'transition';
        mode = null;
      } else if ((mode === 'dialogue' || mode === 'character') && /^\(.*\)$/.test(t)) {
        role = 'parenthetical';
        mode = 'dialogue';
      } else if (mode === 'dialogue' || mode === 'character') {
        role = 'dialogue';
        mode = 'dialogue';
      } else if (CHARACTER.test(t) && /[A-Z]/.test(t) && t.split(/\s+/).length <= 4 && ctx.lines[i + 1] && ctx.lines[i + 1].kind !== 'blank') {
        role = 'character';
        mode = 'character';
      } else {
        role = 'action';
      }
      out.push(Object.assign({}, l, { role, trimmed: t }));
    });
    return out;
  }

  function blocks(lines, role) {
    const out = [];
    let cur = null;
    for (const l of lines) {
      if (l.role === role) {
        if (!cur) out.push((cur = { start: l.start, end: l.end, lines: [] }));
        cur.end = l.end;
        cur.lines.push(l);
      } else if (!(role === 'dialogue' && l.role === 'parenthetical')) cur = null;
    }
    out.forEach((b) => (b.words = b.lines.reduce((a, l) => a + (l.text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length, 0)));
    return out;
  }

  function within(ctx, lines, re) {
    const hits = [];
    for (const l of lines) hits.push(...T.findAll(ctx, new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), l));
    return hits;
  }

  const UNFILMABLE = /\b(thinks|thought|remembers|remembered|realizes|realised|realized|realises|knows|knew|wonders|wondered|feels|felt|decides|decided|wishes|wished|hopes|hoped|understands|understood|is reminded)\b/gi;
  const CAMERA = /\b(we see|we hear|we watch|we follow|camera|close on|close-up|closeup|zoom(?:s)? in|pan(?:s)? to|angle on|tracking shot)\b/gi;

  const checks = [
    C.structure(),

    {
      id: 'sluglines',
      title: 'Scene headings',
      group: 'Format',
      minWords: 10,
      why: 'Every scene starts with a heading (a “slugline”) in capitals: INT. or EXT. (inside or outside), the location, and the time: INT. KITCHEN - NIGHT. It tells the whole crew where and when.',
      run(ctx) {
        const lines = classify(ctx);
        const slugs = lines.filter((l) => l.role === 'slug');
        const marks = [];
        let ok = 0;
        for (const l of slugs) {
          const upper = l.trimmed === l.trimmed.toUpperCase();
          const timed = TIME.test(l.trimmed.toUpperCase());
          if (upper && timed) {
            ok++;
            marks.push(mark(l, 'good', 'Well-formed scene heading.'));
          } else {
            marks.push(mark(l, 'warn', `${upper ? '' : 'Write the heading in capitals. '}${timed ? '' : 'Add the time after a dash, e.g. “- NIGHT”.'}`.trim()));
          }
        }
        if (!slugs.length) return { status: 'fail', summary: 'No scene heading. Start with something like INT. BUS STATION - NIGHT.', marks };
        return {
          status: ok === slugs.length ? 'pass' : 'warn',
          summary: `${plural(slugs.length, 'scene')}${ok === slugs.length ? ', all headings well formed.' : `, ${slugs.length - ok} heading(s) need fixing.`}`,
          marks,
        };
      },
    },

    {
      id: 'action-lines',
      title: 'Lean action lines',
      group: 'Format',
      minWords: 30,
      why: 'Readers skim screenplays. Keep each block of action to about four lines or fewer, one image or beat per paragraph. White space makes a script fast to read.',
      run(ctx) {
        const b = blocks(classify(ctx), 'action');
        const long = b.filter((x) => x.lines.length > 4 || x.words > 60);
        return {
          status: long.length === 0 ? 'pass' : long.length <= 1 ? 'warn' : 'fail',
          summary: long.length ? `${plural(long.length, 'action block')} too dense.` : 'Action is broken into short, readable blocks.',
          marks: long.map((x) => mark(x.lines[0], 'warn', `${x.words} words of action in one block. Break it at each new image.`)),
        };
      },
    },

    {
      id: 'present-tense',
      title: 'Action in present tense',
      group: 'Format',
      minWords: 30,
      why: 'Screenplays happen now, on screen. Write action in the present tense: “Maya opens the door,” not “Maya opened the door.”',
      run(ctx) {
        const action = classify(ctx).filter((l) => l.role === 'action');
        const hits = within(ctx, action, /\b(was|were|had|\w{3,}ed)\b/gi)
          .filter((h) => !lex.passiveExceptions.has(h.text.toLowerCase()) && !/^(need|seed|feed|speed|bleed|breed|proceed|exceed|succeed|indeed|hundred|bed|red|sled|shed|wed|naked|wicked|sacred|kindred|rugged|ragged|jagged)$/i.test(h.text));
        return {
          status: hits.length === 0 ? 'pass' : hits.length <= 2 ? 'warn' : 'fail',
          summary: hits.length ? `${plural(hits.length, 'past-tense word')} in action lines.` : 'Action is in the present tense.',
          marks: hits.map((h) => mark(h, 'warn', `${quote(h.text)} looks like past tense. Action happens now: use the present.`)),
        };
      },
    },

    {
      id: 'unfilmable',
      title: 'Only what we can see and hear',
      group: 'Craft',
      minWords: 20,
      why: 'The camera can’t film a thought. “She remembers her father” is invisible. Show it: she turns over his old watch in her hand. If it can’t be seen or heard, it isn’t in the movie.',
      run(ctx) {
        const action = classify(ctx).filter((l) => l.role === 'action');
        const hits = within(ctx, action, UNFILMABLE);
        return {
          status: hits.length === 0 ? 'pass' : hits.length <= 1 ? 'warn' : 'fail',
          summary: hits.length ? `${plural(hits.length, 'unfilmable')} in the action.` : 'Everything in the action can be filmed.',
          marks: hits.map((h) => mark(h, 'bad', `${quote(h.text)} can’t be filmed. What would the audience actually see?`)),
        };
      },
    },

    {
      id: 'camera-directions',
      title: 'Leave the camera to the director',
      group: 'Craft',
      minWords: 20,
      why: '“We see”, “camera pans” and “close on” tell the director how to shoot. Spec scripts avoid them. Describe what happens; the shot is implied by what you choose to show.',
      run(ctx) {
        const action = classify(ctx).filter((l) => l.role === 'action');
        const hits = within(ctx, action, CAMERA);
        return {
          status: hits.length === 0 ? 'pass' : hits.length <= 2 ? 'warn' : 'fail',
          summary: hits.length ? `${plural(hits.length, 'camera direction')}.` : 'No camera directions.',
          marks: hits.map((h) => Object.assign(mark(h, 'warn', `${quote(h.text)} directs the camera. Just describe what happens.`), /^we (see|hear|watch)$/i.test(h.text) ? { fixes: [WP.checks.DELETE] } : {})),
        };
      },
    },

    {
      id: 'monologues',
      title: 'Short speeches',
      group: 'Dialogue',
      minWords: 30,
      why: 'Real people talk in short bursts and interrupt each other. A speech over about 50 words stops the scene. Break it up with action or the other character’s reaction.',
      run(ctx) {
        const b = blocks(classify(ctx), 'dialogue');
        if (!b.length) return { status: 'info', summary: 'No dialogue yet. Write a character name in CAPS, then their line below it.', marks: [] };
        const long = b.filter((x) => x.words > 50);
        return {
          status: long.length === 0 ? 'pass' : long.length === 1 ? 'warn' : 'fail',
          summary: long.length ? `${plural(long.length, 'speech', 'speeches')} over 50 words.` : `${plural(b.length, 'speech', 'speeches')}, all short.`,
          marks: long.map((x) => mark(x.lines[0], 'warn', `${x.words} words without a break. Who interrupts? What does the other person do?`)),
        };
      },
    },

    {
      id: 'parentheticals',
      title: 'Few parentheticals',
      group: 'Dialogue',
      minWords: 30,
      why: 'A parenthetical like (angrily) tells the actor how to say a line. Use them rarely, only when the meaning would be unclear. If the line needs (angrily), the line itself is not angry enough.',
      run(ctx) {
        const lines = classify(ctx);
        const parens = lines.filter((l) => l.role === 'parenthetical');
        const speeches = blocks(lines, 'dialogue').length || 1;
        const marks = parens.filter((l) => /\(\s*\w+ly\s*\)/i.test(l.trimmed)).map((l) => mark(l, 'warn', 'An adverb parenthetical. Let the line and the actor carry the emotion.'));
        return {
          status: marks.length === 0 && parens.length <= speeches / 3 ? 'pass' : 'warn',
          summary: `${plural(parens.length, 'parenthetical')} across ${plural(speeches, 'speech', 'speeches')}.`,
          marks,
        };
      },
    },

    {
      id: 'on-the-nose',
      title: 'Subtext, not on-the-nose',
      group: 'Dialogue',
      minWords: 30,
      why: 'In good scenes people rarely say exactly what they feel. “I am so angry at you” is on-the-nose. Let characters talk around the feeling (“You took the last of the milk. Again.”) and the audience will read the anger underneath.',
      run(ctx) {
        const dialogue = classify(ctx).filter((l) => l.role === 'dialogue');
        const re = new RegExp("\\b(i(?:'m|’m| am) (?:so |really |very |just )?(?:" + lex.emotions.join('|') + ")|i feel (?:like )?(?:so |really )?\\w+|i love you|i hate you)\\b", 'gi');
        const hits = within(ctx, dialogue, re);
        return {
          status: hits.length === 0 ? 'pass' : hits.length <= 1 ? 'warn' : 'fail',
          summary: hits.length ? `${plural(hits.length, 'on-the-nose line')}.` : 'Characters don’t announce their feelings.',
          marks: hits.map((h) => mark(h, 'warn', `${quote(h.text)} states the feeling. What would they say instead, to hide it?`)),
        };
      },
    },

    {
      id: 'page-count',
      title: 'Page count',
      group: 'Format',
      minWords: 1,
      why: 'In standard format, one screenplay page is roughly one minute of screen time, about 55 lines. A short film runs 5–15 pages; a TV episode 30–60; a feature 90–120.',
      run(ctx) {
        const lines = classify(ctx).filter((l) => l.role !== 'heading' && l.role !== 'note');
        const pages = lines.length / 55;
        const dlg = lines.filter((l) => l.role === 'dialogue').length;
        const act = lines.filter((l) => l.role === 'action').length;
        return {
          status: 'info',
          summary: `≈ ${pages < 1 ? 'under 1 page' : pages.toFixed(1) + ' pages'} (≈ ${Math.max(1, Math.round(pages))} min on screen). ${dlg} dialogue lines, ${act} action lines.`,
          marks: [],
        };
      },
    },

    C.cliches(),
  ];

  const frameworks = [
    {
      id: 'scene-turn',
      name: 'Scene: Goal · Conflict · Turn',
      summary: 'Every scene needs a character who wants something, someone or something in the way, and a turn that changes the situation by the end.',
      bestFor: 'Any single scene',
      beats: [
        { name: 'Setup', hint: 'Scene heading, then two or three lines of action: where we are and who is here.' },
        { name: 'Goal', hint: 'What does the main character want in this scene? Show it in action or dialogue.' },
        { name: 'Conflict', hint: 'Who or what stands in the way? Let them clash.' },
        { name: 'Turn', hint: 'Something changes: a reveal, a decision, a reversal. The scene must end in a different place than it started.' },
        { name: 'Exit', hint: 'Get out fast. End on an image or a line, not on goodbyes.', min: 5 },
      ],
      example: `## Setup\nINT. LAUNDROMAT - NIGHT\n\nFluorescent hum. One dryer spins. MAYA (30s, scrubs, exhausted) folds a child's T-shirt.\n\n## Goal\nShe checks her phone. 11:52. She folds faster.\n\n## Conflict\nThe OWNER (60s) flips the sign to CLOSED and rattles his keys.\n\nOWNER\nMidnight means midnight.\n\nMAYA\nEight minutes. Please. It's his school uniform.\n\n## Turn\nThe owner looks at the tiny shirt. He pulls up a plastic chair, sits, and starts folding socks.\n\n## Exit\nThe dryer buzzes. Neither of them looks up.`,
    },
    {
      id: 'short-film',
      name: 'Short film (three acts)',
      summary: 'A complete story in 5–10 pages: a strong opening image, one problem, one escalation, a climax and a closing image that mirrors the start.',
      bestFor: 'Short films, film-school exercises',
      beats: [
        { name: 'Opening image', hint: 'One visual that shows the character’s world and problem.' },
        { name: 'Inciting incident', hint: 'The event that starts the story.' },
        { name: 'Complications', hint: 'Things get harder. Keep it to one or two escalations; a short has no time for subplots.' },
        { name: 'Climax', hint: 'The character makes a choice that costs something.' },
        { name: 'Final image', hint: 'A visual that mirrors the opening image, showing the change.' },
      ],
      example: `## Opening image\nEXT. ROOFTOP - DAWN\n\nOLD MAN TAN (70s) feeds a single pigeon. The rest of the coop is empty.\n\n## Inciting incident\nA NOTICE taped to the coop door: BUILDING SOLD. VACATE BY FRIDAY.\n\n## Complications\nINT. STAIRWELL - DAY\n\nTan knocks on doors. Nobody wants a pigeon. A TEENAGER (15) laughs at him, then looks at the bird a little too long.\n\n## Climax\nEXT. ROOFTOP - FRIDAY\n\nTan opens the coop. The pigeon doesn't move. He lifts it, kisses its head, and throws it into the sky.\n\n## Final image\nEXT. ANOTHER ROOFTOP - DAWN\n\nThe teenager scatters seed. One pigeon lands.`,
    },
    {
      id: 'two-hander',
      name: 'Argument scene',
      summary: 'Two characters who want opposite things, a conflict that escalates, and a reveal that changes the fight.',
      bestFor: 'Dialogue practice, drama, comedy',
      beats: [
        { name: 'Want A', hint: 'Character A’s goal, shown in their first line or action.' },
        { name: 'Want B', hint: 'Character B wants the opposite.' },
        { name: 'Escalation', hint: 'Each line raises the stakes. Nobody gives in yet.' },
        { name: 'Reveal', hint: 'The real reason for the fight comes out.' },
        { name: 'Button', hint: 'A final line or action that closes the scene with a punch.', min: 4 },
      ],
      example: `## Want A\nINT. CAR - NIGHT\n\nJONAH (17) grips the wheel. Learner plates. His MOM (45) grips the door handle.\n\nJONAH\nI'm taking the highway.\n\n## Want B\nMOM\nYou are taking the parking lot. Again.\n\n## Escalation\nJONAH\nI've done the parking lot eleven times.\n\nMOM\nAnd you hit the cart return twice.\n\nJONAH\nThe cart return moved.\n\n## Reveal\nMOM\nYour dad learned on that highway.\n\nJonah lets go of the wheel.\n\n## Button\nJONAH\nThen he can teach me.\n\nSilence. Mom unclips her seatbelt and opens the door.\n\nMOM\nScoot over.`,
    },
    {
      id: 'cold-open',
      name: 'Cold open (TV)',
      summary: 'The scene before the opening titles: drop us into a moment, complicate it fast, and end on a shock or a laugh that makes us stay.',
      bestFor: 'TV pilots, web series',
      beats: [
        { name: 'Hook moment', hint: 'Start in the middle of something strange or urgent.' },
        { name: 'Complication', hint: 'One twist that makes it worse or weirder.' },
        { name: 'Sting', hint: 'The shock, laugh or question that ends the scene.' },
        { name: 'Smash cut', hint: 'SMASH CUT TO: the title, or a contrasting scene.', min: 2 },
      ],
      example: `## Hook moment\nINT. MUSEUM - NIGHT\n\nA SECURITY GUARD (50s) dances alone to a radio between dinosaur skeletons.\n\n## Complication\nThe T. rex's tail bone falls with a CRACK. He freezes. Slowly, he picks it up and tries to fit it back on. It doesn't fit.\n\n## Sting\nA small voice behind him:\n\nCHILD (O.S.)\nYou're doing it wrong.\n\nHe turns. A GIRL (8) in pajamas sits inside the ribcage.\n\n## Smash cut\nSMASH CUT TO:`,
    },
  ];

  WP.genres.push({
    id: 'screenplay',
    name: 'Screenplay',
    tagline: 'Scenes for film, TV and web series',
    checks,
    frameworks,
    prompts: [
      'Write a scene where two people share an umbrella and shouldn’t.',
      'Two siblings clean out a parent’s fridge. Write the scene without anyone mentioning the parent.',
      'A job interview where the interviewer is more nervous than the candidate.',
      'Write a scene that takes place entirely inside a parked car.',
      'A first date at a restaurant where the waiter is the date’s ex.',
      'A character must return something they stole. Write the scene.',
      'Write a cold open for a TV show set in a hospital at 4 a.m.',
      'Two strangers wait for the same delayed train. One of them is lying.',
      'Write a scene where the most important line is never said.',
      'A kid tries to return a pet to the shop.',
      'Write a two-page scene with only one line of dialogue.',
    ],
    generator: {
      template: 'INT./EXT. {place} - {time}. {a} wants {want}, but {b} {obstacle}.',
      parts: {
        place: ['A 24-HOUR DINER', 'A HOSPITAL ELEVATOR', 'A SCHOOL BUS', 'A ROOFTOP', 'A DRIVING TEST CENTER', 'A FERRY DECK', 'A PET SHOP'],
        time: ['NIGHT', 'DAWN', 'DAY', 'LATE AFTERNOON'],
        a: ['A nervous groom', 'A retired spy', 'A teenage chess champion', 'A tired nurse', 'A celebrity in disguise', 'A new security guard'],
        want: ['to leave without being seen', 'an apology', 'their money back', 'one honest answer', 'to win, just once', 'to get home'],
        b: ['their mother', 'an old friend', 'a stubborn clerk', 'a child', 'their boss', 'a stranger'],
        obstacle: ['won’t stop talking', 'knows their secret', 'is locking the doors', 'needs a favor first', 'has the same goal', 'won’t look at them'],
      },
    },
    nudges: [
      'What does your main character want in this scene, right now?',
      'Can the scene start later? Cut the first three lines and see.',
      'Replace a line of dialogue with an action that says the same thing.',
      'What is your character hiding from the other person?',
      'What can the audience see that tells them how someone feels?',
      'How is the situation different at the end of the scene?',
      'Give the other character a strong want too.',
      'What object in the room could become important?',
    ],
    guide: {
      intro: 'A screenplay is a blueprint for something people will watch, not read. You can only write what can be seen and heard. Scenes are built from wants and conflict, and dialogue works best when characters don’t say what they mean.',
      principles: [
        { title: 'Show, because you can’t tell', body: 'There is no narrator inside a character’s head. Thoughts, memories and feelings must become actions, objects and dialogue.' },
        { title: 'Enter late, leave early', body: 'Start each scene as close to the conflict as possible and leave as soon as it turns. Skip hellos and goodbyes.' },
        { title: 'Every scene turns', body: 'Something must change between the start and end of a scene. If nothing changes, cut it.' },
        { title: 'Subtext', body: 'People talk around what they feel. The audience enjoys reading the real meaning underneath.' },
        { title: 'Lean action', body: 'Action lines are short, present tense, and visual. One image per paragraph. White space is your friend.' },
        { title: 'Format is courtesy', body: 'Scene headings in caps (INT. KITCHEN - NIGHT), character names in caps above their lines, few parentheticals. Correct format lets readers focus on the story.' },
        { title: 'Introduce characters clearly', body: 'The first time a character appears, write their name in CAPS with an age and one telling detail: MAYA (30s, scrubs, exhausted).' },
      ],
      mistakes: [
        'Writing thoughts and backstory in the action lines.',
        'Characters announcing their feelings (“I am so angry”).',
        'Long paragraphs of action that read like a novel.',
        'Camera directions (“we see”, “close on”) in a spec script.',
        'Scenes that start with greetings and small talk.',
        'Parentheticals on every line.',
      ],
      glossary: [
        { term: 'Slugline', def: 'The scene heading: INT./EXT., location, time of day.' },
        { term: 'Action', def: 'The description of what we see and hear, in present tense.' },
        { term: 'Parenthetical', def: 'A short direction in brackets under a character name, like (whispering).' },
        { term: 'V.O. / O.S.', def: 'Voice-over (narration) / off-screen (in the scene but not visible).' },
        { term: 'Spec script', def: 'A script written on speculation, to sell or to show your skill.' },
        { term: 'Subtext', def: 'What a character means but doesn’t say.' },
        { term: 'Beat', def: 'A small unit of action or a pause in a scene.' },
        { term: 'Cold open', def: 'A scene that runs before a TV show’s opening titles.' },
      ],
    },
    sample: {
      title: 'Example: The returned ring',
      framework: 'scene-turn',
      text: `> Example draft with common mistakes. Character names go in CAPS on their own line, with their dialogue below.

int. coffee shop

We see LENA (20s) sitting at a table by the window. She was nervous and she kept looking at the door, because she remembers how the last time she saw Tom he left without saying goodbye, and she thinks about whether he will even come today or not.

TOM (20s) enters. He sits down across from her.

TOM
(nervously)
Hi.

LENA
I am so angry at you. You left without a word and I waited for three hours at the station, and then I went home and I cried, and my sister had to come over and sit with me all night, and I still don't understand why you did it, or what I did wrong, or why you never called.

Tom slides a small box across the table. Lena opens it. Her mother's ring.

LENA
You kept it.

TOM
You told me to.`,
    },
  });

  WP.screenplay = { classify };
})(window.WP = window.WP || {});
