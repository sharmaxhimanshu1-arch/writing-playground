/*
 * The installable app: on the copy served over https (GitHub Pages), a small worker keeps the files
 * so the playground opens without a connection, and Drafts offers to install it like an app.
 * The single-file builds and the claude.ai copy have no manifest, so none of this runs there.
 */
(function (WP) {
  'use strict';

  const A = WP.app;
  const { prefs, state, toast } = A;

  const hosted = () => !!document.querySelector('link[rel="manifest"]') && /^https?:$/.test(window.location.protocol) && !WP.ARTIFACT;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

  function setupInstall() {
    if (!hosted()) return;
    if ('serviceWorker' in navigator) {
      const hadWorker = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').then(() => {
        state.offlineReady = true;
      }, () => {});
      // A new version took over in the background: the next open uses it.
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadWorker) toast('Writing Playground was updated. Reload to get the newest version.');
      });
    }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.installPrompt = e;
      if (prefs.leftTab === 'drafts') A.renderDrafts();
    });
    window.addEventListener('appinstalled', () => {
      state.installPrompt = null;
      if (prefs.leftTab === 'drafts') A.renderDrafts();
      toast('Installed. Open Writing Playground from your home screen or app list; it works offline too.');
    });
  }

  function installApp() {
    const p = state.installPrompt;
    if (!p) return;
    state.installPrompt = null;
    p.prompt();
    if (p.userChoice) p.userChoice.then(() => prefs.leftTab === 'drafts' && A.renderDrafts(), () => {});
  }

  /** The "Use it as an app" part of Drafts, when this browser can install it. */
  function renderInstall() {
    if (!hosted() || standalone()) return '';
    if (state.installPrompt) {
      return `<section class="section">
          <p class="eyebrow">Use it as an app</p>
          <p class="small muted">Install Writing Playground to open it from your home screen or dock, in its own window, even offline. Your drafts stay on this device.</p>
          <div class="btn-row"><button class="btn" type="button" data-act="install">Install the app</button></div>
        </section>`;
    }
    if (ios()) {
      return `<section class="section">
          <p class="eyebrow">Use it as an app</p>
          <p class="small muted">In Safari, tap the Share button, then <b>Add to Home Screen</b>. It opens in its own window and works offline. Your drafts stay on this device.</p>
        </section>`;
    }
    return '';
  }

  Object.assign(A, { setupInstall, installApp, renderInstall });
})(window.WP = window.WP || {});
