import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewCoordinator,cameoGeometry,createStaticCameoController,sampleCameoFrame,shouldCancelPreviewForStudyInput} from '../chiikawa-pets/static-cameo.js';
const asset={testingAuthorized:true,enabledByDefault:false,productionEnabled:false,bodyPoseCount:1,reviewScope:'LIMITED_STATIC_CAMEO_VISUAL_PASS',sourceRepresentation:'DERIVED_UPPERBODY_CAMEO',sourceRect:[245,99,972,915],assetSize:[1448,1086],displayWidth:120,source:'reviewed'};
function fixture(extra={}){const image={style:{},dataset:{}},clip={style:{}},rail={},status={},context={visible:true};let begin=0,end=0;
 const api=createStaticCameoController({asset,image,clip,rail,status,getContext:()=>context,onBegin:()=>{begin++;return true;},onEnd:()=>end++,loadImage:async()=>{},readClip:()=>({width:120,height:113,left:0,right:120,top:0,bottom:113}),...extra});
 return {api,image,clip,rail,status,context,counts:()=>[begin,end]};}
test('cameo geometry is single uniform crop, not anatomy reconstruction',()=>{
 const g=cameoGeometry(asset);assert.equal(g.width,120);assert.equal(g.imageWidth/g.imageHeight,1448/1086);assert.ok(Math.abs(g.left+245*120/972)<1e-10);assert.ok(g.height<115);
 assert.equal(cameoGeometry({...asset,sourceRect:[0,0,2000,1000]}),null);
});
test('reviewed A is static only; close restores actor once and collapses rail',async()=>{
 const f=fixture();assert.equal(await f.api.start(),true);assert.equal(f.api.getState().motionPlayback,false);assert.equal(f.api.getState().mode,'static');
 assert.equal(f.image.hidden,false);assert.equal(f.image.style.transform,undefined);f.api.cancel('closed');f.api.cancel('closed');assert.deepEqual(f.counts(),[1,1]);assert.equal(f.rail.hidden,true);
});
test('lifecycle cancel preserves opened rail space and cannot resurrect hidden actor',async()=>{
 const f=fixture();await f.api.start();f.context.visible=false;f.api.cancel('hidden');assert.equal(f.image.hidden,true);assert.equal(f.rail.hidden,false);assert.equal(await f.api.start(),false);assert.deepEqual(f.counts(),[1,1]);
});
test('pending decode is invalidated by cancel',async()=>{
 let resolve;const f=fixture({loadImage:()=>new Promise(r=>resolve=r)});const p=f.api.start();f.api.cancel('hidden');resolve();assert.equal(await p,false);assert.deepEqual(f.counts(),[0,0]);
});
test('unreviewed scope or obstructed crop cannot acquire base actor',async()=>{
 for(const option of [{asset:{...asset,bodyPoseCount:4}},{readObstacles:()=>[{left:10,right:100,top:10,bottom:100}]},{loadImage:()=>Promise.reject(new Error('missing'))}]){
  const f=fixture(option);assert.equal(await f.api.start(),false);assert.deepEqual(f.counts(),[0,0]);assert.equal(f.image.hidden,true);
 }
});
test('shared coordinator cancels other pending/active previews before starting requested one',async()=>{
 const coordinator=createPreviewCoordinator();let resolve;
 const a=fixture({loadImage:()=>new Promise(r=>resolve=r)}),b=fixture();coordinator.register('A',a.api);coordinator.register('B',b.api);
 const pending=coordinator.start('A');await coordinator.start('B');resolve();assert.equal(await pending,false);assert.equal(a.api.getState().active,false);assert.equal(b.api.getState().active,true);
 coordinator.cancelAll('pause');assert.equal(coordinator.anyActive(),false);assert.deepEqual(b.counts(),[1,1]);
});
test('static representation remains static with paused/reduced context',async()=>{
 const f=fixture({getContext:()=>({visible:true,paused:true,reduced:true})});await f.api.start();assert.equal(f.api.getState().mode,'static');f.api.cancel();
});

test('Escape ownership includes pending decode, not only visible animation',async()=>{
 let resolve;const f=fixture({loadImage:()=>new Promise(r=>resolve=r)});const c=createPreviewCoordinator();c.register('A',f.api);
 const pending=c.start('A');assert.equal(c.anyActive(),false);assert.equal(c.hasOpen(),true);
 if(c.hasOpen())c.cancelAll('escape');resolve();assert.equal(await pending,false);assert.equal(f.api.getState().active,false);assert.equal(c.hasOpen(),false);
});
const four={...asset,bodyPoseCount:4,reviewScope:'LIMITED_FOUR_KEYPOSE_PREVIEW',timingOrigin:'AUTHORED_WEB_UX',loop:false,interpolation:false,windowSize:[140,124],
 frames:['A','A1','B','C'].map((poseId,i)=>({...asset,poseId,source:poseId,durationMs:[420,320,450,600][i]}))};
