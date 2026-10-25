export function createKaniPresentation({frames,read,decode,paint,restore,now}){
 let generation=0,mode='off',key=null,owned=null,start=0,index=-1;
 const rates={idle:5,read:6,walk:9,grabbed:10};
 function safe(c){return c.visible&&!c.hidden&&!c.paused&&!c.reduced&&!c.unavailable&&c.spaceSafe;}
 function valid(){const c=read();return safe(c)&&(key==='grabbed'?c.captured&&c.pointerId===owned.pointerId&&c.captureGeneration===owned.captureGeneration:!c.captured&&!c.physical);}
 function cancel(){generation++;mode='off';key=null;owned=null;index=-1;restore();}
 async function begin(state){cancel();if(!Object.hasOwn(rates,state)||!Array.isArray(frames[state]))return false;key=state;owned=read();if(!valid()){cancel();return false;}const token=generation;mode='loading';try{await Promise.all(frames[state].map(decode));if(token!==generation)return false;if(!valid()){cancel();return false;}start=now();index=0;mode='playing';paint(frames[state][0],state,0);return true;}catch(_){if(token===generation)cancel();return false;}}
 function tick(t){if(mode==='off')return;if(!valid()){cancel();return;}if(mode!=='playing')return;const elapsed=t-start;if(!Number.isFinite(elapsed)||elapsed<0){cancel();return;}const n=frames[key].length,next=Math.min(n-1,Math.floor(elapsed*rates[key]/1000));if(next!==index){index=next;paint(frames[key][index],key,index);}if(elapsed>=n*1000/rates[key])mode='hold';}
 return{begin:()=>begin('grabbed'),preview:state=>state==='grabbed'?Promise.resolve(false):begin(state),tick,cancel,destroy:cancel,getState:()=>({mode,key,index})};
}

/** AUTHORED_UI held-capture visual candidate. Same three poses; no canonical-motion claim. */
const CAPTURE_SHA='d38ead18705743d3bcb44f0ab666db962940c7a9e49a8b356e6d4dc21caaee02';
function validCaptureContract(a){
 const expected=[[0,100,543,600],[543,100,543,600],[0,750,543,600]];
 return a?.authoredCapture===true&&a.enabledByDefault===true&&a.sha256===CAPTURE_SHA&&a.assetSize?.join(',')==='1086,1448'&&a.commonScale===0.2086&&a.frames?.length===3&&typeof a.source==='string'&&a.source.length>0&&a.frames.every((f,i)=>f.poseId===['A','open','B'][i]&&f.durationMs===[220,180,220][i]&&f.scale===a.commonScale&&f.sourceRect?.join(',')===expected[i].join(',')&&Number.isFinite(f.left)&&Number.isFinite(f.top));
}
async function decodeCaptureSheet(asset,{signal,ImageCtor=Image,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 if(!validCaptureContract(asset))throw Error('unapproved capture manifest');
 if(signal?.aborted)throw Error('aborted');
 const image=new ImageCtor();let timer,abort;
 const cleanup=()=>image.removeAttribute('src');
 try{
  const stopped=new Promise((_,reject)=>{abort=()=>{cleanup();reject(Error('aborted'));};signal?.addEventListener('abort',abort,{once:true});timer=setTimer(()=>{cleanup();reject(Error('timeout'));},8000);});
  image.src=asset.source;
  await Promise.race([image.decode(),stopped]);
  if(signal?.aborted||image.naturalWidth!==1086||image.naturalHeight!==1448)throw Error('invalid decoded dimensions');
  return{cleanup};
 }catch(e){cleanup();throw e;}finally{if(timer!==undefined)clearTimer(timer);signal?.removeEventListener('abort',abort);}
}
function capturePaintStyle(frame,actorWidth){
 if(!Number.isFinite(actorWidth)||actorWidth<=0)throw Error('width');
 const factor=actorWidth/126,s=0.2086*factor,[x,y,w,h]=frame.sourceRect;
 return{position:'absolute',objectFit:'fill',width:`${1086*s}px`,height:`${1448*s}px`,maxWidth:'none',left:`${frame.left*factor}px`,top:`${frame.top*factor}px`,clipPath:`inset(${y*s}px ${(1086-x-w)*s}px ${(1448-y-h)*s}px ${x*s}px)`};
}

const CAPTURE_ASSET=null; // Chi-only art excluded from isolated Kani demo.
/** Capture-owned AUTHORED_UI visual; existing physical tick, no separate timer or lease. */
const ART_DISABLED=false;
const CAPTURE_IDS=Object.freeze(['A','open','B']);
const CAPTURE_EXPOSURES=Object.freeze([220,180,220]);
const BURST_MS=620;
function createCaptureVisual({art,readCapture,decode,paint,restoreStatic,now=()=>performance.now()}){
 let generation=0,active=null,abort=null,resource=null,disposed=false,phase='off',reason=null,lastAttempt=null;
 const valid=()=>validCaptureContract(art);
 const owns=s=>!!active&&s?.characterId==='chiikawa'&&s.captured===true&&s.pointerId===active.pointerId&&s.captureGeneration===active.captureGeneration&&s.mount===active.mount&&s.visible===true&&!s.hidden&&!s.paused&&!s.reduced&&['grab-onset','hold'].includes(s.mode);
 function cancel(why='cancelled'){
  generation++;reason=why;abort?.abort();abort=null;const old=resource;resource=null;active=null;phase='off';
  // Restore only this visual channel; adapter must preserve current physical mode.
  try{restoreStatic();}finally{old?.cleanup?.();}
 }
 function tick(t=now()){
  if(!active||disposed)return false;
  let s;try{s=readCapture();}catch(_){cancel('capture-read-error');return false;}
  if(!owns(s)){cancel('capture-ended');return false;}
  if(phase!=='playing')return false;
  // Authored UI cadence only. Use the existing engine clock, never a new timer/RAF.
  const elapsed=t-active.started;
  if(!Number.isFinite(elapsed)||elapsed<0){cancel('invalid-clock');return false;}
  const cycle=Math.floor(elapsed/800),within=elapsed%800;
  const local=within<220?0:within<400?1:within<620?2:3;
  const slot=cycle*4+local,index=[0,1,2,1][local];
  if(slot<active.slot||slot>active.slot+1){cancel('missed-pose');return false;}
  if(slot!==active.slot){active.slot=slot;active.index=index;try{paint(art.frames[index]);}catch(_){cancel('paint-error');return false;}}
  return true;
 }
 async function begin(){
  if(disposed||!valid())return false;
  let s;try{s=readCapture();}catch(_){return false;}
  if(s?.characterId!=='chiikawa'||s.captured!==true||s.pointerId===null||s.pointerId===undefined||s.visible!==true||s.hidden||s.paused||s.reduced||!['grab-onset','hold'].includes(s.mode)||!Number.isSafeInteger(s.captureGeneration))return false;
  if(lastAttempt?.mount===s.mount&&lastAttempt?.pointerId===s.pointerId&&lastAttempt?.captureGeneration===s.captureGeneration)return false;
  lastAttempt={mount:s.mount,pointerId:s.pointerId,captureGeneration:s.captureGeneration};
  if(active)cancel('new-capture');
  const token=++generation;active={pointerId:s.pointerId,captureGeneration:s.captureGeneration,mount:s.mount,started:now(),index:-1,slot:-1};phase='loading';reason=null;abort=new AbortController();
  try{
   const loaded=await decode(art.frames,{signal:abort.signal});
   if(token!==generation){loaded?.cleanup?.();return false;}resource=loaded;
   if(!owns(readCapture())){cancel('stale-capture');return false;}
   // Never jump into a later pose if decode missed the first exposure.
   if(now()-active.started>=220){cancel('decode-too-late');return false;}
   phase='playing';active.index=0;active.slot=0;paint(art.frames[0]);return token===generation;
  }catch(_){if(token===generation)cancel('decode-or-paint-error');return false;}
 }
 return{begin,tick,cancel,destroy(){disposed=true;cancel('destroyed');},getState:()=>({phase,reason,pose:active&&active.index>=0?CAPTURE_IDS[active.index]:null,generation,artDisabled:ART_DISABLED,productionEnabled:true})};
}

/** Shared presentation ownership. Policy stays at each existing facade boundary. */
export function createPresentationRegistry(epoch){
 let owner=null,serial=0,closed=false;
 return {
  acquire(kind,actors){if(closed||owner||!['single','inline','glide','pair'].includes(kind)||!Array.isArray(actors)||!actors.length||new Set(actors).size!==actors.length||actors.some(id=>!['chiikawa','hachiware','usagi','momonga','shisa','rakko'].includes(id))||(kind==='pair'?(actors.length!==2||!actors.includes('chiikawa')||!actors.includes('hachiware')):actors.length!==1))return null;const token=Object.freeze({kind,actors:Object.freeze([...actors]),id:actors[0],epoch,serial:++serial});owner=token;return token;},
  release(token){if(!owner||owner!==token)return false;owner=null;return true;},
  owns(token){return !closed&&owner===token&&!!token;},
  get(){return owner;},
  destroy(){owner=null;closed=true;}
 };
}
let transientEngineSerial=0;
const DATA = [{id:'kani',label:'카니',size:160,speed:0}];
export function pickPetBehavior(weights, random = Math.random) {
  const entries = Object.entries(weights);
  if (!entries.length || entries.some(([, weight]) => !Number.isFinite(weight) || weight < 0)) {
    throw new TypeError('Pet probabilities must be finite, non-negative percentages.');
  }
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (Math.abs(total - 100) > 1e-6) throw new RangeError('Pet probabilities must sum to 100.');
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new RangeError('Random sample must be in [0, 1).');
  const target = sample * total;
  let cumulative = 0;
  for (const [action, weight] of entries) {
    cumulative += weight;
    if (target < cumulative) return action;
  }
  return entries.findLast(([, weight]) => weight > 0)[0];
}

// A view is never mirrored. Missing/unapproved views are static fallbacks.
export function resolvePetSequence(profile, action, direction = 'front', { allowDraft = false } = {}) {
  const manifest = profile?.animationManifest;
  if (manifest?.approvalStatus !== 'approved' && !(allowDraft && manifest?.approvalStatus === 'draft' && manifest?.experimental === true)) return null;
  const entry = manifest.actions?.[action];
  const original = entry?.views?.[direction] ?? (action === 'walk' ? null : entry?.views?.front);
  if (!original || !Array.isArray(original.frames) || original.frames.length < (action === 'walk' ? 2 : 1)) return null;
  const view = original.frames.some(f => f.assetKey) ? { ...original, frames: original.frames.map(f => ({ ...f, source: manifest.assets?.[f.assetKey] ?? f.source })) } : original;
  if (view.frames.some(f => !f.frameId || !f.source || !Number.isFinite(f.durationMs) || f.durationMs <= 0)) return null;
  if (action === 'walk' && (!view.loop || !(view.rootDistance > 0))) return null;
  return view;
}
export function samplePetSequence(sequence, elapsedMs) {
  const duration = sequence.frames.reduce((sum, f) => sum + f.durationMs, 0);
  const elapsed = Math.max(0, elapsedMs);
  const time = sequence.loop ? elapsed % duration : Math.min(elapsed, duration - .000001);
  let cursor = 0;
  const index = sequence.frames.findIndex(f => (cursor += f.durationMs) > time);
  return { frame: sequence.frames[Math.max(0, index)], index: Math.max(0, index),
    phase: time / duration, done: !sequence.loop && elapsed >= duration, duration };
}
export function petReleaseVelocity(vx, vy, cancelled = false, reduced = false) {
  return cancelled || reduced ? { vx: 0, vy: 0 } :
    { vx: Math.max(-165, Math.min(165, (Number.isFinite(vx) ? vx : 0) * .22)),
      vy: Math.max(-350, Math.min(450, (Number.isFinite(vy) ? vy : 0) * .25)) };
}
export function availablePetWeights(weights, profile, options = {}) {
  const result = { idle: 0 };
  for (const [action, weight] of Object.entries(weights)) {
    const available = action === 'idle' || (action === 'walk'
      ? ['left', 'right'].some(d => resolvePetSequence(profile, action, d, options))
      : !!profile?.frames?.[action] || !!resolvePetSequence(profile, action, 'front', options));
    const key = available ? action : 'idle';
    result[key] = (result[key] ?? 0) + weight;
  }
  return result;
}
/** Positive painted-area intersection; selection preference is deliberately separate. */
export function petRectOnScreen(rect, viewport, clip = null) {
  if (!rect || !viewport || ![rect.left, rect.top, rect.right, rect.bottom, viewport.w, viewport.h].every(Number.isFinite)) return false;
  const left = Math.max(0, clip?.left ?? 0), top = Math.max(0, clip?.top ?? 0);
  const right = Math.min(viewport.w, clip?.right ?? viewport.w), bottom = Math.min(viewport.h, clip?.bottom ?? viewport.h);
  return [left, top, right, bottom].every(Number.isFinite) && right > left && bottom > top && rect.right > rect.left && rect.bottom > rect.top && rect.right > left && rect.left < right && rect.bottom > top && rect.top < bottom;
}
const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));
const rand = (a, b) => a + Math.random() * (b - a);
const INSTANCE = Symbol.for('jlpt.kani-pet-demo');
const DEFAULT_POSES = ['idle', 'blink', 'happy', 'reaction', 'grabbed', 'landing'];
const PHYSICAL = new Set(['grab-onset', 'hold', 'release', 'fall', 'landing', 'recover']);

