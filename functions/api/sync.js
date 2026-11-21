// One endpoint keeps every device in step.
//   POST { nodes: { id: node } }  -> merges the changes into the notebook in R2, returns the full result
//   GET                           -> returns the notebook as stored in R2
import { getConfig } from '../_lib/config.js';
import { currentUser } from '../_lib/auth.js';
import { json, readJson } from '../_lib/http.js';
import { cleanNodes } from '../_lib/validate.js';
import { merge } from '../_lib/merge.js';
import { stampAuthors } from '../_lib/authors.js';

const DOC_KEY = 'notebook/doc.json';

async function loadDoc(bucket) {
  const obj = await bucket.get(DOC_KEY);
  if (!obj) return { v: 1, rev: 0, savedAt: null, nodes: {} };
  try {
    const doc = JSON.parse(await obj.text());
    return { v: 1, rev: doc.rev || 0, savedAt: doc.savedAt || null, nodes: doc.nodes || {} };
  } catch {
    throw new Error('notebook/doc.json in the bucket is not valid JSON');
  }
}

const put = (bucket, key, value) => bucket.put(key, JSON.stringify(value), { httpMetadata: { contentType: 'application/json' } });

export async function onRequest({ request, env }) {
  const cfg = getConfig(env);
  if (!cfg.ready) return json(503, { error: 'not_configured', reason: cfg.reason });
  const user = await currentUser(cfg, request);
  if (!user) return json(401, { error: 'unauthorized' });
  if (request.method !== 'GET' && request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  try {
    let body = {};
    if (request.method === 'POST') body = await readJson(request, 4.4 * 1024 * 1024);
    const doc = await loadDoc(cfg.bucket);
    if (request.method === 'GET') return json(200, { rev: doc.rev, nodes: doc.nodes });

    const incoming = cleanNodes(body.nodes);
    const merged = merge(doc.nodes, incoming);
    if (merged.changedBase) stampAuthors(merged.nodes, doc.nodes, incoming, user.name);
    if (!merged.changedBase) return json(200, { rev: doc.rev, nodes: doc.nodes });

    // Once a day, keep a copy of the previous version as a free safety net.
    const today = new Date().toISOString().slice(0, 10);
    const lastDay = doc.savedAt ? doc.savedAt.slice(0, 10) : null;
    if (lastDay && lastDay < today && doc.rev > 0) {
      await put(cfg.bucket, `notebook/backups/doc-${lastDay}.json`, { v: 1, rev: doc.rev, savedAt: doc.savedAt, nodes: doc.nodes });
    }
    const next = { v: 1, rev: doc.rev + 1, savedAt: new Date().toISOString(), nodes: merged.nodes };
    await put(cfg.bucket, DOC_KEY, next);
    return json(200, { rev: next.rev, nodes: next.nodes });
  } catch (e) {
    const status = e.status || 502;
    return json(status, { error: status === 502 ? 'storage_error' : status === 413 ? 'too_large' : 'bad_request', message: String(e.message || e).slice(0, 300) });
  }
}
