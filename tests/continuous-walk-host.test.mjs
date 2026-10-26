import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createStudyState} from '../chiikawa-pets/study-state.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const site=process.env.CV_SEPARATE_TEST_SITE||path.resolve(root,'dist/separate-pages');
const runtime=fs.readFileSync(path.join(site,'pet-runtime.js'),'utf8');
const start=runtime.indexOf('/** AUTHORED_UI held-capture visual candidate.');
const endMarker='  window[INSTANCE] = api; return api;\n}';
const end=runtime.indexOf(endMarker,start)+endMarker.length;
assert.ok(start>=0&&end>start,'exact main engine in shipped runtime');
const source=runtime.slice(start,end);
function fixture({width=500,height=757,overlay=true,paused=false,reduced=false,mobile=false,autonomous=false}={}){
 let now=0,id=0,frameCalls=0,rects=[];const guard=createStudyState();guard.setPhase('study');const study={};const raf=new Map(),timers=new Map(),interactions=[];
 class E extends EventTarget{
  constructor(){super();this.dataset={};this.style={setProperty(k,v){this[k]=v}};this.hidden=false;this.children=[];this.naturalWidth=390;this.classes=new Set();this.classList={toggle:(k,b)=>b?this.classes.add(k):this.classes.delete(k),remove:k=>this.classes.delete(k)};}
  setAttribute(k,v){this[k]=v;}appendChild(e){this.children.push(e);return e;}remove(){}removeAttribute(k){delete this[k];}querySelector(){return this.img??=new E();}
  setPointerCapture(n){this.capture=n;}hasPointerCapture(n){return this.capture===n;}releasePointerCapture(){this.capture=null;}focus(){doc.activeElement=this;}blur(){doc.activeElement=null;}
 }
 const doc=new E();doc.body=new E();doc.hidden=false;doc.createElement=()=>new E();doc.querySelector=()=>null;doc.querySelectorAll=()=>[];doc.getElementById=()=>null;doc.documentElement=new E();
 const media=new E();media.matches=reduced;const win=new E();Object.assign(win,{innerWidth:width,innerHeight:height,matchMedia:()=>media});
 class I{constructor(){this.naturalWidth=this.naturalHeight=1254;}removeAttribute(k){delete this[k];}decode(){return Promise.resolve();}}
 const math=Object.create(Math);math.random=()=>.25;
 const ctx=vm.createContext({window:win,document:doc,Image:I,AbortController,performance:{now:()=>now},Date,Math:math,getComputedStyle:()=>({transform:'none',filter:'none',contain:'none'}),MutationObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>{raf.set(++id,fn);return id;},cancelAnimationFrame:n=>raf.delete(n),setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;},clearTimeout:n=>timers.delete(n)});
 vm.runInContext(source+';this.mount=mountChiikawaPets;',ctx);
 const dock={getBoundingClientRect:()=>({left:0,right:300,top:400,bottom:600})};const stage={hidden:false,getBoundingClientRect:()=>({left:18,right:158,top:410,bottom:590})};
 const frames={idle:'idle.png',grabbed:'grab.png',happy:'happy.png'};
 const api=ctx.mount({readStudyState:()=>({...guard.read(),...study}),enabledCharacters:['chiikawa'],startPaused:paused,viewportOverlay:overlay,readOverlayObstacles:()=>rects,onDeliberateInteraction:(...x)=>{interactions.push(x);return true;},mobilePetStages:mobile?{chiikawa:stage}:null,mobileStageViewport:mobile?dock:null,spriteSources:{chiikawa:frames},characterProfiles:{chiikawa:{behavior:autonomous?{idle:0,happy:100}:{idle:100},frames}}});
 const actor=doc.body.children[0].children[0],state=()=>api.getState()[0];
 const step=(ms=20)=>{now+=ms;const jobs=[...raf.values()];raf.clear();for(const fn of jobs){frameCalls++;fn(now);}for(const[k,v]of [...timers])if(v.at<=now){timers.delete(k);v.fn();}};
 const pointer=(type,extra={},target=actor)=>{const p=state(),e=new Event(type,{cancelable:true});Object.assign(e,{button:0,buttons:type==='pointerup'?0:1,isPrimary:true,pointerType:'touch',pointerId:9,clientX:p.x+20,clientY:p.y+20,...extra});target.dispatchEvent(e);return e;};
 step();return{api,actor,doc,win,media,raf,interactions,state,study,guard,step,pointer,now:()=>now,requestFrame:fn=>{raf.set(++id,fn);return id;},cancelFrame:n=>raf.delete(n),setTimer:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;},clearTimer:n=>timers.delete(n),frames:()=>frameCalls,rawObstacles(next){rects=next;},obstacles(next){rects=next;doc.dispatchEvent(new Event('click'));step();},close(){api.destroy();}};
}

