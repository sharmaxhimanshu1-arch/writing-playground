// The calm layout: panels closed behind icon rails, one genre menu, migration, tour, phone drawers.
module.exports = async (t) => {
  const url = t.url();
  const vis = (p, sel) => p.evaluate((s) => { const el = document.querySelector(s); return !!el && el.offsetParent !== null && getComputedStyle(el).display !== 'none'; }, sel);

  // Returning user with the old layout (both panels open): migrated to closed panels.
  const page = await t.page({ width: 1440, height: 900, prefs: { toured: true, showLeft: true, showRight: true } });
  await page.goto(url); await page.waitForTimeout(800);
  t.ok(!(await vis(page, '#leftPanel')) && !(await vis(page, '#rightPanel')), 'panels start closed');
  t.ok(await vis(page, '.rail-left') && await vis(page, '.rail-right'), 'both rails visible');
  t.ok(!(await page.$('#genreTabs')), 'genre tab strip removed');
  t.ok(await vis(page, '#genreSelect'), 'one genre menu in the top bar');
  t.ok(!(await vis(page, '#toggleLeft')) && !(await vis(page, '#toggleRight')), 'drawer buttons hidden on desktop');
  t.ok(!(await page.$('#genreChip')), 'no second genre select on the page');
  const sheetW = await page.evaluate(() => document.getElementById('sheet').offsetWidth);
  t.ok(sheetW >= 700, 'page has room: ' + sheetW);
  t.ok((await page.textContent('#railScore')).trim() === (await page.textContent('#tabScore')).trim(), 'rail shows the live score');

  // Rails
  await page.click('#rail-checks'); await page.waitForTimeout(150);
  t.ok(await vis(page, '#pane-checks'), 'Checks rail opens the checks panel');
  t.ok((await page.getAttribute('#rail-checks', 'aria-pressed')) === 'true', 'rail button pressed');
  t.ok(!(await vis(page, '#rightPanel .panel-tabs')), 'panel tabs hidden on desktop');
  t.ok((await page.textContent('#rightTitle')) === 'Checks', 'panel header names the tab');
  await page.click('#rail-learn'); await page.waitForTimeout(150);
  t.ok(await vis(page, '#pane-learn') && (await page.textContent('#rightTitle')) === 'Learn', 'another rail button switches tab');
  await page.click('#rail-learn'); await page.waitForTimeout(150);
  t.ok(!(await vis(page, '#rightPanel')), 'clicking the open tab again closes the panel');
  await page.click('#rail-drafts'); await page.waitForTimeout(150);
  await page.click('#leftPanel [data-close]'); await page.waitForTimeout(150);
  t.ok(!(await vis(page, '#leftPanel')), 'close button closes the panel');
  t.ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'rail-drafts'), 'focus returns to the rail button');

  // Choice persists after reload
  await page.click('#rail-checks'); await page.waitForTimeout(150);
  await page.reload(); await page.waitForTimeout(800);
  t.ok(await vis(page, '#rightPanel') && !(await vis(page, '#leftPanel')), 'an opened panel stays open after reload');

  // Genre menu and check-as
  await page.selectOption('#genreSelect', 'poetry'); await page.waitForTimeout(400);
  t.ok((await page.inputValue('#genreSelect')) === 'poetry', 'genre menu switches genre');
  await page.click('#rail-drafts'); await page.waitForTimeout(150);
  await page.selectOption('#checkAsSelect', 'story'); await page.waitForTimeout(400);
  t.ok((await page.inputValue('#genreSelect')) === 'story', 'check-as in Drafts changes the draft’s genre');

  // Focus hides rails
  await page.click('#focusBtn'); await page.waitForTimeout(150);
  t.ok(!(await vis(page, '.rail-left')) && !(await vis(page, '#rightPanel')), 'focus mode hides rails and panels');
  await page.click('#focusBtn');

  // New visitor: tour opens panels, then leaves them closed again
  const np = await t.page({ width: 1440, height: 900 });
  await np.goto(url); await np.waitForTimeout(900);
  t.ok(await np.isVisible('#tour'), 'tour on first visit');
  await np.click('[data-tour="next"]'); await np.click('[data-tour="next"]'); await np.waitForTimeout(150);
  t.ok(await vis(np, '#leftPanel'), 'tour step opens the Ideas panel');
  for (let i = 0; i < 2; i++) await np.click('[data-tour="next"]');
  await np.waitForTimeout(150);
  t.ok(await vis(np, '#rightPanel'), 'tour step opens the toolkit');
  await np.keyboard.press('Escape'); await np.waitForTimeout(200);
  if (await np.isVisible('#tour')) await np.click('#tour button:has-text("Skip"), #tour [data-tour="skip"]').catch(() => {});
  await np.waitForTimeout(200);
  t.ok(!(await vis(np, '#leftPanel')) && !(await vis(np, '#rightPanel')), 'panels closed again after the tour');

  // Phone
  const ph = await t.page({ width: 390, height: 844, prefs: { toured: true } });
  await ph.goto(url); await ph.waitForTimeout(800);
  t.ok(!(await vis(ph, '.rail-left')), 'phone: no rails');
  const lp = await ph.evaluate(() => document.getElementById('leftPanel').getBoundingClientRect().right);
  t.ok(lp <= 1, 'phone: drawer off screen until opened (' + lp + ')');
  await ph.click('#toggleRight'); await ph.waitForTimeout(400);
  t.ok(await vis(ph, '#rightPanel .panel-tabs'), 'phone: drawer keeps its tabs');
  const rp = await ph.evaluate(() => document.getElementById('rightPanel').getBoundingClientRect());
  t.ok(rp.right <= 391 && rp.left >= 0, 'phone: right drawer on screen');
  t.ok(await ph.evaluate(() => document.documentElement.scrollWidth <= 390), 'phone: no horizontal scroll');
};
