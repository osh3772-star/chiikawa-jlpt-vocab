import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
// Integrators may relocate this test: point CHIIKAWA_PETS_DIR at deployed source modules.
const root=process.env.CHIIKAWA_PETS_DIR ? pathToFileURL(`${process.env.CHIIKAWA_PETS_DIR.replace(/\/$/,'')}/`) : new URL('../chiikawa-pets/',import.meta.url);
const {createPreviewCoordinator,createStaticCameoController}=await import(new URL('static-cameo.js',root));
const {createMomongaPreviewController}=await import(new URL('momonga-preview.js',root));
const localOrDeployed=(name)=>new URL(name,root);
const {createHachiwareTwoPoseController,hachiwareTwoPoseAsset}=await import(localOrDeployed('hachiware-two-pose.mjs','../hachiware/hachiware-two-pose.mjs'));
const {createUsagiFragmentController,usagiFragmentAsset}=await import(localOrDeployed('usagi-fragment.mjs','../usagi/usagi-fragment.mjs'));
const {createShisaStaticController}=await import(localOrDeployed('shisa-static-controller.mjs','./shisa-static-controller.mjs'));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture(){
  const coordinator=createPreviewCoordinator(),context={visible:true,paused:false,reduced:false};
  const pending=new Map(),allCallbacks=[],log=[],controllers={},elements={},decodeQueues={},violations=[];let next=1,owner=null,baseVisible=true;
  const make=(id,create,asset)=>{
    const image={style:{},dataset:{},removeAttribute(name){delete this[name];}},clip={style:{}},rail={},status={};elements[id]={image,rail,status};decodeQueues[id]=[];
    const options={asset,image,clip,rail,status,getContext:()=>context,
      onBegin(){if(owner!==null)violations.push(`double lease ${owner}/${id}`);assert.equal(owner,null,`double actor lease: ${owner} + ${id}`);owner=id;baseVisible=false;log.push(`begin:${id}`);return true;},
      onEnd(){if(owner!==id)violations.push(`late release ${id}/${owner}`);assert.equal(owner,id,`late ${id} onEnd would restore current ${owner} actor`);owner=null;baseVisible=context.visible;log.push(`end:${id}`);},
      loadImage(){const d=decodeQueues[id].shift();return d?d.promise:Promise.resolve();},
      readClip:()=>({left:0,right:200,top:0,bottom:160,width:200,height:160}),
      readRail:()=>({left:20,right:620,top:100,bottom:278}),
      requestFrame(fn){const handle=next++;pending.set(handle,{id,fn});allCallbacks.push({id,fn});return handle;},cancelFrame(handle){pending.delete(handle);}};
    if(id==='usagi')options.loadImages=async()=>{await options.loadImage();return{images:[{},{},{}],cleanup(){}};};
    if(id==='shisa')Object.assign(options,{assetUrl:'shisa.png',enabled:true,host:{isConnected:true},readHost:()=>({left:0,right:180,top:0,bottom:192,width:180,height:192}),view:{show(){image.hidden=false;rail.hidden=false;},hide(){image.hidden=true;},destroy(){}},eventDocument:{hidden:false}});
    controllers[id]=create(options);coordinator.register(id,controllers[id]);
  };
  make('hachiware',createHachiwareTwoPoseController,hachiwareTwoPoseAsset('A.png','B.png'));
  make('momonga',createMomongaPreviewController,{testingAuthorized:true,enabledByDefault:false,productionEnabled:false,bodyPoseCount:1,sourceRepresentation:'DERIVED_REFERENCE_CUTOUT',durationOrigin:'AUTHORED_WEB_UX',assetSize:[1627,967],source:'momonga.png',durationMs:1800});
  const frame={sourceRect:[245,99,972,915],assetSize:[1448,1086],displayWidth:120};
  make('ep2',createStaticCameoController,{testingAuthorized:true,enabledByDefault:false,productionEnabled:false,bodyPoseCount:4,reviewScope:'LIMITED_FOUR_KEYPOSE_PREVIEW',timingOrigin:'AUTHORED_WEB_UX',loop:false,interpolation:false,windowSize:[140,124],sourceRepresentation:'DERIVED_UPPERBODY_CAMEO',frames:['A','A1','B','C'].map(poseId=>({...frame,poseId,source:`ep2-${poseId}.png`,durationMs:400}))});
  make('usagi',createUsagiFragmentController,usagiFragmentAsset('UA.png','UB.png','UC.png'));
  make('shisa',createShisaStaticController,null);
  function assertOwner(expected){assert.equal(owner,expected);assert.equal(baseVisible,expected===null&&context.visible);assert.deepEqual(violations,[]);assert.equal(Object.values(elements).filter(x=>!x.image.hidden).length,expected?1:0);assert.equal(coordinator.anyActive(),expected!==null);}
  return {coordinator,controllers,context,pending,allCallbacks,log,assertOwner,collapse(id){elements[id].rail.hidden=true;controllers[id].cancel('closed');},
    defer(id){const d=deferred();decodeQueues[id].push(d);return d;},
    tick(time){const callbacks=[...pending.values()];pending.clear();for(const {fn}of callbacks)fn(time);}};
}
const ids=['hachiware','momonga','ep2','usagi','shisa'];
for(const first of ids)for(const second of ids.filter(x=>x!==first)){
  test(`${first} pending → ${second} active → hide → late decode → restart`,async()=>{
    const f=fixture(),d=f.defer(first);const stale=f.coordinator.start(first);
    assert.equal(f.coordinator.hasOpen(),true);f.assertOwner(null);
    assert.equal(await f.coordinator.start(second),true);f.assertOwner(second);
    const staleFrames=[...f.allCallbacks];f.context.visible=false;f.coordinator.cancelAll('hidden');f.assertOwner(null);assert.equal(f.pending.size,0);
    d.resolve();assert.equal(await stale,false);f.assertOwner(null);assert.equal(f.coordinator.hasOpen(),false);
    f.context.visible=true;assert.equal(await f.coordinator.start(first),true);f.assertOwner(first);
    // Even a browser callback already delivered before cancellation cannot end a newer lease.
    for(const {fn}of staleFrames)fn(9999);f.assertOwner(first);
    f.coordinator.cancelAll('closed');f.coordinator.cancelAll('closed');f.assertOwner(null);assert.equal(f.pending.size,0);
    assert.deepEqual(f.log,[`begin:${second}`,`end:${second}`,`begin:${first}`,`end:${first}`]);
  });
  test(`${first} acquired → close → pending → ${second} → stale rejected decode`,async()=>{
    const f=fixture();await f.coordinator.start(first);f.assertOwner(first);f.tick(0);f.tick(2000);
    f.controllers[first].cancel('closed');const d=f.defer(first),stale=f.coordinator.start(first);await f.coordinator.start(second);f.assertOwner(second);
    const before=f.log.slice();d.reject(Error('stale decode'));assert.equal(await stale,false);f.assertOwner(second);assert.deepEqual(f.log,before);
    f.coordinator.cancelAll('escape');f.assertOwner(null);assert.equal(f.pending.size,0);
    const begins=f.log.filter(x=>x.startsWith('begin:')).length,ends=f.log.filter(x=>x.startsWith('end:')).length;assert.equal(begins,ends);
  });
}
test('three pending generations resolve in reverse order; only newest acquires',async()=>{
  const f=fixture(),a=f.defer('hachiware'),b=f.defer('momonga'),c=f.defer('ep2');
  const pa=f.coordinator.start('hachiware'),pb=f.coordinator.start('momonga'),pc=f.coordinator.start('ep2');
  c.resolve();assert.equal(await pc,true);f.assertOwner('ep2');b.resolve();a.resolve();assert.equal(await pb,false);assert.equal(await pa,false);f.assertOwner('ep2');
  assert.deepEqual(f.log,['begin:ep2']);f.coordinator.cancelAll('closed');assert.deepEqual(f.log,['begin:ep2','end:ep2']);
});
test('superseded deferred same-controller decode cannot end restarted lease',async()=>{
  for(const id of ids){const f=fixture(),d=f.defer(id);const stale=f.coordinator.start(id);f.coordinator.cancelAll('escape');await f.coordinator.start(id);f.assertOwner(id);d.resolve();assert.equal(await stale,false);f.assertOwner(id);assert.deepEqual(f.log,[`begin:${id}`]);f.coordinator.cancelAll('closed');assert.deepEqual(f.log,[`begin:${id}`,`end:${id}`]);}
});

