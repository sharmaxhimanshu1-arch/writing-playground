// The single-file build in dist/ boots and checks a draft on its own, opened straight from disk.
const fs = require('fs');
const path = require('path');

module.exports = async (t) => {
  t.ok(fs.existsSync(path.join(t.root, 'dist/writing-playground.html')), 'dist/writing-playground.html exists (run npm run build)');
  const page = await t.page({ width: 1280, height: 800, scheme: 'dark', prefs: { toured: true } });
  await page.goto(t.fileUrl('dist/writing-playground.html'));
  await t.wait(700);
  await page.selectOption('#genreSelect', 'copy');
  await t.wait(500);
  t.ok(/^\d+$/.test((await page.textContent('#railScore')).trim()), 'built file scores the copy example');
  t.ok((await page.$$('.backdrop .m')).length > 5, 'built file highlights the draft');
  await t.shot(page, 'dark');
};
