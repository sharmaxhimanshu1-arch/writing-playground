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

  // The fix card is a sheet along the bottom, keeps the marked words in view, and swipes away
  const sheet = await t.page({ width: 390, height: 760, prefs: t.RETURNING });
  await sheet.goto(t.url());
  await t.wait(700);
  const marks = await sheet.$$('.backdrop .m-warn, .backdrop .m-bad');
  const last = marks[marks.length - 1];
  await last.scrollIntoViewIfNeeded();
  const mb = await last.boundingBox();
  await sheet.mouse.click(mb.x + 2, mb.y + mb.height / 2);
  await t.wait(500);
  const geo = await sheet.evaluate(() => {
    const c = document.getElementById('fixCard').getBoundingClientRect();
    const sel = document.getElementById('editor').selectionStart;
    const m = [...document.querySelectorAll('.backdrop .m')].find((x) => Number(x.dataset.start) <= sel && Number(x.dataset.start) + x.textContent.length >= sel);
    return { open: !document.getElementById('fixCard').hidden, sheet: document.getElementById('fixCard').classList.contains('sheet-mode'), left: c.left, right: c.right, bottom: c.bottom, top: c.top, vw: window.innerWidth, vh: window.innerHeight, mark: m ? m.getBoundingClientRect().bottom : null };
  });
  t.ok(geo.open && geo.sheet, 'fix card opens as a bottom sheet on a phone');
  t.ok(geo.left === 0 && Math.abs(geo.right - geo.vw) < 1 && Math.abs(geo.bottom - geo.vh) < 1, `sheet spans the bottom edge (${JSON.stringify(geo)})`);
  t.ok(geo.mark !== null && geo.mark <= geo.top, 'the marked words stay visible above the sheet');
  const tall = await sheet.$$eval('#fixCard .btn', (b) => b.every((x) => x.getBoundingClientRect().height >= 44));
  t.ok(tall, 'sheet buttons are thumb-sized');
  await t.shot(sheet, 'fix-sheet');
  await sheet.evaluate(() => {
    const c = document.getElementById('fixCard');
    const touch = (type, y) => c.dispatchEvent(new window.TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [new window.Touch({ identifier: 1, target: c, clientY: y })] }));
    touch('touchstart', 600);
    touch('touchmove', 700);
    touch('touchend', 700);
  });
  await t.wait(200);
  t.ok(await sheet.isHidden('#fixCard'), 'swiping the sheet down dismisses it');
};
