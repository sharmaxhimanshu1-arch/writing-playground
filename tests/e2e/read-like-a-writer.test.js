// Learn → Read like a writer: annotated model pieces, the reader view, and starting a draft from one.
module.exports = async (t) => {
  const page = await t.page({ prefs: t.RETURNING });
  await page.goto(t.url());
  await t.wait(600);

  const reader = () => page.evaluate(() => {
    const body = document.getElementById('modalBody');
    return {
      open: !document.getElementById('modal').hidden,
      title: document.getElementById('modalTitle').textContent,
      numbered: body.querySelectorAll('mark.anno sup').length,
      notes: body.querySelectorAll('.reading-notes li').length,
      sub: (body.querySelector('.reading-sub') || {}).textContent || '',
      activeMark: [...body.querySelectorAll('mark.anno.active')].map((m) => m.dataset.anno),
      activeNote: (body.querySelector('.reading-notes li.active') || { dataset: {} }).dataset.note,
    };
  });

  // Every genre lists its pieces, and every note lands on its own highlighted passage
  const genres = await page.$$eval('#genreSelect option', (o) => o.map((x) => x.value));
  for (const g of genres) {
    await page.selectOption('#genreSelect', g);
    await t.wait(300);
    await t.openTab(page, 'learn');
    const cards = await page.$$eval('#pane-learn [data-read]', (b) => b.map((x) => x.dataset.read));
    t.ok(cards.length >= 2, `${g}: Learn lists model pieces (${cards.length})`);
    for (const id of cards) {
      await page.click(`#pane-learn [data-read="${id}"]`);
      await t.wait(150);
      const r = await reader();
      t.ok(r.open && r.numbered === r.notes && r.notes >= 3, `${g}/${id}: ${r.notes} notes, each on a highlighted passage (${r.numbered})`);
      t.ok(/scores \d+ on the/.test(r.sub), `${g}/${id}: shows its score (${r.sub.trim()})`);
      await page.click('#modalClose');
    }
  }

  // Notes and passages light up together, by click and by keyboard
  await page.selectOption('#genreSelect', 'video');
  await t.wait(300);
  await t.openTab(page, 'learn');
  await page.$eval('#pane-learn .reading-list', (el) => el.scrollIntoView({ block: 'center' }));
  await t.shot(page, 'learn-readings');
  await page.click('#pane-learn [data-read="names"]');
  await t.wait(200);
  let r = await reader();
  t.eq(r.title, 'Never forget a name again', 'reader opens the chosen piece');
  t.ok(await page.isVisible('.reading-text .reading-h'), 'beat headings show as headings, without the ## marks');
  t.ok(!(await page.textContent('.reading-text')).includes('##'), 'no raw ## in the reader');
  await page.click('.reading-notes li[data-note="2"] button');
  r = await reader();
  t.ok(r.activeMark.includes('2') && r.activeNote === '2', 'clicking a note highlights its passage');
  await page.focus('mark.anno[data-anno="0"]');
  await page.keyboard.press('Enter');
  r = await reader();
  t.ok(r.activeMark.includes('0') && r.activeNote === '0', 'Enter on a passage highlights its note');
  await t.shot(page, 'read-like-a-writer');

  // Try your own: a fresh draft in the same genre and framework, with the brief as a note
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('wp.docs.v1') || '[]').length);
  await page.click('[data-read-try="names"]');
  await t.wait(400);
  t.ok(await page.isHidden('#modal'), 'reader closes');
  const text = await page.inputValue('#editor');
  t.ok(text.startsWith('> Your turn: Teach one small skill'), 'new draft starts with the brief as a note');
  t.eq(await page.$eval('#genreSelect', (s) => s.value), 'video', 'same genre');
  t.eq(await page.evaluate(() => document.activeElement.id), 'editor', 'caret is in the editor, ready to write');
  t.ok(await page.evaluate((n) => JSON.parse(localStorage.getItem('wp.docs.v1') || '[]').length > n, before), 'draft is saved');

  // Open in the editor: the model as its own example draft, with live highlights
  await t.openTab(page, 'learn');
  await page.click('#pane-learn [data-read="onions"]');
  await t.wait(150);
  await page.click('[data-read-open="onions"]');
  await t.wait(500);
  t.ok((await page.inputValue('#docTitle')).startsWith('Model: '), 'opens as a “Model:” draft');
  t.ok((await page.inputValue('#editor')).includes('onion'), 'model text is in the editor');
  t.ok((await page.$$('#backdrop .m-good')).length > 0, 'and the checks highlight what it does well');

  // Phone, dark theme: the reader stacks text above notes and stays inside the screen
  const phone = await t.page({ width: 390, height: 800, scheme: 'dark', prefs: t.RETURNING });
  await phone.goto(t.url());
  await t.wait(600);
  await t.openTab(phone, 'learn');
  await phone.click('#pane-learn [data-read]');
  await t.wait(200);
  const fits = await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.querySelector('.modal-card').getBoundingClientRect().right <= window.innerWidth);
  t.ok(fits, 'reader fits a phone screen');
  await t.shot(phone, 'read-like-a-writer-phone');
};
