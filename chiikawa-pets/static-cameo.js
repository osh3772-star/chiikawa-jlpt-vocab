export function shouldCancelPreviewForStudyInput(event, studyVisible) {
  if(['click','change'].includes(event.type))return Boolean(event.target?.closest?.('main'));
  if(event.type!=='keydown'||!studyVisible||event.altKey||event.ctrlKey||event.metaKey||event.isComposing)return false;
  if(event.target?.closest?.('select, input, textarea, [contenteditable="true"], .cv-pet, .cv-direct-stage, .cv-direct-tools, .cv-direct-status, .cv-preview-panel, .pet-tools, .cv-visibility-tools, .cv-mobile-pet-dock, .cv-evidence-status'))return false;
  return ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&!event.repeat;
}
/** Exclusive preview lifecycle. Registration never grants art/motion approval. */
export function createPreviewCoordinator() {
  const controllers=new Map();
  return {
    register(id,controller){if(controllers.has(id))throw new Error('Duplicate preview ID');controllers.set(id,controller);},
    start(id){const controller=controllers.get(id);if(!controller)return Promise.resolve(false);if(controller.canStart&&controller.canStart()!==true)return Promise.resolve(false);for(const [key,other] of controllers)if(key!==id)other.cancel('superseded');return controller.start();},
    cancelAll(reason){for(const controller of controllers.values())controller.cancel(reason);},
    hasOtherOpen(id){return [...controllers].some(([key,c])=>key!==id&&c.getState().mode!=='off');},
    anyActive(){return [...controllers.values()].some(c=>c.getState().active);},
    hasOpen(){return [...controllers.values()].some(c=>c.getState().mode!=='off');}
  };
}
export function cameoGeometry(asset) {
  const rect=asset?.sourceRect,size=asset?.assetSize,width=asset?.displayWidth;
  if(!Array.isArray(rect)||rect.length!==4||!Array.isArray(size)||size.length!==2||!Number.isFinite(width)||width<=0)return null;
  const [x,y,w,h]=rect,[sw,sh]=size;
  if(![x,y,w,h,sw,sh].every(Number.isFinite)||x<0||y<0||w<=0||h<=0||x+w>sw||y+h>sh)return null;
  const scale=width/w;
  return {width,height:h*scale,imageWidth:sw*scale,imageHeight:sh*scale,left:-x*scale,top:-y*scale};
}
export function sampleCameoFrame(frames, elapsedMs) {
  const total=frames.reduce((sum,f)=>sum+f.durationMs,0);let end=0;
  for(let i=0;i<frames.length;i++){end+=frames[i].durationMs;if(elapsedMs<end)return {index:i,done:false};}
  return {index:frames.length-1,done:elapsedMs>=total};
}
export function createStaticCameoController(options) {
  const {asset,image,clip,rail,status,getContext,onBegin,onEnd,prepareStage=async()=>{},
    readClip=()=>clip.getBoundingClientRect(),readObstacles=()=>[],
    requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id)}=options;
  const sequence=asset?.bodyPoseCount===4&&asset.reviewScope==='LIMITED_FOUR_KEYPOSE_PREVIEW'&&asset.timingOrigin==='AUTHORED_WEB_UX'&&asset.loop===false&&asset.interpolation===false;
  const frames=sequence?asset.frames:[asset];
  const geometries=frames?.map(cameoGeometry);
  const valid=geometries?.every(Boolean)&&asset?.testingAuthorized===true&&asset.enabledByDefault===false&&asset.productionEnabled===false&&asset.sourceRepresentation==='DERIVED_UPPERBODY_CAMEO'&&
    (sequence&&frames.map(f=>f.poseId).join(',')==='A,A1,B,C'&&frames.every(f=>Number.isFinite(f.durationMs)&&f.durationMs>0)||asset.bodyPoseCount===1&&asset.reviewScope==='LIMITED_STATIC_CAMEO_VISUAL_PASS');
  const windowSize=sequence?asset.windowSize:[geometries?.[0]?.width,geometries?.[0]?.height];
  const loadImage=options.loadImage??(async()=>{await Promise.all(frames.map(frame=>{const preload=new Image();preload.src=frame.source;return preload.decode();}));});
  let generation=0,active=false,acquired=false,mode='off',frameHandle=0,startTime=null,currentIndex=0;
  image.hidden=true;rail.hidden=true;
  function cancel(reason='cancelled'){
    generation++;if(frameHandle)cancelFrame(frameHandle);frameHandle=0;startTime=null;
    const wasOpen=mode!=='off';mode='off';active=false;image.hidden=true;
    if(reason==='closed')rail.hidden=true;
    if(acquired){acquired=false;onEnd();}
    if(wasOpen)status.textContent='상체 미리보기 숨김 · 새 회복 동작 없음';
  }
  function render(index){
    currentIndex=index;const geometry=geometries[index];
    Object.assign(image.style,{width:`${geometry.imageWidth}px`,height:`${geometry.imageHeight}px`,
      left:`${(windowSize[0]-geometry.width)/2+geometry.left}px`,top:`${windowSize[1]-geometry.height+geometry.top}px`});
    image.src=frames[index].source;image.dataset.pose=frames[index].poseId??'A';
  }
  async function start(){
    // A repeated click never queues/reverses/restarts a running observation fragment.
    if(mode==='loading'||mode==='sequence')return false;
    // A completed/static explicit replay retains exclusive ownership while resetting
    // invisibly; do not flash the base pet between already reviewed poses.
    if(acquired){generation++;if(frameHandle)cancelFrame(frameHandle);frameHandle=0;startTime=null;active=false;mode='off';image.hidden=true;}
    else cancel('replaced');
    const token=++generation;
    if(!valid||!getContext().visible){cancel('not-available');status.textContent='치이카와 표시/검토된 아트를 확인해 주세요';return false;}
    mode='loading';status.textContent='검토된 상체 자세 준비 중';
    try{await loadImage();if(token!==generation)return false;
      Object.assign(clip.style,{width:`${windowSize[0]}px`,height:`${windowSize[1]}px`});render(0);
      rail.hidden=false;await prepareStage();if(token!==generation)return false;
    }catch(_){if(token===generation){cancel('image-error');status.textContent='그림 로드 실패 · 미리보기만 생략';}return false;}
    const context=getContext();if(!context.visible){cancel('hidden');return false;}
    const rect=readClip();
    if(rect.width<windowSize[0]-1||rect.height<windowSize[1]-1||readObstacles().some(r=>rect.left<r.right+6&&rect.right>r.left-6&&rect.top<r.bottom+6&&rect.bottom>r.top-6)){
      cancel('unsafe-space');status.textContent='빈 상체 무대 공간이 부족하여 생략';return false;
    }
    if(!acquired&&!onBegin()){cancel('not-available');return false;}
    acquired=true;active=true;image.hidden=false;
    if(!sequence||context.paused||context.reduced){mode='static';status.textContent='A 정지 상체만 · 닫기 전까지 표시';return true;}
    mode='sequence';status.textContent='확인된 A→A1→B→C 4포즈 · 제작 UI 리듬, 원작 연속동작/속도 아님';
    const tick=now=>{
      if(token!==generation||mode!=='sequence')return;
      const latest=getContext();if(!latest.visible||latest.paused||latest.reduced){cancel('preference-change');return;}
      if(startTime===null)startTime=now;
      const sample=sampleCameoFrame(frames,now-startTime);if(sample.index!==currentIndex)render(sample.index);
      if(sample.done){frameHandle=0;mode='complete';status.textContent='4포즈 표시 끝 · C 정지 유지 · 자동 반복 없음';return;}
      frameHandle=requestFrame(tick);
    };
    frameHandle=requestFrame(tick);return true;
  }
  return {start,cancel,getState(){return {active,mode,pose:frames?.[currentIndex]?.poseId??'A',bodyPoseCount:sequence?4:1,
    representation:'DERIVED_UPPERBODY_CAMEO',motionPlayback:false,limitedKeyposePlayback:mode==='sequence'};}};
}
