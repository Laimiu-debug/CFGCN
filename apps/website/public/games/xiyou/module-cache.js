// Some browsers cannot clone compiled modules into IndexedDB. Cache validated
// bytes there instead; game saves are in a different store and never touched.
const open = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open('cfgcn:xiyou:compiled', 1);
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      reject(new Error('CACHE_TIMEOUT'));
    }, 300);
    request.onupgradeneeded = () => request.result.createObjectStore('modules');
    request.onsuccess = () => {
      clearTimeout(timer);
      if (expired) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error);
    };
    request.onblocked = () => {
      clearTimeout(timer);
      reject(new Error('CACHE_BLOCKED'));
    };
  });
export async function readModule(key) {
  let db;
  try {
    db = await open();
    const value = await new Promise((resolve, reject) => {
      const req = db.transaction('modules').objectStore('modules').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (
      value instanceof WebAssembly.Module &&
      WebAssembly.Module.exports(value).some((e) => e.name === '__wbindgen_start')
    )
      return { module: value, source: 'compiled' };
    if (
      !(value instanceof Uint8Array) ||
      value.length < 8 ||
      value.length > 50_000_000 ||
      value[0] !== 0 ||
      value[1] !== 0x61 ||
      value[2] !== 0x73 ||
      value[3] !== 0x6d
    )
      return null;
    const expected = /^client-([a-f0-9]{12})\.wasm:/.exec(key)?.[1];
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', value))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    if (!expected || !hash.startsWith(expected)) return null;
    const module = await WebAssembly.compile(value);
    return WebAssembly.Module.exports(module).some((e) => e.name === '__wbindgen_start')
      ? { module, source: 'bytes' }
      : null;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}
export async function saveModule(key, module, bytes) {
  let db;
  try {
    db = await open();
    const write = (value) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('modules', 'readwrite');
        const store = tx.objectStore('modules');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
        try {
          store.clear();
          store.put(value, key);
        } catch (error) {
          tx.abort();
          reject(error);
        }
      });
    try {
      await write(module);
    } catch {
      if (bytes instanceof Uint8Array) await write(bytes);
    }
  } catch {
    /* Private mode and unsupported structured clones remain playable. */
  } finally {
    db?.close();
  }
}
