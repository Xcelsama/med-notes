// Notebook markdown renderer (UMD: browser + node tests). No dependencies, escapes all HTML.
//
// Beyond normal markdown it understands:
//   ==highlight==            a highlighter pen
//   > [!KEY] Title           callout boxes: KEY, DEF, EX, TIP, WARN, EXAM, MISTAKE, NOTE
//   - [ ] task               tickable checkboxes
//   [[Other note]]           link to another note by title
//   ![caption](img:ID)       a stored image (the text in [] becomes the caption)
//   ```chat ... ```          a conversation: lines like "Excel: hi" and "Claude: hello" become speech bubbles
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NBMD = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const SAFE_URL = /^(https?:\/\/|mailto:|img:|#|\/(?!\/))/i;
  const TASK_RE = /^(\s*(?:>\s?)*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\](\s|$)/;
  const OPEN_FENCE = /^\s*(`{3,}|~{3,})\s*([\w-]*)\s*$/;

  // ---------------------------------------------------------------- inline
  function fmt(t, stash, ctx) {
    const hold = (html) => { stash.push(html); return '\u0001' + (stash.length - 1) + '\u0001'; };

    t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => {
      if (!SAFE_URL.test(url)) return m;
      if (/^img:/i.test(url)) {
        const id = url.slice(4);
        if (!/^[A-Za-z0-9_-]+$/.test(id)) return m;
        const src = ctx.imageUrl ? (ctx.imageUrl(id) || '') : '';
        return hold('<img data-img="' + id + '" src="' + src + '" alt="' + alt + '" loading="lazy">');
      }
      return hold('<img src="' + url + '" alt="' + alt + '" loading="lazy" referrerpolicy="no-referrer">');
    });
    t = t.replace(/\[\[([^\]\n]+)\]\]/g, (m, title) =>
      hold('<a class="wikilink" href="#" data-title="' + title + '">' + title + '</a>'));
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
      if (!SAFE_URL.test(url) || /^img:/i.test(url)) return m;
      const inner = fmt(text, stash, ctx);
      return hold('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>');
    });
    t = t.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>');
    t = t.replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*(?!\*)/g, '$1<em>$2</em>');
    t = t.replace(/(^|[^\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, '$1<em>$2</em>');
    t = t.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
    t = t.replace(/==(?=\S)([\s\S]*?\S)==/g, '<mark>$1</mark>');
    return t;
  }

  function inline(src, ctx) {
    ctx = ctx || {};
    const stash = [];
    let t = String(src).replace(/`([^`\n]+)`/g, (m, code) => {
      stash.push('<code>' + esc(code) + '</code>');
      return '\u0001' + (stash.length - 1) + '\u0001';
    });
    t = fmt(esc(t), stash, ctx);
    let guard = 0;
    while (/\u0001\d+\u0001/.test(t) && guard++ < 5) t = t.replace(/\u0001(\d+)\u0001/g, (m, i) => stash[+i]);
    return t;
  }

  // ---------------------------------------------------------------- chat
  const RIGHT = /^(excel|me|you|user|human|student|i)$/i;
  const KNOWN = /^(excel|me|you|user|human|student|claude|chatgpt|gpt|gemini|ai|assistant|bot|teacher|tutor|lecturer|friend|copilot|deepseek|grok|perplexity)$/i;
  const FIXED = { excel: '#2457c5', me: '#2457c5', you: '#2457c5', user: '#2457c5', human: '#2457c5',
    claude: '#c4552d', assistant: '#c4552d', ai: '#c4552d', chatgpt: '#0f8a6c', gpt: '#0f8a6c', gemini: '#6b4fc9' };
  const PALETTE = ['#2e7d57', '#8e3fa0', '#a8700a', '#b8324a', '#13807f', '#5b6b2a'];
  const LABEL = /^\s*(@)?(?:\*\*|__)?([A-Za-zÀ-ɏ][A-Za-z0-9À-ɏ .'’-]{0,29}?)(?:\*\*|__)?:(?:\*\*|__)?(?:\s+(.*)|$)/;

  function speakerColor(name, me) {
    const k = String(name).toLowerCase();
    if (me && k === String(me).toLowerCase()) return FIXED.me; // the signed-in person is shown like "Me": blue, on the right
    if (FIXED[k]) return FIXED[k];
    let h = 0;
    for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }

  const cleanLabel = (s) => s.trim().replace(/\s+said$/i, '');

  /** Split chat text into turns. A line "Name: text" starts a turn. */
  function parseChat(text) {
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    const cands = lines.map((l) => {
      const m = l.match(LABEL);
      return m ? { forced: !!m[1], who: cleanLabel(m[2]), rest: m[3] || '' } : null;
    });
    // A label only counts as a speaker if it is a known name, written with @, used at least twice,
    // or opens the conversation. That stops "Note: ..." or "Step 1: ..." inside a reply from splitting it.
    const counts = {};
    cands.forEach((c) => { if (c) counts[c.who.toLowerCase()] = (counts[c.who.toLowerCase()] || 0) + 1; });
    const firstIdx = lines.findIndex((l) => l.trim() !== '');
    const turns = [];
    let cur = null;
    lines.forEach((line, i) => {
      const c = cands[i];
      const isSpeaker = c && (c.forced || KNOWN.test(c.who) || counts[c.who.toLowerCase()] >= 2 || i === firstIdx);
      if (isSpeaker) {
        cur = { who: c.who, lines: c.rest ? [c.rest] : [] };
        turns.push(cur);
      } else {
        if (!cur) { cur = { who: null, lines: [] }; turns.push(cur); }
        cur.lines.push(line);
      }
    });
    const out = turns.map((t) => ({ who: t.who, text: t.lines.join('\n').trim() })).filter((t) => t.text || t.who);
    return { turns: out, speakers: [...new Set(out.filter((t) => t.who).map((t) => t.who))] };
  }

  function chatHtml(text, ctx) {
    const { turns } = parseChat(text);
    if (!turns.some((t) => t.who)) return null;
    const inner = Object.assign({}, ctx, { inChat: true });
    let html = '<div class="chat snap">';
    for (const t of turns) {
      const body = render(t.text, inner);
      if (!t.who) { html += '<div class="turn note-turn"><div class="bubble">' + body + '</div></div>'; continue; }
      const mine = ctx && ctx.me && t.who.toLowerCase() === String(ctx.me).toLowerCase();
      const side = RIGHT.test(t.who) || mine ? 'right' : 'left';
      html += '<div class="turn ' + side + '" style="--pen:' + speakerColor(t.who, ctx && ctx.me) + '"><div class="who">' + esc(t.who) +
        '</div><div class="bubble">' + body + '</div></div>';
    }
    return html + '</div>';
  }

  // ---------------------------------------------------------------- blocks
  const CALLOUTS = {
    KEY: ['key', 'Key point'], DEF: ['def', 'Definition'], EX: ['ex', 'Example'], TIP: ['tip', 'Tip'],
    WARN: ['warn', 'Watch out'], EXAM: ['exam', 'Exam tip'], MISTAKE: ['mistake', 'Common mistake'], NOTE: ['note', 'Note'],
  };
  const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
  const HR = /^\s*([-*_])(\s*\1){2,}\s*$/;

  function splitRow(line) {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
    return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
  }

  function startsBlock(lines, i) {
    const l = lines[i];
    return OPEN_FENCE.test(l) || /^#{1,4}\s+/.test(l) || /^\s*>/.test(l) || LIST_RE.test(l) || HR.test(l) ||
      (l.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-'));
  }

  function listBlock(lines, i, ctx) {
    const first = lines[i].match(LIST_RE);
    const indent = first[1].length;
    const ordered = /\d/.test(first[2]);
    let html = ordered ? '<ol>' : '<ul>';
    while (i < lines.length) {
      const m = lines[i].match(LIST_RE);
      if (!m || m[1].length !== indent || /\d/.test(m[2]) !== ordered) break;
      let text = m[3];
      i++;
      let nested = '';
      while (i < lines.length && lines[i].trim() !== '') {
        const nm = lines[i].match(LIST_RE);
        if (nm) {
          if (nm[1].length > indent) { const r = listBlock(lines, i, ctx); nested += r.html; i = r.next; continue; }
          break;
        }
        if (/^\s+\S/.test(lines[i])) { text += '\n' + lines[i].trim(); i++; continue; }
        break;
      }
      const task = text.match(/^\[( |x|X)\](?:\s+([\s\S]*))?$/);
      if (task) {
        const checked = task[1] !== ' ';
        let attrs = '';
        if (ctx.tasks && !ctx.inChat) attrs = ' data-task="' + ctx.tasks.n++ + '"';
        else attrs = ' disabled';
        html += '<li class="task' + (checked ? ' done' : '') + '"><input type="checkbox"' + (checked ? ' checked' : '') + attrs + '><span>' +
          inline(task[2] || '', ctx).replace(/\n/g, '<br>') + '</span>' + nested + '</li>';
      } else {
        html += '<li>' + inline(text, ctx).replace(/\n/g, '<br>') + nested + '</li>';
      }
      if (i < lines.length && lines[i].trim() === '' && i + 1 < lines.length) {
        const nm = lines[i + 1].match(LIST_RE);
        if (nm && nm[1].length === indent && /\d/.test(nm[2]) === ordered) i++;
      }
    }
    return { html: html + (ordered ? '</ol>' : '</ul>'), next: i };
  }

  function render(md, ctx) {
    ctx = Object.assign({}, ctx || {});
    if (!ctx.tasks) ctx.tasks = { n: 0 };
    const lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '') { i++; continue; }

      const fence = line.match(OPEN_FENCE);
      if (fence) {
        const marker = fence[1];
        const body = [];
        i++;
        while (i < lines.length) {
          const close = lines[i].match(/^\s*(`{3,}|~{3,})\s*$/);
          if (close && close[1][0] === marker[0] && close[1].length >= marker.length) break;
          body.push(lines[i]); i++;
        }
        i++; // skip the closing fence
        const lang = fence[2].toLowerCase();
        if (lang === 'chat' && !ctx.inChat) {
          const html = chatHtml(body.join('\n'), ctx);
          if (html) { out.push(html); continue; }
        }
        out.push('<pre class="snap"><code' + (lang ? ' class="lang-' + esc(lang) + '"' : '') + '>' + esc(body.join('\n')) + '</code></pre>');
        continue;
      }

      const h = line.match(/^(#{1,4})\s+(.*?)\s*#*\s*$/);
      if (h) { out.push('<h' + h[1].length + '>' + inline(h[2], ctx) + '</h' + h[1].length + '>'); i++; continue; }

      if (HR.test(line)) { out.push('<hr>'); i++; continue; }

      if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-')) {
        const head = splitRow(line);
        const aligns = splitRow(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : /^:-/.test(c) ? 'left' : ''));
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) { rows.push(splitRow(lines[i])); i++; }
        const cell = (tag, c, k) => '<' + tag + (aligns[k] ? ' style="text-align:' + aligns[k] + '"' : '') + '>' + inline(c || '', ctx) + '</' + tag + '>';
        out.push('<div class="table-wrap snap"><table><thead><tr>' + head.map((c, k) => cell('th', c, k)).join('') + '</tr></thead><tbody>' +
          rows.map((r) => '<tr>' + head.map((_, k) => cell('td', r[k], k)).join('') + '</tr>').join('') + '</tbody></table></div>');
        continue;
      }

      if (/^\s*>/.test(line)) {
        const q = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        const co = q[0].match(/^\[!([A-Za-z]+)\]\s*(.*)$/);
        if (co && CALLOUTS[co[1].toUpperCase()]) {
          const [cls, label] = CALLOUTS[co[1].toUpperCase()];
          const title = co[2].trim() || label;
          out.push('<aside class="callout snap ' + cls + '"><div class="callout-title">' + inline(title, ctx) + '</div>' + render(q.slice(1).join('\n'), ctx) + '</aside>');
        } else {
          out.push('<blockquote class="snap">' + render(q.join('\n'), ctx) + '</blockquote>');
        }
        continue;
      }

      if (LIST_RE.test(line)) {
        const r = listBlock(lines, i, ctx);
        out.push(r.html);
        i = r.next;
        continue;
      }

      const para = [];
      while (i < lines.length && lines[i].trim() !== '' && (para.length === 0 || !startsBlock(lines, i))) { para.push(lines[i]); i++; }
      const text = para.join('\n');
      const fig = text.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (fig && SAFE_URL.test(fig[2])) {
        const cap = fig[1].trim();
        out.push('<figure class="snap">' + inline(text.trim(), ctx) + (cap ? '<figcaption>' + esc(cap) + '</figcaption>' : '') + '</figure>');
      } else {
        out.push('<p>' + inline(text, ctx).replace(/\n/g, '<br>') + '</p>');
      }
    }
    return out.join('\n');
  }

  /** Tick / untick the nth task item (counting like render does, skipping code fences). */
  function toggleTask(md, n) {
    const lines = String(md).split('\n');
    let count = 0;
    let fence = null;
    for (let i = 0; i < lines.length; i++) {
      const open = lines[i].match(OPEN_FENCE);
      if (fence) {
        const close = lines[i].match(/^\s*(`{3,}|~{3,})\s*$/);
        if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
        continue;
      }
      if (open) { fence = open[1]; continue; }
      const m = lines[i].match(TASK_RE);
      if (m) {
        if (count === n) {
          lines[i] = lines[i].replace(TASK_RE, (all, pre, mark, tail) => pre + '[' + (mark === ' ' ? 'x' : ' ') + ']' + tail);
          break;
        }
        count++;
      }
    }
    return lines.join('\n');
  }

  /** Plain text of a note, for search results and previews. */
  function plain(md) {
    return String(md || '')
      .replace(/^\s*(`{3,}|~{3,})[\w-]*\s*$/gm, ' ') // drop the fence lines but keep what is inside (saved chats must stay searchable)
      .replace(/^[\s|:-]+$/gm, ' ') // table separator rows and rules
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/^\s*>\s?\[![A-Za-z]+\]\s*/gm, '')
      .replace(/^[#>\-*+\s]+(?:\[[ xX]\]\s+)?/gm, '')
      .replace(/[*_~=`|]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return { render, inline, parseChat, speakerColor, toggleTask, plain, esc };
});
