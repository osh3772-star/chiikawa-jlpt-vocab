/** Visibility is user UI state, not motion/art approval and not study state. */
const PET_VISIBILITY_IDS = ['chiikawa', 'hachiware', 'usagi', 'shisa', 'momonga', 'rakko'];
export function normalizePetVisibilityPreferences(value) {
  const valid = value && typeof value === 'object' && value.schemaVersion === 1;
  return { schemaVersion: 1,
    visible: Object.fromEntries(PET_VISIBILITY_IDS.map(id => [id,
      valid && typeof value.visible?.[id] === 'boolean' ? value.visible[id] : true])),
    paused: valid && typeof value.paused === 'boolean' ? value.paused : false };
}
export function selectedPetIds(preferences) {
  return PET_VISIBILITY_IDS.filter(id => preferences.visible[id] === true);
}
