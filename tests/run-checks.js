// Loads the analysis scripts in Node and runs every genre's checks against its
// sample draft and framework examples. Fails on any thrown error.
// Usage: node tests/run-checks.js [--verbose]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const files = [
  'js/core/text.js', 'js/core/lexicon.js', 'js/core/checks.js',
  'js/genres/comedy.js', 'js/genres/video.js', 'js/genres/story.js',
  'js/genres/essay.js', 'js/genres/poetry.js', 'js/genres/copy.js', 'js/genres/drills.js',
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

console.log('\nSyllables:', ['haiku', 'beautiful', 'radiator', 'window', 'table', 'wanted', 'jumped', 'the', 'fire'].map((w) => w + '=' + WP.text.syllables(w)).join(' '));
console.log('Rhymes:', [['night', 'light'], ['bay', 'away'], ['town', 'down'], ['sleeve', 'leave'], ['loaf', 'froze'], ['me', 'see'], ['time', 'rhyme'], ['cat', 'dog']].map(([a, b]) => `${a}/${b}=${WP.poetry.rhymes(a, b)}`).join(' '));

if (failures) {
  origError(`\n${failures} problem(s)`);
  process.exit(1);
}
console.log('\nAll checks ran cleanly.');
