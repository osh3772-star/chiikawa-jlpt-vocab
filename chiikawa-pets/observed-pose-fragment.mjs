/** Reviewed source-derived poses/drawings: no pixel tween, root path, looping or inferred contacts. */
export function registeredPoseGeometry(frame){
 const r=frame?.sourceRect,s=frame?.assetSize,k=frame?.scale;
 if(!Array.isArray(r)||r.length!==4||!Array.isArray(s)||s.length!==2||![...r,...s,k,frame.left,frame.top].every(Number.isFinite))return null;
 const[l,t,right,b]=r,[w,h]=s;if(l<0||t<0||right<=l||b<=t||right>w||b>h||k<=0)return null;
 return {width:w*k,height:h*k,left:frame.left-l*k,top:frame.top-t*k,inset:[t*k,(w-right)*k,(h-b)*k,l*k]};
}
export function validObservedFragment(a){
 const expected={'chiikawa-carry-cycle':['A','AC1','AC2','C','CB1','CB2','B','BD1','BD2','D','DA1','DA2'],'chiikawa-carry-smooth':['A','AC1','AC2','C','CB1','CB2','B'],'direct-hachiware-packet':['A','B'],'direct-usagi-air-fragment':['A','B'],'momonga-rear-turn':['43','45','47','50'],'usagi-lowering':['D','E','C'],'rakko-expression':['open','closed'],'chiikawa-carry-step':['a','c','b'],'usagi-foot-step':['right-raised','low-leftlean','left-raised','low-rightlean']}[a?.fragmentId];
 const directWindow={'chiikawa-carry-cycle':[160,160],'chiikawa-carry-smooth':[160,160],'direct-hachiware-packet':[96,81.6],'direct-usagi-air-fragment':[167.3,191.2]}[a?.fragmentId];
 const validWindow=directWindow?a.windowSize?.length===2&&a.windowSize.every((n,i)=>n===directWindow[i]):a?.windowSize?.length===2&&a.windowSize.every(n=>Number.isFinite(n)&&n>=100&&n<=220);
 const cycle=a?.fragmentId==='chiikawa-carry-cycle',smooth=cycle||a?.fragmentId==='chiikawa-carry-smooth';
 const provenance=a?.frames?.every((f,i)=>f.drawingOrigin===([0,3,6].includes(i)?'OBSERVED_POSE_DERIVED':cycle&&i===9?'AUTHORED_NEUTRAL_ALIAS_NOT_OBSERVED':'AUTHORED_INBETWEEN_NOT_OBSERVED'));
 const alias=!cycle||(a.cycleCount===1&&a.slotCount===12&&a.uniqueDrawingCount===11&&a.frames?.[9]?.aliasOf==='C'&&a.frames[9].source===a.frames[3].source&&new Set(a.frames.map(f=>f.source)).size===11);
 const timing=smooth?a.timingOrigin==='AUTHORED_24FPS_ON_TWOS'&&a.holdMs===1000/12&&a.totalDisplayMs===(cycle?1000:7*(1000/12))&&a.authoredInbetweens===true&&provenance&&alias:a?.timingOrigin==='AUTHORED_UI_POSE_RHYTHM'&&a.holdMs===650;
 return !!expected&&a.testingAuthorized===true&&a.enabledByDefault===false&&a.productionEnabled===false&&a.motionActivation===false&&timing&&a.loop===false&&a.interpolation===false&&validWindow&&a.frames?.length===expected.length&&a.frames.every((f,i)=>f.poseId===expected[i]&&typeof f.source==='string'&&f.source.length>0&&registeredPoseGeometry(f));
}
export async function decodeObservedPoses(frames,{signal}){
 const images=[],clear=()=>images.forEach(im=>im.removeAttribute('src'));
 signal.addEventListener('abort',clear,{once:true});
 try{if(signal.aborted)throw Error('aborted');await Promise.all(frames.map(async f=>{const im=new Image();images.push(im);im.src=f.source;await im.decode();if(im.naturalWidth!==f.assetSize[0]||im.naturalHeight!==f.assetSize[1])throw Error('asset dimensions');}));if(signal.aborted)throw Error('aborted');return{cleanup:clear};}
 catch(e){clear();throw e;}finally{signal.removeEventListener('abort',clear);}
}
export function createObservedPoseFragment(options){
 const{asset,image,clip,rail,status,getContext,onBegin,onEnd,loadImages=decodeObservedPoses,prepareStage=async()=>{},readClip=()=>clip.getBoundingClientRect(),readObstacles=()=>[],requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id),exitPolicy=null,setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}=options;
 const smooth=['chiikawa-carry-smooth','chiikawa-carry-cycle'].includes(asset?.fragmentId);
 const finiteExit=exitPolicy?.kind==='AUTHORED_UI_RESTORE'&&exitPolicy.holdMs===(smooth?1000/12:650);
 const valid=validObservedFragment(asset)&&(smooth?finiteExit:(exitPolicy===null||finiteExit));let exitHandle=null;let generation=0,mode='off',active=false,acquired=false,disposed=false,handle=null,abort=null,loaded=null,pose=null,startTime=null;
 image.hidden=true;rail.hidden=true;
 function reset(release=true){generation++;if(exitHandle!==null)clearTimer(exitHandle);exitHandle=null;abort?.abort();abort=null;if(handle!==null)cancelFrame(handle);handle=null;startTime=null;image.hidden=true;image.removeAttribute?.('src');loaded?.cleanup?.();loaded=null;mode='off';active=false;pose=null;if(release&&acquired){acquired=false;onEnd();}}
 function cancel(reason='cancelled'){reset();if(reason==='closed'||reason==='destroyed')rail.hidden=true;status.textContent='관찰 조각 숨김';}
 function scheduleExit(token,delay=exitPolicy?.holdMs??650){if(!finiteExit)return;exitHandle=setTimer(()=>{if(token!==generation||!active)return;exitHandle=null;cancel('finite-ui-restore');status.textContent='기본 캐릭터로 UI 교체 · 원작 회복 동작 아님';},delay);}
 function render(index){const f=asset.frames[index],g=registeredPoseGeometry(f);Object.assign(image.style,{position:'absolute',width:`${g.width}px`,height:`${g.height}px`,left:`${g.left}px`,top:`${g.top}px`,clipPath:`inset(${g.inset.map(n=>n+'px').join(' ')})`,maxWidth:'none',maxHeight:'none',transform:'none',transition:'none',animation:'none'});image.src=f.source;pose=f.poseId;image.dataset.pose=pose;}
 async function start(){
  if(disposed||mode==='loading'||mode==='sequence'||!valid||!getContext().visible)return false;
  // A deliberate restart after the final held pose retains its exclusive actor lease.
  reset(false);const token=generation;abort=new AbortController();const signal=abort.signal;mode='loading';status.textContent='검토된 관찰 자세 준비 중';
  try{const result=await loadImages(asset.frames,{signal});if(token!==generation){result?.cleanup?.();return false;}loaded=result;
   const[w,h]=asset.windowSize;Object.assign(clip.style,{width:w+'px',height:h+'px',position:'relative',overflow:'hidden',flex:'0 0 auto'});
   rail.hidden=false;await prepareStage({signal});if(token!==generation)return false;
   const context=getContext(),r=readClip();if(!context.visible||r.width<w-1||r.height<h-1||readObstacles().some(b=>r.left<b.right+6&&r.right>b.left-6&&r.top<b.bottom+6&&r.bottom>b.top-6)){cancel('unsafe-space');return false;}
   if(!acquired){if(!onBegin()){cancel('lease-denied');return false;}acquired=true;}active=true;render(0);image.hidden=false;
   if(context.paused||context.reduced){mode='static';status.textContent=`${pose} 정지 · 동작 줄이기/일시정지`;scheduleExit(token,smooth?asset.totalDisplayMs:650);return true;}
   mode='sequence';status.textContent=smooth?(asset.fragmentId==='chiikawa-carry-cycle'?'12슬롯/11원화 · 작성 폐주기 1회 · D=C · 무한 반복 아님':'관찰 자세 + 작성 중간 원화 · 연속 원화 1회 실험 · 원작 정확한 속도 아님'):'관찰된 자세 순서 · 제작 UI 리듬 · 원작 정확한 속도 아님';
   const tick=now=>{if(token!==generation||mode!=='sequence')return;handle=null;const c=getContext();if(!c.visible||c.paused||c.reduced){cancel('context-change');return;}if(startTime===null)startTime=now;const elapsed=Math.max(0,now-startTime);if(smooth&&elapsed>=asset.totalDisplayMs){cancel('expired-drawing');status.textContent='표시 기한을 넘겨 연속 원화 안전 취소';return;}const index=Math.min(asset.frames.length-1,Math.floor(elapsed/asset.holdMs));if(smooth&&index>asset.frames.findIndex(f=>f.poseId===pose)+1){cancel('dropped-drawing');status.textContent='표시 지연으로 중간 원화 건너뜀 감지 · 안전 취소';return;}if(pose!==asset.frames[index].poseId)render(index);if(index===asset.frames.length-1){mode='static';status.textContent=finiteExit?`${pose} 마지막 자세 · 잠시 뒤 UI 복원`:`${pose} 마지막 자세 유지 · 자동 반복/역재생 없음`;scheduleExit(token);return;}handle=requestFrame(tick);};
   handle=requestFrame(tick);return true;
  }catch(_){if(token===generation){cancel('error');status.textContent='그림 표시 실패 · 이 미리보기만 생략';}return false;}
 }
 return{start,cancel,destroy(){disposed=true;cancel('destroyed');},getState:()=>({mode,active,pose,exitPending:exitHandle!==null,bodyPoseCount:asset?.frames?.length??0,motionPlayback:false,limitedKeyposePlayback:mode==='sequence'})};
}
