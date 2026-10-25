/** Isolated, DOM-free contract prototype. No production engine/actor imports. */
export const R3 = Object.freeze({width:1627,height:967,sha256:'2b6068c38fdab9f0bc6ca54366729df0a2b25ab93524a68a12616b32cefbf580'});
const finite = Number.isFinite;
const rect = r => r && [r.left,r.top,r.right,r.bottom].every(finite) && r.right>r.left && r.bottom>r.top;
const point = p => p && finite(p.x) && finite(p.y);
const fail = reason => ({ok:false,reason});

// Segment vs closed rectangle: Minkowski expansion gives the exact continuous
// sweep of a fixed axis-aligned full PNG box, not endpoint-only sampling.
function hits(a,b,r) {
  let lo=0,hi=1;
  for(const [axis,min,max] of [['x',r.left,r.right],['y',r.top,r.bottom]]) {
    const d=b[axis]-a[axis];
    if(d===0) { if(a[axis]<min||a[axis]>max)return false; }
    else { const t1=(min-a[axis])/d,t2=(max-a[axis])/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false; }
  }
  return true;
}
export function checkCorridor(path,g) {
  if(!path||!point(path.start)||!point(path.end)||!finite(path.width)||path.width<96||!finite(path.height)||path.height<=0)return fail('invalid-path');
  if(Math.abs(path.height-path.width*R3.height/R3.width)>1e-7)return fail('nonuniform-scale');
  if(!(path.end.x<path.start.x&&path.end.y<path.start.y))return fail('wrong-direction');
  if(!g||!Number.isSafeInteger(g.version)||g.version<0||![g.viewport,g.clip,g.reserved].every(rect)||!Array.isArray(g.obstacles)||!g.obstacles.every(rect)||!finite(g.margin)||g.margin<6)return fail('invalid-geometry');
  // Margin includes all approved external paint effects; no unbounded shadows.
  const s={left:Math.max(g.viewport.left,g.clip.left,g.reserved.left)+g.margin,top:Math.max(g.viewport.top,g.clip.top,g.reserved.top)+g.margin,right:Math.min(g.viewport.right,g.clip.right,g.reserved.right)-g.margin,bottom:Math.min(g.viewport.bottom,g.clip.bottom,g.reserved.bottom)-g.margin};
  if(!rect(s))return fail('no-space');
  for(const p of [path.start,path.end])if(p.x<s.left||p.y<s.top||p.x+path.width>s.right||p.y+path.height>s.bottom)return fail('outside-safe-intersection');
  // Convex container + linear translation: endpoint containment proves all t.
  for(const o of g.obstacles)if(hits(path.start,path.end,{left:o.left-path.width-g.margin,right:o.right+g.margin,top:o.top-path.height-g.margin,bottom:o.bottom+g.margin}))return fail('swept-obstacle');
  return {ok:true,version:g.version};
}
export function candidatePaths(path,geometry) { return checkCorridor(path,geometry).ok?[structuredClone(path)]:[]; }
const physicalModes=new Set(['grab-onset','hold','release','fall','landing','recover']);
export function admission(s,{running=false}={}) {
  if(!s||s.explicit!==true||s.visible!==true||s.onScreen!==true||s.documentVisible!==true||s.mounted!==true)return fail('visibility-or-intent');
  for(const key of ['captured','touch','airborne','physical','ime','inputActive','audioActive','studyActive','reduced','paused'])if(s[key]!==false)return fail(key);
  if(physicalModes.has(s.mode)||typeof s.mode!=='string')return fail('physical-mode');
  if(!Number.isSafeInteger(s.epoch)||!Number.isSafeInteger(s.positionRevision))return fail('invalid-epoch');
  if(s.inline!==false||s.rear4!==false||(!running&&s.otherPresentation!==false))return fail('busy-other');
  return {ok:true};
}
export const CANCEL_EVENTS=new Set(['study','meaning','answer','next-word','route','focus-input','beforeinput','input','compositionstart','audio-start','pointer-grab','resize','scroll','blur','pagehide','hide','all-off','Escape','unmount','image-error','layout','lease-loss','pause','reduced']);

/** Injected sinks are synchronous and non-reentrant. tryAcquire is atomic,
 * non-preempting, and MUST NOT call v20's destructive begin/coordinator.start.
 * release only releases this lease; it never restores an old position snapshot.
 * clock.now and RAF timestamps share a monotonic time origin; setTimeout and
 * clearTimeout are independent of RAF. JS suspension can delay both queues.
 * readGeometry returns a complete fresh immutable snapshot on every call.
 */