/** Choose the nearest safe logical x; never fit a too-large body by an inverted clamp. */
export function nearestScalePlacement({x,y,width,height,padding={left:0,right:0,top:0,bottom:0},viewport,clip=null,stage=null,obstacles=[]}){
 const rect=r=>r&&[r.left,r.top,r.right,r.bottom].every(Number.isFinite)&&r.right>r.left&&r.bottom>r.top;
 if(![x,y,width,height,...['left','right','top','bottom'].map(k=>padding[k])].every(Number.isFinite)||width<=0||height<=0||Object.values(padding).some(n=>n<0)||!rect(viewport)||clip&&!rect(clip)||stage&&!rect(stage)||!Array.isArray(obstacles)||obstacles.some(r=>!rect(r)))return null;
 const areas=[viewport,...(clip?[clip]:[]),...(stage?[stage]:[])],bounds={left:Math.max(...areas.map(r=>r.left)),right:Math.min(...areas.map(r=>r.right)),top:Math.max(...areas.map(r=>r.top)),bottom:Math.min(...areas.map(r=>r.bottom))};
 const min=bounds.left+padding.left,max=bounds.right-width-padding.right,top=y-padding.top,bottom=y+height+padding.bottom;
 if(max<min||top<bounds.top-1e-6||bottom>bounds.bottom+1e-6)return null;
 const blockers=obstacles.filter(b=>top<b.bottom+4&&bottom>b.top-4),candidates=[Math.min(Math.max(x,min),max),min,max];
 for(const b of blockers)candidates.push(b.left-4-width-padding.right,b.right+4+padding.left);
 const safe=candidates.filter(c=>c>=min-1e-6&&c<=max+1e-6&&!blockers.some(b=>c-padding.left<b.right+4&&c+width+padding.right>b.left-4));
 if(!safe.length)return null;safe.sort((a,b)=>Math.abs(a-x)-Math.abs(b-x)||a-b);return{x:safe[0],y,clamped:Math.abs(safe[0]-x)>1e-6};
}

/** Closed details can expose nonzero descendant rects in browsers; only its summary is painted. */
export function petObstacleIsDisplayed(el){
 for(let node=el?.parentElement;node;node=node.parentElement){
  if(node.tagName==='DETAILS'&&!node.open){
   const summary=Array.from(node.children??[]).find(child=>child.tagName==='SUMMARY');
   if(!summary||!(summary===el||summary.contains?.(el)))return false;
  }
 }
 return true;
}
/** Design prototype only: logical body unchanged, common empty paint/hit padding. */
export function hachiPaintGeometry({x,y,width,height}){
 if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0||Math.abs(height-width*4/3)>1e-6)return null;
 const k=width/130,left=15*k,right=15*k,bottom=8*k;
 return{scope:'FIXED_HACHI_PAINT_PADDING',k,body:{left:x,top:y,right:x+width,bottom:y+height,width,height},outer:{left:x-left,top:y,right:x+width+right,bottom:y+height+bottom,width:width+left+right,height:height+bottom},inner:{left,top:0,width,height},viewport:{left:-15*k,top:33.43033333333335*k,right:145*k,bottom:181.33033333333335*k},padding:{left,right,top:0,bottom}};
}
export function hachiRegisteredImage(frame,width){
 const k=width/130;if(!Number.isFinite(k)||k<=0||frame?.assetSize?.[0]!==1254||frame?.assetSize?.[1]!==1254||![frame.scale,frame.left,frame.top].every(Number.isFinite)||frame.scale<=0)return null;
 const left=(frame.left-15)*k,top=(frame.top+33.43033333333335)*k,w=1254*frame.scale*k,h=w;
 const v={left:-15*k,top:33.43033333333335*k,right:145*k,bottom:181.33033333333335*k};
 return{left,top,width:w,height:h,inset:[Math.max(0,v.top-top),Math.max(0,left+w-v.right),Math.max(0,top+h-v.bottom),Math.max(0,v.left-left)]};
}
const hachiRectValid=r=>r&&[r.left,r.top,r.right,r.bottom].every(Number.isFinite)&&r.right>r.left&&r.bottom>r.top;
export function hachiPaintSafe(g,viewport,clip=null,obstacles=[]){
 if(!g||!hachiRectValid(g.outer)||!hachiRectValid(viewport)||clip&&!hachiRectValid(clip)||!Array.isArray(obstacles)||obstacles.some(r=>!hachiRectValid(r)))return false;
 const r=g.outer,c=clip?{left:Math.max(viewport.left,clip.left),top:Math.max(viewport.top,clip.top),right:Math.min(viewport.right,clip.right),bottom:Math.min(viewport.bottom,clip.bottom)}:viewport;
 if(!hachiRectValid(c)||r.left<c.left-1e-6||r.top<c.top-1e-6||r.right>c.right+1e-6||r.bottom>c.bottom+1e-6)return false;
 return !obstacles.some(b=>r.left<b.right+4&&r.right>b.left-4&&r.top<b.bottom+4&&r.bottom>b.top-4);
}

export function validHachiInlineResponse(a){
 const ids=['30','B30_31','31','B31_32a','B31_32b','32','B32_33','33','B33_35','35','B35_36','36','B36_38','38','B38_40a','40'],durations=[40,50,50,50,50,50,50,70,50,60,50,70,60,60,60,180];
 return a?.scope==='SOURCE_DERIVED_EXPLICIT_ACTOR_RESPONSE'&&a.characterId==='hachiware'&&a.enabledByDefault===false&&a.autonomous===false&&a.rootTravel===false&&a.loop===false&&a.durationMs===1000&&a.timingOrigin==='AUTHORED_VARIABLE_EXPOSURES'&&a.recoveryFidelity==='HOLD_EXACT_CONTOUR_SMALLER_AUTHORED_APPROXIMATION'&&a.padding?.join(',')==='15,0,15,8'&&a.frames?.length===16&&new Set(a.frames.map(f=>f.source)).size===14&&a.frames[5].source===a.frames[0].source&&a.frames[15].source===a.frames[0].source&&a.frames[5].aliasOf==='30'&&a.frames[15].aliasOf==='30'&&a.frames.every((f,i)=>f.poseId===ids[i]&&f.durationMs===durations[i]&&typeof f.source==='string'&&f.source.length>0&&!!hachiRegisteredImage(f,130)&&f.drawingOrigin===(ids[i].startsWith('B')?'AUTHORED_INBETWEEN_NOT_OBSERVED':ids[i]==='38'?'AUTHORED_SMALLER_RECOVERY_APPROXIMATION':['32','40'].includes(ids[i])?'AUTHORED_APPROXIMATE_ALIAS':'OBSERVED_POSE_DERIVED'));
}
/** Exact pre-reviewed A/B registration; supplied URLs are trusted only through the build hash gate. */
const USAGI_INLINE_FRAMES=[
 {poseId:'A',assetSize:[1295,1214],sourceRect:[326,86,1004,1088],scale:0.13767907223527628,left:-28.556583036458733,top:1.1723845978928118},
 {poseId:'B',assetSize:[1254,1254],sourceRect:[321,124,969,1079],scale:0.14825634568228513,left:-25.36458347140303,top:-18.077331168400832}
];
export function createUsagiInlineAsset(sourceA,sourceB){return{scope:'SOURCE_DERIVED_EXPLICIT_ACTOR_RESPONSE',characterId:'usagi',enabledByDefault:false,autonomous:false,rootTravel:false,loop:false,durationMs:1300,pausedDurationMs:650,timingOrigin:'AUTHORED_WEB_UX',frames:USAGI_INLINE_FRAMES.map((f,i)=>({...f,assetSize:[...f.assetSize],sourceRect:[...f.sourceRect],durationMs:650,drawingOrigin:'OBSERVED_POSE_DERIVED',source:[sourceA,sourceB][i]}))};}
export function validUsagiInlineResponse(a){return a?.scope==='SOURCE_DERIVED_EXPLICIT_ACTOR_RESPONSE'&&a.characterId==='usagi'&&a.enabledByDefault===false&&a.autonomous===false&&a.rootTravel===false&&a.loop===false&&a.durationMs===1300&&a.pausedDurationMs===650&&a.timingOrigin==='AUTHORED_WEB_UX'&&a.frames?.length===2&&new Set(a.frames.map(f=>f.source)).size===2&&a.frames.every((f,i)=>{const e=USAGI_INLINE_FRAMES[i];return typeof f.source==='string'&&f.source.length>0&&f.poseId===e.poseId&&f.assetSize?.join(',')===e.assetSize.join(',')&&f.sourceRect?.join(',')===e.sourceRect.join(',')&&f.scale===e.scale&&f.left===e.left&&f.top===e.top&&f.durationMs===650&&f.drawingOrigin==='OBSERVED_POSE_DERIVED';});}
/** Fixed common1.25 rear registration, not source hop height or natural front recovery. */
export function momongaPaintGeometry({x,y,width,height}){
 if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0||Math.abs(height-width*4/3)>1e-6)return null;
 const k=width/127,left=24*k,right=15*k,bottom=4*k;
 return{scope:'FIXED_MOMONGA_PAINT_PADDING',k,body:{left:x,top:y,right:x+width,bottom:y+height,width,height},outer:{left:x-left,top:y,right:x+width+right,bottom:y+height+bottom,width:width+left+right,height:height+bottom},inner:{left,top:0,width,height},padding:{left,right,top:0,bottom}};
}
const MOMONGA_INLINE_FRAMES=[{"poseId":"43","assetSize":[1254,1254],"sourceRect":[0,0,1254,1254],"scale":0.120703125,"left":-10.974062499999995,"top":31.225911458333336},{"poseId":"45","assetSize":[1254,1254],"sourceRect":[0,0,1254,1254],"scale":0.112646484375,"left":6.050351562500005,"top":35.93684895833333},{"poseId":"47","assetSize":[1254,1254],"sourceRect":[0,0,1254,1254],"scale":0.108984375,"left":-17.801699218749995,"top":36.165364583333336},{"poseId":"50","assetSize":[1254,1254],"sourceRect":[0,0,1254,1254],"scale":0.11689453125,"left":-23.119082031249995,"top":31.250813802083336}];
export function createMomongaInlineAsset(sources){return{scope:'SOURCE_DERIVED_EXPLICIT_ACTOR_RESPONSE',characterId:'momonga',enabledByDefault:false,autonomous:false,rootTravel:false,loop:false,durationMs:2600,pausedDurationMs:650,timingOrigin:'AUTHORED_WEB_UX',padding:[24,0,15,4],frames:MOMONGA_INLINE_FRAMES.map((f,i)=>({...f,assetSize:[...f.assetSize],sourceRect:[...f.sourceRect],durationMs:650,drawingOrigin:'OBSERVED_POSE_DERIVED',source:sources?.[i]}))};}
export function validMomongaInlineResponse(a){return a?.scope==='SOURCE_DERIVED_EXPLICIT_ACTOR_RESPONSE'&&a.characterId==='momonga'&&a.enabledByDefault===false&&a.autonomous===false&&a.rootTravel===false&&a.loop===false&&a.durationMs===2600&&a.pausedDurationMs===650&&a.timingOrigin==='AUTHORED_WEB_UX'&&a.padding?.join(',')==='24,0,15,4'&&a.frames?.length===4&&new Set(a.frames.map(f=>f.source)).size===4&&a.frames.every((f,i)=>{const e=MOMONGA_INLINE_FRAMES[i];return typeof f.source==='string'&&f.source.length>0&&f.poseId===e.poseId&&f.assetSize?.join(',')===e.assetSize.join(',')&&f.sourceRect?.join(',')===e.sourceRect.join(',')&&f.scale===e.scale&&f.left===e.left&&f.top===e.top&&f.durationMs===650&&f.drawingOrigin==='OBSERVED_POSE_DERIVED';});}

