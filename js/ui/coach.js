/*
 * AI coach. Uses Claude through the artifact runtime's `sample` capability when the
 * playground is opened as a Claude artifact. Elsewhere the tab explains that and the
 * rest of the app keeps working offline.
 */
(function (WP) {
  'use strict';

  const esc = (s) => WP.esc(String(s == null ? '' : s));
  const $ = (id) => document.getElementById(id);

  const ROLE = `You are a warm, honest writing coach working with a beginner writer inside a practice app called Writing Playground.
Coach like a good editor: specific, practical and encouraging, never vague. Use plain words a beginner understands and name the craft rule behind each point.
Base everything on the writer's actual text. When you quote the draft, copy the words exactly. Do not invent facts about the writer.`;

  const GOALS = {
    comedy: ['Make it funnier', 'Tighten the setup', 'Sharpen the punchline', 'Add a tag line'],
    video: ['Stronger hook', 'Make it sound spoken', 'Add an open loop', 'Shorter'],
    story: ['Show, don’t tell', 'Add sensory detail', 'Raise the stakes', 'Sharper dialogue'],
    essay: ['Make it clearer', 'Add an example', 'Stronger opening', 'Shorter'],
    poetry: ['More concrete images', 'Fit the form', 'Fresher comparison', 'Stronger last line'],
    copy: ['Focus on benefits', 'Punchier', 'Talk to “you”', 'Stronger call to action'],
  };

  const ERRORS = {
    rate_limited: 'Too many requests right now. Wait a minute, then try again.',
    session_expired: 'Your Claude session expired. Sign in again, then retry.',
    refused: 'The coach could not help with that text. Try a different passage.',
    invalid_json: 'The answer came back in the wrong shape. Try again.',
    prompt_too_large: 'That is too much text to send at once. Select a part of the draft and use Rewrite.',
    empty_completion: 'The coach had nothing to say about that. Try a longer passage.',
  };
  const OFF = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);

  const C = {
    sample: null,
    status: 'loading', // loading | ready | absent | off
    busy: null, // 'review' | 'rewrite' | 'ideas' | 'ask'
    ctl: null,
    error: '',
    rewrite: null, // { sel, goal, options }
    ideas: null,
    chat: [],
    streaming: '',
  };
  let app = null;

  function init(api) {
    app = api;
    render();
    if (!window.claude || typeof window.claude.use !== 'function') {
      C.status = 'absent';
      render();
      return;
    }
    window.claude.use('sample').then((s) => {
      C.sample = s;
      C.status = s ? 'ready' : 'absent';
      render();
    }, () => {
      C.status = 'absent';
      render();
    });
  }

  function context(limit) {
    const d = app.doc();
    const g = app.genre();
    const fw = app.frameworkDef();
    const flagged = app.results()
      .filter((r) => r.status === 'fail' || r.status === 'warn')
      .map((r) => `- ${r.title}: ${r.summary}`)
      .join('\n');
    return `GENRE: ${g.name} (${g.tagline})
FRAMEWORK: ${fw ? `${fw.name}. Beats: ${fw.beats.map((b) => b.name).join(' → ')}` : 'none chosen'}
TITLE: ${d.title || 'Untitled'}
RULE CHECKS THAT FLAGGED SOMETHING:
${flagged || '- none'}

DRAFT (lines starting with ## are section headings, lines starting with > are the writer's private notes, [square brackets] are cues):
"""
${d.text.slice(0, limit || 14000)}
"""`;
  }

  function fail(e) {
    const code = e && e.code;
    if (code === 'cancelled') return;
    if (OFF.has(code)) {
      C.status = 'off';
      return;
    }
    C.error = ERRORS[code] || 'Something went wrong reaching Claude. Try again.';
  }

  async function run(kind, fn) {
    if (C.busy || !C.sample) return;
    C.busy = kind;
    C.error = '';
    C.ctl = new AbortController();
    render();
    try {
      await fn(C.ctl.signal);
    } catch (e) {
      fail(e);
    } finally {
      C.busy = null;
      C.ctl = null;
      C.streaming = '';
      render();
    }
  }

  function review() {
    const d = app.doc();
    if (app.wordCount() < 15) {
      C.error = 'Write at least a few sentences first, then ask for a review.';
      return render();
    }
    run('review', async (signal) => {
      const data = await C.sample.json(`${ROLE}

Review this draft. Reply with only a JSON object in this shape:
{"summary": "two sentences: what the piece is doing and how well it works",
 "strengths": ["specific thing that works, with a short quote", "..."],
 "fixes": [{"quote": "exact words copied from the draft, at most 25 words", "rule": "name of the craft rule", "problem": "what is wrong, in one or two sentences", "rewrite": "a rewritten version of exactly that quote"}],
 "next_step": "the single most useful thing to do next"}
Give 2 or 3 strengths and up to 4 fixes, most important first. Ignore the writer's private notes when reviewing.

${context()}`, { signal });
      if (!data || typeof data !== 'object') throw { code: 'invalid_json' };
      d.coachReview = { at: Date.now(), data };
      app.persist();
    });
  }

  function rewrite(goal) {
    const sel = app.selection();
    if (!sel.text.trim()) {
      C.error = 'Select a sentence or paragraph in your draft first, then pick a goal.';
      return render();
    }
    run('rewrite', async (signal) => {
      const data = await C.sample.json(`${ROLE}

The writer selected this passage and wants to: ${goal}.
PASSAGE:
"""
${sel.text.slice(0, 4000)}
"""

Write 3 different rewrites of the passage that achieve the goal while keeping the writer's voice and meaning. Follow the rules of the genre below.
Reply with only a JSON object: {"options": [{"text": "the rewritten passage", "why": "one short sentence naming what changed and which rule it follows"}]}

For context, the whole draft:
${context(8000)}`, { signal });
      const options = (data && Array.isArray(data.options) ? data.options : []).filter((o) => o && o.text);
      if (!options.length) throw { code: 'invalid_json' };
      C.rewrite = { sel, goal, options };
    });
  }

  function brainstorm() {
    const g = app.genre();
    run('ideas', async (signal) => {
      const data = await C.sample.json(`${ROLE}

The writer is stuck and needs ideas for a ${g.name} piece. Their current prompt is: "${app.currentPrompt()}".
Suggest 5 distinct, specific ideas a beginner could start writing in the next five minutes. Each idea should give an angle and a first line to start from.
Reply with only a JSON object: {"ideas": [{"idea": "the idea in one sentence", "first_line": "a possible opening line"}]}

What they have written so far, if anything:
${context(3000)}`, { signal, modelTier: 'default', cache: false });
      const ideas = (data && Array.isArray(data.ideas) ? data.ideas : []).filter((x) => x && x.idea);
      if (!ideas.length) throw { code: 'invalid_json' };
      C.ideas = ideas;
    });
  }

  function ask(question) {
    const q = question.trim();
    if (!q) return;
    C.chat.push({ role: 'user', content: q });
    run('ask', async (signal) => {
      const turns = [{ role: 'user', content: `${ROLE}\nAnswer the writer's questions about their draft in a few short paragraphs. Be concrete and show examples.\n\n${context(10000)}` }]
        .concat(C.chat.slice(-8));
      try {
        const { text } = await C.sample(turns, {
          signal,
          cache: false,
          onText: ({ text }) => {
            C.streaming = text;
            const el = $('coachStream');
            if (el) el.textContent = text;
          },
        });
        C.chat.push({ role: 'assistant', content: text });
      } catch (e) {
        if (e && e.text) C.chat.push({ role: 'assistant', content: e.text + ' …' });
        else C.chat.pop();
        throw e;
      }
    });
  }

  /* ---------- rendering ---------- */

  function busyRow(kind, label) {
    return C.busy === kind
      ? `<div class="coach-busy"><span class="pulse" aria-hidden="true"></span><span>${label}</span><button class="btn btn-quiet" type="button" data-coach="stop">Stop</button></div>`
      : '';
  }

  function render() {
    const pane = $('pane-coach');
    if (!pane || !app) return;
    if (C.status !== 'ready') {
      const msg = {
        loading: 'Connecting to Claude…',
        absent: 'The coach uses Claude to read your draft the way an editor would: what works, what to fix, and rewrites you can drop in. It runs when you open Writing Playground as a Claude artifact. Everything else on this page works without it.',
        off: 'The coach is turned off for this page. You can allow it from the page’s Permissions menu, then reload.',
      }[C.status];
      pane.innerHTML = `<section class="section"><p class="eyebrow">Writing coach</p><p class="lead">${esc(msg)}</p></section>`;
      return;
    }
    const g = app.genre();
    const d = app.doc();
    const rev = d.coachReview && d.coachReview.data;
    const goals = GOALS[g.id] || GOALS.essay;
    const disabled = C.busy ? 'disabled' : '';

    pane.innerHTML = `
      <section class="section">
        <p class="eyebrow">Writing coach</p>
        <p class="small muted">Claude reads your draft like an editor would. Each request uses your own Claude account.</p>
        ${C.error ? `<p class="coach-error" role="alert">${esc(C.error)}</p>` : ''}
      </section>

      <section class="section">
        <h3>Review my draft</h3>
        <p class="small muted">What works, what to fix first, and a rewrite for each fix.</p>
        <div class="btn-row"><button class="btn btn-primary" type="button" data-coach="review" ${disabled}>${rev ? 'Review again' : 'Review my draft'}</button></div>
        ${busyRow('review', 'Reading your draft…')}
        ${rev ? renderReview(rev, d.coachReview.at) : ''}
      </section>

      <section class="section">
        <h3>Rewrite a passage</h3>
        <p class="small muted">Select text in your draft, then pick what you want from it.</p>
        <div class="btn-row">${goals.map((x) => `<button class="btn" type="button" data-coach-goal="${esc(x)}" ${disabled}>${esc(x)}</button>`).join('')}</div>
        ${busyRow('rewrite', 'Writing three versions…')}
        ${C.rewrite ? `<div class="coach-options">
          <p class="small muted">“${esc(C.rewrite.goal)}” for: <span class="quote-inline">${esc(trim(C.rewrite.sel.text, 90))}</span></p>
          ${C.rewrite.options.map((o, i) => `<div class="coach-card">
            <p class="coach-rewrite">${esc(o.text)}</p>
            ${o.why ? `<p class="small muted">${esc(o.why)}</p>` : ''}
            <div class="btn-row"><button class="btn btn-primary" type="button" data-coach-use="${i}">Replace selection</button></div>
          </div>`).join('')}
        </div>` : ''}
      </section>

      <section class="section">
        <h3>Brainstorm</h3>
        <p class="small muted">Five ideas with an opening line each, based on your current prompt.</p>
        <div class="btn-row"><button class="btn" type="button" data-coach="ideas" ${disabled}>Give me 5 ideas</button></div>
        ${busyRow('ideas', 'Thinking up ideas…')}
        ${C.ideas ? `<ol class="coach-ideas">${C.ideas.map((x, i) => `<li>
          <p>${esc(x.idea)}</p>
          ${x.first_line ? `<p class="coach-rewrite">${esc(x.first_line)}</p>` : ''}
          <button class="btn btn-quiet" type="button" data-coach-idea="${i}">Add to draft as a note</button>
        </li>`).join('')}</ol>` : ''}
      </section>

      <section class="section">
        <h3>Ask the coach</h3>
        <div class="coach-chat">
          ${C.chat.map((t) => `<div class="bubble bubble-${t.role}">${esc(t.content)}</div>`).join('')}
          ${C.busy === 'ask' ? `<div class="bubble bubble-assistant" id="coachStream">${esc(C.streaming || 'Thinking…')}</div>` : ''}
        </div>
        ${busyRow('ask', 'Answering…')}
        <form class="coach-ask" id="coachAskForm">
          <label class="sr-only" for="coachAsk">Your question</label>
          <textarea id="coachAsk" rows="2" placeholder="e.g. Is my ending strong enough? How do I make the second bit funnier?"></textarea>
          <div class="btn-row">
            <button class="btn btn-primary" type="submit" ${disabled}>Ask</button>
            ${C.chat.length ? '<button class="btn btn-quiet" type="button" data-coach="clear-chat">Clear conversation</button>' : ''}
          </div>
        </form>
      </section>`;
  }

  function trim(s, n) {
    s = String(s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function renderReview(r, at) {
    const strengths = Array.isArray(r.strengths) ? r.strengths : [];
    const fixes = Array.isArray(r.fixes) ? r.fixes.filter((f) => f && (f.problem || f.rewrite)) : [];
    return `<div class="coach-review">
      ${r.summary ? `<p class="lead">${esc(r.summary)}</p>` : ''}
      ${strengths.length ? `<p class="eyebrow">What’s working</p><ul class="plain-list good-list">${strengths.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      ${fixes.length ? `<p class="eyebrow">Fix these first</p>${fixes.map((f, i) => `<div class="coach-card">
        ${f.rule ? `<span class="badge badge-warn">${esc(f.rule)}</span>` : ''}
        ${f.quote ? `<button class="quote-btn" type="button" data-coach-find="${i}" title="Show in draft">“${esc(trim(f.quote, 140))}”</button>` : ''}
        <p>${esc(f.problem || '')}</p>
        ${f.rewrite ? `<p class="coach-rewrite">${esc(f.rewrite)}</p>
          <div class="btn-row">${f.quote ? `<button class="btn btn-primary" type="button" data-coach-apply="${i}">Use this rewrite</button>` : ''}</div>` : ''}
      </div>`).join('')}` : ''}
      ${r.next_step ? `<p class="eyebrow">Next step</p><p>${esc(r.next_step)}</p>` : ''}
      <p class="small muted">Reviewed ${new Date(at).toLocaleString()}. The coach can be wrong; trust your own ear too.</p>
    </div>`;
  }

  /* ---------- events ---------- */

  function bind() {
    const pane = $('pane-coach');
    pane.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      const d = app.doc();
      const rev = d.coachReview && d.coachReview.data;
      if (t.dataset.coach === 'review') review();
      else if (t.dataset.coach === 'ideas') brainstorm();
      else if (t.dataset.coach === 'stop') C.ctl && C.ctl.abort();
      else if (t.dataset.coach === 'clear-chat') {
        C.chat = [];
        render();
      } else if (t.dataset.coachGoal) rewrite(t.dataset.coachGoal);
      else if (t.dataset.coachUse) {
        const o = C.rewrite.options[Number(t.dataset.coachUse)];
        if (app.replaceRange(C.rewrite.sel, o.text)) {
          C.rewrite = null;
          render();
        }
      } else if (t.dataset.coachIdea) {
        const x = C.ideas[Number(t.dataset.coachIdea)];
        app.insertNote(`Idea: ${x.idea}${x.first_line ? ` First line: ${x.first_line}` : ''}`);
        app.toast('Idea added to your draft as a note.');
      } else if (t.dataset.coachFind && rev) app.locate(rev.fixes[Number(t.dataset.coachFind)].quote);
      else if (t.dataset.coachApply && rev) {
        const f = rev.fixes[Number(t.dataset.coachApply)];
        if (app.replaceQuote(f.quote, f.rewrite)) {
          f.applied = true;
          rev.fixes = rev.fixes.filter((x) => x !== f);
          app.persist();
          render();
        }
      }
    });
    pane.addEventListener('submit', (e) => {
      if (e.target.id !== 'coachAskForm') return;
      e.preventDefault();
      const box = $('coachAsk');
      const q = box.value;
      box.value = '';
      ask(q);
    });
    pane.addEventListener('keydown', (e) => {
      if (e.target.id === 'coachAsk' && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        $('coachAskForm').requestSubmit();
      }
    });
  }

  WP.coach = {
    init(api) {
      bind();
      init(api);
    },
    render,
    isReady: () => C.status === 'ready',
    askAbout(q) {
      if (C.status !== 'ready' || C.busy) return false;
      ask(q);
      return true;
    },
    reset() {
      C.rewrite = null;
      C.ideas = null;
      C.chat = [];
      C.error = '';
      render();
    },
  };
})(window.WP = window.WP || {});
