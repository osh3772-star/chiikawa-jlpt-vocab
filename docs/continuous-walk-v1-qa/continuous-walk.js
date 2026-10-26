if(window.__CV_QA_LOCAL_READY__!==true||window.__CV_QA_SESSION_READY__!==true)throw Error('QA dual storage isolation required');
(function(){
/** Explicit reviewed real-art QA candidate; mock harness remains unchanged. */
const ART_DISABLED = false;
const STEP_IDS = Object.freeze(['02','10','14','17','24','32']);
const EXPOSURES = Object.freeze([320,160,160,320,320,160]);
const TOTAL_MS = 1440;
const APPROVED_HASHES=["97281584802f87a799466f3598550c87dd94a90cd551da33cb0d1f2c8d9d4170","cf9f995a7a4c0ae265b80def4f214c9bc44e0ad73de27b82ee15313bb068c557","9479f56e045479d73368219d41fb3ee72f45c9e9f47d140b835dc9995ce064db","a035ad6318a2041c7656f2ce620dbce7022a08f84d7fdccf4e6cc19fc3623095","4e7065c895d704371b0fc2ef8e726bbcea008f8efb1b0b53b6c4627f9180b8a3","fde3946e1ad5a74f1830657510b5c3efad3ca9892c3653cdd8addaa3a6d8311c"];
function validReviewedStepArt(a){return a?.schema==='reviewed-hachi-static-keys/v1'&&a.reviewCandidate===true&&a.productionApproved===false&&a.enabledByDefault===false&&a.displayMode==='actor-shared-registration'&&Array.isArray(a.frames)&&a.frames.length===6&&Array.from({length:6},(_,i)=>a.frames[i]).every((f,i)=>f?.poseId===STEP_IDS[i]&&f.sha256===APPROVED_HASHES[i]&&f.width===1254&&f.height===1254&&typeof f.source==='string'&&(f.source.startsWith(['data','image/png;base64,'].join(':'))||f.source==='assets/'+f.sha256+'.png'));}

const CHI_PROFILE='chi-foot-v4-expanded-review';
const CHI_HASHES=["09526837455f4384430ef1e7f6c68b68b8e693da7fb57ce7185cba610e7303f3", "1c90f622c51589025695a0fec55568719627cc2030582e06bb9617b89835f32d", "40f956e223a22ed1eb978ee5163d46095d8e765bc561f5c162d364b87f8bbdf7", "0d48828ca2adbfe124489be261c2f9a78ad29ab037e0829af83fdf63e017dc48", "f89be8a1dca9efd10c998b901a995575f59fd98426944daca1ff563be33e2013", "228915d0fde57acd3fce9aa06a303c4989bce72d107408984fe18e30325948ad", "a31368e4fac8a11ec638e3e5c864cd2d36c4c54fd0c545c239ab284b256fd7d3", "57796e78b711e408945d06126d687ee2944d90e744e520a93755f3d570adc065", "874a369c3c6ae2b1331ce66f56367c7194a233c30016f0d4b0d85c0169af4a95", "590155819ebae2b41dc2b90b2eb1eeac182117da8eaeee7a8dfe249e86f4c181", "656290e36fb9c214ea07a34c0b8d4ca66a5367ca130f66ab6ed177b7e48c637c", "4410d59938f0ef46dc70063a43fa42b3764cebbcf91241a737f8f373b8cb1c7a"];
const CHI_IDS=Object.freeze(Array.from({length:12},(_,i)=>String(i).padStart(2,'0')));
function validChiStepArt(a){return a?.schema===CHI_PROFILE&&a.characterId==='chiikawa'&&a.reviewCandidate===true&&a.productionApproved===false&&a.enabledByDefault===false&&a.autonomous===false&&a.rootTravel===false&&a.loop===false&&a.displayMode==='actor-expanded-registration'&&Array.isArray(a.frames)&&a.frames.length===12&&Array.from({length:12},(_,i)=>a.frames[i]).every((f,i)=>f?.poseId===CHI_IDS[i]&&f.sha256===CHI_HASHES[i]&&f.width===1254&&f.height===1254&&typeof f.source==='string'&&(f.source.startsWith(['data','image/png;base64,'].join(':'))||f.source==='assets/'+f.sha256+'.png'));}

function createAuthoredStepController({fixture,context,owner,acquire,release,decode,paint,clear,now=()=>performance.now(),requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id),setTimer=setTimeout,clearTimer=clearTimeout}) {
 let generation=0,mode='off',lease=null,resource=null,abort=null,raf=null,timer=null,pose=-1,disposed=false,reason=null,admission=null;
 const isChi=fixture?.schema===CHI_PROFILE;const ids=isChi?CHI_IDS:STEP_IDS,exposures=isChi?Array(12).fill(120):EXPOSURES;
 const valid=()=>isChi?validChiStepArt(fixture):validReviewedStepArt(fixture);
 const eligible=c=>c?.enabled===true&&c.visible===true&&c.idle===true&&c.safe===true&&c.physical===false&&c.busy===false&&c.studyBusy===false&&c.documentHidden===false;
 function cleanup(why){generation++;reason=why;abort?.abort();abort=null;if(raf!==null)cancelFrame(raf);if(timer!==null)clearTimer(timer);raf=timer=null;const oldResource=resource,oldLease=lease;resource=lease=null;mode='off';pose=-1;admission=null;try{clear();}finally{try{oldResource?.cleanup?.();}finally{if(oldLease!==null)release(oldLease);}}}
 function canStart(){return !disposed&&mode==='off'&&valid()&&eligible(context())&&owner()===null;}
 async function start(){
  if(!canStart())return false;
  const contractSources=fixture.frames.map(f=>f.source);const initial=context(),revision=initial.revision,mount=initial.mount;admission={revision,mount};const token=++generation;mode='loading';reason=null;abort=new AbortController();
  const stillEligible=()=>{const c=context();return token===generation&&!disposed&&valid()&&fixture.frames.every((f,i)=>f.source===contractSources[i])&&eligible(c)&&c.revision===revision&&c.mount===mount;};
  try{
   const loaded=await decode(fixture.frames,{signal:abort.signal});
   if(token!==generation){loaded?.cleanup?.();return false;}resource=loaded;
   if(!stillEligible()||owner()!==null){cleanup('preflight-changed');return false;}
   // No await between ownership recheck and exact-token acquire.
   const acquired=acquire();
   if(token!==generation){if(acquired!==null&&acquired!==false)release(acquired);return false;}
   if(acquired===null||acquired===false){cleanup('lease-denied');return false;}lease=acquired;
   const started=now(),first=context();let lastElapsed=0;if(token!==generation)return false;if(isChi&&!Number.isFinite(started)){cleanup('invalid-clock');return false;}if(!stillEligible()||owner()!==lease){cleanup('post-acquire-changed');return false;}mode=first.paused||first.reduced?'static':'sequence';pose=0;paint(fixture.frames[0]);
   if(token!==generation)return false;
   timer=setTimer(()=>{if(token===generation)cleanup(stillEligible()&&owner()===lease?(mode==='sequence'&&pose<ids.length-1?'missed-exposure':'finite-ui-cut'):'context-changed');},Math.max(0,TOTAL_MS-(now()-started)));
   if(mode==='static'&&!isChi)return true;
   const tick=()=>{if(token!==generation)return;raf=null;try{const c=context();if(!stillEligible()||owner()!==lease||(isChi&&mode==='static'?!(c.paused||c.reduced):c.paused||c.reduced)){cleanup('context-changed');return;}const elapsed=now()-started;if(isChi&&(!Number.isFinite(elapsed)||elapsed<lastElapsed)){cleanup('invalid-clock');return;}if(isChi)lastElapsed=elapsed;if(elapsed>=TOTAL_MS){cleanup(mode==='sequence'&&pose<ids.length-1?'missed-exposure':'finite-ui-cut');return;}if(isChi&&mode==='static'){if(token===generation)raf=requestFrame(tick);return;}let sum=0;const next=exposures.findIndex(ms=>(sum+=ms)>elapsed);if(next<pose||next>pose+1){cleanup('missed-exposure');return;}if(next!==pose){pose=next;paint(fixture.frames[next]);}if(token===generation)raf=requestFrame(tick);}catch(_){if(token===generation)cleanup('paint-or-context-error');}};
   raf=requestFrame(tick);return true;
  }catch(_){if(token===generation)cleanup('decode-or-paint-error');return false;}
 }
 return {start,canStart,cancel:cleanup,revalidate(){if(mode==='off')return;const c=context();if(!eligible(c)||c.revision!==admission?.revision||c.mount!==admission?.mount||(lease!==null&&owner()!==lease))cleanup('context-changed');},destroy(){disposed=true;cleanup('destroyed');},getState:()=>({mode,pose:pose<0?null:ids[pose],reason,artDisabled:ART_DISABLED,reviewCandidate:true,productionApproved:false})};
}

/** Isolated, fail-closed bridge. No production install or art activation. */
const OTHER_OWNER=Object.freeze({kind:'not-this-adapter'});
const rect=r=>r&&['left','top','right','bottom'].every(k=>Number.isFinite(r[k]))&&r.right>r.left&&r.bottom>r.top;
const contained=(a,b)=>a.left>=b.left&&a.top>=b.top&&a.right<=b.right&&a.bottom<=b.bottom;
const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
function fullPaintSafe(g){return !!g&&rect(g.union)&&rect(g.viewport)&&rect(g.stage)&&g.viewport.right-g.viewport.left>=640&&contained(g.union,g.viewport)&&contained(g.union,g.stage)&&Array.isArray(g.obstacles)&&g.obstacles.every(r=>rect(r)&&!intersects(g.union,r));}
function createStepEngineAdapter({getEngine,readGeometry,readUI,profile=null}){
 const isChi=profile===CHI_PROFILE,id=isChi?'chiikawa':'hachiware',profileAllowed=profile===null||isChi;
 let held=null,expected=null,disposed=false;
 const methods=e=>e&&['readAuthoredStepAdmission','ownsExternalPresentation','getPresentationOwner','tryAcquireAuthoredStepPresentation','endExternalPresentation'].every(k=>typeof e[k]==='function');
 const owns=()=>held&&getEngine()===held.engine&&held.engine.ownsExternalPresentation(id,held.token)===true;
 function owner(){const e=getEngine();if(owns())return held.token;return !methods(e)||e.getPresentationOwner()!==null?OTHER_OWNER:null;}
 function collect(){
  const e=getEngine();if(disposed||!profileAllowed||!methods(e))return null;
  const own=owns(),token=own?held.token:null;
  const before=e.readAuthoredStepAdmission(id,token,isChi?CHI_PROFILE:null),ui=readUI();
  const geometry=readGeometry(),after=e.readAuthoredStepAdmission(id,token,isChi?CHI_PROFILE:null);
  if(e!==getEngine()||!before||!after||before.safe!==true||after.safe!==true||before.epoch!==after.epoch||before.key!==after.key||!Number.isSafeInteger(after.studyRevision)||!fullPaintSafe(geometry)||(isChi&&(!after.paintBounds||JSON.stringify(geometry.stage)!==JSON.stringify(after.paintBounds)||JSON.stringify(geometry.union)!==JSON.stringify(after.paintBounds))))return null;
  if(ui?.enabled!==true||ui.inputBusy!==false||ui.mediaBusy!==false||ui.composing!==false||ui.documentHidden!==false)return null;
  return {engine:e,snapshot:after,geometryKey:JSON.stringify(geometry),ui};
 }
 function context(){let c;try{c=collect();}catch(_){}expected=c;return {enabled:!!c,visible:!!c,idle:!!c,safe:!!c,physical:!c,busy:!c,studyBusy:!c,documentHidden:!c,revision:c?.snapshot.studyRevision,mount:c?.engine,paused:c?.snapshot.paused===true,reduced:c?.snapshot.reduced===true};}
 function acquire(){
  const prior=expected;if(!prior||held||owner()!==null)return null;
  let fresh;try{fresh=collect();}catch(_){return null;}
  if(!fresh||fresh.engine!==prior.engine||fresh.snapshot.epoch!==prior.snapshot.epoch||fresh.snapshot.key!==prior.snapshot.key||fresh.geometryKey!==prior.geometryKey||fresh.engine.getPresentationOwner()!==null)return null;
  // Reviewed internal admission must be read-only; no await and no callbacks after this check.
  const token=fresh.engine.tryAcquireAuthoredStepPresentation(fresh.snapshot);
  if(!token)return null;
  if(getEngine()!==fresh.engine||fresh.engine.ownsExternalPresentation(id,token)!==true){fresh.engine.endExternalPresentation(id,token);return null;}
  held={engine:fresh.engine,token};return token;
 }
 function release(token){if(!held||held.token!==token)return false;const old=held;held=null;expected=null;old.engine.endExternalPresentation(id,old.token);return true;}
 return{context,owner,acquire,release,destroy(){disposed=true;if(held)release(held.token);expected=null;},getState:()=>({artDisabled:true,held:!!owns(),missingEngineAPI:!methods(getEngine())})};
}

/** One bounded decode batch; no lease acquired until all six exact-size images decode. */
async function decodeReviewedStep(frames,{signal,ImageCtor=Image,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 if(signal?.aborted)throw Error('aborted');
 const images=[];let timer,abort;
 const cleanup=()=>images.forEach(im=>im.removeAttribute('src'));
 try{
  const stopped=new Promise((_,reject)=>{abort=()=>reject(Error('aborted'));signal?.addEventListener('abort',abort,{once:true});timer=setTimer(()=>reject(Error('decode-timeout')),8000);});
  const batch=Promise.all(frames.map(f=>{const im=new ImageCtor();images.push(im);im.src=f.source;return Promise.resolve().then(()=>{if(signal?.aborted)throw Error('aborted');return im.decode();}).then(()=>{if(im.naturalWidth!==1254||im.naturalHeight!==1254)throw Error('invalid-size');});}));
  await Promise.race([batch,stopped]);if(signal?.aborted)throw Error('aborted');return{cleanup};
 }catch(e){cleanup();throw e;}finally{if(timer!==undefined)clearTimer(timer);signal?.removeEventListener('abort',abort);}
}

/** Explicit experimental Chi-only authored-frame loop. No probability or default start.
 * Art rootTravel:false remains unchanged: movement belongs to the guarded engine.
 */
const CONTINUOUS_WALK_SCOPE='chi-continuous-walk-v1';
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const eligible=c=>c?.scope===CONTINUOUS_WALK_SCOPE&&c.safe===true&&c.enabled===true&&c.visible===true&&c.paused===false&&c.reduced===false&&c.documentHidden===false&&c.inputBusy===false&&c.studyBusy===false&&c.captured===false&&c.physical===false&&c.composing===false&&c.mediaBusy===false;
function createContinuousWalkController({fixture,host,decode,now=()=>performance.now(),requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=cancelAnimationFrame,setTimer=setTimeout,clearTimer=clearTimeout,onState=()=>{}}){
 let enabled=false,disposed=false,generation=0,mode='off',reason='default-off',lease=null,resource=null,abort=null,raf=null,timer=null,position=null,frameIndex=0,cycles=0;
 let initial=null,points=null,target=1,lastTime=0,frameElapsed=0,lastTick=0;
 const emit=()=>{try{onState(state());}catch{}};
 const state=()=>({enabled,mode,reason,frame:mode==='walking'?frameIndex:null,cycles,position:position?{...position}:null,experimental:true,naturalWalkingVerified:false});
 function stop(why='manual-stop'){
  ++generation;reason=why;mode='off';abort?.abort();abort=null;
  if(raf!==null)cancelFrame(raf);if(timer!==null)clearTimer(timer);raf=timer=null;
  const r=resource,l=lease;resource=lease=null;initial=null;points=null;position=null;
  try{r?.cleanup?.();}catch{reason='resource-cleanup-error';}finally{if(l!==null){try{host.release(l,why);}catch{reason='lease-release-error';}}}emit();
 }
 function context(){
  const c=host.read(lease);
  return eligible(c)&&(!initial||(c.mount===initial.mount&&c.revision===initial.revision&&c.geometryEpoch===initial.geometryEpoch))?c:null;
 }
 function validSources(sources){return validChiStepArt(fixture)&&fixture.frames.every((f,i)=>f.source===sources[i]);}
 function canStart(){if(!enabled||disposed||mode!=='off'||!validChiStepArt(fixture))return false;try{return !!context()&&host.owner()===null;}catch{return false;}}
 async function start(){
  if(!canStart())return false;
  const sources=fixture.frames.map(f=>f.source),token=++generation;
  initial=context();if(!initial)return false;
  const plan=initial.path;
  if(!Array.isArray(plan)||plan.length!==2||!plan.every(finite)||distance(plan[0],plan[1])<4||distance(plan[0],plan[1])>128||!Number.isFinite(initial.speed)||initial.speed<=0||initial.speed>40){stop('no-safe-path');return false;}
  points=plan.map(p=>({...p}));position={...points[0]};target=1;frameIndex=cycles=frameElapsed=0;mode='loading';reason=null;abort=new AbortController();const signal=abort.signal;emit();if(token!==generation)return false;
  try{
   const loaded=await decode(fixture.frames,{signal});
   if(token!==generation){loaded?.cleanup?.();return false;}resource=loaded;
   if(!validSources(sources)||!context()||host.owner()!==null){stop('preflight-changed');return false;}
   const acquired=host.acquire(initial);if(token!==generation){if(acquired!==null&&acquired!==undefined&&acquired!==false)host.release(acquired,'cancelled-acquire');return false;}lease=acquired;
   if(lease===null||lease===undefined||lease===false){lease=null;stop('lease-denied');return false;}
   if(!context()||host.owner()!==lease){stop('ownership-changed');return false;}
   lastTime=lastTick=now();if(!Number.isFinite(lastTime)){stop('invalid-clock');return false;}
   if(host.present(lease,{from:position,to:position,frame:fixture.frames[0]})!==true){stop('unsafe-placement');return false;}
   if(token!==generation)return false;mode='walking';emit();if(token!==generation)return false;
   const watchdog=()=>{if(token!==generation)return;const t=now();if(!Number.isFinite(t)||t<lastTick||t-lastTick>300){stop('frame-stalled');return;}timer=setTimer(watchdog,150);};
   timer=setTimer(watchdog,150);
   const tick=()=>{
    if(token!==generation)return;raf=null;
    try{
     const c=context();if(!enabled||disposed||!c||!validSources(sources)||host.owner()!==lease){stop('context-changed');return;}
     const t=now(),dt=t-lastTime;
     if(!Number.isFinite(t)||dt<0||dt>120){stop('invalid-or-delayed-frame');return;}
     lastTick=lastTime=t;frameElapsed+=dt;
     if(frameElapsed>=120){frameElapsed-=120;frameIndex++;if(frameIndex===12){frameIndex=0;cycles++;}}
     const end=points[target],length=distance(position,end),step=Math.min(length,initial.speed*dt/1000);
     const next=length===0?{...end}:{x:position.x+(end.x-position.x)*step/length,y:position.y+(end.y-position.y)*step/length};
     // Engine must atomically recheck current obstacles and swept full painted bounds.
     if(host.present(lease,{from:position,to:next,frame:fixture.frames[frameIndex]})!==true){stop('unsafe-placement');return;}
     if(token!==generation)return;position=next;if(distance(position,end)<0.001)target=1-target;
     if(token===generation)raf=requestFrame(tick);
    }catch{if(token===generation)stop('host-or-paint-error');}
   };
   raf=requestFrame(tick);return true;
  }catch{if(token===generation)stop('decode-or-host-error');return false;}
 }
 return {start,canStart,stop,setEnabled(value){enabled=value===true;if(!enabled)stop('disabled');else emit();},revalidate(reason='external-change'){if(mode==='off')return;try{if(!context()||(lease!==null&&host.owner()!==lease))stop(reason);}catch{stop(reason);}},destroy(){disposed=true;enabled=false;stop('destroyed');},getState:state};
}

/** No fallback to the generic/existing manual presentation API. */
function createContinuousWalkEngineAdapter({getEngine,readUI}){
 let held=null,disposed=false;
 const required=['readContinuousWalkAdmission','tryAcquireContinuousWalk','presentContinuousWalk','releaseContinuousWalk','ownsContinuousWalk','getPresentationOwner'];
 const valid=e=>!!e&&required.every(k=>typeof e[k]==='function');
 const other=Object.freeze({kind:'unavailable-or-other-owner'});
 function owner(){const e=getEngine();if(held&&e===held.engine&&e.ownsContinuousWalk(held.token)===true)return held.token;return valid(e)&&e.getPresentationOwner()===null?null:other;}
 function read(token){
  const e=getEngine(),u=readUI();if(disposed||!valid(e)||(token!==null&&token!==undefined&&(!held||token!==held.token||e!==held.engine)))return {safe:false};
  const s=e.readContinuousWalkAdmission({scope:CONTINUOUS_WALK_SCOPE,actorId:'chiikawa',lease:token??null});
  if(!s||s.scope!==CONTINUOUS_WALK_SCOPE||s.actorId!=='chiikawa')return {safe:false};
  return {...s,mount:e,enabled:u?.enabled===true,documentHidden:s.documentHidden!==false||u?.documentHidden!==false,inputBusy:s.inputBusy!==false||u?.inputBusy!==false,mediaBusy:s.mediaBusy!==false||u?.mediaBusy!==false,composing:s.composing!==false||u?.composing!==false};
 }
 function acquire(expected){
  if(disposed||held||getEngine()!==expected.mount||owner()!==null)return null;
  const fresh=read(null);
  if(fresh.safe!==true||fresh.enabled!==true||fresh.visible!==true||fresh.paused!==false||fresh.reduced!==false||fresh.documentHidden!==false||fresh.inputBusy!==false||fresh.studyBusy!==false||fresh.captured!==false||fresh.physical!==false||fresh.composing!==false||fresh.mediaBusy!==false||fresh.key!==expected.key||fresh.revision!==expected.revision||fresh.geometryEpoch!==expected.geometryEpoch)return null;
  const e=getEngine(),token=e.tryAcquireContinuousWalk(fresh);
  if(token===null||token===undefined||token===false)return null;
  if(disposed||e!==getEngine()||e.ownsContinuousWalk(token)!==true){e.releaseContinuousWalk(token,'acquire-race');return null;}
  held={engine:e,token};return token;
 }
 function present(token,pose){return !!held&&held.token===token&&getEngine()===held.engine&&held.engine.ownsContinuousWalk(token)===true&&held.engine.presentContinuousWalk(token,pose)===true;}
 function release(token,reason){if(!held||held.token!==token)return false;const old=held;held=null;return old.engine.releaseContinuousWalk(token,reason);}
 return{owner,read,acquire,present,release,destroy(){disposed=true;if(held)release(held.token,'adapter-destroyed');}};
}
/** Cancel immediately, never auto-restart. Host engine must independently enforce priority. */
function bindContinuousWalkCancellation({controller,window,document,controls}){
 const removers=[];
 const listen=(el,type,fn,opts)=>{el?.addEventListener(type,fn,opts);removers.push(()=>el?.removeEventListener(type,fn,opts));};
 for(const type of ['pointerdown','keydown','beforeinput','compositionstart','play','vocab:busy']){
  listen(document,type,event=>{if(type==='pointerdown'&&controls?.contains(event.target))return;controller.stop(type);},true);
 }
 for(const type of ['resize','scroll','blur','pagehide'])listen(window,type,()=>controller.stop(type),{capture:true,passive:true});
 listen(document,'visibilitychange',()=>controller.stop('visibility'),true);
 for(const type of ['resize','scroll'])listen(window?.visualViewport,type,()=>controller.stop('visual-viewport-'+type),{passive:true});
 return ()=>{for(const remove of removers)remove();controller.stop('unbind');};
}

const art={"schema": "chi-foot-v4-expanded-review", "characterId": "chiikawa", "reviewCandidate": true, "productionApproved": false, "enabledByDefault": false, "autonomous": false, "rootTravel": false, "loop": false, "displayMode": "actor-expanded-registration", "frames": [{"poseId": "00", "sha256": "09526837455f4384430ef1e7f6c68b68b8e693da7fb57ce7185cba610e7303f3", "width": 1254, "height": 1254, "source": "assets/09526837455f4384430ef1e7f6c68b68b8e693da7fb57ce7185cba610e7303f3.png"}, {"poseId": "01", "sha256": "1c90f622c51589025695a0fec55568719627cc2030582e06bb9617b89835f32d", "width": 1254, "height": 1254, "source": "assets/1c90f622c51589025695a0fec55568719627cc2030582e06bb9617b89835f32d.png"}, {"poseId": "02", "sha256": "40f956e223a22ed1eb978ee5163d46095d8e765bc561f5c162d364b87f8bbdf7", "width": 1254, "height": 1254, "source": "assets/40f956e223a22ed1eb978ee5163d46095d8e765bc561f5c162d364b87f8bbdf7.png"}, {"poseId": "03", "sha256": "0d48828ca2adbfe124489be261c2f9a78ad29ab037e0829af83fdf63e017dc48", "width": 1254, "height": 1254, "source": "assets/0d48828ca2adbfe124489be261c2f9a78ad29ab037e0829af83fdf63e017dc48.png"}, {"poseId": "04", "sha256": "f89be8a1dca9efd10c998b901a995575f59fd98426944daca1ff563be33e2013", "width": 1254, "height": 1254, "source": "assets/f89be8a1dca9efd10c998b901a995575f59fd98426944daca1ff563be33e2013.png"}, {"poseId": "05", "sha256": "228915d0fde57acd3fce9aa06a303c4989bce72d107408984fe18e30325948ad", "width": 1254, "height": 1254, "source": "assets/228915d0fde57acd3fce9aa06a303c4989bce72d107408984fe18e30325948ad.png"}, {"poseId": "06", "sha256": "a31368e4fac8a11ec638e3e5c864cd2d36c4c54fd0c545c239ab284b256fd7d3", "width": 1254, "height": 1254, "source": "assets/a31368e4fac8a11ec638e3e5c864cd2d36c4c54fd0c545c239ab284b256fd7d3.png"}, {"poseId": "07", "sha256": "57796e78b711e408945d06126d687ee2944d90e744e520a93755f3d570adc065", "width": 1254, "height": 1254, "source": "assets/57796e78b711e408945d06126d687ee2944d90e744e520a93755f3d570adc065.png"}, {"poseId": "08", "sha256": "874a369c3c6ae2b1331ce66f56367c7194a233c30016f0d4b0d85c0169af4a95", "width": 1254, "height": 1254, "source": "assets/874a369c3c6ae2b1331ce66f56367c7194a233c30016f0d4b0d85c0169af4a95.png"}, {"poseId": "09", "sha256": "590155819ebae2b41dc2b90b2eb1eeac182117da8eaeee7a8dfe249e86f4c181", "width": 1254, "height": 1254, "source": "assets/590155819ebae2b41dc2b90b2eb1eeac182117da8eaeee7a8dfe249e86f4c181.png"}, {"poseId": "10", "sha256": "656290e36fb9c214ea07a34c0b8d4ca66a5367ca130f66ab6ed177b7e48c637c", "width": 1254, "height": 1254, "source": "assets/656290e36fb9c214ea07a34c0b8d4ca66a5367ca130f66ab6ed177b7e48c637c.png"}, {"poseId": "11", "sha256": "4410d59938f0ef46dc70063a43fa42b3764cebbcf91241a737f8f373b8cb1c7a", "width": 1254, "height": 1254, "source": "assets/4410d59938f0ef46dc70063a43fa42b3764cebbcf91241a737f8f373b8cb1c7a.png"}]};
  if(document.body?.dataset.page!=='study'||document.getElementById('continuous-walk-controls'))return;
  const panel=document.createElement('details');panel.id='continuous-walk-controls';panel.className='cv-continuous-walk';
  panel.innerHTML='<summary>치이카와 연속 동작 · 시험</summary><div class="cv-walk-content"><p>기존 발 보정 12장을 반복하며 안전한 짧은 경로를 왕복합니다. 원작의 자연스러운 걷기를 재현했다고 검증한 기능은 아닙니다.</p><label><input id="continuous-walk-enabled" type="checkbox"> 이 페이지에서 연속 동작 허용</label><div><button id="continuous-walk-start" type="button" disabled>연속 동작 시작</button> <button id="continuous-walk-stop" type="button" disabled>정지</button></div><p id="continuous-walk-status" role="status">꺼짐 · 허용 체크만으로 자동 시작하지 않습니다.</p><p>공간이 부족하면 시작하지 않습니다. 치이카와를 빈 곳으로 옮긴 뒤 시작해 주세요. 잡기·학습·스크롤·일시정지·음악 재생은 동작을 멈추며, 다시 시작하려면 시작 버튼을 눌러 주세요.</p></div>';
  document.getElementById('study').before(panel);
  const enabled=document.getElementById('continuous-walk-enabled'),start=document.getElementById('continuous-walk-start'),stop=document.getElementById('continuous-walk-stop'),status=document.getElementById('continuous-walk-status');
  const engine=()=>window[Symbol.for('jlpt.chiikawa-pets')];
  const bridge=createContinuousWalkEngineAdapter({getEngine:engine,readUI:()=>({enabled:enabled.checked,documentHidden:document.hidden,inputBusy:false,composing:false,mediaBusy:document.getElementById('bgm-play')?.getAttribute('aria-pressed')==='true'})});
  const controller=createContinuousWalkController({fixture:art,host:bridge,decode:decodeReviewedStep,onState:s=>{
    start.disabled=!s.enabled||s.mode!=='off';stop.disabled=s.mode==='off';
    status.textContent=!s.enabled?'꺼짐 · 자동으로 시작하지 않습니다.':s.mode==='loading'?'프레임 준비 중 · 정지할 수 있어요.':s.mode==='walking'?'연속 동작 시험 중 · 직접 잡거나 정지할 수 있어요.':'준비 / 멈춤 · 시작 버튼으로 다시 실행해 주세요.';
  }});
  const unbind=bindContinuousWalkCancellation({controller,window,document,controls:panel});
  enabled.addEventListener('change',()=>controller.setEnabled(enabled.checked));
  start.addEventListener('click',async()=>{await Promise.resolve();if(!enabled.checked||controller.getState().mode!=='off')return;const ok=await controller.start();if(!ok&&controller.getState().mode==='off'&&enabled.checked)status.textContent='시작하지 않았어요. 치이카와 표시·일시정지·음악·다른 동작·빈 공간을 확인해 주세요.';});
  stop.addEventListener('click',()=>controller.stop('manual-stop'));
  panel.addEventListener('toggle',()=>{if(!panel.open)controller.stop('panel-closed');});
  const reset=()=>{controller.setEnabled(false);enabled.checked=false;};
  window.CVPage?.beforeNavigate(reset);
  window.addEventListener('pagehide',event=>{reset();if(!event.persisted){controller.destroy();bridge.destroy();unbind();}});
  window.addEventListener('pageshow',event=>{if(event.persisted)reset();});

})();
