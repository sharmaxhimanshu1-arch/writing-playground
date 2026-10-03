# Writing Playground

A practice space for new writers. It gives you a wide page to write on, ideas when nothing comes to mind, and a toolkit of frameworks and lessons for the kind of writing you're doing. As you type, it checks your draft against that genre's rules and highlights what follows them and what breaks them.

It runs entirely in your browser. There is no account and no server, and nothing you write leaves your machine.

## Getting started

- **Quickest:** open `dist/writing-playground.html` in any modern browser. It's a single self-contained file.
- **From the source:** open `index.html` directly, or run `npm start` and go to <http://localhost:8080>.

Drafts are saved automatically in your browser's local storage. To keep a copy elsewhere, use **Drafts → Copy text** or **Download .txt**.

## What's on the screen

| Area | What it does |
| --- | --- |
| **Genre tabs** (top) | Comedy, Video Script, Short Story, Essay & Blog, Poetry, Copywriting. Each genre has its own drafts, frameworks, prompts, lessons and checks. |
| **Ideas** (left) | A prompt generator, an *idea builder* where you click any part to swap it, "stuck?" questions that push a draft forward, timed writing sprints, and a word goal. |
| **The page** (center) | A distraction-free editor. Use **Wide page** for more room or **Focus** to hide both panels. |
| **Checks** (right) | Your draft score, each rule's status (Following / Improve / Breaking / Tip), and why the rule exists. Click a check to show only its highlights, and click an item to jump to it in the text. |
| **Frameworks** (right) | Proven structures for the genre, each with step-by-step beats, a worked example, and an **Insert outline** button. Once inserted, the checker tracks which beats you have written. |
| **Learn** (right) | Core principles, common beginner mistakes, and a glossary for the genre. |

### Reading the highlights

- **Green underline**: follows a rule (a strong hook, a rule-of-three list, a sensory detail).
- **Amber wavy line**: worth a second look (filler words, adverbs, passive voice).
- **Red wavy line**: breaks a core rule (opening a video with "welcome back", laughing at your own joke, a cliché).
- **Dotted line**: information only (for example, a line's syllable count in a poem).

Hover over any highlight to see the reason, or move the cursor into it to read the note in the status bar.

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

The checks are rules of thumb built from word lists and patterns, not an AI that understands your meaning. They will sometimes flag something you did on purpose. Professional writers break every one of these rules deliberately; the goal is to know the rule first.

## Project layout

```text
index.html            page shell
css/app.css           styles (light and dark themes)
js/core/text.js       parser: sentences, words, syllables, readability, sections
js/core/lexicon.js    word lists (filler, clichés, senses, buzzwords…)
js/core/checks.js     check framework and checks shared by all genres
js/genres/*.js        one file per genre: checks, frameworks, lessons, prompts, example draft
js/ui/editor.js       highlighting editor (transparent textarea over a rendered backdrop)
js/app.js             panels, drafts, prompts, sprints, wiring
scripts/build.js      bundles everything into dist/*.html
tests/run-checks.js   runs every genre's checks against its examples
```

## Development

```bash
npm test         # run all checks against the sample drafts and framework examples
npm run build    # rebuild dist/writing-playground.html after changing anything
```

### Adding a genre

Create `js/genres/<name>.js` that calls `WP.genres.push({...})` with `id`, `name`, `tagline`, `checks`, `frameworks`, `prompts`, `generator`, `nudges`, `guide` and `sample` (copy an existing genre file as a template). Then add a `<script>` tag for it in `index.html`, inside the `SCRIPTS` markers, and add the file to the list in `tests/run-checks.js`.

A check is an object with `id`, `title`, `group`, `why` and a `run(ctx)` function that returns `{ status, summary, marks }`. The helpers in `js/core/checks.js` (`C.phrases`, `C.filler`, `C.longSentences`…) cover most cases.
