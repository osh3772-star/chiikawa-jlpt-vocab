/** Explicit reviewed real-art QA candidate; mock harness remains unchanged. */
const ART_DISABLED = false;
const STEP_IDS = Object.freeze(['02','10','14','17','24','32']);
const EXPOSURES = Object.freeze([320,160,160,320,320,160]);
const TOTAL_MS = 1440;
const APPROVED_HASHES=["97281584802f87a799466f3598550c87dd94a90cd551da33cb0d1f2c8d9d4170","cf9f995a7a4c0ae265b80def4f214c9bc44e0ad73de27b82ee15313bb068c557","9479f56e045479d73368219d41fb3ee72f45c9e9f47d140b835dc9995ce064db","a035ad6318a2041c7656f2ce620dbce7022a08f84d7fdccf4e6cc19fc3623095","4e7065c895d704371b0fc2ef8e726bbcea008f8efb1b0b53b6c4627f9180b8a3","fde3946e1ad5a74f1830657510b5c3efad3ca9892c3653cdd8addaa3a6d8311c"];
export function validReviewedStepArt(a){return a?.schema==='reviewed-hachi-static-keys/v1'&&a.reviewCandidate===true&&a.productionApproved===false&&a.enabledByDefault===false&&a.displayMode==='actor-shared-registration'&&Array.isArray(a.frames)&&a.frames.length===6&&Array.from({length:6},(_,i)=>a.frames[i]).every((f,i)=>f?.poseId===STEP_IDS[i]&&f.sha256===APPROVED_HASHES[i]&&f.width===1254&&f.height===1254&&typeof f.source==='string'&&(f.source.startsWith(['data','image/png;base64,'].join(':'))||f.source==='assets/'+f.sha256+'.png'));}
export function createAuthoredStepController({fixture,context,owner,acquire,release,decode,paint,clear,now=()=>performance.now(),requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id),setTimer=setTimeout,clearTimer=clearTimeout}) {
 let generation=0,mode='off',lease=null,resource=null,abort=null,raf=null,timer=null,pose=-1,disposed=false,reason=null,admission=null;
 const valid=()=>validReviewedStepArt(fixture);
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
   const started=now(),first=context();if(token!==generation)return false;if(!stillEligible()||owner()!==lease){cleanup('post-acquire-changed');return false;}mode=first.paused||first.reduced?'static':'sequence';pose=0;paint(fixture.frames[0]);
   if(token!==generation)return false;
   timer=setTimer(()=>{if(token===generation)cleanup(stillEligible()&&owner()===lease?(mode==='sequence'&&pose<STEP_IDS.length-1?'missed-exposure':'finite-ui-cut'):'context-changed');},Math.max(0,TOTAL_MS-(now()-started)));
   if(mode==='static')return true;
   const tick=()=>{if(token!==generation)return;raf=null;try{const c=context();if(!stillEligible()||owner()!==lease||c.paused||c.reduced){cleanup('context-changed');return;}const elapsed=now()-started;if(elapsed>=TOTAL_MS){cleanup(pose<STEP_IDS.length-1?'missed-exposure':'finite-ui-cut');return;}let sum=0;const next=EXPOSURES.findIndex(ms=>(sum+=ms)>elapsed);if(next<pose||next>pose+1){cleanup('missed-exposure');return;}if(next!==pose){pose=next;paint(fixture.frames[next]);}if(token===generation)raf=requestFrame(tick);}catch(_){if(token===generation)cleanup('paint-or-context-error');}};
   raf=requestFrame(tick);return true;
  }catch(_){if(token===generation)cleanup('decode-or-paint-error');return false;}
 }
 return {start,canStart,cancel:cleanup,revalidate(){if(mode==='off')return;const c=context();if(!eligible(c)||c.revision!==admission?.revision||c.mount!==admission?.mount||(lease!==null&&owner()!==lease))cleanup('context-changed');},destroy(){disposed=true;cleanup('destroyed');},getState:()=>({mode,pose:pose<0?null:STEP_IDS[pose],reason,artDisabled:ART_DISABLED,reviewCandidate:true,productionApproved:false})};
}
