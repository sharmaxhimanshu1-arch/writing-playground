# Writing Playground

A practice space for new writers. It gives you a wide page to write on, ideas when nothing comes to mind, and a toolkit of frameworks and lessons for the kind of writing you're doing. As you type, it checks your draft against that genre's rules and highlights what follows them and what breaks them.

It runs entirely in your browser. There is no account and no server. Nothing you write leaves your machine unless you ask the AI coach for help.

## Getting started

- **Quickest:** open `dist/writing-playground.html` in any modern browser. It's a single self-contained file.
- **From the source:** open `index.html` directly, or run `npm start` and go to <http://localhost:8080>.

Drafts are saved automatically in your browser's local storage, which only exists in that browser on that device. Use **Drafts → Download a backup** now and then: it saves every draft, its history and your progress in one file, and **Restore a backup** brings them back on any browser (it merges, never deletes). The Drafts tab also shows how much of the browser's storage you're using. If space runs low, the oldest automatic versions are thinned out first; versions you saved yourself are kept.

## What's on the screen

| Area | What it does |
| --- | --- |
| **Genre tabs** (top) | Comedy, Video Script, Short Story, Essay & Blog, Poetry, Copywriting, Speech, Screenplay. Each genre has its own drafts, frameworks, prompts, lessons and checks. |
| **Ideas** (left) | A new challenge every day for each genre (a prompt, a framework and a word target); **Get an idea**, which switches between a ready-made prompt and *Build one*, where you click any part of the idea to swap it; "stuck?" questions that push a draft forward; timed writing sprints and a word goal; and your daily word count and streak (with a 14-day chart) plus **See my writing habits** (your most common issues across all drafts, each linked to the drill that trains it, plus the words you lean on). |
| **Practice** (left) | **Your path**: six steps per genre (read the basics, four drills, then a full piece that scores 75+), with a level that grows as you go. **Drills**: 32 short exercises, four per genre, each training one rule; fix a flawed passage until its check turns green, then compare with a model answer. **Warm-ups**: eight 3–5 minute games with one hard rule checked live (six-word story, fifty-word story, no letter E, three random words, ABC sentences, no crutch words, five senses, dialogue only). |
| **Drafts** (left) | All your drafts, with search once you have more than five (open a .txt or .md file to bring in writing from elsewhere; **Make a copy** to experiment without risk), backup and restore, plus the history of the current one: versions saved automatically every 10 minutes (or whenever you click **Save a version now**), a chart of how the score changed (once it has changed), a word-by-word **Compare** with today's text, **What improved?** (which rules you fixed since the first version, which still need work), and **Restore**. |
| **The page** (center) | A distraction-free editor. A blank draft asks **How do you want to start?** (a prompt, a quick plan, a framework outline, or a 3-minute warm-up). One toolbar row holds the genre rules, the framework, and Listen, Preview and Display. Click a highlight to see why it's marked, get a one-click fix where one exists (delete a filler word, "said angrily" → "said", "utilize" → "use"), and press **Next issue** to step through every problem in order, like a spell checker. When an edit changes the score, a small +/− shows by how much. **Listen** reads the draft (or your selection) aloud, so you can hear a joke's timing or a script's rhythm. **Preview** shows the draft as a reader will see it, without notes or highlights, and can print it or save it as a PDF. **Display** changes the text size, line spacing, font (including an easy-read font designed for low vision) and page width. Use **Focus** to hide both panels. **Formatting tips**, under the page, shows the few marks the checker understands. |
| **Checks** (right) | Your draft score, then the rules that **need work** first; tips, rules you already follow and checks that haven't started yet fold away below, with the sentence rhythm chart at the end. Each rule shows its status (Following / Improve / Breaking / Tip) and why it exists. Click a check to show only its highlights, click an item to jump to it, or fix every occurrence at once. **Sentence rhythm** charts every sentence's length so you can see a flat, droning stretch at a glance; click a bar to find the sentence. Feeling overwhelmed? Tick **One thing at a time** to see only the most important problem, then the next. Any check you find unhelpful can be turned off per genre. |
| **Coach** (right) | An AI writing coach powered by Claude: **Review my draft** (strengths, the fixes that matter most, and a rewrite you can drop in for each), **Rewrite a passage** (select text, pick a goal like "Sharpen the punchline", get three versions), **Brainstorm** (five ideas with first lines), and **Ask the coach** questions about your draft. You can also click any highlight and choose **Ask the coach** to have it explained. It runs when the playground is opened as a Claude artifact and uses the viewer's own Claude account. Anywhere else, the tab becomes **Be your own editor**: five revision questions for the genre, one per read-through, ticked off and saved with the draft, plus the three rules the checks say to fix first. |
| **Frameworks** (right) | **Plan this piece**: four or five questions for the genre to answer before you write (a story's character, want, obstacle, stakes and change; a video's viewer, promise, points and call to action, and so on). Your answers are saved with the draft and shared with the coach. Below that, proven structures for the genre, each with step-by-step beats, a worked example, **Study the example** (each beat's job next to the example text), and an **Insert outline** button. Once inserted, the checker tracks which beats you have written; click a written beat to jump to it. **Your draft's outline** lists the first sentence of every paragraph, so you can check the structure in ten seconds. |
| **Learn** (right) | Core principles, common beginner mistakes, and a glossary for the genre. |

### Reading the highlights

- **Green underline**: follows a rule (a strong hook, a rule-of-three list, a sensory detail).
- **Amber wavy line**: worth a second look (filler words, adverbs, passive voice).
- **Red wavy line**: breaks a core rule (opening a video with "welcome back", laughing at your own joke, a cliché).
- **Dotted line**: information only (for example, a line's syllable count in a poem).

Hover over any highlight to see the reason, or click it for the fix card. Weak pairs like "very tired" or "really big" get a one-click swap to a single stronger word ("exhausted", "huge"). First-time visitors get a 30-second tour; you can replay it from the **Learn** tab.

### Keyboard shortcuts

`Ctrl/⌘ + S` save · `Ctrl/⌘ + .` next issue · `Ctrl/⌘ + Shift + F` focus mode · `Ctrl/⌘ + Shift + L` listen · `Ctrl/⌘ + /` show all shortcuts · `Esc` close or dismiss.

### Writing conventions the checker understands

```text
## Heading         starts a section or framework beat
> note             a private note or hint; checks ignore it
[B-ROLL: city]     a cue or stage direction, not spoken text
(blank line)       separates paragraphs, jokes (bits) and stanzas
```

## What each genre covers

| Genre | Frameworks | Some of the live checks |
| --- | --- | --- |
| Comedy | Setup → Punchline, Greg Dean's joke structure, Stand-up bit, Rule of three, Sketch "game of the scene", Observational | Punch word at the end, lean setups, rule of three, specificity, attitude, twist in the punchline, laugh density, callbacks, act-outs, laughing at your own joke |
| Video Script | Hook · Value · CTA, Short-form, Problem · Agitate · Solve, Story arc (but/therefore), Countdown, Tutorial | Hook in the first seconds, estimated runtime, speakable sentences, "you" focus, call to action, open loops, but/therefore, visual cues, segments |
| Short Story | Three-act, Story Circle, Hero's Journey, Save the Cat, Seven-point | Opening line, show-don't-tell, filter words, five senses, dialogue tags, stakes, adverbs, passive voice, rhythm |
| Essay & Blog | Classic essay, PREP, Inverted pyramid, How-to, Problem → Solution, Personal essay | Main point up front, headings, transitions, evidence, weasel words, strong ending, reading level |
| Poetry | Free verse, Haiku, Limerick, Shakespearean sonnet, Ballad, Couplets | Lines per stanza, syllable count, rhyme scheme, concrete images, line endings, clichés |
| Copywriting | AIDA, PAS, Before · After · Bridge, FAB, 4 U's headlines, Hook · Story · Offer | Headline, "you" over "we", benefits, call to action, proof and urgency, buzzwords, hype level |
| Speech | Toast, Idea talk (TED-style), Monroe's Motivated Sequence, Elevator pitch, Tell them three times | Strong opening, speaking time, sayable sentences, signposting, rule of three, repetition for emphasis, a story, speaking to the room, ending on your message |
| Screenplay | Scene (goal · conflict · turn), Short film, Argument scene, Cold open | Scene headings, lean action lines, present tense, only what can be filmed, no camera directions, short speeches, few parentheticals, subtext, page count |

The checks are rules of thumb built from word lists and patterns, not an AI that understands your meaning. They will sometimes flag something you did on purpose. Professional writers break every one of these rules deliberately; the goal is to know the rule first.

## Project layout

```text
index.html            page shell
css/app.css           styles (light and dark themes)
js/core/text.js       parser: sentences, words, syllables, readability, sections
js/core/lexicon.js    word lists (filler, clichés, senses, buzzwords…)
js/core/checks.js     check framework and checks shared by all genres
js/core/diff.js       word-level diff used to compare draft versions
js/genres/*.js        one file per genre: checks, frameworks, lessons, prompts, example draft
js/genres/drills.js   practice drills for every genre
js/genres/warmups.js  timed warm-up games with live constraint checks
js/genres/plans.js    "Plan this piece" questions for each genre
js/ui/editor.js       highlighting editor (transparent textarea over a rendered backdrop)
js/ui/coach.js        AI coach (uses the Claude artifact runtime when available)
js/app.js             panels, drafts, prompts, sprints, wiring
scripts/build.js      bundles everything into dist/*.html
tests/run-checks.js   runs every genre's checks against its examples
```

## Development

```bash
npm test         # run all checks against samples, framework examples, drills and warm-ups
npm run build    # rebuild dist/writing-playground.html after changing anything
```

### Adding a genre

Create `js/genres/<name>.js` that calls `WP.genres.push({...})` with `id`, `name`, `tagline`, `checks`, `frameworks`, `prompts`, `generator`, `nudges`, `guide` and `sample` (copy an existing genre file as a template). Then add a `<script>` tag for it in `index.html`, inside the `SCRIPTS` markers, and add the file to the list in `tests/run-checks.js`.

A check is an object with `id`, `title`, `group`, `why` and a `run(ctx)` function that returns `{ status, summary, marks }`. A mark can carry `fixes: [{ label, text }]`; an empty `text` deletes the marked words and the app tidies the spacing and capitals around them. The helpers in `js/core/checks.js` (`C.phrases`, `C.filler`, `C.longSentences`…) cover most cases.