export function createGlide({readState,readGeometry,tryAcquire,owns,release,paint,remove,clock}) {
  let serial=0,run=null;
  const validTime=(time,minimum=0)=>finite(time)&&time>=minimum;
  function cancel(reason='cancel') {
    if(!run)return false;
    const old=run;run=null;++serial;
    if(old.frame!==null)clock.cancel(old.frame);
    if(old.timer!==null)clock.clearTimeout(old.timer);
    // Invalidate before callbacks. No position/visibility setter exists here.
    if(old.lease!==null) {remove(old.lease,reason);release(old.lease,reason);}
    return true;
  }
  function valid(r) {
    const s=readState(),a=admission(s,{running:r.lease!==null});
    if(!a.ok)return a;
    if(s.epoch!==r.epoch||s.positionRevision!==r.positionRevision)return fail('epoch-or-user-position-changed');
    if(r.lease!==null&&!owns(r.lease))return fail('lease-loss');
    // Even unchanged version is geometrically checked, failing closed if the
    // adapter forgot to bump its version. DOM collection remains a future gate.
    const g=readGeometry();
    if(g?.version!==r.geometryVersion)return fail('geometry-version-changed');
    return checkCorridor(r.path,g);
  }
  function deadline(r) {
    if(run!==r||r.token!==serial)return;
    if(r.timer!==null)clock.clearTimeout(r.timer);r.timer=null;
    // Absolute, monotonic deadline: an early timer never shortens the contract.
    const now=clock.now();
    if(!validTime(now,r.lastTime)){cancel('invalid-clock');return;}
    r.lastTime=now;
    const remaining=r.deadline-now;
    if(remaining>0){r.timer=clock.setTimeout(()=>deadline(r),remaining);return;}
    cancel('absolute-deadline-ui-cut');
  }
  function draw(r,now) {
    if(run!==r||r.token!==serial)return false;
    if(!validTime(now,r.lastTime)){cancel('invalid-clock');return false;}
    r.lastTime=now;
    if(now>r.deadline){cancel('absolute-deadline-ui-cut');return false;}
    const v=valid(r);if(!v.ok){cancel(v.reason);return false;}
    const t=Math.max(0,Math.min(1,(now-r.start)/1800));
    paint(r.lease,{x:r.path.start.x+(r.path.end.x-r.path.start.x)*t,y:r.path.start.y+(r.path.end.y-r.path.start.y)*t,width:r.path.width,height:r.path.height},t);
    if(run!==r||r.token!==serial)return false; // Adapter paint may synchronously reject or lose ownership.
    if(t===1){cancel('complete-ui-cut');return true;}
    r.frame=clock.request(time=>draw(r,time));return true;
  }
  function request(path) {
    // Reject duplicate/invalid requests without canceling this or other work.
    if(run)return fail('busy');
    const requestTime=clock.now();if(!validTime(requestTime))return fail('invalid-clock');
    const s=readState(),a=admission(s);if(!a.ok)return a;
    const g=readGeometry(),safe=checkCorridor(path,g);if(!safe.ok)return safe;
    const token=++serial;
    run={token,path:structuredClone(path),epoch:s.epoch,positionRevision:s.positionRevision,geometryVersion:g.version,lease:null,frame:null,timer:null,start:null,deadline:null,requestTime,lastTime:requestTime};
    return {ok:true,token}; // decode/hash proof may arrive asynchronously
  }
  function ready(token,proof) {
    const r=run;if(!r||token!==r.token||r.lease!==null)return false;
    if(!proof||proof.decoded!==true||proof.sha256!==R3.sha256||proof.width!==R3.width||proof.height!==R3.height){cancel('asset-proof');return false;}
    let v=valid(r);if(!v.ok){cancel(v.reason);return false;}
    const beforeAcquire=clock.now();
    if(!validTime(beforeAcquire,r.lastTime)||!finite(beforeAcquire+1800)||beforeAcquire+1800<=beforeAcquire){cancel('invalid-clock');return false;}
    r.lease=tryAcquire({epoch:r.epoch,positionRevision:r.positionRevision});
    if(r.lease===null||r.lease===undefined||r.lease===false){r.lease=null;cancel('lease-unavailable');return false;}
    // Acquire may change layout: remeasure immediately before the first paint.
    r.start=clock.now();
    if(!validTime(r.start,beforeAcquire)||!finite(r.start+1800)||r.start+1800<=r.start){cancel('invalid-clock');return false;}
    r.lastTime=r.start;r.deadline=r.start+1800;
    r.timer=clock.setTimeout(()=>deadline(r),1800);
    return draw(r,r.start);
  }
  return {request,ready,cancel,event(type){return CANCEL_EVENTS.has(type)?cancel(type):false;},state(){return {mode:!run?'off':run.lease===null?'preflight':'glide',token:run?.token??null};}};
}
