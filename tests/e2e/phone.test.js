// Phone width: drawers instead of rails, nothing wider than the screen.
module.exports = async (t) => {
  const page = await t.page({ width: 400, height: 820, scheme: 'dark' });
  await page.goto(t.url());
  await t.wait(600);
  if (await page.isVisible('#tour')) await page.click('[data-tour="end"]');
  await page.click('#toggleRight');
  await t.openTab(page, 'coach');
  await t.wait(300);
  t.ok((await page.textContent('#pane-coach')).includes('Be your own editor'), 'coach drawer shows the self-edit checklist');
  await t.shot(page, 'coach');
  await page.mouse.click(8, 400);
  await t.wait(300);
  await page.click('#toggleLeft');
  await t.openTab(page, 'practice');
  await t.wait(300);
  t.ok(await page.isVisible('#pane-practice'), 'practice drawer opens');
  t.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 400), 'no horizontal scroll at 400px');
  await t.shot(page, 'practice');
};
