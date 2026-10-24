/** One reviewed fixed body + authored webpage translation. No anime motion synthesis. */
export function rectanglesOverlap(a, b, margin = 0) {
  return a.left < b.right + margin && a.right > b.left - margin && a.top < b.bottom + margin && a.bottom > b.top - margin;
}
export function planMomongaPreviewPath(rail, assetSize, obstacles = []) {
  if (!rail || !Array.isArray(assetSize) || assetSize.length !== 2) return null;
  const width = rail.right - rail.left, height = rail.bottom - rail.top;
  if (![width,height,...assetSize].every(n=>Number.isFinite(n)&&n>0)) return null;
  const margin=12, caption=26, minimumTravel=48, aspect=assetSize[0]/assetSize[1];
  const imageWidth=Math.min(220,width-2*margin-minimumTravel,(height-caption-margin)*aspect);
  if(imageWidth<96)return null;
  const imageHeight=imageWidth/aspect;
  const y=caption+(height-caption-margin-imageHeight)/2;
  const start={x:margin,y},end={x:width-margin-imageWidth,y};
  const swept={left:rail.left+start.x,top:rail.top+y,right:rail.left+end.x+imageWidth,bottom:rail.top+y+imageHeight};
  if(obstacles.some(rect=>rectanglesOverlap(swept,rect,6)))return null;
  return {width:imageWidth,height:imageHeight,start,mid:{x:(start.x+end.x)/2,y},end,swept};
}
export function sampleMomongaPreviewPath(path, progress) {
  const t=Math.max(0,Math.min(1,progress));
  return {x:path.start.x+(path.end.x-path.start.x)*t,y:path.start.y+(path.end.y-path.start.y)*t};
}
export function createMomongaPreviewController(options) {
  const {asset,image,rail,status,getContext,onBegin,onEnd,prepareStage=async()=>{},
    readRail=()=>rail.getBoundingClientRect(),readObstacles=()=>[],
    requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id),
    loadImage=()=>typeof image.decode==='function'?image.decode():new Promise((resolve,reject)=>{
      if(image.complete){image.naturalWidth>0?resolve():reject(new Error('Image unavailable'));return;}
      image.addEventListener('load',resolve,{once:true});image.addEventListener('error',reject,{once:true});
    })}=options;
  let generation=0,frameHandle=0,active=false,acquired=false,mode='off',path=null,startTime=null,position=null;
  const valid=asset?.testingAuthorized===true&&asset.enabledByDefault===false&&asset.productionEnabled===false&&
    asset.bodyPoseCount===1&&asset.sourceRepresentation==='DERIVED_REFERENCE_CUTOUT'&&asset.durationOrigin==='AUTHORED_WEB_UX';
  if(valid)image.src=asset.source;
  image.hidden=true;rail.hidden=true;
  function announce(text){status.textContent=text;}
  function cancel(reason='cancelled'){
    generation++;if(frameHandle)cancelFrame(frameHandle);frameHandle=0;
    const wasActive=active||mode==='loading';active=false;mode='off';image.hidden=true;if(reason==='closed')rail.hidden=true;startTime=null;path=null;position=null;
    if(acquired){acquired=false;onEnd();}
    if(wasActive)announce(reason==='complete'?'미리보기 끝 · 원작 동작/궤적 재현 아님':'미리보기 중단 · 새 착지 동작 없이 숨김');
  }
  function render(point){position=point;image.style.transform=`translate3d(${point.x.toFixed(2)}px, ${point.y.toFixed(2)}px, 0)`;}
  async function start(){
    cancel('replaced');const token=++generation;
    const context=getContext();
    if(!valid||!context.visible){announce(context.visible?'검토된 미리보기 자산이 없어 실행하지 않았습니다':'모몽가를 먼저 꺼내 주세요');return false;}
    mode='loading';announce('검토된 정지 자세 준비 중');
    try{await loadImage();if(token!==generation)return false;rail.hidden=false;await prepareStage();if(token!==generation)return false;}
    catch(_){if(token===generation){cancel('image-error');announce('그림을 불러오지 못해 미리보기만 생략했습니다');}return false;}
    const latest=getContext();
    if(!latest.visible){cancel('hidden');return false;}
    path=planMomongaPreviewPath(readRail(),asset.assetSize,readObstacles());
    if(!path){cancel('unsafe-path');announce('빈 안전 통로가 부족해 미리보기를 생략했습니다');return false;}
    if(!onBegin()){cancel('not-available');return false;}
    acquired=true;active=true;
    image.style.width=`${path.width}px`;image.style.height=`${path.height}px`;
    render(path.start);image.hidden=false;
    if(latest.paused||latest.reduced){mode='static';announce('동작 줄이기/일시정지 · 영상 참고 정지 자세만 표시');return true;}
    mode='moving';announce('영상 자세 참고 + 웹 이동 연출 · 1.8초는 작성한 UI 시간');
    const tick=now=>{
      if(token!==generation||!active||mode!=='moving')return;
      const current=getContext();if(!current.visible||current.paused||current.reduced){cancel('preference-change');return;}
      if(startTime===null)startTime=now;
      const progress=(now-startTime)/asset.durationMs;
      render(sampleMomongaPreviewPath(path,progress));
      if(progress>=1){cancel('complete');return;}
      frameHandle=requestFrame(tick);
    };
    frameHandle=requestFrame(tick);return true;
  }
  return {start,cancel,getState(){return {active,mode,position:position?{...position}:null,
    sourceRepresentation:'DERIVED_REFERENCE_CUTOUT',canonicalTrajectory:false,bodyPoseCount:1};}};
}
