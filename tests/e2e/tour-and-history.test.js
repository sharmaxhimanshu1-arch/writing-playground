// First visit: the tour, today's challenge, saving and comparing versions, asking the coach from a highlight.
module.exports = async (t) => {
  const page = await t.page();
  await page.addInitScript(() => {
    const sample = async (input, o) => {
      if (o && o.onText) o.onText({ text: 'Here is why…', delta: '' });
      return { text: 'Here is why: (coach answer)', truncated: false };
    };
    sample.json = async () => ({});
    window.claude = { use: async (n) => (n === 'sample' ? sample : null) };
  });
  await page.goto(t.url());
  await t.wait(900);
  t.ok(await page.isVisible('#tour'), 'tour shows on the first visit');
  await page.click('[data-tour="next"]');
  await page.click('[data-tour="next"]');
  await t.wait(200);
  await t.shot(page, 'tour');
  for (let i = 0; i < 3; i++) await page.click('[data-tour="next"]');
  await page.click('[data-tour="challenge"]');
  await t.wait(500);
  t.ok(/challenge/i.test(await page.inputValue('#docTitle')), 'tour ends on today’s challenge');
  t.ok((await page.inputValue('#editor')).startsWith('>'), 'challenge draft starts with its brief as a note');
  await page.keyboard.type('This is my first attempt at the challenge and I am writing a few words to see the counter move along nicely.');
  await t.wait(600);

  // Versions: save, edit, compare
  await t.openTab(page, 'drafts');
  await t.wait(200);
  await page.click('[data-act="save-version"]');
  await t.wait(200);
  await page.click('#editor');
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' I added a second sentence after saving the version.');
  await t.wait(600);
  await t.openTab(page, 'drafts');
  await t.wait(200);
  t.ok((await page.$$eval('.version', (v) => v.length)) >= 1, 'saved version is listed');
  await page.click('[data-compare]');
  await t.wait(200);
  t.ok((await page.$$eval('#modalBody ins', (x) => x.length)) > 0, 'compare marks the added words');
  await t.shot(page, 'compare');
  await page.keyboard.press('Escape');
  t.ok(!(await page.isVisible('#modal')), 'Esc closes the compare view');

  // Screenplay: a highlight without a fix offers the coach
  await page.selectOption('#genreSelect', 'screenplay');
  await t.wait(500);
  await t.openTab(page, 'checks');
  await t.clickText(page, 'remembers');
  t.ok((await page.textContent('#fixCard')).includes('filmed'), 'unfilmable-action card explains the rule');
  await page.click('[data-card-coach]');
  await t.wait(300);
  t.eq(await page.getAttribute('#tab-coach', 'aria-selected'), 'true', 'Ask the coach opens the Coach tab');
  t.eq(await page.$$eval('.bubble', (b) => b.length), 2, 'coach answers the highlight question');

  await page.selectOption('#genreSelect', 'speech');
  await t.wait(400);
  t.ok(/^\d+$/.test((await page.textContent('#tabScore')).trim()), 'speech sample gets a score');
};
