'use strict';
// Server-side sanity checks, so a bad client can never corrupt the notebook document.

const MAX_NODES = 20000;
const MAX_TITLE = 300;
const MAX_BODY = 1_500_000;

function cleanNode(n) {
  if (!n || typeof n !== 'object') return null;
  if (typeof n.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(n.id)) return null;
  if (n.type !== 'folder' && n.type !== 'note') return null;
  const updatedAt = Number(n.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt < 0) return null;
  const out = {
    id: n.id,
    type: n.type,
    parentId: typeof n.parentId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(n.parentId) ? n.parentId : null,
    title: String(n.title == null ? '' : n.title).slice(0, MAX_TITLE),
    order: Number.isFinite(Number(n.order)) ? Number(n.order) : 0,
    createdAt: Number.isFinite(Number(n.createdAt)) ? Number(n.createdAt) : updatedAt,
    updatedAt,
  };
  if (n.deleted) out.deleted = true;
  if (n.type === 'note') {
    out.body = String(n.body == null ? '' : n.body).slice(0, MAX_BODY);
    if (n.starred) out.starred = true;
  } else if (typeof n.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(n.color)) {
    out.color = n.color;
  }
  return out;
}

/** Turn an untrusted { id: node } map into a clean one (invalid entries are dropped). */
function cleanNodes(map) {
  const out = {};
  if (!map || typeof map !== 'object') return out;
  let count = 0;
  for (const key of Object.keys(map)) {
    if (++count > MAX_NODES) break;
    const node = cleanNode(map[key]);
    if (node && node.id === key) out[key] = node;
  }
  return out;
}

// Image files are checked by their first bytes, not by what the browser claims.
function sniffImage(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.slice(0, 4).toString('latin1') === 'GIF8') return 'image/gif';
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

const IMAGE_ID = /^[A-Za-z0-9_-]{6,64}$/;

module.exports = { cleanNodes, cleanNode, sniffImage, IMAGE_ID };
