  // Dedicated opt-in capability. The old authored-step/manual guards are untouched.
  const CW_SCOPE='chi-continuous-walk-v1',CW_PLACEMENT_SCOPE='chi-continuous-placement-v1',CW_FLOOR_SCOPE='chi-floor-walk-v1', CW_FRAMES=__WALK_FRAMES__;
  const CWGeometry=(()=>{__WALK_GEOMETRY__;return{validRect,translateBounds,sweptPaintSafe,proposeWalkPath};})();
  const CWPlacement=(()=>{const {validRect,translateBounds,sweptPaintSafe}=CWGeometry;__WALK_PLACEMENT__;return nearestAvailableWalkPlacement;})();
  const CWFloorPlan=(()=>{const {validRect,translateBounds,sweptPaintSafe}=CWGeometry;__FLOOR_PLAN__;return proposeFloorWalk;})();
  let continuousWalk=null,cwGeometryKey=null,cwGeometryEpoch=0,cwPlacementCache=null;
  function continuousWalkStyleSafe(){
    // Five known nodes only: animated ancestor transforms can change without a DOM mutation.
    let cwAuditSafe=false;
    try{
      for(const el of [document.documentElement,document.body,root]){
        const s=getComputedStyle(el);
        for(const k of ['transform','filter','perspective','backdropFilter','clipPath','maskImage','webkitMaskImage','translate','rotate','scale'])if(s[k]&&s[k]!=='none')return false;
        if(s.zoom&&s.zoom!=='normal'&&Number(s.zoom)!==1)return false;
        if(el!==root&&s.contain&&s.contain!=='none'||s.contentVisibility&&s.contentVisibility!=='visible')return false;
      }
      const p=pets.find(p=>p.id==='chiikawa');if(!p)return false;
      for(const el of [p.figure,p.img]){const s=getComputedStyle(el);for(const k of ['transform','filter','perspective','backdropFilter','maskImage','webkitMaskImage','boxShadow','textShadow'])if(s[k]&&s[k]!=='none')return false;}
      cwAuditSafe=true;
    }catch{}
    return cwAuditSafe;
  }
  function continuousWalkGeometry(p,fresh=false){
    if(fresh)dirty=true;refreshObstacles();const v=viewport(),vv=window.visualViewport;
    if(vv&&(![vv.offsetLeft,vv.offsetTop,vv.width,vv.height,vv.scale].every(Number.isFinite)||vv.scale!==1||vv.width<=0||vv.height<=0))return null;
    const view=vv?{left:Math.max(0,vv.offsetLeft),top:Math.max(0,vv.offsetTop),right:Math.min(v.w,vv.offsetLeft+vv.width),bottom:Math.min(v.h,vv.offsetTop+vv.height)}:{left:0,top:0,right:v.w,bottom:v.h};
    if(floorWalk){let lane;try{lane=readFloorWalkViewport?.();}catch{return null;}if(!CWGeometry.validRect(lane))return null;view.left=Math.max(view.left,lane.left);view.top=Math.max(view.top,lane.top);view.right=Math.min(view.right,lane.right);view.bottom=Math.min(view.bottom,lane.bottom);}
    const others=pets.filter(q=>q!==p&&!q.el.hidden&&!q.overlayUnavailable&&!q.assetUnavailable).map(q=>paintRect(q));
    const controls=document.getElementById('continuous-walk-controls'),rawControlRect=controls?.getBoundingClientRect(),controlRect=floorWalk&&controls&&ownedViewportGeometry?.obstacleRect?ownedViewportGeometry.obstacleRect(controls,rawControlRect):rawControlRect;
    const blockers=[...obstacles,...others,...(CWGeometry.validRect(controlRect)?[controlRect]:[])],bounds=chiFootReviewBounds(p);
    if(!CWGeometry.validRect(bounds)||!CWGeometry.validRect(view)||!blockers.every(CWGeometry.validRect)||!continuousWalkStyleSafe())return null;
    const key=JSON.stringify([p.width,p.height,view,blockers]);
    if(key!==cwGeometryKey){cwGeometryKey=key;cwGeometryEpoch++;}
    return{bounds,viewport:view,obstacles:blockers,epoch:cwGeometryEpoch};
  }
  function readContinuousWalkAdmission({scope,actorId,lease=null}={}){
    const placement=scope===CW_PLACEMENT_SCOPE,floor=scope===CW_FLOOR_SCOPE;
    if(![CW_SCOPE,CW_PLACEMENT_SCOPE,CW_FLOOR_SCOPE].includes(scope)||actorId!=='chiikawa'||(floor?!floorWalk:!viewportOverlay))return{safe:false,reason:'unsupported-context',scope:scope??null,actorId:actorId??null};
    const p=pets.find(p=>p.id==='chiikawa'),own=!!continuousWalk&&continuousWalk.scope===scope&&continuousWalk.token===lease&&presentationRegistry.owns(lease);
    let study;try{study=readStudyState?.();}catch{}
    const focusedInput=!!document.activeElement?.closest?.('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=range]),textarea,[contenteditable="true"]');
    const captured=pets.some(q=>q.pointerId!==null),physical=pets.some(q=>q.airborne||PHYSICAL.has(q.mode)||floor&&['walk-start','walk','walk-stop'].includes(q.mode)),inputBusy=focusedInput||pets.some(q=>!!q.touch),composing=study?.composing!==false;
    const mediaBusy=study?.audioPending!==false||document.getElementById('bgm-play')?.getAttribute('aria-pressed')==='true';
    // Legacy busy remains unchanged. Only a quiescent explicit study/review request qualifies.
    const studyBusy=!['study','review'].includes(study?.phase)||!Number.isSafeInteger(study?.revision)||!Number.isSafeInteger(study?.transactionDepth)||study.transactionDepth!==0;
    const visible=!!p&&requestedVisible.has(p.id)&&!p.el.hidden&&!p.assetUnavailable&&!p.scalePlacementUnavailable&&!p.overlayUnavailable&&p.img.naturalWidth>0;
    const g=p?continuousWalkGeometry(p,(placement||floor)&&!own):null;
    const available=!destroyed&&visible&&!document.hidden&&!paused()&&!reduced&&!captured&&!physical&&!inputBusy&&!studyBusy&&!composing&&!mediaBusy&&!stageRect(p)&&!isBeta(p)&&!pair&&!pending&&!externalPresentation&&!transient&&(!presentationRegistry.get()||own)&&(floor||pets.every(q=>q.mode==='idle'&&!q.action))&&![...inlineResponses.values()].some(c=>c.getState().mode!=='off')&&CW_FRAMES.every(f=>!failed.has(f.source));
    let plan=null;
    if((placement||floor)&&!own&&g&&available){
      const key=JSON.stringify([scope,g.epoch,p.x,p.y,ground(p),g.bounds,paintRect(p)]);
      if(cwPlacementCache?.key===key)plan=cwPlacementCache.plan;
      // Extra quarter CSS pixel keeps recomputed registration / 0.1px display rounding inside the unchanged 4px guard.
      else {plan=(floor?CWFloorPlan:CWPlacement)({floorY:ground(p),position:{x:p.x,y:p.y},walkingBounds:g.bounds,actorBounds:paintRect(p),viewport:g.viewport,obstacles:g.obstacles,margin:4.25});cwPlacementCache={key,plan};}
    }
    const path=own?continuousWalk.path:(placement||floor)?plan?.path:g?CWGeometry.proposeWalkPath({position:{x:p.x,y:p.y},...g}):null;
    const pathSafe=(placement||floor)&&!own?!!plan:g&&path&&CWGeometry.sweptPaintSafe({...g,from:{x:p.x,y:p.y},to:{x:p.x,y:p.y}});
    const safe=!!pathSafe&&available;
    const stationaryInside=g&&CWGeometry.sweptPaintSafe({...g,obstacles:[],from:{x:p.x,y:p.y},to:{x:p.x,y:p.y}});
    const reason=safe?null:destroyed?'engine-unavailable':!visible?'actor-unavailable':document.hidden?'document-hidden':paused()?'paused':reduced?'reduced-motion':captured||inputBusy?'input-active':composing?'composing':studyBusy?'study-active':mediaBusy?'audio-active':physical?'physical-motion':stageRect(p)||isBeta(p)?'unsupported-context':pair||pending||externalPresentation||transient||presentationRegistry.get()&&!own||!floor&&pets.some(q=>q.mode!=='idle'||q.action)||[...inlineResponses.values()].some(c=>c.getState().mode!=='off')?'motion-active':!CW_FRAMES.every(f=>!failed.has(f.source))?'frame-unavailable':!g?'geometry-unavailable':(placement||floor)&&!own?'no-safe-placement':!stationaryInside?'outside-viewport':!CWGeometry.sweptPaintSafe({...g,from:{x:p.x,y:p.y},to:{x:p.x,y:p.y}})?'protected-space':!path?'no-safe-path':'state-changed';
    return{scope,actorId:'chiikawa',safe,reason,visible,paused:paused(),reduced,documentHidden:!!document.hidden,inputBusy,studyBusy,captured,physical,composing,mediaBusy,revision:study?.revision,geometryEpoch:g?.epoch??-1,key:JSON.stringify([scope,transientEpoch,study?.revision,g?.epoch,p?.x,p?.y,[...requestedVisible],manualPaused,reduced,path]),path:path?.map(q=>({...q}))??null,speed:16,requiresExplicitPlacement:!!plan?.needsRelocation};
  }
  function ownsContinuousWalk(token){return !destroyed&&!!continuousWalk&&continuousWalk.token===token&&presentationRegistry.owns(token);}
  function tryAcquireContinuousWalk(expected){
    if(continuousWalk||presentationRegistry.get())return null;
    dirty=true;refreshObstacles();
    const current=readContinuousWalkAdmission({scope:expected?.scope,actorId:expected?.actorId});
    if(!current.safe||current.key!==expected?.key||current.revision!==expected?.revision||current.geometryEpoch!==expected?.geometryEpoch)return null;
    const p=pets.find(p=>p.id==='chiikawa'),token=presentationRegistry.acquire('single',['chiikawa']);if(!token)return null;
    const fields=(style,keys)=>Object.fromEntries(keys.map(k=>[k,style[k]||'']));
    continuousWalk={token,scope:current.scope,origin:current.scope===CW_PLACEMENT_SCOPE?{x:p.x,y:p.y}:null,path:current.path.map(q=>({...q})),revision:current.revision,geometryEpoch:current.geometryEpoch,frame:null,rootStyle:fields(p.el.style,['width','height','overflow']),figureStyle:fields(p.figure.style,['position','left','top','width','height'])};
    if(current.scope===CW_PLACEMENT_SCOPE||current.scope===CW_FLOOR_SCOPE){p.x=current.path[0].x;p.y=current.path[0].y;if(current.scope===CW_FLOOR_SCOPE){p.action=null;p.mode='idle';p.airborne=false;p.vx=p.vy=0;}}
    if(typeof MutationObserver==='function'){
      const observer=new MutationObserver(records=>{const controls=document.getElementById('continuous-walk-controls');if(records.some(record=>!controls?.contains(record.target))){invalidate();cancelContinuousWalk('document-change');}});
      observer.observe(document.querySelector('main')||document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','open','class','style','aria-hidden']});continuousWalk.observer=observer;
    }
    return token;
  }
  function releaseContinuousWalk(token,reason='stop'){
    if(!continuousWalk||continuousWalk.token!==token)return false;
    const old=continuousWalk;continuousWalk=null;old.observer?.disconnect();presentationRegistry.release(token);
    const p=pets.find(p=>p.id==='chiikawa');if(p){
      Object.assign(p.el.style,old.rootStyle);Object.assign(p.figure.style,old.figureStyle);delete p.el.dataset.continuousWalk;pose(p);
      const inputOwnsPosition=['pointerdown','pointer-input','direct-input','keydown','keyboard-input','beforeinput','compositionstart','other-action'].includes(reason);
      if(old.origin&&!inputOwnsPosition&&!destroyed&&p.pointerId===null&&!PHYSICAL.has(p.mode)){
        const g=continuousWalkGeometry(p,true),point=old.origin,bounds=paintRect(p,point.x,point.y);
        if(g&&CWGeometry.sweptPaintSafe({bounds,from:point,to:point,viewport:g.viewport,obstacles:g.obstacles,margin:4})){p.x=point.x;p.y=point.y;}
      }
      if(!destroyed)render(p);
    }
    wake();return true;
  }
  function cancelContinuousWalk(reason){if(continuousWalk)releaseContinuousWalk(continuousWalk.token,reason);}
  function renderContinuousWalk(p){
    if(!continuousWalk||p.id!=='chiikawa'||!continuousWalk.frame)return false;
    const g=continuousWalkGeometry(p),hit=g?.bounds;
    if(!g||!CWGeometry.sweptPaintSafe({...g,from:{x:p.x,y:p.y},to:{x:p.x,y:p.y}})){cancelContinuousWalk('unsafe-render');return true;}
    const frame=continuousWalk.frame;
    Object.assign(p.el.style,{width:(hit.right-hit.left)+'px',height:(hit.bottom-hit.top)+'px',overflow:'visible',transform:`translate3d(${hit.left.toFixed(1)}px, ${hit.top.toFixed(1)}px, 0)`,visibility:'',clipPath:'',touchAction:'none'});
    Object.assign(p.figure.style,{position:'absolute',left:'0px',top:'0px',width:'100%',height:'100%'});
    Object.assign(p.img.style,{position:'absolute',objectFit:'fill',width:'100%',height:'100%',maxWidth:'none',left:'0px',top:'0px',clipPath:'none'});
    if(p.src!==frame.source){p.src=frame.source;p.img.src=frame.source;}
    p.frame='continuous-walk-'+frame.poseId;p.el.dataset.frame=p.frame;p.el.dataset.assetMode='authored-continuous-walk';p.el.dataset.continuousWalk=frame.poseId;p.el.classList.toggle('cv-pet--yielding',false);p.el.tabIndex=0;p.el.setAttribute('aria-hidden','false');
    return true;
  }
  function presentContinuousWalk(token,{from,to,frame}={}){
    if(!ownsContinuousWalk(token))return false;
    const p=pets.find(p=>p.id==='chiikawa'),old=continuousWalk;
    const approved=CW_FRAMES.find(f=>f.poseId===frame?.poseId);
    if(!approved||['sha256','source','width','height'].some(k=>approved[k]!==frame[k])||![from?.x,from?.y,to?.x,to?.y].every(Number.isFinite)||Math.abs(from.x-p.x)>1e-6||Math.abs(from.y-p.y)>1e-6||Math.hypot(to.x-from.x,to.y-from.y)>5)return false;
    const s=readContinuousWalkAdmission({scope:old.scope,actorId:'chiikawa',lease:token});
    if(!s.safe||s.revision!==old.revision||s.geometryEpoch!==old.geometryEpoch)return false;
    const [a,b]=old.path,min=Math.min(a.x,b.x),max=Math.max(a.x,b.x);
    if(Math.abs(to.y-a.y)>1e-6||to.x<min-1e-6||to.x>max+1e-6)return false;
    const g=continuousWalkGeometry(p);if(!g||!CWGeometry.sweptPaintSafe({...g,from,to}))return false;
    p.x=to.x;p.y=to.y;old.frame=approved;renderContinuousWalk(p);return ownsContinuousWalk(token);
  }
