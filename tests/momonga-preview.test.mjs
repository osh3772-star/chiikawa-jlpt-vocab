import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planMomongaPreviewPath, sampleMomongaPreviewPath, createMomongaPreviewController} from '../chiikawa-pets/momonga-preview.js';
const rect={left:20,right:620,top:100,bottom:278};
function fixture(extra={}){
 const image={style:{},hidden:true},rail={hidden:true},status={};let callback,id=0,starts=0,ends=0;
 const context={visible:true,paused:false,reduced:false};
 const asset={testingAuthorized:true,enabledByDefault:false,productionEnabled:false,bodyPoseCount:1,sourceRepresentation:'DERIVED_REFERENCE_CUTOUT',durationOrigin:'AUTHORED_WEB_UX',assetSize:[1627,967],source:'image',durationMs:1800};
 const api=createMomongaPreviewController({asset,image,rail,status,getContext:()=>context,onBegin:()=>{starts++;return true;},onEnd:()=>ends++,readRail:()=>rect,loadImage:async()=>{},requestFrame:fn=>{callback=fn;return ++id;},cancelFrame:()=>{callback=null;},...extra});
 return {api,image,rail,status,context,step:t=>{const f=callback;callback=null;f?.(t);},counts:()=>[starts,ends]};
}
test('safe path checks the entire swept rectangle, not just endpoints',()=>{
 const p=planMomongaPreviewPath(rect,[1627,967]);assert.ok(p);assert.ok(p.end.x>p.start.x);
 assert.equal(planMomongaPreviewPath(rect,[1627,967],[{left:315,right:325,top:140,bottom:220}]),null);
 assert.equal(planMomongaPreviewPath({...rect,right:150},[1627,967]),null);
 assert.deepEqual(sampleMomongaPreviewPath(p,2),p.end);
});
test('one pose translates once with constant geometry, then restores base',async()=>{
 const f=fixture();assert.equal(await f.api.start(),true);const size=[f.image.style.width,f.image.style.height];
 f.step(10);const before=f.image.style.transform;f.step(910);assert.notEqual(f.image.style.transform,before);
 assert.deepEqual([f.image.style.width,f.image.style.height],size);assert.doesNotMatch(f.image.style.transform,/rotate|scale|skew/);
 f.step(1810);assert.deepEqual(f.counts(),[1,1]);assert.equal(f.rail.hidden,false);assert.equal(f.api.getState().active,false);
});
test('repeated start acquires only one external body and cancellation is idempotent',async()=>{
 const f=fixture();await f.api.start();await f.api.start();assert.deepEqual(f.counts(),[2,1]);f.api.cancel();f.api.cancel();assert.deepEqual(f.counts(),[2,2]);
});
test('hide during pending decode cannot resurrect a stale preview',async()=>{
 let resolve;const f=fixture({loadImage:()=>new Promise(r=>resolve=r)});const pending=f.api.start();f.context.visible=false;f.api.cancel('hidden');resolve();assert.equal(await pending,false);assert.deepEqual(f.counts(),[0,0]);assert.equal(f.rail.hidden,true);
});
test('latest pause while decoding yields static pose, explicitly closed not auto-looped',async()=>{
 let resolve;const f=fixture({loadImage:()=>new Promise(r=>resolve=r)});const pending=f.api.start();f.context.paused=true;resolve();await pending;assert.equal(f.api.getState().mode,'static');f.step(9999);assert.equal(f.api.getState().active,true);f.api.cancel();assert.deepEqual(f.counts(),[1,1]);
});
test('reduced motion is static and pause during movement safely cancels',async()=>{
 const f=fixture();f.context.reduced=true;await f.api.start();assert.equal(f.api.getState().mode,'static');f.api.cancel();f.context.reduced=false;await f.api.start();f.context.paused=true;f.step(20);assert.equal(f.api.getState().active,false);
});
test('blocked path, hidden character and decode error do not acquire base actor',async()=>{
 for(const extra of [{readObstacles:()=>[rect]},{loadImage:()=>Promise.reject(new Error('bad png'))}]){const f=fixture(extra);assert.equal(await f.api.start(),false);assert.deepEqual(f.counts(),[0,0]);assert.equal(f.image.hidden,true);}
 const f=fixture();f.context.visible=false;assert.equal(await f.api.start(),false);assert.deepEqual(f.counts(),[0,0]);
});

test('automatic completion and cancellation retain opened rail; explicit close collapses it',async()=>{
 const f=fixture();await f.api.start();f.step(0);f.step(1800);assert.equal(f.rail.hidden,false);
 await f.api.start();f.api.cancel('hidden');assert.equal(f.rail.hidden,false);assert.equal(f.image.hidden,true);
 f.api.cancel('closed');assert.equal(f.rail.hidden,true);
});
