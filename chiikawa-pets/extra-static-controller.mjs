// Static-only rail. Does not participate in the six-actor action engine.
export function decodeStaticExtraImage(asset,{signal,ImageCtor=Image,setTimeoutFn=setTimeout,clearTimeoutFn=clearTimeout}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(Error('aborted'));return;}
  const image=new ImageCtor();let done=false,timer=null;
  const dispose=()=>image.removeAttribute('src');
  const finish=error=>{if(done)return;done=true;clearTimeoutFn(timer);signal?.removeEventListener('abort',abort);if(error){dispose();reject(error);}else resolve({source:asset.source,dispose});};
  const abort=()=>finish(Error('aborted'));signal?.addEventListener('abort',abort,{once:true});timer=setTimeoutFn(()=>finish(Error('timeout')),8000);
  try{image.src=asset.source;Promise.resolve(image.decode()).then(()=>{if(signal?.aborted||image.naturalWidth!==asset.nativeSize[0]||image.naturalHeight!==asset.nativeSize[1])finish(Error('decode'));else finish();},()=>finish(Error('decode')));}catch(e){finish(e);}
 });
}
export function createStaticExtraController({store,id,asset,decode,paint,clear,isOpen,geometrySafe,status,readyLabel='쿠리만쥬 정지 표시 · 컵 보유 자세 / 움직임 없음'}){
 let generation=0,abort=null,resource=null,phase='off',disposed=false,updating=false;
 const release=r=>{try{r?.dispose?.();}catch{}};
 const gate=(decoded,geometry)=>{const current=store.snapshot().actors[id];updating=true;try{store.updateEligibility(id,{sourceApproved:current?.sourceApproved===true,artApproved:current?.artApproved===true,staticDisplay:current?.staticDisplay===true,decoded,geometrySafe:geometry});}finally{updating=false;}};
 function stop(label='꺼짐'){
  generation++;abort?.abort();abort=null;const old=resource;resource=null;phase='off';clear();release(old);gate(false,false);status(label);
 }
 function render(){
  let safe=false;try{safe=geometrySafe()===true;}catch{}
  phase='ready';gate(true,safe);
  const current=store.snapshot().actors[id];if(!current?.requested||!current.eligible||!isOpen()){stop('꺼짐');return;}
  if(safe&&current.effective){paint(resource);status(readyLabel);}
  else{clear();status('표시 공간이 부족해 잠시 숨김 · 선택은 유지');}
 }
 function sync(){
  if(disposed||updating)return;
  const actor=store.snapshot().actors[id];
  if(!actor?.requested||!actor.eligible||!isOpen()){
   if(phase!=='off'||resource||abort)stop(actor?.requested?'접힌 패널 · 선택은 유지':'꺼짐');
   return;
  }
  if(resource){render();return;}
  if(phase==='loading'||phase==='error')return;
  phase='loading';clear();gate(false,false);status('정지 그림을 불러오는 중');
  const token=++generation;abort=new AbortController();const signal=abort.signal;
  Promise.resolve().then(()=>{if(disposed||token!==generation)return null;return decode(asset,{signal});}).then(value=>{
   if(disposed||token!==generation){release(value);return;}
   abort=null;
   const actor=store.snapshot().actors[id];if(!actor?.requested||!actor.eligible||!isOpen()){release(value);stop('숨김 · 현재 선택 유지');return;}
   if(!value?.source||value.source!==asset.source){release(value);throw Error('invalid-source');}
   resource=value;render();
  }).catch(()=>{
   if(disposed||token!==generation)return;abort=null;phase='error';clear();release(resource);resource=null;gate(false,false);status('그림을 불러오지 못해 숨김 · 다시 끄고 켜면 재시도');
  });
 }
 const unsubscribe=store.subscribe(sync);sync();
 return {revalidate:sync,getState:()=>({phase,generation}),destroy(){if(disposed)return;disposed=true;unsubscribe();stop('꺼짐');}};
}
