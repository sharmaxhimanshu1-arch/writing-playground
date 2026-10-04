// One-click fixes, fix-all, undo, and the AI coach against a stand-in Claude runtime.
module.exports = async (t) => {
  const page = await t.page({ prefs: t.RETURNING });
  // Stand-in for the artifact runtime so the coach can run without Claude.
  await page.addInitScript(() => {
    const review = {
      summary: 'A clear bit with a strong premise. The punchlines get buried.',
      strengths: ['“Self-checkout machines are stupid” states a clear attitude.'],
      fixes: [{ quote: 'which is honestly how my last three relationships ended or something', rule: 'Punch word last', problem: 'The tail after “ended” steps on the laugh.', rewrite: 'which is how my last three relationships ended' }],
      next_step: 'Cut every word after each punchline.',
    };
    const sample = async (input, o) => {
      if (o && o.onText) o.onText({ text: 'Try ending on “dental”.', delta: '' });
      return { text: 'Try ending on “dental”.', truncated: false };
    };
    sample.json = async (input) => {
      await new Promise((r) => setTimeout(r, 150));
      if (/rewrites of the passage/.test(input)) return { options: [{ text: 'Rewrite one.', why: 'Shorter.' }, { text: 'Rewrite two.', why: 'Punchier.' }, { text: 'Rewrite three.', why: 'Specific.' }] };
      if (/Suggest 5/.test(input)) return { ideas: [{ idea: 'Idea A', first_line: 'Line A' }, { idea: 'Idea B', first_line: 'Line B' }] };
      return review;
    };
    window.claude = { use: async (n) => (n === 'sample' ? sample : null) };
  });
  await page.goto(t.url());
  await t.wait(700);

  // Fix card on a filler word
  await t.clickText(page, 'basically');
  t.ok(await page.isVisible('#fixCard'), 'fix card opens on a filler word');
  t.ok((await page.textContent('#fixCard')).includes('Filler words'), 'fix card names the check');
  await t.shot(page, 'fixcard');
  await page.click('#fixCard [data-card-fix="0"]');
  await t.wait(300);
  t.ok(!(await page.inputValue('#editor')).includes('basically'), 'Delete it removes the word');

  // Fix every filler word from the checks list, then undo
  await t.openTab(page, 'checks');
  await page.click('[data-check="filler"]');
  await t.wait(200);
  const fixAll = await page.$('[data-fix-all="filler"]');
  t.ok(!!fixAll, 'fix-all button offered for repeated filler');
  await fixAll.click();
  await t.wait(400);
  t.ok(!(await page.inputValue('#editor')).includes('honestly'), 'fix-all removes the filler words');
  await page.focus('#editor');
  await page.keyboard.press('Control+z');
  await t.wait(400);
  t.ok((await page.inputValue('#editor')).includes('honestly'), 'Ctrl+Z undoes fix-all');

  // Coach: review, apply a rewrite, rewrite a selection, chat
  await t.openTab(page, 'coach');
  await t.wait(200);
  await page.click('[data-coach="review"]');
  await t.wait(500);
  await t.shot(page, 'coach');
  await page.click('[data-coach-apply="0"]');
  await t.wait(300);
  t.ok((await page.inputValue('#editor')).includes('which is how my last three relationships ended.'), 'review rewrite applies to the draft');
  await page.evaluate(() => {
    const ta = document.getElementById('editor');
    const i = ta.value.indexOf('One banana.');
    ta.setSelectionRange(i, i + 11);
  });
  await page.click('[data-coach-goal="Make it funnier"]');
  await t.wait(400);
  await page.click('[data-coach-use="1"]');
  await t.wait(300);
  t.ok((await page.inputValue('#editor')).includes('Rewrite two.'), 'chosen rewrite replaces the selection');
  await page.fill('#coachAsk', 'Is my ending strong?');
  await page.press('#coachAsk', 'Enter');
  await t.wait(300);
  t.eq(await page.$$eval('.bubble', (b) => b.length), 2, 'question and answer appear in the chat');

  // A drill: solving it completes it
  await t.openTab(page, 'practice');
  await page.click('[data-drill="c-punch"]');
  await t.wait(500);
  t.ok(/Drill/.test(await page.inputValue('#docTitle')), 'drill opens as a draft');
  await page.evaluate(() => {
    const ta = document.getElementById('editor');
    ta.focus();
    ta.setSelectionRange(0, ta.value.length);
    document.execCommand('insertText', false, '> Drill\n\nMy doctor told me to watch my drinking. So now I drink in front of a mirror.\n\nI finally told my plants I love them. Three of them died that week. Apparently love is a lot of pressure.');
  });
  await t.wait(800);
  t.ok(/Drill complete/.test(await page.textContent('#toast')), 'solving the drill completes it');

  // Progress shows today's words
  await t.openTab(page, 'ideas');
  await t.wait(200);
  t.ok(/words today/.test(await page.textContent('#pane-ideas')), 'progress shows words written today');
  t.ok(await page.isVisible('#listenBtn'), 'Listen button available');
};