/** Explicit same-actor source-derived response, separate from autonomous sequence approval. */
export function validInlineActorResponse(a){
 const ids=['A','AC1','AC2','C','CB1','CB2','B','BD1','BD2','D','DA1','DA2'];
 return a?.scope==='SOURCE_DERIVED_EXPLICIT_ACTOR_RESPONSE'&&a.characterId==='chiikawa'&&a.enabledByDefault===false&&a.autonomous===false&&a.rootTravel===false&&a.loop===false&&a.durationMs===1000&&a.frames?.length===12&&new Set(a.frames.map(f=>f.source)).size===11&&a.frames[9].source===a.frames[3].source&&a.frames[9].aliasOf==='C'&&a.frames.every((f,i)=>f.poseId===ids[i]&&typeof f.source==='string'&&f.source.length>0&&f.assetSize?.[0]===1254&&f.assetSize?.[1]===1254&&f.scale===0.10841025641025642&&f.left===-7.880923076923068&&f.top===23.27733333333334&&f.drawingOrigin===([0,3,6].includes(i)?'OBSERVED_POSE_DERIVED':i===9?'AUTHORED_NEUTRAL_ALIAS_NOT_OBSERVED':'AUTHORED_INBETWEEN_NOT_OBSERVED'));
}
export function createInlineActorResponse({asset,getContext,prepare,paint,restore,now=()=>performance.now(),requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id),setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}){
 let mode='off',generation=0,frame=null,deadline=null,abort=null,loaded=null,owned=false,index=-1,started=0;
 function cancel(reason='cancelled'){generation++;if(frame!==null)cancelFrame(frame);if(deadline!==null)clearTimer(deadline);frame=deadline=null;abort?.abort();abort=null;loaded?.cleanup?.();loaded=null;mode='off';index=-1;const wasOwned=owned;owned=false;if(wasOwned)restore(reason);}
 async function start(){if(mode!=='off')return true;if((!validInlineActorResponse(asset)&&!validHachiInlineResponse(asset)&&!validUsagiInlineResponse(asset)&&!validMomongaInlineResponse(asset))||!getContext().safe)return false;const token=++generation;abort=new AbortController();mode='loading';
  try{const result=await prepare(asset.frames,{signal:abort.signal});if(token!==generation){result?.cleanup?.();return false;}loaded=result;const c=getContext();if(!c.safe){cancel('unsafe');return false;}owned=true;started=now();index=0;mode=c.paused||c.reduced?'static':'playing';paint(asset.frames[0]);if(token!==generation)return false;
   deadline=setTimer(()=>{if(token!==generation)return;deadline=null;cancel('finite-exit');},mode==='static'&&['usagi','momonga'].includes(asset.characterId)?650:asset.durationMs);
   if(mode==='static')return true;
   const tick=t=>{if(token!==generation||mode!=='playing')return;frame=null;const c=getContext();if(!c.safe||c.paused||c.reduced){cancel('context');return;}const elapsed=t-started;if(!Number.isFinite(elapsed)||elapsed<0||elapsed>=asset.durationMs){cancel('expired');return;}let boundary=0;const next=['hachiware','usagi','momonga'].includes(asset.characterId)?asset.frames.findIndex(f=>(boundary+=f.durationMs)>elapsed):Math.floor(elapsed/(1000/12));if(next>index+1||next<index){cancel('dropped-drawing');return;}if(next!==index){index=next;paint(asset.frames[index]);}if(token===generation&&mode==='playing')frame=requestFrame(tick);};frame=requestFrame(tick);return true;
  }catch(_){if(token===generation)cancel('decode-failed');return false;}
 }
 return{start,cancel,getState:()=>({mode,index,active:owned,loading:mode==='loading'})};
}

