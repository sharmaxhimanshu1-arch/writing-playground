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
  'js/genres/essay.js', 'js/genres/poetry.js', 'js/genres/copy.js',
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

function analyse(genre, text, framework) {
  const fw = genre.frameworks.find((f) => f.id === framework) || null;
  const ctx = WP.text.parse(text, { framework, genre: genre.id });
  ctx.frameworkDef = fw;
  const out = WP.checks.run(genre.checks, ctx);
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
