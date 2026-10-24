import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function setup(file='pet-engine.js',opts={}) {
 let now=0,id=0,calls=0,writes=0; const queue=new Map();
 class E extends EventTarget {
 constructor(){super();this.dataset={};this.hidden=false;this.children=[];this.style=new Proxy({setProperty(k,v){this[k]=v;}},{set(o,k,v){if(k==='transform')writes++;o[k]=v;return true;}});this.classList={toggle(){},remove(){}};}
 setAttribute(){} appendChild(x){this.children.push(x)} remove(){} querySelector(){return this.img??=new E()}
 setPointerCapture(id){this.capture=id} hasPointerCapture(id){return this.capture===id} releasePointerCapture(){this.capture=null}
 }
 const doc=new E();doc.body=new E();doc.hidden=false;doc.createElement=()=>new E();doc.querySelector=()=>null;doc.querySelectorAll=()=>[];
 const media=new E();media.matches=!!opts.reduced;
 const win=new E();win.innerWidth=1200;win.innerHeight=800;win.matchMedia=()=>media;
 let observer;
 const ctx=vm.createContext({document:doc,window:win,Image:class{},performance:{now:()=>now},Date,ResizeObserver:class{constructor(fn){observer=fn}observe(){}disconnect(){}},requestAnimationFrame:fn=>{queue.set(++id,fn);return id},cancelAnimationFrame:id=>queue.delete(id)});
 vm.runInContext(fs.readFileSync(new URL('../chiikawa-pets/'+file,import.meta.url),'utf8').replaceAll('export function','function')+';this.mount=mountChiikawaPets;',ctx);
 const cancelled=[];const api=ctx.mount({enabledCharacters:['chiikawa'],startPaused:!!opts.paused,onPresentationCancelled:r=>cancelled.push(r),...(opts.mount??{})});
 const el=doc.body.children[0].children[0];
 return {api,el,win,doc,media,cancelled,observer:()=>observer(),count:()=>({calls,writes,pending:queue.size}),step(n=1){for(let i=0;i<n;i++){now+=20;const batch=[...queue.values()];queue.clear();for(const fn of batch){calls++;fn(now)}assert.ok(queue.size<=1,'single RAF');}},close(){api.destroy();assert.equal(queue.size,0)}};
}
function emit(el,type,props={}){const e=new Event(type,{cancelable:true});Object.assign(e,props);el.dispatchEvent(e);}
test('settled paused and reduced actors stop after one initial scheduler callback',()=>{for(const opts of [{paused:true},{reduced:true}]){const e=setup('pet-engine.js',opts);e.step(500);assert.equal(e.count().calls,1);assert.equal(e.count().pending,0);e.close();}});
test('initial render; invalidate, pause/resume, resize, hidden/reselection and preference wakes',()=>{
 const e=setup('pet-engine.js',{paused:true});assert.ok(e.el.style.transform);e.step(2);assert.equal(e.count().pending,0);
 for(const [el,type] of [[e.doc,'click'],[e.doc,'change'],[e.doc,'vocab:view'],[e.win,'scroll'],[e.win,'resize']]){emit(el,type);assert.equal(e.count().pending,1);e.step(2);assert.equal(e.count().pending,0)}
 e.observer();e.step(2);assert.equal(e.count().pending,0);
 e.api.resume();e.step(100);assert.equal(e.count().pending,1);e.api.pause();e.step(2);assert.equal(e.count().pending,0);
 e.doc.hidden=true;emit(e.doc,'visibilitychange');assert.equal(e.count().pending,0);e.api.resume();assert.equal(e.count().pending,0);
 e.doc.hidden=false;emit(e.doc,'visibilitychange');e.step();assert.equal(e.count().pending,1);
 e.api.setVisibleCharacters([]);assert.equal(e.count().pending,0);e.api.setVisibleCharacters(['chiikawa']);assert.equal(e.count().pending,1);
 emit(e.media,'change',{matches:true});e.step(2);assert.equal(e.count().pending,0);emit(e.media,'change',{matches:false});e.step();assert.equal(e.count().pending,1);e.close();
});
test('paused direct reaction wakes and settles, touch hold and lost capture preserved',()=>{
 const e=setup('pet-engine.js',{paused:true});e.step(2);e.api.react('correct');assert.equal(e.count().pending,1);e.step(5);assert.equal(e.api.getState()[0].mode,'correct');e.step(100);assert.equal(e.count().pending,0);
 emit(e.el,'pointerdown',{button:0,pointerType:'touch',pointerId:1,clientX:600,clientY:650});e.step(20);assert.equal(e.api.getState()[0].captured,true);
 emit(e.el,'pointermove',{pointerId:1,clientX:650,clientY:250});assert.ok(e.api.getState()[0].y<300);
 emit(e.el,'lostpointercapture',{pointerId:1});e.step(2);assert.equal(e.api.getState()[0].captured,false);assert.equal(e.count().pending,0);e.close();
});
test('release physics completes; explicit external preview is cancelled on pause/resize/visibility',()=>{
 const e=setup();emit(e.el,'pointerdown',{button:0,pointerId:2,clientX:600,clientY:650});e.step(15);emit(e.el,'pointermove',{pointerId:2,clientX:650,clientY:150});emit(e.el,'pointerup',{pointerId:2});e.step(8);assert.equal(e.api.getState()[0].airborne,true);e.step(150);assert.equal(e.api.getState()[0].mode,'idle');
 for(const action of [()=>e.api.pause(),()=>emit(e.win,'resize'),()=>{e.doc.hidden=true;emit(e.doc,'visibilitychange')}]){assert.equal(e.api.beginExternalPresentation('chiikawa'),true);action();assert.equal(e.api.getExternalPresentation(),null)}
 assert.deepEqual(e.cancelled,['pause-or-motion-preference','resize','visibility']);e.close();
});

test('explicit opted-in beta preview still runs and pause cancels it',()=>{
 const frames=[{frameId:'a',source:'fixture-a',durationMs:100},{frameId:'b',source:'fixture-b',durationMs:100}];
 const betaManifest={approvalStatus:'draft',experimental:true,actions:{'step-in-place':{views:{front:{loop:true,frames}}}}};
 const e=setup('pet-engine.js',{mount:{experimentalCharacters:['chiikawa'],characterProfiles:{chiikawa:{betaManifest}}}});
 assert.equal(e.api.playAction('walk'),true);e.step(8);assert.equal(e.api.getState()[0].mode,'step-in-place');assert.equal(e.api.getState()[0].assetMode,'beta-sequence');
 e.api.pause();e.step(2);assert.equal(e.api.getState()[0].mode,'idle');assert.equal(e.count().pending,0);assert.equal(e.api.playAction('walk'),false);
 e.api.resume();assert.equal(e.api.playAction('walk'),true);e.step(200);assert.equal(e.api.getState()[0].mode,'idle');e.close();
});
