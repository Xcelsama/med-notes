'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const MD = require('../public/md.js');

test('escapes HTML and blocks javascript: links', () => {
  const h = MD.render('<script>alert(1)</script> [x](javascript:alert(1)) ![y](javascript:evil)');
  assert.ok(!h.includes('<script>'));
  assert.ok(!/href="javascript/i.test(h));
  assert.ok(!/src="javascript/i.test(h));
});

test('inline formatting', () => {
  const h = MD.inline('**bold** *it* ==hi== ~~old~~ `a<b` snake_case_word 2 * 3 * 4');
  assert.match(h, /<strong>bold<\/strong>/);
  assert.match(h, /<em>it<\/em>/);
  assert.match(h, /<mark>hi<\/mark>/);
  assert.match(h, /<del>old<\/del>/);
  assert.match(h, /<code>a&lt;b<\/code>/);
  assert.ok(!h.includes('<em>case'), 'underscores inside words are not italics');
  assert.ok(!/2 <em>/.test(h), 'spaced asterisks are not italics');
});

test('headings, lists (nested), tasks, table, hr', () => {
  const md = '## Vitamins\n\n- Fat-soluble\n  - A\n  - D\n- Water-soluble\n\n1. one\n2. two\n\n- [ ] read\n- [x] done\n\n| Type | Example |\n|---|:-:|\n| Fat | A |\n| Water | C |\n\n---';
  const h = MD.render(md);
  assert.match(h, /<h2>Vitamins<\/h2>/);
  assert.match(h, /<ul><li>Fat-soluble<ul><li>A<\/li><li>D<\/li><\/ul><\/li><li>Water-soluble<\/li><\/ul>/);
  assert.match(h, /<ol><li>one<\/li><li>two<\/li><\/ol>/);
  assert.match(h, /data-task="0"/);
  assert.match(h, /data-task="1"[^>]*>|checked data-task="1"/);
  assert.match(h, /<th>Type<\/th><th style="text-align:center">Example<\/th>/);
  assert.match(h, /<td style="text-align:center">A<\/td>/);
  assert.match(h, /<hr>/);
});

test('toggleTask flips the right box and skips code fences', () => {
  const md = '```\n- [ ] not a task\n```\n- [ ] first\n- [x] second\n> - [ ] quoted';
  assert.equal(MD.toggleTask(md, 0), '```\n- [ ] not a task\n```\n- [x] first\n- [x] second\n> - [ ] quoted');
  assert.equal(MD.toggleTask(md, 1), '```\n- [ ] not a task\n```\n- [ ] first\n- [ ] second\n> - [ ] quoted');
  assert.equal(MD.toggleTask(md, 2), '```\n- [ ] not a task\n```\n- [ ] first\n- [x] second\n> - [x] quoted');
  // render numbering agrees with toggleTask numbering
  const h = MD.render(md);
  assert.deepEqual([...h.matchAll(/data-task="(\d+)"/g)].map((m) => m[1]), ['0', '1', '2']);
});

test('callouts and blockquotes', () => {
  const h = MD.render('> [!KEY] Remember\n> Vitamin D needs fat\n\n> plain quote');
  assert.match(h, /<aside class="callout snap key"><div class="callout-title">Remember<\/div><p>Vitamin D needs fat<\/p><\/aside>/);
  assert.match(h, /<blockquote class="snap"><p>plain quote<\/p><\/blockquote>/);
  assert.match(MD.render('> [!MISTAKE]\n> x'), /Common mistake/);
});

test('images: stored ids, captions, wikilinks', () => {
  const h = MD.render('![Liver lobule](img:abc123)\n\nsee [[Vitamins]] now', { imageUrl: (id) => '/api/image?id=' + id });
  assert.match(h, /<figure class="snap"><img data-img="abc123" src="\/api\/image\?id=abc123" alt="Liver lobule" loading="lazy"><figcaption>Liver lobule<\/figcaption><\/figure>/);
  assert.match(h, /class="wikilink" href="#" data-title="Vitamins"/);
  assert.ok(!MD.render('![x](img:../../bad)').includes('data-img'));
});

test('chat: two speakers, sides, colours', () => {
  const h = MD.render('```chat\nExcel: Why does vitamin D need fat?\nClaude: Because it is fat-soluble.\nIt travels with fats.\nExcel: Thanks!\n```');
  assert.equal((h.match(/class="turn /g) || []).length, 3);
  assert.match(h, /class="turn right" style="--pen:#2457c5"><div class="who">Excel<\/div><div class="bubble"><p>Why does vitamin D need fat\?<\/p>/);
  assert.match(h, /class="turn left" style="--pen:#c4552d"><div class="who">Claude<\/div>/);
  assert.match(h, /fat-soluble\.<br>It travels with fats\./, 'continuation lines stay in the same bubble');
});

test('chat: three speakers, bold labels, "said", @ and false labels', () => {
  const p = MD.parseChat('**Excel:** hello\n**Claude:** hi\n@Dr Ada: I only speak once\nExcel: ok\nClaude: Steps:\nNote: this is not a speaker\nStep 1: neither is this');
  assert.deepEqual(p.speakers, ['Excel', 'Claude', 'Dr Ada']);
  assert.equal(p.turns.length, 5);
  assert.match(p.turns[4].text, /Note: this is not a speaker/);
  assert.match(p.turns[4].text, /Step 1: neither is this/);
  assert.deepEqual(MD.parseChat('You said:\nhi\nChatGPT said:\nhello').speakers, ['You', 'ChatGPT']);
  assert.equal(MD.parseChat('Claude:\nanswer on next line').turns[0].text, 'answer on next line');
});

test('chat: nested code fence needs a longer outer fence; plain text is not a chat', () => {
  const h = MD.render('````chat\nExcel: show code\nClaude: here:\n```js\nlet a = 1;\n```\n````');
  assert.match(h, /<pre class="snap"><code class="lang-js">let a = 1;<\/code><\/pre>/);
  assert.match(MD.render('```chat\njust some text\n```'), /<pre/);
});

test('plain() strips markup for search', () => {
  assert.equal(MD.plain('## Hi\n\n- **bold** [link](http://x) ==mark==\n```\ncode\n```'), 'Hi bold link mark code');
  // text inside a saved conversation must be searchable
  assert.match(MD.plain('```chat\nExcel: What is a sesamoid bone?\nClaude: A bone in a tendon.\n```'), /sesamoid bone/);
});
