/** Ordinary actor input sequences. This registry is separate from autonomous weights.
 * Bindings supply verified existing sources; authored/derived timing stays labelled.
 * No DOM, decode, clocks, timers, frame synthesis, probability or asset mutation.
 */
export const INPUT_SEQUENCE_STATES = Object.freeze(['press','tap','grab','held','release','fall','landing','recover','walk']);
export function inputSequenceState(action) {
  return ({'grab-onset':'grab',hold:'held',start:'tap','input-walk':'walk'})[action] ?? action;
}
export function resolveActorInputSequence(profile,state,direction='front') {
  state=inputSequenceState(state);
  const registry=profile?.inputSequences;
  if(registry?.enabled!==true||!INPUT_SEQUENCE_STATES.includes(state))return null;
  const entry=registry.actions?.[state],view=entry?.views?.[direction]??entry?.views?.front??entry;
  if(entry?.verifiedAssets!==true||!view||!Array.isArray(view.frames)||view.frames.length<1||typeof entry.timingOrigin!=='string')return null;
  if(view.loop===true&&!['held','fall','walk'].includes(state))return null;
  if(view.frames.some(f=>!f||typeof f.frameId!=='string'||!f.frameId||typeof f.source!=='string'||!f.source||!Number.isFinite(f.durationMs)||f.durationMs<=0||!validInputFramePaint(f.paint)||['flip','rotation','transform'].some(k=>Object.hasOwn(f,k))))return null;
  const distinctDrawings=new Set(view.frames.map(f=>f.sha256??f.source)).size;
  if(view.loop===true&&distinctDrawings<2)return null;
  return {inputOnly:true,state,timingOrigin:entry.timingOrigin,loop:view.loop===true,rootDistance:0,frames:view.frames,distinctDrawings,representation:entry.representation??(distinctDrawings>1?'frame-sequence':'static-pose')};
}
export function validInputFramePaint(paint) {
  return !!paint&&['left','top','width','height','referenceWidth'].every(k=>Number.isFinite(paint[k]))&&paint.width>0&&paint.height>0&&paint.referenceWidth>0&&(paint.clipPath===undefined||paint.clipPath==='none')&&(!paint.clipInset||Array.isArray(paint.clipInset)&&paint.clipInset.length===4&&paint.clipInset.every(n=>Number.isFinite(n)&&n>=0));
}
/** Entire explicit paint region, including transparent margins, never alpha bounds.
 * A registered sprite-sheet crop excludes other keys; uncropped canvases stay whole.
 */
export function inputFrameBounds(frame,actor) {
  if(!validInputFramePaint(frame?.paint)||!actor||!['x','y','width','height'].every(k=>Number.isFinite(actor[k]))||actor.width<=0||actor.height<=0)return null;
  const f=frame.paint,k=actor.width/f.referenceWidth,[t,r,b,l]=f.clipInset??[0,0,0,0];
  const left=actor.x+(f.left+l)*k,top=actor.y+(f.top+t)*k,width=(f.width-l-r)*k,height=(f.height-t-b)*k;
  if(![left,top,width,height].every(Number.isFinite)||width<=0||height<=0)return null;
  return {left,top,right:left+width,bottom:top+height,width,height};
}
export function inputSequenceSample(sequence,elapsedMs) {
  if(!sequence?.inputOnly||!Array.isArray(sequence.frames)||!Number.isFinite(elapsedMs)||elapsedMs<0)return null;
  const duration=sequence.frames.reduce((n,f)=>n+f.durationMs,0);
  if(!Number.isFinite(duration)||duration<=0)return null;
  const cycle=sequence.loop?Math.floor(elapsedMs/duration):0,done=!sequence.loop&&elapsedMs>=duration;
  const time=done?duration-.000001:sequence.loop?elapsedMs%duration:elapsedMs;
  let cursor=0;const index=Math.max(0,sequence.frames.findIndex(f=>(cursor+=f.durationMs)>time));
  return {frame:sequence.frames[index],index,slot:cycle*sequence.frames.length+index,done,duration};
}
