/** Ordinary actor input sequences. This registry is separate from autonomous weights.
 * Bindings supply verified existing sources; authored/derived timing stays labelled.
 * No DOM, decode, clocks, timers, frame synthesis, probability or asset mutation.
 */
export const INPUT_SEQUENCE_STATES = Object.freeze(['press','tap','grab','held','release','fall','landing','recover','walk']);
export function inputSequenceState(action) {
  return ({'grab-onset':'grab',hold:'held',start:'tap'})[action] ?? action;
}
export function resolveActorInputSequence(profile,state,direction='front') {
  state=inputSequenceState(state);
  const registry=profile?.inputSequences;
  if(registry?.enabled!==true||!INPUT_SEQUENCE_STATES.includes(state))return null;
  const entry=registry.actions?.[state],view=entry?.views?.[direction]??entry?.views?.front??entry;
  if(entry?.verifiedAssets!==true||!view||!Array.isArray(view.frames)||view.frames.length<2||typeof entry.timingOrigin!=='string')return null;
  if(view.loop===true&&!['held','fall','walk'].includes(state))return null;
  if(view.frames.some(f=>!f||typeof f.frameId!=='string'||!f.frameId||typeof f.source!=='string'||!f.source||!Number.isFinite(f.durationMs)||f.durationMs<=0||!validInputFramePaint(f.paint)||['flip','rotation','transform'].some(k=>Object.hasOwn(f,k))))return null;
  return {inputOnly:true,state,timingOrigin:entry.timingOrigin,loop:view.loop===true,rootDistance:0,frames:view.frames};
}
export function validInputFramePaint(paint) {
  return !!paint&&['left','top','width','height','referenceWidth'].every(k=>Number.isFinite(paint[k]))&&paint.width>0&&paint.height>0&&paint.referenceWidth>0&&(paint.clipPath===undefined||paint.clipPath==='none')&&(!paint.clipInset||Array.isArray(paint.clipInset)&&paint.clipInset.length===4&&paint.clipInset.every(n=>Number.isFinite(n)&&n>=0));
}
/** Entire source canvas, including transparent margins. Never shrink to alpha bounds. */
export function inputFrameBounds(frame,actor) {
  if(!validInputFramePaint(frame?.paint)||!actor||!['x','y','width','height'].every(k=>Number.isFinite(actor[k]))||actor.width<=0||actor.height<=0)return null;
  const f=frame.paint,k=actor.width/f.referenceWidth,left=actor.x+f.left*k,top=actor.y+f.top*k,width=f.width*k,height=f.height*k;
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
