import test from 'node:test';import assert from 'node:assert/strict';
import {createContinuousWalkEngineAdapter,bindContinuousWalkCancellation} from '../continuous-walk/continuous-walk-engine-adapter.mjs';
const scope='chi-continuous-walk-v1';
function harness(){
 let owned=null,acquired=0,released=0;
 const snap={scope,actorId:'chiikawa',safe:true,enabled:true,visible:true,paused:false,reduced:false,documentHidden:false,inputBusy:false,studyBusy:false,captured:false,physical:false,composing:false,mediaBusy:false,key:'1',revision:1,geometryEpoch:1};
 const engine={readContinuousWalkAdmission:()=>({...snap}),tryAcquireContinuousWalk:()=>{acquired++;return owned={}},ownsContinuousWalk:t=>owned===t,presentContinuousWalk:()=>true,releaseContinuousWalk:t=>{assert.equal(t,owned);owned=null;released++;return true},getPresentationOwner:()=>owned};
 let current=engine;const ui={enabled:true,documentHidden:false,inputBusy:false,mediaBusy:false,composing:false};
 const a=createContinuousWalkEngineAdapter({getEngine:()=>current,readUI:()=>ui});
 return{a,snap,ui,engine,replace:e=>current=e,counts:()=>({acquired,released})};
}
test('missing dedicated API never falls back to generic presentation',()=>{
 let generic=0;const a=createContinuousWalkEngineAdapter({getEngine:()=>({beginExternalPresentation(){generic++}}),readUI:()=>({enabled:true})});assert.equal(a.read(null).safe,false);assert.notEqual(a.owner(),null);assert.equal(generic,0);
});
test('stale snapshot denied, exact lease acquired/released once, wrong token cannot paint/release',()=>{
 const h=harness(),old=h.a.read(null);h.snap.key='2';assert.equal(h.a.acquire(old),null);const expected=h.a.read(null),t=h.a.acquire(expected);assert.ok(t);assert.equal(h.a.owner(),t);assert.equal(h.a.present({},{}),false);assert.equal(h.a.release({},'bad'),false);assert.equal(h.a.present(t,{}),true);h.a.release(t,'stop');h.a.release(t,'again');assert.deepEqual(h.counts(),{acquired:1,released:1});
});
test('engine replacement or wrong actor/scope denies ownership/context',()=>{
 const h=harness();h.snap.actorId='hachiware';assert.equal(h.a.read(null).safe,false);h.snap.actorId='chiikawa';h.snap.scope='old-manual';assert.equal(h.a.read(null).safe,false);h.snap.scope=scope;const t=h.a.acquire(h.a.read(null));h.replace({});assert.equal(h.a.read(t).safe,false);assert.equal(h.a.present(t,{}),false);h.a.release(t,'changed');assert.equal(h.counts().released,1);
});
test('event bridge cancellation no preventDefault/capture grabs; dispose removes listeners',()=>{
 class Target{list=[];addEventListener(t,f){this.list.push([t,f])}removeEventListener(t,f){this.list=this.list.filter(x=>x[0]!==t||x[1]!==f)}fire(t,e={}){for(const [a,f]of this.list.slice())if(a===t)f(e)}}
 const document=new Target(),window=new Target();window.visualViewport=new Target();const reasons=[],controls={contains:t=>t==='control'};const off=bindContinuousWalkCancellation({controller:{stop:r=>reasons.push(r)},window,document,controls});
 document.fire('pointerdown',{target:'control'});assert.equal(reasons.length,0);document.fire('pointerdown',{target:'actor',preventDefault(){throw Error('must not block input')}});assert.deepEqual(reasons,['pointerdown']);
 for(const t of ['keydown','beforeinput','compositionstart','play','vocab:busy'])document.fire(t);
 window.fire('resize');window.fire('pagehide');document.fire('visibilitychange');window.visualViewport.fire('scroll');assert.equal(reasons.length,10);
 off();assert.equal(document.list.length,0);assert.equal(window.list.length,0);assert.equal(window.visualViewport.list.length,0);
});

test('UI changes between preflight and acquire cannot obtain lease',()=>{
 for(const field of ['enabled','inputBusy','mediaBusy','composing','documentHidden']){
  const h=harness(),c=h.a.read(null);h.ui[field]=field==='enabled'?false:true;
  assert.equal(h.a.acquire(c),null);assert.equal(h.counts().acquired,0);
 }
});
