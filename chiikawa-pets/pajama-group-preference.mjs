/** One baked four-member static group, not four separate engine actors. */
export const PAJAMA_GROUP_KEY='cv-pajama-group-v1';
export const PAJAMA_GROUP_ID='pajama-parties';
export function createPajamaGroupPreference({storage=null,approved=false}={}){
 let requested=false,decoded=false,geometrySafe=false,disposed=false,persistence=storage?'clean':'unavailable';const listeners=new Set();
 try{const raw=storage?.getItem(PAJAMA_GROUP_KEY);if(raw!=null){const v=JSON.parse(raw);if(approved&&v?.schemaVersion===1&&v.groupId===PAJAMA_GROUP_ID&&typeof v.requested==='boolean')requested=v.requested;}}catch{persistence='unavailable';}
 const snapshot=()=>({actors:{[PAJAMA_GROUP_ID]:{requested,sourceApproved:approved,artApproved:approved,staticDisplay:approved,decoded,geometrySafe,eligible:approved,effective:approved&&requested&&decoded&&geometrySafe}},persistence});
 const notify=()=>{for(const fn of [...listeners]){if(disposed)break;try{fn(snapshot());}catch{}}};
 return{snapshot,subscribe(fn){if(disposed)return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},setVisible(id,value){if(disposed||id!==PAJAMA_GROUP_ID||typeof value!=='boolean'||(value&&!approved))return false;if(requested===value)return true;requested=value;try{storage?.setItem(PAJAMA_GROUP_KEY,JSON.stringify({schemaVersion:1,groupId:PAJAMA_GROUP_ID,requested}));persistence=storage?'saved':'unavailable';}catch{persistence='not-saved';}notify();return true;},updateEligibility(id,v){if(disposed||id!==PAJAMA_GROUP_ID)return;decoded=v.decoded===true;geometrySafe=v.geometrySafe===true;notify();},destroy(){disposed=true;listeners.clear();}};
}
