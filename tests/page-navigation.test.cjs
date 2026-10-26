const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {boot,createDocument}=require('./page-mock-dom.cjs');
const root=path.resolve(__dirname,'..'),site=process.env.CV_SEPARATE_TEST_SITE||path.resolve(root,'dist/separate-pages'),baseline=path.join(root,'legacy-self-contained.html');
const K='jlpt-local-vocabulary-v1',H='cv-page-handoff-v1',levels=['N5','N4','N3','N2','N1'];
const file=n=>path.join(site,n+'.html'),studyOnly={skipScript:src=>['pet-data.js','pet-runtime.js'].includes(src)};
const stored=(level='N4')=>({level,positions:{N5:17,N4:23,N3:31,N2:47,N1:59},answers:{1:'unknown',2:'unknown',301:'known',7180:'unknown'}});
const mk=(n,opts={})=>boot(file(n),{...opts});
const state=b=>JSON.parse(b.store[K]);
const tick=()=>new Promise(r=>setImmediate(r));
async function backup(b){b.click('backup-export');return JSON.parse(await b.blobs.at(-1).text())}
async function choose(b,p){const s=typeof p==='string'?p:JSON.stringify(p);await b.change('backup-file',{size:Buffer.byteLength(s),text:async()=>s})}
const leaf=url=>path.basename(new URL(url).pathname),next=(b,n,opts={})=>{assert.ok(b.navigation.length,'document navigation requested');const url=b.navigation.at(-1).url;assert.equal(leaf(url),n+'.html');return mk(n,{store:b.store,session:b.session,url,...opts})};
const id=b=>/원본 ID (\d+)/.exec(b.ids.position.textContent)?.[1];

