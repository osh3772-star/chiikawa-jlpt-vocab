/** DOM-free preference state machine. Asset authenticity is a build-time gate. */
export const BACKGROUND_STORAGE_KEY = 'cv-background-v1';
export const FIELD_DIMENSIONS = Object.freeze({ width: 1536, height: 1024 });
const validSelection = value => value === 'original' || value === 'field-ep6' || value === 'stone-ep2';

export function createBackgroundController({ storage, decode, apply, restore } = {}) {
  if (![decode, apply, restore].every(fn => typeof fn === 'function')) {
    throw new TypeError('decode, apply and restore adapters are required');
  }
  let generation = 0, pending = null, resource = null, destroyed = false;
  const listeners = new Set();
  let state = Object.freeze({ requested: 'original', active: null, status: 'original', error: null, persistence: 'unavailable' });
  const getState = () => state;
  const update = patch => {
    state = Object.freeze({ ...state, ...patch });
    for (const listener of [...listeners]) {
      try { listener(state); } catch { /* Observers cannot break selection. */ }
    }
  };
  const release = item => { try { item?.dispose?.(); } catch { /* Best-effort resource release. */ } };
  const restoreOriginal = () => {
    try { restore(); return true; } catch { return false; }
  };
  const transition = (selection, persist) => {
    if (!validSelection(selection)) throw new TypeError('Unknown background selection');
    if (destroyed) return Promise.resolve(state);
    const token = ++generation;
    pending?.abort(); pending = null;
    const old = resource; resource = null;
    const restored = restoreOriginal();
    release(old);
    let persistence = state.persistence;
    if (persist) {
      try { storage.setItem(BACKGROUND_STORAGE_KEY, selection); persistence = 'saved'; }
      catch { persistence = 'unavailable'; }
    }
    update({ requested: selection, active: restored ? 'original' : null,
      status: !restored ? 'error' : selection === 'original' ? 'original' : 'loading',
      error: restored ? null : 'restore-failed', persistence });
    if (!restored || selection === 'original' || destroyed || token !== generation) return Promise.resolve(state);
    const abort = new AbortController(); pending = abort;
    // A microtask boundary permits selection/destroy to cancel before decode starts.
    return Promise.resolve().then(() => {
      if (destroyed || token !== generation) return null;
      return decode(selection, { signal: abort.signal, generation: token });
    }).then(decoded => {
      if (destroyed || token !== generation) { release(decoded); return state; }
      pending = null;
      if (!decoded || decoded.decoded !== true || decoded.width !== FIELD_DIMENSIONS.width || decoded.height !== FIELD_DIMENSIONS.height) {
        release(decoded);
        throw new Error('invalid-decoded-asset');
      }
      try { apply(decoded, selection); }
      catch { release(decoded); throw new Error('apply-failed'); }
      if (destroyed || token !== generation) { release(decoded); return state; }
      resource = decoded;
      update({ active: selection, status: 'ready', error: null });
      return state;
    }).catch(error => {
      if (destroyed || token !== generation) return state;
      pending = null;
      const restored = restoreOriginal();
      const code = ['invalid-decoded-asset', 'apply-failed'].includes(error?.message) ? error.message : 'decode-failed';
      update({ active: restored ? 'original' : null, status: 'error', error: restored ? code : 'restore-failed' });
      return state;
    });
  };
  let initial = 'original', persistence = 'unavailable';
  try {
    const saved = storage.getItem(BACKGROUND_STORAGE_KEY);
    if (validSelection(saved)) { initial = saved; persistence = 'saved'; }
    else persistence = 'not-saved';
  } catch { /* Default remains original; never access other storage keys. */ }
  state = Object.freeze({ ...state, persistence });
  transition(initial, false);
  return Object.freeze({
    setSelection: selection => transition(selection, true),
    getState,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Listener must be a function');
      if (destroyed) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; ++generation; pending?.abort(); pending = null;
      const restored = restoreOriginal();
      release(resource); resource = null;
      update({ active: restored ? 'original' : null, status: 'destroyed', error: restored ? null : 'restore-failed' });
      listeners.clear();
    }
  });
}
