/** Display-only percentages, never official character height or anatomical ratio. */
const DISPLAY_SCALE_IDS = ['chiikawa','hachiware','usagi','shisa','momonga','rakko'];
export function validDisplayPercent(value){return typeof value==='number'&&Number.isFinite(value)&&value>=75&&value<=100&&value%5===0;}
export function normalizeDisplayScale(value){
 const result={schemaVersion:1,globalPercent:100,overrides:{}};
 if(!value||typeof value!=='object'||Array.isArray(value)||value.schemaVersion!==1)return result;
 if(validDisplayPercent(value.globalPercent))result.globalPercent=value.globalPercent;
 const overrides=value.overrides;
 if(overrides&&typeof overrides==='object'&&!Array.isArray(overrides))for(const id of DISPLAY_SCALE_IDS)if(Object.prototype.hasOwnProperty.call(overrides,id)&&validDisplayPercent(overrides[id]))result.overrides[id]=overrides[id];
 return result;
}
export function effectiveDisplayPercent(value,id){const p=normalizeDisplayScale(value);return p.overrides[id]??p.globalPercent;}
export function displayScaleMap(value){const p=normalizeDisplayScale(value);return Object.fromEntries(DISPLAY_SCALE_IDS.map(id=>[id,p.overrides[id]??p.globalPercent]));}
export function readDisplayScale(storage,key='jlpt-pet-display-scale-v1'){try{return normalizeDisplayScale(JSON.parse(storage.getItem(key)));}catch(_){return normalizeDisplayScale(null);}}
export function writeDisplayScale(storage,value,key='jlpt-pet-display-scale-v1'){const normalized=normalizeDisplayScale(value);try{storage.setItem(key,JSON.stringify(normalized));return{saved:true,value:normalized};}catch(_){return{saved:false,value:normalized};}}