test('three genuinely distinct HTML entries: matching roots only, unique DOM IDs/scripts, same-directory real links/resources',()=>{
 const hashes=new Set();for(const [name,page]of [['index','home'],['character-settings','settings'],['study','study']]){
  const html=fs.readFileSync(file(name),'utf8');hashes.add(crypto.createHash('sha256').update(html).digest('hex'));const d=createDocument(html);assert.equal(d.body.dataset.page,page);const ids=d.querySelectorAll('[id]').map(n=>n.id);assert.equal(ids.length,new Set(ids).size,name+' duplicate actual DOM IDs');
  const scripts=d.querySelectorAll('script').map(n=>new URL(n.getAttribute('src'),'https://fixture.invalid/').pathname.slice(1));assert.equal(scripts.length,new Set(scripts).size);assert.equal(scripts.filter(s=>s==='navigation.js').length,1);assert.equal(scripts.filter(s=>s==='study-runtime.js').length,page==='settings'?0:1);assert.equal(scripts.filter(s=>s==='pet-runtime.js').length,page==='home'?0:1);
  assert.equal(!!d.getElementById('home'),page==='home');assert.equal(!!d.getElementById('study'),page==='study');assert.equal(!!d.getElementById('study-backup'),page==='home');assert.equal(!!d.getElementById('background-choice'),page==='settings');
  for(const n of d.querySelectorAll('a,script,link')){const ref=n.getAttribute('src')||n.getAttribute('href');if(!ref)continue;assert.ok(!ref.startsWith('#'),ref);const u=new URL(ref,'https://example.test/nested/'+name+'.html');assert.equal(u.origin,'https://example.test');assert.equal(path.posix.dirname(u.pathname),'/nested');assert.ok(fs.existsSync(path.join(site,path.basename(u.pathname))),ref);}
 }assert.equal(hashes.size,3);assert.doesNotMatch(fs.readFileSync(path.join(site,'navigation.js'),'utf8'),/addEventListener\(['"]hashchange|location\.hash\s*=/);
});

for(const width of [500,1180])for(const page of ['character-settings','study'])test(`${page} ${width}px actual full scripts: detached controls do not break saved actors/pause and no duplicate engine/listener`,()=>{
 const visible={chiikawa:false,hachiware:true,usagi:false,shisa:false,momonga:true,rakko:false};const store={[K]:JSON.stringify(stored()),'jlpt-pet-visibility-v1':JSON.stringify({schemaVersion:1,visible,paused:true})};const saved=store[K];const b=mk(page,{store,width});const actors=b.doc.querySelectorAll('.cv-pet');assert.equal(actors.length,6);assert.equal(new Set(actors.map(x=>x.dataset.character)).size,6);for(const actor of actors)assert.equal(actor.hidden,!visible[actor.dataset.character]);assert.equal(b.ids['pet-toggle'].getAttribute('aria-pressed'),'true');assert.equal(b.raf.size,1);assert.equal(b.ids['pet-toggle'].listeners.get('click').length,1);assert.equal(b.store[K],saved);
 if(page==='study'){for(const selector of ['.cv-visibility-tools','.cv-scale-tools','.cv-preview-panel','#background-choice','#mobile-pets','#pets-show-all','#pets-hide-all','#home','#study-backup'])assert.equal(b.doc.querySelector(selector),null,selector+' must not exist in study document');assert.equal(b.doc.querySelectorAll('#pet-toggle').length,1)}else{assert.equal(b.doc.querySelector('#study'),null);assert.ok(b.doc.querySelector('.cv-visibility-tools'))}
 const before=b.writes.length;b.click('pet-toggle');assert.equal(b.writes.length,before+1);assert.equal(b.writes.at(-1)[0],'jlpt-pet-visibility-v1');assert.equal(JSON.parse(b.writes.at(-1)[1]).paused,false);assert.equal(b.store[K],saved);assert.equal(b.raf.size,1);
});

test('exact vocabulary object and all original image payload hashes preserved across inline/external packaging',()=>{
 const full=fs.readFileSync(baseline,'utf8');const old=JSON.parse([...full.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].find(x=>/id="vocabulary"/.test(x[1]))[2]);const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(site,'vocabulary.js'),'utf8'),ctx);assert.equal(JSON.stringify(ctx.window.CVVocabulary),JSON.stringify(old));assert.equal(Object.values(old).flat().length,7180);
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),inline=text=>[...text.matchAll(/data:image\/[\w.+-]+;base64,([A-Za-z0-9+/=]+)/g)].map(m=>sha(Buffer.from(m[1],'base64')));
 const original=new Set(inline(full)),candidate=new Set();for(const name of fs.readdirSync(site)){const p=path.join(site,name);if(fs.statSync(p).isFile()&&/\.(?:js|css|html)$/.test(name))for(const h of inline(fs.readFileSync(p,'utf8')))candidate.add(h)}for(const name of fs.readdirSync(path.join(site,'assets')))candidate.add(sha(fs.readFileSync(path.join(site,'assets',name))));assert.deepEqual([...candidate].sort(),[...original].sort());
 assert.equal(sha(fs.readFileSync(path.join(root,'전체_단어장.json'))),'154ac4dcf36a609ad346fd50aefce53b47d38241f1c3e09384e70e40ad80d031');
});

test('all valid grades plus empty/encoded/invalid/direct URLs choose only allowlisted grade and retain every position/answer',()=>{
 const queries=['','?level=','?level=N0','?level=n5','?level=%20N5','?level=%E9%AB%98','?level=__proto__','?level=N0&level=N1',...levels.map(l=>'?level='+l)];
 for(const q of queries){const saved=stored('N3'),b=mk('study',{...studyOnly,store:{[K]:JSON.stringify(saved)},url:'https://example.test/nested/study.html'+q});const expected=levels.includes(new URL(b.location).searchParams.get('level'))?new URL(b.location).searchParams.get('level'):'N3';assert.equal(b.ids.level.value,expected,q);assert.deepEqual(state(b).positions,saved.positions);assert.deepEqual(state(b).answers,saved.answers);assert.equal(b.ids['undo-answer'].disabled,true);assert.equal(b.doc.getElementById('home'),null)}
});

test('home grade and review controls request actual study documents; disallowed destinations have zero side effects',()=>{
 for(let i=0;i<levels.length;i++){const b=mk('index',{store:{[K]:JSON.stringify(stored())}});b.ids['level-buttons'].children[i].children[0].click();assert.equal(b.navigation.length,1);const u=new URL(b.navigation[0].url);assert.equal(leaf(u),'study.html');assert.equal(u.searchParams.get('level'),levels[i]);assert.equal(u.hash,'')}
 const b=mk('index',{store:{[K]:JSON.stringify(stored())}});for(const href of ['https://evil.test/study.html','../study.html','/study.html','./other.html','javascript:alert(1)'])assert.equal(b.window.CVPage.go(href),false,href);assert.equal(b.navigation.length,0);assert.equal(b.sessionWrites.filter(x=>x[1]).length,0);b.click('start-review');const u=new URL(b.navigation[0].url);assert.equal(u.searchParams.get('review'),'all');assert.equal(u.searchParams.has('at'),false);assert.deepEqual([...u.searchParams.keys()].sort(),['_cvnav','review']);
});

