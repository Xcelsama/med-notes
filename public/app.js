/* Med Notebook — app logic. Local-first: everything is saved on the device (IndexedDB) and,
   when the Cloudflare R2 variables are set on the server, synced to the bucket. */
(() => {
  'use strict';
  const MD = window.NBMD;
  const MG = window.NBMerge;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = MD.esc;

  // ------------------------------------------------------------------ icons
  const ICON = {
    menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    chev: '<polyline points="9 18 15 12 9 6"/>',
    more: '<circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/><circle cx="5" cy="12" r="1.2"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    edit: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    move: '<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>',
    up: '<polyline points="18 15 12 9 6 15"/>',
    down: '<polyline points="6 9 12 15 18 9"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1.2"/><circle cx="17.5" cy="10.5" r="1.2"/><circle cx="8.5" cy="7.5" r="1.2"/><circle cx="6.5" cy="12.5" r="1.2"/><path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A4.7 4.7 0 0 0 22 10.7C22 5.9 17.5 2 12 2z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4"/><path d="M5 17v4M3 19h4"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  };
  const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ''}</svg>`;

  // ------------------------------------------------------------------ local storage (IndexedDB)
  const mem = { kv: new Map(), img: new Map() };
  let dbp = null;
  function openDB() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        try {
          const r = indexedDB.open('anatomy-notebook', 1);
          r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('img', { keyPath: 'id' }); };
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        } catch (e) { reject(e); }
      }).catch(() => null);
    }
    return dbp;
  }
  async function idb(store, mode, fn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }
  const kvGet = async (k) => ((await openDB()) ? idb('kv', 'readonly', (s) => s.get(k)) : mem.kv.get(k));
  const kvSet = async (k, v) => { if (await openDB()) return idb('kv', 'readwrite', (s) => s.put(v, k)); mem.kv.set(k, v); };
  const imgGet = async (id) => ((await openDB()) ? idb('img', 'readonly', (s) => s.get(id)) : mem.img.get(id));
  const imgPut = async (rec) => { if (await openDB()) return idb('img', 'readwrite', (s) => s.put(rec)); mem.img.set(rec.id, rec); };
  const imgAll = async () => ((await openDB()) ? idb('img', 'readonly', (s) => s.getAll()) : [...mem.img.values()]);

  // ------------------------------------------------------------------ state
  const S = {
    doc: { rev: 0, nodes: {} },
    mode: 'local', // 'local' (this device only) | 'cloud' (synced to R2)
    authed: false,
    user: null,   // who is signed in: { name, admin } (cloud mode only)
    setup: false, // true when nobody has an account yet
    cloudProblem: '',
    sync: { state: 'local', last: 0, error: '' },
    dirty: new Set(),
    fullPush: true,
    route: { kind: 'home', id: null },
    edit: 'read',
    nextEdit: null,
    drawer: false,
    expanded: new Set(),
    settings: { theme: '', font: '', size: '', myName: 'Excel', promptStyle: '' },
    imgUrls: new Map(),
    lastUndo: null,
  };
  try { S.expanded = new Set(JSON.parse(localStorage.getItem('nb-expanded') || '[]')); } catch { /* ignore */ }
  try { Object.assign(S.settings, JSON.parse(localStorage.getItem('nb-settings') || '{}')); } catch { /* ignore */ }

  const now = () => Date.now();
  const uid = (p = 'n') => p + now().toString(36) + Math.random().toString(36).slice(2, 7);
  let ver = 0;
  let cache = { ver: -1, map: null };

  function childMap() {
    if (cache.ver === ver) return cache.map;
    const nodes = S.doc.nodes;
    const map = new Map();
    for (const n of Object.values(nodes)) {
      if (n.deleted) continue;
      const p = n.parentId && nodes[n.parentId] && !nodes[n.parentId].deleted ? n.parentId : null;
      if (!map.has(p)) map.set(p, []);
      map.get(p).push(n);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.type === b.type ? 0 : a.type === 'folder' ? -1 : 1) || (a.order - b.order) || (a.title || '').localeCompare(b.title || ''));
    }
    cache = { ver, map };
    return map;
  }
  const kids = (id) => childMap().get(id || null) || [];
  const node = (id) => { const n = S.doc.nodes[id]; return n && !n.deleted ? n : null; };
  const liveNodes = () => Object.values(S.doc.nodes).filter((n) => !n.deleted);
  function pathOf(id) {
    const out = [];
    let c = node(id);
    let g = 0;
    while (c && c.parentId && node(c.parentId) && g++ < 60) { c = node(c.parentId); out.unshift(c); }
    return out;
  }
  function descendants(id) {
    const out = [];
    const walk = (pid) => { for (const k of kids(pid)) { out.push(k); if (k.type === 'folder') walk(k.id); } };
    walk(id);
    return out;
  }
  const countNotes = (id) => descendants(id).filter((n) => n.type === 'note').length;

  const PALETTE = ['#2457c5', '#c4552d', '#2e8b57', '#8e3fa0', '#b07a0a', '#13807f', '#c23b48', '#59657a'];
  function colorOf(n) {
    let c = n;
    let g = 0;
    while (c.parentId && node(c.parentId) && g++ < 60) c = node(c.parentId);
    if (c.color) return c.color;
    let h = 0;
    for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }

  // ---- who is signed in, and how people are shown
  const me = () => (S.user && S.user.name) || '';
  const myName = () => me() || S.settings.myName || 'Excel'; // the name used for "You said:" in pasted conversations
  const initial = (name) => (String(name || '?').trim().charAt(0) || '?').toUpperCase();
  const firstName = (name) => String(name || '').trim().split(/\s+/)[0];
  function authorColor(name) {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  const whoName = (name) => esc(name) + (name === me() ? ' (you)' : '');

  // `authored` = a real edit (typing, renaming, creating). Only those change "saved by";
  // starring, moving and reordering leave it alone, so the name always means who wrote it.
  function touch(n, authored) {
    n.updatedAt = Math.max(now(), (n.updatedAt || 0) + 1);
    if (authored && me()) n.by = me();
    S.dirty.add(n.id);
    ver++;
    scheduleSave();
  }
  function createNode(type, parentId, title, extra) {
    const sibs = kids(parentId);
    const n = Object.assign({
      id: uid(type === 'folder' ? 'f' : 'n'), type, parentId: parentId || null, title: title || '',
      order: sibs.length ? Math.max(...sibs.filter((s) => s.type === type).map((s) => s.order), 0) + 1 : 1,
      createdAt: now(), updatedAt: now(),
    }, type === 'note' ? { body: '' } : {}, extra || {});
    if (me()) { n.createdBy = me(); n.by = me(); }
    S.doc.nodes[n.id] = n;
    touch(n, true);
    if (parentId) { S.expanded.add(parentId); saveExpanded(); }
    return n;
  }
  function deleteNode(id) {
    const n = node(id);
    if (!n) return;
    const ids = [id, ...descendants(id).map((d) => d.id)];
    for (const x of ids) { const m = S.doc.nodes[x]; m.deleted = true; touch(m); }
    S.lastUndo = ids;
    if (S.route.id && ids.includes(S.route.id)) go(n.parentId && node(n.parentId) ? 'folder' : 'home', n.parentId);
    renderAll();
    toast(`Deleted “${n.title || 'Untitled'}”`, 'Undo', () => {
      for (const x of ids) { const m = S.doc.nodes[x]; delete m.deleted; touch(m); }
      renderAll();
    });
  }
  function moveNode(id, newParent) {
    const n = node(id);
    if (!n) return;
    if (newParent && (newParent === id || descendants(id).some((d) => d.id === newParent))) { toast('A folder cannot go inside itself'); return; }
    n.parentId = newParent || null;
    n.order = kids(newParent).filter((k) => k.type === n.type).length + 1;
    touch(n);
    if (newParent) { S.expanded.add(newParent); saveExpanded(); }
    renderAll();
  }
  function reorder(id, dir) {
    const n = node(id);
    if (!n) return;
    const sibs = kids(n.parentId && node(n.parentId) ? n.parentId : null).filter((k) => k.type === n.type);
    const i = sibs.findIndex((s) => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= sibs.length) return;
    [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
    sibs.forEach((s, k) => { if (s.order !== k + 1) { s.order = k + 1; touch(s); } });
    renderAll();
  }

  // ------------------------------------------------------------------ saving + syncing
  let saveT = null;
  function scheduleSave() {
    clearTimeout(saveT);
    saveT = setTimeout(persist, 350);
    if (S.mode === 'cloud' && S.authed) { setSync(navigator.onLine ? 'busy' : 'offline'); scheduleSync(); }
  }
  async function persist() { clearTimeout(saveT); try { await kvSet('doc', S.doc); } catch (e) { console.warn('save failed', e); } }

  function setSync(state, error) {
    S.sync.state = state;
    if (error !== undefined) S.sync.error = error;
    const chip = $('#userChip');
    if (chip) chip.dataset.sync = state;
    const p = $('#pill');
    if (!p) return;
    const map = {
      local: ['', 'On this device'], ok: ['ok', 'Synced'], busy: ['busy', 'Saving…'],
      offline: ['', 'Offline · saved here'], bad: ['bad', 'Sync problem'],
    };
    const [cls, text] = map[state] || map.local;
    p.className = 'pill ' + cls;
    p.innerHTML = `<i></i><span>${text}</span>`;
  }

  async function api(path, body) {
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(25000),
    });
    let data = null;
    try { data = await res.json(); } catch { /* not json */ }
    if (!res.ok) { const e = new Error((data && (data.message || data.reason || data.error)) || 'HTTP ' + res.status); e.status = res.status; throw e; }
    return data;
  }

  let syncT = null;
  let syncing = false;
  let syncAgain = false;
  function scheduleSync(delay = 1800) {
    if (S.mode !== 'cloud' || !S.authed) return;
    clearTimeout(syncT);
    syncT = setTimeout(sync, delay);
  }

  async function uploadPendingImages() {
    for (const rec of await imgAll()) {
      if (rec.uploaded || (rec.failed || 0) >= 3) continue;
      const res = await fetch('/api/image?id=' + encodeURIComponent(rec.id), {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/octet-stream' }, body: rec.blob,
      });
      if (res.status === 401) { const e = new Error('unauthorized'); e.status = 401; throw e; }
      if (res.ok) { rec.uploaded = true; await imgPut(rec); }
      else { rec.failed = (rec.failed || 0) + 1; await imgPut(rec); if (res.status >= 500) throw new Error('Image upload failed (' + res.status + ')'); }
    }
  }

  async function sync(manual) {
    if (S.mode !== 'cloud' || !S.authed) return;
    if (syncing) { syncAgain = true; return; }
    if (!navigator.onLine) { setSync('offline'); return; }
    syncing = true;
    setSync('busy');
    const ids = S.fullPush ? Object.keys(S.doc.nodes) : [...S.dirty];
    const sent = {};
    ids.forEach((id) => { if (S.doc.nodes[id]) sent[id] = S.doc.nodes[id]; });
    S.dirty.clear();
    S.fullPush = false;
    const open = S.route.kind === 'note' ? S.doc.nodes[S.route.id] : null;
    const before = open ? open.updatedAt : 0;
    const bodyBefore = open ? open.body : null;
    try {
      await uploadPendingImages();
      const r = await api('/api/sync', { nodes: sent });
      S.doc.nodes = MG.merge(S.doc.nodes, r.nodes).nodes;
      // the server decides who "saved by" is: where our copy is the same version as the server's, take its names
      for (const [id, sn] of Object.entries(r.nodes)) {
        const ln = S.doc.nodes[id];
        if (!ln || ln.updatedAt !== sn.updatedAt) continue;
        if (sn.by) ln.by = sn.by; else delete ln.by;
        if (sn.createdBy) ln.createdBy = sn.createdBy; else delete ln.createdBy;
      }
      S.doc.rev = r.rev;
      ver++;
      await persist();
      S.sync.last = now();
      setSync(S.dirty.size ? 'busy' : 'ok', '');
      afterRemoteChange(before, bodyBefore);
      if (manual) toast('Synced ✓');
    } catch (e) {
      ids.forEach((id) => S.dirty.add(id));
      if (e.status === 401) { S.authed = false; setSync('bad', 'Signed out'); showLock('Please sign in again.'); }
      else if (!navigator.onLine || e.name === 'TypeError' || e.name === 'TimeoutError') { setSync('offline'); scheduleSync(20000); }
      else { setSync('bad', e.message); scheduleSync(30000); if (manual) toast('Sync failed: ' + e.message); }
    } finally {
      syncing = false;
      if (syncAgain) { syncAgain = false; scheduleSync(500); }
    }
  }

  // After a sync brought in changes, refresh what is on screen without disturbing someone who is typing.
  function afterRemoteChange(beforeStamp, bodyBefore) {
    renderTree();
    renderTopbar();
    if (S.route.kind !== 'note') { renderView(); return; }
    const n = node(S.route.id);
    if (!n) { go('home'); return; }
    if (n.updatedAt === beforeStamp) return;
    const ta = $('#ta');
    if (!ta) { renderView(); return; }
    const ti = $('#title');
    if (ti && ti.value !== n.title && document.activeElement !== ti) { ti.value = n.title; fitTitle(ti); }
    if (ta.value === n.body) return;
    if (ta.value === bodyBefore) {
      // nothing typed while the sync was running: safe to swap in the newer text and keep the cursor where it was
      const s = ta.selectionStart;
      const e = ta.selectionEnd;
      ta.value = n.body;
      fitEditor(ta);
      ta.setSelectionRange(Math.min(s, n.body.length), Math.min(e, n.body.length));
      const pv = $('.editor-wrap.split #md');
      if (pv) { pv.innerHTML = MD.render(n.body, mdCtx()); afterMdRender(); }
      toast('Updated from another device');
    } else {
      toast('This note changed on another device', 'Load it', () => renderView());
    }
  }

  // ------------------------------------------------------------------ images
  const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type, q));
  async function processImage(file) {
    if (file.type === 'image/gif' && file.size < 3.5 * 1024 * 1024) return { blob: file, type: 'image/gif' };
    let bmp;
    try { bmp = await createImageBitmap(file); } catch { throw new Error('Could not read that image'); }
    const sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * sc));
    const h = Math.max(1, Math.round(bmp.height * sc));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    let q = 0.82;
    let blob = await toBlob(c, 'image/webp', q);
    if (!blob || blob.type !== 'image/webp') { blob = await toBlob(c, 'image/jpeg', 0.85); }
    while (blob.size > 3.5 * 1024 * 1024 && q > 0.35) { q -= 0.15; blob = await toBlob(c, blob.type, q); }
    if (blob.size > 3.9 * 1024 * 1024) throw new Error('That image is too large even after shrinking');
    return { blob, type: blob.type };
  }
  async function addImages(files) {
    const out = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      try {
        const { blob, type } = await processImage(f);
        const id = uid('i');
        await imgPut({ id, blob, type, name: f.name || 'image', size: blob.size, uploaded: false, createdAt: now() });
        S.imgUrls.set(id, URL.createObjectURL(blob));
        out.push(id);
      } catch (e) { toast(e.message); }
    }
    if (out.length) scheduleSync(600);
    return out;
  }
  const imageUrl = (id) => S.imgUrls.get(id) || (S.mode === 'cloud' ? '/api/image?id=' + encodeURIComponent(id) : '');
  async function hydrateImages(root) {
    for (const img of root.querySelectorAll('img[data-img]')) {
      const id = img.dataset.img;
      let url = S.imgUrls.get(id);
      if (!url) {
        const rec = await imgGet(id).catch(() => null);
        if (rec) { url = URL.createObjectURL(rec.blob); S.imgUrls.set(id, url); }
      }
      if (url) { if (img.getAttribute('src') !== url) img.src = url; img.removeAttribute('data-pending'); }
      else if (!img.getAttribute('src')) { img.setAttribute('data-pending', ''); img.alt = (img.alt ? img.alt + ' · ' : '') + 'image not on this device yet'; }
    }
  }

  // ------------------------------------------------------------------ UI helpers
  let toastT = null;
  function toast(msg, actionLabel, fn) {
    const t = $('#toast');
    t.innerHTML = `<span>${esc(msg)}</span>${actionLabel ? `<button>${esc(actionLabel)}</button>` : ''}`;
    t.hidden = false;
    if (actionLabel) t.querySelector('button').onclick = () => { t.hidden = true; fn && fn(); };
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, actionLabel ? 7000 : 3200);
  }
  let modalClose = null;
  function openModal(html, { wide = false, onMount, onClose } = {}) {
    closeModal();
    const ov = $('#overlay');
    ov.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    ov.hidden = false;
    modalClose = () => { ov.hidden = true; ov.innerHTML = ''; modalClose = null; if (onClose) onClose(); };
    const el = ov.firstElementChild;
    if (onMount) onMount(el);
    return el;
  }
  function closeModal() { if (modalClose) { const f = modalClose; modalClose = null; f(); } }
  $('#overlay').addEventListener('mousedown', (e) => { if (e.target.id === 'overlay') closeModal(); });

  function askText({ title, hint = '', value = '', ok = 'Save', placeholder = '' }) {
    return new Promise((res) => {
      let done = false;
      const fin = (v) => { if (!done) { done = true; res(v); } };
      openModal(`<h3>${esc(title)}</h3>${hint ? `<p class="hint">${esc(hint)}</p>` : ''}<input type="text" id="mi" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off"><div class="actions"><button class="btn" data-m="cancel">Cancel</button><button class="btn primary" data-m="ok">${esc(ok)}</button></div>`, {
        onClose: () => fin(null),
        onMount: (el) => {
          const i = el.querySelector('#mi');
          i.focus(); i.select();
          i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { fin(i.value.trim()); closeModal(); } });
          el.addEventListener('click', (ev) => { const b = ev.target.closest('[data-m]'); if (!b) return; if (b.dataset.m === 'ok') fin(i.value.trim()); closeModal(); });
        },
      });
    });
  }
  function confirmBox({ title, hint = '', ok = 'OK', danger = false }) {
    return new Promise((res) => {
      let done = false;
      const fin = (v) => { if (!done) { done = true; res(v); } };
      openModal(`<h3>${esc(title)}</h3><p class="hint">${esc(hint)}</p><div class="actions"><button class="btn" data-m="cancel">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-m="ok">${esc(ok)}</button></div>`, {
        onClose: () => fin(false),
        onMount: (el) => el.addEventListener('click', (ev) => { const b = ev.target.closest('[data-m]'); if (!b) return; fin(b.dataset.m === 'ok'); closeModal(); }),
      });
    });
  }
  function actionSheet(title, items) {
    const html = `<h3>${esc(title)}</h3><div class="sheetlist">${items.map((it, i) => it.hr ? '<hr>' :
      `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.icon ? icon(it.icon) : ''}<span>${esc(it.label)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span></button>`).join('')}</div>`;
    openModal(html, {
      onMount: (el) => el.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-i]');
        if (!b) return;
        const it = items[+b.dataset.i];
        closeModal();
        if (it && it.fn) it.fn();
      }),
    });
  }
  function pickFolder({ title, exclude = new Set() }) {
    return new Promise((res) => {
      let done = false;
      const fin = (v) => { if (!done) { done = true; res(v); } };
      const rows = [];
      const walk = (pid, depth) => {
        for (const k of kids(pid)) {
          if (k.type !== 'folder') continue;
          rows.push(`<div class="row ${exclude.has(k.id) ? 'disabled' : ''}" style="--d:${depth};--tab:${colorOf(k)}" data-pick="${k.id}"><span class="twisty none"></span><span class="ico">${icon('folder')}</span><span class="label">${esc(k.title || 'Untitled')}</span></div>`);
          walk(k.id, depth + 1);
        }
      };
      walk(null, 0);
      openModal(`<h3>${esc(title)}</h3><div class="picker"><div class="row" style="--d:0" data-pick="__root"><span class="twisty none"></span><span class="ico">${icon('home')}</span><span class="label">Top level</span></div>${rows.join('')}</div><div class="actions"><button class="btn" data-m="cancel">Cancel</button></div>`, {
        onClose: () => fin(null),
        onMount: (el) => el.addEventListener('click', (ev) => {
          const r = ev.target.closest('[data-pick]');
          if (r) { fin({ id: r.dataset.pick === '__root' ? null : r.dataset.pick }); closeModal(); }
          else if (ev.target.closest('[data-m]')) closeModal();
        }),
      });
    });
  }
  function pickFiles(accept, multiple) {
    return new Promise((res) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = accept; inp.multiple = !!multiple;
      inp.onchange = () => res([...inp.files]);
      inp.oncancel = () => res([]);
      inp.click();
    });
  }
  function download(name, text, mime = 'text/plain') {
    if (window.__NB_DEMO) { // the hosted preview blocks file downloads, so show the text to copy instead
      openModal(`<h3>${esc(name)}</h3><p class="hint">Downloads are switched off in this preview. In the real app this saves a file. Copy the text here instead.</p><textarea id="dl" readonly style="min-height:220px">${esc(text)}</textarea><div class="actions"><button class="btn" data-m="copy">Copy</button><button class="btn primary" data-m="close">Done</button></div>`, {
        onMount: (el) => el.addEventListener('click', async (ev) => {
          const b = ev.target.closest('[data-m]');
          if (!b) return;
          if (b.dataset.m === 'close') { closeModal(); return; }
          const ta = el.querySelector('#dl');
          try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { ta.focus(); ta.select(); toast('Press copy on the selected text'); }
        }),
      });
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime + ';charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const safeName = (s) => (s || 'note').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80) || 'note';
  function ago(ts) {
    if (!ts || ts < 1e12) return 'sample';
    const s = Math.max(0, (now() - ts) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    if (s < 172800) return 'yesterday';
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: now() - ts > 3.1e10 ? 'numeric' : undefined });
  }
  const words = (t) => (String(t || '').match(/\S+/g) || []).length;

  // ------------------------------------------------------------------ routing
  function parseHash() {
    const m = location.hash.match(/^#\/(f|n)\/([\w-]+)/);
    return m ? { kind: m[1] === 'f' ? 'folder' : 'note', id: m[2] } : { kind: 'home', id: null };
  }
  // The address bar (#/n/<id>) gives back-button support and reload-to-same-note, but the app never depends on it:
  // go() switches the screen directly, so it also works where the hash cannot be written (some embedded viewers).
  function go(kind, id) {
    const r = kind === 'home' || !id ? { kind: 'home', id: null } : { kind, id };
    const h = r.kind === 'home' ? '#/' : (r.kind === 'folder' ? '#/f/' : '#/n/') + r.id;
    try { if (location.hash !== h) location.hash = h; } catch { /* ignore */ }
    routeChanged(r);
  }
  function routeChanged(next) {
    S.route = next || parseHash();
    if (S.route.kind !== 'home' && !node(S.route.id)) S.route = { kind: 'home', id: null };
    S.drawer = false;
    S.edit = S.nextEdit && S.route.kind === 'note' ? S.nextEdit : 'read';
    S.nextEdit = null;
    if (S.route.id) { for (const a of pathOf(S.route.id)) S.expanded.add(a.id); saveExpanded(); }
    renderAll();
    $('#scroll').scrollTop = 0;
  }
  window.addEventListener('hashchange', () => { const r = parseHash(); if (r.kind !== S.route.kind || r.id !== S.route.id) routeChanged(r); });
  const saveExpanded = () => { try { localStorage.setItem('nb-expanded', JSON.stringify([...S.expanded])); } catch { /* ignore */ } };

  // ------------------------------------------------------------------ rendering: binder
  function buildBinder() {
    $('#binder').innerHTML = `
      <div class="binder-head">
        <div class="brand" data-act="home">Med Notebook<small>My study binder</small></div>
        <button class="iconbtn" data-act="search" aria-label="Search">${icon('search')}</button>
        <button class="iconbtn" data-act="newCourse" aria-label="New course">${icon('plus')}</button>
      </div>
      <div class="tree" id="tree"></div>
      <div class="binder-foot">
        <div id="whoami"></div>
        <div class="foot-row">
          <button class="btn" data-act="study">${icon('spark')} Study with AI</button>
          <button class="btn" data-act="settings">${icon('sliders')} Settings</button>
        </div>
      </div>`;
  }
  function renderWhoami() {
    const w = $('#whoami');
    if (!w) return;
    w.innerHTML = S.user ? `<button class="who-row" data-act="account"><span class="avatar sm" style="--pen:${authorColor(S.user.name)}">${esc(initial(S.user.name))}</span><span class="who-text"><b>${esc(S.user.name)}</b><small>${S.user.admin ? 'Admin · ' : ''}Tap for account</small></span>${icon('more')}</button>` : '';
  }
  function rowHtml(n, depth) {
    const isF = n.type === 'folder';
    const hasKids = isF && kids(n.id).length > 0;
    const open = S.expanded.has(n.id);
    const active = S.route.id === n.id;
    return `<div class="row ${isF ? 'folder' : 'note'} ${depth === 0 && isF ? 'course' : ''} ${active ? 'active' : ''}" style="--d:${depth};--tab:${colorOf(n)}" data-id="${n.id}" data-kind="${n.type}">
      <button class="twisty ${hasKids ? (open ? 'open' : '') : 'none'}" data-act="twist" data-id="${n.id}" aria-label="Expand">${icon('chev')}</button>
      <span class="ico">${icon(isF ? 'folder' : 'note')}</span>
      <span class="label">${esc(n.title || (isF ? 'Untitled folder' : 'Untitled note'))}</span>
      ${n.starred ? `<span class="star">${icon('star')}</span>` : ''}
      <button class="more" data-act="menu" data-id="${n.id}" aria-label="More">${icon('more')}</button></div>`;
  }
  function renderTree() {
    const tree = $('#tree');
    if (!tree) return;
    const out = [];
    const walk = (pid, depth) => {
      for (const n of kids(pid)) {
        out.push(rowHtml(n, depth));
        if (n.type === 'folder' && S.expanded.has(n.id)) walk(n.id, depth + 1);
      }
    };
    walk(null, 0);
    tree.innerHTML = out.length ? out.join('') : '<div class="tree-empty">No courses yet.<br>Tap <b>+</b> above to add your first course, like “Physiology” or “Histology”.</div>';
  }

  // ------------------------------------------------------------------ rendering: top bar
  function renderTopbar() {
    const r = S.route;
    let crumbs = '<a data-go="home:">Notebook</a>';
    if (r.kind !== 'home' && node(r.id)) {
      const chain = [...pathOf(r.id), node(r.id)];
      crumbs = chain.map((n, i) => i === chain.length - 1 ? `<span>${esc(n.title || 'Untitled')}</span>` : `<a data-go="folder:${n.id}">${esc(n.title || 'Untitled')}</a>`).join('<span class="sep">›</span>');
    } else crumbs = '<span>Med Notebook</span>';
    const n = r.kind !== 'home' ? node(r.id) : null;
    $('#topbar').innerHTML = `
      <button class="iconbtn" id="menuBtn" data-act="drawer" aria-label="Menu">${icon('menu')}</button>
      <div id="crumbs">${crumbs}</div>
      <button class="iconbtn" data-act="search" aria-label="Search">${icon('search')}</button>
      ${n && n.type === 'note' ? `<button class="iconbtn ${n.starred ? 'on' : ''}" data-act="star" aria-label="Mark for review" title="Mark for review">${icon('star')}</button>` : ''}
      ${n ? `<button class="iconbtn" data-act="menu" data-id="${n.id}" aria-label="More">${icon('more')}</button>` : ''}
      <button class="pill" id="pill" data-act="settings" title="Storage and sync"></button>
      ${S.user ? `<button class="avatar" id="userChip" data-act="account" data-sync="${S.sync.state}" style="--pen:${authorColor(S.user.name)}" aria-label="Account: ${esc(S.user.name)}" title="${esc(S.user.name)}">${esc(initial(S.user.name))}</button>` : ''}`;
    $('#topbar').classList.toggle('has-user', !!S.user);
    setSync(S.sync.state);
  }

  // ------------------------------------------------------------------ rendering: views
  function banner() {
    if (S.mode === 'cloud') return '';
    return `<div class="banner"><span><b>Demo mode</b> · saved on this device only</span><button class="btn" data-act="settings">Set up sync</button></div>`;
  }
  const snippet = (n) => esc(MD.plain(n.body).slice(0, 110));
  function noteItem(n, showPath) {
    const p = showPath ? pathOf(n.id).map((x) => x.title || 'Untitled').concat([]).join(' › ') : '';
    const by = n.by ? `<div class="by" style="--pen:${authorColor(n.by)}"><i>${esc(initial(n.by))}</i><span>${whoName(n.by)} · ${ago(n.updatedAt)}</span></div>` : '';
    return `<div class="item note" data-go="note:${n.id}"><span class="ico">${icon('note')}</span><div class="grow"><div class="t">${esc(n.title || 'Untitled note')}</div><div class="s">${esc(p)}${p && n.body ? ' · ' : ''}${snippet(n)}</div>${by}</div>${n.starred ? `<span class="star" style="color:var(--warn)">${icon('star')}</span>` : ''}</div>`;
  }
  function folderItem(n) {
    const c = countNotes(n.id);
    const subs = kids(n.id).filter((k) => k.type === 'folder').length;
    return `<div class="item folder" style="--tab:${colorOf(n)}" data-go="folder:${n.id}"><span class="ico">${icon('folder')}</span><div class="grow"><div class="t">${esc(n.title || 'Untitled folder')}</div><div class="s">${c} note${c === 1 ? '' : 's'}${subs ? ` · ${subs} topic${subs === 1 ? '' : 's'}` : ''}</div></div></div>`;
  }

  function homeView() {
    const roots = kids(null);
    const courses = roots.filter((n) => n.type === 'folder');
    const loose = roots.filter((n) => n.type === 'note');
    const recent = liveNodes().filter((n) => n.type === 'note').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
    const starred = liveNodes().filter((n) => n.type === 'note' && n.starred).sort((a, b) => b.updatedAt - a.updatedAt);
    const h = new Date().getHours();
    const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
    return `${banner()}<div class="page">
      <div class="hello">Good ${part}${me() ? ', ' + esc(firstName(me())) : ''}!</div>
      <p class="sub">${liveNodes().filter((n) => n.type === 'note').length} notes in your notebook. Pick up where you left off.</p>
      <button class="ai-card" data-act="study"><span class="ai-ico">${icon('spark')}</span><span class="ai-txt"><b>Study with AI</b><small>Copy a ready-made prompt for your AI chat, then paste its summary back here as a note.</small></span>${icon('chev')}</button>
      ${recent.length ? `<div class="h-sec">Continue <small>recently edited</small></div><div class="list">${recent.map((n) => noteItem(n, true)).join('')}</div>` : ''}
      ${starred.length ? `<div class="h-sec">${icon('star')} Marked for review</div><div class="list">${starred.map((n) => noteItem(n, true)).join('')}</div>` : ''}
      <div class="h-sec">Courses</div>
      <div class="covers">
        ${courses.map((c) => `<div class="cover" style="--c:${colorOf(c)}" data-go="folder:${c.id}"><div class="lbl">${esc(c.title || 'Untitled')}</div><div class="cnt">${countNotes(c.id)} notes</div></div>`).join('')}
        <div class="cover add" data-act="newCourse"><div class="lbl">+ New course</div></div>
      </div>
      ${loose.length ? `<div class="h-sec">Loose notes</div><div class="list">${loose.map((n) => noteItem(n, false)).join('')}</div>` : ''}
    </div>`;
  }

  function folderView(f) {
    const ch = kids(f.id);
    const subs = ch.filter((k) => k.type === 'folder');
    const notes = ch.filter((k) => k.type === 'note');
    return `${banner()}<div class="page">
      <textarea class="title-input" id="ftitle" rows="1" placeholder="Folder name" style="color:${colorOf(f)}">${esc(f.title)}</textarea>
      <p class="sub">${countNotes(f.id)} notes inside</p>
      <div class="btn-row">
        <button class="btn primary" data-act="newNote" data-parent="${f.id}">${icon('plus')} New note</button>
        <button class="btn" data-act="newFolder" data-parent="${f.id}">${icon('folder')} New topic</button>
        <button class="btn" data-act="chatNew" data-parent="${f.id}">${icon('chat')} Add conversation</button>
        <button class="btn" data-act="study" data-parent="${f.id}">${icon('spark')} Study with AI</button>
      </div>
      ${subs.length ? `<div class="h-sec">Topics</div><div class="list">${subs.map(folderItem).join('')}</div>` : ''}
      ${notes.length ? `<div class="h-sec">Notes</div><div class="list">${notes.map((n) => noteItem(n, false)).join('')}</div>` : ''}
      ${!ch.length ? `<div class="empty">This folder is empty.<br>Add a note, or a topic to group related notes (like “Vitamins” and “Minerals” under “Micronutrients”).</div>` : ''}
    </div>`;
  }

  // pictures and conversations come first: they are the buttons used most, and phones only show the first few
  const TOOLS = [
    ['ai', icon('spark'), 'Paste an AI summary'], ['image', icon('image'), 'Add picture'], ['chat', icon('chat'), 'Add conversation'],
    ['|'], ['bold', '<b>B</b>', 'Bold'], ['italic', '<i>I</i>', 'Italic'], ['hl', '<span>Hi</span>', 'Highlight', 'hi'], ['head', 'H', 'Heading'],
    ['|'], ['ul', '•', 'Bullet list'], ['task', '☑', 'Checklist'], ['quote', '❝', 'Quote'], ['table', '▦', 'Table'], ['callout', '!', 'Key-point box'], ['wiki', '[[ ]]', 'Link to a note'],
  ];
  const toolbarHtml = () => `<div class="toolbar" role="toolbar">${TOOLS.map((t) => t[0] === '|' ? '<span class="gap"></span>' :
    `<button class="tb ${t[3] || ''}" data-tb="${t[0]}" title="${t[2]}" aria-label="${t[2]}">${t[1]}</button>`).join('')}</div>`;

  function mdCtx() { return { imageUrl, me: myName() }; }
  // "Saved by Ada (you) · 2 min ago · started by Bob"
  function bylineHtml(n) {
    const who = (x) => `<b class="who" style="--pen:${authorColor(x)}">${whoName(x)}</b>`;
    const last = n.by || n.createdBy;
    if (!last) return '';
    let h = `✍ Saved by ${who(last)} · ${ago(n.updatedAt)}`;
    if (n.createdBy && n.by && n.createdBy !== n.by) h += ` · started by ${who(n.createdBy)}`;
    return h;
  }
  function noteView(n) {
    const path = pathOf(n.id);
    const crumb = path.map((p) => `<a data-go="folder:${p.id}">${esc(p.title || 'Untitled')}</a>`).join(' › ') || '&nbsp;';
    const wide = window.innerWidth >= 900;
    const edit = S.edit === 'split' && !wide ? 'write' : S.edit;
    const body = edit === 'read'
      ? `<div class="md" id="md">${n.body.trim() ? MD.render(n.body, mdCtx()) : '<p style="color:var(--muted)">This page is empty. Tap <b>Write</b> to start.</p>'}</div>`
      : `<div class="editor-wrap ${edit === 'split' ? 'split' : ''}"><textarea class="editor" id="ta" spellcheck="true" placeholder="Write in your own words…"></textarea>${edit === 'split' ? '<div class="md" id="md"></div>' : ''}</div>`;
    const authored = !!(n.by || n.createdBy);
    return `${banner()}
      <article class="sheet" style="--tab:${colorOf(n)}">
        <div class="crumb-line">${crumb}</div>
        <textarea class="title-input" id="title" rows="1" placeholder="Untitled note">${esc(n.title)}</textarea>
        <div class="meta-line">
          <span class="seg"><button data-act="setEdit" data-mode="read" class="${edit === 'read' ? 'on' : ''}">Read</button><button data-act="setEdit" data-mode="write" class="${edit === 'write' ? 'on' : ''}">Write</button><button class="split-btn ${edit === 'split' ? 'on' : ''}" data-act="setEdit" data-mode="split">Split</button></span>
          <span id="wc">${words(n.body)} words${authored ? '' : ' · ' + ago(n.updatedAt)}</span>
        </div>
        <div class="byline" id="byline" ${authored ? '' : 'hidden'}>${bylineHtml(n)}</div>
        ${body}
      </article>`;
  }

  function renderView() {
    const v = $('#view');
    const r = S.route;
    const n = r.kind !== 'home' ? node(r.id) : null;
    if (r.kind === 'note' && n) v.innerHTML = noteView(n);
    else if (r.kind === 'folder' && n) v.innerHTML = folderView(n);
    else v.innerHTML = homeView();
    fitTitles();
    $('#fab').hidden = r.kind === 'note' && S.edit !== 'read';
    // the writing toolbar sits in the dock: along the bottom on phones (right above the keyboard), on top on wide screens
    const dock = $('#dock');
    const writing = r.kind === 'note' && !!n && S.edit !== 'read';
    dock.hidden = !writing;
    document.body.classList.toggle('writing', writing);
    dock.innerHTML = writing ? toolbarHtml() : '';
    if (r.kind === 'note' && n) {
      const ta = $('#ta');
      if (ta) {
        ta.value = n.body;
        fitEditor(ta);
        if (S.focusEditor) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
        const pv = $('.editor-wrap.split #md');
        if (pv) pv.innerHTML = MD.render(n.body, mdCtx());
      }
      S.focusEditor = false;
      afterMdRender();
    }
  }
  // Titles can be long: let them wrap, in whole 64px steps so the ruled lines below still line up.
  function fitTitle(el) {
    if (!el) return;
    el.style.height = '0px';
    el.style.height = Math.max(64, Math.ceil(el.scrollHeight / 64) * 64) + 'px';
  }
  const fitTitles = () => document.querySelectorAll('.title-input').forEach(fitTitle);
  // The writing box grows with the text, so the page scrolls instead of a box scrolling inside a page (awkward on a phone).
  function fitEditor(ta) {
    if (!ta || ta.closest('.split')) return; // side-by-side mode keeps its own scrolling boxes
    const sc = $('#scroll');
    const top = sc.scrollTop;
    ta.style.height = '0px';
    const min = Math.max(256, Math.round(sc.clientHeight * 0.45));
    ta.style.height = Math.max(ta.scrollHeight + 32, min) + 'px';
    sc.scrollTop = top;
  }
  window.addEventListener('resize', () => { fitTitles(); fitEditor($('#ta')); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitTitles(); fitEditor($('#ta')); snapBlocks(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('title-input')) {
      e.preventDefault();
      const ta = $('#ta');
      if (ta) ta.focus(); else e.target.blur();
    }
  });

  function afterMdRender() {
    const md = $('#md');
    if (!md) return;
    hydrateImages(md).then(() => snapBlocks());
    snapBlocks();
  }
  // Round the height of cards (tables, chats, pictures…) up to whole ruled lines so the text after them stays on the lines.
  function snapBlocks() {
    const md = $('#md');
    if (!md) return;
    const els = [...md.querySelectorAll(':scope > .snap')];
    els.forEach((el) => { el.style.marginBottom = ''; });
    els.forEach((el) => {
      const h = el.getBoundingClientRect().height;
      const rem = h % 32;
      el.style.marginBottom = ((rem ? 32 - rem : 0) + 32) + 'px';
    });
  }
  let snapT = null;
  window.addEventListener('resize', () => { clearTimeout(snapT); snapT = setTimeout(snapBlocks, 120); });
  document.addEventListener('load', (e) => { if (e.target.tagName === 'IMG') { clearTimeout(snapT); snapT = setTimeout(snapBlocks, 60); } }, true);
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || !img.dataset.img || img.dataset.tried) return;
    img.dataset.tried = '1';
    imgGet(img.dataset.img).then((rec) => { if (rec) { const u = URL.createObjectURL(rec.blob); S.imgUrls.set(img.dataset.img, u); img.src = u; } });
  }, true);

  function setDrawer(v) { S.drawer = v; document.body.classList.toggle('drawer', v); $('#scrim').hidden = !v; }
  function renderAll() { renderTree(); renderWhoami(); renderTopbar(); renderView(); document.body.classList.toggle('drawer', S.drawer); $('#scrim').hidden = !S.drawer; }

  // ------------------------------------------------------------------ editor actions
  function fire(ta) { ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); }
  function wrapSel(ta, a, b, ph) {
    const s = ta.selectionStart; const e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || ph;
    ta.setRangeText(a + sel + b, s, e, 'end');
    ta.selectionStart = s + a.length; ta.selectionEnd = s + a.length + sel.length;
    fire(ta);
  }
  function prefixLines(ta, prefix, replaceRe) {
    const v = ta.value;
    const s = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    let e = v.indexOf('\n', ta.selectionEnd);
    if (e < 0) e = v.length;
    const block = v.slice(s, e).split('\n').map((l) => prefix + (replaceRe ? l.replace(replaceRe, '') : l)).join('\n');
    ta.setRangeText(block, s, e, 'end');
    fire(ta);
  }
  function insertBlock(ta, text) {
    const s = ta.selectionStart;
    const before = ta.value.slice(0, s);
    const lead = !before ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    ta.setRangeText(lead + text + '\n\n', s, ta.selectionEnd, 'end');
    fire(ta);
  }
  async function toolbarAction(act) {
    const ta = $('#ta');
    if (!ta) return;
    if (act === 'bold') wrapSel(ta, '**', '**', 'bold text');
    else if (act === 'italic') wrapSel(ta, '*', '*', 'italic');
    else if (act === 'hl') wrapSel(ta, '==', '==', 'important');
    else if (act === 'head') prefixLines(ta, '## ', /^#{1,4}\s+/);
    else if (act === 'ul') prefixLines(ta, '- ', /^[-*+]\s+/);
    else if (act === 'task') prefixLines(ta, '- [ ] ', /^[-*+]\s+(\[[ xX]\]\s+)?/);
    else if (act === 'quote') prefixLines(ta, '> ', /^>\s?/);
    else if (act === 'table') insertBlock(ta, '| Term | Meaning |\n|---|---|\n|  |  |\n|  |  |');
    else if (act === 'callout') insertBlock(ta, '> [!KEY] Key point\n> Write the one thing to remember');
    else if (act === 'wiki') wrapSel(ta, '[[', ']]', 'Note title');
    else if (act === 'image') {
      const files = await pickFiles('image/*', true);
      if (files.length) await insertImages(files);
    } else if (act === 'chat') chatDialog({ mode: 'insert' });
    else if (act === 'ai') studyDialog({ tab: 'paste', insert: true });
  }
  async function insertImages(files) {
    const ta = $('#ta');
    if (!ta) return;
    toast('Adding picture…');
    const ids = await addImages(files);
    if (!ids.length) return;
    insertBlock(ta, ids.map((id) => `![](img:${id})`).join('\n\n'));
    toast(ids.length > 1 ? ids.length + ' pictures added' : 'Picture added. Put a caption inside the [ ] if you like');
  }

  // ------------------------------------------------------------------ dialogs
  function normalizeChat(text) {
    const me = myName();
    return text.replace(/\r\n?/g, '\n').replace(/^(\s*(?:\*\*|__)?)(you|me|user|human)(?: said)?(\s*(?:\*\*|__)?:)/gim, (m, a, w, c) => a + me + c);
  }
  function wrapChat(text) {
    let f = '```';
    while (text.includes(f)) f += '`';
    return f + 'chat\n' + text.trim() + '\n' + f;
  }
  function chatDialog({ mode, parent = null }) {
    const isNew = mode === 'new';
    const me = myName();
    openModal(`<h3>Add a conversation</h3>
      <p class="hint">Paste a chat from Claude, ChatGPT or anywhere. Each line that starts with a name and a colon, like <b>${esc(me)}:</b> or <b>Claude:</b>, starts a new speech bubble. It works with 3 or more people too.</p>
      ${isNew ? '<label class="f">Title of the new note</label><input type="text" id="ct" placeholder="e.g. Why vitamin D needs fat">' : ''}
      <label class="f">Conversation</label>
      <textarea id="cx" placeholder="${esc(me)}: What is ...?\nClaude: It is ..."></textarea>
      <div class="preview md" id="cp"></div>
      <div class="actions">
        <button class="btn" data-m="blank">Blank template</button>
        <button class="btn" data-m="cancel">Cancel</button>
        <button class="btn primary" data-m="ok">${isNew ? 'Save as note' : 'Insert'}</button>
      </div>`, {
      wide: true,
      onMount: (el) => {
        const cx = el.querySelector('#cx');
        const cp = el.querySelector('#cp');
        const upd = () => {
          const t = normalizeChat(cx.value);
          const parsed = MD.parseChat(t);
          cp.innerHTML = t.trim() ? MD.render(wrapChat(t), {}) : '';
          cp.style.display = t.trim() && parsed.speakers.length ? '' : 'none';
        };
        cx.addEventListener('input', upd);
        cx.focus();
        el.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-m]');
          if (!b) return;
          if (b.dataset.m === 'cancel') { closeModal(); return; }
          const text = b.dataset.m === 'blank' ? `${me}: \nClaude: ` : normalizeChat(cx.value);
          if (!text.trim()) { cx.focus(); return; }
          const block = wrapChat(text);
          if (isNew) {
            const n = createNode('note', parent, (el.querySelector('#ct').value || '').trim() || 'Conversation', { body: block + '\n' });
            closeModal();
            S.nextEdit = b.dataset.m === 'blank' ? 'write' : 'read';
            go('note', n.id);
          } else {
            const ta = $('#ta');
            closeModal();
            if (ta) { insertBlock(ta, block); }
          }
        });
      },
    });
  }

  function searchDialog() {
    openModal(`<h3>Search</h3><input type="text" id="sq" placeholder="Search titles and notes…" autocomplete="off"><div class="list" id="sr" style="margin-top:12px"></div>`, {
      wide: true,
      onMount: (el) => {
        const q = el.querySelector('#sq');
        const out = el.querySelector('#sr');
        q.focus();
        const run = () => {
          const terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
          if (!terms.length) { out.innerHTML = '<div class="empty" style="padding:18px">Type to search every note.</div>'; return; }
          const hits = [];
          for (const n of liveNodes()) {
            const title = (n.title || '').toLowerCase();
            const text = n.type === 'note' ? MD.plain(n.body) : '';
            const low = text.toLowerCase();
            if (!terms.every((t) => title.includes(t) || low.includes(t))) continue;
            const score = terms.reduce((s, t) => s + (title.includes(t) ? 5 : 0) + (low.includes(t) ? 1 : 0), 0) + (n.type === 'folder' ? 0.5 : 0);
            const i = low.indexOf(terms.find((t) => low.includes(t)) || '\u0000');
            const snip = i >= 0 ? (i > 40 ? '…' : '') + text.slice(Math.max(0, i - 40), i + 90) : text.slice(0, 100);
            hits.push({ n, score, snip });
          }
          hits.sort((a, b) => b.score - a.score);
          out.innerHTML = hits.length ? hits.slice(0, 40).map(({ n, snip }) => `<div class="item ${n.type}" style="--tab:${colorOf(n)}" data-hit="${n.type}:${n.id}"><span class="ico">${icon(n.type === 'folder' ? 'folder' : 'note')}</span><div class="grow"><div class="t">${esc(n.title || 'Untitled')}</div><div class="s">${esc(pathOf(n.id).map((x) => x.title).join(' › '))}${snip ? ' · ' + esc(snip) : ''}</div></div></div>`).join('')
            : '<div class="empty" style="padding:18px">Nothing found.</div>';
        };
        q.addEventListener('input', run);
        run();
        el.addEventListener('click', (ev) => {
          const h = ev.target.closest('[data-hit]');
          if (!h) return;
          const [k, id] = h.dataset.hit.split(':');
          closeModal();
          go(k, id);
        });
      },
    });
  }

  function colorDialog(id) {
    const n = node(id);
    if (!n) return;
    openModal(`<h3>Cover colour</h3><p class="hint">Sub-topics use their course's colour.</p><div class="swatches">${PALETTE.map((c) => `<button style="background:${c}" data-c="${c}" class="${colorOf(n) === c ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div><div class="actions"><button class="btn" data-m="cancel">Close</button></div>`, {
      onMount: (el) => el.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-c]');
        if (b) { n.color = b.dataset.c; touch(n); renderAll(); closeModal(); }
        else if (ev.target.closest('[data-m]')) closeModal();
      }),
    });
  }

  function nodeMenu(id) {
    const n = node(id);
    if (!n) return;
    const isF = n.type === 'folder';
    const isCourse = isF && !(n.parentId && node(n.parentId));
    const items = [];
    if (isF) {
      items.push({ label: 'New note here', icon: 'plus', fn: () => newNote(n.id) });
      items.push({ label: 'New topic (folder) here', icon: 'folder', fn: () => newFolder(n.id) });
      items.push({ label: 'Add a conversation here', icon: 'chat', fn: () => chatDialog({ mode: 'new', parent: n.id }) });
      items.push({ hr: true });
    } else {
      items.push({ label: n.starred ? 'Remove review mark' : 'Mark for review', icon: 'star', fn: () => toggleStar(n.id) });
    }
    items.push({ label: 'Rename', icon: 'edit', fn: async () => { const t = await askText({ title: 'Rename', value: n.title, placeholder: 'Name' }); if (t !== null) { n.title = t; touch(n, true); renderAll(); } } });
    if (isCourse) items.push({ label: 'Change colour', icon: 'palette', fn: () => colorDialog(n.id) });
    items.push({ label: 'Move to…', icon: 'move', fn: async () => { const ex = new Set([n.id, ...descendants(n.id).map((d) => d.id)]); const r = await pickFolder({ title: 'Move “' + (n.title || 'Untitled') + '” to', exclude: ex }); if (r) moveNode(n.id, r.id); } });
    items.push({ label: 'Move up', icon: 'up', fn: () => reorder(n.id, -1) });
    items.push({ label: 'Move down', icon: 'down', fn: () => reorder(n.id, 1) });
    if (!isF) items.push({ label: 'Export as .md file', icon: 'download', fn: () => download(safeName(n.title) + '.md', n.body, 'text/markdown') });
    items.push({ hr: true });
    items.push({ label: 'Delete', icon: 'trash', danger: true, fn: async () => {
      if (isF && descendants(n.id).length) {
        const ok = await confirmBox({ title: 'Delete “' + (n.title || 'Untitled') + '”?', hint: `This also deletes everything inside it (${countNotes(n.id)} notes). You can undo right after.`, ok: 'Delete', danger: true });
        if (!ok) return;
      }
      deleteNode(n.id);
    } });
    actionSheet(n.title || (isF ? 'Untitled folder' : 'Untitled note'), items);
  }

  function toggleStar(id) {
    const n = node(id);
    if (!n || n.type !== 'note') return;
    if (n.starred) delete n.starred; else n.starred = true;
    touch(n);
    renderAll();
    toast(n.starred ? 'Marked for review ★' : 'Review mark removed');
  }
  function newNote(parent) {
    const n = createNode('note', parent || null, '');
    S.nextEdit = 'write'; S.focusEditor = false;
    go('note', n.id);
    const t = $('#title'); // focus straight away (a delayed focus would steal the cursor from anyone already typing)
    if (t) t.focus();
  }
  async function newFolder(parent) {
    const isCourse = !parent;
    const t = await askText({ title: isCourse ? 'New course' : 'New topic', hint: isCourse ? 'For example: Physiology, Histology, Gross Anatomy.' : 'A group inside this folder, like “Vitamins”.', placeholder: isCourse ? 'Course name' : 'Topic name', ok: 'Create' });
    if (!t) return;
    const f = createNode('folder', parent || null, t);
    go('folder', f.id);
  }
  function contextParent() {
    const r = S.route;
    if (r.kind === 'folder') return r.id;
    if (r.kind === 'note') { const n = node(r.id); return n && n.parentId && node(n.parentId) ? n.parentId : null; }
    return null;
  }
  function fabMenu() {
    const p = contextParent();
    const where = p ? '“' + (node(p).title || 'Untitled') + '”' : 'the top level';
    actionSheet('Add', [
      { label: 'New note', sub: 'in ' + where, icon: 'note', fn: () => newNote(p) },
      { label: 'New topic (folder)', sub: p ? 'inside ' + where : 'at the top level', icon: 'folder', fn: () => newFolder(p) },
      { label: 'New course', icon: 'book', fn: () => newFolder(null) },
      { hr: true },
      { label: 'Study with AI', sub: 'Copy a prompt, paste the AI summary back as a note', icon: 'spark', fn: () => studyDialog({}) },
      { label: 'Add a conversation', sub: 'Paste a chat with Claude or others', icon: 'chat', fn: () => chatDialog({ mode: 'new', parent: p }) },
      { label: 'Import .md / .txt files', sub: 'Each file becomes a note', icon: 'upload', fn: () => importFiles(p) },
    ]);
  }
  async function importFiles(parent) {
    const files = await pickFiles('.md,.markdown,.txt,text/markdown,text/plain', true);
    let last = null;
    for (const f of files) {
      let text = await f.text();
      let title = f.name.replace(/\.[^.]+$/, '');
      const m = text.match(/^\s*#\s+(.+)\n/);
      if (m) { title = m[1].trim(); text = text.slice(m[0].length); }
      last = createNode('note', parent, title, { body: text.trim() + '\n' });
    }
    if (last) { toast(files.length + ' note' + (files.length > 1 ? 's' : '') + ' imported'); renderAll(); if (files.length === 1) go('note', last.id); }
  }

  function settingsDialog() {
    const st = S.settings;
    const notes = liveNodes().filter((n) => n.type === 'note').length;
    const folders = liveNodes().filter((n) => n.type === 'folder').length;
    const seg = (key, opts) => `<span class="seg">${opts.map(([v, l]) => `<button data-set="${key}:${v}" class="${(st[key] || '') === v ? 'on' : ''}">${l}</button>`).join('')}</span>`;
    const cloud = S.mode === 'cloud';
    openModal(`<h3>Settings</h3>
      <dl class="kv">
        ${S.user ? `<dt>Signed in</dt><dd>${esc(S.user.name)}${S.user.admin ? ' (admin)' : ''}</dd>` : ''}
        <dt>Storage</dt><dd>${cloud ? 'Cloudflare R2 (synced)' : 'This device only (demo mode)'}</dd>
        <dt>Contents</dt><dd>${notes} notes · ${folders} folders</dd>
        ${cloud ? `<dt>Status</dt><dd>${esc({ ok: 'Up to date', busy: 'Syncing…', offline: 'Offline, will sync later', bad: 'Problem: ' + S.sync.error, local: '' }[S.sync.state] || '')}${S.sync.last ? ' · ' + ago(S.sync.last) : ''}</dd>` : ''}
        ${!cloud && S.cloudProblem ? `<dt>Cloud sync</dt><dd>Not on yet. ${esc(S.cloudProblem)}. Check the R2 binding and NOTEBOOK_PASSWORD in your Cloudflare Pages project, then redeploy.</dd>` : ''}
        ${!cloud && !S.cloudProblem ? `<dt>Cloud sync</dt><dd>Not available here. It switches on when this app is deployed with the R2 variables set.</dd>` : ''}
      </dl>
      <div class="opt">Theme ${seg('theme', [['', 'Auto'], ['light', 'Light'], ['dark', 'Night']])}</div>
      <div class="opt">Text ${seg('font', [['', 'Handwriting'], ['clean', 'Clean']])}</div>
      <div class="opt">Size ${seg('size', [['s', 'S'], ['', 'M'], ['l', 'L']])}</div>
      ${S.user ? '' : `<label class="f">My name in conversations</label>
      <input type="text" id="myname" value="${esc(st.myName || 'Excel')}">`}
      <div class="btn-row" style="margin-top:16px">
        ${cloud ? `<button class="btn" data-m="sync">${icon('refresh')} Sync now</button>` : ''}
        <button class="btn" data-m="backup">${icon('download')} Backup</button>
        <button class="btn" data-m="restore">${icon('upload')} Restore</button>
        <button class="btn" data-m="import">${icon('upload')} Import .md</button>
        ${S.user ? `<button class="btn" data-m="password">${icon('key')} Change password</button>` : ''}
        ${S.user && S.user.admin ? `<button class="btn" data-m="people">${icon('users')} People</button>` : ''}
        ${cloud ? `<button class="btn danger" data-m="logout">${icon('logout')} Sign out</button>` : ''}
      </div>
      <div class="actions"><button class="btn primary" data-m="close">Done</button></div>`, {
      onMount: (el) => {
        el.addEventListener('click', async (ev) => {
          const s = ev.target.closest('[data-set]');
          if (s) {
            const [k, v] = s.dataset.set.split(':');
            st[k] = v; applySettings(); saveSettings();
            s.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === s));
            if (k === 'size') snapBlocks();
            return;
          }
          const b = ev.target.closest('[data-m]');
          if (!b) return;
          const m = b.dataset.m;
          if (m === 'close') closeModal();
          else if (m === 'sync') { closeModal(); sync(true); }
          else if (m === 'backup') backup();
          else if (m === 'restore') { closeModal(); restore(); }
          else if (m === 'import') { closeModal(); importFiles(contextParent()); }
          else if (m === 'password') { closeModal(); passwordDialog(); }
          else if (m === 'people') { closeModal(); membersDialog(); }
          else if (m === 'logout') { closeModal(); signOut(); }
        });
        const mn = el.querySelector('#myname');
        if (mn) mn.addEventListener('input', (ev) => { st.myName = ev.target.value.trim() || 'Excel'; saveSettings(); });
      },
    });
  }
  function backup() {
    const data = { app: 'anatomy-notebook', v: 1, exportedAt: new Date().toISOString(), nodes: S.doc.nodes };
    download('med-notebook-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(data, null, 1), 'application/json');
    toast('Backup downloaded (notes only; pictures stay in your R2 bucket)');
  }
  async function restore() {
    const [f] = await pickFiles('.json,application/json', false);
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || !data.nodes) throw new Error('not a backup');
      const ok = await confirmBox({ title: 'Restore this backup?', hint: `It contains ${Object.values(data.nodes).filter((n) => !n.deleted).length} items. They will be added back, replacing same-named items that you changed since.`, ok: 'Restore' });
      if (!ok) return;
      const t = now();
      for (const n of Object.values(data.nodes)) { n.updatedAt = t; S.dirty.add(n.id); }
      S.doc.nodes = MG.merge(S.doc.nodes, data.nodes).nodes;
      ver++; scheduleSave(); renderAll(); toast('Backup restored');
    } catch { toast('That file is not a notebook backup'); }
  }

  // ------------------------------------------------------------------ sign in / join (cloud mode)
  function showLock(msg, startTab) {
    const lock = $('#lock');
    lock.hidden = false;
    let tab = startTab || (S.setup ? 'join' : 'in');
    let note = msg || '';
    let lastName = '';
    try { lastName = localStorage.getItem('nb-lastname') || ''; } catch { /* ignore */ }
    const draw = (keep) => {
      const join = tab === 'join';
      const lead = note || (join
        ? (S.setup ? 'Nobody has joined yet. Create the first account. You will be the admin.' : 'Create your own account to join this notebook.')
        : 'Sign in with your name and password.');
      lock.innerHTML = `<form class="card" id="lockForm" autocomplete="on">
        <img src="icon.svg" width="64" height="64" alt="" style="border-radius:16px">
        <h2>Med Notebook</h2>
        <p>${esc(lead)}</p>
        <div class="seg wide"><button type="button" data-tab="in" class="${join ? '' : 'on'}">Sign in</button><button type="button" data-tab="join" class="${join ? 'on' : ''}">Join</button></div>
        <label class="f" for="lname">Your name</label>
        <input type="text" id="lname" name="username" autocomplete="username" autocapitalize="words" autocorrect="off" spellcheck="false" maxlength="24" enterkeyhint="next" placeholder="e.g. Ada" value="${esc(keep ? keep.name : lastName)}">
        <label class="f" for="pw">Password</label>
        <div class="pwwrap"><input type="password" id="pw" name="password" autocomplete="${join ? 'new-password' : 'current-password'}" enterkeyhint="${join ? 'next' : 'go'}" placeholder="${join ? 'At least 6 characters' : 'Your password'}" value="${esc(keep ? keep.pw : '')}"><button type="button" class="iconbtn" id="showpw" aria-label="Show password">${icon('eye')}</button></div>
        ${join ? `<label class="f" for="code">Access code <small>from whoever runs this notebook</small></label>
        <input type="password" id="code" name="code" autocomplete="off" enterkeyhint="go" placeholder="Access code" value="${esc(keep ? keep.code : '')}">` : ''}
        <button class="btn primary" type="submit">${join ? 'Create account' : 'Sign in'}</button>
        <div class="err" id="lockErr" role="alert"></div>
      </form>`;
      const form = $('#lockForm');
      const first = join && !lastName ? '#lname' : (lastName || (keep && keep.name) ? '#pw' : '#lname');
      setTimeout(() => { const f = $(first); if (f) f.focus(); }, 50);
      form.addEventListener('click', (ev) => {
        const t = ev.target.closest('[data-tab]');
        if (t && t.dataset.tab !== tab) {
          const keepNow = { name: $('#lname').value, pw: $('#pw').value, code: ($('#code') || {}).value || '' };
          tab = t.dataset.tab; note = ''; draw(keepNow); return;
        }
        if (ev.target.closest('#showpw')) {
          const p = $('#pw'); p.type = p.type === 'password' ? 'text' : 'password';
        }
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type=submit]');
        const err = $('#lockErr');
        const name = $('#lname').value.trim();
        const password = $('#pw').value;
        if (!name) { err.textContent = 'Type your name first.'; $('#lname').focus(); return; }
        if (!password) { err.textContent = 'Type your password.'; $('#pw').focus(); return; }
        btn.disabled = true; err.textContent = '';
        try {
          const res = await api(join ? '/api/register' : '/api/login', join ? { name, password, code: ($('#code') || {}).value || '' } : { name, password });
          S.authed = true; S.user = res.user; S.setup = false;
          try { localStorage.setItem('nb-lastname', res.user.name); } catch { /* ignore */ }
          await kvSet('user', S.user);
          lock.hidden = true; lock.innerHTML = '';
          S.fullPush = true;
          renderAll();
          await sync();
          await maybeSeed();
          renderAll();
          toast('Signed in as ' + S.user.name);
        } catch (er) {
          err.textContent = er.status === 401 ? 'Wrong name or password. Try again.' : (er.message || 'Could not sign in.');
          btn.disabled = false;
        }
      });
    };
    draw();
  }

  async function signOut() {
    if (S.mode === 'cloud' && S.authed && S.dirty.size) await sync();
    if (S.dirty.size && !(await confirmBox({ title: 'Unsaved changes', hint: 'Some of your edits have not reached the cloud yet (you may be offline). If you sign out now, they will be saved under the name of whoever signs in next on this device.', ok: 'Sign out anyway', danger: true }))) return;
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    try { await caches.delete('nb-img'); } catch { /* ignore */ }
    S.authed = false; S.user = null; S.fullPush = true;
    try { await kvSet('user', null); } catch { /* ignore */ }
    renderAll();
    showLock('You are signed out.');
  }

  function accountSheet() {
    if (!S.user) { settingsDialog(); return; }
    actionSheet('Signed in as ' + S.user.name, [
      ...(S.mode === 'cloud' ? [{ label: 'Sync now', icon: 'refresh', fn: () => sync(true) }] : []),
      { label: 'Study with AI', sub: 'Copy a prompt, paste the summary back', icon: 'spark', fn: () => studyDialog({}) },
      { label: 'Change my password', icon: 'key', fn: passwordDialog },
      ...(S.user.admin ? [{ label: 'People', sub: 'Reset passwords, remove accounts', icon: 'users', fn: membersDialog }] : []),
      { label: 'Settings', icon: 'sliders', fn: settingsDialog },
      { hr: true },
      { label: 'Sign out', icon: 'logout', danger: true, fn: signOut },
    ]);
  }

  function passwordDialog() {
    openModal(`<h3>Change password</h3><p class="hint">You stay signed in on this device. Your other devices will ask you to sign in again.</p>
      <label class="f" for="pw0">Current password</label><input type="password" id="pw0" autocomplete="current-password">
      <label class="f" for="pw1">New password</label><input type="password" id="pw1" autocomplete="new-password" placeholder="At least 6 characters">
      <label class="f" for="pw2">New password again</label><input type="password" id="pw2" autocomplete="new-password">
      <div class="err" id="pwErr" role="alert"></div>
      <div class="actions"><button class="btn" data-m="cancel">Cancel</button><button class="btn primary" data-m="ok">Change password</button></div>`, {
      onMount: (el) => {
        const err = el.querySelector('#pwErr');
        el.addEventListener('click', async (ev) => {
          const b = ev.target.closest('[data-m]');
          if (!b) return;
          if (b.dataset.m === 'cancel') { closeModal(); return; }
          const [p0, p1, p2] = ['#pw0', '#pw1', '#pw2'].map((q) => el.querySelector(q).value);
          if (p1 !== p2) { err.textContent = 'The two new passwords are different.'; return; }
          b.disabled = true; err.textContent = '';
          try { await api('/api/account', { action: 'password', old: p0, password: p1 }); closeModal(); toast('Password changed ✓'); }
          catch (e) { err.textContent = e.message; b.disabled = false; }
        });
      },
    });
  }

  async function membersDialog() {
    const el = openModal('<h3>People</h3><p class="hint">Loading…</p>');
    const closeBtn = '<div class="actions"><button class="btn primary" data-m="close">Done</button></div>';
    const draw = (users) => {
      el.innerHTML = `<h3>People</h3>
        <p class="hint">Everyone here can read and write in the notebook, and every note shows who saved it. New people join with the access code (the NOTEBOOK_PASSWORD you set on Cloudflare).</p>
        <div class="people">${users.map((u) => `<div class="person"><span class="avatar" style="--pen:${authorColor(u.name)}">${esc(initial(u.name))}</span><span class="pname"><b>${esc(u.name)}</b>${u.admin ? '<small>Admin</small>' : ''}</span>${u.name === me() ? '<small class="you">You</small>' : `<button class="btn sm" data-reset="${esc(u.name)}" aria-label="Reset password for ${esc(u.name)}">Reset</button><button class="btn sm danger" data-remove="${esc(u.name)}">Remove</button>`}</div>`).join('')}</div>${closeBtn}`;
    };
    el.addEventListener('click', async (ev) => {
      if (ev.target.closest('[data-m="close"]')) { closeModal(); return; }
      const rs = ev.target.closest('[data-reset]');
      const rm = ev.target.closest('[data-remove]');
      if (rs) {
        const name = rs.dataset.reset;
        const pw = await askText({ title: 'New password for ' + name, hint: 'At least 6 characters. Tell them this password. They can change it after they sign in.', ok: 'Reset', placeholder: 'New password' });
        if (pw) { try { await api('/api/account', { action: 'reset', name, password: pw }); toast('Password reset for ' + name); } catch (e) { toast(e.message); } }
        membersDialog();
      } else if (rm) {
        const name = rm.dataset.remove;
        const ok = await confirmBox({ title: 'Remove ' + name + '?', hint: 'They will be signed out and cannot sign in again. Their notes stay in the notebook, still marked with their name.', ok: 'Remove', danger: true });
        if (ok) { try { await api('/api/account', { action: 'remove', name }); toast(name + ' removed'); } catch (e) { toast(e.message); } }
        membersDialog();
      }
    });
    try { draw((await api('/api/account', { action: 'list' })).users); }
    catch (e) { el.innerHTML = `<h3>People</h3><p class="hint">${esc(e.message)}</p>${closeBtn}`; }
  }

  // ------------------------------------------------------------------ study with AI (copy a prompt, paste the reply back)
  async function copyText(text, fromEl) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
    try {
      const t = fromEl || Object.assign(document.createElement('textarea'), { value: text });
      if (!fromEl) { t.style.cssText = 'position:fixed;top:0;opacity:0'; document.body.appendChild(t); }
      t.focus(); t.select(); t.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      if (!fromEl) t.remove();
      return ok;
    } catch { return false; }
  }
  function folderOptions(selected) {
    const out = ['<option value="">Top level (a loose note)</option>'];
    const walk = (pid, depth) => {
      for (const k of kids(pid)) {
        if (k.type !== 'folder') continue;
        out.push(`<option value="${k.id}" ${k.id === selected ? 'selected' : ''}>${' '.repeat(depth)}${esc(k.title || 'Untitled')}</option>`);
        walk(k.id, depth + 1);
      }
    };
    walk(null, 0);
    return out.join('');
  }
  function studyDialog({ tab = 'copy', parent, insert = false } = {}) {
    const NP = window.NBPrompts;
    if (!NP) { toast('The study helper did not load. Reload the page.'); return; }
    const st = S.settings;
    let style = NP.STYLES[st.promptStyle] ? st.promptStyle : NP.DEFAULT_STYLE;
    const target = parent !== undefined ? (parent && node(parent) ? parent : null) : contextParent();
    const inNote = insert && $('#ta') ? S.route.id : null;
    let titleEdited = false;
    const styleBtns = Object.entries(NP.STYLES).map(([k, v]) => `<button type="button" data-style="${k}" class="${k === style ? 'on' : ''}">${esc(v.label)}</button>`).join('');
    openModal(`<h3>Study with AI</h3>
      <div class="seg wide tabs"><button type="button" data-tab="copy">1 · Copy prompt</button><button type="button" data-tab="paste">2 · Paste reply</button></div>
      <div id="paneCopy">
        <p class="hint">Open the AI chat where you were studying (Claude, ChatGPT, Gemini…). Paste this prompt at the end of that chat and send it. The AI will turn the whole chat into one note.</p>
        <label class="f">What kind of note?</label>
        <div class="seg wide" id="styleSeg">${styleBtns}</div>
        <label class="f" for="topic">Topic <small>(optional)</small></label>
        <input type="text" id="topic" placeholder="e.g. Fat-soluble vitamins" maxlength="120" autocomplete="off">
        <label class="f" for="promptText">Your prompt</label>
        <textarea id="promptText" class="promptbox" readonly inputmode="none"></textarea>
        <div class="actions"><button class="btn" data-m="toPaste">Next: paste reply</button><button class="btn primary" data-m="copy">${icon('copy')} Copy prompt</button></div>
      </div>
      <div id="panePaste" hidden>
        <p class="hint">Copy the AI's reply (tap the copy button on its code block), then paste it here. It is saved as a note with your name on it.</p>
        <div class="btn-row"><button class="btn" data-m="clip">${icon('clipboard')} Paste from clipboard</button></div>
        <textarea id="reply" class="replybox" placeholder="The AI's reply goes here…" spellcheck="false"></textarea>
        <div id="replyBox" hidden>
          <label class="f" for="rtitle">Title</label>
          <input type="text" id="rtitle" placeholder="Note title" autocomplete="off">
          <label class="f">How it will look</label>
          <div class="preview md" id="rprev"></div>
        </div>
        <label class="f" for="where">Save in</label>
        <select id="where">${folderOptions(target)}</select>
        <div class="actions">
          <button class="btn" data-m="toCopy">Back</button>
          ${inNote ? '<button class="btn" data-m="insert">Add to this note</button>' : ''}
          <button class="btn primary" data-m="save">Save as new note</button>
        </div>
      </div>`, {
      wide: true,
      onMount: (el) => {
        const $e = (q) => el.querySelector(q);
        const promptEl = $e('#promptText');
        const topic = $e('#topic');
        const reply = $e('#reply');
        const rtitle = $e('#rtitle');
        const copyBtn = $e('[data-m=copy]');
        const copyHtml = copyBtn.innerHTML;
        const build = () => { promptEl.value = NP.buildPrompt({ style, topic: topic.value }); };
        const show = (which) => {
          $e('#paneCopy').hidden = which !== 'copy';
          $e('#panePaste').hidden = which !== 'paste';
          el.querySelectorAll('.tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === which));
        };
        const cleaned = () => { const c = NP.cleanReply(reply.value); return { title: (rtitle.value || '').trim() || c.title || 'AI summary', body: c.body }; };
        const refresh = () => {
          const c = NP.cleanReply(reply.value);
          $e('#replyBox').hidden = !c.body.trim();
          if (!titleEdited) rtitle.value = c.title;
          $e('#rprev').innerHTML = c.body ? MD.render(c.body, mdCtx()) : '';
        };
        build(); show(tab);
        topic.addEventListener('input', build);
        reply.addEventListener('input', refresh);
        rtitle.addEventListener('input', () => { titleEdited = true; });
        el.addEventListener('click', async (ev) => {
          const sb = ev.target.closest('[data-style]');
          if (sb) {
            style = sb.dataset.style; st.promptStyle = style; saveSettings(); build();
            el.querySelectorAll('#styleSeg button').forEach((b) => b.classList.toggle('on', b === sb));
            return;
          }
          const tb = ev.target.closest('.tabs [data-tab]');
          if (tb) { show(tb.dataset.tab); return; }
          const b = ev.target.closest('[data-m]');
          if (!b) return;
          const m = b.dataset.m;
          if (m === 'toPaste') show('paste');
          else if (m === 'toCopy') show('copy');
          else if (m === 'copy') {
            const ok = await copyText(promptEl.value, promptEl);
            if (ok) {
              copyBtn.innerHTML = icon('check') + ' Copied';
              copyBtn.classList.add('done');
              toast('Prompt copied. Paste it into your AI chat.');
              setTimeout(() => { copyBtn.innerHTML = copyHtml; copyBtn.classList.remove('done'); }, 2600);
            } else { promptEl.focus(); promptEl.select(); toast('Press and hold the highlighted text, then tap Copy'); }
          } else if (m === 'clip') {
            try {
              const text = await navigator.clipboard.readText();
              if (!text.trim()) { toast('The clipboard is empty. Copy the AI reply first.'); return; }
              reply.value = text; titleEdited = false; refresh();
            } catch { toast('Your browser did not allow that. Press and hold in the box, then tap Paste.'); reply.focus(); }
          } else if (m === 'save' || m === 'insert') {
            const { title, body } = cleaned();
            if (!body.trim()) { toast('Paste the AI reply first'); reply.focus(); return; }
            if (m === 'insert') {
              const ta = $('#ta');
              closeModal();
              if (ta) { insertBlock(ta, (title ? '## ' + title + '\n\n' : '') + body.trim()); toast('Added to this note'); }
              return;
            }
            const folder = $e('#where').value || null;
            const n = createNode('note', folder, title, { body });
            closeModal();
            S.nextEdit = 'read';
            go('note', n.id);
            toast(me() ? `Saved by ${me()} ✓` : 'Saved ✓');
          }
        });
      },
    });
  }

  // ------------------------------------------------------------------ settings
  function applySettings() {
    const r = document.documentElement;
    const st = S.settings;
    ['theme', 'font', 'size'].forEach((k) => { if (st[k]) r.dataset[k] = st[k]; else delete r.dataset[k]; });
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = getComputedStyle(r).getPropertyValue('--bar').trim() || '#f4eee0';
  }
  function saveSettings() { try { localStorage.setItem('nb-settings', JSON.stringify(S.settings)); } catch { /* ignore */ } }

  // ------------------------------------------------------------------ sample content (first run only)
  const F = '```';
  const SEED = [
    { id: 'seed-physio', type: 'folder', parentId: null, title: 'Physiology', color: '#2457c5', order: 1 },
    { id: 'seed-micro', type: 'folder', parentId: 'seed-physio', title: 'Micronutrients', order: 1 },
    { id: 'seed-vit', type: 'note', parentId: 'seed-micro', title: 'Vitamins', order: 1, body: [
      '## What are vitamins?', 'Vitamins are **organic** compounds the body needs in tiny amounts but cannot make enough of, so they must come from food.', '',
      '## The two families', '| Family | Vitamins | How the body handles them |', '|---|---|---|',
      '| Fat-soluble | A, D, E, K | Absorbed with dietary fat and **stored** in the liver and fat tissue |',
      '| Water-soluble | B-complex, C | Dissolve in water, **not stored much**, the extra leaves in urine |', '',
      '> [!KEY] Why it matters', '> Stored vitamins can build up and cause toxicity. Water-soluble ones need a steady daily supply.', '',
      '> [!MISTAKE]', '> Vitamin B12 is water-soluble but it **is** stored in the liver, for years. It is the exception.', '',
      '## Quick recall', '- Fat-soluble: ==A D E K==', '- Vitamin A: vision and healthy epithelium', '- Vitamin D: helps absorb calcium from the gut',
      '- Vitamin K: needed for clotting factors', '- Vitamin C: needed to build collagen', '- [ ] Review again tomorrow', '',
      'More on how fat-soluble vitamins are absorbed: [[Chat: why fat-soluble vitamins need fat]]'].join('\n') },
    { id: 'seed-min', type: 'note', parentId: 'seed-micro', title: 'Minerals', order: 2, body: [
      '## Two groups', '| Group | Rule of thumb | Examples |', '|---|---|---|',
      '| Macrominerals | Needed in larger amounts (over 100 mg a day) | Calcium, phosphorus, magnesium, sodium, potassium, chloride, sulfur |',
      '| Trace minerals | Needed in tiny amounts (under 100 mg a day) | Iron, zinc, iodine, selenium, copper, fluoride |', '',
      '## Where they work', '- **Calcium**: about 99% is in bones and teeth', '- **Iron**: part of haemoglobin, which carries oxygen',
      '- **Iodine**: needed to make thyroid hormones', '- **Sodium and potassium**: nerve impulses and fluid balance', '',
      '> [!EXAM] Tip', '> Examiners love the question “which mineral is stored mostly in bone?” → ==calcium==.', '',
      'Compare with [[Vitamins]].'].join('\n') },
    { id: 'seed-chat', type: 'note', parentId: 'seed-micro', title: 'Chat: why fat-soluble vitamins need fat', order: 3, body: [
      'Saved from a conversation, so I can review it later.', '', F + 'chat',
      'Excel: Why do fat-soluble vitamins need fat to be absorbed?',
      'Claude: Because they dissolve in fat, not water. In the gut, bile from the liver breaks dietary fat into tiny droplets called micelles, and the vitamins travel inside those droplets to reach the intestinal wall.',
      'Excel: So what happens if someone cannot absorb fat properly?',
      'Claude: They can become short of vitamins A, D, E and K. This can happen when bile is reduced or the gut lining is damaged.', F].join('\n') },
    { id: 'seed-start', type: 'note', parentId: null, title: 'Start here', order: 1, body: [
      '## Welcome to your notebook', 'This is a **sample page**. Delete it whenever you like (⋯ menu → Delete).', '',
      '- Tap **Write** to edit and **Read** to study.', '- ==Highlights== use double equals signs.', '- [ ] Tick boxes in Read mode', '- [x] Open the notebook', '',
      '> [!KEY] Key point', '> Boxes like this are perfect for the one thing you must not forget. Others: DEF, EX, TIP, WARN, EXAM, MISTAKE.', '',
      '### Save a conversation', 'Use the speech-bubble button in the toolbar and paste a chat. Lines that start with a name and a colon become bubbles:', '',
      F + 'chat', 'Excel: What is a tendon?', 'Claude: Tough connective tissue that joins muscle to bone.', 'Dr Ada: And a ligament joins bone to bone.', F, '',
      '### Add pictures', 'Use the picture button, or paste a screenshot straight into the page. Text inside the square brackets becomes the caption.', '',
      '### Link notes', 'Write [[Vitamins]] to link to another note by its title.'].join('\n') },
  ];
  async function maybeSeed() {
    if (await kvGet('seeded')) return;
    if (Object.keys(S.doc.nodes).length) { await kvSet('seeded', true); return; }
    if (S.mode === 'cloud' && !(S.authed && S.sync.last)) return;
    // Only reached when the notebook is completely empty everywhere (including R2), so these cannot overwrite anything.
    const t0 = now();
    SEED.forEach((s, i) => { S.doc.nodes[s.id] = Object.assign({ createdAt: t0, updatedAt: t0 - i * 1000 }, s); });
    ['seed-physio', 'seed-micro'].forEach((id) => S.expanded.add(id));
    saveExpanded();
    ver++;
    await persist();
    await kvSet('seeded', true);
    if (S.mode === 'cloud') { S.fullPush = true; scheduleSync(500); }
    renderAll();
  }

  // ------------------------------------------------------------------ events
  document.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.id === 'scrim') { setDrawer(false); return; }
    const a = t.closest('[data-act]');
    if (a) {
      const act = a.dataset.act;
      const id = a.dataset.id;
      if (act === 'twist') { e.stopPropagation(); if (S.expanded.has(id)) S.expanded.delete(id); else S.expanded.add(id); saveExpanded(); renderTree(); }
      else if (act === 'menu') { e.stopPropagation(); nodeMenu(id); }
      else if (act === 'drawer') setDrawer(!S.drawer);
      else if (act === 'study') studyDialog({ parent: a.dataset.parent });
      else if (act === 'account') accountSheet();
      else if (act === 'home') go('home');
      else if (act === 'search') searchDialog();
      else if (act === 'settings') settingsDialog();
      else if (act === 'newCourse') newFolder(null);
      else if (act === 'newNote') newNote(a.dataset.parent || null);
      else if (act === 'newFolder') newFolder(a.dataset.parent || null);
      else if (act === 'chatNew') chatDialog({ mode: 'new', parent: a.dataset.parent || null });
      else if (act === 'star') toggleStar(S.route.id);
      else if (act === 'setEdit') { S.edit = a.dataset.mode; S.focusEditor = S.edit !== 'read'; renderView(); renderTopbar(); }
      return;
    }
    const tb = t.closest('[data-tb]');
    if (tb) { toolbarAction(tb.dataset.tb); return; }
    const g = t.closest('[data-go]');
    if (g) { const [k, id] = g.dataset.go.split(':'); go(k, id); return; }
    const row = t.closest('.row[data-id]');
    if (row) {
      const n = node(row.dataset.id);
      if (!n) return;
      if (n.type === 'folder') S.expanded.add(n.id);
      saveExpanded();
      go(n.type, n.id);
      return;
    }
    const wl = t.closest('a.wikilink');
    if (wl) {
      e.preventDefault();
      const title = wl.dataset.title.trim().toLowerCase();
      const hit = liveNodes().find((n) => n.type === 'note' && (n.title || '').trim().toLowerCase() === title);
      if (hit) go('note', hit.id);
      else if (await confirmBox({ title: 'Create “' + wl.dataset.title + '”?', hint: 'No note has that title yet.', ok: 'Create' })) {
        const cur = node(S.route.id);
        const n = createNode('note', cur && cur.parentId && node(cur.parentId) ? cur.parentId : null, wl.dataset.title);
        S.nextEdit = 'write'; go('note', n.id);
      }
      return;
    }
    const img = t.closest('.md img[data-img], .md figure img');
    if (img && img.src && !t.closest('.modal')) {
      const lb = document.createElement('div');
      lb.id = 'lightbox';
      lb.innerHTML = `<img src="${esc(img.src)}" alt="">${img.alt ? `<p>${esc(img.alt)}</p>` : ''}`;
      lb.onclick = () => lb.remove();
      document.body.appendChild(lb);
    }
  });

  $('#fab').innerHTML = icon('plus');
  $('#fab').addEventListener('click', fabMenu);

  document.addEventListener('input', (e) => {
    const t = e.target;
    const n = S.route.kind !== 'home' ? node(S.route.id) : null;
    if (!n) return;
    if (t.id === 'title' || t.id === 'ftitle') {
      n.title = t.value.replace(/\n/g, ' '); touch(n, true);
      fitTitle(t);
      clearTimeout(S.titleT);
      S.titleT = setTimeout(() => { renderTree(); renderTopbar(); }, 250);
    } else if (t.id === 'ta') {
      n.body = t.value; touch(n, true);
      fitEditor(t);
      const pv = $('.editor-wrap.split #md');
      if (pv) { clearTimeout(S.pvT); S.pvT = setTimeout(() => { pv.innerHTML = MD.render(n.body, mdCtx()); afterMdRender(); }, 180); }
      const wc = $('#wc');
      const bl = $('#byline');
      if (bl && (n.by || n.createdBy)) { bl.innerHTML = bylineHtml(n); bl.hidden = false; if (wc) wc.textContent = words(n.body) + ' words'; }
      else if (wc) wc.textContent = words(n.body) + ' words · just now';
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches && t.matches('.md input[data-task]')) {
      const n = node(S.route.id);
      if (!n) return;
      n.body = MD.toggleTask(n.body, +t.dataset.task);
      touch(n, true);
      t.closest('li').classList.toggle('done', t.checked);
    }
  });
  document.addEventListener('paste', async (e) => {
    if (!e.target || e.target.id !== 'ta' || !e.clipboardData) return;
    const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); await insertImages(files); }
  });
  document.addEventListener('dragover', (e) => { if (e.target.id === 'ta') e.preventDefault(); });
  document.addEventListener('drop', async (e) => {
    if (e.target.id !== 'ta' || !e.dataTransfer) return;
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); await insertImages(files); }
  });
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') { if (modalClose) closeModal(); else if (S.drawer) setDrawer(false); }
    else if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); searchDialog(); }
    else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); persist(); sync(true); }
    else if (mod && e.target.id === 'ta' && e.key.toLowerCase() === 'b') { e.preventDefault(); toolbarAction('bold'); }
    else if (mod && e.target.id === 'ta' && e.key.toLowerCase() === 'i') { e.preventDefault(); toolbarAction('italic'); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist();
    else if (S.mode === 'cloud' && S.authed) scheduleSync(300);
  });
  window.addEventListener('pagehide', persist);
  window.addEventListener('online', () => scheduleSync(300));
  window.addEventListener('offline', () => { if (S.mode === 'cloud') setSync('offline'); });
  setInterval(() => { if (document.visibilityState === 'visible' && S.mode === 'cloud' && S.authed) scheduleSync(100); }, 90000);

  // ------------------------------------------------------------------ phones: keyboard, swipe, toolbar focus
  (function phoneHelpers() {
    const vv = window.visualViewport;
    const root = document.documentElement;
    // Keep the app exactly as tall as what you can SEE, so the toolbar stays right above the on-screen keyboard.
    function fit() {
      if (!vv || vv.scale > 1.05) return; // pinch-zoomed: leave the layout alone
      root.style.setProperty('--app-h', Math.round(vv.height) + 'px');
      root.style.setProperty('--app-top', Math.round(vv.offsetTop) + 'px');
    }
    if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit(); }
    // Tapping a toolbar button must not take focus away from the text, or the keyboard would close every time.
    $('#dock').addEventListener('mousedown', (e) => { if (e.target.closest('.tb')) e.preventDefault(); });
    // Swipe left on the drawer to close it.
    const b = $('#binder');
    let sx = 0; let sy = 0;
    b.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    b.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - sx; const dy = t.clientY - sy;
      if (S.drawer && dx < -60 && Math.abs(dx) > Math.abs(dy) * 1.5) setDrawer(false);
    }, { passive: true });
  })();

  // ------------------------------------------------------------------ boot
  async function boot() {
    applySettings();
    buildBinder();
    try {
      const saved = await kvGet('doc');
      if (saved && saved.nodes) S.doc = saved;
      S.mode = (await kvGet('mode')) || 'local';
      S.user = S.mode === 'cloud' ? ((await kvGet('user')) || null) : null; // remembered, so your name shows even offline
    } catch (e) { console.warn('could not read saved notes', e); }
    S.route = parseHash();
    if (S.route.kind !== 'home' && !node(S.route.id)) S.route = { kind: 'home', id: null };
    if (S.route.id) for (const a of pathOf(S.route.id)) S.expanded.add(a.id);
    renderAll();

    try {
      const res = await fetch('api/status', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(6000) });
      if (!res.ok || !/json/.test(res.headers.get('content-type') || '')) throw new Error('no api');
      const st = await res.json();
      if (st.cloud) {
        S.mode = 'cloud'; S.authed = !!st.authed; S.setup = !!st.setup; S.cloudProblem = '';
        S.user = st.authed && st.user ? st.user : null;
        await kvSet('mode', 'cloud');
        await kvSet('user', S.user);
        if (!S.authed) { setSync('offline'); renderAll(); showLock(); }
      } else {
        S.mode = 'local'; S.user = null; S.cloudProblem = st.reason || '';
        await kvSet('mode', 'local');
      }
    } catch {
      if (S.mode === 'cloud') S.authed = true; // offline: the login cookie may still be valid
    }
    setSync(S.mode === 'cloud' ? (navigator.onLine ? 'busy' : 'offline') : 'local');
    if (S.mode === 'cloud' && S.authed) await sync();
    await maybeSeed();
    renderAll();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      const hadWorker = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadWorker) toast('A new version is ready', 'Reload', () => location.reload()); });
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  boot();

  window.__nb = { S, createNode, sync, MD }; // handy for debugging in the browser console
})();
