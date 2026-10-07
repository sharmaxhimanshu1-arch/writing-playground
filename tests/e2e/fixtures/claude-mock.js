// A stand-in for claude.ai's page runtime (window.claude.use) with an in-memory `db` and a signed-in `user`.
// The store lives in the test runner (window.__store), so several pages share it like devices on one account.
// Snapshots are delivered by polling, like the runtime's fallback mode.
(() => {
  const call = (op, path, body) => window.__store(op, path, body === undefined ? null : JSON.stringify(body)).then((r) => (r ? JSON.parse(r) : null));
  const meta = { fromCache: false, hasPendingWrites: false };
  // Like the real runtime, delivered data is frozen all the way down.
  const freeze = (o) => {
    if (o && typeof o === 'object') {
      Object.values(o).forEach(freeze);
      Object.freeze(o);
    }
    return o;
  };
  const snap = (id, data) => ({ id, exists: !!data, data: () => (data ? freeze(JSON.parse(JSON.stringify(data))) : undefined), metadata: meta });
  const poll = (read, deliver) => {
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        await deliver(await read());
      } catch (e) { /* page closing */ }
      setTimeout(tick, 200);
    };
    tick();
    return () => { alive = false; };
  };
  function docRef(path) {
    const id = path.split('/').pop();
    return {
      id,
      path,
      get: async () => snap(id, await call('get', path)),
      set: async (data) => { await call('set', path, data); },
      update: async (data) => { await call('update', path, data); },
      delete: async () => { await call('delete', path); },
      collection: (sub) => colRef(`${path}/${sub}`),
      onSnapshot(next) {
        let last;
        return poll(() => call('get', path), (d) => {
          const j = JSON.stringify(d);
          if (j !== last) {
            last = j;
            next(snap(id, d));
          }
        });
      },
    };
  }
  function colRef(path) {
    const query = {
      path,
      doc: (id) => docRef(`${path}/${id}`),
      get: async () => {
        const rows = await call('list', path);
        const docs = rows.map((r) => snap(r.id, r.data));
        return { docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map((d, i) => ({ type: 'added', doc: d, oldIndex: -1, newIndex: i })), metadata: meta };
      },
      onSnapshot(next) {
        let prev = null;
        return poll(() => call('list', path), (rows) => {
          const now = new Map(rows.map((r) => [r.id, JSON.stringify(r.data)]));
          const changes = [];
          rows.forEach((r, i) => {
            const before = prev && prev.get(r.id);
            if (before === undefined) changes.push({ type: 'added', doc: snap(r.id, r.data), oldIndex: -1, newIndex: i });
            else if (before !== now.get(r.id)) changes.push({ type: 'modified', doc: snap(r.id, r.data), oldIndex: i, newIndex: i });
          });
          if (prev) for (const id of prev.keys()) if (!now.has(id)) changes.push({ type: 'removed', doc: snap(id, JSON.parse(prev.get(id))), oldIndex: 0, newIndex: -1 });
          if (prev && !changes.length) return;
          prev = now;
          const docs = rows.map((r) => snap(r.id, r.data));
          next({ docs, size: docs.length, empty: !docs.length, docChanges: () => changes, metadata: meta });
        });
      },
    };
    return query;
  }
  const db = { doc: docRef, collection: colRef };
  const user = {
    id: async () => 'u_writer',
    isOwner: async () => true,
    canEdit: async () => true,
    can: async () => true,
    me: async () => ({ id: 'u_writer', name: '', avatarUrl: '', color: '#888', email: null, isOwner: true, canEdit: true }),
  };
  window.claude = { use: async (name) => (name === 'db' ? db : name === 'user' ? user : null) };
})();
