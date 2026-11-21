const test = require('node:test');
const assert = require('node:assert/strict');
const MD = require('../public/md.js');
const P = require('../public/prompts.js');

test('prompt: names the style, includes the topic, asks for one code block and a title', () => {
  const t = P.buildPrompt({ style: 'exam', topic: '  Vitamin   D ' });
  assert.match(t, /exam revision note/);
  assert.match(t, /Topic: Vitamin D\n/);
  assert.match(t, /> \[!EXAM\]/);
  assert.match(t, /"# " followed by a short title/);
  assert.match(t, /ONE code block/);
  assert.ok(t.includes('````'), 'four-backtick fence is mentioned');
});

test('prompt: unknown style falls back, no topic line when blank', () => {
  const t = P.buildPrompt({ style: 'nope', topic: '   ' });
  assert.match(t, /study note/);
  assert.ok(!/Topic:/.test(t));
  assert.equal(Object.keys(P.STYLES).length, 3);
});

test('the formats the prompt teaches are really supported by the note renderer', () => {
  const html = MD.render('> [!KEY] Why\n> text\n\n==hot==\n\n- [ ] task\n\n| A | B |\n|---|---|\n| 1 | 2 |', {});
  assert.match(html, /class="callout[^"]* key"/);
  assert.match(html, /<mark>/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /<table/);
});

test('reply: unwraps a four-backtick block with chatter around it and splits the title', () => {
  const reply = 'Sure! Here is your note:\n\n````markdown\n# Vitamin D\n\n## Summary\nMade in skin.\n\n```chat\nA: hi\nB: yo\n```\n````\n\nLet me know if you want more.';
  const r = P.cleanReply(reply);
  assert.equal(r.title, 'Vitamin D');
  assert.ok(r.body.startsWith('## Summary'));
  assert.ok(r.body.includes('```chat'), 'inner block survives');
  assert.ok(!r.body.includes('````'));
  assert.ok(!/Let me know/.test(r.body));
});

test('reply: plain three-backtick wrapper and no wrapper', () => {
  assert.equal(P.cleanReply('```\n# T\n- a\n```').body, '- a\n');
  const r = P.cleanReply('# Plain title\n\n- x\n- y');
  assert.equal(r.title, 'Plain title');
  assert.equal(r.body, '- x\n- y\n');
});

test('reply: real code blocks are left alone, bullets from rendered chat are fixed, title falls back to a heading', () => {
  const code = '```js\nlet a = 1;\n```';
  assert.equal(P.cleanReply(code).body.trim(), code);
  const r = P.cleanReply('Intro line\n\n## The heart\n• one\n• two');
  assert.equal(r.title, 'The heart');
  assert.match(r.body, /- one\n- two/);
  assert.equal(P.cleanReply('   ').body, '');
  assert.equal(P.cleanReply(null).title, '');
});

test('reply: **bold** and ==marks== are stripped from the title only', () => {
  const r = P.cleanReply('# **Heart** ==failure==\n\n**keep** this');
  assert.equal(r.title, 'Heart failure');
  assert.match(r.body, /\*\*keep\*\*/);
});
