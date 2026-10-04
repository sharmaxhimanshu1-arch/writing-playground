/*
 * The frame around the page: genre menu, panels and icon rails, theme, the welcome tour, and the status bar.
 */
(function (WP) {
  'use strict';

  const A = WP.app;
  const {
    $, T, doc, esc, frameworkDef, genre, genreById, persist, prefs, sampleDoc, savePrefs, state,
    toast
  } = A;

  // Opens a panel on a tab (never closes it). Used by tests and handy from the console.
  WP.openTab = (tab) => {
    const side = ['ideas', 'practice', 'drafts'].includes(tab) ? 'left' : 'right';
    if (window.matchMedia('(max-width: 960px)').matches) {
      $('layout').classList.remove('show-left', 'show-right');
      $('layout').classList.add(side === 'left' ? 'show-left' : 'show-right');
    } else if (side === 'left') prefs.showLeft = true;
    else prefs.showRight = true;
    prefs.focus = false;
    setTab(side, tab);
    applyLayout();
  };

  function renderGenreTabs() {
    const g = genre();
    $('genreSelect').innerHTML = WP.genres.map((x) => `<option value="${x.id}" ${x.id === g.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  }

  /** Genre tabs open that genre's workspace: its latest draft, or an example on first visit. */
  function setGenre(id) {
    const d = doc();
    if (d.genre === id) return;
    const g = genreById(id);
    if (!d.text.trim()) {
      d.genre = g.id;
      d.framework = g.frameworks[0].id;
      d.updated = Date.now();
      persist(true);
      A.openDoc(d.id);
    } else {
      const existing = state.docs.filter((x) => x.genre === g.id).sort((a, b) => b.updated - a.updated)[0];
      A.openDoc((existing || sampleDoc(g.id)).id);
      persist(true);
    }
  }

  /** Re-checks the current draft against another genre's rules. */
  function checkAs(id) {
    const d = doc();
    const g = genreById(id);
    d.genre = g.id;
    if (!g.frameworks.some((f) => f.id === d.framework)) d.framework = g.frameworks[0].id;
    d.updated = Date.now();
    persist(true);
    state.spotlight = null;
    state.expanded.clear();
    state.openFramework = null;
    A.renderAll();
    toast(`This draft is now checked as ${g.name}.`);
  }

  function applyLayout() {
    const layout = $('layout');
    const narrow = window.matchMedia('(max-width: 960px)').matches;
    document.querySelector('.app').classList.toggle('focus', prefs.focus);
    $('focusBtn').setAttribute('aria-pressed', String(prefs.focus));
    if (narrow) {
      layout.classList.remove('no-left', 'no-right');
      const l = layout.classList.contains('show-left');
      const r = layout.classList.contains('show-right');
      $('scrim').hidden = !(l || r);
      $('toggleLeft').setAttribute('aria-expanded', String(l));
      $('toggleRight').setAttribute('aria-expanded', String(r));
    } else {
      layout.classList.remove('show-left', 'show-right');
      $('scrim').hidden = true;
      layout.classList.toggle('no-left', !prefs.showLeft);
      layout.classList.toggle('no-right', !prefs.showRight);
      $('toggleLeft').setAttribute('aria-expanded', String(prefs.showLeft && !prefs.focus));
      $('toggleRight').setAttribute('aria-expanded', String(prefs.showRight && !prefs.focus));
    }
    $('sheet').classList.toggle('wide', prefs.wide);
    renderRails();
  }

  const TAB_TITLES = { ideas: 'Ideas', practice: 'Practice', drafts: 'Drafts', checks: 'Checks', frameworks: 'Frameworks', coach: 'Coach', learn: 'Learn' };

  /** The icon rails mirror which panel is open and on which tab. */
  function renderRails() {
    const leftOpen = prefs.showLeft && !prefs.focus;
    const rightOpen = prefs.showRight && !prefs.focus;
    document.querySelectorAll('.rail-btn').forEach((b) => {
      const [side, tab] = b.dataset.rail.split(':');
      const on = side === 'left' ? leftOpen && prefs.leftTab === tab : rightOpen && prefs.rightTab === tab;
      b.setAttribute('aria-pressed', String(on));
    });
    $('leftTitle').textContent = TAB_TITLES[prefs.leftTab] || '';
    $('rightTitle').textContent = TAB_TITLES[prefs.rightTab] || '';
  }

  /** Rail buttons open their panel on that tab, or close it if it is already showing. */
  function railToggle(side, tab) {
    const key = side === 'left' ? 'showLeft' : 'showRight';
    const current = side === 'left' ? prefs.leftTab : prefs.rightTab;
    if (prefs[key] && !prefs.focus && current === tab) prefs[key] = false;
    else {
      prefs[key] = true;
      // On smaller laptops two open panels squeeze the page, so one at a time.
      if (window.innerWidth < 1280) prefs[side === 'left' ? 'showRight' : 'showLeft'] = false;
    }
    prefs.focus = false;
    setTab(side, tab);
    applyLayout();
  }

  function togglePanel(side) {
    const narrow = window.matchMedia('(max-width: 960px)').matches;
    if (prefs.focus) {
      prefs.focus = false;
      if (side === 'left') prefs.showLeft = true;
      else prefs.showRight = true;
    } else if (narrow) {
      const layout = $('layout');
      const cls = side === 'left' ? 'show-left' : 'show-right';
      const other = side === 'left' ? 'show-right' : 'show-left';
      layout.classList.remove(other);
      layout.classList.toggle(cls);
    } else if (side === 'left') prefs.showLeft = !prefs.showLeft;
    else prefs.showRight = !prefs.showRight;
    savePrefs();
    applyLayout();
  }

  function applyTheme() {
    if (prefs.theme) document.documentElement.setAttribute('data-theme', prefs.theme);
    else document.documentElement.removeAttribute('data-theme');
  }

  function toggleTheme() {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const current = prefs.theme || (systemDark ? 'dark' : 'light');
    prefs.theme = current === 'dark' ? 'light' : 'dark';
    savePrefs();
    applyTheme();
  }

  /* ---------- tabs ---------- */

  function setTab(side, tab) {
    if (side === 'left') prefs.leftTab = tab;
    else prefs.rightTab = tab;
    savePrefs();
    renderTabs();
  }

  function renderTabs() {
    if ($('leftTitle')) renderRails();
    document.querySelectorAll('#leftPanel .panel-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === prefs.leftTab)));
    document.querySelectorAll('#rightPanel .panel-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === prefs.rightTab)));
    $('pane-ideas').hidden = prefs.leftTab !== 'ideas';
    $('pane-drafts').hidden = prefs.leftTab !== 'drafts';
    $('pane-practice').hidden = prefs.leftTab !== 'practice';
    $('pane-coach').hidden = prefs.rightTab !== 'coach';
    $('pane-checks').hidden = prefs.rightTab !== 'checks';
    $('pane-frameworks').hidden = prefs.rightTab !== 'frameworks';
    $('pane-learn').hidden = prefs.rightTab !== 'learn';
    if (prefs.leftTab === 'drafts') A.renderDrafts();
    if (prefs.leftTab === 'practice') A.renderPractice();
    if (prefs.rightTab === 'coach') WP.coach.render();
    if (prefs.rightTab === 'frameworks') A.renderFrameworks();
    if (prefs.rightTab === 'learn') A.renderLearn();
  }

  const TOUR = [
    { title: 'Welcome to your writing playground', body: 'A place to practice writing with guidance. Pick a kind of writing, use a proven structure, and get feedback as you type. This tour takes 30 seconds.' },
    { target: '.genre-pick', title: '1. Pick what you’re writing', body: 'Comedy, video scripts, stories, essays, poetry, copy, speeches and screenplays. Each one has its own rules, frameworks, lessons and drafts.' },
    { target: '#leftPanel', side: 'left', title: '2. Never face a blank page', body: 'Ideas gives you prompts, a daily challenge and timed sprints. Practice has short drills that each teach one rule. Open them any time from the icons on the left edge.' },
    { target: '#sheet', title: '3. Write, and watch the highlights', body: 'Green means you’re following a rule, amber means take a look, red means it breaks a rule. Click a highlight to see why and fix it in one click. Listen reads your draft aloud.' },
    { target: '#rightPanel', side: 'right', title: '4. Your toolkit', body: 'Checks shows your score and every rule. Frameworks gives you outlines to fill in. Coach reviews your draft. Learn explains the basics. They live behind the icons on the right edge; the number on Checks is your live score.' },
    { title: 'Start small', body: 'The best first step is a five-minute win. Try one drill, or take today’s challenge.', final: true },
  ];

  function startTour() {
    if (state.tourStep < 0) state.tourPanels = { left: prefs.showLeft, right: prefs.showRight, leftTab: prefs.leftTab, rightTab: prefs.rightTab };
    state.tourStep = 0;
    renderTour();
  }

  function endTour() {
    state.tourStep = -1;
    document.querySelectorAll('.tour-target').forEach((el) => el.classList.remove('tour-target'));
    $('tour').hidden = true;
    prefs.toured = true;
    // Put the panels back the way they were, so the tour doesn't leave the screen busier than it found it.
    if (state.tourPanels) {
      prefs.showLeft = state.tourPanels.left;
      prefs.showRight = state.tourPanels.right;
      prefs.leftTab = state.tourPanels.leftTab;
      prefs.rightTab = state.tourPanels.rightTab;
      state.tourPanels = null;
      renderTabs();
      applyLayout();
    }
    savePrefs();
  }

  function renderTour() {
    document.querySelectorAll('.tour-target').forEach((el) => el.classList.remove('tour-target'));
    const step = TOUR[state.tourStep];
    if (!step) return endTour();
    const narrow = window.matchMedia('(max-width: 960px)').matches;
    if (step.side && !narrow) {
      if (step.side === 'left') {
        prefs.showLeft = true;
        prefs.leftTab = 'ideas';
      } else {
        prefs.showRight = true;
        prefs.rightTab = 'checks';
      }
      prefs.focus = false;
      renderTabs();
      applyLayout();
    }
    const target = step.target && document.querySelector(step.target);
    if (target && target.offsetParent !== null && !(narrow && step.side)) target.classList.add('tour-target');
    $('tour').innerHTML = `
      <p class="eyebrow">${state.tourStep + 1} of ${TOUR.length}</p>
      <h3>${esc(step.title)}</h3>
      <p>${esc(step.body)}</p>
      <div class="btn-row">
        ${step.final
          ? '<button class="btn btn-primary" type="button" data-tour="drill">Try a drill</button><button class="btn" type="button" data-tour="challenge">Today’s challenge</button><button class="btn btn-quiet" type="button" data-tour="end">Just write</button>'
          : `${state.tourStep > 0 ? '<button class="btn btn-quiet" type="button" data-tour="back">Back</button>' : '<button class="btn btn-quiet" type="button" data-tour="end">Skip</button>'}<button class="btn btn-primary" type="button" data-tour="next">${state.tourStep === 0 ? 'Show me' : 'Next'}</button>`}
      </div>`;
    $('tour').hidden = false;
    $('tour').querySelector('.btn-primary').focus();
  }

  /* ---------- sheet + status ---------- */

  function renderSheetMeta() {
    const fw = frameworkDef();
    const icon = '<svg class="tool-pill-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14M5 12h10M5 18.5h6"/></svg>';
    $('frameworkChip').innerHTML = fw ? `${icon}<span class="tool-pill-label">Framework</span> ${esc(fw.name)}` : `${icon}Choose a framework`;
    $('frameworkChip').title = fw ? `Framework: ${fw.name}. Open the Frameworks tab` : 'Open the Frameworks tab';
  }

  function renderStatusLight() {
    const words = T.count(doc().text, /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
    $('statWords').innerHTML = `<b>${words}</b> words`;
    renderGoal(words);
  }

  function renderStatus() {
    const ctx = state.ctx;
    const g = genre();
    const words = ctx.wordCount;
    $('statWords').innerHTML = `<b>${words}</b> words · ${ctx.sentences.length} sentences`;
    if (g.id === 'video' || g.id === 'comedy') {
      const secs = Math.round((words / 150) * 60);
      $('statTime').innerHTML = `<b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b> spoken`;
    } else {
      $('statTime').innerHTML = `<b>${Math.max(1, Math.round(words / 230))} min</b> read`;
    }
    if (words >= 30 && g.id !== 'poetry') {
      const grade = T.readability(ctx).grade;
      $('statGrade').innerHTML = `Reading grade <b>${grade.toFixed(1)}</b>`;
      $('statGrade').title = `A US school grade of ${Math.max(1, Math.round(grade))} could read this easily. Most popular writing aims for 6 to 9.`;
    } else {
      $('statGrade').textContent = '';
      $('statGrade').title = '';
    }
    renderGoal(words);
  }

  function renderGoal(words) {
    const goal = Number(prefs.goal) || 0;
    $('statGoal').hidden = !goal;
    if (!goal) return;
    const pct = Math.min(100, (words / goal) * 100);
    $('goalFill').style.width = pct + '%';
    $('goalText').innerHTML = words >= goal ? '<b>Goal reached</b>' : `<b>${words}</b> / ${goal}`;
  }

  function closeDrawers() {
    if (window.matchMedia('(max-width: 960px)').matches) {
      $('layout').classList.remove('show-left', 'show-right');
      applyLayout();
    }
  }

  Object.assign(A, {
    renderGenreTabs, setGenre, checkAs, applyLayout, TAB_TITLES, renderRails, railToggle,
    togglePanel, applyTheme, toggleTheme, setTab, renderTabs, TOUR, startTour, endTour, renderTour,
    renderSheetMeta, renderStatusLight, renderStatus, renderGoal, closeDrawers
  });
})(window.WP = window.WP || {});
