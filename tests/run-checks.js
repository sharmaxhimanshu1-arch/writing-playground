// Loads the analysis scripts in Node and runs every genre's checks against its
// sample draft and framework examples. Fails on any thrown error.
// Usage: node tests/run-checks.js [--verbose]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const files = [
  'js/core/text.js', 'js/core/lexicon.js', 'js/core/checks.js',
  'js/genres/comedy.js', 'js/genres/video.js', 'js/genres/story.js', 'js/genres/novel.js',
  'js/genres/essay.js', 'js/genres/poetry.js', 'js/genres/copy.js', 'js/genres/speech.js', 'js/genres/screenplay.js', 'js/genres/drills.js', 'js/genres/warmups.js', 'js/genres/plans.js', 'js/genres/readings.js',
];
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });

const WP = sandbox.WP;
const verbose = process.argv.includes('--verbose');
let failures = 0;
const origError = console.error;
console.error = (...a) => { failures++; origError(...a); };

function analyse(genre, text, framework, force) {
  const fw = genre.frameworks.find((f) => f.id === framework) || null;
  const ctx = WP.text.parse(text, { framework, genre: genre.id });
  ctx.frameworkDef = fw;
  const out = WP.checks.run(genre.checks, ctx, { force: force || [] });
  for (const r of out.results) {
    for (const m of r.marks) {
      if (!(m.start >= 0 && m.end <= text.length && m.end > m.start)) {
        failures++;
        origError(`Bad mark range in ${genre.id}/${r.id}`, m);
      }
    }
  }
  return out;
}

for (const g of WP.genres) {
  const s = analyse(g, g.sample.text, g.sample.framework);
  console.log(`\n== ${g.name}: sample score ${s.score}`);
  if (verbose) for (const r of s.results) console.log(`  [${r.status}] ${r.title}: ${r.summary} (${r.marks.length} marks)`);
  for (const fw of g.frameworks) {
    const r = analyse(g, fw.example, fw.id);
    console.log(`   ${fw.name}: example score ${r.score}`);
  }
  // Drills: the flawed passage should not pass its rule; the model answer should.
  for (const d of WP.drills[g.id] || []) {
    const fwId = d.framework || g.frameworks[0].id;
    const status = (t) => {
      const r = analyse(g, t, fwId, [d.rule]).results.find((x) => x.id === d.rule);
      return r ? r.status : 'missing';
    };
    const before = status(d.text);
    const after = status(d.model);
    const ok = before !== 'pass' && before !== 'missing' && (after === 'pass' || after === 'info');
    console.log(`   drill ${d.id}: ${before} -> ${after}${ok ? '' : '   <-- check this drill'}`);
    if (before === 'missing') { failures++; origError('Drill rule missing:', d.id, d.rule); }
  }
  // Fixes produce strings
  for (const r of s.results) for (const m of r.marks) for (const f of m.fixes || []) {
    if (typeof f.text !== 'string' || !f.label) { failures++; origError('Bad fix', g.id, r.id, f); }
  }
  // Edge cases
  analyse(g, '', null);
  analyse(g, '## Heading only\n> a note\n[CUE]', null);
  analyse(g, 'One.', null);
}

// Warm-up games: a failing and a passing attempt for each.
const attempts = {
  'six-word': ['Too few words here.', 'For sale: baby shoes, never worn.'],
  fifty: ['Short.', Array.from({ length: 50 }, (_, i) => 'word' + i).join(' ') + '.'],
  lipogram: ['The end is near.', Array.from({ length: 41 }, () => 'cat').join(' ') + '.'],
  'three-words': ['Nothing here at all.', null],
  abc: ['One. Two. Three. Four. Five.', 'Ants march. Bees hum. Cats nap. Dogs bark. Eels swim.'],
  'no-crutches': ['It was very nice.', Array.from({ length: 81 }, () => 'quiet').join(' ') + '.'],
  'five-senses': ['A room.', 'The red lamp glowed. A clock ticked. Coffee and smoke hung in the air. The tea tasted bitter. The chair was rough and cold.'],
  'dialogue-only': ['She walked in.', Array.from({ length: 8 }, (_, i) => `"Line ${i} of the talk."`).join('\n')],
};
for (const game of WP.warmups.list) {
  const params = game.setup ? game.setup() : {};
  const checks = game.checks(params);
  const [bad, good0] = attempts[game.id];
  const good = good0 || `The ${params.words.join(' and the ')} ` + Array.from({ length: 60 }, () => 'sat').join(' ') + '.';
  const status = (t) => {
    const ctx = WP.text.parse(t, {});
    const r = WP.checks.run(checks, ctx, { force: checks.map((c) => c.id) }).results;
    return r.every((x) => x.status === 'pass');
  };
  const ok = !status(bad) && status(good);
  console.log(`warm-up ${game.id}: ${ok ? 'ok' : 'WRONG'}`);
  if (!ok) { failures++; origError('Warm-up check misbehaves:', game.id); }
}

