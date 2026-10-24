import {test} from 'node:test';import assert from 'node:assert/strict';
import {isCharacterManagementArrow} from '../chiikawa-pets/visibility-preferences.js';
import {shouldCancelPreviewForStudyInput} from '../chiikawa-pets/static-cameo.js';
for(const container of ['.pet-tools','.cv-visibility-tools','.cv-mobile-pet-dock','.cv-evidence-status','.cv-preview-panel']){
 test(`${container} arrows are UI-only, never vocabulary grading/navigation`,()=>{for(const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']){const e={type:'keydown',key,target:{closest:s=>s.split(',').map(x=>x.trim()).includes(container)?{}:null}};assert.equal(isCharacterManagementArrow(e),true);assert.equal(shouldCancelPreviewForStudyInput(e,true),false)}});
}
test('native Space/Enter and study arrows outside management are not swallowed',()=>{
 for(const key of [' ','Enter','Escape'])assert.equal(isCharacterManagementArrow({key,target:{closest:()=>({})}}),false);
 const e={type:'keydown',key:'ArrowRight',target:{closest:()=>null}};assert.equal(isCharacterManagementArrow(e),false);assert.equal(shouldCancelPreviewForStudyInput(e,true),true);
});
