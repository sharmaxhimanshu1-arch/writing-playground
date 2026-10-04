// Planning a piece (and the plan reaching the coach), writing habits, What improved?, and Preview.
module.exports = async (t) => {
  const page = await t.page({ prefs: t.RETURNING });
  await page.addInitScript(() => {
    const sample = async (input) => { window.__lastPrompt = JSON.stringify(input); return { text: 'ok', truncated: false }; };
    sample.json = async (input) => { window.__lastPrompt = input; return { summary: 'ok', strengths: [], fixes: [], next_step: 'x' }; };
    window.claude = { use: async (n) => (n === 'sample' ? sample : null) };
  });
  await page.goto(t.url());
  await t.wait(600);
  await page.selectOption('#genreSelect', 'story');
  await t.wait(300);

  // Plan a new draft
  await t.openTab(page, 'drafts');
  await page.click('[data-act="new-draft"]');
  await t.wait(200);
  await t.openTab(page, 'frameworks');
  await t.wait(200);
  t.ok(await page.evaluate(() => document.getElementById('planBox').open), 'plan is open on a new draft');
  await page.fill('#plan-character', 'Nadia, 19, pickpocket');
  await page.fill('#plan-want', 'To find her real family');
  await t.wait(700);
  t.ok(/2 of/.test(await page.textContent('#planBox summary .small')), 'plan counts answered questions');
  await t.shot(page, 'plan');

  // Write something with plenty of habits to find
  await page.focus('#editor');
  await page.keyboard.type('Nadia was very angry. She felt that the market was very big and she saw a man. She really wanted his wallet. It was a nice wallet and she thought it was very good. Then she realized the man was watching her very carefully and she felt scared and she ran.');
  await t.wait(700);
  await t.openTab(page, 'coach');
  await t.wait(200);
  await page.click('[data-coach="review"]');
  await t.wait(400);
  t.ok(await page.evaluate(() => /Main character: Nadia/.test(window.__lastPrompt || '')), 'the plan is sent to the coach');

  // Writing habits
  await t.openTab(page, 'ideas');
  await page.click('[data-act="habits"]');
  await t.wait(300);
  t.ok((await page.$$('.habits li')).length >= 2, 'habits lists the most common issues');
  await t.shot(page, 'habits');
  const drillBtn = await page.$('[data-habit-drill]');
  t.ok(!!drillBtn, 'a habit links to the drill that trains it');
  await drillBtn.click();
  await t.wait(400);
  t.ok(/Drill/.test(await page.inputValue('#docTitle')), 'habit link opens the drill');

  // What improved? after fixing two issues in the sample story
  await t.openTab(page, 'drafts');
  await page.click('.draft-open >> text=Example: The last bus');
  await t.wait(400);
  await t.openTab(page, 'drafts');
  t.ok(!!(await page.$('[data-act="improved"]')), 'What improved? is offered once a version exists');
  await page.evaluate(() => {
    const ta = document.getElementById('editor');
    ta.focus();
    ta.setSelectionRange(0, ta.value.length);
    document.execCommand('insertText', false, ta.value.replace('He felt very nervous.', 'His hands shook.').replace(' loudly', ''));
  });
  await t.wait(700);
  await t.openTab(page, 'drafts');
  await page.click('[data-act="improved"]');
  await t.wait(300);
  const fixed = await page.$$eval('.improved.fixed li b', (x) => x.map((e) => e.textContent));
  t.ok(fixed.some((x) => /Show, don’t tell/.test(x)), 'What improved? credits the fixed rule: ' + fixed.join(', '));
  await t.shot(page, 'improved');
  await page.keyboard.press('Escape');

  // Preview hides notes
  await page.click('#previewBtn');
  await t.wait(200);
  t.ok(!(await page.textContent('.preview')).includes('Example draft.'), 'preview hides notes');
  t.ok((await page.$$eval('.preview p', (x) => x.length)) >= 5, 'preview shows the paragraphs');
  t.ok(!!(await page.$('[data-act="print"]')), 'preview offers print / PDF');
  await t.shot(page, 'preview');
};
