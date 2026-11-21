// Same sync rule as public/merge.js (which the browser uses), written as a module for the server.
// A test in test/backend.test.mjs checks the two copies give identical answers, so they cannot drift apart.
// Rule: for each note/folder id, the copy with the newer updatedAt wins. Deletes are kept as
// "tombstones" ({deleted:true, updatedAt}) so an old copy on another device cannot bring a note back.
export function merge(base, incoming) {
  base = base || {};
  incoming = incoming || {};
  const out = {};
  let changedBase = false;     // the result differs from `base` -> the server must write to R2
  let changedIncoming = false; // the result differs from `incoming` -> the client needs the server's copy
  const ids = new Set([...Object.keys(base), ...Object.keys(incoming)]);
  for (const id of ids) {
    const a = base[id];
    const b = incoming[id];
    if (!a) { out[id] = b; changedBase = true; continue; }
    if (!b) { out[id] = a; changedIncoming = true; continue; }
    const ta = a.updatedAt || 0;
    const tb = b.updatedAt || 0;
    if (tb > ta) { out[id] = b; changedBase = true; }
    else if (tb < ta) { out[id] = a; changedIncoming = true; }
    else if (b.deleted && !a.deleted) { out[id] = b; changedBase = true; } // tie: a delete wins
    else { out[id] = a; if (a.deleted && !b.deleted) changedIncoming = true; }
  }
  return { nodes: out, changedBase, changedIncoming };
}