import {createContinuousWalkController} from '../continuous-walk/continuous-walk-controller.mjs';
import {createContinuousWalkEngineAdapter} from '../continuous-walk/continuous-walk-engine-adapter.mjs';
const art=JSON.parse(fs.readFileSync(path.join(root,'continuous-walk/art.json'),'utf8'));
const read=h=>h.api.readContinuousWalkAdmission({scope:'chi-continuous-walk-v1',actorId:'chiikawa'});
const acquire=h=>{const s=read(h);assert.equal(s.safe,true,JSON.stringify(s));const token=h.api.tryAcquireContinuousWalk(s);assert.ok(token);return{token,s}};
for(const width of [360,412,500,1180])test(`continuous ${width}: exact scope/path lease paints all frames on original actor and restores`,()=>{
 const h=fixture({width}),before=h.state(),{token,s}=acquire(h);assert.equal(h.api.ownsContinuousWalk(token),true);let from=s.path[0];
 for(let i=0;i<30;i++){const to={x:from.x+(i<15?1:-1),y:from.y};assert.equal(h.api.presentContinuousWalk(token,{from,to,frame:art.frames[i%12]}),true);from=to;}
 assert.equal(h.actor.dataset.assetMode,'authored-continuous-walk');assert.equal(h.state().frame,'continuous-walk-05');assert.equal(h.doc.body.children.length,1);h.api.releaseContinuousWalk(token,'test');assert.equal(h.api.getPresentationOwner(),null);assert.equal(h.actor.dataset.continuousWalk,undefined);assert.equal(h.state().frame,'idle');assert.equal(h.actor.style.width,'');h.pointer('pointerdown');h.pointer('pointermove',{clientY:h.state().y-40});assert.equal(h.state().captured,true);h.pointer('pointercancel');h.close();
});
test('continuous requires correct actor/scope and study viewport, not old manual admission bypass',()=>{
 const h=fixture();assert.equal(h.api.readContinuousWalkAdmission({scope:'bad',actorId:'chiikawa'}).safe,false);assert.equal(h.api.readContinuousWalkAdmission({scope:'chi-continuous-walk-v1',actorId:'hachiware'}).safe,false);assert.equal(h.api.readAuthoredStepAdmission('chiikawa',null,'chi-foot-v4-expanded-review').safe,false);h.close();const d=fixture({overlay:false});assert.equal(read(d).safe,false);d.close();
});
test('continuous stale epoch, wrong token/frame/from/to and swept obstacle all deny without movement',()=>{
 const h=fixture(),s=read(h);h.obstacles([{left:1,top:1,right:2,bottom:2}]);assert.equal(h.api.tryAcquireContinuousWalk(s),null);const {token,s:current}=acquire(h),from=current.path[0],to={x:from.x+1,y:from.y};
 for(const pose of [{from,to,frame:{...art.frames[0],source:'https://bad.invalid/x.png'}},{from:{x:from.x+1,y:from.y},to,frame:art.frames[0]},{from,to:{x:from.x+100,y:from.y},frame:art.frames[0]}])assert.equal(h.api.presentContinuousWalk(token,pose),false);
 assert.equal(h.api.presentContinuousWalk({}, {from,to,frame:art.frames[0]}),false);assert.equal(h.state().x,from.x);h.obstacles([{left:0,top:0,right:500,bottom:757}]);assert.equal(h.api.presentContinuousWalk(token,{from,to,frame:art.frames[0]}),false);h.api.releaseContinuousWalk(token);h.close();
});
for(const type of ['pause','pointer','learning','resize','hidden','destroy'])test(`continuous ${type} preempts lease and restores once`,()=>{
 const h=fixture(),{token,s}=acquire(h);h.api.presentContinuousWalk(token,{from:s.path[0],to:s.path[0],frame:art.frames[0]});
 if(type==='pause')h.api.pause();if(type==='pointer')h.pointer('pointerdown');if(type==='learning')h.api.react('correct');if(type==='resize')h.win.dispatchEvent(new Event('resize'));if(type==='hidden'){h.doc.hidden=true;h.doc.dispatchEvent(new Event('visibilitychange'));}if(type==='destroy')h.api.destroy();
 assert.equal(h.api.ownsContinuousWalk(token),false);assert.equal(h.actor.dataset.continuousWalk,undefined);assert.equal(h.api.releaseContinuousWalk(token),false);assert.equal(h.api.presentContinuousWalk(token,{from:s.path[0],to:s.path[0],frame:art.frames[0]}),false);h.close();
});
test('continuous pending study/audio/reduced/paused state denies with no state mutation',()=>{
 for(const field of ['composing','audioPending']){const h=fixture();h.study[field]=true;const before=h.state();assert.equal(read(h).safe,false);assert.equal(h.state().x,before.x);h.close();}
 for(const field of ['paused','reduced']){const h=fixture({[field]:true});assert.equal(read(h).safe,false);h.close();}
});

