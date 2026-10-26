import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {createStepEngineAdapter} from '../chiikawa-pets/reviewed-step-controller.mjs';
const raw=JSON.parse(fs.readFileSync(new URL('../chiikawa-pets/limited-previews/carry-cycle.json',import.meta.url)));
function fixture({paused=false,deferred=false,mobile=false,characters=['chiikawa'],study={phase:'home',busy:false,composing:false,audioPending:false,revision:1}}={}){let now=0,id=0,obstacles=[];const raf=new Map(),timers=new Map(),decoders=[];
 class E extends EventTarget{constructor(){super();this.dataset={};this.style={setProperty(k,v){this[k]=v}};this.hidden=false;this.children=[];this.naturalWidth=390;this.classes=new Set();this.classList={toggle:(k,b)=>b?this.classes.add(k):this.classes.delete(k),remove:k=>this.classes.delete(k)}}setAttribute(k,v){this[k]=v}appendChild(e){this.children.push(e)}remove(){}removeAttribute(k){delete this[k]}querySelector(){return this.img??=new E()}setPointerCapture(n){this.capture=n}hasPointerCapture(n){return this.capture===n}releasePointerCapture(){this.capture=null}focus(){doc.activeElement=this}blur(){doc.activeElement=null}}
 const doc=new E();doc.body=new E();doc.hidden=false;doc.createElement=()=>new E();doc.querySelector=()=>null;doc.querySelectorAll=()=>obstacles.map(r=>({getBoundingClientRect:()=>({...r,width:r.right-r.left,height:r.bottom-r.top})}));const win=new E();win.innerWidth=mobile?500:1000;win.innerHeight=800;win.matchMedia=()=>new E();
 class I{constructor(){this.naturalWidth=this.naturalHeight=1254;}removeAttribute(k){delete this[k]}decode(){return deferred?new Promise(r=>decoders.push(r)):Promise.resolve();}}
 const ctx=vm.createContext({window:win,document:doc,Image:I,AbortController,performance:{now:()=>now},Date,Math,requestAnimationFrame:fn=>{raf.set(++id,fn);return id},cancelAnimationFrame:n=>raf.delete(n),setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id},clearTimeout:n=>timers.delete(n)});
 vm.runInContext(fs.readFileSync(new URL('../chiikawa-pets/pet-engine.js',import.meta.url),'utf8').replaceAll('export function','function')+';this.mount=mountChiikawaPets',ctx);
 const asset={scope:'SOURCE_DERIVED_EXPLICIT_ACTOR_RESPONSE',characterId:'chiikawa',enabledByDefault:false,autonomous:false,rootTravel:false,loop:false,durationMs:1000,frames:raw.frames.map(f=>({...f,source:f.assetPath,scale:0.10841025641025642,left:-7.880923076923068,top:23.27733333333334}))};
 const dock={getBoundingClientRect:()=>({left:0,right:300,top:400,bottom:600})},stage={hidden:false,getBoundingClientRect:()=>({left:18,right:158,top:410,bottom:590})};
 const api=ctx.mount({enabledCharacters:characters,readStudyState:()=>study,startPaused:paused,inlineResponseEnabled:false,inlineResponseAsset:asset,mobilePetStages:mobile?{chiikawa:stage}:null,mobileStageViewport:mobile?dock:null,spriteSources:{chiikawa:{idle:'idle.png',grabbed:'grab.png'},hachiware:{idle:'idle.png'}},characterProfiles:{chiikawa:{behavior:{idle:100},frames:{idle:'idle.png',grabbed:'grab.png'}}}});const actor=doc.body.children[0].children[0];
 return{api,actor,doc,win,decoders,study,step(ms=20){now+=ms;const jobs=[...raf.values()];raf.clear();jobs.forEach(fn=>fn(now));for(const[k,v]of [...timers])if(v.at<=now){timers.delete(k);v.fn();}},pointer(type,extra={}){const p=api.getState()[0],e=new Event(type,{cancelable:true});Object.assign(e,{button:0,isPrimary:true,pointerType:'mouse',pointerId:9,clientX:p.x+30,clientY:p.y+30,...extra});actor.dispatchEvent(e);},obstacle(r){obstacles=[r];doc.dispatchEvent(new Event('click'));}};
}

