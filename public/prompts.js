// The "Study with AI" helper (UMD: works in the browser and in the Node tests).
//   buildPrompt(...)  -> the text the student copies and pastes into an AI chat
//   cleanReply(...)   -> takes what the AI answered and turns it into { title, body } for a note
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NBPrompts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STYLES = {
    summary: {
      label: 'Summary note',
      noun: 'study note',
      parts: [
        'A "## Summary" section of 3 to 5 sentences.',
        'A "## Key points" section: short bullets, with ==highlights== around the terms I must memorise.',
        'A table if we compared or classified things.',
        'One "> [!KEY]" box holding the single most important idea.',
      ],
    },
    exam: {
      label: 'Exam-ready',
      noun: 'exam revision note',
      parts: [
        'A "## Summary" of 2 to 3 sentences.',
        'A "## Key points" section: short bullets, with ==highlights== around the terms I must memorise.',
        'A table if we compared or classified things.',
        'A "> [!MISTAKE]" box with the common mistakes or things students mix up.',
        'A "> [!EXAM]" box with 3 to 5 likely exam questions, each with a one-line answer.',
        'A "## Quick recall" section with 5 "- [ ]" tick-box items to revise tomorrow.',
      ],
    },
    quick: {
      label: 'Quick recap',
      noun: 'quick recap',
      parts: [
        'Only 5 to 8 bullets, each one line.',
        'One "> [!KEY]" box with the single most important idea.',
      ],
    },
  };
  const DEFAULT_STYLE = 'summary';
  const FENCE = '`'.repeat(4); // four backticks, so a note that contains a ``` block is not cut short

  function buildPrompt(opts) {
    opts = opts || {};
    const st = STYLES[opts.style] || STYLES[DEFAULT_STYLE];
    const topic = String(opts.topic || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    const lines = [];
    lines.push('I am a medical student and I keep my study notes in a notebook app. Please turn our WHOLE conversation above, from my first message to this one, into one ' + st.noun + ' that I can paste straight into my notebook.');
    if (topic) lines.push('', 'Topic: ' + topic);
    lines.push('', 'Include:');
    st.parts.forEach((p) => lines.push('- ' + p));
    lines.push(
      '',
      'Rules:',
      '1. Use only what we actually discussed. If something was unclear, or you are not sure it is correct, put "(check this)" beside it.',
      '2. Keep the lines short and easy to revise. No greeting, no sign-off, no comments from you.',
      '3. Start with a title line: "# " followed by a short title.',
      '4. Put the WHOLE note inside ONE code block, using four backticks (' + FENCE + ') as the fence, so I can copy it in one tap.',
      '',
      'Formatting my notebook understands (use it where it helps):',
      '- "## " for section headings',
      '- "- " for bullets and "- [ ] " for tick boxes',
      '- ==important term== to highlight',
      '- tables written with | and a |---| line under the header',
      '- boxes: write "> [!KEY] Title" and put the text on the next line starting with "> ". Types: KEY, DEF, EX, TIP, WARN, EXAM, MISTAKE, NOTE',
      '- No HTML, no images, no LaTeX.'
    );
    return lines.join('\n');
  }

  const FENCE_OPEN = /^\s*(`{3,}|~{3,})\s*(markdown|md|text|plain|)\s*$/i;

  /** If the AI wrapped the whole note in a code block (as the prompt asks), take the inside. */
  function unwrap(text) {
    const lines = text.split('\n');
    const first = lines.findIndex((l) => l.trim() !== '');
    if (first < 0) return text;
    // allow a short line of chatter before the block ("Here is your note:")
    let open = -1;
    for (let i = first; i < Math.min(lines.length, first + 3); i++) if (FENCE_OPEN.test(lines[i])) { open = i; break; }
    if (open < 0) return text;
    const fence = lines[open].trim().match(/^(`{3,}|~{3,})/)[1];
    let close = -1;
    for (let i = lines.length - 1; i > open; i--) {
      const t = lines[i].trim();
      if (t && t[0] === fence[0] && /^(`+|~+)$/.test(t) && t.length >= fence.length) { close = i; break; }
    }
    if (close < 0) return text;
    // whatever follows the closing fence must be at most a short sign-off
    const after = lines.slice(close + 1).join('\n').trim();
    if (after.length > 200) return text;
    return lines.slice(open + 1, close).join('\n');
  }

  const stripMd = (s) => s.replace(/[*_`#>]+/g, '').replace(/==/g, '').replace(/\s+/g, ' ').trim();

  /**
   * cleanReply(text) -> { title, body }
   *   - removes the code-block wrapper
   *   - takes the first "# Title" line as the title (the app shows the title separately)
   *   - turns "•" bullets (copied from a rendered chat) into "-" bullets
   */
  function cleanReply(raw) {
    let text = String(raw == null ? '' : raw).replace(/\r\n?/g, '\n').replace(/ /g, ' ');
    text = unwrap(text).replace(/^\s*\n/, '').replace(/\s+$/, '');
    text = text.replace(/^(\s*)[•◦▪●]\s+/gm, '$1- ');
    let title = '';
    const lines = text.split('\n');
    const firstIdx = lines.findIndex((l) => l.trim() !== '');
    if (firstIdx >= 0 && /^#\s+\S/.test(lines[firstIdx])) {
      title = stripMd(lines[firstIdx].replace(/^#\s+/, ''));
      lines.splice(firstIdx, 1);
      text = lines.join('\n').replace(/^\s*\n+/, '');
    } else if (firstIdx >= 0) {
      const h = lines.find((l) => /^#{1,3}\s+\S/.test(l));
      if (h) title = stripMd(h.replace(/^#{1,3}\s+/, ''));
    }
    return { title: title.slice(0, 120), body: text.trim() ? text.trim() + '\n' : '' };
  }

  return { buildPrompt, cleanReply, STYLES, DEFAULT_STYLE };
});
