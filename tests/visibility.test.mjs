import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePetVisibilityPreferences, selectedPetIds } from '../chiikawa-pets/visibility-preferences.js';
import { readFile } from 'node:fs/promises';

test('visibility defaults are separate from pause and cover exactly six characters', () => {
  const prefs=normalizePetVisibilityPreferences(null);
  assert.equal(selectedPetIds(prefs).length,6);assert.equal(prefs.paused,false);
});
test('saved booleans survive; malformed/unknown keys cannot change known defaults', () => {
  const prefs=normalizePetVisibilityPreferences({schemaVersion:1,visible:{chiikawa:false,hachiware:'false',alien:false},paused:true});
  assert.equal(prefs.visible.chiikawa,false);assert.equal(prefs.visible.hachiware,true);
  assert.equal(Object.hasOwn(prefs.visible,'alien'),false);assert.equal(prefs.paused,true);
});
test('unsupported preference schema safely resets UI defaults only', () => {
  const prefs=normalizePetVisibilityPreferences({schemaVersion:99,visible:{chiikawa:false},paused:true});
  assert.equal(prefs.visible.chiikawa,true);assert.equal(prefs.paused,false);
});
test('all hidden does not imply paused and all shown does not imply resumed', () => {
  const prefs=normalizePetVisibilityPreferences(null);
  for(const id of Object.keys(prefs.visible))prefs.visible[id]=false;
  assert.deepEqual(selectedPetIds(prefs),[]);assert.equal(prefs.paused,false);
  prefs.paused=true;for(const id of Object.keys(prefs.visible))prefs.visible[id]=true;
  assert.equal(selectedPetIds(prefs).length,6);assert.equal(prefs.paused,true);
});
test('visibility integration does not read/write/migrate the vocabulary store', async () => {
  const code=await readFile(new URL('../chiikawa-pets/integration.js',import.meta.url),'utf8');
  assert.match(code,/jlpt-pet-visibility-v1/);
  assert.doesNotMatch(code,/jlpt-local-vocabulary-v1/);
  assert.doesNotMatch(code,/localStorage\.clear/);
});
