// Who wrote what. Kept out of api/ so Cloudflare does not treat it as a URL.
/**
 * "Saved by": the name on a note comes from the signed-in session, never from what the browser claims.
 * Only copies that WON the merge (the incoming one was newer) are looked at.
 *   new note                  -> created by and saved by this person
 *   createdBy                 -> can never change after the note exists
 *   saved by                  -> this person, UNLESS the change was not an edit (starring, moving, reordering),
 *                                in which case the previous 'saved by' stays
 */
export function stampAuthors(merged, base, incoming, who) {
  for (const id of Object.keys(merged)) {
    const w = merged[id];
    if (w !== incoming[id]) continue;          // the stored copy won: nothing to stamp
    const a = base[id];
    if (!a) { w.createdBy = who; w.by = who; continue; }
    if (a.createdBy) w.createdBy = a.createdBy; else delete w.createdBy;
    if (w.by && w.by !== who && w.by !== a.by) w.by = who;   // claims a name that is neither the sender nor the previous saver
    if (!w.by) { if (a.by) w.by = a.by; else delete w.by; }
  }
}
