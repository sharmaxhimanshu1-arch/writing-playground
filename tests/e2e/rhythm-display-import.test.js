// Sentence rhythm, the draft outline and study view, display settings, shortcuts and importing a file.
const path = require('path');

module.exports = async (t) => {
  const page = await t.page({ prefs: t.RETURNING });
  await page.goto(t.url());
  await t.wait(600);
  await page.selectOption('#genreSelect', 'story');
  await t.wait(400);

  // Rhythm chart: clicking a bar selects that sentence
  await page.click('#rhythmBox summary');
  await t.wait(200);
  const bars = await page.$$('#rhythmBox .bar-hit');
  t.ok(bars.length >= 10, 'one rhythm bar per sentence');
  await bars[2].click();
  await t.wait(300);
  const sel = await page.evaluate(() => { const ta = document.getElementById('editor'); return ta.value.slice(ta.selectionStart, ta.selectionEnd); });
  t.ok(sel.length > 10 && !sel.includes('\n\n'), 'clicking a bar selects its sentence');
  await t.shot(page, 'rhythm');

  // Outline and study view
  await t.openTab(page, 'frameworks');
  await t.wait(200);
  t.ok((await page.$$eval('.outline li', (x) => x.length)) >= 4, 'outline lists the first sentence of each paragraph');
  await page.click('[data-fw-study="story-circle"]');
  await t.wait(200);
  t.eq(await page.$$eval('.study-beat', (x) => x.length), 8, 'study view shows all eight Story Circle beats');
  await t.shot(page, 'study');
  await page.keyboard.press('Escape');

  // Display settings keep the highlight layer aligned with the text
  await page.click('#displayBtn');
  await page.click('text=Easy-read');
  await page.click('text=Extra large');
  await page.click('text=Relaxed');
  await t.wait(200);
  await page.keyboard.press('Escape');
  const al = await page.evaluate(() => {
    const ta = document.getElementById('editor');
    const bd = document.getElementById('backdrop');
    return { ta: ta.scrollHeight, bd: bd.getBoundingClientRect().height, fontTa: getComputedStyle(ta).fontFamily, fontBd: getComputedStyle(bd).fontFamily, size: getComputedStyle(ta).fontSize };
  });
  t.ok(Math.abs(al.ta - al.bd) < 4, `editor and highlights stay the same height (${al.ta} vs ${al.bd})`);
  t.eq(al.fontTa, al.fontBd, 'editor and highlights use the same font');
  t.eq(al.size, '25px', 'extra large text applies');
  await t.shot(page, 'display');

  // Shortcuts
  await page.keyboard.press('Control+/');
  await t.wait(200);
  t.eq(await page.textContent('#modalTitle'), 'Keyboard shortcuts', 'Ctrl+/ shows the shortcuts');
  await page.keyboard.press('Escape');
  await page.click('#editor');
  await page.keyboard.press('Control+.');
  await t.wait(300);
  t.ok(await page.isChecked('#oneThingToggle'), 'Ctrl+. turns on one-thing mode');
  await t.openTab(page, 'checks');
  await page.uncheck('#oneThingToggle');
  await t.wait(200);

  // Import a text file, then use a stronger-word fix
  await t.openTab(page, 'drafts');
  await page.setInputFiles('#importFile', path.join(t.fixtures, 'import.txt'));
  await t.wait(600);
  t.eq(await page.inputValue('#docTitle'), 'import', 'imported file’s name becomes the title');
  t.ok((await page.inputValue('#editor')).startsWith('My trip'), 'imported text fills the draft');
  await t.clickText(page, 'very tired', 6);
  t.ok(/exhausted/.test(await page.textContent('#fixCard')), 'weak pair offers a stronger word');
  await page.click('#fixCard [data-card-fix="0"]');
  await t.wait(300);
  t.ok((await page.inputValue('#editor')).includes('I was exhausted after the flight.'), '“very tired” becomes “exhausted”');
};