test('modified/middle/new-tab clicks do not create a transfer; one ordinary same-tab click does',async()=>{
 const b=mk('index');const a=b.doc.querySelector('a[data-cv-link]');for(const options of [{button:1},{button:0,ctrlKey:true},{button:0,metaKey:true},{button:0,shiftKey:true},{button:0,altKey:true}])await b.fire(b.doc,'click',{target:a,...options});a.target='_blank';await b.fire(b.doc,'click',{target:a,button:0});a.target='';a.setAttribute('download','x');await b.fire(b.doc,'click',{target:a,button:0});a.removeAttribute('download');assert.equal(b.navigation.length,0);assert.equal(b.sessionWrites.filter(x=>x[1]).length,0);await b.fire(b.doc,'click',{target:a,button:0});assert.equal(b.navigation.length,1);assert.equal(b.sessionWrites.filter(x=>x[1]).length,1);
});

test('latest-only study undo survives settings roundtrip; exact handoff is consumed once with no preference reset',()=>{
 const b=mk('study',{...studyOnly,store:{[K]:JSON.stringify(stored('N5'))}});const before=JSON.stringify(state(b));b.click('unknown');const first=id(b);b.click('known');const at=id(b);assert.notEqual(first,at);assert.equal(b.window.CVPage.go('character-settings.html'),true);const c=next(b,'character-settings');assert.equal(c.session[H],undefined);assert.equal(c.window.CVPage.go('study.html'),true);const d=next(c,'study',studyOnly);assert.equal(id(d),at);assert.equal(d.ids['undo-answer'].disabled,false);d.click('undo-answer');assert.equal(id(d),first);assert.equal(d.ids['undo-answer'].disabled,true);const after=JSON.stringify(state(d));d.click('undo-answer');assert.equal(JSON.stringify(state(d)),after);assert.notEqual(after,before);assert.equal(d.session[H],undefined);
});

test('review cursor and removed last card undo survive settings roundtrip, direct invalid review IDs stay bounded',()=>{
 const b=mk('study',{...studyOnly,store:{[K]:JSON.stringify(stored('N5'))},url:'https://example.test/nested/study.html?review=N5'});b.click('next');assert.equal(id(b),'2');b.click('known');b.window.CVPage.go('character-settings.html');const c=next(b,'character-settings');c.window.CVPage.go('study.html');const d=next(c,'study',studyOnly);assert.equal(d.ids['study-title'].textContent,'모르겠음 단어 복습');d.click('undo-answer');assert.equal(id(d),'2');assert.equal(state(d).answers['2'],'unknown');for(const at of ['bad','-1','7180','__proto__']){const e=mk('study',{...studyOnly,store:{[K]:JSON.stringify(stored())},url:'https://example.test/nested/study.html?review=N5&at='+at});assert.equal(id(e),'1')}
});

test('stale saved fingerprint never restores older undo/state after settings changes storage',()=>{
 const b=mk('study',{...studyOnly,store:{[K]:JSON.stringify(stored())}});b.click('unknown');b.window.CVPage.go('character-settings.html');const c=next(b,'character-settings');const newer=stored('N1');newer.answers['3']='known';c.store[K]=JSON.stringify(newer);c.window.CVPage.go('study.html');const d=next(c,'study',studyOnly);assert.equal(d.ids.level.value,'N1');assert.equal(d.ids['undo-answer'].disabled,true);assert.deepEqual(state(d),newer);
});

