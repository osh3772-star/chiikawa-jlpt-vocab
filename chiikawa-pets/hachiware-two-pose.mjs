/** Reviewed EP5 stills, NOT a reconstruction of source animation or source timing. */
export function hachiwareTwoPoseAsset(sourceA, sourceB) {
  return {
    testingAuthorized:true, enabledByDefault:false, productionEnabled:false,
    reviewScope:'LIMITED_TWO_STATIC_CAMEOS_VISUAL_PASS',
    sourceRepresentation:'DERIVED_UPPERBODY_CAMEO', bodyPoseCount:2,
    timingOrigin:'AUTHORED_WEB_UX', loop:false, interpolation:false,
    windowSize:[120,102],
    frames:[
      {poseId:'A',source:sourceA,assetSize:[1536,1024],headRect:[432,171,710],durationMs:650},
      {poseId:'B',source:sourceB,assetSize:[1536,1024],headRect:[294,72,942],durationMs:650}
    ]
  };
}
export function hachiwarePoseGeometry(frame) {
  const [x,y,headWidth]=frame.headRect, [w,h]=frame.assetSize, scale=120/headWidth;
  return {width:w*scale,height:h*scale,left:-x*scale,top:-y*scale};
}
function validAsset(a) {
  return a?.testingAuthorized===true && a.enabledByDefault===false && a.productionEnabled===false &&
    a.reviewScope==='LIMITED_TWO_STATIC_CAMEOS_VISUAL_PASS' && a.sourceRepresentation==='DERIVED_UPPERBODY_CAMEO' &&
    a.bodyPoseCount===2 && a.timingOrigin==='AUTHORED_WEB_UX' && a.loop===false && a.interpolation===false &&
    a.windowSize?.join(',')==='120,102' && a.frames?.length===2 && a.frames.every((f,i)=>
      f.poseId===['A','B'][i] && typeof f.source==='string' && f.source.length>0 &&
      f.assetSize?.join(',')==='1536,1024' && f.headRect?.join(',')===[ '432,171,710','294,72,942'][i] &&
      Number.isFinite(f.durationMs) && f.durationMs>0);
}
/** Decoder is abort-aware. Cancellation invalidates browsers' unabortable decode promise too. */
export async function decodeHachiwareFrames(frames,{signal}) {
  const images=[];
  const clear=()=>{for(const image of images)image.removeAttribute('src');};
  const abort=()=>clear();
  signal.addEventListener('abort',abort,{once:true});
  try {
    if(signal.aborted)throw new Error('aborted');
    await Promise.all(frames.map(async frame=>{
      const image=new Image();images.push(image);image.src=frame.source;await image.decode();
    }));
    if(signal.aborted)throw new Error('aborted');
    return clear;
  } catch(error) { clear();throw error; }
  finally {signal.removeEventListener('abort',abort);}
}
/** onBegin synchronously acquires exclusive base-actor lease; onEnd releases it exactly once.
 * loadImage(frames,{signal}) may return a cleanup function. prepareStage({signal}) must
 * check signal before deferred DOM writes. Context/lease callbacks never mutate study data.
 */
export function createHachiwareTwoPoseController(options) {
  const {asset,image,clip,rail,status,getContext,onBegin,onEnd,
    prepareStage=async()=>{},readClip=()=>clip.getBoundingClientRect(),readObstacles=()=>[],
    loadImage=decodeHachiwareFrames,
    requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id)}=options;
  let generation=0,mode='off',active=false,acquired=false,disposed=false;
  let handle=null,startedAt=null,index=0,abort=null,releaseResources=null;
  const valid=validAsset(asset);
  image.hidden=true;rail.hidden=true;
  function clearPending() {
    generation++;abort?.abort();abort=null;
    if(handle!==null)cancelFrame(handle);handle=null;startedAt=null;
    const release=releaseResources;releaseResources=null;release?.();
  }
  function cancel(reason='cancelled') {
    clearPending();mode='off';active=false;image.hidden=true;
    if(reason==='closed'||reason==='destroyed')rail.hidden=true;
    if(acquired){acquired=false;onEnd();}
    status.textContent='하치와레 상체 미리보기 숨김';
  }
  function render(i) {
    index=i;const frame=asset.frames[i],g=hachiwarePoseGeometry(frame);
    Object.assign(image.style,{position:'absolute',width:`${g.width}px`,height:`${g.height}px`,left:`${g.left}px`,top:`${g.top}px`,maxWidth:'none',transform:'none',transition:'none',animation:'none'});
    image.src=frame.source;image.dataset.pose=frame.poseId;
  }
  async function start() {
    if(disposed||mode==='loading'||mode==='sequence')return false;
    // A replay retains the lease while hidden, preventing a base-actor flash.
    clearPending();mode='off';active=false;image.hidden=true;
    if(!valid||!getContext().visible){cancel('unavailable');return false;}
    const token=generation,controller=new AbortController();abort=controller;mode='loading';
    status.textContent='검토된 두 상체 자세 준비 중';
    try {
      const cleanup=await loadImage(asset.frames,{signal:controller.signal});
      if(token!==generation){if(typeof cleanup==='function')cleanup();return false;}
      if(typeof cleanup==='function')releaseResources=cleanup;
      Object.assign(clip.style,{position:'relative',overflow:'hidden',width:'120px',height:'102px',flex:'0 0 auto'});
      render(0);rail.hidden=false;
      await prepareStage({signal:controller.signal});
      if(token!==generation)return false;
      const context=getContext();
      if(!context.visible){cancel('hidden');return false;}
      const rect=readClip();
      if(![rect.width,rect.height,rect.left,rect.right,rect.top,rect.bottom].every(Number.isFinite)||rect.width<119||rect.height<101||
        readObstacles().some(r=>rect.left<r.right+6&&rect.right>r.left-6&&rect.top<r.bottom+6&&rect.bottom>r.top-6)){
        cancel('unsafe-space');status.textContent='빈 상체 무대 공간이 부족하여 생략';return false;
      }
      if(!acquired){if(!onBegin()){cancel('lease-denied');return false;}acquired=true;}
      active=true;image.hidden=false;
      if(context.paused||context.reduced){mode='static';status.textContent='A 정지 상체만 · 원작 연속동작 아님';return true;}
      mode='sequence';status.textContent='A→B 두 정지 자세 · 제작 UI 리듬 · 원작 속도 아님';
      const tick=now=>{
        if(token!==generation||mode!=='sequence')return;handle=null;
        const latest=getContext();
        if(!latest.visible){cancel('hidden');return;}
        if(latest.paused||latest.reduced){render(0);mode='static';status.textContent='A 정지 상체만 · 원작 연속동작 아님';return;}
        if(startedAt===null)startedAt=now;
        const elapsed=now-startedAt;
        if(elapsed>=asset.frames[0].durationMs&&index!==1)render(1);
        if(elapsed>=asset.frames[0].durationMs+asset.frames[1].durationMs){mode='complete';status.textContent='B 정지 유지 · 자동 반복/복귀 없음';return;}
        handle=requestFrame(tick);
      };
      handle=requestFrame(tick);return true;
    } catch(error) {
      if(token===generation){cancel('preview-error');status.textContent='그림 준비 실패 · 미리보기만 생략';}
      return false;
    }
  }
  return {start,cancel,destroy(){disposed=true;cancel('destroyed');image.removeAttribute?.('src');},
    getState(){return {active,mode,pose:asset?.frames?.[index]?.poseId??'A',bodyPoseCount:2,
      representation:'DERIVED_UPPERBODY_CAMEO',motionPlayback:false,limitedKeyposePlayback:mode==='sequence'};}};
}