for(const first of ['shisa','usagi'])for(const second of ids.filter(x=>x!==first))test(`${first} closed container cannot release or restore newer ${second} actor`,async()=>{
 const f=fixture();await f.coordinator.start(first);f.assertOwner(first);await f.coordinator.start(second);f.assertOwner(second);const before=f.log.slice();f.collapse(first);f.collapse(first);f.assertOwner(second);assert.deepEqual(f.log,before);f.coordinator.cancelAll('closed');f.assertOwner(null);assert.equal(f.coordinator.hasOpen(),false);
});
test('all five pending, reverse settlement leaves only newest Shisa lease',async()=>{const f=fixture(),jobs=[];for(const id of ids){const d=f.defer(id);jobs.push({id,d,p:f.coordinator.start(id)});assert.equal(f.coordinator.hasOpen(),true);assert.equal(f.coordinator.anyActive(),false);}for(const job of jobs.reverse()){job.d.resolve();assert.equal(await job.p,job.id==='shisa');f.assertOwner('shisa');}assert.deepEqual(f.log,['begin:shisa']);f.coordinator.cancelAll('closed');f.assertOwner(null);assert.equal(f.coordinator.hasOpen(),false);});
for(const id of ['shisa','usagi'])test(`${id} getState shape distinguishes pending/visible/off for actual coordinator`,async()=>{const f=fixture(),d=f.defer(id),p=f.coordinator.start(id);assert.equal(f.controllers[id].getState().mode,'loading');assert.equal(f.controllers[id].getState().active,false);assert.equal(f.coordinator.hasOpen(),true);assert.equal(f.coordinator.anyActive(),false);d.resolve();assert.equal(await p,true);assert.equal(f.coordinator.anyActive(),true);assert.equal(f.coordinator.hasOpen(),true);f.coordinator.cancelAll('closed');assert.equal(f.controllers[id].getState().mode,'off');assert.equal(f.coordinator.hasOpen(),false);assert.equal(f.coordinator.anyActive(),false);});