test('reload, direct URL without nonce, mismatched nonce and expired envelope never revive transient undo',()=>{
 for(const variant of ['reload','missing','mismatch','expired']){const b=mk('study',{...studyOnly,store:{[K]:JSON.stringify(stored())}});b.click('known');b.window.CVPage.go('study.html');let u=new URL(b.navigation[0].url);if(variant==='missing')u.searchParams.delete('_cvnav');if(variant==='mismatch')u.searchParams.set('_cvnav','not-matching');if(variant==='expired'){const envelope=JSON.parse(b.session[H]);envelope.created-=120001;b.session[H]=JSON.stringify(envelope)}const c=mk('study',{...studyOnly,store:b.store,session:b.session,url:u.href,navigationType:variant==='reload'?'reload':'navigate'});assert.equal(c.ids['undo-answer'].disabled,true,variant);assert.equal(c.session[H],undefined,variant);assert.equal(c.location.searchParams.has('_cvnav'),false,variant)}
});

test('unsaved progress with denied session storage blocks leaving; allowed same-tab settings handoff preserves in-memory answers',()=>{
 const b=mk('study',{...studyOnly});b.deny(true);b.click('unknown');const expected=id(b);b.denySession(true);assert.equal(b.window.CVPage.go('character-settings.html'),false);assert.equal(b.navigation.length,0);assert.match(b.ids['navigation-status'].textContent,/사라집니다/);b.denySession(false);assert.equal(b.window.CVPage.go('character-settings.html'),true);const c=next(b,'character-settings',{denied:true});c.window.CVPage.go('study.html');const d=next(c,'study',{...studyOnly,denied:true});assert.equal(id(d),expected);assert.equal(d.ids['undo-answer'].disabled,false);d.click('undo-answer');assert.equal(id(d),'1');
});

test('unsaved progress stays intact from study through home and explicit new grade route',async()=>{
 const b=mk('study',{...studyOnly});b.deny(true);b.click('unknown');b.window.CVPage.go('index.html');const c=next(b,'index',{denied:true});assert.equal((await backup(c)).state.answers['1'],'unknown');c.ids['level-buttons'].children[1].children[0].click();const d=next(c,'study',{...studyOnly,denied:true});assert.equal(d.ids.level.value,'N4');d.window.CVPage.go('index.html');const e=next(d,'index',{denied:true});assert.equal((await backup(e)).state.answers['1'],'unknown');
});

test('backup strict validation, preview/cancel, stale read and denied apply preserve record; successful restore is atomic',async()=>{
 const original=stored('N2'),b=mk('index',{store:{[K]:JSON.stringify(original)}}),payload=await backup(b),before=b.store[K];assert.equal(payload.format,'chiikawa-study-record');assert.equal(payload.version,1);assert.equal(payload.dataset,'sha256:2112bf91d9ec0eac1f5212c30e89171a639ac4b156a0a92403b75c4b18df3c5e');await choose(b,payload);assert.equal(b.ids['backup-apply'].disabled,false);assert.equal(b.store[K],before);b.click('backup-cancel');assert.equal(b.ids['backup-apply'].disabled,true);assert.equal(b.store[K],before);
 for(const mutate of [p=>p.version=2,p=>p.dataset='wrong',p=>p.state.level='N0',p=>p.state.positions.N5=-1,p=>p.state.positions.N4=780,p=>p.state.positions.N3=0.5,p=>p.state.answers['0']='known',p=>p.state.answers['1']='bad',p=>p.extra=1]){const p=structuredClone(payload);mutate(p);await choose(b,p);assert.equal(b.ids['backup-apply'].disabled,true);assert.equal(b.store[K],before)}
 let resolve;const pending=b.change('backup-file',{size:100,text:()=>new Promise(r=>resolve=r)});b.click('backup-cancel');resolve(JSON.stringify(payload));await pending;assert.equal(b.ids['backup-apply'].disabled,true);
 const next=structuredClone(payload);next.state.level='N1';next.state.answers={'7180':'known'};await choose(b,next);b.deny(true);b.click('backup-apply');assert.equal(b.store[K],before);assert.match(b.ids['backup-status'].textContent,/실패/);assert.deepEqual((await backup(b)).state,original);b.deny(false);b.click('backup-apply');assert.deepEqual(state(b),next.state);assert.equal(b.ids['backup-apply'].disabled,true);assert.equal(b.window.__cvStudyRead().transactionDepth,0);
});

