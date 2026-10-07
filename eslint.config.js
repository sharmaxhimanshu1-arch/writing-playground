// Catches the mistakes a split across files invites: undefined names and leftovers.
// The app code is plain browser scripts sharing the global WP namespace.
const browser = {
  window: 'readonly', document: 'readonly', navigator: 'readonly', localStorage: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly', getComputedStyle: 'readonly',
  FileReader: 'readonly', Blob: 'readonly', URL: 'readonly', MouseEvent: 'readonly', Node: 'readonly',
  AbortController: 'readonly', SpeechSynthesisUtterance: 'readonly', console: 'readonly', Intl: 'readonly',
};
const node = { require: 'readonly', module: 'writable', process: 'readonly', __dirname: 'readonly', console: 'readonly', setTimeout: 'readonly' };
const rules = { 'no-undef': 'error', 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }] };

module.exports = [
  { ignores: ['dist/**', 'node_modules/**', 'tests/e2e/output/**'] },
  { files: ['js/**/*.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: browser }, rules },
  {
    files: ['scripts/**/*.js', 'tests/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: node },
    rules,
  },
  // Browser tests send some functions into the page, where WP and the DOM exist.
  { files: ['tests/e2e/**/*.js'], languageOptions: { globals: { ...browser, WP: 'readonly' } } },
  // The offline worker runs in its own scope; the template's __FILES__ is filled in by the build.
  {
    files: ['sw.js', 'scripts/sw.template.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { self: 'readonly', caches: 'readonly', fetch: 'readonly', Response: 'readonly', URL: 'readonly', Promise: 'readonly', __FILES__: 'readonly' } },
    rules,
  },
];
