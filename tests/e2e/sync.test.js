// Sync through the Claude account: two devices on one account, against a stand-in for claude.ai's runtime.
const path = require('path');

module.exports = async (t) => {
  const store = new Map(); // path -> JSON string, shared by both "devices"
  const ops = [];
  const device = async (prefs) => {
    const page = await t.page({ width: 1280, height: 860, prefs: Object.assign({}, t.RETURNING, prefs) });
    await page.context().exposeBinding('__store', (src, op, p, body) => {
      ops.push(`${op} ${p}`);
      if (op === 'get') return store.get(p) || null;
      if (op === 'set') return void store.set(p, body);
      if (op === 'delete') return void store.delete(p);
      if (op === 'list') {
        const rows = [...store.entries()].filter(([k]) => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/')).sort().map(([k, v]) => ({ id: k.split('/').pop(), data: JSON.parse(v) }));
        return JSON.stringify(rows);
      }
      return null;
    });
    await page.addInitScript({ path: path.join(t.fixtures, 'claude-mock.js') });
    await page.goto(t.url());
    await t.wait(700);
    return page;
  };
  const drafts = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('wp.docs.v1') || '[]').map((d) => ({ id: d.id, title: d.title, text: d.text })));
  const until = async (fn, ms = 6000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await fn()) return true;
      await t.wait(150);
    }
    return false;
  };
  const write = async (page, title, text) => {
    await t.openTab(page, 'drafts');
    await page.click('[data-act="new-draft"]');
    await page.fill('#docTitle', title);
    await page.focus('#editor');
    await page.keyboard.type(text);
    await t.wait(300);
  };

  // A plain copy of the page (no Claude runtime) never offers sync
  const plain = await t.page({ prefs: t.RETURNING });
  await plain.goto(t.url());
  await t.wait(500);
  await t.openTab(plain, 'drafts');
  t.ok(!(await plain.$('[data-act="sync-on"]')), 'outside claude.ai there is no sync button');

  // Laptop: offered, off until turned on; nothing is stored before that
  const laptop = await device();
  await write(laptop, 'Laptop bit', 'My cat has a skincare routine and it is better than mine.');
  await t.openTab(laptop, 'drafts');
  t.ok(await laptop.isVisible('[data-act="sync-on"]'), 'Drafts offers “Sync my drafts”');
  t.eq(store.size, 0, 'nothing leaves the device before sync is turned on');
  await t.shot(laptop, 'offer');
  await laptop.click('[data-act="sync-on"]');
  t.ok(await until(() => [...store.keys()].some((k) => k.startsWith('data/users/u_writer/library/drafts/'))), 'turning it on stores the drafts');
  t.ok([...store.keys()].every((k) => k.startsWith('data/users/u_writer/')), 'everything is kept in the writer’s private space');
  t.ok(![...store.values()].some((v) => v.includes('Example:') && v.includes('"sample"')), 'the untouched starter sample is not synced');
  t.ok(await until(async () => (await laptop.textContent('#saveState')) === 'Saved and synced'), 'footer says “Saved and synced”');
  t.ok(await laptop.isVisible('.sync-box.on'), 'Drafts shows sync is on');
  await t.shot(laptop, 'on');

  // Phone: has its own draft; turning sync on merges both ways
  const phone = await device();
  await write(phone, 'Phone note', 'Pigeons walk like they owe somebody money.');
  await t.openTab(phone, 'drafts');
  await phone.click('[data-act="sync-on"]');
  t.ok(await until(async () => (await drafts(phone)).some((d) => d.title === 'Laptop bit')), 'phone gets the laptop’s draft');
  t.ok(await until(async () => (await drafts(laptop)).some((d) => d.title === 'Phone note')), 'laptop gets the phone’s draft, live');

  // An edit on the phone shows up in the draft open on the laptop
  const laptopBit = (await drafts(laptop)).find((d) => d.title === 'Laptop bit');
  await laptop.evaluate((id) => document.querySelector(`[data-open="${id}"]`).click(), laptopBit.id);
  await t.wait(300);
  await phone.evaluate((id) => document.querySelector(`[data-open="${id}"]`).click(), laptopBit.id);
  await t.wait(300);
  await phone.focus('#editor');
  await phone.keyboard.press('Control+End');
  await phone.keyboard.type(' She exfoliates.');
  t.ok(await until(async () => (await laptop.inputValue('#editor')).endsWith('She exfoliates.')), 'the open draft updates with the other device’s edit');

  // Deleting on one device deletes everywhere
  const note = (await drafts(laptop)).find((d) => d.title === 'Phone note');
  await t.openTab(laptop, 'drafts');
  await laptop.click(`[data-ask-delete="${note.id}"]`);
  await laptop.click(`[data-delete="${note.id}"]`);
  t.ok(await until(async () => !(await drafts(phone)).some((d) => d.id === note.id)), 'a draft deleted on the laptop goes from the phone too');
  await t.wait(800);
  t.ok(!(await drafts(laptop)).some((d) => d.id === note.id), 'and the phone doesn’t send it back');

  // Progress follows too
  await laptop.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('wp.prefs.v1'));
    p.drillsDone = ['c-filler'];
    localStorage.setItem('wp.prefs.v1', JSON.stringify(p));
  });
  await laptop.reload();
  await t.wait(800);
  t.ok(await until(async () => phone.evaluate(() => JSON.parse(localStorage.getItem('wp.prefs.v1')).drillsDone.includes('c-filler'))), 'finished drills follow to the other device');

  // Stopping on one device leaves the drafts in place
  await t.openTab(phone, 'drafts');
  await phone.click('[data-act="sync-off"]');
  const before = store.size;
  await write(phone, 'Offline thought', 'This one stays on the phone.');
  await t.wait(2600);
  t.eq(store.size, before, 'after stopping, new drafts stay on the device');
  t.ok((await drafts(phone)).some((d) => d.title === 'Laptop bit'), 'and the synced drafts are still there');
  t.ok(ops.some((o) => o.startsWith('set ')), 'writes went through the db capability');
};