test('BFCache stale source redirects through a fresh document without overwriting newer study state',async()=>{
 const b=mk('study',{...studyOnly,store:{[K]:JSON.stringify(stored())}});b.click('unknown');await b.fire(b.window,'pagehide',{persisted:true});const newer=stored('N1');newer.answers['5']='unknown';b.store[K]=JSON.stringify(newer);await b.fire(b.window,'pageshow',{persisted:true});assert.equal(b.navigation.at(-1).kind,'replace');assert.deepEqual(state(b),newer);const c=next(b,'study',studyOnly);assert.deepEqual(state(c),newer);assert.equal(c.ids['undo-answer'].disabled,true);assert.equal(c.ids.level.value,'N1');
});

test('BFCache on explicit grade/review URL preserves valid cursor and undo rather than restarting URL selection',async()=>{
 for(const query of ['?level=N5','?review=N5&at=1']){const saved=stored('N5');saved.answers={'1':'unknown','2':'unknown','3':'unknown'};saved.positions.N5=0;const b=mk('study',{...studyOnly,store:{[K]:JSON.stringify(saved)},url:'https://example.test/nested/study.html'+query});b.click('unknown');const position=b.ids.position.textContent;assert.equal(b.ids['undo-answer'].disabled,false);await b.fire(b.window,'pagehide',{persisted:true});await b.fire(b.window,'pageshow',{persisted:true});const c=next(b,'study',studyOnly);assert.equal(c.ids.position.textContent,position,query);assert.equal(c.ids['undo-answer'].disabled,false,query);c.click('undo-answer');assert.equal(id(c),'1',query)}
});

test('home explicit level/review route cannot bypass unsaved-progress block when session storage is denied',async()=>{
 for(const review of [false,true]){const b=mk('study',{...studyOnly});b.deny(true);b.click('unknown');b.window.CVPage.go('index.html');const c=next(b,'index',{denied:true});const before=(await backup(c)).state;c.denySession(true);if(review)c.click('start-review');else c.ids['level-buttons'].children[1].children[0].click();assert.equal(c.navigation.length,0,review?'review':'level');assert.match(c.ids['navigation-status'].textContent,/사라집니다/);assert.deepEqual((await backup(c)).state.answers,before.answers)}
});

test('a second document cannot overwrite newer stored records with a stale in-memory study snapshot',async()=>{
 const b=mk('study',{...studyOnly,store:{[K]:JSON.stringify(stored())}});b.click('unknown');const newer=stored('N1');newer.answers['7']='known';b.store[K]=JSON.stringify(newer);b.click('known');const after=state(b);assert.equal(after.level,'N1');assert.equal(after.answers['7'],'known');assert.deepEqual(after.positions.N4,newer.positions.N4);assert.equal(after.answers['1'],newer.answers['1']);
});

test('unsaved/newer-storage conflict blocks writes and navigation while retaining a working current-window backup action',async()=>{
 const b=mk('study',{...studyOnly,store:{[K]:JSON.stringify(stored('N5'))}});b.deny(true);const marked=id(b);b.click('unknown');const position=b.ids.position.textContent;const newer=stored('N1');newer.answers['7']='known';b.store[K]=JSON.stringify(newer);b.deny(false);b.click('known');assert.deepEqual(state(b),newer);assert.equal(b.ids.position.textContent,position);let button=b.ids['navigation-status'].querySelector('button');assert.ok(button,'conflict backup action');button.click();let exported=JSON.parse(await b.blobs.at(-1).text());assert.equal(exported.state.answers[marked],'unknown');assert.equal(exported.state.answers['7'],undefined);assert.equal(b.window.CVPage.go('character-settings.html'),false);assert.equal(b.navigation.length,0);button=b.ids['navigation-status'].querySelector('button');assert.ok(button,'blocked navigation must retain available backup action');button.click();exported=JSON.parse(await b.blobs.at(-1).text());assert.equal(exported.state.answers[marked],'unknown');assert.deepEqual(state(b),newer);
});

