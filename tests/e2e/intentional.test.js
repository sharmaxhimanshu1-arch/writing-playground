// "It's intentional": dismissing a highlight for one draft, and taking it back.
module.exports = async (t) => {
  const page = await t.page({ prefs: t.RETURNING });
  await page.goto(t.url());
  await t.wait(700);
  const filler = () => page.evaluate(() => {
    const r = WP.app.state.results.find((x) => x.id === 'filler');
    return { status: r.status, summary: r.summary, words: r.marks.filter((m) => m.level !== 'good' && m.level !== 'info').map((m) => document.getElementById('editor').value.slice(m.start, m.end).toLowerCase()) };
  });
  const score = async () => Number((await page.textContent('#railScore')).trim());

  const before = await filler();
  t.ok(before.words.includes('basically') && before.words.length >= 3, 'sample flags several filler words: ' + before.words.join(', '));
  const score0 = await score();

  // From the fix card
  await t.clickText(page, 'basically');
  t.ok(await page.isVisible('[data-card-ignore]'), 'fix card offers “It’s intentional”');
  await page.click('[data-card-ignore]');
  await t.wait(400);
  const after = await filler();
  t.ok(!after.words.includes('basically'), '“basically” is no longer flagged');
  t.eq(after.words.length, before.words.length - 1, 'other filler words are still flagged');
  t.ok(/marked as intentional/.test(after.summary), 'the rule says how many were marked intentional');
  t.ok(/won’t be flagged/.test(await page.textContent('#toast')), 'a message confirms and says where to undo');
  t.ok(await page.isVisible('#fixCard'), 'the card moves on to the next issue');

  // The Checks panel lists it, and it survives a reload
  await page.reload();
  await t.wait(800);
  t.ok(!(await filler()).words.includes('basically'), 'still dismissed after a reload');
  await t.openTab(page, 'checks');
  await page.click('[data-fold="ignored"] summary');
  t.ok(/1 highlight you kept on purpose/.test(await page.textContent('#pane-checks')), 'Checks lists the kept highlight');

  // Dismiss the rest from the rule's list: the rule then counts as followed and the score goes up
  await page.click('[data-check="filler"]');
  await t.wait(200);
  for (let i = 0; i < 10 && (await filler()).status !== 'pass'; i++) {
    const b = await page.$('.check:has([data-check="filler"]) [data-ignore]');
    if (!b) break;
    await b.click();
    await t.wait(300);
  }
  const done = await filler();
  t.eq(done.status, 'pass', 'with every filler spot dismissed, the rule counts as followed');
  t.ok((await score()) > score0, `score goes up (${score0} → ${await score()})`);

  // Take one back
  await t.openTab(page, 'checks');
  if (!(await page.evaluate(() => document.querySelector('[data-fold="ignored"]').open))) await page.click('[data-fold="ignored"] summary');
  const n = await page.$$eval('[data-unignore]', (x) => x.length);
  t.ok(n >= 3, `all kept highlights are listed (${n})`);
  await page.click('[data-unignore="0"]');
  await t.wait(400);
  t.ok((await filler()).words.includes('basically'), '“Check it again” brings the highlight back');
  t.ok((await filler()).status !== 'pass', 'and the rule is no longer followed');

  // Other drafts are not affected
  await t.openTab(page, 'drafts');
  await page.click('[data-act="duplicate"]');
  await t.wait(400);
  await t.openTab(page, 'drafts');
  await page.click('[data-act="new-draft"]');
  await t.wait(300);
  await page.focus('#editor');
  await page.keyboard.type('It was basically fine, I guess, and really we just basically left the party early because honestly it was late.');
  await t.wait(700);
  t.ok((await filler()).words.includes('basically'), 'a different draft still flags the same word');

  // Drills test the rule itself: no dismissing there
  await t.openTab(page, 'practice');
  await page.click('[data-drill="c-specific"]');
  await t.wait(500);
  const flagged = await page.$('.backdrop .m-warn, .backdrop .m-bad');
  if (flagged) {
    const box = await flagged.boundingBox();
    await page.mouse.click(box.x + 3, box.y + box.height / 2);
    await t.wait(300);
    t.ok(!(await page.$('[data-card-ignore]')), 'drills do not offer “It’s intentional”');
  } else t.ok(false, 'drill draft has a flagged spot to test');
};
