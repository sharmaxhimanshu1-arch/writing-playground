// Deleting the last draft, copies, backup and restore, storage pruning, and the modal focus trap.
const fs = require('fs');
const path = require('path');

module.exports = async (t) => {
  const page = await t.page({ prefs: t.RETURNING, downloads: true });
  await page.goto(t.url());
  await t.wait(600);

  // Deleting the only draft leaves a fresh one, not a crash
  await t.openTab(page, 'drafts');
  await page.click('[data-ask-delete]');
  await page.click('[data-delete]');
  await t.wait(300);
  t.eq(await page.$$eval('.draft-item', (x) => x.length), 1, 'deleting the only draft leaves one empty draft');

  // Make a copy
  await page.focus('#editor');
  await page.keyboard.type('A short original sentence for the copy test.');
  await t.wait(500);
  await t.openTab(page, 'drafts');
  await page.click('[data-act="duplicate"]');
  await t.wait(300);
  t.ok(/copy/i.test(await page.inputValue('#docTitle')), 'Make a copy opens the copy');

  // Backup
  await t.openTab(page, 'drafts');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="backup"]')]);
  const file = path.join(t.out, 'backup.json');
  await dl.saveAs(file);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  t.eq(data.app, 'writing-playground', 'backup file is tagged');
  t.eq(data.docs.length, 2, 'backup holds both drafts');

  // Restore into a fresh browser profile
  const p2 = await t.page({ prefs: t.RETURNING });
  await p2.goto(t.url());
  await t.wait(500);
  await t.openTab(p2, 'drafts');
  await p2.setInputFiles('#restoreFile', file);
  await t.wait(500);
  t.ok(/Backup restored: 2 new drafts/.test(await p2.textContent('#toast')), 'restore confirms what it added');
  t.eq(await p2.$$eval('.draft-item', (x) => x.length), 3, 'restore merges drafts with what was there');

  // Storage pressure: 30 big versions get thinned, the one saved by hand survives
  const crafted = {
    app: 'writing-playground',
    format: 1,
    docs: [{ id: 'bigdoc', title: 'Big', genre: 'story', framework: 'three-act', text: 'Hello there.', created: 1, updated: Date.now(), versions: Array.from({ length: 30 }, (_, i) => ({ at: 1000 + i, text: 'word '.repeat(30000) + i, words: 30000, score: 50, label: i === 3 ? 'Saved by you' : 'Auto-saved' })) }],
    progress: {},
  };
  const craftedFile = path.join(t.out, 'crafted.json');
  fs.writeFileSync(craftedFile, JSON.stringify(crafted));
  await p2.setInputFiles('#restoreFile', craftedFile);
  await t.wait(800);
  const after = await p2.evaluate(() => {
    const raw = localStorage.getItem('wp.docs.v1');
    const big = JSON.parse(raw).find((d) => d.id === 'bigdoc');
    return { stored: raw.length, kept: big ? big.versions.length : -1, mine: big ? big.versions.some((v) => v.label === 'Saved by you') : false, state: document.getElementById('saveState').textContent };
  });
  t.ok(after.stored < 3.6e6, `storage stays under the soft limit (${after.stored} chars)`);
  t.ok(after.kept > 0 && after.kept < 30, `oldest automatic versions are thinned (${after.kept} kept)`);
  t.ok(after.mine, 'the version saved by hand is kept');
  t.eq(after.state, 'Saved in this browser', 'save still succeeds');
  await t.openTab(p2, 'drafts');
  t.ok(/MB of about/.test(await p2.textContent('.storage')), 'storage meter appears once storage fills up');

  // Modal focus trap
  await page.keyboard.press('Control+/');
  await t.wait(200);
  for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
  t.ok(await page.evaluate(() => document.getElementById('modal').contains(document.activeElement)), 'Tab stays inside the open popup');
  await page.keyboard.press('Escape');
};