for(const reduced of [false,true])test(`settings reload/roundtrip resets automatic transients and never leaks reduced=${reduced} into saved manual pause`,()=>{
 const store={[K]:JSON.stringify(stored()),'jlpt-pet-visibility-v1':JSON.stringify({schemaVersion:1,visible:Object.fromEntries(['chiikawa','hachiware','usagi','shisa','momonga','rakko'].map(x=>[x,true])),paused:false})};const before=JSON.stringify(store);const b=mk('character-settings',{store,reduced});for(const sel of ['.cv-momonga-fly-auto','.cv-pair-greeting-auto']){const e=b.doc.querySelector(sel);assert.ok(e);assert.equal(e.checked,false);e.checked=true;}assert.equal(JSON.stringify(store),before);b.window.CVPage.go('study.html');const c=next(b,'study',{reduced});assert.equal(c.doc.querySelector('.cv-momonga-fly-auto'),null);c.window.CVPage.go('character-settings.html');const d=next(c,'character-settings',{reduced});for(const sel of ['.cv-momonga-fly-auto','.cv-pair-greeting-auto'])assert.equal(d.doc.querySelector(sel).checked,false);assert.equal(JSON.parse(store['jlpt-pet-visibility-v1']).paused,false);assert.equal(d.ids['pet-toggle'].getAttribute('aria-pressed'),String(reduced));assert.equal(store[K],JSON.parse(before)[K]);
});

test('navigation-to-study startup race cannot promote stale incoming undo to the newer storage fingerprint',()=>{
 const b=mk('study',{...studyOnly,store:{[K]:JSON.stringify(stored('N5'))}});b.click('unknown');b.window.CVPage.go('study.html');const newer=stored('N1');newer.answers['7']='known';let raced=false;const c=next(b,'study',{...studyOnly,beforeScript(src){if(src==='study-runtime.js'){b.store[K]=JSON.stringify(newer);raced=true}}});assert.equal(raced,true);assert.equal(c.ids.level.value,'N1');assert.equal(c.ids['undo-answer'].disabled,true);assert.deepEqual(state(c),newer);c.click('undo-answer');assert.deepEqual(state(c),newer);
});

test('five settings/study document roundtrips keep unique actors, one loop, one pause handler and original learning record',()=>{
 const original=stored();let b=mk('character-settings',{store:{[K]:JSON.stringify(original)}});for(let i=0;i<5;i++){b.window.CVPage.go('study.html');b=next(b,'study');assert.equal(b.doc.querySelectorAll('.cv-pet').length,6);assert.equal(b.raf.size,1);assert.equal(b.ids['pet-toggle'].listeners.get('click').length,1);assert.equal(b.ids.known.listeners.get('click').length,1);assert.deepEqual(state(b),original);b.window.CVPage.go('character-settings.html');b=next(b,'character-settings');assert.equal(b.doc.querySelectorAll('.cv-pet').length,6);assert.equal(b.raf.size,1);assert.equal(b.ids['pet-toggle'].listeners.get('click').length,1);assert.deepEqual(state(b),original)}
});

test('backup async reads are invalidated only after confirmed navigation; modified/blocked navigation preserves pending preview',async()=>{
 const b=mk('index'),payload=await backup(b);let resolve;const pending=b.change('backup-file',{size:100,text:()=>new Promise(r=>resolve=r)});assert.equal(b.window.CVPage.go('character-settings.html'),true);resolve(JSON.stringify(payload));await pending;assert.equal(b.ids['backup-apply'].disabled,true);assert.equal(b.ids['backup-preview'].hidden,true);
 const x=mk('study',{...studyOnly});x.deny(true);x.click('unknown');x.window.CVPage.go('index.html');const c=next(x,'index',{denied:true});const p=await backup(c);await choose(c,p);assert.equal(c.ids['backup-apply'].disabled,false);const a=c.doc.querySelector('a[data-cv-link]');await c.fire(c.doc,'click',{target:a,button:0,ctrlKey:true});assert.equal(c.ids['backup-apply'].disabled,false);c.denySession(true);assert.equal(c.window.CVPage.go('study.html'),false);assert.equal(c.ids['backup-apply'].disabled,false);assert.equal(c.ids['backup-preview'].hidden,false);
});

test('unsaved incoming startup race keeps a recoverable local copy and never overwrites newer durable state',async()=>{
 const b=mk('study',{...studyOnly,store:{[K]:JSON.stringify(stored('N5'))}});b.deny(true);const marked=id(b);b.click('unknown');b.window.CVPage.go('study.html');const newer=stored('N1');newer.answers['7']='known';const c=next(b,'study',{...studyOnly,beforeScript(src){if(src==='study-runtime.js')b.store[K]=JSON.stringify(newer)}});assert.deepEqual(state(c),newer);const recovery=c.ids['navigation-status'].querySelector('button');assert.ok(recovery);recovery.click();const payload=JSON.parse(await c.blobs.at(-1).text());assert.equal(payload.state.answers[marked],'unknown');assert.equal(payload.state.answers['7'],undefined);c.click('known');assert.deepEqual(state(c),newer);assert.equal(c.window.CVPage.go('character-settings.html'),false);assert.ok(c.ids['navigation-status'].querySelector('button'));
});