const PROFILE='chi-foot-v4-expanded-review';
const snapshot=h=>h.api.readAuthoredStepAdmission('chiikawa',null,PROFILE);
test('real engine initial idle admission and exact-token restore preserve x/y/size',()=>{
 const h=fixture(),before=h.api.getState()[0],s=snapshot(h);assert.equal(s.safe,true);assert.equal(before.mode,'idle');assert.ok(s.paintBounds.right-s.paintBounds.left>before.width);
 const token=h.api.tryAcquireAuthoredStepPresentation(s);assert.ok(token);assert.equal(h.api.getState()[0].visible,false);assert.equal(h.api.ownsExternalPresentation('chiikawa',token),true);
 for(let i=0;i<300;i++)h.step();const during=h.api.getState()[0];for(const k of ['x','y','width','height','mode'])assert.equal(during[k],before[k]);
 h.api.endExternalPresentation('chiikawa',{});assert.equal(h.api.ownsExternalPresentation('chiikawa',token),true);
 h.api.endExternalPresentation('chiikawa',token);const after=h.api.getState()[0];assert.equal(after.visible,true);for(const k of ['x','y','width','height','mode'])assert.equal(after[k],before[k]);h.api.destroy();
});
test('unknown scope, actor, fabricated bounds and changed study cannot acquire',()=>{
 const h=fixture();assert.equal(h.api.readAuthoredStepAdmission('chiikawa').safe,false);assert.equal(h.api.readAuthoredStepAdmission('chiikawa',null,'anything').safe,false);
 const s=snapshot(h);for(const [id,scope] of [['hachiware','bad'],['usagi',null],['chiikawa',null]])assert.equal(h.api.tryAcquireAuthoredStepPresentation(h.api.readAuthoredStepAdmission(id,null,scope)),null);assert.equal(h.api.tryAcquireAuthoredStepPresentation({...s,actorId:'usagi'}),null);assert.equal(h.api.tryAcquireAuthoredStepPresentation({...s,profile:'anything'}),null);assert.equal(h.api.tryAcquireAuthoredStepPresentation({...s,paintBounds:{...s.paintBounds,left:0}}),null);
 h.study.revision++;assert.equal(h.api.tryAcquireAuthoredStepPresentation(s),null);h.api.destroy();
});
test('expanded canvas collision outside source actor rejects and narrow screen rejects',()=>{
 const h=fixture();const s=snapshot(h),p=h.api.getState()[0];assert.ok(s.paintBounds.left<p.x);h.obstacle({left:s.paintBounds.left,top:s.paintBounds.top,right:p.x-1,bottom:s.paintBounds.bottom});assert.equal(snapshot(h).safe,false);h.api.destroy();const m=fixture({mobile:true});assert.equal(snapshot(m).safe,false);m.api.destroy();
});
test('Hachi default and Chi exact profile share exclusive non-preempting registry',()=>{
 const h=fixture({characters:['chiikawa','hachiware']});const hs=h.api.readAuthoredStepAdmission('hachiware');assert.equal(hs.safe,true);assert.equal(hs.profile,undefined);
 const t=h.api.tryAcquireAuthoredStepPresentation(hs);assert.ok(t);assert.equal(snapshot(h).safe,false);assert.equal(h.api.tryAcquireAuthoredStepPresentation(snapshot(h)),null);h.api.endExternalPresentation('hachiware',t);assert.equal(snapshot(h).safe,true);h.api.destroy();
});
test('real engine plus adapter accepts exact full canvas, rejects mismatched geometry and competitor',()=>{
 const h=fixture();let valid=true;const bridge=createStepEngineAdapter({profile:PROFILE,getEngine:()=>h.api,readUI:()=>({enabled:true,inputBusy:false,mediaBusy:false,composing:false,documentHidden:false}),readGeometry:()=>{const r=snapshot(h).paintBounds;return{union:r,stage:valid?r:{...r,right:r.right-1},viewport:{left:0,top:0,right:1000,bottom:800},obstacles:[]};}});
 assert.equal(bridge.context().safe,true);valid=false;assert.equal(bridge.acquire(),null);valid=true;assert.equal(bridge.context().safe,true);const t=bridge.acquire();assert.ok(t);assert.equal(bridge.owner(),t);assert.equal(bridge.context().safe,true);assert.equal(bridge.release({}),false);assert.equal(bridge.release(t),true);bridge.destroy();h.api.destroy();
});
test('paused real engine exposes static review eligibility, without automatic start',()=>{const h=fixture({paused:true});const s=snapshot(h);assert.equal(s.safe,true);assert.equal(s.paused,true);assert.equal(h.api.getPresentationOwner(),null);h.api.destroy();});
test('peer reaction blocks Chi then naturally returns to eligible idle; lease blocks new reactions',()=>{const h=fixture({characters:['chiikawa','hachiware']});h.api.react('correct','hachiware');assert.equal(snapshot(h).safe,false);h.step(200);assert.equal(snapshot(h).safe,false);for(let i=0;i<80;i++)h.step(20);assert.equal(snapshot(h).safe,true);const token=h.api.tryAcquireAuthoredStepPresentation(snapshot(h));assert.ok(token);h.api.react('correct','hachiware');for(let i=0;i<300;i++)h.step(20);assert.ok(h.api.getState().every(p=>p.mode==='idle'));assert.equal(h.api.ownsExternalPresentation('chiikawa',token),true);h.api.endExternalPresentation('chiikawa',token);h.api.destroy();});
