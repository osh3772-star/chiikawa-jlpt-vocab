import {R3,createGlide,checkCorridor} from './safe-glide.mjs';
/** A finite north-west authored path; never mirrors or warps the approved pose. */
export function characterGlidePath(g){
 if(!g||![g.viewport,g.clip,g.reserved].every(r=>r&&[r.left,r.top,r.right,r.bottom].every(Number.isFinite)&&r.right>r.left&&r.bottom>r.top))return null;
 const width=144,height=144*R3.height/R3.width,v={left:Math.max(g.viewport.left,g.clip.left,g.reserved.left),top:Math.max(g.viewport.top,g.clip.top,g.reserved.top),right:Math.min(g.viewport.right,g.clip.right,g.reserved.right),bottom:Math.min(g.viewport.bottom,g.clip.bottom,g.reserved.bottom)};
 if(v.right-v.left<width+104||v.bottom-v.top<height+72)return null;
 for(const dy of [0.62,0.46,0.78,0.94])for(const dx of [0.80,0.63,0.94]){
  const start={x:v.left+(v.right-v.left-width-24)*dx+12,y:v.top+(v.bottom-v.top-height-24)*dy+12};
  const end={x:Math.max(v.left+12,start.x-Math.min(360,(v.right-v.left)*.42)),y:Math.max(v.top+12,start.y-150)};
  const path={width,height,start,end};
  if(start.x-end.x>=80&&start.y-end.y>=48&&checkCorridor(path,g).ok)return path;
 }
 return null;
}
export function authoredGlidePath(viewport,mainLeft){
 if(!viewport||viewport.right-viewport.left<640||!Number.isFinite(mainLeft))return null;
 const width=96,height=96*R3.height/R3.width,x=Math.min(50,mainLeft-6-width),y=Math.min(450,viewport.bottom-6-height);
 const path={width,height,start:{x,y},end:{x:8,y:y-150}};
 return x-8>=24&&y-path.end.y>=48&&Math.hypot(x-8,150)>=64?path:null;
}
/** Only the audited transparent layout wrapper may be omitted, never a card/text section. */
export function glideMainRegions(main,getStyle,isVisible){
 if(!main)return [];
 const style=getStyle(main),transparent=c=>c==='transparent'||/^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(c??'');
 const decoration=s=>!transparent(s.backgroundColor)||s.backgroundImage!=='none'||s.boxShadow!=='none'||s.filter!=='none'||['Top','Right','Bottom','Left'].some(side=>parseFloat(s['border'+side+'Width'])>0)||!['none','hidden'].includes(s.outlineStyle)&&parseFloat(s.outlineWidth)>0;
 if(decoration(style)||style.transform!=='none'||(style.maskImage&&style.maskImage!=='none')||(style.clipPath&&style.clipPath!=='none'))return [main];
 for(const pseudo of ['::before','::after']){const ps=getStyle(main,pseudo);if(ps.content&&ps.content!=='none'&&ps.content!=='normal')return [main];}
 if(Array.from(main.childNodes??[]).some(n=>n.nodeType===3&&n.textContent.trim()))return [main];
 const children=Array.from(main.children??[]);
 if(!children.length||children.some(el=>el.tagName!=='SECTION'||!['home','study'].includes(el.id)))return [main];
 const shown=children.filter(isVisible);return shown.length?shown:[main];
}
export function glidePaintRect(el,getStyle){
 const r=el.getBoundingClientRect(),s=getStyle(el);let l=0,t=0,rr=0,b=0;
 if(s.filter&&s.filter!=='none')return null;
 for(const shadow of [s.boxShadow,s.textShadow]){
  if(!shadow||shadow==='none')continue;
  const clean=shadow.replace(/(?:rgba?|hsla?)\([^)]*\)/g,'').replace(/#[0-9a-f]+/gi,'');
  for(const layer of clean.split(',')){if(/inset/.test(layer))continue;const nums=layer.match(/-?[\d.]+px/g)?.map(parseFloat);if(!nums||nums.length<2)return null;
   const [x,y,blur=0,spread=0]=nums,e=Math.max(0,2*blur+spread);l=Math.max(l,e-x);rr=Math.max(rr,e+x);t=Math.max(t,e-y);b=Math.max(b,e+y);
  }
 }
 const outline=['none','hidden'].includes(s.outlineStyle)?0:Math.max(0,(parseFloat(s.outlineWidth)||0)+Math.max(0,parseFloat(s.outlineOffset)||0));
 return {left:r.left-Math.max(l,outline),top:r.top-Math.max(t,outline),right:r.right+Math.max(rr,outline),bottom:r.bottom+Math.max(b,outline)};
}
export function glideRefusalMessage(reason,s={}){
 if(reason==='visibility-or-intent'){
  if(s.explicit!==true)return '활공 실험을 켠 뒤 다시 시도해 주세요';
  if(s.mounted!==true)return '캐릭터를 준비하는 중이라 생략';
  if(s.visible!==true)return '모몽가가 꺼져 있어 생략';
  if(s.documentVisible!==true)return '현재 화면이 보이지 않아 생략';
  if(s.desktop!==true)return 'Desktop 화면에서만 사용할 수 있어 생략';
  if(s.assetAvailable!==true)return '모몽가 그림을 아직 표시할 수 없어 생략';
  if(s.safety?.scalePlacementUnavailable)return '현재 크기의 모몽가를 안전하게 놓을 공간이 없어 생략';
  if(s.safety?.inView===false)return '모몽가가 현재 보이는 배우 영역 밖에 있어 생략';
  if(s.safety?.fullPaintContained===false)return '모몽가 그림 전체가 화면 안에 들어오지 않아 생략';
  if(s.safety?.obstacleGeometryValid===false)return '학습 화면의 위치를 정확히 확인할 수 없어 생략';
  if(s.safety?.obstacleBlocked===true)return '모몽가의 현재 위치가 학습 요소를 가릴 수 있어 생략';
  return '모몽가의 현재 위치가 화면 안 안전한 공간이 아니라 생략';
 }
 if(reason==='busy-other'){const busyLabels={external:'다른 별도 미리보기가 열려 있어 생략',pair:'캐릭터끼리 반응을 주고받는 중이라 생략','study-pending':'학습 반응을 기다리는 중이라 생략','own-action':'모몽가의 다른 동작이 진행 중이라 생략','other-physical':'다른 캐릭터를 움직이는 중이라 생략'};return busyLabels[s.busyKind]??(s.coordinatorBusy?'다른 관찰 자세 미리보기가 열려 있어 생략':'다른 반응 또는 캐릭터 이동이 진행 중이라 생략');}
 const labels={captured:'모몽가를 잡고 있어 생략',touch:'모몽가의 터치 입력을 기다리는 중이라 생략',airborne:'모몽가가 내려오는 중이라 생략',physical:'모몽가 이동이 끝나지 않아 생략','physical-mode':'모몽가 이동이 끝나지 않아 생략',ime:'글자를 조합하는 중이라 생략',inputActive:'글자를 입력하는 중이라 생략',audioActive:'음성 또는 영상이 재생 중이라 생략',studyActive:'학습 입력을 처리 중이라 생략',reduced:'움직임 줄이기 설정으로 생략',paused:'캐릭터가 일시정지되어 있어 생략','busy-other':'다른 반응 또는 캐릭터 이동이 진행 중이라 생략',busy:'이미 활공 요청을 처리 중입니다'};
 return labels[reason]??'화면 상태가 달라져 안전하게 실행할 수 없어 생략';
}
export function createMomongaWebGlide({asset,getEngine,coordinator,clipObstacle=(el,r)=>r,displayed,enabled,status,characterOnly=()=>false,document:doc=globalThis.document,window:win=globalThis.window}){
 let disposed=false,ime=false,version=0,lastGeometry='',requestSerial=0,lease=null,surface=null,image=null,loadingImage=null,lastAdmissionState=null,leaseRequestSerial=null,leasePainted=false;
 const id='momonga-web-glide',listeners=[];
 const listen=(el,type,fn,opts)=>{el.addEventListener(type,fn,opts);listeners.push(()=>el.removeEventListener(type,fn,opts));};
 const rect=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom});
 const visible=el=>{if(!displayed(el))return false;for(let n=el;n&&n!==doc;n=n.parentElement){const s=win.getComputedStyle(n);if(n.hidden||s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||Number(s.opacity)===0)return false;}const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
 const inputActive=()=>!!doc.activeElement?.closest?.('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=range]),textarea,[contenteditable="true"]');
 const audioActive=()=>[...doc.querySelectorAll('audio,video')].some(m=>!m.paused&&!m.ended)||!!win.speechSynthesis?.speaking||!!win.speechSynthesis?.pending;
 const responsiveScope=()=>characterOnly()&&win.innerWidth<640?'character-only-responsive':null;
 function state(){const e=getEngine(),s=e?.readTransientAdmission?.({scope:responsiveScope()}),coordinatorBusy=coordinator.hasOtherOpen(id);return lastAdmissionState={...s,explicit:enabled()&&!disposed,ime,inputActive:inputActive(),audioActive:audioActive(),studyActive:false,visible:!!s?.visible,mounted:!!s?.mounted,
   onScreen:!!s?.onScreen&&(!!s?.desktop||!!s?.responsiveEligible)&&!!s?.assetAvailable,coordinatorBusy,otherPresentation:!!s?.otherPresentation||coordinatorBusy};}
 function geometry(){
  const w=win.innerWidth,h=win.innerHeight,vv=win.visualViewport;
  if(vv&&(![vv.offsetLeft,vv.offsetTop,vv.width,vv.height,vv.scale].every(Number.isFinite)||vv.offsetLeft<0||vv.offsetTop<0||vv.width<=0||vv.height<=0||vv.scale!==1))return null;
  const viewport={left:vv?.offsetLeft??0,top:vv?.offsetTop??0,right:Math.min(w,(vv?.offsetLeft??0)+(vv?.width??w)),bottom:Math.min(h,(vv?.offsetTop??0)+(vv?.height??h))};
  const host=getEngine()?.getTransientPresentationHost?.(),main=doc.querySelector('main');
  if(!host||(!characterOnly()&&(!main||!visible(main))))return null;
  for(let node=host;node;node=node.parentElement){const hs=win.getComputedStyle(node);if(hs.transform!=='none'||hs.filter!=='none'||(hs.perspective&&hs.perspective!=='none')||(hs.zoom&&hs.zoom!=='normal'&&Number(hs.zoom)!==1))return null;}
  const hostRect=host.getBoundingClientRect();if(hostRect.left!==0||hostRect.top!==0)return null;
  const clip=rect(host.getBoundingClientRect()),regions=characterOnly()?[]:glideMainRegions(main,(el,pseudo)=>win.getComputedStyle(el,pseudo),visible);
  const mainLeft=characterOnly()?viewport.right:Math.min(...regions.map(el=>el.getBoundingClientRect().left));
  const els=[...regions,...doc.querySelectorAll('header,#card,.paper-panel,.cv-momonga-flight-tools,button,summary,select,input,textarea,a,.table-scroll,.cv-extra-static-panel,.cv-extra-static-rail:not([hidden]),[role="tooltip"],[role="status"],.cv-pet,.cv-pet__name')];
  const obstacles=els.filter(el=>!surface?.contains(el)&&el!==surface&&!(el.closest?.('.cv-pet')?.dataset.character==='momonga'&&lease)&&visible(el)).map(el=>clipObstacle(el,glidePaintRect(el,e=>win.getComputedStyle(e)))).filter(r=>!r?.ownedClipped);
  const fixed=els.filter(el=>!el.closest?.('.cv-pet-layer')&&!surface?.contains(el)&&visible(el)).map(el=>clipObstacle(el,glidePaintRect(el,e=>win.getComputedStyle(e)))).filter(r=>!r?.ownedClipped);
  if(obstacles.some(r=>!r)||fixed.some(r=>!r))return null;
  const signature=JSON.stringify([viewport,clip,mainLeft,fixed]);if(lastGeometry&&signature!==lastGeometry)version++;lastGeometry=signature;
  return {version,viewport,clip,reserved:characterOnly()?{...viewport}:{left:0,top:0,right:mainLeft,bottom:h},obstacles,margin:6};
 }
 function remove(){surface?.remove();surface=null;image=null;}
 function release(token,reason){const current=lease===token&&leaseRequestSerial===requestSerial&&!disposed,painted=leasePainted;try{getEngine()?.releaseTransientPresentation?.(token);}finally{if(lease===token){lease=null;leaseRequestSerial=null;leasePainted=false;}if(current)status.textContent=painted&&['complete-ui-cut','absolute-deadline-ui-cut'].includes(reason)?'여백 활공 종료 · 원래 배우로 UI 복귀 (착지 아님)':painted?'안전 조건이 달라져 활공을 중단 · 원래 배우로 UI 복귀':'표시 전에 안전 조건이 달라져 활공을 생략';}}
 const clock={now:()=>win.performance.now(),request:fn=>win.requestAnimationFrame(fn),cancel:n=>win.cancelAnimationFrame(n),setTimeout:(fn,n)=>win.setTimeout(fn,n),clearTimeout:n=>win.clearTimeout(n)};
 const core=createGlide({readState:state,readGeometry:geometry,clock,
  tryAcquire:expected=>{if(coordinator.hasOtherOpen(id))return null;const current=state();const token=getEngine()?.tryAcquireTransientPresentation?.({...expected,scope:responsiveScope(),responsiveKey:current?.responsiveKey},reason=>cancel(reason));if(!token)return null;lease=token;leaseRequestSerial=requestSerial;leasePainted=false;return token;},
  owns:token=>getEngine()?.ownsTransientPresentation?.(token)===true,
  remove:()=>remove(),release,
  paint:(token,r)=>{try{
    if(!getEngine()?.ownsTransientPresentation?.(token))return;
    if(!surface){surface=doc.createElement('div');surface.className='cv-authored-glide';surface.setAttribute('aria-hidden','true');surface.style.cssText='position:absolute;left:0;top:0;padding:0;margin:0;border:0;overflow:hidden;pointer-events:auto;box-shadow:none;filter:none;';image=doc.createElement('img');image.alt='';image.draggable=false;image.src=asset.source;image.style.cssText='display:block;width:100%;height:100%;margin:0;padding:0;border:0;box-shadow:none;filter:none;';surface.appendChild(image);surface.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();cancel('pointer-grab');});image.addEventListener('error',()=>cancel('image-error'));getEngine().getTransientPresentationHost().appendChild(surface);}
    Object.assign(surface.style,{width:r.width+'px',height:r.height+'px',transform:`translate3d(${r.x}px,${r.y}px,0)`});leasePainted=true;
   }catch(_){cancel('paint-error');}}
 });
 function cancel(reason='cancel'){requestSerial++;const open=core.state().mode!=='off';try{core.cancel(reason);}finally{if(lease){remove();release(lease);}if(loadingImage){loadingImage.onload=loadingImage.onerror=null;loadingImage.removeAttribute('src');loadingImage=null;}}if(open)status.textContent='여백 활공 취소 · 원래 배우로 UI 복귀 (착지 아님)';}
 async function start(){
  if(disposed||core.state().mode!=='off')return false;
  if(!asset||asset.type!=='AUTHORED_UI_GLIDE'||asset.localTestingAuthorized!==true||asset.enabledByDefault!==false||asset.width!==96||asset.durationMs!==1800||asset.autonomous!==false||asset.originalFullMotionActivation!==false||asset.assetSha256!==R3.sha256||!asset.source){status.textContent='검토된 몸 그림이 없어 생략';return false;}
  status.textContent='여백 활공 확인 중 · 실행되면 1회 이동 후 복귀';
  const g=geometry(),path=g&&(characterOnly()?characterGlidePath(g):authoredGlidePath(g.viewport,g.reserved.right));
  if(!path||!g||!checkCorridor(path,g).ok){status.textContent=characterOnly()?'캐릭터와 버튼을 가리지 않는 비행 공간이 없어 생략':'단어를 가리지 않는 desktop 여백이 없어 생략';return false;}
  const result=core.request(path);if(!result.ok){status.textContent=glideRefusalMessage(result.reason,lastAdmissionState??{});return false;}
  const serial=++requestSerial;
  // Status is set before the geometry snapshot is re-used; avoid layout changes during decode.
  try{const probe=new win.Image();loadingImage=probe;probe.src=asset.source;await probe.decode();if(serial!==requestSerial)return false;loadingImage=null;
   if(probe.naturalWidth!==R3.width||probe.naturalHeight!==R3.height)throw Error('dimensions');
   const ok=core.ready(result.token,{decoded:true,sha256:asset.assetSha256,width:probe.naturalWidth,height:probe.naturalHeight});
   if(serial!==requestSerial)return false;
   if(!ok)status.textContent='상태 또는 안전 공간이 달라져 활공을 생략';return ok;
  }catch(_){if(serial===requestSerial)cancel('image-error');return false;}
 }
 const invalidate=reason=>{version++;cancel(reason);};
 for(const type of ['resize','scroll','blur','pagehide'])listen(win,type,()=>invalidate(type),{capture:true,passive:true});
 listen(doc,'pointerdown',event=>{if(event.target?.closest?.('.cv-pet'))cancel('pointer-grab');},true);
 listen(doc,'visibilitychange',()=>invalidate('visibility'));
 listen(doc,'compositionstart',()=>{ime=true;cancel('compositionstart');},true);listen(doc,'compositionend',()=>{ime=false;},true);
 for(const type of ['beforeinput','input'])listen(doc,type,()=>cancel(type),true);
 listen(doc,'focusin',()=>{if(inputActive())cancel('focus-input');},true);
 for(const type of ['play','playing'])listen(doc,type,()=>cancel('audio-start'),true);
 listen(doc,'toggle',()=>invalidate('layout'),true);
 listen(doc,'keydown',event=>{if(event.key==='Escape'&&core.state().mode!=='off'){event.preventDefault();cancel('Escape');}},true);
 for(const type of ['click','change'])listen(doc,type,event=>{if(event.target?.closest?.('main'))cancel('study');},true);
 for(const type of ['start','correct','wrong','complete','view'])listen(doc,'vocab:'+type,()=>cancel('study'));
 const observer=new win.MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('.cv-pet-layer')&&!status.contains(r.target)&&r.target!==status))invalidate('layout');});
 observer.observe(doc.querySelector('main'),{subtree:true,childList:true,characterData:true,attributes:true});
 if(doc.fonts)listen(doc.fonts,'loadingdone',()=>invalidate('font-layout'));
 if(win.visualViewport)for(const type of ['resize','scroll'])listen(win.visualViewport,type,()=>invalidate('viewport'),{passive:true});
 return {start,startOwned(){if(disposed||core.state().mode!=='off')return null;const promise=start(),serial=requestSerial;return {promise,cancel:reason=>{if(serial===requestSerial)cancel(reason);}};},cancel,getState:()=>({mode:core.state().mode,active:core.state().mode==='glide'}),destroy(){disposed=true;cancel('destroy');observer.disconnect();listeners.forEach(fn=>fn());}};
}

