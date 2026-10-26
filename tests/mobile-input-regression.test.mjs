import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const site=process.env.CV_SEPARATE_TEST_SITE||path.resolve(root,'dist/separate-pages');
const runtime=fs.readFileSync(path.join(site,'pet-runtime.js'),'utf8');
const start=runtime.indexOf('/** AUTHORED_UI held-capture visual candidate.');
const endMarker='  window[INSTANCE] = api; return api;\n}';
const end=runtime.indexOf(endMarker,start)+endMarker.length;
assert.ok(start>=0&&end>start,'exact main engine in shipped runtime');
const source=runtime.slice(start,end);
function fixture({width=500,height=757,overlay=true,paused=false,reduced=false,mobile=false,autonomous=false,characters=['chiikawa']}={}){
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
 const api=ctx.mount({enabledCharacters:characters,startPaused:paused,viewportOverlay:overlay,readOverlayObstacles:()=>rects,onDeliberateInteraction:(...x)=>{interactions.push(x);return true;},mobilePetStages:mobile?{chiikawa:stage}:null,mobileStageViewport:mobile?dock:null,spriteSources:{chiikawa:frames},characterProfiles:{chiikawa:{behavior:autonomous?{idle:0,happy:100}:{idle:100},frames}}});
 const actor=doc.body.children[0].children[0],state=()=>api.getState()[0];
 const step=(ms=20)=>{now+=ms;const jobs=[...raf.values()];raf.clear();for(const fn of jobs){frameCalls++;fn(now);}for(const[k,v]of [...timers])if(v.at<=now){timers.delete(k);v.fn();}};
 const pointer=(type,extra={},target=actor)=>{const p=state(),e=new Event(type,{cancelable:true});Object.assign(e,{button:0,buttons:type==='pointerup'?0:1,isPrimary:true,pointerType:'touch',pointerId:9,clientX:p.x+20,clientY:p.y+20,...extra});target.dispatchEvent(e);return e;};
 step();return{api,actor,doc,win,media,raf,interactions,state,step,pointer,frames:()=>frameCalls,obstacles(next){rects=next;doc.dispatchEvent(new Event('click'));step();},close(){api.destroy();}};
}
for(const width of [360,412,500])test(`study ${width}: fast vertical touch drag, tap preserved, release settles`,()=>{
 const h=fixture({width}),p=h.state();h.pointer('pointerdown',{clientX:p.x+15,clientY:p.y+15});h.step(16);h.pointer('pointermove',{clientX:p.x+35,clientY:p.y-40});assert.equal(h.state().captured,true);assert.ok(h.state().y<p.y);assert.equal(h.interactions.length,0);h.pointer('pointerup');for(let n=0;n<200;n++)h.step();assert.equal(h.state().captured,false);assert.equal(h.state().mode,'idle');assert.equal(h.actor.dataset.captureVisual,undefined);h.pointer('pointerdown');h.step(30);h.pointer('pointerup');assert.equal(h.interactions.length,1);assert.equal(h.interactions[0][1].kind,'pointer-tap');h.close();
});
for(const cancel of ['pointercancel','lostpointercapture'])test(`${cancel}: pending and held touch cannot resurrect`,()=>{
 const h=fixture();h.pointer('pointerdown');h.pointer(cancel);h.step(300);assert.equal(h.state().captured,false);h.pointer('pointerdown');h.pointer('pointermove',{clientY:h.state().y-50});assert.equal(h.state().captured,true);h.pointer(cancel);for(let i=0;i<30;i++)h.step();assert.equal(h.state().captured,false);assert.equal(h.state().mode,'idle');assert.equal(h.interactions.length,0);h.close();
});
test('second finger cancels an active study grab; other pointer cannot steal it',()=>{
 const h=fixture();h.pointer('pointerdown');h.pointer('pointermove',{clientY:h.state().y-50});assert.equal(h.state().captured,true);h.pointer('pointermove',{pointerId:10,clientX:0});assert.equal(h.state().captured,true);h.pointer('pointerdown',{pointerId:10,isPrimary:false},h.doc);assert.equal(h.state().captured,false);h.step(500);assert.equal(h.state().mode,'idle');assert.equal(h.interactions.length,0);h.close();
});
test('outside pending move can acquire; outside pending up cannot cause a late grab',()=>{
 const h=fixture();h.pointer('pointerdown');h.pointer('pointerup',{},h.doc);h.step(300);assert.equal(h.state().captured,false);h.pointer('pointerdown');h.pointer('pointermove',{clientY:h.state().y-40},h.doc);assert.equal(h.state().captured,true);h.pointer('pointercancel');h.close();
});
for(const key of ['paused','reduced'])test(`${key}: explicit drag works, cancellation settles and idle RAF stops`,()=>{
 const h=fixture({[key]:true});h.pointer('pointerdown');h.pointer('pointermove',{clientY:h.state().y-50});assert.equal(h.state().captured,true);h.pointer('pointerup');for(let i=0;i<100;i++)h.step();assert.equal(h.state().captured,false);assert.equal(h.state().mode,'idle');assert.equal(h.raf.size,0);h.close();
});
test('mouse release and frame gaps settle without permanent held pose',()=>{
 const h=fixture();h.pointer('pointerdown',{pointerType:'mouse'});assert.equal(h.state().captured,true);h.step(300);h.pointer('pointermove',{pointerType:'mouse',clientY:h.state().y-70});h.pointer('pointerup',{pointerType:'mouse'});h.step(10000);for(let i=0;i<200;i++)h.step();assert.equal(h.state().captured,false);assert.equal(h.state().mode,'idle');assert.equal(h.actor.dataset.captureVisual,undefined);h.close();
});
test('actor-only touch-action in all modes; dock/blank scroll and controls are untouched',()=>{
 const h=fixture();assert.equal(h.actor.style.touchAction,'none');assert.equal(h.doc.body.style.touchAction,undefined);const e=new Event('scroll',{cancelable:true});h.win.dispatchEvent(e);assert.equal(e.defaultPrevented,false);h.close();const d=fixture({overlay:false,mobile:true});assert.equal(d.actor.style.touchAction,'none');d.pointer('pointerdown');d.pointer('pointermove',{clientY:d.state().y-50});assert.equal(d.state().captured,true);d.pointer('pointercancel');assert.equal(d.state().captured,false);d.close();
});
test('existing idle/pose decision RAF runs; no new walk or default auto setting is introduced',()=>{
 const h=fixture({autonomous:true});const modes=new Set();for(let i=0;i<400;i++){h.step();modes.add(h.state().mode);}assert.ok(h.frames()>=400);assert.ok(modes.has('happy'));assert.ok(!modes.has('walk'));h.close();
});
test('no-space obstacle blocks paint, then invalidation restores eligible actor and RAF',()=>{
 const h=fixture();h.obstacles([{left:0,top:0,right:500,bottom:757}]);assert.equal(h.state().onScreen,false);h.obstacles([]);for(let i=0;i<3;i++)h.step();assert.equal(h.state().onScreen,true);assert.ok(h.raf.size>0);h.close();
});

for(const pointerType of ['mouse','touch'])test(`safe six-actor study drag retains released horizontal position (${pointerType})`,()=>{
 const h=fixture({width:1180,characters:['chiikawa','hachiware','usagi','momonga','rakko','shisa']}),before=h.state();
 h.pointer('pointerdown',{pointerType,clientX:before.x+20,clientY:before.y+20});
 h.pointer('pointermove',{pointerType,clientX:300,clientY:before.y+20});
 assert.equal(h.state().captured,true);assert.equal(h.state().x,280,'chosen body-sized gap is clear of the other five actors');const placed=h.state().x;
 h.step(160);h.pointer('pointerup',{pointerType,clientX:300,clientY:before.y+20});
 for(let i=0;i<80;i++)h.step();assert.equal(h.state().captured,false);assert.equal(h.state().mode,'idle');assert.equal(h.state().x,placed,'no layout reset or x snap when geometry remains safe');h.close();
});
