import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const site=process.env.CV_SEPARATE_TEST_SITE||path.resolve(root,'dist/separate-pages');
const runtime=fs.readFileSync(process.env.CV_RUNTIME || path.join(site,'pet-runtime.js'),'utf8');
const start=runtime.indexOf('/** AUTHORED_UI held-capture visual candidate.');
const endMarker='  window[INSTANCE] = api; return api;\n}';
const end=runtime.indexOf(endMarker,start)+endMarker.length;
assert.ok(start>=0&&end>start,'exact main engine in shipped runtime');
const source=runtime.slice(start,end);
function fixture({width=500,height=757,overlay=true,paused=false,reduced=false,mobile=false,autonomous=false,accepted=true}={}){
 let now=0,id=0,frameCalls=0,rects=[];const raf=new Map(),timers=new Map(),interactions=[];
 class E extends EventTarget{
  constructor(){super();this.dataset={};this.style={setProperty(k,v){this[k]=v}};this.hidden=false;this.children=[];this.naturalWidth=390;this.classes=new Set();this.classList={toggle:(k,b)=>b?this.classes.add(k):this.classes.delete(k),remove:k=>this.classes.delete(k)};}
  setAttribute(k,v){this[k]=v;}appendChild(e){this.children.push(e);return e;}remove(){}removeAttribute(k){delete this[k];}querySelector(){return this.img??=new E();}
  setPointerCapture(n){this.capture=n;}hasPointerCapture(n){return this.capture===n;}releasePointerCapture(){this.capture=null;}focus(){doc.activeElement=this;}blur(){doc.activeElement=null;}
 }
 const doc=new E();doc.body=new E();doc.hidden=false;doc.createElement=()=>new E();doc.querySelector=()=>null;doc.querySelectorAll=()=>[];
 const media=new E();media.matches=reduced;const win=new E();Object.assign(win,{innerWidth:width,innerHeight:height,matchMedia:()=>media});
 class I{constructor(){this.naturalWidth=this.naturalHeight=1254;}removeAttribute(k){delete this[k];}decode(){return Promise.resolve();}}
 const math=Object.create(Math);math.random=()=>.25;
 const ctx=vm.createContext({window:win,document:doc,Image:I,AbortController,performance:{now:()=>now},Date,Math:math,requestAnimationFrame:fn=>{raf.set(++id,fn);return id;},cancelAnimationFrame:n=>raf.delete(n),setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;},clearTimeout:n=>timers.delete(n)});
 vm.runInContext(source+';this.mount=mountChiikawaPets;',ctx);
 const dock={getBoundingClientRect:()=>({left:0,right:300,top:400,bottom:600})};const stage={hidden:false,getBoundingClientRect:()=>({left:18,right:158,top:410,bottom:590})};
 const frames={idle:'idle.png',grabbed:'grab.png',happy:'happy.png'};
 const api=ctx.mount({enabledCharacters:['chiikawa'],startPaused:paused,viewportOverlay:overlay,readOverlayObstacles:()=>rects,onDeliberateInteraction:(...x)=>{interactions.push(x);return accepted;},mobilePetStages:mobile?{chiikawa:stage}:null,mobileStageViewport:mobile?dock:null,spriteSources:{chiikawa:frames},characterProfiles:{chiikawa:{behavior:autonomous?{idle:0,happy:100}:{idle:100},frames}}});
 const actor=doc.body.children[0].children[0],state=()=>api.getState()[0];
 const step=(ms=20)=>{now+=ms;const jobs=[...raf.values()];raf.clear();for(const fn of jobs){frameCalls++;fn(now);}for(const[k,v]of [...timers])if(v.at<=now){timers.delete(k);v.fn();}};
 const pointer=(type,extra={},target=actor)=>{const p=state(),e=new Event(type,{cancelable:true});Object.assign(e,{button:0,buttons:type==='pointerup'?0:1,isPrimary:true,pointerType:'touch',pointerId:9,clientX:p.x+20,clientY:p.y+20,...extra});target.dispatchEvent(e);return e;};
 step();return{api,actor,doc,win,media,raf,interactions,state,step,pointer,frames:()=>frameCalls,obstacles(next){rects=next;doc.dispatchEvent(new Event('click'));step();},close(){api.destroy();}};
}

