/* QA ONLY: loaded before application code; never installed by index.html. */
(() => {
  'use strict';
  const namespace = 'cv-qa-20261026-bgm-player-v1:local:';
  const backing = window.localStorage;
  const metadataKey = namespace + 'registry';
  const dataKey = key => namespace + 'data:' + String(key);
  const registered = () => {
    const raw = backing.getItem(metadataKey);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(k => typeof k === 'string')) throw Error('Invalid QA storage registry');
    return [...new Set(parsed)];
  };
  const liveKeys = () => registered().filter(k => backing.getItem(dataKey(k)) !== null);
  const api = {
    getItem(key) { return backing.getItem(dataKey(key)); },
    setItem(key, value) {
      key = String(key); value = String(value);
      const keys = registered();
      // Record before the value: a registry failure must never orphan a value.
      if (!keys.includes(key)) backing.setItem(metadataKey, JSON.stringify([...keys, key]));
      backing.setItem(dataKey(key), value);
    },
    removeItem(key) {
      key = String(key); backing.removeItem(dataKey(key));
      backing.setItem(metadataKey, JSON.stringify(registered().filter(k => k !== key)));
    },
    clear() {
      for (const key of registered()) backing.removeItem(dataKey(key));
      backing.removeItem(metadataKey);
    },
    key(index) { return liveKeys()[Number(index) >>> 0] ?? null; }
  };
  const proxy = new Proxy(Object.create(null), {
    get(_, key) {
      if (key === 'length') return liveKeys().length;
      if (key === Symbol.toStringTag) return 'Storage';
      if (typeof key === 'symbol') return undefined;
      if (Object.prototype.hasOwnProperty.call(api, key)) return api[key];
      return api.getItem(key) ?? undefined;
    },
    set(_, key, value) { if (typeof key === 'symbol') return false; api.setItem(key, value); return true; },
    deleteProperty(_, key) { if (typeof key === 'symbol') return false; api.removeItem(key); return true; },
    has(_, key) { return key === 'length' || Object.prototype.hasOwnProperty.call(api, key) || typeof key === 'string' && api.getItem(key) !== null; },
    ownKeys() { return liveKeys(); },
    getOwnPropertyDescriptor(_, key) {
      if (typeof key !== 'string' || api.getItem(key) === null) return undefined;
      return {configurable: true, enumerable: true, writable: true, value: api.getItem(key)};
    },
    defineProperty(_, key, descriptor) {
      if (typeof key === 'symbol' || !('value' in descriptor) || descriptor.configurable === false) return false;
      api.setItem(key, descriptor.value); return true;
    },
    preventExtensions() { return false; }
  });
  // Fail closed: if this property cannot be isolated, do not run the app scripts.
  Object.defineProperty(window, 'localStorage', {value: proxy, configurable: false, writable: false});
  if (window.localStorage !== proxy) throw Error('QA storage isolation failed');
  Object.defineProperty(window, '__CV_QA_LOCAL_READY__', {value: true, configurable: false, writable: false});
})();

/* QA ONLY: loaded before application code; never installed by index.html. */
(() => {
  'use strict';
  const namespace = 'cv-qa-20261026-bgm-player-v1:session:';
  const backing = window.sessionStorage;
  const metadataKey = namespace + 'registry';
  const dataKey = key => namespace + 'data:' + String(key);
  const registered = () => {
    const raw = backing.getItem(metadataKey);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(k => typeof k === 'string')) throw Error('Invalid QA storage registry');
    return [...new Set(parsed)];
  };
  const liveKeys = () => registered().filter(k => backing.getItem(dataKey(k)) !== null);
  const api = {
    getItem(key) { return backing.getItem(dataKey(key)); },
    setItem(key, value) {
      key = String(key); value = String(value);
      const keys = registered();
      // Record before the value: a registry failure must never orphan a value.
      if (!keys.includes(key)) backing.setItem(metadataKey, JSON.stringify([...keys, key]));
      backing.setItem(dataKey(key), value);
    },
    removeItem(key) {
      key = String(key); backing.removeItem(dataKey(key));
      backing.setItem(metadataKey, JSON.stringify(registered().filter(k => k !== key)));
    },
    clear() {
      for (const key of registered()) backing.removeItem(dataKey(key));
      backing.removeItem(metadataKey);
    },
    key(index) { return liveKeys()[Number(index) >>> 0] ?? null; }
  };
  const proxy = new Proxy(Object.create(null), {
    get(_, key) {
      if (key === 'length') return liveKeys().length;
      if (key === Symbol.toStringTag) return 'Storage';
      if (typeof key === 'symbol') return undefined;
      if (Object.prototype.hasOwnProperty.call(api, key)) return api[key];
      return api.getItem(key) ?? undefined;
    },
    set(_, key, value) { if (typeof key === 'symbol') return false; api.setItem(key, value); return true; },
    deleteProperty(_, key) { if (typeof key === 'symbol') return false; api.removeItem(key); return true; },
    has(_, key) { return key === 'length' || Object.prototype.hasOwnProperty.call(api, key) || typeof key === 'string' && api.getItem(key) !== null; },
    ownKeys() { return liveKeys(); },
    getOwnPropertyDescriptor(_, key) {
      if (typeof key !== 'string' || api.getItem(key) === null) return undefined;
      return {configurable: true, enumerable: true, writable: true, value: api.getItem(key)};
    },
    defineProperty(_, key, descriptor) {
      if (typeof key === 'symbol' || !('value' in descriptor) || descriptor.configurable === false) return false;
      api.setItem(key, descriptor.value); return true;
    },
    preventExtensions() { return false; }
  });
  // Fail closed: if this property cannot be isolated, do not run the app scripts.
  Object.defineProperty(window, 'sessionStorage', {value: proxy, configurable: false, writable: false});
  if (window.sessionStorage !== proxy) throw Error('QA storage isolation failed');
  Object.defineProperty(window, '__CV_QA_SESSION_READY__', {value: true, configurable: false, writable: false});
})();
if(window.__CV_QA_LOCAL_READY__!==true||window.__CV_QA_SESSION_READY__!==true)throw Error('QA dual storage isolation required');
