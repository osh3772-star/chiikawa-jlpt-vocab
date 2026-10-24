import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hachiwareTwoPoseAsset,hachiwarePoseGeometry,createHachiwareTwoPoseController} from '../chiikawa-pets/hachiware-two-pose.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture(extra={}) {
  const asset=hachiwareTwoPoseAsset('A.png','B.png'),image={style:{},dataset:{}},clip={style:{}},rail={},status={};
  const context={visible:true,paused:false,reduced:false};let begins=0,ends=0,resources=0,next=0;const pending=new Map();
  const controller=createHachiwareTwoPoseController({asset,image,clip,rail,status,getContext:()=>context,
    onBegin:()=>{begins++;return true;},onEnd:()=>ends++,loadImage:async()=>()=>resources++,
    readClip:()=>({width:120,height:102,left:0,right:120,top:0,bottom:102}),
    requestFrame:fn=>{const id=next++;pending.set(id,fn);return id;},cancelFrame:id=>pending.delete(id),...extra});
  return {controller,asset,image,clip,rail,status,context,pending,counts:()=>[begins,ends,resources],
    tick(time){const callbacks=[...pending.values()];pending.clear();callbacks.forEach(fn=>fn(time));}};
}
test('default off, top/head anchoring uniform, common bottom clip never stretches torso',async()=>{
  const f=fixture();assert.equal(f.controller.getState().mode,'off');assert.equal(f.image.hidden,true);assert.equal(f.pending.size,0);
  for(const frame of f.asset.frames){const g=hachiwarePoseGeometry(frame),scale=g.width/1536;
    assert.equal(g.width/g.height,1.5);assert.equal(g.left+frame.headRect[0]*scale,0);assert.equal(g.top+frame.headRect[1]*scale,0);assert.ok(Math.abs(frame.headRect[2]*scale-120)<1e-10);}
  await f.controller.start();const height=f.clip.style.height;f.tick(0);f.tick(650);assert.equal(f.clip.style.height,height);assert.equal(height,'102px');
});
test('one authored A then B only, no auto return, repeat running click ignored',async()=>{
  const f=fixture();assert.equal(await f.controller.start(),true);assert.equal(await f.controller.start(),false);
  const poses=[];for(const time of [0,649,650,1299,1300,9999]){f.tick(time);poses.push(f.controller.getState().pose);}
  assert.deepEqual(poses,['A','A','B','B','B','B']);assert.equal(f.controller.getState().mode,'complete');assert.equal(f.pending.size,0);
  assert.equal(f.controller.getState().motionPlayback,false);assert.deepEqual(f.counts(),[1,0,0]);
  await f.controller.start();assert.deepEqual(f.counts(),[1,0,1]);f.controller.cancel('closed');f.controller.cancel('closed');assert.deepEqual(f.counts(),[1,1,2]);assert.equal(f.rail.hidden,true);
});
test('paused or reduced starts static A without scheduler, changed preference resets to A',async()=>{
  for(const pref of ['paused','reduced']){const f=fixture();f.context[pref]=true;await f.controller.start();assert.equal(f.controller.getState().mode,'static');assert.equal(f.controller.getState().pose,'A');assert.equal(f.pending.size,0);}
  const f=fixture();await f.controller.start();f.tick(0);f.tick(700);f.context.reduced=true;f.tick(800);assert.equal(f.controller.getState().pose,'A');assert.equal(f.controller.getState().mode,'static');
});
test('every integration cancellation reason invalidates pending decode and releases late resources',async()=>{
  for(const reason of ['study-next','study-back','study-rating','study-input','escape','hidden','resize','superseded','engine-remount']){
    const d=deferred();let signal,clean=0;const f=fixture({loadImage:(_,{signal:s})=>{signal=s;return d.promise;}});
    const start=f.controller.start();assert.equal(f.controller.getState().mode,'loading');assert.equal(await f.controller.start(),false);
    f.controller.cancel(reason);assert.equal(signal.aborted,true);d.resolve(()=>clean++);assert.equal(await start,false);
    assert.equal(f.image.hidden,true);assert.deepEqual(f.counts(),[0,0,0]);assert.equal(clean,1);assert.equal(f.pending.size,0);
  }
});
test('cancel during stage preparation cannot acquire lease',async()=>{
  const d=deferred();let signal;const f=fixture({prepareStage:({signal:s})=>{signal=s;return d.promise;}});
  const start=f.controller.start();await Promise.resolve();f.controller.cancel('resize');assert.equal(signal.aborted,true);d.resolve();assert.equal(await start,false);assert.deepEqual(f.counts(),[0,0,1]);
});
test('stale decode rejection cannot cancel newer valid preview',async()=>{
  const d=deferred();let calls=0;const f=fixture({loadImage:()=>++calls===1?d.promise:Promise.resolve()});
  const first=f.controller.start();f.controller.cancel('escape');await f.controller.start();d.reject(new Error('late failure'));assert.equal(await first,false);assert.equal(f.controller.getState().mode,'sequence');assert.deepEqual(f.counts(),[1,0,0]);
});
test('decode failure, lease denial, invalid art and obstruction fail closed',async()=>{
  for(const extra of [{loadImage:async()=>{throw Error('decode');}},{onBegin:()=>false},{asset:{...hachiwareTwoPoseAsset('A','B'),loop:true}},{readObstacles:()=>[{left:0,right:120,top:0,bottom:102}]}]){
    const f=fixture(extra);assert.equal(await f.controller.start(),false);assert.equal(f.image.hidden,true);assert.equal(f.controller.getState().mode,'off');assert.equal(f.pending.size,0);assert.equal(f.counts()[1],0);
  }
});
test('cancel removes zero-valued scheduler handle, stale callback cannot resurrect actor',async()=>{
  const f=fixture();await f.controller.start();const stale=[...f.pending.values()][0];f.controller.cancel('study-input');assert.equal(f.pending.size,0);stale(9999);assert.equal(f.image.hidden,true);assert.deepEqual(f.counts(),[1,1,1]);
});
test('destroy is terminal, idempotent and cleans visible resource lease',async()=>{
  const f=fixture();await f.controller.start();f.controller.destroy();f.controller.destroy();assert.equal(await f.controller.start(),false);assert.deepEqual(f.counts(),[1,1,1]);assert.equal(f.pending.size,0);assert.equal(f.rail.hidden,true);
});
test('stale scheduler callback does not erase newer scheduler ownership',async()=>{
  const f=fixture();await f.controller.start();const stale=[...f.pending.values()][0];f.controller.cancel('escape');await f.controller.start();stale(1000);f.controller.cancel('escape');assert.equal(f.pending.size,0);assert.deepEqual(f.counts(),[2,2,2]);
});
test('default decoder cleans failed, aborted and successful image resources',async()=>{
  const {decodeHachiwareFrames}=await import('../chiikawa-pets/hachiware-two-pose.mjs');const previous=globalThis.Image;
  try {
    for(const mode of ['success','fail','abort']){
      const images=[],d=deferred();globalThis.Image=class {constructor(){images.push(this);}removeAttribute(name){assert.equal(name,'src');this.src='';}decode(){return mode==='fail'?Promise.reject(Error('decode')):mode==='abort'?d.promise:Promise.resolve();}};
      const controller=new AbortController();const work=decodeHachiwareFrames(hachiwareTwoPoseAsset('A','B').frames,{signal:controller.signal});
      if(mode==='abort'){controller.abort();d.resolve();}
      if(mode==='success'){const cleanup=await work;assert.equal(images[0].src,'A');cleanup();}
      else await assert.rejects(work);
      assert.ok(images.every(image=>image.src===''));
    }
  } finally {globalThis.Image=previous;}
});