/** Independent explicit recovery geometry, never called by glide. */
export function recoveryGeometry(actor,{document:doc=globalThis.document,window:win=globalThis.window,clipObstacle=(el,r)=>r,displayed=()=>true}={}){
 const valid=r=>r&&[r.left,r.top,r.right,r.bottom].every(Number.isFinite)&&r.right>r.left&&r.bottom>r.top;
 const visible=el=>{if(!displayed(el))return false;for(let n=el;n&&n!==doc;n=n.parentElement){const s=win.getComputedStyle(n);if(n.hidden||s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||Number(s.opacity)===0)return false;}const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
 for(let n=actor.element.parentElement;n;n=n.parentElement){const s=win.getComputedStyle(n);if(s.transform!=='none'||s.filter!=='none'||s.perspective&&s.perspective!=='none'||s.zoom&&s.zoom!=='normal'&&Number(s.zoom)!==1)return null;}
 const clip=actor.element.parentElement?.getBoundingClientRect();if(!valid(clip)||clip.left!==0||clip.top!==0)return null;
 const main=doc.querySelector('main');if(!main||!visible(main))return null;
 const regions=glideMainRegions(main,(el,pseudo)=>win.getComputedStyle(el,pseudo),visible);
 const els=[...regions,...doc.querySelectorAll('header,#card,.paper-panel,button,summary,select,input,textarea,a,.table-scroll,.cv-extra-static-panel,.cv-extra-static-rail:not([hidden]),[role="tooltip"],[role="status"],.cv-pet,.cv-pet__name,.cv-pet img')];
 const obstacles=[...new Set(els)].filter(el=>el!==actor.element&&!actor.element.contains(el)&&visible(el)).map(el=>clipObstacle(el,glidePaintRect(el,e=>win.getComputedStyle(e)))).filter(r=>!r?.ownedClipped);
 const own=[actor.paint,...[actor.element,...actor.element.querySelectorAll('img,.cv-pet__name')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}).map(el=>glidePaintRect(el,e=>win.getComputedStyle(e)))];
 if([...obstacles,...own].some(r=>!valid(r)))return null;
 const hit={left:Math.min(...own.map(r=>r.left)),top:Math.min(...own.map(r=>r.top)),right:Math.max(...own.map(r=>r.right)),bottom:Math.max(...own.map(r=>r.bottom))};
 const vv=win.visualViewport,w=win.innerWidth,h=win.innerHeight;
 return {clip:{left:clip.left,top:clip.top,right:clip.right,bottom:clip.bottom},viewport:{left:vv?.offsetLeft??0,top:vv?.offsetTop??0,right:Math.min(w,(vv?.offsetLeft??0)+(vv?.width??w)),bottom:Math.min(h,(vv?.offsetTop??0)+(vv?.height??h))},padding:{left:Math.max(0,actor.x-hit.left),right:Math.max(0,hit.right-actor.x-actor.width),top:Math.max(0,actor.y-hit.top),bottom:Math.max(0,hit.bottom-actor.y-actor.height)},obstacles};
}
