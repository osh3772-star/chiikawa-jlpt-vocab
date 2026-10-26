/** Explicit review-only frame source for a normal actor's finite action.
 * The engine owns position, swept paint, leases, lifecycle and all user input.
 */
import {CANDIDATE_REGISTRY,getCandidateFrame,candidatePlanFits} from './candidate-presenter.mjs';
export function createCandidateActionSource({enabled=false,characters=[],assetBaseURL,fetchBytes=async url=>{const r=await fetch(url);if(!r.ok)throw Error('candidate-http');return new Uint8Array(await r.arrayBuffer());},decodeImage=async url=>{const im=new Image();im.src=url;await im.decode();if(im.naturalWidth!==1254||im.naturalHeight!==1254)throw Error('candidate-dimensions');},digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('')}={}){
 const selected=new Set(enabled===true?characters.filter(id=>Object.hasOwn(CANDIDATE_REGISTRY,id)):[]),ready=new Set();
 let pending=null,disposed=false,error=null;
 const reference={x:0,y:0,width:390,height:520},referencePaint={left:0,top:0,right:390,bottom:520,width:390,height:520};
 const metadata=(id,index)=>getCandidateFrame(id,index,{id,...reference},{assetBaseURL,originalPaintBounds:referencePaint});
 async function prepare(){
  if(disposed||!selected.size)return false;
  if(pending)return pending;
  pending=(async()=>{try{
   for(const id of selected){
    const plans=Array.from({length:8},(_,index)=>metadata(id,index));if(plans.some(p=>!p))throw Error('candidate-registration');
    await Promise.all(plans.map(async plan=>{const bytes=await fetchBytes(plan.url);if(disposed)throw Error('candidate-disposed');if(bytes.byteLength!==plan.bytes||await digest(bytes)!==plan.sha256)throw Error('candidate-byte-identity');await decodeImage(plan.url);}));
    if(!disposed)ready.add(id);
   }
   return !disposed;
  }catch(e){ready.clear();error=e?.message||'candidate-prepare';return false;}})();
  return pending;
 }
 return{
  prepare,has:id=>!disposed&&ready.has(id),selected:id=>selected.has(id),
  sequence(id){if(disposed||!ready.has(id))return null;return{candidate:true,characterId:id,loop:false,rootDistance:0,frames:Array.from({length:8},(_,index)=>({frameId:'candidate-step-'+String(index+1).padStart(2,'0'),source:metadata(id,index).url,durationMs:120,index}))};},
  plan(id,index,actor,originalPaintBounds){if(disposed||!ready.has(id))return null;return getCandidateFrame(id,index,actor,{assetBaseURL,originalPaintBounds});},
  fits: candidatePlanFits,
  getState:()=>({enabled:selected.size>0,ready:[...ready],disposed,error}),
  destroy(){disposed=true;ready.clear();}
 };
}