// Marking highlights as intentional: all of a check's flagged spots dismissed means the rule counts as followed.
{
  const story = WP.genres.find((g) => g.id === 'story');
  const text = story.sample.text;
  const ctx = () => Object.assign(WP.text.parse(text, { framework: story.sample.framework, genre: 'story' }), { frameworkDef: story.frameworks.find((f) => f.id === story.sample.framework) });
  const plain = WP.checks.run(story.checks, ctx());
  const issueWords = (r) => [...new Set(r.marks.filter((m) => m.level === 'warn' || m.level === 'bad').map((m) => text.slice(m.start, m.end)))];
  // The flagged rule with the most distinct flagged spots, so both cases below get exercised.
  const target = plain.results.filter((r) => (r.status === 'warn' || r.status === 'fail') && issueWords(r).length).sort((a, b) => issueWords(b).length - issueWords(a).length)[0];
  const words = issueWords(target);
  const all = WP.checks.run(story.checks, ctx(), { ignore: words.map((w) => ({ check: target.id, text: w })) });
  const after = all.results.find((r) => r.id === target.id);
  const okAll = after.status === 'pass' && !after.marks.some((m) => m.level === 'warn' || m.level === 'bad') && all.score > plain.score;
  console.log(`intentional (all of "${target.title}"): ${okAll ? 'ok' : 'WRONG'} (${target.status} → ${after.status}, score ${plain.score} → ${all.score})`);
  if (!okAll) { failures++; origError('Ignoring every flagged spot should make the check pass and raise the score.'); }
  if (words.length > 1) {
    const some = WP.checks.run(story.checks, ctx(), { ignore: [{ check: target.id, text: words[0].toUpperCase() }] }).results.find((r) => r.id === target.id);
    const okSome = some.status === target.status && some.ignored >= 1 && /marked as intentional/.test(some.summary);
    console.log(`intentional (one of several, any case): ${okSome ? 'ok' : 'WRONG'}`);
    if (!okSome) { failures++; origError('Ignoring one spot should drop only it and keep the status.'); }
  }
}

// Read like a writer: model pieces should be strong examples, and every note should point at real text.
for (const g of WP.genres) {
  const list = (WP.readings || {})[g.id] || [];
  if (!list.length) { failures++; origError('No readings for', g.id); }
  for (const r of list) {
    const problems = [];
    if (!g.frameworks.some((f) => f.id === r.framework)) problems.push(`unknown framework ${r.framework}`);
    const spots = r.notes.map((n) => ({ q: n.quote, at: r.text.indexOf(n.quote) }));
    for (const s of spots) if (s.at < 0) problems.push(`quote not found: "${s.q}"`);
    const placed = spots.filter((s) => s.at >= 0).sort((a, b) => a.at - b.at);
    for (let i = 1; i < placed.length; i++) if (placed[i].at < placed[i - 1].at + placed[i - 1].q.length) problems.push(`quotes overlap: "${placed[i].q}"`);
    if (r.notes.length < 3) problems.push('fewer than 3 notes');
    if (!r.tryIt) problems.push('no try-it brief');
    const out = analyse(g, r.text, r.framework);
    for (const x of out.results) if (x.status === 'fail') problems.push(`breaks ${x.title}`);
    if (out.score < 80) problems.push(`score ${out.score} is below 80`);
    console.log(`reading ${g.id}/${r.id}: score ${out.score}${problems.length ? '   <-- ' + problems.join('; ') : ''}`);
    if (problems.length) { failures++; origError('Reading needs work:', r.id); }
  }
}

console.log('\nSyllables:', ['haiku', 'beautiful', 'radiator', 'window', 'table', 'wanted', 'jumped', 'the', 'fire'].map((w) => w + '=' + WP.text.syllables(w)).join(' '));
console.log('Rhymes:', [['night', 'light'], ['bay', 'away'], ['town', 'down'], ['sleeve', 'leave'], ['loaf', 'froze'], ['me', 'see'], ['time', 'rhyme'], ['cat', 'dog']].map(([a, b]) => `${a}/${b}=${WP.poetry.rhymes(a, b)}`).join(' '));

if (failures) {
  origError(`\n${failures} problem(s)`);
  process.exit(1);
}
console.log('\nAll checks ran cleanly.');
