/** Reviewed sparse poses only: no tween, movement path, looping or inferred contacts. */
export function registeredPoseGeometry(frame){
 const r=frame?.sourceRect,s=frame?.assetSize,k=frame?.scale;
 if(!Array.isArray(r)||r.length!==4||!Array.isArray(s)||s.length!==2||![...r,...s,k,frame.left,frame.top].every(Number.isFinite))return null;
 const[l,t,right,b]=r,[w,h]=s;if(l<0||t<0||right<=l||b<=t||right>w||b>h||k<=0)return null;
 return {width:w*k,height:h*k,left:frame.left-l*k,top:frame.top-t*k,inset:[t*k,(w-right)*k,(h-b)*k,l*k]};
}
export function validObservedFragment(a){
 const expected={'usagi-lowering':['D','E','C'],'rakko-expression':['open','closed']}[a?.fragmentId];
 return !!expected&&a.testingAuthorized===true&&a.enabledByDefault===false&&a.productionEnabled===false&&a.motionActivation===false&&a.timingOrigin==='AUTHORED_UI_POSE_RHYTHM'&&a.loop===false&&a.interpolation===false&&a.holdMs===650&&a.windowSize?.length===2&&a.windowSize.every(n=>Number.isFinite(n)&&n>=100&&n<=220)&&a.frames?.length===expected.length&&a.frames.every((f,i)=>f.poseId===expected[i]&&typeof f.source==='string'&&f.source.length>0&&registeredPoseGeometry(f));
}
export async function decodeObservedPoses(frames,{signal}){
 const images=[],clear=()=>images.forEach(im=>im.removeAttribute('src'));
 signal.addEventListener('abort',clear,{once:true});
 try{if(signal.aborted)throw Error('aborted');await Promise.all(frames.map(async f=>{const im=new Image();images.push(im);im.src=f.source;await im.decode();if(im.naturalWidth!==f.assetSize[0]||im.naturalHeight!==f.assetSize[1])throw Error('asset dimensions');}));if(signal.aborted)throw Error('aborted');return{cleanup:clear};}
 catch(e){clear();throw e;}finally{signal.removeEventListener('abort',clear);}
}
export function createObservedPoseFragment(options){
 const{asset,image,clip,rail,status,getContext,onBegin,onEnd,loadImages=decodeObservedPoses,prepareStage=async()=>{},readClip=()=>clip.getBoundingClientRect(),readObstacles=()=>[],requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id)}=options;
 const valid=validObservedFragment(asset);let generation=0,mode='off',active=false,acquired=false,disposed=false,handle=null,abort=null,loaded=null,pose=null,startTime=null;
 image.hidden=true;rail.hidden=true;
 function reset(release=true){generation++;abort?.abort();abort=null;if(handle!==null)cancelFrame(handle);handle=null;startTime=null;image.hidden=true;image.removeAttribute?.('src');loaded?.cleanup?.();loaded=null;mode='off';active=false;pose=null;if(release&&acquired){acquired=false;onEnd();}}
 function cancel(reason='cancelled'){reset();if(reason==='closed'||reason==='destroyed')rail.hidden=true;status.textContent='관찰 조각 숨김';}
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
   if(context.paused||context.reduced){mode='static';status.textContent=`${pose} 정지 · 동작 줄이기/일시정지`;return true;}
   mode='sequence';status.textContent='관찰된 자세 순서 · 제작 UI 리듬 · 원작 정확한 속도 아님';
   const tick=now=>{if(token!==generation||mode!=='sequence')return;handle=null;const c=getContext();if(!c.visible||c.paused||c.reduced){cancel('context-change');return;}if(startTime===null)startTime=now;const index=Math.min(asset.frames.length-1,Math.floor(Math.max(0,now-startTime)/asset.holdMs));if(pose!==asset.frames[index].poseId)render(index);if(index===asset.frames.length-1){mode='static';status.textContent=`${pose} 마지막 자세 유지 · 자동 반복/역재생 없음`;return;}handle=requestFrame(tick);};
   handle=requestFrame(tick);return true;
  }catch(_){if(token===generation){cancel('error');status.textContent='그림 표시 실패 · 이 미리보기만 생략';}return false;}
 }
 return{start,cancel,destroy(){disposed=true;cancel('destroyed');},getState:()=>({mode,active,pose,bodyPoseCount:asset?.frames?.length??0,motionPlayback:false,limitedKeyposePlayback:mode==='sequence'})};
}
