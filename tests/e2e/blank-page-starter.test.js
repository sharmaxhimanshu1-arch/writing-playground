// The "How do you want to start?" card on an empty draft, and the issues-first checks layout.
module.exports = async (t) => {
  const page = await t.page({ prefs: t.RETURNING });
  await page.goto(t.url());
  await t.wait(500);
  const fresh = async () => {
    await t.openTab(page, 'drafts');
    await page.click('[data-act="new-draft"]');
    await t.wait(300);
  };
  const expect = {
    prompt: (r) => r.text.startsWith('> Prompt:'),
    outline: (r) => r.text.startsWith('## '),
    plan: (r) => r.focus.startsWith('plan-'),
    warmup: (r) => r.title.startsWith('Warm-up:'),
    type: (r) => r.text === '' && r.focus === 'editor',
  };
  for (const kind of Object.keys(expect)) {
    await fresh();
    t.ok(await page.isVisible('#starter'), `${kind}: starter card shows on an empty draft`);
    if (kind === 'prompt') {
      const covered = await page.evaluate(() => {
        const link = document.getElementById('syntaxHelp');
        link.scrollIntoView({ block: 'center' });
        const r = link.getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) !== link;
      });
      t.ok(!covered, 'starter card does not cover the links under the page');
    }
    await page.click(`[data-start="${kind}"]`);
    await t.wait(400);
    const r = await page.evaluate(() => ({
      text: document.getElementById('editor').value,
      title: document.getElementById('docTitle').value,
      focus: document.activeElement.id || document.activeElement.tagName,
    }));
    t.ok(expect[kind](r), `${kind}: option does what it says (${JSON.stringify({ text: r.text.slice(0, 30), title: r.title, focus: r.focus })})`);
    // Plan and type leave the draft empty, so the card rightly stays for them.
    if (kind !== 'type' && kind !== 'plan') t.ok(await page.isHidden('#starter'), `${kind}: starter card goes away once there is text`);
  }

  // Issues come first; passing rules fold away
  await t.openTab(page, 'drafts');
  await page.click('.draft-open >> text=Example');
  await t.wait(400);
  t.ok((await page.$$eval('#pane-checks .check', (x) => x.length)) > 3, 'needs-work cards listed');
  t.ok(!(await page.evaluate(() => document.querySelector('[data-fold="passing"]').open)), 'passing rules start folded');
};
