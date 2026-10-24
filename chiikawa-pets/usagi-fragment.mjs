/** EP6 sampled A→B fragment only. C is a separately requested later still. */
const REGISTRATION = [
  ['A',[326,86,1004,1088],0.11521261274918518,38.158114151443954,24.27848101265822,[1295,1214]],
  ['B',[321,124,969,1079],0.12406388760023859,43.094439658029025,13.645569620253156,[1254,1254]],
  ['C',[341,213,910,1052],0.14302741358760432,59.30870083432657,21.999999999999986,[1254,1254]]
];
export function usagiFragmentAsset(sourceA,sourceB,sourceC) {
  return {testingAuthorized:true,enabledByDefault:false,productionEnabled:false,
    reviewScope:'LIMITED_EP6_REGISTERED_FRAGMENT',timingOrigin:'AUTHORED_WEB_UX',loop:false,interpolation:false,
    windowSize:[200,160],holdMs:650,frames:REGISTRATION.map(([poseId,sourceRect,scale,left,top,assetSize],i)=>
      ({poseId,sourceRect:[...sourceRect],scale,left,top,assetSize:[...assetSize],source:[sourceA,sourceB,sourceC][i]}))};
}
function validAsset(a) {
  return a?.testingAuthorized===true&&a.enabledByDefault===false&&a.productionEnabled===false&&
    a.reviewScope==='LIMITED_EP6_REGISTERED_FRAGMENT'&&a.timingOrigin==='AUTHORED_WEB_UX'&&a.loop===false&&a.interpolation===false&&
    a.windowSize?.join(',')==='200,160'&&a.holdMs===650&&a.frames?.length===3&&a.frames.every((f,i)=>{
      const [id,rect,scale,left,top,size]=REGISTRATION[i];return f.poseId===id&&f.sourceRect?.join(',')===rect.join(',')&&
        f.scale===scale&&f.left===left&&f.top===top&&f.assetSize?.join(',')===size.join(',')&&typeof f.source==='string'&&f.source.length>0;
    });
}
export async function decodeUsagiFrames(frames,{signal}) {
  const images=[];const clear=()=>images.forEach(im=>im.removeAttribute('src'));
  signal.addEventListener('abort',clear,{once:true});
  try {
    if(signal.aborted)throw new Error('aborted');
    await Promise.all(frames.map(async frame=>{const im=new Image();images.push(im);im.src=frame.source;await im.decode();
      if(im.naturalWidth!==frame.assetSize[0]||im.naturalHeight!==frame.assetSize[1])throw new Error('asset size mismatch');}));
    if(signal.aborted)throw new Error('aborted');
    return {images,cleanup:clear};
  } catch(error){clear();throw error;} finally {signal.removeEventListener('abort',clear);}
}
/** Integration owns events, exclusive base actor lease and collision-safe stage placement.
 * prepareStage must respect signal before any deferred DOM writes. No study-state access.
 */
