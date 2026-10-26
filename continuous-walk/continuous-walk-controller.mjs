/** Explicit experimental Chi-only authored-frame loop. No probability or default start.
 * Art rootTravel:false remains unchanged: movement belongs to the guarded engine.
 */
import {validChiStepArt} from '../chiikawa-pets/reviewed-step-controller.mjs';
export const CONTINUOUS_WALK_SCOPE='chi-continuous-walk-v1';
export const CONTINUOUS_PLACEMENT_SCOPE='chi-continuous-placement-v1';
export const FLOOR_WALK_SCOPE='chi-floor-walk-v1';
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const eligible=c=>[CONTINUOUS_WALK_SCOPE,CONTINUOUS_PLACEMENT_SCOPE,FLOOR_WALK_SCOPE].includes(c?.scope)&&c.safe===true&&c.enabled===true&&c.visible===true&&c.paused===false&&c.reduced===false&&c.documentHidden===false&&c.inputBusy===false&&c.studyBusy===false&&c.captured===false&&c.physical===false&&c.composing===false&&c.mediaBusy===false;
export function createContinuousWalkController({fixture,host,decode,now=()=>performance.now(),requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=cancelAnimationFrame,setTimer=setTimeout,clearTimer=clearTimeout,onState=()=>{}}){
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
  return eligible(c)&&(!initial||(c.scope===initial.scope&&c.mount===initial.mount&&c.revision===initial.revision&&c.geometryEpoch===initial.geometryEpoch))?c:null;
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
