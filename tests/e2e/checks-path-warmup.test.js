// One thing at a time, turning a check off and on, the learning path, and a warm-up game.
module.exports = async (t) => {
  const page = await t.page({ width: 1280, height: 860, prefs: t.RETURNING });
  await page.goto(t.url());
  await t.wait(600);
  await page.selectOption('#genreSelect', 'speech');
  await t.wait(400);
  t.ok(/Example/.test(await page.inputValue('#docTitle')), 'genre menu opens that genre’s example');
  await page.selectOption('#genreSelect', 'comedy');
  await t.wait(300);

  // One thing at a time
  await page.check('#oneThingToggle');
  await t.wait(300);
  const first = (await page.textContent('.spotlight-bar')).replace(/\s+/g, ' ').trim();
  t.ok(/Fix this first/.test(first), 'one-thing mode names the first problem');
  await page.click('[data-act="next-thing"]');
  await t.wait(200);
  const second = (await page.textContent('.spotlight-bar')).replace(/\s+/g, ' ').trim();
  t.ok(second !== first && /2 of/.test(second), 'Next issue moves to the second problem');
  await t.shot(page, 'onething');
  await page.uncheck('#oneThingToggle');
  await t.wait(200);

  // Turn a check off and back on
  await page.click('[data-check="filler"]');
  await page.click('[data-mute="filler"]');
  await t.wait(300);
  t.ok(!(await page.$('[data-check="filler"]')), 'turned-off check disappears');
  t.ok(!!(await page.$('[data-unmute="filler"]')), 'turned-off check can be turned back on');
  await page.click('[data-unmute="filler"]');
  await t.wait(300);
  t.ok(!!(await page.$('[data-check="filler"]')), 'check comes back');

  // Learning path
  await t.openTab(page, 'practice');
  await t.wait(200);
  t.ok(/0 of 6/.test(await page.textContent('.path-head')), 'path starts at step 0 of 6');
  await page.click('[data-path="0"]');
  await t.wait(300);
  t.eq(await page.getAttribute('#tab-learn', 'aria-selected'), 'true', 'first path step opens Learn');
  t.ok(/1 of 6/.test(await page.textContent('.path-head')), 'reading the basics completes step 1');
  await t.shot(page, 'path');

  // Warm-up: six-word story
  await page.click('[data-game="six-word"]');
  await t.wait(400);
  t.eq(await page.inputValue('#docTitle'), 'Warm-up: Six-word story', 'warm-up opens as a draft');
  t.ok(/Sprint/.test(await page.textContent('#statSprint')), 'warm-up starts a timer');
  await page.keyboard.type('For sale: baby shoes, never worn.');
  await t.wait(700);
  t.ok(/Warm-up complete/.test(await page.textContent('#toast')), 'six words completes the warm-up');
  t.eq(JSON.stringify(await page.$$eval('#pane-checks .check-title', (x) => x.map((e) => e.textContent))), JSON.stringify(['Exactly 6 words']), 'only the warm-up rule is checked');
  await t.shot(page, 'warmup');
};
