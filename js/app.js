/*
 * Wires the panels together: events, the coach bridge, and boot.
 * The panels themselves live in js/app/*.js and share state through WP.app.
 */
(function (WP) {
  'use strict';

  const A = WP.app;
  const {
    $, T, cleanText, closeModal, doc, editor, frameworkDef, genre, insertNote, persist, pick, prefs,
    sampleDoc, savePrefs, state, toast, wordCount
  } = A;

  /* ---------- ask the coach ---------- */

  function askCoachAbout(m) {
    const text = $('editor').value.slice(m.start, m.end).replace(/\s+/g, ' ').trim().slice(0, 300);
    const q = `In my draft, the "${m.checkTitle}" rule flags this: "${text}". The checker says: ${m.note} Explain in simple words why this is a problem in my ${genre().name.toLowerCase()} piece, and show me two better ways to write it.`;
    A.hideFixCard();
    if (window.matchMedia('(max-width: 960px)').matches) {
      $('layout').classList.remove('show-left');
      $('layout').classList.add('show-right');
    } else {
      prefs.showRight = true;
      prefs.focus = false;
    }
    A.setTab('right', 'coach');
    A.applyLayout();
    WP.coach.askAbout(q);
  }

  /* ---------- coach bridge ---------- */

  function findQuote(q) {
    const text = $('editor').value;
    if (!q) return null;
    const i = text.indexOf(q);
    if (i >= 0) return { start: i, end: i + q.length };
    const words = q.trim().split(/\s+/).map((w) => T.escapeRe(w.replace(/[“”"]/g, '')));
    if (!words.length) return null;
    const m = new RegExp(words.join('[\\s“”"]+'), 'i').exec(text);
    return m ? { start: m.index, end: m.index + m[0].length } : null;
  }

  const api = {
    doc: () => doc(),
    genre: () => genre(),
    frameworkDef: () => frameworkDef(),
    results: () => state.results,
    wordCount: () => wordCount(),
    currentPrompt: () => state.prompt || '',
    persist: () => persist(true),
    toast: (m) => toast(m),
    insertNote: (t) => insertNote(t),
    selection() {
      const ta = $('editor');
      return { start: ta.selectionStart, end: ta.selectionEnd, text: ta.value.slice(ta.selectionStart, ta.selectionEnd) };
    },
    replaceRange(sel, text) {
      const ta = $('editor');
      if (ta.value.slice(sel.start, sel.end) !== sel.text) {
        toast('That passage changed since you asked. Select it again and retry.');
        return false;
      }
      A.closeDrawers();
      ta.focus();
      ta.setSelectionRange(sel.start, sel.end);
      editor.insert(text);
      toast('Replaced. Press Ctrl+Z (⌘Z) to undo.');
      return true;
    },
    locate(q) {
      const r = findQuote(q);
      if (!r) return toast('Couldn’t find that passage. It may have changed.');
      A.closeDrawers();
      editor.reveal(r.start, r.end);
    },
    replaceQuote(q, rewrite) {
      const r = findQuote(q);
      if (!r) {
        toast('Couldn’t find that passage. It may have changed.');
        return false;
      }
      return api.replaceRange({ start: r.start, end: r.end, text: $('editor').value.slice(r.start, r.end) }, rewrite);
    },
  };

  function renderAll() {
    A.renderStarter();
    A.renderGenreTabs();
    A.renderSheetMeta();
    A.renderTabs();
    A.renderIdeas();
    A.analyze();
    A.applyFilters();
    if (prefs.leftTab === 'drafts') A.renderDrafts();
  }

  /* ---------- events ---------- */

  function bind() {
    document.querySelectorAll('.rail').forEach((rail) => rail.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rail]');
      if (!b) return;
      const [side, tab] = b.dataset.rail.split(':');
      A.railToggle(side, tab);
    }));
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.close === 'left') prefs.showLeft = false;
      else prefs.showRight = false;
      savePrefs();
      A.applyLayout();
      const rail = $('rail-' + (b.dataset.close === 'left' ? prefs.leftTab : prefs.rightTab));
      if (rail) rail.focus();
    }));
    $('toggleLeft').addEventListener('click', () => A.togglePanel('left'));
    $('toggleRight').addEventListener('click', () => A.togglePanel('right'));
    $('focusBtn').addEventListener('click', () => {
      prefs.focus = !prefs.focus;
      savePrefs();
      A.applyLayout();
    });
    $('themeBtn').addEventListener('click', A.toggleTheme);
    const openRight = (tab) => {
      if (window.matchMedia('(max-width: 960px)').matches) $('layout').classList.add('show-right');
      else prefs.showRight = true;
      prefs.focus = false;
      A.setTab('right', tab);
      A.applyLayout();
    };
    $('frameworkChip').addEventListener('click', () => openRight('frameworks'));
    $('syntaxHelp').addEventListener('click', () => {
      openRight('learn');
      const sec = $('learnSyntax');
      if (sec) {
        sec.scrollIntoView({ block: 'start' });
        sec.classList.remove('flash');
        void sec.offsetWidth;
        sec.classList.add('flash');
      }
    });
    $('scrim').addEventListener('click', () => {
      $('layout').classList.remove('show-left', 'show-right');
      A.applyLayout();
    });
    window.addEventListener('resize', () => {
      A.applyLayout();
      editor.render();
    });

    document.querySelectorAll('.panel-tabs').forEach((tabs) => tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      A.setTab(tabs.closest('.panel').id === 'leftPanel' ? 'left' : 'right', b.dataset.tab);
    }));

    $('listenBtn').hidden = !A.canSpeak;
    $('listenBtn').addEventListener('click', A.toggleListen);
    $('editor').addEventListener('click', A.showFixCard);
    $('editor').addEventListener('keyup', (e) => {
      if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') A.hideFixCard();
    });
    $('fixCard').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-card-close')) return A.hideFixCard();
      if (b.hasAttribute('data-card-ignore') && state.fixMark) return A.ignoreMark(state.fixMark);
      if (b.hasAttribute('data-card-next')) return A.nextIssueCard();
      if (b.hasAttribute('data-card-coach') && state.fixMark) return askCoachAbout(state.fixMark);
      if (b.dataset.cardFix && state.fixMark) A.applyFix(state.fixMark, state.fixMark.fixes[Number(b.dataset.cardFix)]);
    });
    document.addEventListener('mousedown', (e) => {
      if (!e.target.closest('#fixCard') && e.target.id !== 'editor') A.hideFixCard();
    });
    $('desk').addEventListener('scroll', A.placeFixCard, { passive: true });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => A.placeFixCard());
    // On phones the fix card is a bottom sheet: swipe it down to dismiss.
    let swipe = null;
    $('fixCard').addEventListener('touchstart', (e) => {
      if ($('fixCard').classList.contains('sheet-mode') && e.touches.length === 1) swipe = { y: e.touches[0].clientY, dy: 0 };
    }, { passive: true });
    $('fixCard').addEventListener('touchmove', (e) => {
      if (!swipe) return;
      swipe.dy = Math.max(0, e.touches[0].clientY - swipe.y);
      $('fixCard').style.transform = swipe.dy ? `translateY(${swipe.dy}px)` : '';
    }, { passive: true });
    $('fixCard').addEventListener('touchend', () => {
      if (!swipe) return;
      $('fixCard').style.transform = '';
      if (swipe.dy > 60) A.hideFixCard();
      swipe = null;
    });

    $('displayBtn').addEventListener('click', A.openDisplay);
    $('modalBody').addEventListener('change', (e) => {
      const m = e.target.name && e.target.name.match(/^disp-(\w+)$/);
      if (!m) return;
      if (m[1] === 'width') {
        prefs.wide = e.target.value === 'wide';
        savePrefs();
        A.applyLayout();
        editor.render();
        return;
      }
      prefs.display = Object.assign({ size: 'm', spacing: 'normal', font: 'serif' }, prefs.display, { [m[1]]: e.target.value });
      savePrefs();
      A.applyDisplay();
    });
    $('modalBody').addEventListener('click', (e) => {
      const an = e.target.closest('[data-anno]');
      if (an) return A.focusNote(Number(an.dataset.anno));
      const rt = e.target.closest('[data-read-try]');
      if (rt) return A.tryReading(rt.dataset.readTry);
      const ro = e.target.closest('[data-read-open]');
      if (ro) return A.openReadingDraft(ro.dataset.readOpen);
      const hd = e.target.closest('[data-habit-drill]');
      if (hd) {
        const [gid, did] = hd.dataset.habitDrill.split(':');
        closeModal();
        if (window.matchMedia('(max-width: 960px)').matches) $('layout').classList.remove('show-left', 'show-right');
        A.setTab('left', 'practice');
        A.startDrill(did, gid);
        return;
      }
      if (e.target.closest('[data-act="print"]')) return A.printPreview();
      if (e.target.closest('[data-act="copy-clean"]')) {
        const text = cleanText(doc().text);
        try {
          navigator.clipboard.writeText(text).then(() => toast('Copied without notes.'), () => toast('Copy was blocked. Select the preview text and copy it.'));
        } catch (err) {
          toast('Copy was blocked. Select the preview text and copy it.');
        }
        return;
      }
      const sg = e.target.closest('[data-study-guide]');
      if (sg) {
        closeModal();
        A.startGuide(sg.dataset.studyGuide);
        return;
      }
      const b = e.target.closest('[data-study-insert]');
      if (!b) return;
      closeModal();
      A.closeDrawers();
      A.insertOutline(b.dataset.studyInsert);
    });
    $('pane-drafts').addEventListener('change', (e) => {
      if (e.target.id === 'importFile') A.importFile(e.target.files && e.target.files[0]);
      if (e.target.id === 'restoreFile') A.restoreBackup(e.target.files && e.target.files[0]);
      if (e.target.id === 'checkAsSelect') A.checkAs(e.target.value);
    });
    $('pane-drafts').addEventListener('input', (e) => {
      if (e.target.id !== 'draftSearch') return;
      state.draftQuery = e.target.value;
      const pos = e.target.selectionStart;
      A.renderDrafts();
      const box = $('draftSearch');
      if (box) {
        box.focus();
        box.setSelectionRange(pos, pos);
      }
    });
    $('pane-checks').addEventListener('toggle', (e) => {
      if (e.target.id === 'rhythmBox') {
        prefs.rhythmOpen = e.target.open;
        savePrefs();
      }
    }, true);
    $('modalClose').addEventListener('click', closeModal);
    $('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') closeModal();
    });
    // Keep Tab inside the dialog while it is open.
    $('modal').addEventListener('keydown', (e) => {
      const an = e.target.closest && e.target.closest('mark.anno');
      if (an && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        A.focusNote(Number(an.dataset.anno));
        return;
      }
      if (e.key !== 'Tab') return;
      const f = [...$('modal').querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
    $('tour').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tour]');
      if (!b) return;
      const a = b.dataset.tour;
      if (a === 'next') {
        state.tourStep++;
        A.renderTour();
      } else if (a === 'back') {
        state.tourStep--;
        A.renderTour();
      } else if (a === 'end') A.endTour();
      else if (a === 'drill') {
        A.endTour();
        const first = A.drillsFor(genre())[0];
        if (window.matchMedia('(max-width: 960px)').matches) $('layout').classList.add('show-left');
        A.setTab('left', 'practice');
        A.applyLayout();
        if (first) A.startDrill(first.id);
      } else if (a === 'challenge') {
        A.endTour();
        A.startChallenge();
      }
    });
    $('pane-learn').addEventListener('click', (e) => {
      const rd = e.target.closest('[data-read]');
      if (rd) return A.openReading(rd.dataset.read);
      if (e.target.closest('[data-act="shortcuts"]')) return A.openShortcuts();
      if (e.target.closest('[data-act="tour"]')) {
        A.closeDrawers();
        A.startTour();
      }
    });
    const chartTip = (pane) => {
      pane.addEventListener('mousemove', (e) => {
        const hit = e.target.closest && e.target.closest('.bar-hit');
        const tip = $('tooltip');
        if (!hit) {
          if (tip.dataset.src === 'chart') tip.hidden = true;
          return;
        }
        tip.textContent = hit.dataset.tip;
        tip.dataset.src = 'chart';
        tip.hidden = false;
        const r = hit.getBoundingClientRect();
        tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 12, Math.max(12, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
        tip.style.top = Math.max(12, r.top - tip.offsetHeight - 8) + 'px';
      });
      pane.addEventListener('mouseleave', () => {
        if ($('tooltip').dataset.src === 'chart') $('tooltip').hidden = true;
      });
    };
    chartTip($('pane-drafts'));
    chartTip($('pane-checks'));

    $('pane-checks').addEventListener('change', (e) => {
      if (e.target.id !== 'oneThingToggle') return;
      prefs.oneThing = e.target.checked;
      savePrefs();
      if (!prefs.oneThing) {
        state.spotlight = null;
        state.expanded.clear();
      } else A.pickOneThing(state.results);
      A.applyFilters();
      A.renderChecks();
    });
    $('genreSelect').addEventListener('change', (e) => A.setGenre(e.target.value));
    $('pane-frameworks').addEventListener('input', (e) => {
      const key = e.target.dataset && e.target.dataset.plan;
      if (!key) return;
      const d = doc();
      d.plan = Object.assign({}, d.plan, { [key]: e.target.value });
      d.updated = Date.now();
      persist();
      const qs = A.planFor(genre());
      const n = qs.filter((q) => (d.plan[q.id] || '').trim()).length;
      const sum = document.querySelector('#planBox summary .small');
      if (sum) sum.textContent = `${n} of ${qs.length} answered`;
    });
    $('previewBtn').addEventListener('click', A.openPreview);
    $('starter').addEventListener('click', (e) => {
      const b = e.target.closest('[data-start]');
      if (b) A.runStarter(b.dataset.start);
      else $('editor').focus();
    });
    $('pane-checks').addEventListener('toggle', (e) => {
      if (e.target.dataset && e.target.dataset.fold === 'passing') {
        prefs.showPassing = e.target.open;
        savePrefs();
      }
    }, true);

    $('pane-practice').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.drill) A.startDrill(b.dataset.drill);
      else if (b.dataset.game) A.startGame(b.dataset.game);
      else if (b.dataset.path) A.runPathStep(Number(b.dataset.path));
      else if (b.dataset.act === 'toggle-model') {
        state.showModel = !state.showModel;
        A.renderPractice();
      } else if (b.dataset.act === 'drill-done') {
        const d = doc();
        if (d.drill && !prefs.drillsDone.includes(d.drill.id)) prefs.drillsDone.push(d.drill.id);
        savePrefs();
        A.renderPractice();
        toast('Drill marked as done.');
      }
    });

    $('pane-ideas').addEventListener('mousemove', (e) => {
      const hit = e.target.closest && e.target.closest('.bar-hit');
      const tip = $('tooltip');
      if (!hit) {
        if (tip.dataset.src === 'chart') tip.hidden = true;
        return;
      }
      tip.textContent = hit.dataset.tip;
      tip.dataset.src = 'chart';
      tip.hidden = false;
      const r = hit.getBoundingClientRect();
      tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 12, Math.max(12, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
      tip.style.top = Math.max(12, r.top - tip.offsetHeight - 8) + 'px';
    });
    $('pane-ideas').addEventListener('mouseleave', () => {
      if ($('tooltip').dataset.src === 'chart') $('tooltip').hidden = true;
    });
    $('docTitle').addEventListener('input', (e) => {
      const d = doc();
      d.title = e.target.value;
      d.updated = Date.now();
      persist();
    });

    $('pane-ideas').addEventListener('click', (e) => {
      const slot = e.target.closest('[data-slot]');
      const g = genre();
      if (slot) {
        const k = slot.dataset.slot;
        const options = g.generator.parts[k].filter((x) => x !== state.idea[k]);
        state.idea[k] = pick(options.length ? options : g.generator.parts[k]);
        A.renderIdeas();
        return;
      }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'next-prompt') {
        const options = g.prompts.filter((p) => p !== state.prompt);
        state.prompt = pick(options);
      } else if (act === 'use-prompt') A.useStarter('Prompt: ' + state.prompt);
      else if (act === 'idea-mode') {
        prefs.ideaMode = b.dataset.mode;
        savePrefs();
      } else if (act === 'shuffle-idea') state.idea = A.buildIdea(g);
      else if (act === 'use-idea') A.useStarter('Idea: ' + A.ideaText(g, state.idea, false));
      else if (act === 'nudge') {
        const options = g.nudges.filter((n) => n !== state.nudge);
        state.nudge = pick(options);
      } else if (act === 'use-nudge') {
        insertNote(state.nudge);
        toast('Question added as a note. Answer it on the next line.');
      } else if (act === 'challenge') return A.startChallenge();
      else if (act === 'habits') return A.openHabits();
      else if (act === 'sprint') return A.startSprint(Number(b.dataset.min));
      else if (act === 'stop-sprint') return A.stopSprint(false);
      A.renderIdeas();
    });
    $('pane-ideas').addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-slot]')) {
        e.preventDefault();
        const k = e.target.dataset.slot;
        e.target.click();
        const again = document.querySelector(`#pane-ideas [data-slot="${k}"]`);
        if (again) again.focus();
      }
    });
    $('pane-ideas').addEventListener('input', (e) => {
      if (e.target.id === 'goalInput') {
        prefs.goal = Math.max(0, Number(e.target.value) || 0);
        savePrefs();
        A.renderGoal(wordCount());
      }
    });

    $('pane-drafts').addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.open) A.openDoc(t.dataset.open);
      else if (t.dataset.askDelete) {
        state.confirmDelete = t.dataset.askDelete;
        A.renderDrafts();
      } else if (t.hasAttribute('data-cancel-delete')) {
        state.confirmDelete = null;
        A.renderDrafts();
      } else if (t.dataset.delete) A.deleteDoc(t.dataset.delete);
      else if (t.dataset.act === 'new-draft') {
        A.startFreshDraft();
        $('docTitle').focus();
      } else if (t.dataset.act === 'copy') A.copyText();
      else if (t.dataset.act === 'download') A.downloadText(t.dataset.ext || 'txt');
      else if (t.dataset.act === 'backup') A.downloadBackup();
      else if (t.dataset.act === 'sync-on') {
        A.startSync();
        toast('Sync is on. Your drafts will follow you to any device where you open this page.');
      } else if (t.dataset.act === 'sync-off') A.stopSync();
      else if (t.dataset.act === 'install') A.installApp();
      else if (t.dataset.act === 'improved') A.openImproved();
      else if (t.dataset.act === 'duplicate') A.duplicateDoc();
      else if (t.dataset.act === 'save-version') {
        if (A.pushVersion(doc(), 'Saved by you')) toast('Version saved.');
        else toast('This version is already saved. Keep writing and save again.');
        A.renderDrafts();
      } else if (t.dataset.compare) A.compareVersion(Number(t.dataset.compare));
      else if (t.dataset.restore) A.restoreVersion(Number(t.dataset.restore));
    });

    $('pane-checks').addEventListener('click', (e) => {
      const f = e.target.closest('[data-level]');
      if (f) {
        prefs.levels[f.dataset.level] = !prefs.levels[f.dataset.level];
        savePrefs();
        A.applyFilters();
        A.renderChecks();
        return;
      }
      const mute = e.target.closest('[data-mute]');
      if (mute) {
        A.setMuted(mute.dataset.mute, true);
        toast('Check turned off for this genre. Turn it back on at the bottom of the list.');
        return;
      }
      const unmute = e.target.closest('[data-unmute]');
      if (unmute) return A.setMuted(unmute.dataset.unmute, false);
      if (e.target.closest('[data-act="next-thing"]')) return A.nextOneThing();
      const sent = e.target.closest('[data-sent]');
      if (sent && state.ctx) {
        const x = state.ctx.sentences[Number(sent.dataset.sent)];
        if (x) {
          A.closeDrawers();
          editor.reveal(x.start, x.end);
        }
        return;
      }
      const fixBtn = e.target.closest('[data-fix]');
      if (fixBtn) {
        const [mi, fi] = fixBtn.dataset.fix.split(':').map(Number);
        const m = state.allMarks[mi];
        if (m && m.fixes) A.applyFix(m, m.fixes[fi]);
        return;
      }
      const fixAll = e.target.closest('[data-fix-all]');
      if (fixAll) {
        const r = state.results.find((x) => x.id === fixAll.dataset.fixAll);
        if (r) A.applyAll(r.marks.filter((m) => m.fixes && m.fixes.length));
        return;
      }
      const ig = e.target.closest('[data-ignore]');
      if (ig) {
        const m = state.allMarks[Number(ig.dataset.ignore)];
        if (m) A.ignoreMark(m);
        return;
      }
      const ug = e.target.closest('[data-unignore]');
      if (ug) return A.unignore(Number(ug.dataset.unignore));
      const hit = e.target.closest('[data-hit]');
      if (hit) {
        const [s, en] = hit.dataset.hit.split(':').map(Number);
        if (window.matchMedia('(max-width: 960px)').matches) {
          $('layout').classList.remove('show-right');
          A.applyLayout();
        }
        editor.reveal(s, en);
        return;
      }
      const head = e.target.closest('[data-check]');
      if (head) {
        const id = head.dataset.check;
        if (state.expanded.has(id)) {
          state.expanded.delete(id);
          if (state.spotlight === id) state.spotlight = null;
        } else {
          state.expanded.add(id);
          const r = state.results.find((x) => x.id === id);
          state.spotlight = r && r.marks.length ? id : state.spotlight;
        }
        A.applyFilters();
        A.renderChecks();
        return;
      }
      const b = e.target.closest('[data-act="clear-spot"]');
      if (b) {
        state.spotlight = null;
        A.applyFilters();
        A.renderChecks();
      }
    });

    $('pane-frameworks').addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.beatJump) {
        const [a, b] = t.dataset.beatJump.split(':').map(Number);
        A.closeDrawers();
        editor.reveal(a, b);
      } else if (t.dataset.fw) {
        state.openFramework = state.openFramework === t.dataset.fw ? '' : t.dataset.fw;
        A.renderFrameworks();
      } else if (t.dataset.fwUse) {
        A.useFramework(t.dataset.fwUse);
        toast('Framework set. Insert its outline to track each beat.');
      } else if (t.dataset.fwGuide) A.startGuide(t.dataset.fwGuide);
      else if (t.dataset.fwInsert) A.insertOutline(t.dataset.fwInsert);
      else if (t.dataset.fwStudy) A.openStudy(t.dataset.fwStudy);
      else if (t.dataset.jump) {
        const [a, b] = t.dataset.jump.split(':').map(Number);
        A.closeDrawers();
        editor.reveal(a, b);
      }
      else if (t.dataset.fwExample) A.openExample(t.dataset.fwExample);
    });

    $('guide').addEventListener('click', (e) => {
      const dot = e.target.closest('[data-guide-beat]');
      if (dot) return A.guideAction('beat', Number(dot.dataset.guideBeat));
      const b = e.target.closest('[data-guide]');
      if (b) A.guideAction(b.dataset.guide);
    });
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.altKey && !mod && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && A.guideOn()) {
        e.preventDefault();
        A.guideAction(e.key === 'ArrowDown' ? 'next' : 'back');
      } else if (mod && !e.shiftKey && k === 's') {
        e.preventDefault();
        persist(true);
        toast('Saved in this browser.');
      } else if (mod && k === '/') {
        e.preventDefault();
        A.openShortcuts();
      } else if (mod && k === '.') {
        e.preventDefault();
        if (!prefs.oneThing) {
          prefs.oneThing = true;
          savePrefs();
          A.pickOneThing(state.results);
          A.applyFilters();
          A.renderChecks();
        } else A.nextOneThing();
      } else if (mod && e.shiftKey && k === 'f') {
        e.preventDefault();
        prefs.focus = !prefs.focus;
        savePrefs();
        A.applyLayout();
      } else if (mod && e.shiftKey && k === 'l' && A.canSpeak) {
        e.preventDefault();
        A.toggleListen();
      } else if (e.key === 'Escape' && !$('modal').hidden) {
        closeModal();
      } else if (e.key === 'Escape' && state.tourStep >= 0) {
        A.endTour();
      } else if (e.key === 'Escape' && state.fixMark) {
        A.hideFixCard();
      } else if (e.key === 'Escape' && state.spotlight) {
        state.spotlight = null;
        A.applyFilters();
        A.renderChecks();
      }
    });
  }

  /* ---------- boot ---------- */

  function boot() {
    state.docs = (Array.isArray(state.docs) ? state.docs : []).filter((d) => d && typeof d.text === 'string');
    state.docs.forEach((d) => {
      if (!WP.genres.some((g) => g.id === d.genre)) d.genre = WP.genres[0].id;
    });
    if (!state.docs.length) sampleDoc('comedy');
    A.applyTheme();
    bind();
    A.applyDisplay();
    WP.coach.init(api);
    if (window.claude && typeof window.claude.use === 'function') {
      window.claude.use('downloads').then((d) => {
        state.downloads = d;
        if (prefs.leftTab === 'drafts') A.renderDrafts();
      }, () => {});
      // Sync needs the private per-person store and to know who is signed in.
      Promise.all([window.claude.use('db'), window.claude.use('user')]).then(async ([db, user]) => {
        const id = db && user ? await user.id() : null;
        if (id) A.syncAvailable(db, id);
      }, () => {});
    }
    A.setupInstall();
    const first = state.docs.find((d) => d.id === prefs.lastDoc) || state.docs[0];
    A.openDoc(first.id);
    A.applyLayout();
    persist(true);
    if (!prefs.toured) setTimeout(A.startTour, 500);
  }

  Object.assign(A, { askCoachAbout, findQuote, api, renderAll });

  boot();
})(window.WP = window.WP || {});
