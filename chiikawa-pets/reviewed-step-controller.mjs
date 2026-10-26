/** Explicit reviewed real-art QA candidate; mock harness remains unchanged. */
const ART_DISABLED = false;
const STEP_IDS = Object.freeze(['02','10','14','17','24','32']);
const EXPOSURES = Object.freeze([320,160,160,320,320,160]);
const TOTAL_MS = 1440;
const APPROVED_HASHES=["97281584802f87a799466f3598550c87dd94a90cd551da33cb0d1f2c8d9d4170","cf9f995a7a4c0ae265b80def4f214c9bc44e0ad73de27b82ee15313bb068c557","9479f56e045479d73368219d41fb3ee72f45c9e9f47d140b835dc9995ce064db","a035ad6318a2041c7656f2ce620dbce7022a08f84d7fdccf4e6cc19fc3623095","4e7065c895d704371b0fc2ef8e726bbcea008f8efb1b0b53b6c4627f9180b8a3","fde3946e1ad5a74f1830657510b5c3efad3ca9892c3653cdd8addaa3a6d8311c"];
export function validReviewedStepArt(a){return a?.schema==='reviewed-hachi-static-keys/v1'&&a.reviewCandidate===true&&a.productionApproved===false&&a.enabledByDefault===false&&a.displayMode==='actor-shared-registration'&&Array.isArray(a.frames)&&a.frames.length===6&&Array.from({length:6},(_,i)=>a.frames[i]).every((f,i)=>f?.poseId===STEP_IDS[i]&&f.sha256===APPROVED_HASHES[i]&&f.width===1254&&f.height===1254&&typeof f.source==='string'&&(f.source.startsWith(['data','image/png;base64,'].join(':'))||f.source==='assets/'+f.sha256+'.png'));}

const CHI_PROFILE='chi-foot-v4-expanded-review';
const CHI_HASHES=["09526837455f4384430ef1e7f6c68b68b8e693da7fb57ce7185cba610e7303f3", "1c90f622c51589025695a0fec55568719627cc2030582e06bb9617b89835f32d", "40f956e223a22ed1eb978ee5163d46095d8e765bc561f5c162d364b87f8bbdf7", "0d48828ca2adbfe124489be261c2f9a78ad29ab037e0829af83fdf63e017dc48", "f89be8a1dca9efd10c998b901a995575f59fd98426944daca1ff563be33e2013", "228915d0fde57acd3fce9aa06a303c4989bce72d107408984fe18e30325948ad", "a31368e4fac8a11ec638e3e5c864cd2d36c4c54fd0c545c239ab284b256fd7d3", "57796e78b711e408945d06126d687ee2944d90e744e520a93755f3d570adc065", "874a369c3c6ae2b1331ce66f56367c7194a233c30016f0d4b0d85c0169af4a95", "590155819ebae2b41dc2b90b2eb1eeac182117da8eaeee7a8dfe249e86f4c181", "656290e36fb9c214ea07a34c0b8d4ca66a5367ca130f66ab6ed177b7e48c637c", "4410d59938f0ef46dc70063a43fa42b3764cebbcf91241a737f8f373b8cb1c7a"];
const CHI_IDS=Object.freeze(Array.from({length:12},(_,i)=>String(i).padStart(2,'0')));
export function validChiStepArt(a){return a?.schema===CHI_PROFILE&&a.characterId==='chiikawa'&&a.reviewCandidate===true&&a.productionApproved===false&&a.enabledByDefault===false&&a.autonomous===false&&a.rootTravel===false&&a.loop===false&&a.displayMode==='actor-expanded-registration'&&Array.isArray(a.frames)&&a.frames.length===12&&Array.from({length:12},(_,i)=>a.frames[i]).every((f,i)=>f?.poseId===CHI_IDS[i]&&f.sha256===CHI_HASHES[i]&&f.width===1254&&f.height===1254&&typeof f.source==='string'&&(f.source.startsWith(['data','image/png;base64,'].join(':'))||f.source==='assets/'+f.sha256+'.png'));}

export function createAuthoredStepController({fixture,context,owner,acquire,release,decode,paint,clear,now=()=>performance.now(),requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id),setTimer=setTimeout,clearTimer=clearTimeout}) {
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
export function fullPaintSafe(g){return !!g&&rect(g.union)&&rect(g.viewport)&&rect(g.stage)&&g.viewport.right-g.viewport.left>=640&&contained(g.union,g.viewport)&&contained(g.union,g.stage)&&Array.isArray(g.obstacles)&&g.obstacles.every(r=>rect(r)&&!intersects(g.union,r));}
export function createStepEngineAdapter({getEngine,readGeometry,readUI,profile=null}){
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
export async function decodeReviewedStep(frames,{signal,ImageCtor=Image,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 if(signal?.aborted)throw Error('aborted');
 const images=[];let timer,abort;
 const cleanup=()=>images.forEach(im=>im.removeAttribute('src'));
 try{
  const stopped=new Promise((_,reject)=>{abort=()=>reject(Error('aborted'));signal?.addEventListener('abort',abort,{once:true});timer=setTimer(()=>reject(Error('decode-timeout')),8000);});
  const batch=Promise.all(frames.map(f=>{const im=new ImageCtor();images.push(im);im.src=f.source;return Promise.resolve().then(()=>{if(signal?.aborted)throw Error('aborted');return im.decode();}).then(()=>{if(im.naturalWidth!==1254||im.naturalHeight!==1254)throw Error('invalid-size');});}));
  await Promise.race([batch,stopped]);if(signal?.aborted)throw Error('aborted');return{cleanup};
 }catch(e){cleanup();throw e;}finally{if(timer!==undefined)clearTimer(timer);signal?.removeEventListener('abort',abort);}
}