test('home boundary invalidates prior answer undo while retaining study positions and review-filter preference',async()=>{
 const b=mk('study',{...studyOnly,store:{[K]:JSON.stringify(stored('N5'))},url:'https://example.test/nested/study.html?review=N5'});b.click('unknown');assert.equal(b.ids['undo-answer'].disabled,false);const saved=b.store[K];b.window.CVPage.go('index.html');const c=next(b,'index');assert.equal(c.ids['review-level'].value,'N5');assert.equal(c.store[K],saved);c.window.CVPage.go('study.html');const d=next(c,'study',studyOnly);assert.equal(d.ids['undo-answer'].disabled,true);assert.equal(d.store[K],saved);
});

test('settings BFCache conflict retains original unsaved carrier and working recovery rather than silently dropping it',async()=>{
 const b=mk('study',{...studyOnly,store:{[K]:JSON.stringify(stored('N5'))}});b.deny(true);const marked=id(b);b.click('unknown');b.window.CVPage.go('character-settings.html');const c=next(b,'character-settings',{denied:true});const newer=stored('N1');newer.answers['7']='known';c.store[K]=JSON.stringify(newer);c.deny(false);await c.fire(c.window,'pagehide',{persisted:true});await c.fire(c.window,'pageshow',{persisted:true});assert.equal(c.navigation.length,0,'conflicting unsaved carrier blocks fresh-document replacement');assert.deepEqual(state(c),newer);const recovery=c.ids['navigation-status'].querySelector('button');assert.ok(recovery,'BFCache recovery action');recovery.click();const payload=JSON.parse(await c.blobs.at(-1).text());assert.equal(payload.state.answers[marked],'unknown');assert.equal(payload.state.answers['7'],undefined);
});

test('non-BFCache history restoration retains conflicting unsaved settings carrier for explicit backup',async()=>{
 const b=mk('study',{...studyOnly,store:{[K]:JSON.stringify(stored('N5'))}});b.deny(true);const marked=id(b);b.click('unknown');b.window.CVPage.go('character-settings.html');const c=next(b,'character-settings',{denied:true});await c.fire(c.window,'pagehide',{persisted:true});const historyState=structuredClone(c.window.history.state),newer=stored('N1');newer.answers['7']='known';c.store[K]=JSON.stringify(newer);const d=mk('character-settings',{store:c.store,session:c.session,navigationType:'back_forward',historyState});assert.equal(d.window.CVPage.go('study.html'),false);assert.deepEqual(state(d),newer);const recovery=d.ids['navigation-status'].querySelector('button');assert.ok(recovery,'history recovery action');recovery.click();const payload=JSON.parse(await d.blobs.at(-1).text());assert.equal(payload.state.answers[marked],'unknown');assert.equal(payload.state.answers['7'],undefined);
});

test('selected review-row identity and cursor travel only in one-use storage, never in the document URL',()=>{
 const saved=stored('N5'),b=mk('index',{store:{[K]:JSON.stringify(saved)}});const rows=b.ids['review-rows'].children.flatMap(n=>n.tagName==='TR'?[n]:n.children);assert.ok(rows.length>=2);rows[1].querySelector('button').click();const u=new URL(b.navigation.at(-1).url);assert.equal(leaf(u),'study.html');assert.deepEqual([...u.searchParams.keys()].sort(),['_cvnav','review']);assert.equal(u.searchParams.get('review'),'all');assert.equal(u.hash,'');for(const key of ['at','id','word','answers','positions','reviewIds','reviewIndex','lastAnswer'])assert.equal(u.searchParams.has(key),false,key);const c=next(b,'study',studyOnly);assert.equal(id(c),'2');assert.equal(c.session[H],undefined);assert.equal(c.location.searchParams.has('_cvnav'),false);
 const direct=mk('study',{...studyOnly,store:{[K]:JSON.stringify(saved)},url:'https://example.test/nested/study.html?review=N5&at=2'});assert.equal(id(direct),'1','legacy at parameter must no longer select a learner-specific word');
});
