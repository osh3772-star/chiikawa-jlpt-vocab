import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createContinuousWalkController,CONTINUOUS_WALK_SCOPE} from '../continuous-walk/continuous-walk-controller.mjs';
import {sweptPaintSafe,proposeWalkPath} from '../continuous-walk/continuous-walk-geometry.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('../continuous-walk/art.json',import.meta.url)));
function setup(options={}){
 let time=0,owner=null,release=0,decode=0,cleanup=0,calls=[],raf=new Map(),timers=new Map(),id=0;
 const c={scope:CONTINUOUS_WALK_SCOPE,safe:true,enabled:true,visible:true,paused:false,reduced:false,documentHidden:false,inputBusy:false,studyBusy:false,captured:false,physical:false,composing:false,mediaBusy:false,mount:{},revision:1,geometryEpoch:1,key:'stable',path:[{x:20,y:20},{x:44,y:20}],speed:16};
 const host={read:()=>({...c}),owner:()=>owner,acquire:()=>owner={},present:(l,p)=>{assert.equal(l,owner);calls.push(p);return options.rejectPaint!==true},release:l=>{assert.equal(l,owner);owner=null;release++}};
 const controller=createContinuousWalkController({fixture:structuredClone(fixture),host,decode:async()=>{decode++;if(options.decode)await options.decode;return{cleanup(){cleanup++}}},now:()=>time,requestFrame:f=>{raf.set(++id,f);return id},cancelFrame:i=>raf.delete(i),setTimer:f=>{timers.set(++id,f);return id},clearTimer:i=>timers.delete(i)});
 return{controller,c,host,step(dt=60){time+=dt;const f=[...raf.values()][0];raf.clear();f?.()},timer(dt){time+=dt;const f=[...timers.values()][0];timers.clear();f?.()},get counts(){return{release,decode,cleanup,paints:calls.length,raf:raf.size,timers:timers.size,owner}},calls};
}
test('OFF zero decode RAF timer lease; ON alone zero; explicit starts; repeats >2 cycles with movement',async()=>{
 const s=setup();assert.equal(await s.controller.start(),false);assert.deepEqual(s.counts,{release:0,decode:0,cleanup:0,paints:0,raf:0,timers:0,owner:null});s.controller.setEnabled(true);assert.equal(s.counts.decode,0);assert.equal(await s.controller.start(),true);
 for(let i=0;i<52;i++)s.step();assert.ok(s.controller.getState().cycles>=2);assert.ok(s.calls.some(p=>p.to.x!==p.from.x));assert.equal(s.counts.decode,1);s.controller.setEnabled(false);assert.equal(s.counts.release,1);assert.equal(s.counts.cleanup,1);assert.equal(s.counts.raf,0);assert.equal(s.counts.timers,0);
});
for(const field of ['paused','reduced','documentHidden','inputBusy','studyBusy','captured','physical','composing','mediaBusy'])test(field+' cancels without restart',async()=>{
 const s=setup();s.controller.setEnabled(true);await s.controller.start();s.c[field]=true;s.step();assert.equal(s.controller.getState().mode,'off');assert.equal(s.counts.release,1);s.c[field]=false;s.step();assert.equal(s.counts.decode,1);
});
test('unsafe, geometry revision, resized epoch and missing path fail closed',async()=>{
 for(const field of ['safe','revision','geometryEpoch']){const s=setup();s.controller.setEnabled(true);await s.controller.start();s.c[field]=field==='safe'?false:2;s.step();assert.equal(s.controller.getState().mode,'off');}
 const s=setup();s.c.path=null;s.controller.setEnabled(true);assert.equal(await s.controller.start(),false);assert.equal(s.counts.decode,0);
});
test('cancel during async decode cleans stale result with no lease/paint',async()=>{
 let done;const s=setup({decode:new Promise(r=>done=r)});s.controller.setEnabled(true);const pending=s.controller.start();s.controller.stop('pointerdown');done();assert.equal(await pending,false);assert.equal(s.counts.paints,0);assert.equal(s.counts.release,0);assert.equal(s.counts.cleanup,1);
});
test('late RAF and watchdog cancel rather than skip exposures; clock reversal cancels',async()=>{
 for(const dt of [121,-1,NaN]){const s=setup();s.controller.setEnabled(true);await s.controller.start();s.step(dt);assert.equal(s.controller.getState().mode,'off');}
 const s=setup();s.controller.setEnabled(true);await s.controller.start();s.timer(301);assert.equal(s.controller.getState().mode,'off');assert.equal(s.counts.release,1);
});
test('swept whole box rejects crossed button even endpoints clear, malformed rect, narrow boundary',()=>{
 const a={bounds:{left:10,top:10,right:20,bottom:20},from:{x:10,y:10},to:{x:50,y:10},viewport:{left:0,top:0,right:100,bottom:100},obstacles:[]};
 assert.equal(sweptPaintSafe(a),true);assert.equal(sweptPaintSafe({...a,obstacles:[{left:30,top:0,right:40,bottom:30}]}),false);assert.equal(sweptPaintSafe({...a,obstacles:[{}]}),false);
 assert.equal(proposeWalkPath({position:a.from,bounds:a.bounds,viewport:{left:0,top:0,right:25,bottom:100},obstacles:[]}),null);
});

test('synchronous stop inside tick paint keeps off position cleared and no RAF resurrection',async()=>{
 const s=setup();s.controller.setEnabled(true);await s.controller.start();
 s.host.present=()=>{s.controller.stop('pointerdown-during-paint');return true;};s.step();
 assert.equal(s.controller.getState().mode,'off');assert.equal(s.controller.getState().position,null);assert.equal(s.counts.raf,0);assert.equal(s.counts.release,1);
});

test('diagnostic distinguishes geometry revision without changing the fail-closed decision',async()=>{for(const [field,cause]of [['geometryEpoch','geometry-epoch-changed'],['revision','study-revision-changed']]){const s=setup();s.controller.setEnabled(true);await s.controller.start();s.c[field]++;s.step();const out=s.controller.getState();assert.equal(out.reason,'context-changed');assert.equal(out.diagnostic.cause,cause);assert.equal(out.diagnostic.previousMode,'walking');assert.equal(s.counts.release,1);}});
test('diagnostic preserves exact delayed-frame and watchdog gaps at unchanged thresholds',async()=>{const a=setup();a.controller.setEnabled(true);await a.controller.start();a.step(120);assert.equal(a.controller.getState().mode,'walking');a.step(121);assert.equal(a.controller.getState().reason,'invalid-or-delayed-frame');assert.equal(a.controller.getState().diagnostic.frameGapMs,121);const b=setup();b.controller.setEnabled(true);await b.controller.start();b.timer(301);assert.equal(b.controller.getState().reason,'frame-stalled');assert.equal(b.controller.getState().diagnostic.frameGapMs,301);});
