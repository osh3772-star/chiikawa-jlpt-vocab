import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const definitions=[
 {file:'momonga-preview.js',factory:'createMomongaPreviewController',asset:{testingAuthorized:true,enabledByDefault:false,productionEnabled:false,bodyPoseCount:1,sourceRepresentation:'DERIVED_REFERENCE_CUTOUT',durationOrigin:'AUTHORED_WEB_UX',assetSize:[1627,967],source:'fixture',durationMs:1800}},
 {file:'static-cameo.js',factory:'createStaticCameoController',asset:{testingAuthorized:true,enabledByDefault:false,productionEnabled:false,bodyPoseCount:1,reviewScope:'LIMITED_STATIC_CAMEO_VISUAL_PASS',sourceRepresentation:'DERIVED_UPPERBODY_CAMEO',sourceRect:[0,0,1448,1086],assetSize:[1448,1086],displayWidth:120,source:'fixture'}}
];
function fixture(dir,def,{reject=false,defer=false}={}){
 const counts={src:0,decode:0,constructed:0,begin:0};let visible=false,resolve;
 class Img{constructor(){counts.constructed++;this.style={};this.dataset={}}set src(s){assert.ok(s);counts.src++;this.source=s}decode(){assert.ok(this.source,'source assigned before decode');counts.decode++;return reject?Promise.reject(Error('bad image')):defer?new Promise(r=>resolve=r):Promise.resolve()}}
 const ctx=vm.createContext({Image:Img});
 vm.runInContext(fs.readFileSync(new URL('../chiikawa-pets/'+def.file,import.meta.url),'utf8').replaceAll('export function','function')+';this.create='+def.factory,ctx);
 const image=new Img();counts.constructed=0;
 const api=ctx.create({asset:def.asset,image,clip:{style:{}},rail:{},status:{},getContext:()=>({visible,paused:true}),onBegin:()=>{counts.begin++;return true},onEnd(){},readRail:()=>({left:0,right:600,top:0,bottom:220}),readClip:()=>({left:0,right:120,top:0,bottom:90,width:120,height:90}),requestFrame(){throw Error('paused RAF unexpected')},cancelFrame(){}});
 return {api,counts,image,open(){visible=true},resolve(){resolve()}};
}
test('startup assignment vs explicit decode measured separately, no browser memory inference',async()=>{
 for(const def of definitions){for(const dir of ['chiikawa-pets']){
  const e=fixture(dir,def);
  assert.equal(e.counts.src,0);assert.equal(e.counts.decode,0);assert.equal(e.counts.constructed,0);
  assert.equal(await e.api.start(),false);assert.equal(e.counts.decode,0);
  e.open();assert.equal(e.counts.decode,0);const before=e.counts.src;
  assert.equal(await e.api.start(),true);assert.equal(e.counts.decode,1);assert.ok(e.counts.src>before);assert.equal(e.counts.begin,1);e.api.cancel('closed');
 }}
});
test('deferred explicit start cancellation and load failure never acquire a pet',async()=>{
 for(const def of definitions){
  const e=fixture('chiikawa-pets',def,{defer:true});e.open();const pending=e.api.start();e.api.cancel('closed');e.resolve();assert.equal(await pending,false);assert.equal(e.counts.begin,0);
  const f=fixture('chiikawa-pets',def,{reject:true});f.open();assert.equal(await f.api.start(),false);assert.equal(f.counts.begin,0);
 }
});