export function createUsagiFragmentController(options) {
  const {asset,image,clip,rail,status,getContext,onBegin,onEnd,prepareStage=async()=>{},
    readClip=()=>clip.getBoundingClientRect(),readObstacles=()=>[],loadImages=decodeUsagiFrames,
    requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id)}=options;
  const valid=validAsset(asset)&&Boolean(image);
  let generation=0,mode='off',active=false,acquired=false,disposed=false,handle=null,abort=null,loaded=null,pose=null,startTime=null;
  image.hidden=true;rail.hidden=true;
  function cancel(reason='cancelled') {
    generation++;abort?.abort();abort=null;
    if(handle!==null)cancelFrame(handle);handle=null;startTime=null;
    image.hidden=true;image.removeAttribute?.('src');loaded?.cleanup?.();loaded=null;
    mode='off';active=false;pose=null;
    if(reason==='closed'||reason==='destroyed')rail.hidden=true;
    if(acquired){acquired=false;onEnd();}
    status.textContent=reason==='complete'?'A→B 조각 끝 · 착지 없이 숨김 · 자동 반복 없음':'우사기 미리보기 숨김';
  }
  function render(index){
    const f=asset.frames[index],[l,t,r,b]=f.sourceRect;
    const [sw,sh]=f.assetSize,scale=f.scale;
    Object.assign(image.style,{position:'absolute',width:`${sw*scale}px`,height:`${sh*scale}px`,
      left:`${f.left-l*scale}px`,top:`${f.top-t*scale}px`,
      clipPath:`inset(${t*scale}px ${(sw-r)*scale}px ${(sh-b)*scale}px ${l*scale}px)`,
      maxWidth:'none',maxHeight:'none',transform:'none',transition:'none',animation:'none'});
    image.src=f.source;pose=f.poseId;image.dataset.pose=pose;
  }
  async function begin(laterStill=false) {
    // No replay queue; C cannot be mistaken for a continuation of B.
    if(disposed||mode!=='off')return false;
    if(!valid||!getContext().visible)return false;
    const token=++generation;abort=new AbortController();const signal=abort.signal;mode='loading';
    status.textContent='검토된 우사기 자세 준비 중';
    try {
      const result=await loadImages(asset.frames,{signal});
      if(token!==generation){result?.cleanup?.();return false;}loaded=result;
      if(!loaded?.images||loaded.images.length!==3)throw new Error('missing frames');
      Object.assign(clip.style,{width:'200px',height:'160px',position:'relative',overflow:'hidden',flex:'0 0 auto'});
      rail.hidden=false;await prepareStage({signal});if(token!==generation)return false;
      const context=getContext(),rect=readClip();
      if(!context.visible||rect.width<199||rect.height<159||readObstacles().some(r=>rect.left<r.right+6&&rect.right>r.left-6&&rect.top<r.bottom+6&&rect.bottom>r.top-6)){
        cancel('unsafe-space');return false;
      }
      if(!onBegin()){cancel('unavailable');return false;}acquired=true;active=true;
      render(laterStill?2:0);image.hidden=false;
      if(laterStill||context.paused||context.reduced){mode='static';status.textContent=laterStill?
        '별도 컷 C 정지 · 중간 착지/팔 내림은 관찰되지 않음':'A 정지 자세만 · 동작 재생 없음';return true;}
      mode='sequence';status.textContent='A→B 관찰 조각 · 제작 UI 리듬 · 원작 속도/완전한 점프 아님';
      const tick=now=>{
        if(token!==generation||mode!=='sequence')return;handle=null;
        const latest=getContext();if(!latest.visible||latest.paused||latest.reduced){cancel('context-change');return;}
        if(startTime===null)startTime=now;
        const elapsed=now-startTime;
        if(elapsed>=asset.holdMs*2){cancel('complete');return;}
        if(elapsed>=asset.holdMs&&pose!=='B')render(1);
        handle=requestFrame(tick);
      };
      handle=requestFrame(tick);return true;
    } catch(_){if(token===generation){cancel('error');status.textContent='그림 로드/표시 실패 · 미리보기만 생략';}return false;}
  }
  return {start:()=>begin(false),showLaterStill:()=>begin(true),cancel,
    destroy(){disposed=true;cancel('destroyed');},
    getState:()=>({mode,active,pose,bodyPoseCount:3,motionPlayback:false,limitedKeyposePlayback:mode==='sequence'})};
}
/** Optional event wiring; also call cancel from explicit next/back/rating handlers. */
export function bindUsagiCancellation(controller,{windowTarget,documentTarget,studyTarget}) {
  const subscriptions=[];const listen=(target,type,fn)=>{if(!target)return;target.addEventListener(type,fn);subscriptions.push(()=>target.removeEventListener(type,fn));};
  listen(windowTarget,'keydown',e=>{if(e.key==='Escape')controller.cancel('escape');});
  for(const type of ['resize','blur'])listen(windowTarget,type,()=>controller.cancel(type));
  listen(documentTarget,'visibilitychange',()=>{if(documentTarget.hidden)controller.cancel('hidden');});
  for(const type of ['click','change'])listen(studyTarget,type,()=>controller.cancel('study-input'));
  listen(windowTarget,'keydown',e=>{if(!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.isComposing&&!e.repeat&&
    !e.target?.closest?.('select,input,textarea,[contenteditable="true"],.cv-pet')&&
    ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))controller.cancel('study-input');});
  return ()=>subscriptions.forEach(remove=>remove());
}