test('actual controller plus actual host run 3+ cycles, cancel with no idle restart or second actor DOM',async()=>{
 const h=fixture(),ui={enabled:true,documentHidden:false,inputBusy:false,mediaBusy:false,composing:false};let cleanup=0;
 const adapter=createContinuousWalkEngineAdapter({getEngine:()=>h.api,readUI:()=>ui});
 const controller=createContinuousWalkController({fixture:art,host:adapter,decode:async()=>({cleanup(){cleanup++}}),now:h.now,requestFrame:h.requestFrame,cancelFrame:h.cancelFrame,setTimer:h.setTimer,clearTimer:h.clearTimer});
 controller.setEnabled(true);assert.equal(await controller.start(),true);const begin=h.state().x;let moved=false;
 for(let i=0;i<250;i++){h.step(20);if(h.state().x!==begin)moved=true;}
 assert.equal(controller.getState().mode,'walking');assert.ok(controller.getState().cycles>=3);assert.equal(moved,true);assert.equal(h.doc.body.children[0].children.length,1);
 h.pointer('pointerdown');h.step();assert.equal(controller.getState().mode,'off');assert.equal(h.api.getPresentationOwner(),null);assert.equal(cleanup,1);h.pointer('pointermove',{clientY:h.state().y-40});assert.equal(h.state().captured,true);h.pointer('pointercancel');h.step(1000);assert.equal(controller.getState().mode,'off');controller.destroy();adapter.destroy();h.close();
});

test('real createStudyState keeps legacy busy=true in idle study/review but only transactions block new walking',()=>{
 const h=fixture({width:1180});for(const phase of ['study','review']){h.guard.setPhase(phase);assert.equal(h.guard.read().busy,true);assert.equal(h.guard.read().transactionDepth,0);assert.equal(read(h).safe,true);h.guard.run(()=>{assert.equal(h.guard.read().transactionDepth,1);assert.equal(read(h).safe,false);});assert.equal(read(h).safe,true);}
 h.guard.setComposing(true);assert.equal(read(h).safe,false);h.guard.setComposing(false);assert.equal(read(h).safe,true);
 h.doc.activeElement={closest:()=>({})};assert.equal(read(h).safe,false);h.doc.activeElement=null;
 h.study.transactionDepth=undefined;assert.equal(read(h).safe,false);delete h.study.transactionDepth;
 h.guard.setPhase('home');assert.equal(read(h).safe,false);assert.equal(h.guard.read().busy,false);assert.equal(h.api.readAuthoredStepAdmission('chiikawa',null,'chi-foot-v4-expanded-review').safe,true);h.close();
});

