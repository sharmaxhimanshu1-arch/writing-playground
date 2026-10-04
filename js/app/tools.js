/*
 * Page tools: Preview and print, Display settings, keyboard shortcuts and Listen.
 */
(function (WP) {
  'use strict';

  const A = WP.app;
  const { $, T, cleanText, doc, editor, esc, genre, openModal, prefs, state, toast } = A;

  function openPreview() {
    const d = doc();
    const blocks = cleanText(d.text).split(/\n\s*\n/);
    const html = blocks.map((b) => {
      const h = b.match(/^#{1,6}\s+(.*)$/);
      if (h && !b.includes('\n')) return `<h3>${esc(h[1])}</h3>`;
      const inner = esc(b).replace(/\[[^\]\n]*\]/g, (m) => `<span class="preview-cue">${m}</span>`).replace(/^#{1,6}\s+(.*)$/gm, '<b>$1</b>');
      return `<p>${inner}</p>`;
    }).join('');
    const words = T.parse(d.text).wordCount;
    const g = genre();
    const spoken = ['video', 'comedy', 'speech'].includes(g.id);
    openModal('Preview', `
      <article class="preview">
        <h2>${esc(d.title || 'Untitled draft')}</h2>
        <p class="small muted">${words} words · ${spoken ? `about ${Math.max(1, Math.round(words / 140))} min spoken` : `about ${Math.max(1, Math.round(words / 230))} min to read`} · notes hidden</p>
        ${html || '<p class="muted">Nothing to preview yet.</p>'}
      </article>
      <div class="btn-row"><button class="btn" type="button" data-act="copy-clean">Copy without notes</button>${WP.ARTIFACT || typeof window.print !== 'function' ? '' : '<button class="btn" type="button" data-act="print">Print or save as PDF</button>'}</div>`);
  }

  function printPreview() {
    document.body.classList.add('print-preview');
    const done = () => {
      document.body.classList.remove('print-preview');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
    // Some browsers don't fire afterprint when print is blocked.
    setTimeout(() => { if (!window.matchMedia('print').matches) done(); }, 1000);
  }

  /* ---------- display settings ---------- */

  const DISPLAY = {
    size: { s: ['Small', '1.0625rem'], m: ['Medium', '1.1875rem'], l: ['Large', '1.375rem'], xl: ['Extra large', '1.5625rem'] },
    spacing: { normal: ['Normal', '1.75'], relaxed: ['Relaxed', '2.05'] },
    font: {
      serif: ['Book serif', 'var(--font-editor)'],
      easy: ['Easy-read', 'var(--font-ui)'],
      mono: ['Typewriter', 'var(--font-mono)'],
    },
  };

  function applyDisplay() {
    const d = Object.assign({ size: 'm', spacing: 'normal', font: 'serif' }, prefs.display);
    const root = document.documentElement.style;
    if (d.size === 'm') root.removeProperty('--editor-size');
    else root.setProperty('--editor-size', DISPLAY.size[d.size][1]);
    root.setProperty('--editor-leading', DISPLAY.spacing[d.spacing][1]);
    root.setProperty('--font-page', DISPLAY.font[d.font][1]);
    editor.render();
  }

  function openDisplay() {
    const d = Object.assign({ size: 'm', spacing: 'normal', font: 'serif' }, prefs.display);
    const group = (key, label) => `<fieldset class="seg">
        <legend>${label}</legend>
        ${Object.entries(DISPLAY[key]).map(([v, [name]]) => `<label><input type="radio" name="disp-${key}" value="${v}" ${d[key] === v ? 'checked' : ''}><span>${name}</span></label>`).join('')}
      </fieldset>`;
    openModal('Display', `
      <form id="displayForm" class="display-form">
        ${group('size', 'Text size')}
        ${group('spacing', 'Line spacing')}
        ${group('font', 'Font')}
        <fieldset class="seg">
          <legend>Page width</legend>
          <label><input type="radio" name="disp-width" value="normal" ${prefs.wide ? '' : 'checked'}><span>Normal</span></label>
          <label><input type="radio" name="disp-width" value="wide" ${prefs.wide ? 'checked' : ''}><span>Wide</span></label>
        </fieldset>
        <p class="small muted">Easy-read uses Atkinson Hyperlegible, a typeface designed for readers with low vision. These settings only change how the page looks to you.</p>
      </form>`);
  }

  /* ---------- keyboard shortcuts ---------- */

  const MOD = /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl';

  function openShortcuts() {
    const rows = [
      [`${MOD} + S`, 'Save now (drafts also save automatically)'],
      [`${MOD} + Z`, 'Undo, including one-click fixes and rewrites'],
      [`${MOD} + .`, 'Next issue (turns on “One thing at a time”)'],
      ['Alt + ↓ / ↑', 'Guided writing: next or previous beat'],
      [`${MOD} + Shift + F`, 'Focus mode: hide both panels'],
      [`${MOD} + Shift + L`, 'Listen: read the draft or selection aloud'],
      [`${MOD} + /`, 'Show these shortcuts'],
      ['Tab', 'Insert a tab in the draft'],
      ['Esc', 'Close a popup, dismiss a fix card, or clear a spotlight'],
    ];
    openModal('Keyboard shortcuts', `<dl class="shortcuts">${rows.map(([k, v]) => `<div><dt><kbd>${esc(k)}</kbd></dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`);
  }

  /* ---------- read aloud ---------- */

  const canSpeak = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

  function stopSpeaking() {
    if (canSpeak && state.speaking) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function setSpeaking(on) {
    state.speaking = on;
    const b = $('listenBtn');
    b.querySelector('.tool-label').textContent = on ? 'Stop' : 'Listen';
    b.title = on ? 'Stop reading aloud' : 'Read aloud (Ctrl/⌘+Shift+L)';
    b.setAttribute('aria-pressed', String(on));
  }

  function toggleListen() {
    if (state.speaking) return stopSpeaking();
    const ta = $('editor');
    const raw = ta.selectionEnd > ta.selectionStart ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : ta.value;
    const spoken = T.parse(raw).masked.replace(/\n\s*\n/g, '. ').replace(/\s+/g, ' ').replace(/(\.\s*){2,}/g, '. ').trim();
    if (!/[\p{L}]/u.test(spoken)) return toast('Nothing to read yet. Notes, headings and [cues] are skipped.');
    const u = new SpeechSynthesisUtterance(spoken);
    u.rate = 0.98;
    u.onend = u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
    toast(ta.selectionEnd > ta.selectionStart ? 'Reading your selection aloud.' : 'Reading your draft aloud. Listen for where you stumble.');
  }

  Object.assign(A, {
    openPreview, printPreview, DISPLAY, applyDisplay, openDisplay, MOD, openShortcuts, canSpeak,
    stopSpeaking, setSpeaking, toggleListen
  });
})(window.WP = window.WP || {});
