// Isolated preference helper. No production registry or renderer registration.
export const STORAGE_KEY = 'jlpt-extra-visibility-v1';
export const PROPOSED_IDS = Object.freeze([
  'furuhonya', 'kurimanju', 'pajama-midori', 'pajama-pink',
  'pajama-murasaki', 'pajama-shiro',
]);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => object(value) && Object.hasOwn(value, key);
const FIELDS = ['sourceApproved', 'artApproved', 'staticDisplay', 'decoded', 'geometrySafe'];
const gates = value => Object.fromEntries(FIELDS.map(key => [key, own(value, key) && value[key] === true]));
const approved = gate => gate.sourceApproved && gate.artApproved && gate.staticDisplay;

export function createExtraVisibilityStore({ storage = null, roster = [] } = {}) {
  const eligibility = new Map();
  for (const entry of Array.isArray(roster) ? roster : []) {
    if (!own(entry, 'id') || !PROPOSED_IDS.includes(entry.id)) continue;
    if (eligibility.has(entry.id)) throw new TypeError(`Duplicate extra ID: ${entry.id}`);
    eligibility.set(entry.id, gates(entry));
  }
  const requested = Object.fromEntries([...eligibility.keys()].map(id => [id, false]));
  const listeners = new Set();
  let destroyed = false;
  let persistence = storage ? 'clean' : 'unavailable';
  let loadStatus = 'empty';
  try {
    const raw = storage ? storage.getItem(STORAGE_KEY) : null;
    if (raw !== null) {
      const data = JSON.parse(raw);
      if (!own(data, 'schemaVersion') || data.schemaVersion !== 1 || !own(data, 'approvedIds') || !Array.isArray(data.approvedIds) || data.approvedIds.some(id => typeof id !== 'string' || !PROPOSED_IDS.includes(id)) || new Set(data.approvedIds).size !== data.approvedIds.length || !own(data, 'requested') || !object(data.requested)) {
        loadStatus = 'invalid';
      } else {
        loadStatus = 'loaded';
        for (const [id, gate] of eligibility) {
          requested[id] = approved(gate) && data.approvedIds.includes(id) && own(data.requested, id) && data.requested[id] === true;
        }
      }
    }
  } catch (error) {
    loadStatus = error instanceof SyntaxError ? 'invalid' : 'read-error';
    if (loadStatus === 'read-error') persistence = 'read-error';
  }
  function snapshot() {
    const actors = {};
    for (const [id, gate] of eligibility) {
      const eligible = approved(gate);
      const reasons = FIELDS.filter(field => !gate[field]);
      actors[id] = Object.freeze({ requested: requested[id], eligible,
        effective: requested[id] && reasons.length === 0,
        blockedBy: Object.freeze(reasons), ...gate });
    }
    return Object.freeze({ actors: Object.freeze(actors), persistence, loadStatus, destroyed });
  }
  function emit() {
    const value = snapshot();
    for (const listener of [...listeners]) {
      if (destroyed) break;
      try { listener(value); } catch { /* observers cannot abort preference updates */ }
    }
  }
  function persist() {
    if (!storage) { persistence = 'unavailable'; return; }
    try {
      const approvedIds = [...eligibility].filter(([, gate]) => approved(gate)).map(([id]) => id);
      const scopedRequested = Object.fromEntries(approvedIds.map(id => [id, requested[id]]));
      storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, approvedIds, requested: scopedRequested }));
      persistence = 'saved';
    } catch { persistence = 'write-error'; }
  }
  function change(patch) {
    if (destroyed) return false;
    let changed = false;
    for (const [id, value] of patch) {
      if (requested[id] !== value) { requested[id] = value; changed = true; }
    }
    if (!changed) return false;
    persist(); emit(); return true;
  }
  return Object.freeze({
    snapshot,
    subscribe(listener) {
      if (destroyed || typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setVisible(id, value) {
      if (typeof value !== 'boolean' || !eligibility.has(id)) return false;
      // OFF always allowed to cancel a previously requested but now blocked actor.
      if (value && !approved(eligibility.get(id))) return false;
      return change([[id, value]]);
    },
    showAll() { return change([...eligibility].filter(([, gate]) => approved(gate)).map(([id]) => [id, true])); },
    hideAll() { return change([...eligibility.keys()].map(id => [id, false])); },
    updateEligibility(id, value) {
      if (destroyed || !eligibility.has(id)) return false;
      const next = gates(value), old = eligibility.get(id);
      if (FIELDS.every(field => next[field] === old[field])) return false;
      eligibility.set(id, next);
      // No re-read of storage, no opt-in, no persistence for availability changes.
      emit(); return true;
    },
    retryPersistence() {
      if (destroyed || !['write-error', 'read-error', 'unavailable'].includes(persistence)) return false;
      const before = persistence;
      persist();
      if (before !== persistence) emit();
      return persistence === 'saved';
    },
    destroy() { destroyed = true; listeners.clear(); },
  });
}
