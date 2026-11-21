// Merge logic shared by the browser and the server (UMD).
// Rule: for each note/folder id, the copy with the newer updatedAt wins.
// Deletes are kept as "tombstones" ({deleted:true, updatedAt}) so a delete on one device
// is not undone by an older copy on another device.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NBMerge = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * merge(base, incoming) -> { nodes, changedBase, changedIncoming }
   * changedBase: the result differs from `base`      (server: "I must write to R2")
   * changedIncoming: the result differs from `incoming` (client: "the server needs my changes")
   */
  function merge(base, incoming) {
    base = base || {};
    incoming = incoming || {};
    const out = {};
    let changedBase = false;
    let changedIncoming = false;
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
      else if (b.deleted && !a.deleted) { out[id] = b; changedBase = true; }   // tie: a delete wins
      else { out[id] = a; if (a.deleted && !b.deleted) changedIncoming = true; }
    }
    return { nodes: out, changedBase, changedIncoming };
  }

  return { merge };
});
