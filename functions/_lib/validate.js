// Server-side sanity checks, so a bad client can never corrupt the notebook document.
const MAX_NODES = 20000;
const MAX_TITLE = 300;
const MAX_BODY = 1_500_000;

const cleanBy = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 40) : '');

export function cleanNode(n) {
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
  // who made / last saved it. The server overwrites these with the signed-in person's name (see api/sync.js)
  const by = cleanBy(n.by);
  const createdBy = cleanBy(n.createdBy);
  if (by) out.by = by;
  if (createdBy) out.createdBy = createdBy;
  if (n.type === 'note') {
    out.body = String(n.body == null ? '' : n.body).slice(0, MAX_BODY);
    if (n.starred) out.starred = true;
  } else if (typeof n.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(n.color)) {
    out.color = n.color;
  }
  return out;
}

/** Turn an untrusted { id: node } map into a clean one (invalid entries are dropped). */
export function cleanNodes(map) {
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

const ascii = (u8, from, to) => String.fromCharCode(...u8.subarray(from, to));

/** Image files are checked by their first bytes, not by what the browser claims. u8 = Uint8Array. */
export function sniffImage(u8) {
  if (!u8 || u8.length < 12) return null;
  if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return 'image/jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => u8[i] === b)) return 'image/png';
  if (ascii(u8, 0, 4) === 'GIF8') return 'image/gif';
  if (ascii(u8, 0, 4) === 'RIFF' && ascii(u8, 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export const IMAGE_ID = /^[A-Za-z0-9_-]{6,64}$/;
