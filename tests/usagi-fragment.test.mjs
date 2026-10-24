import test from 'node:test';
import assert from 'node:assert/strict';
import {usagiFragmentAsset,createUsagiFragmentController,bindUsagiCancellation} from '../chiikawa-pets/usagi-fragment.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return {resolve,reject,promise};};
function fixture(extra={}) {
  let began=0,ended=0,cleaned=0,next=0;const draws=[],queue=new Map();
  const context={visible:true,paused:false,reduced:false},image={style:{},dataset:{},removeAttribute(){},set src(value){draws.push({source:value,style:{...this.style}});}},rail={},clip={style:{}},status={};
  const asset=usagiFragmentAsset('a','b','c');
  const result=()=>({images:['A','B','C'],cleanup(){cleaned++;}});
  const c=createUsagiFragmentController({asset,image,rail,clip,status,getContext:()=>context,onBegin:()=>{began++;return true;},onEnd:()=>ended++,
    loadImages:async()=>result(),readClip:()=>({left:0,top:0,right:200,bottom:160,width:200,height:160}),
    requestFrame:fn=>{queue.set(next,fn);return next++;},cancelFrame:id=>queue.delete(id),...extra});
  return {c,context,image,rail,clip,status,asset,draws,queue,result,counts:()=>({began,ended,cleaned}),tick(now){const entries=[...queue];queue.clear();entries.forEach(([,fn])=>fn(now));}};
}
test('one-shot A B empty, no C or repeat; lease released once',async()=>{
 const f=fixture();assert.equal(await f.c.start(),true);assert.equal(await f.c.start(),false);
 f.tick(100);f.tick(749);assert.equal(f.c.getState().pose,'A');f.tick(750);assert.equal(f.c.getState().pose,'B');
 f.tick(1400);assert.deepEqual(f.draws.map(x=>x.source),['a','b']);assert.equal(f.c.getState().mode,'off');assert.equal(f.image.hidden,true);assert.equal(f.queue.size,0);
 f.c.cancel();assert.equal(f.counts().ended,1);
});
test('C requires separate explicit start from empty, remains still',async()=>{
 const f=fixture();await f.c.start();assert.equal(await f.c.showLaterStill(),false);f.c.cancel();assert.equal(await f.c.showLaterStill(),true);
 assert.equal(f.c.getState().pose,'C');assert.equal(f.c.getState().mode,'static');assert.equal(f.queue.size,0);assert.match(f.status.textContent,/별도 컷/);
});
for(const preference of ['paused','reduced'])test(`${preference} uses A static without scheduler`,async()=>{const f=fixture();f.context[preference]=true;await f.c.start();assert.equal(f.c.getState().pose,'A');assert.equal(f.c.getState().mode,'static');assert.equal(f.queue.size,0);});
for(const reason of ['escape','next','back','rating','hidden','resize','blur'])test(`${reason} invalidates pending decode`,async()=>{
 const d=deferred();let signal;const f=fixture({loadImages:(_,o)=>{signal=o.signal;return d.promise;}});const p=f.c.start();f.c.cancel(reason);assert.equal(signal.aborted,true);d.resolve(f.result());assert.equal(await p,false);assert.equal(f.image.hidden,true);assert.equal(f.counts().began,0);assert.equal(f.counts().cleaned,1);
});
test('cancellation during prepare cannot resurrect and newer start owns generation',async()=>{
 const d=deferred();let n=0;const f=fixture({prepareStage:()=>++n===1?d.promise:Promise.resolve()});const old=f.c.start();await Promise.resolve();await Promise.resolve();f.c.cancel('next');await f.c.start();d.resolve();assert.equal(await old,false);assert.equal(f.c.getState().mode,'sequence');assert.equal(f.counts().began,1);
});
test('exact per-pose isotropic crop and airborne gaps remain registered',async()=>{
 const f=fixture();await f.c.start();f.tick(0);f.tick(650);f.c.cancel();await f.c.showLaterStill();
 for(let i=0;i<3;i++){
  const a=f.draws[i].style,p=f.asset.frames[i],[l,t,r,b]=p.sourceRect,[sw,sh]=p.assetSize;
  assert.ok(Math.abs(parseFloat(a.width)/sw-p.scale)<1e-14);
  assert.ok(Math.abs(parseFloat(a.height)/sh-p.scale)<1e-14);
  assert.equal(parseFloat(a.left),p.left-l*p.scale);assert.equal(parseFloat(a.top),p.top-t*p.scale);
  assert.equal(a.clipPath,`inset(${t*p.scale}px ${(sw-r)*p.scale}px ${(sh-b)*p.scale}px ${l*p.scale}px)`);
 }
 const B=f.asset.frames[1];assert.ok(Math.abs(142-(parseFloat(f.draws[1].style.top)+B.sourceRect[3]*B.scale)-9.873417721518988)<1e-10);
});
test('mutated registration rejected',async()=>{const a=usagiFragmentAsset('a','b','c');a.frames[1].scale*=2;const f=fixture({asset:a});assert.equal(await f.c.start(),false);});
test('unsafe stage, denied lease, decode error stay hidden',async()=>{
 for(const extra of [{readObstacles:()=>[{left:1,right:20,top:1,bottom:20}]},{onBegin:()=>false},{loadImages:async()=>{throw Error('bad');}}]){
 const f=fixture(extra);assert.equal(await f.c.start(),false);assert.equal(f.image.hidden,true);assert.equal(f.queue.size,0);}
});
test('preference changes terminate sequence and destroy prevents reopening',async()=>{const f=fixture();await f.c.start();f.context.reduced=true;f.tick(0);assert.equal(f.c.getState().mode,'off');f.c.destroy();assert.equal(await f.c.start(),false);});
test('event bindings cancel even during loading and detach cleanly',()=>{
 const w=new EventTarget(),d=new EventTarget(),s=new EventTarget(),reasons=[];
 const detach=bindUsagiCancellation({cancel:r=>reasons.push(r)},{windowTarget:w,documentTarget:d,studyTarget:s});
 const key=new Event('keydown');key.key='Escape';w.dispatchEvent(key);w.dispatchEvent(new Event('blur'));w.dispatchEvent(new Event('resize'));d.hidden=true;d.dispatchEvent(new Event('visibilitychange'));s.dispatchEvent(new Event('click'));
 assert.deepEqual(reasons,['escape','blur','resize','hidden','study-input']);detach();w.dispatchEvent(key);assert.equal(reasons.length,5);
});
