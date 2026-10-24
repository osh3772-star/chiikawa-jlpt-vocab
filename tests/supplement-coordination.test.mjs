import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createPreviewCoordinator} from '../chiikawa-pets/static-cameo.js';
import {createUsagiFragmentController,usagiFragmentAsset} from '../chiikawa-pets/usagi-fragment.mjs';
import {createObservedPoseFragment} from '../chiikawa-pets/observed-pose-fragment.mjs';
const configs=JSON.parse(await readFile(new URL('../chiikawa-pets/limited-previews/observed-fragments.json',import.meta.url),'utf8'));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
function fixture(){const c=createPreviewCoordinator(),pending={},controllers={},els={},ctx={visible:true,paused:true,reduced:false};let owner=null,releases=0;
 const commonImage={style:{},dataset:{},removeAttribute(k){delete this[k]}};
 for(const id of ['usagi-ab','usagi-lowering','rakko-expression']){const image=id.startsWith('usagi')?commonImage:{style:{},dataset:{},removeAttribute(k){delete this[k]}};els[id]=image;const asset=id==='usagi-ab'?usagiFragmentAsset('A','B','C'):{...configs[id],frames:configs[id].frames.map(f=>({...f,source:f.poseId}))};
 const factory=id==='usagi-ab'?createUsagiFragmentController:createObservedPoseFragment;
 const options={asset,image,clip:{style:{}},rail:{},status:{},getContext:()=>ctx,onBegin(){assert.equal(owner,null,'duplicate actor ownership');owner=id;return true},onEnd(){assert.equal(owner,id,'late release of newer actor');owner=null;releases++},readClip:()=>({left:0,top:0,right:200,bottom:160,width:200,height:160}),loadImages:()=>pending[id]?.promise??Promise.resolve({images:[{},{},{}],cleanup(){}}),requestFrame(){throw Error('paused should not schedule')},cancelFrame(){}};
 controllers[id]=factory(options);c.register(id,controllers[id]);}
 return{c,controllers,els,ctx,pending,getOwner:()=>owner,getReleases:()=>releases};}
for(const [first,next] of [['usagi-ab','usagi-lowering'],['usagi-lowering','usagi-ab'],['usagi-lowering','rakko-expression'],['rakko-expression','usagi-lowering']])test(`${first} late decode cannot resurrect or release ${next}`,async()=>{const f=fixture(),d=deferred();f.pending[first]=d;const stale=f.c.start(first);assert.equal(f.c.hasOpen(),true);assert.equal(await f.c.start(next),true);assert.equal(f.getOwner(),next);d.resolve({images:[{},{},{}],cleanup(){}});assert.equal(await stale,false);assert.equal(f.getOwner(),next);assert.equal(f.els[next].hidden,false);f.c.cancelAll('study-input');assert.equal(f.getOwner(),null);assert.equal(f.getReleases(),1)});
test('all shared Usagi controls close both owners and retain hidden selection',async()=>{const f=fixture();await f.c.start('usagi-lowering');f.ctx.visible=false;f.controllers['usagi-ab'].cancel('closed');f.controllers['usagi-lowering'].cancel('closed');assert.equal(f.getOwner(),null);assert.equal(f.els['usagi-ab'].hidden,true);assert.equal(await f.c.start('usagi-ab'),false);assert.equal(await f.c.start('usagi-lowering'),false)});
