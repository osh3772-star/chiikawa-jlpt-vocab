// Isolated B proposal; no production imports. Only an explicitly supplied, audited owner is supported.
export const validRect=r=>!!r&&['left','top','right','bottom'].every(k=>Number.isFinite(r[k]))&&r.right>r.left&&r.bottom>r.top;
const copy=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.right-r.left,height:r.bottom-r.top});
export function intersect(a,b){if(!validRect(a)||!validRect(b))return null;const r={left:Math.max(a.left,b.left),top:Math.max(a.top,b.top),right:Math.min(a.right,b.right),bottom:Math.min(a.bottom,b.bottom)};return validRect(r)?copy(r):null;}
const none=v=>v===undefined||v===''||v==='none';
function unsupported(s){return !none(s.transform)||!none(s.perspective)||!none(s.filter)||!none(s.backdropFilter)||!none(s.clipPath)||!none(s.maskImage)||!none(s.translate)||!none(s.rotate)||!none(s.scale)||(s.zoom&&s.zoom!=='normal'&&Number(s.zoom)!==1)||(s.contain&&s.contain!=='none')||(s.contentVisibility&&s.contentVisibility!=='visible');}
const invalid=reason=>({kind:'invalid',reason});
/** No global selectors, no writes, no scroll. Invalid never means clipped. */
export function ownedClipContext(el,{owner,getStyle}){
 if(!owner||el===owner||!owner.contains(el))return{kind:'unowned'};
 let fixedEscape=false;
 for(let n=el;n&&n!==owner;n=n.parentElement){const s=getStyle(n);if(unsupported(s))return invalid('unsupported-descendant-coordinate-system');if(s.position==='fixed')fixedEscape=true;}
 // Guard owner and ancestor coordinate/containing-block assumptions before accepting fixed escape.
 for(let n=owner;n;n=n.parentElement)if(unsupported(getStyle(n)))return invalid('unsupported-owner-coordinate-system');
 if(fixedEscape)return{kind:'unowned',reason:'fixed-escapes-owned-clip'};
 const s=getStyle(owner);
 if(s.position!=='relative'||!['auto','scroll','hidden'].includes(s.overflowX)||!['auto','scroll','hidden'].includes(s.overflowY)||['borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius'].some(k=>s[k]&&parseFloat(s[k])!==0))return invalid('owner-not-audited-rectangle');
 const r=owner.getBoundingClientRect(),{clientLeft,clientTop,clientWidth,clientHeight}=owner;
 if(!validRect(r)||![clientLeft,clientTop,clientWidth,clientHeight].every(Number.isFinite)||clientLeft<0||clientTop<0||clientWidth<=0||clientHeight<=0)return invalid('invalid-owner-box');
 const c={left:r.left+clientLeft,top:r.top+clientTop,right:r.left+clientLeft+clientWidth,bottom:r.top+clientTop+clientHeight};
 if(c.right>r.right+1e-6||c.bottom>r.bottom+1e-6)return invalid('owner-metric-mismatch');
 return{kind:'owned',clip:copy(c)};
}
export function clipOwnedPaint(el,paint,env){
 if(!validRect(paint))return invalid('invalid-paint');
 const c=ownedClipContext(el,env);if(c.kind==='invalid')return c;
 if(c.kind==='unowned')return{kind:'visible',rect:copy(paint),owned:false};
 const r=intersect(paint,c.clip);return r?{kind:'visible',rect:r,owned:true}:{kind:'clipped'};
}
/** Keep existing selection, displayed policy, exclusions and paint expansion at caller. */
export function collectOwnedObstacles(elements,{paint,displayed=()=>true,invalidPolicy='block',...env}){
 const rects=[];for(const el of elements){if(!displayed(el))continue;const raw=paint(el),r=clipOwnedPaint(el,raw,env);
  if(r.kind==='invalid'){if(invalidPolicy==='raw'&&validRect(raw)){rects.push(copy(raw));continue;}return{ok:false,rects:[],reason:r.reason};}
  if(r.kind==='visible')rects.push(r.rect);
 }return{ok:true,rects};
}
export function fullStageEligible(stage,paint,viewport,env){
 if(!validRect(paint)||!validRect(viewport))return false;
 const c=ownedClipContext(stage,env);if(c.kind==='invalid')return false;
 const bounds=c.kind==='owned'?intersect(viewport,c.clip):viewport;if(!bounds)return false;
 return paint.left>=bounds.left&&paint.top>=bounds.top&&paint.right<=bounds.right&&paint.bottom<=bounds.bottom;
}
/** Stage layout stays RAW. Clip is presentation/admission only, never ground()/xBounds() input. */
export function stagePresentation(stage,actorPaint,{viewport,dock=null,...env}){
 if(!validRect(actorPaint)||!validRect(viewport)||dock&&!validRect(dock))return{visible:false,eligible:false,reason:'invalid'};
 const rawStage=stage?.getBoundingClientRect()??null;if(stage&&!validRect(rawStage))return{visible:false,eligible:false,reason:'invalid-stage'};
 const c=stage?ownedClipContext(stage,env):{kind:'unowned'};if(c.kind==='invalid')return{visible:false,eligible:false,owned:true,reason:c.reason,stageRect:rawStage};
 let clip=viewport;for(const bound of [dock,c.kind==='owned'?c.clip:null])if(bound){clip=intersect(clip,bound);if(!clip)return{visible:false,eligible:false,owned:c.kind==='owned',stageRect:rawStage};}
 const shown=intersect(actorPaint,clip);if(!shown)return{visible:false,eligible:false,owned:c.kind==='owned',stageRect:rawStage};
 const insets=[Math.max(0,clip.top-actorPaint.top),Math.max(0,actorPaint.right-clip.right),Math.max(0,actorPaint.bottom-clip.bottom),Math.max(0,clip.left-actorPaint.left)];
 return{visible:true,owned:c.kind==='owned',eligible:insets.every(n=>n===0),stageRect:rawStage,clipPath:`inset(${insets.map(n=>n+'px').join(' ')})`,paint:shown};
}
