// The fix card: Next issue, no tooltip underneath, de-duplicated notes, score change, long framework names, print.
module.exports = async (t) => {
  const page = await t.page({ width: 1440, height: 900, prefs: t.RETURNING });
  await page.goto(t.url()); await page.waitForTimeout(800);
  t.ok(!(await page.$('.score-delta')), 'no delta on first load');
  // hover then click a warn mark: tooltip must not sit under the card
  const m = await page.$('.backdrop .m-warn'); const box = await m.boundingBox();
  await page.mouse.move(box.x + 3, box.y + box.height / 2); await page.waitForTimeout(200);
  await page.mouse.click(box.x + 3, box.y + box.height / 2); await page.waitForTimeout(200);
  await page.mouse.move(box.x + 5, box.y + box.height / 2); await page.waitForTimeout(200);
  t.ok(!(await page.isHidden('#fixCard')), 'fix card open');
  t.ok(await page.isHidden('#tooltip'), 'tooltip hidden while the fix card is open');
  const cardText = await page.textContent('#fixCard');
  t.ok(!/Filler: /.test(cardText), 'note does not repeat the check name');
  const status = await page.textContent('#cursorNote');
  t.ok(!/Filler words: Filler:/.test(status), 'status note not doubled: ' + status);
  // next issue walks forward and wraps
  const starts = [];
  for (let i = 0; i < 12; i++) {
    starts.push(await page.evaluate(() => document.getElementById('editor').selectionStart));
    if (!(await page.$('[data-card-next]'))) break;
    await page.click('[data-card-next]'); await page.waitForTimeout(250);
    t.ok(!(await page.isHidden('#fixCard')), 'card stays open after Next ' + (i + 1));
  }
  t.ok(new Set(starts).size >= 5, 'Next visits several different issues');
  // fix through the card -> score delta
  const before = Number(await page.textContent('#tabScore'));
  await page.keyboard.press('Escape');
  const w = await page.$('.backdrop .m-warn'); const wb = await w.boundingBox();
  await page.mouse.click(wb.x + 3, wb.y + wb.height / 2); await page.waitForTimeout(200);
  const fixBtn = await page.$('[data-card-fix]');
  if (fixBtn) {
    await fixBtn.click(); await page.waitForTimeout(700);
    const after = Number(await page.textContent('#tabScore'));
    const delta = await page.$('.score-delta');
    if (after !== before) t.ok(delta && (await delta.textContent()).includes(String(Math.abs(after - before))), 'delta shows the change');
    await page.waitForTimeout(2700);
    t.ok(!(await page.$('.score-delta')), 'delta goes away');
  }
  // switching genre: no delta, no stale status note
  await page.selectOption('#genreSelect', 'story'); await page.waitForTimeout(600);
  t.ok(!(await page.$('.score-delta')), 'no delta after switching genre');
  t.ok((await page.textContent('#cursorNote')).trim() === '', 'status note cleared after switching genre');
  // story toolbar fits one row
  t.ok((await page.evaluate(() => document.querySelector('.sheet-tools').getBoundingClientRect().height)) < 50, 'long framework name keeps toolbar on one row');
  // preview print button (not artifact)
  await page.click('#previewBtn'); await page.waitForTimeout(200);
  t.ok(await page.$('[data-act="print"]'), 'preview has a print button');
};
