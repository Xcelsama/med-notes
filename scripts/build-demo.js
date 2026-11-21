'use strict';
// Builds ONE self-contained HTML file of the app (demo mode: notes stay in the browser).
// Usage: node scripts/build-demo.js <output.html> [--fragment]
//   --fragment  no <html>/<head>/<body> tags, for hosts that wrap the page in their own skeleton
const fs = require('node:fs');
const path = require('node:path');

const pub = path.join(__dirname, '..', 'public');
const read = (f) => fs.readFileSync(path.join(pub, f), 'utf8');
const safeScript = (s) => s.replace(/<\/script/gi, '<\\/script');
const out = process.argv[2];
const fragment = process.argv.includes('--fragment');
if (!out) { console.error('usage: node scripts/build-demo.js <output.html> [--fragment]'); process.exit(1); }

let html = read('index.html');
html = html
  .replace(/<link rel="manifest"[^>]*>\n?/, '')
  .replace(/<link rel="icon"[^>]*>\n?/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '')
  .replace('<link rel="stylesheet" href="style.css">', () => '<style>\n' + read('style.css') + '\n</style>')
  .replace('<script src="merge.js"></script>', () => (fragment ? '<script>window.__NB_DEMO = true;</script>\n' : '') + '<script>\n' + safeScript(read('merge.js')) + '\n</script>')
  .replace('<script src="md.js"></script>', () => '<script>\n' + safeScript(read('md.js')) + '\n</script>')
  .replace('<script src="prompts.js"></script>', () => '<script>\n' + safeScript(read('prompts.js')) + '\n</script>')
  .replace('<script src="app.js"></script>', () => '<script>\n' + safeScript(read('app.js')) + '\n</script>');

if (fragment) {
  html = html
    .replace(/<!doctype html>\s*/i, '')
    .replace(/<html[^>]*>\s*/i, '')
    .replace(/<\/html>\s*/i, '')
    .replace(/<head>\s*/i, '')
    .replace(/<\/head>\s*/i, '')
    .replace(/<body>\s*/i, '')
    .replace(/<\/body>\s*/i, '')
    .replace(/<meta charset[^>]*>\s*/i, '')
    .replace(/<meta name="viewport"[^>]*>\s*/i, '')
    .replace(/<meta name="theme-color"[^>]*>\s*/i, '');
}
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + ' KB', fragment ? '(fragment)' : '');