test('implicit child capture transfer does not cancel parent grab',()=>{const h=fixture();h.pointer('pointerdown');h.pointer('pointermove',{clientY:h.state().y-50});assert.equal(h.state().captured,true); const e=new Event('lostpointercapture');Object.assign(e,{pointerId:9,pointerType:'touch'});Object.defineProperty(e,'target',{value:h.actor.querySelector('.cv-pet__figure')});h.actor.dispatchEvent(e);assert.equal(h.state().captured,true,'child implicit capture loss must not cancel parent active capture');h.close();});

test('real parent capture loss still cancels',()=>{const h=fixture();h.pointer('pointerdown');h.pointer('pointermove',{clientY:h.state().y-50});h.pointer('lostpointercapture');assert.equal(h.state().captured,false);h.close();});
for(const mobile of [false,true])test(`settings direct touch drag mobile=${mobile}`,()=>{const h=fixture({overlay:false,mobile});h.pointer('pointerdown');h.pointer('pointermove',{clientY:h.state().y-50});assert.equal(h.state().captured,true);assert.equal(h.actor.style.touchAction,'none');assert.equal(h.doc.body.style.touchAction,undefined);h.pointer('pointerdown',{pointerId:10,isPrimary:false},h.doc);assert.equal(h.state().captured,false);h.close();});

test('child loss without parent ownership still cancels',()=>{const h=fixture();h.pointer('pointerdown');h.pointer('pointermove',{clientY:h.state().y-50});h.actor.capture=null;const e=new Event('lostpointercapture');Object.assign(e,{pointerId:9});Object.defineProperty(e,'target',{value:h.actor.querySelector('.cv-pet__figure')});h.actor.dispatchEvent(e);assert.equal(h.state().captured,false);h.close();});
for(const overlay of [true,false])test(`tap, cancellation and release preserved overlay=${overlay}`,()=>{const h=fixture({overlay});h.pointer('pointerdown');h.step(20);h.pointer('pointerup');assert.equal(h.interactions.length,1);h.pointer('pointerdown');h.pointer('pointercancel');h.step(300);assert.equal(h.state().captured,false);h.pointer('pointerdown');h.pointer('pointermove',{clientY:h.state().y-50,button:-1,buttons:1});assert.equal(h.state().captured,true);h.pointer('pointerup',{button:0,buttons:0});for(let i=0;i<200;i++)h.step();assert.equal(h.state().captured,false);assert.equal(h.state().mode,'idle');h.close();});

for(const phase of ['home','study','review'])test(`declined tap reuses reaction at stable ${phase}`,()=>{const h=fixture({accepted:false});h.win.__cvStudyRead=()=>({phase,transactionDepth:0,composing:false,audioPending:false});h.pointer('pointerdown');h.step(20);h.pointer('pointerup');h.step(120);assert.notEqual(h.state().mode,'idle');assert.equal(h.interactions.length,1);h.close();});
for(const blocked of [{phase:'study',transactionDepth:1,composing:false},{phase:'study',transactionDepth:0,composing:true},{phase:'initializing',transactionDepth:0,composing:false}])test(`declined tap guarded ${JSON.stringify(blocked)}`,()=>{const h=fixture({accepted:false});h.win.__cvStudyRead=()=>blocked;h.pointer('pointerdown');h.step(20);h.pointer('pointerup');h.step(120);assert.equal(h.state().mode,'idle');h.close();});
test('accepted tap never adds fallback reaction',()=>{const h=fixture({accepted:true});h.pointer('pointerdown');h.step(20);h.pointer('pointerup');h.step(120);assert.equal(h.state().mode,'idle');assert.equal(h.interactions.length,1);h.close();});
for(const kind of ['composition','input-focus'])test(`queued fallback is discarded after ${kind}`,()=>{const h=fixture({accepted:false});let composing=false;h.win.__cvStudyRead=()=>({phase:'study',transactionDepth:0,composing});h.pointer('pointerdown');h.step(20);h.pointer('pointerup');if(kind==='composition')composing=true;else h.doc.activeElement={tagName:'INPUT'};h.step(60);assert.equal(h.state().mode,'idle');composing=false;h.doc.activeElement=null;h.step(100);assert.equal(h.state().mode,'idle','must discard, not defer');h.close();});
