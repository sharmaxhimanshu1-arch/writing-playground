// Guided write mode: one framework beat at a time, following the caret.
module.exports = async (t) => {
  const page = await t.page({ prefs: { toured: true } });
  await page.goto(t.url());
  await t.wait(700);
  const guide = () => page.evaluate(() => {
    const g = document.getElementById('guide');
    return {
      shown: !g.hidden,
      step: (g.querySelector('.guide-step') || {}).textContent || '',
      beat: (g.querySelector('.guide-beat') || {}).textContent || '',
      progress: (g.querySelector('.guide-progress') || {}).textContent || '',
      done: g.querySelectorAll('.guide-dot.done').length,
    };
  });
  const caretSection = () => page.evaluate(() => {
    const ta = document.getElementById('editor');
    const before = ta.value.slice(0, ta.selectionStart);
    const m = [...before.matchAll(/^## (.+)$/gm)].pop();
    return m ? m[1] : null;
  });

  // Start from the blank-page card
  await t.openTab(page, 'drafts');
  await page.click('[data-act="new-draft"]');
  await t.wait(300);
  t.ok(await page.isVisible('[data-start="guide"]'), 'blank page offers “Guide me step by step”');
  await page.click('[data-start="guide"]');
  await t.wait(500);
  let g = await guide();
  t.ok(g.shown, 'guide bar appears');
  t.ok(/^Beat 1 of 3/.test(g.step), 'starts on beat 1 of 3: ' + g.step);
  t.eq(g.beat, 'Setup', 'first beat is Setup');
  t.eq(await caretSection(), 'Setup', 'caret is under the Setup heading');
  t.eq((await page.inputValue('#editor')).match(/^## /gm).length, 3, 'outline headings inserted');

  // Write the beat; it is marked done
  await page.keyboard.type('Self-checkout machines are the worst thing to happen to grocery stores since the basket with the broken handle.');
  await t.wait(700);
  g = await guide();
  t.ok(/on the page/.test(g.progress), 'beat counts as written: ' + g.progress);
  t.eq(g.done, 1, 'first dot turns green');

  // Example, next, back, dots
  await page.click('[data-guide="example"]');
  t.ok(/In the example/.test(await page.textContent('#guide')), 'Show example quotes the framework example');
  await page.click('[data-guide="next"]');
  await t.wait(400);
  t.eq((await guide()).beat, 'Punchline', 'Next beat moves to Punchline');
  t.eq(await caretSection(), 'Punchline', 'caret moves under the Punchline heading');
  t.ok(!/In the example/.test(await page.textContent('#guide')), 'example closes on a new beat');
  await page.keyboard.type('Now I work there for free.');
  await t.wait(600);
  await page.click('[data-guide="back"]');
  await t.wait(300);
  t.eq((await guide()).beat, 'Setup', 'Back returns to Setup');
  await page.click('[data-guide-beat="2"]');
  await t.wait(300);
  t.eq((await guide()).beat, 'Tag', 'a dot jumps to its beat');
  await page.keyboard.press('Alt+ArrowUp');
  await t.wait(300);
  t.eq((await guide()).beat, 'Punchline', 'Alt+↑ goes to the previous beat');

  // Following the caret
  await t.clickText(page, 'Self-checkout', 3);
  t.eq((await guide()).beat, 'Setup', 'clicking into a beat shows that beat');

  // Finish every beat
  await page.click('[data-guide-beat="2"]');
  await t.wait(300);
  await page.keyboard.type('Next week I am bringing a lawyer to the bagging area.');
  await t.wait(700);
  g = await guide();
  t.ok(/All 3 beats written/.test(g.progress), 'all beats written: ' + g.progress);
  t.ok(await page.isVisible('[data-guide="checks"]'), 'finished guide points to the checks');
  await page.click('[data-guide="checks"]');
  await t.wait(200);
  t.ok(await page.isVisible('#pane-checks'), 'Open Checks opens the Checks panel');

  // Survives a reload, then closes
  await page.reload();
  await t.wait(800);
  t.ok((await guide()).shown, 'guide stays on after a reload');
  await page.click('[data-guide="exit"]');
  await t.wait(200);
  t.ok(!(await guide()).shown, 'close hides the guide');
  t.ok((await page.inputValue('#editor')).includes('lawyer'), 'closing the guide keeps the writing');

  // From the Frameworks panel, on the untouched example: starts a fresh draft
  await page.selectOption('#genreSelect', 'story');
  await t.wait(400);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('wp.docs.v1')).length);
  await t.openTab(page, 'frameworks');
  if ((await page.getAttribute('[data-fw="story-circle"]', 'aria-expanded')) !== 'true') await page.click('[data-fw="story-circle"]');
  await t.wait(200);
  await page.click('[data-fw-guide="story-circle"]');
  await t.wait(500);
  g = await guide();
  t.ok(g.shown && /of 8/.test(g.step) && g.beat === 'You', 'Story Circle guide starts at “You”: ' + g.step + ' ' + g.beat);
  t.ok((await page.evaluate(() => JSON.parse(localStorage.getItem('wp.docs.v1')).length)) > before, 'the example is left alone; a new draft holds the guide');
  t.ok(!(await page.inputValue('#editor')).includes('Eli'), 'guided draft does not reuse the example text');

  // Line-guide frameworks (haiku) have no step-by-step option
  await page.selectOption('#genreSelect', 'poetry');
  await t.wait(400);
  await t.openTab(page, 'frameworks');
  if ((await page.getAttribute('[data-fw="haiku"]', 'aria-expanded')) !== 'true') await page.click('[data-fw="haiku"]');
  await t.wait(200);
  t.ok(!(await page.$('[data-fw-guide="haiku"]')), 'no guide for a line-guide framework');

  // Phone: fits the screen
  const ph = await t.page({ width: 390, height: 844, prefs: { toured: true } });
  await ph.goto(t.url());
  await t.wait(600);
  await ph.evaluate(() => WP.app.startGuide('standup-bit'));
  await t.wait(400);
  t.ok(await ph.isVisible('#guide'), 'phone: guide shows');
  t.ok(await ph.evaluate(() => document.documentElement.scrollWidth <= 390), 'phone: no horizontal scroll');
  const dots = await ph.$$eval('.guide-dot', (d) => new Set(d.map((x) => Math.round(x.getBoundingClientRect().top))).size);
  t.eq(dots, 1, 'phone: beat dots sit on one row');
  await t.shot(ph, 'phone');
};