test('discrete authored sequence is A A1 B C only, no interpolation or looping',async()=>{
 let callback;const f=fixture({asset:four,readClip:()=>({width:140,height:124,left:0,right:140,top:0,bottom:124}),requestFrame:fn=>(callback=fn,1),cancelFrame:()=>callback=null});
 await f.api.start();assert.equal(await f.api.start(),false);const poses=[];
 for(const t of [0,420,740,1190,1790]){const fn=callback;callback=null;fn?.(t);poses.push(f.api.getState().pose);}
 assert.deepEqual(poses,['A','A1','B','C','C']);assert.equal(f.api.getState().mode,'complete');assert.equal(callback,null);assert.deepEqual(f.counts(),[1,0]);
 f.api.cancel('closed');assert.deepEqual(f.counts(),[1,1]);assert.equal(f.image.hidden,true);
});
test('fourpose reduced/paused preview is A only; preferencechange cancels running sequence',async()=>{
 let callback;const context={visible:true,reduced:true,paused:false};const f=fixture({asset:four,getContext:()=>context,readClip:()=>({width:140,height:124,left:0,right:140,top:0,bottom:124}),requestFrame:fn=>(callback=fn,1),cancelFrame:()=>callback=null});
 await f.api.start();assert.equal(f.api.getState().pose,'A');assert.equal(f.api.getState().mode,'static');assert.equal(callback,undefined);
 f.api.cancel();context.reduced=false;await f.api.start();context.paused=true;callback(0);assert.equal(f.api.getState().active,false);
});
test('public integration Escape uses pending-aware coordinator while scroll remains active-only',async()=>{
 const {readFile}=await import('node:fs/promises');const code=await readFile(new URL('../chiikawa-pets/integration.js',import.meta.url),'utf8');
 assert.match(code,/event.key==='Escape'&&previewCoordinator.hasOpen\(\)/);assert.match(code,/if\(previewCoordinator.anyActive\(\)\)previewCoordinator.cancelAll\('scroll'\)/);
});

test('study input, explicit pause and engine remount cancel pending preview ownership',async()=>{
 const {readFile}=await import('node:fs/promises');const code=await readFile(new URL('../chiikawa-pets/integration.js',import.meta.url),'utf8');
 for(const reason of ['study-input','pause-change','engine-remount'])assert.ok(code.includes(`previewCoordinator.cancelAll('${reason}')`));
});

test('explicit completed replay retains actor ownership without base-pet flash',async()=>{
 let callback;const f=fixture({asset:four,readClip:()=>({width:140,height:124,left:0,right:140,top:0,bottom:124}),requestFrame:fn=>(callback=fn,1),cancelFrame:()=>callback=null});
 await f.api.start();callback(0);callback(1790);assert.equal(f.api.getState().mode,'complete');await f.api.start();assert.deepEqual(f.counts(),[1,0]);f.api.cancel('closed');assert.deepEqual(f.counts(),[1,1]);
});

test('actual next/previous click and study arrow input cancel even without vocab:view event',async()=>{
 let resolve;const f=fixture({loadImage:()=>new Promise(r=>resolve=r)}),c=createPreviewCoordinator();c.register('cameo',f.api);const pending=c.start('cameo');
 const nextClick={type:'click',target:{closest:selector=>selector==='main'?{}:null}};
 assert.equal(shouldCancelPreviewForStudyInput(nextClick,true),true);if(shouldCancelPreviewForStudyInput(nextClick,true))c.cancelAll('study-input');resolve();assert.equal(await pending,false);assert.equal(f.api.getState().active,false);
 const arrow={type:'keydown',key:'ArrowRight',target:{closest:()=>null}};
 assert.equal(shouldCancelPreviewForStudyInput(arrow,true),true);assert.equal(shouldCancelPreviewForStudyInput(arrow,false),false);
 assert.equal(shouldCancelPreviewForStudyInput({...arrow,ctrlKey:true},true),false);
 assert.equal(shouldCancelPreviewForStudyInput({...arrow,target:{closest:()=>({})}},true),false);
 assert.equal(shouldCancelPreviewForStudyInput({type:'click',target:{closest:()=>null}},true),false);
});
