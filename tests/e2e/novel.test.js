// The Novel genre: its example chapter, novel-specific checks, guided first chapter, drills and plan.
module.exports = async (t) => {
  const page = await t.page({ prefs: t.RETURNING });
  await page.goto(t.url());
  await t.wait(700);
  const options = await page.$$eval('#genreSelect option', (o) => o.map((x) => x.textContent));
  t.ok(options.includes('Novel'), 'genre menu lists Novel: ' + options.join(', '));
  await page.selectOption('#genreSelect', 'novel');
  await t.wait(500);
  t.eq(await page.inputValue('#docTitle'), 'Example: Chapter one', 'Novel opens its example chapter');

  const results = await page.evaluate(() => Object.fromEntries(WP.app.state.results.map((r) => [r.id, r.status])));
  t.eq(results['chapter-endings'], 'fail', 'example chapter ends by winding down');
  t.eq(results.tense, 'fail', 'example slips between past and present tense');
  t.ok(results.backstory === 'fail' || results.backstory === 'warn', 'example dumps backstory: ' + results.backstory);
  t.eq(results['opening-line'], 'warn', 'example opens with waking up');
  const slips = await page.evaluate(() => WP.app.state.allMarks.filter((m) => m.checkId === 'tense').map((m) => document.getElementById('editor').value.slice(m.start, m.end)));
  t.eq(JSON.stringify(slips.sort()), JSON.stringify(['looks', 'walks']), 'tense slips highlighted: ' + slips.join(', '));

  // Fix the tense slips and the check passes
  await page.evaluate(() => {
    const ta = document.getElementById('editor');
    ta.focus();
    ta.setSelectionRange(0, ta.value.length);
    document.execCommand('insertText', false, ta.value.replace('She walks to the window and looks down', 'She walked to the window and looked down'));
  });
  await t.wait(700);
  t.eq(await page.evaluate(() => WP.app.state.results.find((r) => r.id === 'tense').status), 'pass', 'fixing the slips makes the tense check pass');

  // Frameworks and plan
  await t.openTab(page, 'frameworks');
  const fws = await page.$$eval('#pane-frameworks .fw-name', (x) => x.map((e) => e.textContent.replace('In use', '').trim()));
  t.ok(fws.includes('First Chapter') && fws.includes('Snowflake Method') && fws.length === 4, 'four novel frameworks: ' + fws.join(', '));
  t.eq(await page.$$eval('#planBox textarea', (x) => x.length), 5, 'Plan this piece asks five novel questions');

  // Guided first chapter from a blank draft
  await t.openTab(page, 'drafts');
  await page.click('[data-act="new-draft"]');
  await t.wait(300);
  await page.click('[data-start="guide"]');
  await t.wait(500);
  t.ok(/Beat 1 of 5/.test(await page.textContent('#guide')), 'guided first chapter has five beats');
  t.eq(await page.textContent('#guide .guide-beat'), 'Hook', 'guide starts at the hook');

  // Drills
  await t.openTab(page, 'practice');
  t.eq(await page.$$eval('#pane-practice [data-drill^="n-"]', (x) => x.length), 4, 'four novel drills');
  await page.click('[data-drill="n-tense"]');
  await t.wait(500);
  await page.evaluate(() => {
    const ta = document.getElementById('editor');
    ta.focus();
    ta.setSelectionRange(0, ta.value.length);
    document.execCommand('insertText', false, '> Drill\n\nLeila walked into the station. She looked at the board and saw her train was gone. She turned and grabbed her bag. The guard laughed and walked away.');
  });
  await t.wait(800);
  t.ok(/Drill complete/.test(await page.textContent('#toast')), 'fixing the tense completes the drill');

  // Coach fallback has novel questions
  await t.openTab(page, 'coach');
  t.ok((await page.textContent('#pane-coach')).includes('pull rather than winding down'), 'self-edit checklist has novel questions');
};
