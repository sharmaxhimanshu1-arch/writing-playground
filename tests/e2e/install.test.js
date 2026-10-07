// The installable app: manifest and icons, the offline worker, opening with no connection, and the Install button.
const fs = require('fs');
const path = require('path');

module.exports = async (t) => {
  const page = await t.page({ prefs: t.RETURNING });
  await page.goto(t.url());
  await t.wait(600);

  // Manifest and icons are all there
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]').href;
    const m = await (await window.fetch(href)).json();
    const icons = await Promise.all(m.icons.map(async (i) => ({ src: i.src, ok: (await window.fetch(new URL(i.src, href))).ok })));
    return { name: m.name, display: m.display, start: m.start_url, icons };
  });
  t.eq(manifest.display, 'standalone', 'manifest opens in its own window');
  t.ok(manifest.icons.length >= 3 && manifest.icons.every((i) => i.ok), 'every manifest icon loads: ' + JSON.stringify(manifest.icons));

  // The worker lists every file the page loads
  const sw = fs.readFileSync(path.join(t.root, 'sw.js'), 'utf8');
  const scripts = await page.$$eval('script[src]', (s) => s.map((x) => x.getAttribute('src')));
  t.ok(scripts.every((s) => sw.includes(`"${s}"`)), 'sw.js keeps a copy of every script');

  // It installs and takes over; then the app opens with no connection
  const active = await page.evaluate(async () => {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 8000))]);
    return !!(reg && reg.active);
  });
  t.ok(active, 'offline worker is active');
  await page.reload();
  await t.wait(600);
  t.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'worker controls the page after a reload');
  await page.context().setOffline(true);
  await page.reload();
  await t.wait(800);
  t.ok(await page.isVisible('#editor'), 'the app opens offline');
  t.ok(await page.evaluate(() => !!(window.WP && WP.app && WP.app.doc())), 'and runs: a draft is open');
  await page.context().setOffline(false);

  // Install button appears when the browser offers it, and asks the browser to install
  await t.openTab(page, 'drafts');
  t.ok(!(await page.$('[data-act="install"]')), 'no Install button until the browser offers it');
  await page.evaluate(() => {
    const e = new window.Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__prompted = true; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await t.wait(200);
  t.ok(await page.isVisible('[data-act="install"]'), 'Drafts offers “Install the app”');
  await page.$eval('[data-act="install"]', (b) => b.scrollIntoView());
  await t.shot(page, 'install');
  await page.click('[data-act="install"]');
  t.ok(await page.evaluate(() => window.__prompted === true), 'clicking it opens the browser’s install prompt');

  // The single-file build never registers a worker
  const single = await t.page({ prefs: t.RETURNING });
  await single.goto(t.fileUrl('dist/writing-playground.html'));
  await t.wait(500);
  t.ok(await single.evaluate(() => !document.querySelector('link[rel="manifest"]')), 'the single-file build has no manifest');
};
