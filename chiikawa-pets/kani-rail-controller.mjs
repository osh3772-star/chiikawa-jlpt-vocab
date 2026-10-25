// Isolated optional rail: no actor-engine calls, no storage, no autonomous motion.
export function createKaniRailController({assets,read,decode,paint,clear,status=()=>{},now=()=>performance.now(),requestFrame=requestAnimationFrame,cancelFrame=cancelAnimationFrame}){
 let generation=0,abort=null,resources=[],phase='off',raf=0,key=null,start=0,index=0,destroyed=false,animated=false;
 const rates={idle:5,read:6,walk:9,grabbed:10},counts={idle:6,read:8,walk:8,grabbed:6};
 const release=r=>{try{r?.dispose?.();}catch{}};
 function context(){try{return read()??{};}catch{return {};}}
 function eligible(c){return c.requested===true&&c.open===true&&c.hidden===false&&c.geometrySafe===true;}
 function stop(message='꺼짐'){
  generation++;abort?.abort();abort=null;cancelFrame(raf);raf=0;const old=resources;resources=[];phase='off';key=null;animated=false;clear();old.forEach(release);status(message);
 }
 function validFrames(state){const s=assets?.states?.[state];return s?.frames?.length===counts[state]&&s.frames.every(f=>f&&typeof f.source==='string'&&f.source.length>0&&f.nativeSize?.join(',')==='512,512');}
 function tick(t){raf=0;if(destroyed||phase!=='playing')return;const c=context();if(!eligible(c)){stop('표시 조건이 바뀌어 숨김 · 선택 유지');return;}if(c.paused||c.reduced){load('idle',false);return;}const elapsed=t-start;if(!Number.isFinite(elapsed)||elapsed<0){stop('시간 상태가 바뀌어 정지');return;}const n=resources.length;index=Math.min(n-1,Math.floor(elapsed*rates[key]/1000));paint(resources[index],{state:key,index});if(elapsed>=n*1000/rates[key]){phase='hold';status(key+' 자세 1회 완료 · 마지막 그림 유지');return;}raf=requestFrame(tick);}
 async function load(state,animate){
  stop('카니 그림 준비 중');const c=context();if(destroyed||!eligible(c)){status(c.requested?'표시 조건 부족 · 선택 유지':'꺼짐');return false;}if(!Object.hasOwn(rates,state)||!validFrames(state)){phase='error';status('에셋 목록 불일치 · 숨김');return false;}
  if(animate&&(c.paused||c.reduced)){state='idle';animate=false;if(!validFrames(state)){phase='error';return false;}}
  const token=generation;key=state;animated=animate;phase='loading';abort=new AbortController();const signal=abort.signal;const frames=animate?assets.states[state].frames:[assets.states[state].frames[0]];
  // Own each resource as soon as it resolves; siblings are disposed even when another rejects.
  try{const ordered=await Promise.all(frames.map(async f=>{const r=await decode(f,{signal});if(destroyed||generation!==token||signal.aborted){release(r);return;}if(!r||r.source!==f.source){release(r);throw Error('source-mismatch');}resources.push(r);return r;}));
   if(destroyed||generation!==token)return false;abort=null;const next=context();if(!eligible(next)){stop('표시 공간 부족 · 선택 유지');return false;}if(animate&&(next.paused||next.reduced)){return load('idle',false);}
   // Decode completion order is not frame order.
   resources=ordered;if(resources.some(r=>!r))throw Error('missing-frame');index=0;start=now();phase=animate?'playing':'ready';paint(resources[0],{state,index});status(animate?state+' 자세 수동 1회 · 이동 없음':'카니 정지 표시 · 임시채택 원화');if(animate)raf=requestFrame(tick);return true;
  }catch(_){if(destroyed||generation!==token)return false;stop('그림 로드 실패 · 숨김');phase='error';return false;}
 }
 function revalidate(){if(destroyed)return;const c=context();if(!eligible(c)){if(phase!=='off')stop(c.requested?'접힘/공간/숨김 조건 · 선택 유지':'꺼짐');return;}if((c.reduced||c.paused)&&animated){load('idle',false);return;}if(phase==='off')load('idle',false);}
 return{revalidate,play:state=>load(state,true),stop:()=>load('idle',false),imageError(){stop('그림 표시 실패 · 숨김');phase='error';},getState:()=>({phase,key,index,generation,resourceCount:resources.length}),destroy(){if(destroyed)return;destroyed=true;stop('꺼짐');}};
}
