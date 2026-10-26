/** Pure candidate geometry/timing. Never starts animation or grants product approval.
 * Units: actor/paint rectangles are CSS viewport px; indices are zero-based 0..7.
 * The host retains decode, exact-byte verification, DOM, RAF, leases and input policy.
 */
import {CANDIDATE_REGISTRY} from './candidate-registry.mjs';
export {CANDIDATE_REGISTRY};
export const CANDIDATE_CHARACTERS = Object.freeze(Object.keys(CANDIDATE_REGISTRY));
export const PRESENTER_SCHEMA = 'continuous-candidate-presenter/v1';
const finite = Number.isFinite;
const freeze = value => {if(value && typeof value === 'object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const rect = (left,top,right,bottom) => ({left,top,right,bottom,width:right-left,height:bottom-top});
const validRect = r => !!r && ['left','top','right','bottom'].every(k=>finite(r[k])) && r.right>r.left && r.bottom>r.top && finite(r.right-r.left) && finite(r.bottom-r.top);
const copyRect = r => rect(r.left,r.top,r.right,r.bottom);
const union = (...rs) => rect(Math.min(...rs.map(r=>r.left)),Math.min(...rs.map(r=>r.top)),Math.max(...rs.map(r=>r.right)),Math.max(...rs.map(r=>r.bottom)));
const close = (a,b) => finite(a)&&finite(b)&&Math.abs(a-b)<=Math.max(1e-12,Math.max(Math.abs(a),Math.abs(b))*1e-12);
const sameRect = (a,b) => validRect(a)&&validRect(b)&&['left','top','right','bottom'].every(k=>a[k]===b[k]);
const unsupported = o => !!o && ['flip','flipX','flipY','mirror','scaleX','scaleY','rotation','rotate','transform','direction'].some(k=>Object.hasOwn(o,k));
const candidate = id => typeof id==='string'&&Object.hasOwn(CANDIDATE_REGISTRY,id)?CANDIDATE_REGISTRY[id]:null;

function geometry(c,actor,originalPaintBounds){
  if(!c||!actor||actor.id!==c.characterId||unsupported(actor)||!['x','y','width','height'].every(k=>finite(actor[k]))||actor.width<=0||actor.height<=0||!close(actor.height/actor.width,4/3)||!validRect(originalPaintBounds))return null;
  const a=c.registration,k=actor.width/390,scale=a.originalBodyHeight*k/a.candidateBodyHeight;
  const left=actor.x+a.originalCenterX*k-a.candidateCenterX*scale;
  const top=actor.y+a.originalFeetY*k-a.candidateFeetY*scale,size=1254*scale;
  const canvasBounds=rect(left,top,left+size,top+size),bodyBounds=rect(actor.x,actor.y,actor.x+actor.width,actor.y+actor.height);
  if(![k,scale,left,top,size].every(finite)||scale<=0||!validRect(canvasBounds)||!validRect(bodyBounds)||!close(canvasBounds.width,size)||!close(canvasBounds.height,size)||!close(bodyBounds.width,actor.width)||!close(bodyBounds.height,actor.height))return null;
  const original=copyRect(originalPaintBounds),protectedPaintBounds=union(canvasBounds,bodyBounds,original);
  if(!validRect(protectedPaintBounds))return null;
  return {canvasBounds,bodyBounds,originalPaintBounds:original,protectedPaintBounds,
    canvasTransform:{scale,translateX:left,translateY:top},
    image:{left:left-actor.x,top:top-actor.y,width:size,height:size,objectFit:'fill',clipPath:'none'},
    referenceCenterX:actor.x+a.originalCenterX*k,referenceFeetY:actor.y+a.originalFeetY*k};
}

/** assetBaseURL must point to the explicitly hosted animation-candidates-20261027/ directory.
 * originalPaintBounds is REQUIRED: pass the host's current original paintRect(actor),
 * including padding/expanded poses, not an assumed unpadded DOM rectangle.
 * No flip/direction/rotation options are accepted. Root travel is not implemented here.
 */
export function getCandidateFrame(characterId,frameIndex,actor,options={}){
  const c=candidate(characterId);
  if(!c||!Number.isInteger(frameIndex)||frameIndex<0||frameIndex>=8||!options||unsupported(options))return null;
  let base;try{base=new URL(options.assetBaseURL);}catch{return null;}
  if(!['https:','http:'].includes(base.protocol)||base.username||base.password||base.search||base.hash||!base.pathname.endsWith('/animation-candidates-20261027/'))return null;
  const g=geometry(c,actor,options.originalPaintBounds);if(!g)return null;
  const f=c.frames[frameIndex],url=new URL(f.assetPath,base).href;
  return freeze({schema:PRESENTER_SCHEMA,characterId,frameIndex,poseId:f.poseId,url,assetPath:f.assetPath,
    repositoryPath:f.repositoryPath,sha256:f.sha256,bytes:f.bytes,canvas:[1254,1254],
    actor:{id:actor.id,x:actor.x,y:actor.y,width:actor.width,height:actor.height},...g,
    approved:false,defaultActivation:false,naturalWalkingVerified:false,directionalWalkingVerified:false,
    timingApproved:false,rootTravel:false,mirror:false,automaticFrameCorrection:false,blockers:[...c.blockers]});
}

/** Check geometry only; this is NOT an engine admission/lease/approval check.
 * Host must also check full swept union between root positions, current peers,
 * owned clips, controls, input, study/media state, pause/reduced and asset identity.
 */
export function candidatePlanFits(plan,viewport,obstacles=[],margin=4){
  if(!plan||plan.schema!==PRESENTER_SCHEMA||!['approved','defaultActivation','naturalWalkingVerified','directionalWalkingVerified','timingApproved','rootTravel','mirror','automaticFrameCorrection'].every(k=>plan[k]===false)||!Number.isInteger(plan.frameIndex)||plan.frameIndex<0||plan.frameIndex>=8||!validRect(viewport)||!Array.isArray(obstacles)||!obstacles.every(validRect)||!finite(margin)||margin<4)return false;
  const c=candidate(plan.characterId),f=c?.frames?.[plan.frameIndex];
  if(!f||plan.poseId!==f.poseId||plan.sha256!==f.sha256||plan.bytes!==f.bytes)return false;
  const g=geometry(c,plan.actor,plan.originalPaintBounds);if(!g||!sameRect(plan.canvasBounds,g.canvasBounds)||!sameRect(plan.bodyBounds,g.bodyBounds)||!sameRect(plan.protectedPaintBounds,g.protectedPaintBounds)||!Object.entries(g.image).every(([k,v])=>plan.image?.[k]===v)||!Object.entries(g.canvasTransform).every(([k,v])=>plan.canvasTransform?.[k]===v))return false;
  const r=g.protectedPaintBounds;
  return r.left>=viewport.left+margin&&r.top>=viewport.top+margin&&r.right<=viewport.right-margin&&r.bottom<=viewport.bottom-margin&&!obstacles.some(o=>r.left<o.right+margin&&r.right>o.left-margin&&r.top<o.bottom+margin&&r.bottom>o.top-margin);
}

/** Pure playback schedule for a host-controlled review, with no clocks/timers.
 * 120ms is an AUTHORED TEST EXPOSURE, not observed video or approved natural cadence.
 * loop is opt-in here and does not activate a player. Default is one finite pass.
 * The host must reject missed exposure slots instead of silently jumping drawings.
 */
export function sampleCandidateTiming(characterId,elapsedMs,options={}){
  const c=candidate(characterId);if(!c||!finite(elapsedMs)||elapsedMs<0||!options)return null;
  const exposureMs=options.exposureMs??120,loop=options.loop??false;
  if(!finite(exposureMs)||exposureMs<=0||exposureMs>5000||typeof loop!=='boolean')return null;
  const durationMs=exposureMs*8,cycle=loop?Math.floor(elapsedMs/durationMs):0;
  if(!finite(durationMs)||!Number.isSafeInteger(cycle))return null;
  const done=!loop&&elapsedMs>=durationMs,time=done?durationMs:loop?elapsedMs%durationMs:elapsedMs;
  const frameIndex=done?7:Math.min(7,Math.floor(time/exposureMs)),slot=cycle*8+frameIndex;
  if(!Number.isSafeInteger(slot))return null;
  return freeze({schema:PRESENTER_SCHEMA,characterId,frameIndex,poseId:c.frames[frameIndex].poseId,slot,cycle,
    phase:time/durationMs,frameElapsedMs:done?exposureMs:time-frameIndex*exposureMs,
    exposureMs,durationMs,loop,done,timingOrigin:'AUTHORED_REVIEW_NOT_VIDEO',timingApproved:false,
    approved:false,defaultActivation:false,naturalWalkingVerified:false,rootTravel:false});
}
