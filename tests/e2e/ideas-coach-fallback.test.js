// Display page width, unified highlight labels, the idea card, warm-up grid and the offline self-edit coach.
module.exports = async (t) => {
  const page = await t.page({ width: 1440, height: 900, prefs: t.RETURNING });
  await page.goto(t.url()); await page.waitForTimeout(700);

  // toolbar: no width button, display modal has page width
  t.ok(!(await page.$('#widthBtn')), 'width button removed');
  await page.click('#displayBtn');
  await page.click('input[name="disp-width"][value="wide"] + span');
  t.ok(await page.evaluate(() => document.getElementById('sheet').classList.contains('wide')), 'display: wide page applies');
  await page.click('input[name="disp-width"][value="normal"] + span');
  t.ok(!(await page.evaluate(() => document.getElementById('sheet').classList.contains('wide'))), 'display: normal width applies');
  await page.click('#modalClose');

  // checks: no zero chip, rhythm after lists, consistent labels
  const chips = await page.$$eval('#pane-checks .filter', (els) => els.map((e) => e.textContent.trim()));
  t.ok(!chips.some((t) => /Consider|Info/.test(t)), 'chip labels unified: ' + chips.join(' | '));
  t.ok(!chips.some((t) => / 0$/.test(t)), 'no zero-count chips');
  const order = await page.evaluate(() => { const p = document.getElementById('pane-checks'); const r = p.querySelector('#rhythmBox'); const n = p.querySelector('.check'); return r && n && (n.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING) ? 'after' : 'before'; });
  t.ok(order === 'after', 'rhythm sits after the checks');

  // ideas: one card with a mode switch
  await page.click('[data-act="idea-mode"][data-mode="build"]');
  t.ok(await page.$('#pane-ideas .slot'), 'build mode shows the idea builder');
  t.ok(!(await page.$('[data-act="next-prompt"]')), 'prompt hidden in build mode');
  await page.click('#pane-ideas .slot');
  await page.click('[data-act="use-idea"]');
  t.ok((await page.inputValue('#editor')).includes('Idea:'), 'use idea starts a draft');
  await page.evaluate(() => WP.openTab('ideas'));
  await page.click('[data-act="idea-mode"][data-mode="prompt"]');
  t.ok(await page.$('[data-act="next-prompt"]'), 'prompt mode back');

  // empty draft: checks show no chips
  await page.evaluate(() => WP.openTab('drafts')); await page.click('[data-act="new-draft"]'); await page.waitForTimeout(300);
  t.ok((await page.$$('#pane-checks .filter')).length === 0, 'no highlight chips on an empty draft');
  t.ok(!(await page.$('#pane-drafts .score-spark')), 'no history chart for a fresh draft');
  t.ok(!(await page.$('#pane-drafts .storage')), 'storage meter hidden while storage is nearly empty');

  // formatting tips link
  await page.click('#syntaxHelp'); await page.waitForTimeout(200);
  t.ok(await page.evaluate(() => !document.getElementById('pane-learn').hidden && document.getElementById('learnSyntax').classList.contains('flash')), 'formatting tips opens Learn at the syntax section');

  // warm-up grid
  await page.evaluate(() => WP.openTab('practice'));
  const tiles = await page.$$('#pane-practice .game-tile');
  t.ok(tiles.length === 8, '8 warm-up tiles');
  await tiles[0].click(); await page.waitForTimeout(300);
  const title = await page.inputValue('#docTitle');
  t.ok(/six/i.test(title), 'six-word warm-up started: ' + title);

  // coach fallback: checklist persists
  await page.evaluate(() => WP.openTab('coach'));
  const boxes = await page.$$('#pane-coach [data-self-edit]');
  t.ok(boxes.length === 5, 'self-edit has 5 questions');
  await page.click('#pane-coach [data-self-edit="1"]');
  t.ok(await page.evaluate(() => document.activeElement && document.activeElement.dataset.selfEdit === "1"), "focus stays on the ticked box");
  t.ok((await page.textContent('#pane-coach')).includes('1 of 5 done'), 'self-edit counts ticks');
  await page.reload(); await page.waitForTimeout(700);
  await page.evaluate(() => WP.openTab('coach'));
  t.ok(await page.isChecked('#pane-coach [data-self-edit="1"]'), 'self-edit tick survives reload');

  // speech genre: own coach questions
  await page.selectOption('#genreSelect', 'speech');
  await page.waitForTimeout(300);
  await page.evaluate(() => WP.openTab('coach'));
  t.ok((await page.textContent('#pane-coach')).includes('grab the room'), 'speech has its own self-edit questions');

  // status bar grade wording
  await page.evaluate(() => WP.openTab('drafts'));
  t.ok(/^Reading grade/.test(await page.textContent('#statGrade')) || (await page.textContent('#statGrade')) === '', 'status bar says “Reading grade”');

  // phone: no horizontal scroll, toolbar ok
  const ph = await t.page({ width: 400, height: 820, prefs: t.RETURNING });
  await ph.goto(t.url()); await ph.waitForTimeout(700);
  t.ok(await ph.evaluate(() => document.documentElement.scrollWidth <= 400), 'phone: no horizontal scroll');
  await t.shot(ph, 'phone');
};
