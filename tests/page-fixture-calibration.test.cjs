const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{boot,createDocument}=require('./page-mock-dom.cjs');
const baseline=path.resolve(__dirname,'../legacy-self-contained.html');
const studyOnly={skipScript:(_src,s)=>!s.textContent.includes("const storageKey = 'jlpt-local-vocabulary-v1'")};
test('fixture calibration: IDs inside scripts are not DOM elements and detached elements stay disconnected',()=>{
 const d=createDocument('<html><head><script>const markup=\'<button id="invented">x</button>\';</script></head><body><main id="real"></main></body></html>');
 assert.equal(d.getElementById('invented'),null);assert.equal(d.getElementById('real').isConnected,true);const detached=d.createElement('section');detached.innerHTML='<button id="detached">x</button>';assert.equal(d.getElementById('detached'),null);assert.equal(detached.querySelector('#detached').isConnected,false);
});
test('fixture calibration: actual full777f scripts create six unique actors, one animation loop and apply saved visibility/pause',()=>{
 const visible={chiikawa:false,hachiware:true,usagi:false,shisa:false,momonga:true,rakko:false};
 const store={'jlpt-pet-visibility-v1':JSON.stringify({schemaVersion:1,visible,paused:true}),'jlpt-local-vocabulary-v1':JSON.stringify({level:'N4',positions:{N4:17},answers:{1:'unknown'}})};
 const before=JSON.stringify(store),b=boot(baseline,{store});const actors=b.doc.querySelectorAll('.cv-pet');assert.equal(actors.length,6);assert.equal(new Set(actors.map(x=>x.dataset.character)).size,6);for(const actor of actors)assert.equal(actor.hidden,!visible[actor.dataset.character]);assert.equal(b.ids['pet-toggle'].getAttribute('aria-pressed'),'true');assert.equal(b.raf.size,1);assert.equal(JSON.stringify(store),before);assert.equal(b.writes.length,0);
});
test('fixture calibration: full777f actual study source marks/undoes and backup preview/cancel preserve stored records',async()=>{
 const b=boot(baseline,studyOnly);b.ids['level-buttons'].children[0].children[0].click();const before=b.store['jlpt-local-vocabulary-v1'];b.click('unknown');assert.equal(JSON.parse(b.store['jlpt-local-vocabulary-v1']).answers['1'],'unknown');b.click('undo-answer');assert.equal(b.store['jlpt-local-vocabulary-v1'],before);assert.equal(b.ids['undo-answer'].disabled,true);
 b.click('backup-export');const text=await b.blobs.at(-1).text();const payload=JSON.parse(text);assert.equal(payload.format,'chiikawa-study-record');assert.equal(payload.version,1);assert.equal(payload.dataset,'sha256:2112bf91d9ec0eac1f5212c30e89171a639ac4b156a0a92403b75c4b18df3c5e');await b.change('backup-file',{size:Buffer.byteLength(text),text:async()=>text});assert.equal(b.ids['backup-apply'].disabled,false);assert.equal(b.store['jlpt-local-vocabulary-v1'],before);b.click('backup-cancel');assert.equal(b.ids['backup-apply'].disabled,true);assert.equal(b.store['jlpt-local-vocabulary-v1'],before);
});
