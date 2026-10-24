import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {shouldCancelPreviewForStudyInput} from '../chiikawa-pets/static-cameo.js';
const code=await readFile(new URL('../chiikawa-pets/integration.js',import.meta.url),'utf8');
test('experimental preview panel is native disclosure default closed, not saved autoplay state',()=>{
 assert.match(code,/previewPanel=document.createElement\('details'\)/);assert.match(code,/previewPanel.id='motion-preview-panel'/);
 assert.doesNotMatch(code,/previewPanel.open\s*=\s*true/);assert.match(code,/previewPanel.open&&preferences.visible\[id\]&&!document.hidden/);
 assert.match(code,/previewCoordinator.cancelAll\('panel-closed'\)/);assert.match(code,/motion-preview-summary'\).focus\(\)/);
});
test('original controls keep selector IDs; basic visibility remains outside preview panel',()=>{
 for(const id of ['momonga-preview-start','chiikawa-cameo-start','pets-show-all','pets-hide-all'])assert.ok(code.includes(id));
 assert.doesNotMatch(code,/previewPanel.append\([^;]*visibilityTools/);assert.doesNotMatch(code,/previewPanel.append\([^;]*mobileDock/);
 assert.match(code,/previewPanel.append\(betaTools,betaStage,previewTools,previewRail,cameoTools,cameoRail/);
});
test('arrow keys inside experimental controls cannot accidentally mark or navigate study words',()=>{
 const event={type:'keydown',key:'ArrowDown',target:{closest:selector=>selector.includes('.cv-preview-panel')?{}:null}};
 assert.equal(shouldCancelPreviewForStudyInput(event,true),false);
 assert.match(code,/if\(isCharacterManagementArrow\(event\)\)event.stopPropagation\(\)/);
 assert.equal(shouldCancelPreviewForStudyInput({...event,target:{closest:()=>null}},true),true);
});
test('opening disclosure does not start a preview or beta walk automatically',()=>{
 const toggle=code.match(/previewPanel.addEventListener\('toggle',([\s\S]*?)\);\n/)[1];
 assert.doesNotMatch(toggle,/\.start\(|playAction/);assert.match(toggle,/mount\(\)/);
});
test('fragment stage flex layout accommodates controller-owned relative clip positioning',async()=>{
 const css=await readFile(new URL('../chiikawa-pets/chiikawa-pets.css',import.meta.url),'utf8');
 assert.match(css,/\.cv-fragment-rail \{[^}]*display:flex;align-items:flex-end;justify-content:center/);
 assert.match(css,/\.cv-fragment-clip \{ position:relative; left:auto; bottom:auto; transform:none/);
});
