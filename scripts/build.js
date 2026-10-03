// Bundles the app into single self-contained HTML files.
//   dist/writing-playground.html  full page, open it anywhere (double-click works)
//   dist/artifact.html            page body only, for hosts that supply their own <html>/<head>
// Usage: node scripts/build.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const html = read('index.html');

const between = (start, end) => {
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  if (a < 0 || b < 0) throw new Error(`Missing marker ${start}`);
  return html.slice(a + start.length, b);
};

const markup = between('<!--APP-START-->', '<!--APP-END-->').trim();
const scripts = [...between('<!--SCRIPTS-START-->', '<!--SCRIPTS-END-->').matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
const css = read('css/app.css');
const fontLink = html.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com[^"]+)">/)[1];
const js = (artifact) =>
  (artifact ? 'window.WP = window.WP || {}; window.WP.ARTIFACT = true;\n' : '') +
  scripts.map((s) => `// ---- ${s}\n${read(s)}`).join('\n').replace(/<\/script/gi, '<\\/script');

const head = `<title>Writing Playground</title>
<link rel="stylesheet" href="${fontLink}">
<style>
${css}
</style>`;

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });

const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
</head>
<body>
${markup}
<script>
${js(false)}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'dist/writing-playground.html'), full);

const artifact = `${head}
${markup}
<script>
${js(true)}
</script>
`;
fs.writeFileSync(path.join(root, 'dist/artifact.html'), artifact);

console.log(`Built dist/writing-playground.html (${(full.length / 1024).toFixed(0)} KB) and dist/artifact.html`);
