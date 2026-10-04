// Browser tests: drives the real page in Chromium and checks what a writer would see.
//   npm run e2e               run every tests/e2e/*.test.js
//   npm run e2e -- starter    run only the files whose name contains "starter"
// Screenshots land in tests/e2e/output/ (ignored by git).
const fs = require('fs');
const path = require('path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  console.error('Playwright is not installed. Run `npm install`, then `npx playwright install chromium`.');
  process.exit(1);
}

const root = path.join(__dirname, '..', '..');
const out = path.join(__dirname, 'output');
const fixtures = path.join(__dirname, 'fixtures');
fs.mkdirSync(out, { recursive: true });

// A returning visitor who has seen the tour and keeps both panels open.
const RETURNING = { toured: true, layout: 2, showLeft: true, showRight: true };

async function runFile(browser, file) {
  const name = path.basename(file, '.test.js');
  const failures = [];
  const contexts = [];
  let passed = 0;
  const t = {
    root,
    out,
    fixtures,
    RETURNING,
    url: (p = 'index.html') => 'file://' + path.join(root, p),
    /** A fresh browser profile and page. `prefs` seeds localStorage once (kept across reloads). */
    async page({ width = 1440, height = 900, scheme = 'light', prefs, downloads = false } = {}) {
      const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, acceptDownloads: downloads });
      contexts.push(ctx);
      ctx.setDefaultTimeout(10000);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => failures.push(`page error: ${e.message}`));
      if (prefs) {
        await page.addInitScript((p) => {
          if (!localStorage.getItem('wp.prefs.v1')) localStorage.setItem('wp.prefs.v1', JSON.stringify(p));
        }, prefs);
      }
      return page;
    },
    ok(cond, msg) {
      if (cond) passed++;
      else failures.push(msg);
    },
    eq(actual, expected, msg) {
      t.ok(actual === expected, `${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
    },
    shot: (page, label, opts = {}) => page.screenshot({ path: path.join(out, `${name}-${label}.png`), ...opts }),
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    /** Puts the caret inside `needle` and clicks there, as a writer clicking a highlight would. */
    async clickText(page, needle, offset = 2) {
      const i = (await page.inputValue('#editor')).indexOf(needle);
      if (i < 0) throw new Error(`"${needle}" is not in the draft`);
      await page.evaluate((p) => WP.editorInstance.reveal(p, p), i + offset);
      await t.wait(350);
      await page.evaluate((p) => {
        const ta = document.getElementById('editor');
        ta.focus();
        ta.setSelectionRange(p, p);
        ta.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }, i + offset);
      await t.wait(200);
    },
    openTab: (page, tab) => page.evaluate((x) => WP.openTab(x), tab),
  };
  const started = Date.now();
  try {
    await require(file)(t);
  } catch (e) {
    failures.push(`threw: ${(e.stack || String(e)).split('\n').slice(0, 4).join('\n    ')}`);
  }
  for (const c of contexts) await c.close().catch(() => {});
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (failures.length) {
    console.log(`✗ ${name} (${passed} passed, ${failures.length} failed, ${secs}s)`);
    failures.forEach((f) => console.log(`    - ${f}`));
  } else console.log(`✓ ${name} (${passed} checks, ${secs}s)`);
  return failures.length;
}

(async () => {
  const filter = process.argv[2] || '';
  const files = fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.test.js') && f.includes(filter))
    .sort()
    .map((f) => path.join(__dirname, f));
  if (!files.length) {
    console.error(`No test files match "${filter}".`);
    process.exit(1);
  }
  const browser = await chromium.launch();
  let failed = 0;
  for (const f of files) failed += (await runFile(browser, f)) ? 1 : 0;
  await browser.close();
  console.log(failed ? `\n${failed} of ${files.length} test files failed.` : `\nAll ${files.length} test files passed.`);
  process.exit(failed ? 1 : 0);
})();
