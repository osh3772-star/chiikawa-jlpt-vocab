import {CONTINUOUS_WALK_SCOPE,CONTINUOUS_PLACEMENT_SCOPE,FLOOR_WALK_SCOPE} from './continuous-walk-controller.mjs';
/** No fallback to the generic/existing manual presentation API. */
export function createContinuousWalkEngineAdapter({getEngine,readUI}){
 let held=null,disposed=false;
 const required=['readContinuousWalkAdmission','tryAcquireContinuousWalk','presentContinuousWalk','releaseContinuousWalk','ownsContinuousWalk','getPresentationOwner'];
 const valid=e=>!!e&&required.every(k=>typeof e[k]==='function');
 const other=Object.freeze({kind:'unavailable-or-other-owner'});
 function owner(){const e=getEngine();if(held&&e===held.engine&&e.ownsContinuousWalk(held.token)===true)return held.token;return valid(e)&&e.getPresentationOwner()===null?null:other;}
 function read(token){
  const e=getEngine(),u=readUI();if(disposed||!valid(e)||(token!==null&&token!==undefined&&(!held||token!==held.token||e!==held.engine)))return {safe:false};
  const scope=u?.floorRequested===true?FLOOR_WALK_SCOPE:u?.placementRequested===true?CONTINUOUS_PLACEMENT_SCOPE:CONTINUOUS_WALK_SCOPE;
  const s=e.readContinuousWalkAdmission({scope,actorId:'chiikawa',lease:token??null});
  if(!s||s.scope!==scope||s.actorId!=='chiikawa')return {safe:false};
  return {...s,mount:e,enabled:u?.enabled===true,documentHidden:s.documentHidden!==false||u?.documentHidden!==false,inputBusy:s.inputBusy!==false||u?.inputBusy!==false,mediaBusy:s.mediaBusy!==false||u?.mediaBusy!==false,composing:s.composing!==false||u?.composing!==false};
 }
 function acquire(expected){
  if(disposed||held||getEngine()!==expected.mount||owner()!==null)return null;
  const fresh=read(null);
  if(fresh.safe!==true||fresh.enabled!==true||fresh.visible!==true||fresh.paused!==false||fresh.reduced!==false||fresh.documentHidden!==false||fresh.inputBusy!==false||fresh.studyBusy!==false||fresh.captured!==false||fresh.physical!==false||fresh.composing!==false||fresh.mediaBusy!==false||fresh.scope!==expected.scope||fresh.key!==expected.key||fresh.revision!==expected.revision||fresh.geometryEpoch!==expected.geometryEpoch)return null;
  const e=getEngine(),token=e.tryAcquireContinuousWalk(fresh);
  if(token===null||token===undefined||token===false)return null;
  if(disposed||e!==getEngine()||e.ownsContinuousWalk(token)!==true){e.releaseContinuousWalk(token,'acquire-race');return null;}
  held={engine:e,token};return token;
 }
 function present(token,pose){return !!held&&held.token===token&&getEngine()===held.engine&&held.engine.ownsContinuousWalk(token)===true&&held.engine.presentContinuousWalk(token,pose)===true;}
 function release(token,reason){if(!held||held.token!==token)return false;const old=held;held=null;return old.engine.releaseContinuousWalk(token,reason);}
 return{owner,read,acquire,present,release,destroy(){disposed=true;if(held)release(held.token,'adapter-destroyed');}};
}
/** Cancel immediately, never auto-restart. Host engine must independently enforce priority. */
export function bindContinuousWalkCancellation({controller,window,document,controls}){
 const removers=[];
 const listen=(el,type,fn,opts)=>{el?.addEventListener(type,fn,opts);removers.push(()=>el?.removeEventListener(type,fn,opts));};
 for(const type of ['pointerdown','keydown','beforeinput','compositionstart','play','vocab:busy']){
  listen(document,type,event=>{if(type==='pointerdown'&&controls?.contains(event.target))return;controller.stop(type);},true);
 }
 for(const type of ['resize','scroll','pagehide'])listen(window,type,()=>controller.stop(type),{capture:true,passive:true});
 listen(window,'blur',event=>{if(event.target===window)controller.stop('blur');},{capture:true,passive:true});
 listen(document,'visibilitychange',()=>controller.stop('visibility'),true);
 for(const type of ['resize','scroll'])listen(window?.visualViewport,type,()=>controller.stop('visual-viewport-'+type),{passive:true});
 return ()=>{for(const remove of removers)remove();controller.stop('unbind');};
}