test('admission reason reports actual viewport margin, safe path and active guards without bypass',()=>{
 const h=fixture({width:1180}),before=h.state();h.pointer('pointerdown',{pointerType:'mouse',clientX:before.x+20,clientY:before.y+20});h.pointer('pointermove',{pointerType:'mouse',clientX:42.5,clientY:601});h.step(160);h.pointer('pointerup',{pointerType:'mouse',clientX:42.5,clientY:601});for(let i=0;i<80;i++)h.step();
 assert.ok(Math.abs(h.state().x-22.5)<1e-9);assert.equal(read(h).reason,'outside-viewport');const p=h.state();h.pointer('pointerdown',{pointerType:'mouse',clientX:p.x+20,clientY:p.y+20});h.pointer('pointermove',{pointerType:'mouse',clientX:60,clientY:p.y+20});h.step(160);h.pointer('pointerup',{pointerType:'mouse',clientX:60,clientY:p.y+20});for(let i=0;i<80;i++)h.step();assert.equal(read(h).safe,true);assert.equal(read(h).reason,null);h.api.pause();assert.equal(read(h).reason,'paused');h.close();
});

const placementRead=h=>h.api.readContinuousWalkAdmission({scope:'chi-continuous-placement-v1',actorId:'chiikawa'});
function moveStationary(h,x,y=h.state().y){const p=h.state();h.pointer('pointerdown',{pointerType:'mouse',clientX:p.x+20,clientY:p.y+20});h.pointer('pointermove',{pointerType:'mouse',clientX:x+20,clientY:y+20});h.step(160);h.pointer('pointerup',{pointerType:'mouse',clientX:x+20,clientY:y+20});for(let i=0;i<80;i++)h.step();}
test('placement scope read has no side effects; old start does not relocate; exact lease places after preflight',()=>{
 const h=fixture({width:1180});moveStationary(h,22.5);const origin=h.state();assert.equal(read(h).reason,'outside-viewport');assert.equal(h.api.tryAcquireContinuousWalk(read(h)),null);assert.equal(h.state().x,origin.x);
 const planned=placementRead(h);assert.equal(planned.safe,true);assert.equal(planned.requiresExplicitPlacement,true);assert.equal(h.state().x,origin.x);assert.equal(h.api.getPresentationOwner(),null);
 const token=h.api.tryAcquireContinuousWalk(planned);assert.ok(token);assert.equal(h.state().x,planned.path[0].x);assert.equal(h.api.readContinuousWalkAdmission({scope:'chi-continuous-walk-v1',actorId:'chiikawa',lease:token}).safe,false);assert.equal(h.api.presentContinuousWalk(token,{from:planned.path[0],to:planned.path[0],frame:art.frames[0]}),true);
 h.api.releaseContinuousWalk(token,'manual-stop');assert.equal(h.state().x,origin.x);assert.equal(h.state().y,origin.y);assert.equal(h.state().frame,'idle');h.close();
});
test('placement stale fresh geometry/key rejects atomically without actor movement or a lease',()=>{
 const h=fixture({width:1180});moveStationary(h,22.5);const before=h.state(),planned=placementRead(h);h.rawObstacles([{left:0,top:0,right:1180,bottom:757}]);assert.equal(h.api.tryAcquireContinuousWalk(planned),null);assert.equal(h.state().x,before.x);assert.equal(h.api.getPresentationOwner(),null);assert.equal(placementRead(h).safe,false);h.close();
});
test('placement never bypasses pause, transaction, composing, media or legacy manual scope',()=>{
 const h=fixture({width:1180});for(const field of ['composing','audioPending']){h.study[field]=true;assert.equal(placementRead(h).safe,false);delete h.study[field];}
 h.guard.run(()=>assert.equal(placementRead(h).safe,false));h.api.pause();assert.equal(placementRead(h).reason,'paused');h.api.resume();assert.equal(h.api.readAuthoredStepAdmission('chiikawa',null,'chi-foot-v4-expanded-review').safe,false);h.close();
});
test('placement cancelled at unsafe origin retains a currently safe endpoint, not a blind return',()=>{
 const h=fixture({width:1180});moveStationary(h,22.5);const origin=h.state();h.rawObstacles([{left:152.5,top:580,right:1100,bottom:757}]);const planned=placementRead(h);assert.equal(planned.safe,true);assert.ok(planned.path[0].y<origin.y);const token=h.api.tryAcquireContinuousWalk(planned);assert.ok(token);assert.equal(h.api.presentContinuousWalk(token,{from:planned.path[0],to:planned.path[0],frame:art.frames[0]}),true,JSON.stringify({planned,state:h.state(),admission:h.api.readContinuousWalkAdmission({scope:planned.scope,actorId:'chiikawa',lease:token})}));
 const endpoint=h.state();h.rawObstacles([{left:0,top:580,right:1100,bottom:757}]);h.api.releaseContinuousWalk(token,'manual-stop');assert.equal(h.state().x,endpoint.x);assert.equal(h.state().y,endpoint.y);assert.equal(h.state().frame,'idle');h.close();
});
test('direct pointer capture preempts placement without taking actor back from the pointer',()=>{
 const h=fixture({width:1180});moveStationary(h,22.5);h.rawObstacles([{left:152.5,top:580,right:1100,bottom:757}]);const planned=placementRead(h),token=h.api.tryAcquireContinuousWalk(planned);assert.ok(token);assert.equal(h.api.presentContinuousWalk(token,{from:planned.path[0],to:planned.path[0],frame:art.frames[0]}),true,JSON.stringify({planned,state:h.state(),admission:h.api.readContinuousWalkAdmission({scope:planned.scope,actorId:'chiikawa',lease:token})}));const point=h.state();h.pointer('pointerdown',{pointerType:'mouse'});assert.equal(h.api.ownsContinuousWalk(token),false);assert.equal(h.state().captured,true);assert.equal(h.state().x,point.x);assert.equal(h.state().y,point.y);h.pointer('pointercancel');h.close();
});
test('placement controller checks fresh geometry after delayed decode and does not relocate on rejection',async()=>{
 const h=fixture({width:1180});moveStationary(h,22.5);const before=h.state();let done;const bridge=createContinuousWalkEngineAdapter({getEngine:()=>h.api,readUI:()=>({enabled:true,placementRequested:true,documentHidden:false,inputBusy:false,composing:false,mediaBusy:false})});
 const controller=createContinuousWalkController({fixture:art,host:bridge,decode:()=>new Promise(resolve=>done=resolve),now:h.now,requestFrame:h.requestFrame,cancelFrame:h.cancelFrame,setTimer:h.setTimer,clearTimer:h.clearTimer});controller.setEnabled(true);const pending=controller.start();h.rawObstacles([{left:0,top:0,right:1180,bottom:757}]);done({cleanup(){}});assert.equal(await pending,false);assert.equal(h.state().x,before.x);assert.equal(h.api.getPresentationOwner(),null);controller.destroy();bridge.destroy();h.close();
});
test('placement actual controller loops at safe endpoint, then manual stop safely restores original body',async()=>{
 const h=fixture({width:1180});moveStationary(h,22.5);const before=h.state();const bridge=createContinuousWalkEngineAdapter({getEngine:()=>h.api,readUI:()=>({enabled:true,placementRequested:true,documentHidden:false,inputBusy:false,composing:false,mediaBusy:false})});
 const controller=createContinuousWalkController({fixture:art,host:bridge,decode:async()=>({cleanup(){}}),now:h.now,requestFrame:h.requestFrame,cancelFrame:h.cancelFrame,setTimer:h.setTimer,clearTimer:h.clearTimer});controller.setEnabled(true);assert.equal(await controller.start(),true);assert.ok(h.state().x>before.x);for(let i=0;i<250;i++)h.step();assert.equal(controller.getState().mode,'walking');assert.ok(controller.getState().cycles>=3);controller.stop('manual-stop');assert.equal(h.state().x,before.x);assert.equal(h.state().y,before.y);controller.destroy();bridge.destroy();h.close();
});
