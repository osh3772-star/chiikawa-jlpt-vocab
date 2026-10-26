/** Local opt-in UI mapping, not autonomous or canonical motion activation. */
export function directCarryRegistration(asset){
 const counts={'chiikawa-carry-step':3,'chiikawa-carry-smooth':7,'chiikawa-carry-cycle':12};if(!counts[asset?.fragmentId]||asset.frames?.length!==counts[asset.fragmentId])return null;
 // Fixed common display normalization, never fit individual feet or silhouettes.
 const factor=(302*126/390)/120,center=80+(186-195)*126/390,top=44+115*126/390-52;
 return {...asset,frames:asset.frames.map(f=>({...f,scale:f.scale*factor,left:(f.left-80)*factor+center,top:(f.top-8)*factor+top}))};
}
export function createDirectInteractionAdapter({characterId='chiikawa',getContext,getPlaybackState,start,focusTarget,onRejected=()=>{}}){
 function request(id,input){
  const c=getContext();if(id!==characterId||!c.enabled)return false;
  if(!input||!['keyboard','native-button','pointer-tap','pointer-click'].includes(input.kind)||(input.kind==='keyboard'&&!['Enter',' '].includes(input.key)))return false;
  if(input.kind==='pointer-tap'&&input.pointerType!=='touch')return false;
  if(input.kind==='pointer-click'&&input.pointerType!=='mouse')return false;
  // true means handled/consumed, including busy or unsafe requests; never leak into generic react.
  if(input.repeat===true)return true;
  if(getPlaybackState().mode!=='off')return true;
  if(!c.visible||!c.onScreen||c.physical||c.documentHidden){onRejected();return true;}
  focusTarget();const result=start();result?.catch?.(()=>onRejected());return true;
 }
 return{request};
}

export function directResponseProfiles(layouts,observed,hachiwareAsset,usagiAsset){
 const result={};if(layouts?.scope!=='LIMITED_EXPLICIT_DIRECT_UI_TESTING')return result;
 for(const[id,layout]of Object.entries(layouts.profiles??{})){
  let asset=null;
  if(['observed','hachiware-fullbody'].includes(layout.kind)){const source=observed[layout.sourceFragmentId];if(source)asset=layout.normalization==='CHI_BASE_COMMON'?directCarryRegistration(source):source;}
  if(layout.kind==='hachiware-packet'&&hachiwareAsset){asset={frames:hachiwareAsset.frames.map(f=>{const[x,y,w]=f.headRect,k=120/w*layout.factor;return{poseId:f.poseId,source:f.source,assetSize:f.assetSize,sourceRect:[0,0,...f.assetSize],scale:k,left:-x*k,top:-y*k};})};}
  if(layout.kind==='usagi-ab'&&usagiAsset){asset={frames:usagiAsset.frames.slice(0,2).map(f=>({...f,scale:f.scale*layout.factor,left:(f.left-layout.commonViewport[0])*layout.factor,top:(f.top-layout.commonViewport[1])*layout.factor}))};}
  if(asset)asset={...asset,fragmentId:layout.fragmentId,windowSize:[...layout.windowSize],testingAuthorized:layout.testingAuthorized,enabledByDefault:false,productionEnabled:false,motionActivation:false,timingOrigin:asset.timingOrigin??'AUTHORED_UI_POSE_RHYTHM',holdMs:layout.holdMs,loop:false,interpolation:false};
  result[id]={layout,asset};
 }
 return result;
}