export function mountKaniPet(options = {}) {
  const { kaniFrames = {}, assetBase = '/kani', enabledCharacters = DATA.map(p => p.id), floorOffset = 8,
    startPaused = false, onStatusChange = null, spriteSources = null, characterProfiles = {}, experimentalCharacters = [], experimentalStage = null, visibleCharacters = enabledCharacters, mobilePetStages = null, mobileStageViewport = null, decorativeStages = null, decorativeStageWindowWidths = null, onDeliberateInteraction = null, onCharacterHidden = null, onPresentationCancelled = null,
    inlineResponseAsset = null, inlineResponseEnabled = false, hachiInlineAsset = null, hachiInlineEnabled = false, usagiInlineAsset = null, usagiInlineEnabled = false, momongaInlineAsset = null, momongaInlineEnabled = false, initialBodyPositions = null, displayScalePercents = null, onBeforeSizeChange = null,
    pairArtApproved = false, readStudyState = null, maxVisibleMobile = 3, mobilePriority = ['shisa', 'momonga', 'rakko'],
    ownedViewportGeometry = null, avoidSelector = '#card, button, summary, select, input, textarea, a, .table-scroll' } = options;
  if (typeof document === 'undefined') return { react() {}, pause() {}, resume() {}, destroy() {}, getState() { return []; }, isPaused() { return true; }, setMobileCharacters() {}, setVisibleCharacters() {}, getVisibleCharacters() { return []; } };
  if (window[INSTANCE]) return window[INSTANCE];
  const root = document.createElement('div');
  root.className = 'cv-pet-layer'; root.setAttribute('aria-label', '카니 마스코트');
  document.body.appendChild(root);
  const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reduced = query?.matches ?? false, manualPaused = Boolean(startPaused), destroyed = false;
  let ticking = false, initialBodyPositionsApplied=false;
  let raf = 0, lastTime = 0, started = false, mobileLimit = maxVisibleMobile, mobileOrder = [...mobilePriority];
  let obstacles = [], dirty = true, pending = null, eventSerial = 0, representative = 0, pair = null;
  const normalizeScaleMap=value=>Object.fromEntries(DATA.map(p=>{const n=value&&Object.prototype.hasOwnProperty.call(value,p.id)?value[p.id]:100;return[p.id,typeof n==='number'&&Number.isFinite(n)&&n>=75&&n<=100&&n%5===0?n:100];}));
  let scalePercents=normalizeScaleMap(displayScalePercents);
  let scaleChangeActive=false;
  const scaleAnchors=new Map();
  const inlineResponses=new Map();
  const inlineFor=p=>inlineResponses.get(typeof p==='string'?p:p.id);
  const cancelInlineAll=reason=>{for(const controller of inlineResponses.values())controller.cancel(reason);};
  const paddedHachi=hachiInlineEnabled&&validHachiInlineResponse(hachiInlineAsset);
  const paddedMomonga=momongaInlineEnabled&&validMomongaInlineResponse(momongaInlineAsset);
  const paddedGeometry=(p,x=p.x,y=p.y)=>paddedHachi&&p.id==='hachiware'?hachiPaintGeometry({x,y,width:p.width,height:p.height}):paddedMomonga&&p.id==='momonga'?momongaPaintGeometry({x,y,width:p.width,height:p.height}):null;
  const listeners = [], pets = [], preloads = [], failed = new Set(), seen = new Map();
  const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });
  const paused = () => manualPaused || reduced;
  const selected = DATA.filter(p => enabledCharacters.includes(p.id));
  let requestedVisible = new Set(visibleCharacters.filter(id => selected.some(p => p.id === id)));
  const transientEpoch=++transientEngineSerial;let transient=null,transientSerial=0,positionRevision=0,positionSignature=null;
  const presentationRegistry=createPresentationRegistry(transientEpoch);let pairPresentation=null;
  let externalPresentation = null, externalLease = null, externalStageAnchor = null, externalLeaseRequired = false, externalNoLayout = false, leaseSerial = 0;
  const visibleIds = () => {
    const ids = selected.map(p => p.id).filter(id => requestedVisible.has(id) && id !== externalPresentation);
    return viewport().w < 640 && mobileLimit >= 0 && !mobilePetStages
      ? [...new Set([...mobileOrder, ...ids])].filter(id => ids.includes(id)).slice(0, mobileLimit) : ids;
  };
  const isBeta = p => p.id === 'chiikawa' && experimentalCharacters.includes(p.id) && !!characterProfiles[p.id]?.betaManifest;
  const profile = p => { const original = characterProfiles[p.id] ?? {}; return isBeta(p) ? { ...original, animationManifest: original.betaManifest, behavior: { idle: 30, [original.betaManifest.actions.walk ? 'walk' : 'step-in-place']: 60, happy: 10 } } : original; };
  const sequenceFor = (p, action, direction = p.dir < 0 ? 'left' : 'right') => resolvePetSequence(profile(p), action, direction, { allowDraft: isBeta(p) });
  const source = (id, frame) => spriteSources?.[id]?.[frame] ?? `${String(assetBase).replace(/\/$/, '')}/characters/${id}/${frame}.png`;
  const decorativeStage = p => decorativeStages?.[p.id] && !decorativeStages[p.id].hidden ? decorativeStages[p.id] : null;
  const mobileStage = p => !decorativeStage(p) && viewport().w < 640 ? mobilePetStages?.[p.id] : null;
  const stageRect = p => decorativeStage(p) ? decorativeStage(p).getBoundingClientRect() : mobileStage(p) && !mobileStage(p).hidden ? mobileStage(p).getBoundingClientRect() : isBeta(p) && experimentalStage && !experimentalStage.hidden ? experimentalStage.getBoundingClientRect() : null;
  const xBounds = p => { const r = stageRect(p); const margin=decorativeStage(p)&&r?Math.min(Math.max(18,((decorativeStageWindowWidths?.[p.id]??160)-p.width)/2+1),Math.max(0,(r.right-r.left-p.width)/2)):8; return r ? [r.left + margin, r.right - p.width - margin] : [0, viewport().w - p.width]; };
  const constrainX = (p, x) => { const [left, right] = xBounds(p); return clamp(x, left, right); };
  const ground = p => { const r = stageRect(p); return Math.max(0, (r ? r.bottom : viewport().h) - p.height - floorOffset); };
  const paintRect=(p,x=p.x,y=p.y)=>paddedGeometry(p,x,y)?.outer??{left:x,top:y,right:x+p.width,bottom:y+p.height,width:p.width,height:p.height};
  function onScreen(p) {
    if (p.el.hidden || p.assetUnavailable || p.scalePlacementUnavailable || document.hidden) return false;
    const r = stageRect(p), x = p.x + (r && Number.isFinite(p.stageLeft) ? r.left - p.stageLeft : 0);
    const y = r && !PHYSICAL.has(p.mode) ? Math.max(0, r.bottom - p.height - floorOffset) : p.y;
    const dock = mobileStage(p) && mobileStageViewport ? mobileStageViewport.getBoundingClientRect() : null;
    const hit=paintRect(p,x,y);
    const sourceStage=decorativeStage(p)??mobileStage(p)??(isBeta(p)?experimentalStage:null);
    const ownedStage=sourceStage&&ownedViewportGeometry?.stagePresentation(sourceStage,hit,dock);
    if(ownedStage?.owned&&ownedStage.visible===false)return false;
    // Reserve the visible direct-response scene for its owner, not unrelated settled actors.
    // Drag/physics remain visible; ordinary study-control yielding is never exempted.
    if (!PHYSICAL.has(p.mode) && !p.airborne && p.pointerId === null && Object.entries(decorativeStages ?? {}).some(([id,stage]) => {
      if (id === p.id || !requestedVisible.has(id) || !stage || stage.hidden) return false;
      const area=stage.getBoundingClientRect();return area.right>area.left&&area.bottom>area.top&&hit.left<area.right&&hit.right>area.left&&hit.top<area.bottom&&hit.bottom>area.top;
    })) return false;
    return petRectOnScreen(hit,viewport(),dock)&&(!paddedGeometry(p)||petRectOnScreen({left:x,top:y,right:x+p.width,bottom:y+p.height},viewport(),dock));
  }
  function ownedAdmission(p){
    const stage=decorativeStage(p)??mobileStage(p)??(isBeta(p)?experimentalStage:null);if(!stage||!ownedViewportGeometry)return true;
    const r=stageRect(p),x=p.x+(r&&Number.isFinite(p.stageLeft)?r.left-p.stageLeft:0),y=r&&!PHYSICAL.has(p.mode)?Math.max(0,r.bottom-p.height-floorOffset):p.y;
    const dock=mobileStage(p)&&mobileStageViewport?mobileStageViewport.getBoundingClientRect():null,result=ownedViewportGeometry.stagePresentation(stage,paintRect(p,x,y),dock);
    return !result?.owned||result.eligible===true;
  }
  // Paused/reduced actors still finish explicit reactions and direct-input physics.
  // Unpaused idle retains the existing autonomous decision clock.
  function needsFrame() {
    return !destroyed && !document.hidden && pets.some(p => !p.el.hidden) &&
      (dirty || pending || pair || pets.some(p => !p.el.hidden &&
        (p.action || p.touch || p.airborne || p.pointerId !== null || (!paused() && onScreen(p)))));
  }
  function wake() {
    if (started && !ticking && !raf && needsFrame()) { lastTime = 0; raf = requestAnimationFrame(tick); }
  }
  function refreshObstacles() { if (dirty) { obstacles = [...document.querySelectorAll(avoidSelector)].filter(petObstacleIsDisplayed).map(el => ownedViewportGeometry?.obstacleRect(el,el.getBoundingClientRect())??el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0); dirty = false; } }
  function invalidate() { dirty = true; wake(); }
  function listen(el, type, fn, opts) { el.addEventListener(type, fn, opts); listeners.push([el, type, fn, opts]); }
  function pose(p, name = 'idle') {
    if (isBeta(p) && name === 'idle') { const neutral = sequenceFor(p, 'idle', 'front')?.frames[0]; if (neutral && !failed.has(neutral.source)) { display(p, neutral.frameId, neutral.source, 'beta-static', neutral); return; } }
    const frames = spriteSources?.[p.id] ?? profile(p).frames;
    if (!(frames ? Object.hasOwn(frames, name) : DEFAULT_POSES.includes(name))) name = 'idle';
    const src = source(p.id, name);
    display(p, name, src, 'static-fallback');
  }
  function display(p, name, src, kind, frame = null) {
    if (failed.has(src)) { name = 'idle'; src = source(p.id, 'idle'); kind = 'static-fallback'; frame=null; }
    if (p.src !== src) { p.src = src; p.img.src = src; }
    if (frame?.assetSize) {
      const [x, y, w, h] = frame.sourceRect ?? [0, 0, ...frame.assetSize], [sw, sh] = frame.assetSize;
      const scale = Math.min(p.width / w, p.height / h) * (frame.renderScale ?? 1);
      const [px, py] = frame.pivot ?? [.5, 1];
      Object.assign(p.img.style, { position: 'absolute', objectFit: 'fill', width: `${sw * scale}px`, height: `${sh * scale}px`,
        maxWidth: 'none', left: `${p.width / 2 - px * w * scale - x * scale}px`, top: `${p.height - py * h * scale - y * scale}px`,
        clipPath: `inset(${y * scale}px ${(sw - x - w) * scale}px ${(sh - y - h) * scale}px ${x * scale}px)` });
    } else {
      for (const key of ['position', 'objectFit', 'width', 'height', 'maxWidth', 'left', 'top', 'clipPath']) p.img.style[key] = '';
    }
    p.frame = name; p.el.dataset.frame = name; p.el.dataset.assetMode = kind;
  }
  function mode(p, name) {
    if (p.mode !== name) { p.mode = name; p.el.dataset.mode = name; onStatusChange?.(p.id, name); }
    p.el.classList.toggle('cv-pet--dragging', p.pointerId !== null);
  }
  function start(p, action, fallback = 'idle', duration = .6, next = null) {
    inlineFor(p)?.cancel('other-action');
    const direction = p.dir < 0 ? 'left' : 'right';
    const sequence = !reduced && !manualPaused ? sequenceFor(p, action, direction) : null;
    p.action = { id: action, sequence, elapsed: 0, duration, next, fallback };
    mode(p, action); pose(p, fallback);
    if (sequence) advance(p, 0);
    wake();
  }
  function idle(p) { inlineFor(p)?.cancel('idle'); p.action = null; p.wait = rand(1.5, 4.5); mode(p, 'idle'); pose(p); }
  function advance(p, dt) {
    const a = p.action; if (!a) return;
    a.elapsed += dt;
    let done = a.elapsed >= a.duration;
    if (a.sequence) {
      if (a.sequence.frames.some(f => failed.has(f.source))) { idle(p); return; }
      const sample = samplePetSequence(a.sequence, a.elapsed * 1000);
      display(p, sample.frame.frameId, sample.frame.source, isBeta(p) ? (a.sequence.frames.length > 1 ? 'beta-sequence' : 'beta-static') : 'sequence', sample.frame);
      done = sample.done || (['start', 'correct', 'wrong', 'complete'].includes(a.id) && a.elapsed >= a.duration) || (a.sequence.loop && !['hold', 'fall', 'walk'].includes(a.id) && a.elapsed >= a.duration && sample.phase < .12);
      if (a.id === 'walk') {
        // Root and frame phase use the SAME clamped clock, including dropped RAF frames.
        const speed = a.sequence.rootDistance * p.width / (sample.duration / 1000);
        const nextX = p.x + p.dir * speed * dt;
        p.x = constrainX(p, nextX);
        if (nextX !== p.x || a.elapsed >= a.duration && sample.phase < .12) done = true;
      }
    }
    if (!done || a.id === 'hold' || a.id === 'fall') return;
    const next = a.next; p.action = null;
    if (next) next(); else if (a.id === 'walk') start(p, 'walk-stop', 'idle', .14); else idle(p);
  }
  function cancelPair() {
    if (!pair) return;
    const actors = pair.actors; pair = null;
    for (const p of actors) { p.pairRole = null; if (!PHYSICAL.has(p.mode)) idle(p); }
  }
  function releaseCapture(p) {
    p.captureVisual?.cancel('capture-release');
    const id = p.pointerId; p.pointerId = null; p.touch = null;
    if (id !== null && p.el.hasPointerCapture?.(id)) p.el.releasePointerCapture(id);
    p.el.classList.remove('cv-pet--dragging');
  }
  function safeReset(p) {
    releaseCapture(p); p.airborne = false; p.vx = p.vy = 0; p.y = ground(p); idle(p); render(p);
  }
  function resetAll() { cancelPair(); pending = null; for (const p of pets) safeReset(p); lastTime = 0; }
  function cancelExternalPresentation(reason) {
    cancelPairPresentation(reason);cancelTransient(reason);
    if (!externalPresentation) return;
    const restoreOnly=externalNoLayout?pets.find(p=>p.id===externalPresentation):null;
    presentationRegistry.release(externalLease);externalPresentation = null; externalLease = null; externalStageAnchor = null; externalLeaseRequired = false;externalNoLayout=false;
    if(restoreOnly){restoreOnly.el.hidden=!visibleIds().includes(restoreOnly.id);render(restoreOnly);wake();}
    onPresentationCancelled?.(reason);
  }
  const scaleExempt=p=>!!decorativeStage(p)||isBeta(p);
  const appliedScalePercent=p=>scaleExempt(p)?100:scalePercents[p.id];
  function scalePlacement(p,requestedX=p.x,placementObstacles=obstacles){
    const hit=paintRect(p),v=viewport(),stage=stageRect(p),dock=mobileStage(p)&&mobileStageViewport?mobileStageViewport.getBoundingClientRect():null;
    return nearestScalePlacement({x:requestedX,y:p.y,width:p.width,height:p.height,padding:{left:Math.max(0,p.x-hit.left),right:Math.max(0,hit.right-p.x-p.width),top:Math.max(0,p.y-hit.top),bottom:Math.max(0,hit.bottom-p.y-p.height)},viewport:{left:0,top:0,right:v.w,bottom:v.h},clip:dock,stage,obstacles:placementObstacles});
  }
  function syncStagePosition(p) {
    const r=stageRect(p);
    if(r){if(Number.isFinite(p.stageLeft))p.x+=r.left-p.stageLeft;p.stageLeft=r.left;}else p.stageLeft=null;
    if(r&&!PHYSICAL.has(p.mode))p.y=ground(p);
  }
  function syncScaleAvailability(p) {
    if(!scaleExempt(p)&&(appliedScalePercent(p)!==100||p.scalePlacementUnavailable)&&!PHYSICAL.has(p.mode)){
      const wasUnavailable=!!p.scalePlacementUnavailable,hadFocus=document.activeElement===p.el,fit=scalePlacement(p,p.x,scaleAnchors.has(p.id)?[...obstacles,...pets.filter(q=>q!==p&&!q.el.hidden&&!q.scalePlacementUnavailable&&!q.assetUnavailable).map(q=>paintRect(q))]:obstacles);
      p.scalePlacementUnavailable=!fit||Math.abs(fit.x-p.x)>1e-6;
      if(p.scalePlacementUnavailable&&!wasUnavailable&&hadFocus)onCharacterHidden?.(p.id,{hadFocus,reason:'scale-space'});
    }else if(scaleExempt(p))p.scalePlacementUnavailable=false;
  }
  function render(p) {
    if(p.kaniFrame){display(p,`${p.kaniFrame.state}_${p.kaniFrame.index+1}`,p.kaniFrame.src,'kani-authored-preview');p.el.dataset.kaniFrame=`${p.kaniFrame.state}:${p.kaniFrame.index}`;}
    if(p.capturePose&&p.pointerId!==null){display(p,`capture-authored-${p.capturePose.poseId}`,CAPTURE_ASSET.source,'capture-authored-ui');Object.assign(p.img.style,capturePaintStyle(p.capturePose,p.width));}
    refreshObstacles();syncStagePosition(p);
    syncScaleAvailability(p);
    p.el.dataset.scaleUnavailable=String(!!p.scalePlacementUnavailable);
    p.el.style.touchAction = mobileStage(p) ? 'pan-x pan-y' : '';
    const dock = mobileStage(p) && mobileStageViewport ? mobileStageViewport.getBoundingClientRect() : null;
    p.el.dataset.assetUnavailable=String(!!p.assetUnavailable);const painted=onScreen(p);p.el.style.visibility=painted?'':'hidden';p.el.tabIndex=painted?0:-1;p.el.setAttribute('aria-hidden',String(!painted));
    if(!painted&&document.activeElement===p.el)p.el.blur?.();
    const hit=paintRect(p);
    const ownedPresentation=ownedViewportGeometry?.stagePresentation(decorativeStage(p)??mobileStage(p)??(isBeta(p)?experimentalStage:null),hit,dock);
    p.el.style.clipPath = (ownedPresentation?.owned?ownedPresentation.clipPath:null) ?? (dock ? `inset(${Math.max(0,dock.top-hit.top)}px ${Math.max(0,hit.right-dock.right)}px ${Math.max(0,hit.bottom-dock.bottom)}px ${Math.max(0,dock.left-hit.left)}px)` : '');
    p.el.style.transform = `translate3d(${hit.left.toFixed(1)}px, ${hit.top.toFixed(1)}px, 0)`;
    // No scaleX(-1), squash, rotation, or CSS walk substitution, including Rakko.
    const blocked = p.pointerId === null && obstacles.some(r => hit.left < r.right + 4 && hit.right > r.left - 4 && hit.top < r.bottom + 4 && hit.bottom > r.top - 4);
    p.el.classList.toggle('cv-pet--yielding', blocked);
    if(!painted||blocked)inlineFor(p)?.cancel('paint-ineligible');
  }
  function captureVisualFor(p){
    if(p.captureVisual)return p.captureVisual;
    return p.captureVisual=createKaniPresentation({frames:kaniFrames,
      read:()=>{refreshObstacles();const hit=paintRect(p);return {visible:requestedVisible.has(p.id)&&!p.el.hidden&&onScreen(p),hidden:document.hidden,paused:manualPaused,reduced,unavailable:p.assetUnavailable,captured:p.pointerId!==null&&p.el.hasPointerCapture?.(p.pointerId)===true,pointerId:p.pointerId,captureGeneration:p.captureGeneration??0,physical:PHYSICAL.has(p.mode),spaceSafe:!obstacles.some(r=>hit.left<r.right+4&&hit.right>r.left-4&&hit.top<r.bottom+4&&hit.bottom>r.top-4)};},
      decode:src=>new Promise((resolve,reject)=>{const img=new Image();img.src=src;img.decode().then(()=>{if(img.naturalWidth!==512||img.naturalHeight!==512)throw Error('kani-size');resolve();}).catch(reject);}),
      paint:(src,state,index)=>{p.kaniFrame={src,state,index};render(p);wake();},
      restore:()=>{p.kaniFrame=null;delete p.el.dataset.kaniFrame;pose(p,'idle');},now:()=>performance.now()});
  }
  function beginGrab(p, e) {
    if (externalPresentation) { cancelExternalPresentation('direct-input'); layout(); }
    cancelPair(); p.touch = null; p.pointerId = e.pointerId;
    try { p.el.setPointerCapture(e.pointerId); } catch (_) { p.pointerId = null; return; }
    p.grabDX = e.clientX - p.x; p.grabDY = e.clientY - p.y;
    p.prevX = e.clientX; p.prevY = e.clientY; p.prevTime = performance.now();
    p.throwVX = p.throwVY = 0; p.airborne = false;
    p.captureGeneration=(p.captureGeneration??0)+1;
    start(p, 'grab-onset', 'grabbed', .16, () => start(p, 'hold', 'grabbed', Infinity)); render(p);captureVisualFor(p)?.begin();
  }
  function pointerDown(p, e) {
    cancelPairPresentation('pointer-input');
    if (e.button !== 0 || e.isPrimary === false || destroyed || p.pointerId !== null || document.hidden) return;
    refreshObstacles();syncStagePosition(p);syncScaleAvailability(p);if(!onScreen(p))return;
    inlineFor(p)?.cancel('pointer-intent');
    // Long press to drag on touch; vertical gestures remain browser scrolling.
    if (e.pointerType === 'touch') { p.touch = { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, at: performance.now() }; wake(); return; }
    if (e.cancelable) e.preventDefault(); beginGrab(p, e);
  }
  function pointerMove(p, e) {
    if (p.touch?.pointerId === e.pointerId) {
      if (Math.hypot(e.clientX - p.touch.clientX, e.clientY - p.touch.clientY) > 8) p.touch = null;
      return;
    }
    if (p.pointerId !== e.pointerId) return;
    if (e.cancelable) e.preventDefault();
    const now = performance.now(), dt = Math.max(.012, (now - p.prevTime) / 1000);
    p.throwVX = clamp((e.clientX - p.prevX) / dt, -750, 750); p.throwVY = clamp((e.clientY - p.prevY) / dt, -850, 850);
    p.prevX = e.clientX; p.prevY = e.clientY; p.prevTime = now;
    scaleAnchors.delete(p.id);
    p.x = constrainX(p, e.clientX - p.grabDX); p.y = clamp(e.clientY - p.grabDY, 0, ground(p)); render(p);
  }
  function pointerEnd(p, e, cancelled = false) {
    if (p.touch?.pointerId === e.pointerId) p.touch = null;
    if (p.pointerId !== e.pointerId) return;
    releaseCapture(p);
    if (cancelled || paused()) { safeReset(p); return; }
    // A stationary hold must not reuse the velocity from an old move.
    const stale = performance.now() - p.prevTime > 100;
    Object.assign(p, petReleaseVelocity(stale ? 0 : p.throwVX, stale ? 0 : p.throwVY));
    start(p, 'release', 'idle', .1, () => {
      if (p.y >= ground(p) - 1 && p.vy >= -30) land(p);
      else { p.airborne = true; start(p, 'fall', 'idle', Infinity); }
    });
  }
  function land(p) {
    p.airborne = false; p.vx = p.vy = 0; p.y = ground(p);
    // Old compressed landing PNGs are not used as a stand-in for real impact frames.
    start(p, 'landing', 'idle', .18, () => start(p, 'recover', 'idle', .2));
  }
  function sizePet(p) {
    const scale = decorativeStage(p) ? 1 : viewport().w < 640 ? (mobilePetStages ? .70 : visibleIds().length > 3 ? .40 : .62) : viewport().w <= 900 ? .8 : 1;
    p.width = Math.min(p.size * scale * appliedScalePercent(p)/100, Math.max(1, viewport().w)); p.height = p.width;
    p.el.style.setProperty('--cv-pet-size', `${p.width}px`);p.el.style.height=`${p.height}px`;p.el.dataset.displayPercent=String(appliedScalePercent(p));
    if(paddedGeometry(p)){const g=paddedGeometry(p);Object.assign(p.el.style,{width:g.outer.width+'px',height:g.outer.height+'px',overflow:'hidden'});Object.assign(p.figure.style,{position:'absolute',left:g.inner.left+'px',top:'0px',width:p.width+'px',height:p.height+'px'});p.el.dataset.paintPadding=p.id==='hachiware'?'15,0,15,8':'24,0,15,4';}
  }
  function layout() {
    if(externalNoLayout)cancelExternalPresentation('layout');
    cancelPairPresentation("layout");
    cancelTransient("layout");
    const hachi=paddedHachi?pets.find(p=>p.id==='hachiware'&&!p.el.hidden&&p.width>0):null;
    const hachiStage=hachi?(decorativeStage(hachi)??mobileStage(hachi)??null):null;
    const hachiAnchor=hachi&&hachi.hachiStageIdentity===hachiStage?{x:hachi.x,offset:hachiStage&&Number.isFinite(hachi.stageLeft)?hachi.x-hachi.stageLeft:null}:null;
    const usagi=usagiInlineEnabled&&validUsagiInlineResponse(usagiInlineAsset)?pets.find(p=>p.id==='usagi'&&!p.el.hidden&&p.width>0):null;
    const usagiStage=usagi?(decorativeStage(usagi)??mobileStage(usagi)??null):null;
    const usagiAnchor=usagi&&usagi.usagiStageIdentity===usagiStage?{x:usagi.x,offset:usagiStage&&Number.isFinite(usagi.stageLeft)?usagi.x-usagi.stageLeft:null}:null;
    const momonga=paddedMomonga?pets.find(p=>p.id==='momonga'&&!p.el.hidden&&p.width>0):null;
    const momongaStage=momonga?(decorativeStage(momonga)??mobileStage(momonga)??null):null;
    const momongaAnchor=momonga&&momonga.momongaStageIdentity===momongaStage?{x:momonga.x,offset:momongaStage&&Number.isFinite(momonga.stageLeft)?momonga.x-momonga.stageLeft:null}:null;
    const offsets=new Map(pets.filter(p=>!p.el.hidden&&decorativeStage(p)&&p.decorativeStageIdentity===decorativeStage(p)&&Number.isFinite(p.stageLeft)).map(p=>[p.id,p.x-p.stageLeft]));
    resetAll(); const ids = visibleIds();
    for (const p of pets) {
      const wasShown = !p.el.hidden, shown = ids.includes(p.id), hadFocus = document.activeElement === p.el;
      p.el.hidden = !shown; sizePet(p);
      if (!shown && wasShown) onCharacterHidden?.(p.id, { hadFocus });
      if (!p.el.hidden) { const [left, right] = xBounds(p); p.x = offsets.has(p.id) ? constrainX(p,decorativeStage(p).getBoundingClientRect().left+offsets.get(p.id)) : stageRect(p) ? (left + right) / 2 : constrainX(p, viewport().w * (ids.indexOf(p.id) + .5) / ids.length - p.width / 2); }
      if(!p.el.hidden&&p.id==='hachiware'){if(hachiAnchor)p.x=constrainX(p,hachiStage&&hachiAnchor.offset!==null?hachiStage.getBoundingClientRect().left+hachiAnchor.offset:hachiAnchor.x);else if(!initialBodyPositionsApplied&&Number.isFinite(initialBodyPositions?.hachiware?.x))p.x=constrainX(p,initialBodyPositions.hachiware.x);p.hachiStageIdentity=decorativeStage(p)??mobileStage(p)??null;}
      if(!p.el.hidden&&p.id==='usagi'){if(usagiAnchor)p.x=constrainX(p,usagiStage&&usagiAnchor.offset!==null?usagiStage.getBoundingClientRect().left+usagiAnchor.offset:usagiAnchor.x);else if(!initialBodyPositionsApplied&&Number.isFinite(initialBodyPositions?.usagi?.x))p.x=constrainX(p,initialBodyPositions.usagi.x);p.usagiStageIdentity=decorativeStage(p)??mobileStage(p)??null;}
      if(!p.el.hidden&&p.id==='momonga'){if(momongaAnchor)p.x=constrainX(p,momongaStage&&momongaAnchor.offset!==null?momongaStage.getBoundingClientRect().left+momongaAnchor.offset:momongaAnchor.x);else if(!initialBodyPositionsApplied&&Number.isFinite(initialBodyPositions?.momonga?.x))p.x=constrainX(p,initialBodyPositions.momonga.x);p.momongaStageIdentity=decorativeStage(p)??mobileStage(p)??null;}
      p.decorativeStageIdentity=decorativeStage(p);p.stageLeft = stageRect(p)?.left ?? null;
      p.y = ground(p);
      if(appliedScalePercent(p)!==100&&!p.el.hidden){refreshObstacles();const fit=scalePlacement(p);p.scalePlacementUnavailable=!fit;if(fit)p.x=fit.x;}
      render(p);
    }
    initialBodyPositionsApplied=true;
    if (!ids.length || document.hidden) { cancelAnimationFrame(raf); raf = 0; lastTime = 0; }
    root.dataset.visibleCount = String(ids.length); invalidate();
  }
  for (const info of selected) {
    const el = document.createElement('div'); el.className = 'cv-pet'; el.dataset.character = info.id;
    el.tabIndex = 0; el.setAttribute('role', 'button');
    if (isBeta(info)) { el.dataset.quality = 'beta'; el.title = '치이카와 동작 베타 · 원화 외형/연결 미승인'; }
    el.setAttribute('aria-label', ((inlineResponseEnabled&&info.id==='chiikawa')||(paddedHachi&&info.id==='hachiware')||(usagiInlineEnabled&&info.id==='usagi')||(paddedMomonga&&info.id==='momonga')) ? `${info.label}: Enter 또는 Space로 제자리 작성 원화 반응 1회. 마우스로 끌기, Escape로 취소` : decorativeStage(info) ? `${info.label}: Enter 또는 Space로 관찰 자세 반응. 마우스로 끌기, Escape로 내려놓기` : `${info.label}: 마우스로 끌기, 터치는 길게 누르기. Enter로 인사, Escape로 내려놓기`);
    el.setAttribute('aria-label','카니: 마우스로 잡아 옮기고 놓기. 터치는 길게 누르기. Escape로 취소. Enter와 Space 반응은 제공하지 않습니다.');
    el.innerHTML = `<div class="cv-pet__figure"><img class="cv-pet__image" draggable="false" alt=""/><span class="cv-pet__name">${info.label}</span></div>`;
    const p = { ...info, el, img: el.querySelector('.cv-pet__image'), figure: el.querySelector('.cv-pet__figure'), pointerId: null, touch: null, x: 0, y: 0, width: 0, height: 0, dir: 1, mode: 'idle', frame: null, assetUnavailable:false, airborne: false, vx: 0, vy: 0, action: null };
    pets.push(p); root.appendChild(el); sizePet(p); idle(p);
    listen(el, 'focus', () => { (decorativeStage(p)??mobileStage(p))?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); });
    listen(el, 'pointerdown', e => pointerDown(p, e)); listen(el, 'pointermove', e => pointerMove(p, e));
    listen(el, 'pointerup', e => pointerEnd(p, e));
    listen(el, 'pointercancel', e => pointerEnd(p, e, true)); listen(el, 'lostpointercapture', e => pointerEnd(p, e, true));
    listen(el, 'keydown', e => {
      if (['Enter', ' ', 'Escape'].includes(e.key)) { e.preventDefault(); e.stopPropagation();
        if (e.key === 'Escape') { cancelPair(); safeReset(p); } else { refreshObstacles();syncStagePosition(p);syncScaleAvailability(p);if(!onScreen(p))return;let handled=false;try{handled=onDeliberateInteraction?.(p.id, {kind:'keyboard',key:e.key,repeat:e.repeat===true})===true;}catch(_){} if (!handled) react('start', p.id); }
      }
    });
    listen(p.img, 'error', () => {
      failed.add(p.src);root.dataset.assetError=`${p.id}/${p.frame}`;p.assetUnavailable=true;p.img.style.visibility='hidden';
      // An unrenderable actor must not retain invisible pointer capture, focus or eligibility.
      if(p.pairRole)cancelPair();releaseCapture(p);p.airborne=false;p.vx=p.vy=0;
      idle(p);
      render(p);invalidate();
    });
    listen(p.img, 'load', () => { failed.delete(p.src);p.assetUnavailable=false;p.img.style.visibility='';render(p);invalidate(); });
  }
  // Decode optional sequences before use; a failed image degrades to neutral, never blocks study.
  root.dataset.assetsLoaded = '0';
  const urls = new Set();
  for (const p of pets) {
    for (const name of Object.keys(spriteSources?.[p.id] ?? profile(p).frames ?? { idle: '' })) urls.add(source(p.id, name));
    for (const src of Object.values(profile(p).animationManifest?.assets ?? {})) urls.add(src);
    for (const entry of Object.values(profile(p).animationManifest?.actions ?? {})) for (const view of Object.values(entry.views ?? {})) for (const frame of view.frames ?? []) if (frame.source) urls.add(frame.source);
  }
  for (const src of urls) { const img = new Image(); img.onload = () => { if (!destroyed) root.dataset.assetsLoaded = String(Number(root.dataset.assetsLoaded) + 1); }; img.onerror = () => { failed.add(src); root.dataset.assetError = 'preload'; }; img.src = src; preloads.push(img); }
  function reaction(p, type, duration) {
    const defaults = { start: 'wave', correct: 'happy', wrong: 'encourage', complete: 'happy' };
    const configured = profile(p).vocab?.[type];
    // Wrong means "unknown", not failure: do not play crying or punitive poses.
    const fallback = type === 'wrong' ? (profile(p).frames?.encourage ? 'encourage' : 'idle') : configured ?? defaults[type];
    start(p, type, fallback, duration);
  }
  function processEvent(now) {
    if (!pending) return;
    if (now - pending.at > 1000) { pending = null; return; }
    // New owned clipping revokes queued intent even within the coalescing window.
    if(!pets.some(p=>onScreen(p)&&ownedAdmission(p)&&(pending.target==='all'||p.id===pending.target))&&pets.some(p=>!ownedAdmission(p)&&(pending.target==='all'||p.id===pending.target))){pending=null;return;}
    if (now < pending.ready) return;
    const choices = pets.filter(p => onScreen(p) && ownedAdmission(p) && !PHYSICAL.has(p.mode) && (pending.target === 'all' || pending.target === p.id));
    if (!choices.length) {
      if (!pets.some(p => onScreen(p) && ownedAdmission(p) && (pending.target === 'all' || pending.target === p.id))) pending = null;
      return;
    }
    cancelPair();
    for (const p of pets) if (!PHYSICAL.has(p.mode) && p.mode !== 'idle') idle(p);
    const event = pending; pending = null;
    const lead = choices[representative++ % choices.length];
    reaction(lead, event.type, event.type === 'complete' ? 1.25 : event.type === 'wrong' ? .65 : .8);
    if (event.type === 'complete' && choices.length > 1 && !paused()) {
      const partner = choices.find(p => p !== lead);
      pair = { actors: [lead, partner], elapsed: 0, responded: false };
      lead.pairRole = 'lead'; partner.pairRole = 'response';
    }
  }
  function react(type, target = 'all', metadata = {}) {
    if (destroyed || document.hidden || presentationRegistry.get() || externalPresentation || !pets.some(p => onScreen(p) && ownedAdmission(p) && (target === 'all' || p.id === target)) || !['start', 'correct', 'wrong', 'complete'].includes(type)) return;
    const now = performance.now();
    const id = metadata.eventId ?? `local-${++eventSerial}`;
    if (seen.has(id)) return;
    seen.set(id, now); for (const [key, at] of seen) if (now - at > 5000 || seen.size > 128) seen.delete(key);
    if (Number.isFinite(metadata.occurredAt) && Date.now() - metadata.occurredAt > 1000) return;
    // Coalesce same-turn correct + complete; latest event replaces, never a backlog.
    if (pending?.type === 'complete' && type === 'correct' && now - pending.at < 100) return;
    pending = { type, target, at: now, ready: now + 45 };
    wake();
  }
  function decide(p) {
    // Admission boundary only, not every animation frame: do not draw a new
    // legacy behavior while its current full paint would yield to study UI.
    dirty=true;refreshObstacles();
    const v=viewport(),dock=mobileStage(p)&&mobileStageViewport?mobileStageViewport.getBoundingClientRect():null;
    if (presentationRegistry.get() || externalPresentation || !onScreen(p) || !ownedAdmission(p) || !hachiPaintSafe({outer:paintRect(p)},{left:0,top:0,right:v.w,bottom:v.h},dock,obstacles)) { p.wait = 1; return; }
    if (pets.some(q => q !== p && !q.el.hidden && (onScreen(q) || PHYSICAL.has(q.mode)) && q.mode !== 'idle') || pair || pending) { p.wait = 1; return; }
    const weights = availablePetWeights(profile(p).behavior ?? { idle: 100 }, profile(p), { allowDraft: isBeta(p) });
    const action = pickPetBehavior(weights);
    if (action === 'idle') { p.wait = rand(1.5, 4.5); return; }
    if (action === 'walk') {
      p.dir = Math.random() < .5 ? -1 : 1;
      if (!sequenceFor(p, 'walk')) p.dir *= -1;
      start(p, 'walk-start', 'idle', .12, () => start(p, 'walk', 'idle', rand(1.5, 3.2)));
    } else start(p, action, action, rand(1.0, 1.8));
  }
  function tick(now) {
    raf = 0;
    if (destroyed) return;
    ticking = true;
    const dt = lastTime ? clamp((now - lastTime) / 1000, 0, .04) : 0; lastTime = now;
    refreshObstacles();
    if (!document.hidden) {
      if (pair?.actors.some(p => !onScreen(p)||!ownedAdmission(p))) cancelPair();
      processEvent(now);
      if (pair) { pair.elapsed += dt;
        if (!pair.responded && pair.elapsed >= .3) { pair.responded = true; reaction(pair.actors[1], 'complete', .9); }
        if (pair.elapsed >= 1.5) cancelPair();
      }
      for (const p of pets) {
        if (p.el.hidden) continue;
        if ((!onScreen(p)||!ownedAdmission(p)) && !PHYSICAL.has(p.mode) && !p.touch && p.pointerId === null) { if (p.action) idle(p); render(p); continue; }
        if (p.touch && now - p.touch.at >= 220) beginGrab(p, p.touch);
        if (p.airborne) { p.vy += 1900 * dt; p.y = Math.max(0, p.y + p.vy * dt); p.x = constrainX(p, p.x + p.vx * dt); if (p.y >= ground(p)) land(p); }
        advance(p, dt);
        p.captureVisual?.tick(now);
        if (!p.action && p.pointerId === null && !paused() && !(inlineFor(p)&&inlineFor(p).getState().mode!=='off')) { p.wait -= dt; if (p.wait <= 0) decide(p); }
        render(p);
      }
    }
    ticking = false;
    raf = needsFrame() ? requestAnimationFrame(tick) : 0;
  }
  for (const type of ['start', 'correct', 'wrong', 'complete']) listen(document, `vocab:${type}`, e => { react(type, e.detail?.character ?? 'all', e.detail ?? {}); invalidate(); });
  for (const type of ['click', 'change', 'vocab:view']) listen(document, type, () => { invalidate(); });
  listen(document, 'toggle', invalidate, true); // details toggle does not bubble; refresh even without a click.
  listen(window, 'scroll', () => { invalidate(); for (const p of pets) if (stageRect(p) && PHYSICAL.has(p.mode)) safeReset(p); }, { passive: true, capture: true });
  listen(document, 'keydown', e => { if (e.key === 'Escape' && pets.some(p => PHYSICAL.has(p.mode))) { e.preventDefault(); resetAll(); } });
  listen(window, 'resize', () => { cancelExternalPresentation('resize'); layout(); });
  listen(window, 'blur', () => { cancelExternalPresentation('blur'); layout(); });
  listen(document, 'visibilitychange', () => { cancelExternalPresentation('visibility'); layout(); invalidate(); });
  listen(window, 'pagehide', () => { cancelExternalPresentation('pagehide'); layout(); }); listen(window, 'pageshow', () => { layout(); invalidate(); });
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(invalidate) : null;
  observer?.observe(document.querySelector('main') || document.body);
  if(ownedViewportGeometry?.observeElement)observer?.observe(ownedViewportGeometry.observeElement);
  function syncPaused() { cancelInlineAll('pause-change'); cancelExternalPresentation('pause-or-motion-preference'); layout(); root.dataset.paused = String(paused()); }
  if (query) listen(query, 'change', e => { reduced = e.matches; syncPaused(); });
  for(const[id,enabled,asset] of [['chiikawa',inlineResponseEnabled,inlineResponseAsset],['hachiware',paddedHachi,hachiInlineAsset],['usagi',usagiInlineEnabled,usagiInlineAsset],['momonga',paddedMomonga,momongaInlineAsset]]){
    const p=pets.find(p=>p.id===id);if(!enabled||!p||!(validInlineActorResponse(asset)||validHachiInlineResponse(asset)||validUsagiInlineResponse(asset)||validMomongaInlineResponse(asset)))continue;
    const inlineSafe=()=>{
      refreshObstacles();
      if(destroyed||(presentationRegistry.get()&&!(presentationRegistry.get().kind==='inline'&&presentationRegistry.get().id===p.id))||externalPresentation||PHYSICAL.has(p.mode)||p.touch||p.pointerId!==null||p.airborne)return false;
      // Focus can scroll a native dock before its scroll/RAF render. Use the same
      // logical stage-position update as paint before full-containment admission.
      syncStagePosition(p);syncScaleAvailability(p);if(!onScreen(p)||!ownedAdmission(p))return false;
      if(paddedGeometry(p)){const v=viewport(),dock=mobileStage(p)&&mobileStageViewport?mobileStageViewport.getBoundingClientRect():null;return hachiPaintSafe(paddedGeometry(p),{left:0,top:0,right:v.w,bottom:v.h},dock,obstacles);}
      const hit=paintRect(p);if(id==='usagi'){const v=viewport(),dock=mobileStage(p)&&mobileStageViewport?mobileStageViewport.getBoundingClientRect():null;return hachiPaintSafe({outer:hit},{left:0,top:0,right:v.w,bottom:v.h},dock,obstacles); }return !obstacles.some(r=>hit.left<r.right+4&&hit.right>r.left-4&&hit.top<r.bottom+4&&hit.bottom>r.top-4);
    };
    const controller=createInlineActorResponse({asset,getContext:()=>({safe:inlineSafe()&&p.img.naturalWidth>0,paused:manualPaused,reduced}),
      prepare:async(frames,{signal})=>{const token=presentationRegistry.acquire('inline',[id]);if(!token)throw Error('presentation-busy');const images=[];const cleanup=()=>{presentationRegistry.release(token);images.forEach(im=>im.removeAttribute?.('src'));};signal.addEventListener('abort',cleanup,{once:true});try{await Promise.all([...new Map(frames.map(f=>[f.source,f])).values()].map(async f=>{const im=new Image();images.push(im);im.src=f.source;await im.decode();if(im.naturalWidth!==f.assetSize[0]||im.naturalHeight!==f.assetSize[1])throw Error('dimensions');}));if(signal.aborted)throw Error('aborted');return{cleanup};}catch(e){cleanup();throw e;}finally{signal.removeEventListener('abort',cleanup);}},
      paint:f=>{p.action=null;mode(p,'inline-response');display(p,f.poseId,f.source,'source-derived-inline');if(id==='hachiware'){const g=hachiRegisteredImage(f,p.width);Object.assign(p.img.style,{position:'absolute',objectFit:'fill',width:g.width+'px',height:g.height+'px',maxWidth:'none',left:g.left+'px',top:g.top+'px',clipPath:`inset(${g.inset.map(n=>n+'px').join(' ')})`});}else{const k=p.width/(id==='momonga'?127:126),[sw,sh]=f.assetSize,rect=f.sourceRect;Object.assign(p.img.style,{position:'absolute',objectFit:'fill',width:(sw*f.scale*k)+'px',height:(sh*f.scale*k)+'px',maxWidth:'none',left:(f.left*k)+'px',top:(f.top*k)+'px',clipPath:rect?`inset(${[rect[1],sw-rect[2],sh-rect[3],rect[0]].map(n=>n*f.scale*k+'px').join(' ')})`:'none'});}p.el.dataset.inlinePose=f.poseId;render(p);},
      restore:()=>{p.el.dataset.inlinePose='';p.action=null;p.wait=rand(1.5,4.5);mode(p,'idle');pose(p);invalidate();}
    });inlineResponses.set(id,controller);
  }
  if(inlineResponses.size){
    for(const type of ['blur','pagehide','resize','scroll'])listen(window,type,()=>cancelInlineAll(type),{passive:true,capture:true});
    listen(document,'visibilitychange',()=>cancelInlineAll('visibility'));
    listen(document,'keydown',e=>{if(e.key==='Escape')cancelInlineAll('escape');});
  }
  layout(); root.dataset.paused = String(paused()); started = true; wake();
  function playAction(action, target = 'chiikawa') {
    const p = pets.find(p => p.id === target);
    if (!p || !isBeta(p) || !ownedAdmission(p) || p.el.hidden || paused() || PHYSICAL.has(p.mode) || action !== 'walk') return false;
    cancelPairPresentation('manual-preview');
    if (externalPresentation) { cancelExternalPresentation('new-preview'); layout(); }
    cancelPair();
    for (const q of pets) if (!PHYSICAL.has(q.mode)) idle(q);
    if (sequenceFor(p, 'walk', 'right') || sequenceFor(p, 'walk', 'left')) {
      p.dir = sequenceFor(p, 'walk', p.x > viewport().w / 2 ? 'left' : 'right') ? (p.x > viewport().w / 2 ? -1 : 1) : sequenceFor(p, 'walk', 'right') ? 1 : -1;
      start(p, 'walk-start', 'idle', .12, () => start(p, 'walk', 'idle', 2.5));
    } else start(p, 'step-in-place', 'idle', 2.5);
    return true;
  }
  // Non-preempting authored UI ownership; never delegates to destructive external begin.
  function transientSnapshot() {
    const p=pets.find(p=>p.id==='momonga');
    if(!p)return null;
    dirty=true;refreshObstacles();syncStagePosition(p);syncScaleAvailability(p);
    const signature=JSON.stringify([p.x,p.y,p.width,p.height,p.stageLeft,appliedScalePercent(p)]);
    if(signature!==positionSignature){positionSignature=signature;positionRevision++;}
    const hit=paintRect(p),v=viewport();
    const busyInline=[...inlineResponses.values()].some(c=>c.getState().mode!=='off');
    const safety={inView:onScreen(p),fullPaintContained:hachiPaintSafe({outer:hit},{left:0,top:0,right:v.w,bottom:v.h}),obstacleBlocked:obstacles.some(r=>hit.left<r.right+4&&hit.right>r.left-4&&hit.top<r.bottom+4&&hit.bottom>r.top-4),obstacleGeometryValid:obstacles.every(hachiRectValid),scalePlacementUnavailable:!!p.scalePlacementUnavailable};
    const busyKind=externalPresentation?'external':pair?'pair':pending?'study-pending':p.action?'own-action':pets.some(q=>q!==p&&(PHYSICAL.has(q.mode)||q.pointerId!==null||q.touch||q.airborne))?'other-physical':null;
    return {safety,busyKind,epoch:transientEpoch,positionRevision,mounted:!destroyed,visible:requestedVisible.has(p.id),
      onScreen:(transient!==null||onScreen(p))&&!p.assetUnavailable&&!p.scalePlacementUnavailable&&requestedVisible.has(p.id)&&!document.hidden&&hachiPaintSafe({outer:hit},{left:0,top:0,right:v.w,bottom:v.h},null,obstacles),
      captured:p.pointerId!==null,touch:!!p.touch,airborne:p.airborne,physical:PHYSICAL.has(p.mode),mode:p.mode,
      inline:busyInline,rear4:false,otherPresentation:!!externalPresentation||!!pair||!!pending||!!p.action||pets.some(q=>q!==p&&(PHYSICAL.has(q.mode)||q.pointerId!==null||q.touch||q.airborne)),
      paused:manualPaused,reduced,documentVisible:!document.hidden,paintHitRect:hit,desktop:v.w>=640&&!stageRect(p),
      assetAvailable:p.img.naturalWidth>0&&!p.assetUnavailable};
  }
  function releaseTransient(lease) {
    if(!transient||transient.lease!==lease)return false;
    const old=transient;transient=null;presentationRegistry.release(old.lease);
    const p=pets.find(p=>p.id===lease.id);
    if(p&&!destroyed){p.el.hidden=!requestedVisible.has(p.id);render(p);wake();}
    return true;
  }
  function cancelTransient(reason) {
    if(!transient)return;
    const old=transient;releaseTransient(old.lease);
    try{old.onCancel?.(reason);}catch(_){} // Cleanup precedes callbacks; no stale owner restoration.
  }
  // Explicit relocation only: no idle/reset/capture/visibility/scale mutation.
  function recoverSafePosition(id,readGeometry) {
    const p=pets.find(q=>q.id===id);
    const refuse=reason=>({ok:false,reason});
    const eligible=()=>!destroyed&&!presentationRegistry.get()&&!document.hidden&&requestedVisible.has(id)&&!p.el.hidden&&!p.assetUnavailable&&p.img.naturalWidth>0&&viewport().w>=640&&!stageRect(p)&&!isBeta(p)&&p.mode==='idle'&&!p.action&&!externalPresentation&&!transient&&!pair&&!pending&&![...inlineResponses.values()].some(c=>c.getState().mode!=='off')&&!pets.some(q=>PHYSICAL.has(q.mode)||q.pointerId!==null||q.touch||q.airborne);
    if(!p)return refuse('unknown');
    if(!eligible())return refuse('unavailable');
    if(typeof readGeometry!=='function')return refuse('geometry');
    const signature=()=>JSON.stringify(pets.map(q=>[q.id,q.x,q.y,q.width,q.height,q.mode,q.pointerId,!!q.touch,q.airborne]));
    const before=signature(),x=p.x,y=p.y;
    const collect=()=>readGeometry({id,element:p.el,paint:paintRect(p),x:p.x,y:p.y,width:p.width,height:p.height});
    let g;try{g=collect();}catch(_){return refuse('geometry');}
    if(!g||!eligible()||signature()!==before)return refuse('stale');
    const fit=nearestScalePlacement({x,y,width:p.width,height:p.height,...g});
    if(!fit)return refuse('no-room');
    if(!fit.clamped)return {ok:true,reason:'already-safe'};
    let fresh;try{fresh=collect();}catch(_){return refuse('geometry');}
    if(!eligible()||signature()!==before||JSON.stringify(fresh)!==JSON.stringify(g))return refuse('stale');
    p.x=fit.x;render(p);const committed=signature();
    let after;try{after=collect();}catch(_){}
    const verified=after&&nearestScalePlacement({x:p.x,y:p.y,width:p.width,height:p.height,...after});
    if(!eligible()||signature()!==committed||p.scalePlacementUnavailable||!onScreen(p)||!verified||verified.clamped||p.y!==y){
      // All work above is synchronous. Restore only this still-idle actor.
      if(eligible()&&signature()===committed){p.x=x;p.y=y;render(p);}
      return refuse('verification');
    }
    scaleAnchors.delete(p.id);positionRevision++;return {ok:true,reason:'moved'};
  }
  function pairSnapshot({preflight=false}={}){
    dirty=true;refreshObstacles();const v=viewport();
    const ids=['chiikawa','hachiware'],members=ids.map(id=>pets.find(p=>p.id===id));
    const otherOwner=!preflight&&presentationRegistry.get()&&presentationRegistry.get().kind!=='pair';
    let study;try{study=readStudyState?.();}catch(_){}
    const studySafe=study?.phase==='home'&&study.busy===false&&study.composing===false&&study.audioPending===false&&Number.isSafeInteger(study.revision);
    const safe=pairArtApproved===true&&studySafe&&!destroyed&&!document.hidden&&!paused()&&v.w>=640&&!otherOwner&&!pair&&!pending&&members.every(p=>p&&requestedVisible.has(p.id)&&!p.assetUnavailable&&p.img.naturalWidth>0&&!p.scalePlacementUnavailable&&!stageRect(p)&&!isBeta(p)&&p.mode==='idle'&&!p.action&&hachiPaintSafe({outer:paintRect(p)},{left:0,top:0,right:v.w,bottom:v.h},null,obstacles))&&!pets.some(p=>p.pointerId!==null||p.touch||p.airborne||PHYSICAL.has(p.mode));
    return {safe,epoch:transientEpoch,key:JSON.stringify([transientEpoch,study?.revision,[...requestedVisible],pets.map(p=>[p.id,p.x,p.y,p.width,p.height,p.mode,p.pointerId,!!p.touch,p.airborne]),manualPaused,reduced]),actors:ids};
  }
  function releasePairPresentation(token){
    if(!pairPresentation||pairPresentation.token!==token||!presentationRegistry.owns(token))return false;
    pairPresentation=null;presentationRegistry.release(token);
    for(const id of token.actors){const p=pets.find(q=>q.id===id);if(p&&!destroyed){p.el.hidden=!requestedVisible.has(id);render(p);}}
    wake();return true;
  }
  function cancelPairPresentation(reason){const old=pairPresentation;if(!old)return;releasePairPresentation(old.token);try{old.onCancel?.(reason);}catch(_){}}
  const api = {
    ownsExternalPresentation(id,lease){return !destroyed&&externalPresentation===id&&externalLease===lease&&presentationRegistry.owns(lease);},
    readAuthoredStepAdmission(id,lease=null){
      dirty=true;refreshObstacles();const p=pets.find(q=>q.id===id),v=viewport();
      const own=!!lease&&!destroyed&&externalPresentation===id&&externalLease===lease&&presentationRegistry.owns(lease);
      let study;try{study=readStudyState?.();}catch(_){}
      const physical=pets.some(q=>q.pointerId!==null||q.touch||q.airborne||PHYSICAL.has(q.mode));
      const sourceSafe=!!p&&hachiPaintSafe({outer:paintRect(p)},{left:0,top:0,right:v.w,bottom:v.h},null,obstacles);
      const safe=id==='hachiware'&&!destroyed&&!document.hidden&&v.w>=640&&study?.phase==='home'&&study.busy===false&&study.composing===false&&study.audioPending===false&&Number.isSafeInteger(study.revision)&&(!presentationRegistry.get()||own)&&!!p&&requestedVisible.has(id)&&(!p.el.hidden||own)&&!p.assetUnavailable&&p.img.naturalWidth>0&&!p.scalePlacementUnavailable&&!stageRect(p)&&!isBeta(p)&&p.mode==='idle'&&!p.action&&!pair&&!pending&&!physical&&sourceSafe;
      return {safe,epoch:transientEpoch,studyRevision:study?.revision,paused:paused(),reduced,own,touchPending:pets.some(q=>!!q.touch),captured:pets.some(q=>q.pointerId!==null),physical,pending:!!pending,key:JSON.stringify([transientEpoch,study?.revision,[...requestedVisible],pets.map(q=>[q.id,q.x,q.y,q.width,q.height,q.mode,!!q.action,q.pointerId,!!q.touch,q.airborne,q.scalePlacementUnavailable]),!!pair,!!pending,manualPaused,reduced,v,obstacles])};
    },
    getPresentationOwner(){const p=presentationRegistry.get();return p?{kind:p.kind,actors:[...p.actors],epoch:p.epoch}:null;},
    readPairAdmission:pairSnapshot,
    tryAcquirePairPresentation(expected,onCancel){const s=pairSnapshot();if(!s.safe||presentationRegistry.get()||s.epoch!==expected?.epoch||s.key!==expected?.key)return null;const token=presentationRegistry.acquire('pair',['chiikawa','hachiware']);if(!token)return null;pairPresentation={token,onCancel};for(const id of token.actors){const p=pets.find(q=>q.id===id);p.el.hidden=true;render(p);}return token;},
    ownsPairPresentation(token){return !!pairPresentation&&pairPresentation.token===token&&presentationRegistry.owns(token);},
    releasePairPresentation,
    recoverSafePosition,
    readTransientAdmission:transientSnapshot,
    tryAcquireTransientPresentation(expected,onCancel) {
      if(presentationRegistry.get()||transient)return null;
      const s=transientSnapshot();
      if(!s||s.epoch!==expected?.epoch||s.positionRevision!==expected?.positionRevision||!s.mounted||!s.visible||!s.onScreen||!s.assetAvailable||!s.desktop||!s.documentVisible||s.paused||s.reduced||s.captured||s.touch||s.airborne||s.physical||s.inline||s.otherPresentation||s.mode!=='idle')return null;
      const lease=presentationRegistry.acquire('glide',['momonga']);if(!lease)return null;
      transient={lease,onCancel};const p=pets.find(p=>p.id==='momonga');p.el.hidden=true;render(p);return lease;
    },
    ownsTransientPresentation(lease){return !!transient&&transient.lease===lease&&!destroyed;},
    releaseTransientPresentation:releaseTransient,
    getTransientPresentationHost(){return destroyed?null:root;},
    playInlineResponse(id='chiikawa'){const controller=inlineFor(id);if(!controller)return false;if(controller.getState().mode==='off'){const p=pets.find(p=>p.id===id);if(!p||!requestedVisible.has(id)||p.assetUnavailable||PHYSICAL.has(p.mode)||p.touch)return false;cancelPairPresentation('inline-request');cancelTransient('inline-request');for(const[key,other]of inlineResponses)if(key!==id)other.cancel('other-inline');cancelPair();pending=null;idle(p);}return controller.start();},
    cancelInlineResponse(reason,id=null){if(id)inlineFor(id)?.cancel(reason);else cancelInlineAll(reason);},
    getInlineResponseState(id='chiikawa'){return inlineFor(id)?.getState()??{mode:'off',active:false,loading:false,index:-1};},
    react, playAction, pause() { manualPaused = true; syncPaused(); }, resume() { manualPaused = false; syncPaused(); }, isPaused: paused,
    setDisplayScales(value) {
      if(destroyed||scaleChangeActive)return false;
      scaleChangeActive=true;
      try{
        const snapshots=new Map(pets.map(p=>{
          const stage=decorativeStage(p)??mobileStage(p)??null,prior=scaleAnchors.get(p.id);
          const retained=prior&&prior.stage===stage&&Math.abs(p.x-prior.placedX)<1e-6;
          const x=retained?prior.preferredX:p.x;
          return[p.id,{x,stage,offset:stage?x-stage.getBoundingClientRect().left:null}];
        }));
        const oldOwner=presentationRegistry.get();
        onBeforeSizeChange?.();
        if(destroyed||presentationRegistry.get()&&presentationRegistry.get()!==oldOwner)return false;
        cancelInlineAll('size-change');
        if(destroyed||presentationRegistry.get()&&presentationRegistry.get()!==oldOwner)return false;
        cancelPairPresentation('size-change');
        if(destroyed||presentationRegistry.get()&&presentationRegistry.get()!==oldOwner)return false;
        cancelTransient('size-change');
        if(destroyed||presentationRegistry.get()&&presentationRegistry.get()!==oldOwner)return false;
        cancelExternalPresentation('size-change');
        if(destroyed||presentationRegistry.get())return false;
        cancelPair();pending=null;
        for(const p of pets){safeReset(p);if(destroyed||presentationRegistry.get())return false;}
        lastTime=0;
        if(destroyed||presentationRegistry.get()||pets.some(p=>p.pointerId!==null||p.touch))return false;
        scalePercents=normalizeScaleMap(value);refreshObstacles();const shownIds=visibleIds();
        // Size every actor before reserving peer paint; no partly-old-size planning.
        for(const p of pets){
          p.el.hidden=!shownIds.includes(p.id);const old=snapshots.get(p.id),stage=decorativeStage(p)??mobileStage(p)??null;
          sizePet(p);p.x=old.stage===stage&&stage?stage.getBoundingClientRect().left+old.offset:old.x;
          p.stageLeft=stage?.getBoundingClientRect().left??null;p.y=ground(p);p.scalePlacementUnavailable=false;
        }
        const reserved=pets.filter(p=>!p.el.hidden&&scaleExempt(p)).map(p=>paintRect(p));
        for(const p of pets){
          const preferredX=p.x,stage=decorativeStage(p)??mobileStage(p)??null;
          if(!p.el.hidden&&!scaleExempt(p)){
            const fit=scalePlacement(p,preferredX,[...obstacles,...reserved]);
            if(fit){p.x=fit.x;reserved.push(paintRect(p));}else p.scalePlacementUnavailable=true;
            scaleAnchors.set(p.id,{preferredX,placedX:p.x,stage});
          }else scaleAnchors.delete(p.id);
        }
        // Commit all reservations before rendering/callbacks can observe peers.
        for(const p of pets)render(p);
        invalidate();return true;
      }finally{scaleChangeActive=false;}
    },
    getDisplayScales(){return{...scalePercents};},
    setMobileCharacters(ids) { if (destroyed) return; mobileOrder = [...new Set(ids)].filter(id => selected.some(p => p.id === id)); mobileLimit = mobileOrder.length; layout(); },
    setVisibleCharacters(ids) { if (destroyed) return; requestedVisible = new Set(ids.filter(id => selected.some(p => p.id === id))); if (externalPresentation && !requestedVisible.has(externalPresentation)) cancelExternalPresentation('hidden'); layout(); },
    tryAcquireAuthoredStepPresentation(expected){
      const current=api.readAuthoredStepAdmission('hachiware');
      if(!current.safe||presentationRegistry.get()||current.epoch!==expected?.epoch||current.key!==expected?.key)return null;
      const p=pets.find(p=>p.id==='hachiware'),token=presentationRegistry.acquire('single',['hachiware']);if(!token)return null;
      externalPresentation='hachiware';externalLease=token;externalLeaseRequired=true;externalStageAnchor=null;externalNoLayout=true;
      p.el.hidden=true;render(p);return token;
    },
    beginExternalPresentation(id, {preserveStageAnchor=false,returnLease=false}={}) {
      if (destroyed || !requestedVisible.has(id) || !selected.some(p => p.id === id)) return false;
      cancelInlineAll('external-presentation');cancelExternalPresentation('replaced');const p=pets.find(p=>p.id===id),stage=p&&decorativeStage(p);
      externalStageAnchor=preserveStageAnchor&&stage?{stage,offset:p.x-stage.getBoundingClientRect().left}:null;
      externalLease=presentationRegistry.acquire('single',[id]);if(!externalLease)return false;externalPresentation=id;externalLeaseRequired=returnLease;layout();return returnLease?externalLease:true;
    },
    endExternalPresentation(id, lease=null) {
      if(destroyed||externalPresentation!==id||((externalLeaseRequired||lease!==null)&&lease!==externalLease))return;
      const anchor=externalStageAnchor,noLayout=externalNoLayout;presentationRegistry.release(externalLease);externalPresentation=null;externalLease=null;externalStageAnchor=null;externalLeaseRequired=false;externalNoLayout=false;
      if(noLayout){const p=pets.find(p=>p.id===id);if(p){p.el.hidden=!visibleIds().includes(id);render(p);}wake();return;}
      layout();
      const p=pets.find(p=>p.id===id);if(anchor&&p&&!p.el.hidden&&decorativeStage(p)===anchor.stage){p.x=constrainX(p,anchor.stage.getBoundingClientRect().left+anchor.offset);render(p);invalidate();}
    },
    playKaniPreview(state){const p=pets[0];if(!p||p.pointerId!==null||PHYSICAL.has(p.mode)||paused())return Promise.resolve(false);return captureVisualFor(p).preview(state);},
    stopKaniPreview(){for(const p of pets){p.captureVisual?.cancel();render(p);}},
    getExternalPresentation() { return externalPresentation; },
    focusCharacter(id) { if(!requestedVisible.has(id)||!pets.some(p=>p.id===id))return false;cancelPairPresentation('focus');if(transient?.lease.id===id)cancelTransient('focus'); if (externalPresentation === id) { cancelExternalPresentation('focus'); layout(); } const p = pets.find(p => p.id === id && !p.el.hidden); if (!p) return false; (decorativeStage(p)??mobileStage(p))?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); render(p);if(!onScreen(p))return false;p.el.focus?.({ preventScroll: true });return true; },
    getVisibleCharacters() { return selected.map(p => p.id).filter(id => requestedVisible.has(id)); },
    getState() { return pets.map(p => ({ id: p.id, mode: p.mode, frame: p.frame, x: p.x, y: p.y, width: p.width, height: p.height, dir: p.dir, airborne: p.airborne, glide: false, jump: false, visible: !p.el.hidden, onScreen: onScreen(p), reactionTime: p.action ? Math.max(0, p.action.duration - p.action.elapsed) : 0, assetMode: p.el.dataset.assetMode, assetUnavailable:!!p.assetUnavailable, paintHitRect:paintRect(p), inlinePadding:!!paddedGeometry(p),inlineEnabled:!!inlineFor(p), displayPercent:appliedScalePercent(p),scalePlacementUnavailable:!!p.scalePlacementUnavailable, pairRole: p.pairRole ?? null, captured: p.pointerId !== null })); },
    destroy() { if (destroyed) return; for(const p of pets)p.captureVisual?.destroy(); cancelExternalPresentation('destroy'); resetAll(); destroyed = true; presentationRegistry.destroy();cancelAnimationFrame(raf); for (const [el, type, fn, opts] of listeners) el.removeEventListener(type, fn, opts); observer?.disconnect(); for (const img of preloads) { img.onload = img.onerror = null; } root.remove(); if (window[INSTANCE] === api) delete window[INSTANCE]; },
  };
  window[INSTANCE] = api; return api;
}
