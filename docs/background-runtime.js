(()=>{
/** DOM-free preference state machine. Asset authenticity is a build-time gate. */
const BACKGROUND_STORAGE_KEY = 'cv-background-v1';
const FIELD_DIMENSIONS = Object.freeze({ width: 1536, height: 1024 });
const validSelection = value => value === 'original' || value === 'field-ep6' || value === 'stone-ep2' || value === 'meadow-evening-creative';

function createBackgroundController({ storage, decode, apply, restore } = {}) {
  if (![decode, apply, restore].every(fn => typeof fn === 'function')) {
    throw new TypeError('decode, apply and restore adapters are required');
  }
  let generation = 0, pending = null, resource = null, destroyed = false;
  const listeners = new Set();
  let state = Object.freeze({ requested: 'original', active: null, status: 'original', error: null, persistence: 'unavailable' });
  const getState = () => state;
  const update = patch => {
    state = Object.freeze({ ...state, ...patch });
    for (const listener of [...listeners]) {
      try { listener(state); } catch { /* Observers cannot break selection. */ }
    }
  };
  const release = item => { try { item?.dispose?.(); } catch { /* Best-effort resource release. */ } };
  const restoreOriginal = () => {
    try { restore(); return true; } catch { return false; }
  };
  const transition = (selection, persist) => {
    if (!validSelection(selection)) throw new TypeError('Unknown background selection');
    if (destroyed) return Promise.resolve(state);
    const token = ++generation;
    pending?.abort(); pending = null;
    const old = resource; resource = null;
    const restored = restoreOriginal();
    release(old);
    let persistence = state.persistence;
    if (persist) {
      try { storage.setItem(BACKGROUND_STORAGE_KEY, selection); persistence = 'saved'; }
      catch { persistence = 'unavailable'; }
    }
    update({ requested: selection, active: restored ? 'original' : null,
      status: !restored ? 'error' : selection === 'original' ? 'original' : 'loading',
      error: restored ? null : 'restore-failed', persistence });
    if (!restored || selection === 'original' || destroyed || token !== generation) return Promise.resolve(state);
    const abort = new AbortController(); pending = abort;
    // A microtask boundary permits selection/destroy to cancel before decode starts.
    return Promise.resolve().then(() => {
      if (destroyed || token !== generation) return null;
      return decode(selection, { signal: abort.signal, generation: token });
    }).then(decoded => {
      if (destroyed || token !== generation) { release(decoded); return state; }
      pending = null;
      if (!decoded || decoded.decoded !== true || decoded.width !== FIELD_DIMENSIONS.width || decoded.height !== FIELD_DIMENSIONS.height) {
        release(decoded);
        throw new Error('invalid-decoded-asset');
      }
      try { apply(decoded, selection); }
      catch { release(decoded); throw new Error('apply-failed'); }
      if (destroyed || token !== generation) { release(decoded); return state; }
      resource = decoded;
      update({ active: selection, status: 'ready', error: null });
      return state;
    }).catch(error => {
      if (destroyed || token !== generation) return state;
      pending = null;
      const restored = restoreOriginal();
      const code = ['invalid-decoded-asset', 'apply-failed'].includes(error?.message) ? error.message : 'decode-failed';
      update({ active: restored ? 'original' : null, status: 'error', error: restored ? code : 'restore-failed' });
      return state;
    });
  };
  let initial = 'original', persistence = 'unavailable';
  try {
    const saved = storage.getItem(BACKGROUND_STORAGE_KEY);
    if (validSelection(saved)) { initial = saved; persistence = 'saved'; }
    else persistence = 'not-saved';
  } catch { /* Default remains original; never access other storage keys. */ }
  state = Object.freeze({ ...state, persistence });
  transition(initial, false);
  return Object.freeze({
    setSelection: selection => transition(selection, true),
    getState,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Listener must be a function');
      if (destroyed) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; ++generation; pending?.abort(); pending = null;
      const restored = restoreOriginal();
      release(resource); resource = null;
      update({ active: restored ? 'original' : null, status: 'destroyed', error: restored ? null : 'restore-failed' });
      listeners.clear();
    }
  });
}

// Decoration only. Never reads/writes study state, actors, scroll or layout dimensions.
function createBackgroundDomAdapter({body,scenery,assets,ImageCtor=Image,setTimeoutFn=setTimeout,clearTimeoutFn=clearTimeout}) {
  const originalImage=scenery.style.getPropertyValue('background-image');
  const originalPriority=scenery.style.getPropertyPriority('background-image');
  const originalClass=body.classList.contains('cv-field-background');
  function restore(){
    if(originalImage)scenery.style.setProperty('background-image',originalImage,originalPriority);
    else scenery.style.removeProperty('background-image');
    body.classList.toggle('cv-field-background',originalClass);
  }
  function decode(selection,{signal}={}){
    return new Promise((resolve,reject)=>{
      const asset=assets?.[selection];
      if(!['field-ep6','stone-ep2','meadow-evening-creative'].includes(selection)||!asset?.source||signal?.aborted){reject(Error('background-unavailable'));return;}
      const img=new ImageCtor();let settled=false,timer=null;
      const dispose=()=>img.removeAttribute('src');
      const finish=(error)=>{
        if(settled)return;settled=true;clearTimeoutFn(timer);signal?.removeEventListener('abort',abort);
        if(error){dispose();reject(error);}else resolve({decoded:true,width:img.naturalWidth,height:img.naturalHeight,source:asset.source,dispose});
      };
      const abort=()=>finish(Error('background-aborted'));
      signal?.addEventListener('abort',abort,{once:true});
      timer=setTimeoutFn(()=>finish(Error('background-timeout')),8000);
      try{img.src=asset.source;Promise.resolve(img.decode()).then(()=>{
        if(signal?.aborted||img.naturalWidth!==asset.width||img.naturalHeight!==asset.height)finish(Error('background-decode'));
        else finish();
      },()=>finish(Error('background-decode')));}catch(error){finish(error);}
    });
  }
  function apply(decoded,selection){
    const asset=assets?.[selection];
    if(!['field-ep6','stone-ep2','meadow-evening-creative'].includes(selection)||!asset?.source||decoded?.decoded!==true||decoded.source!==asset.source||decoded.width!==1536||decoded.height!==1024)throw Error('background-invalid');
    scenery.style.setProperty('background-image',`url(${JSON.stringify(decoded.source)})`);
    body.classList.add('cv-field-background');
  }
  return {decode,apply,restore};
}


const assets={"field-ep6":{"id":"field-ep6","source":"assets/backgrounds/9d7117622ec9cf13a63a13538a40e7a9b7918ec29a21c0d3339be58f292340c3.png","sha256":"9d7117622ec9cf13a63a13538a40e7a9b7918ec29a21c0d3339be58f292340c3","width":1536,"height":1024,"label":"EP6 풀밭 모티프 · 참고 창작"},"stone-ep2":{"id":"stone-ep2","source":"assets/backgrounds/54914ae889f3da2f082351bb66d2bb323e977d10efd9d5feb35ccf358a203d5c.png","sha256":"54914ae889f3da2f082351bb66d2bb323e977d10efd9d5feb35ccf358a203d5c","width":1536,"height":1024,"label":"EP2 석조 벽 모티프 · 장소 미확정"},"meadow-evening-creative":{"id":"meadow-evening-creative","source":"assets/backgrounds/ed635427a04043d894e7dc8facdef993394142df9936b443107cb5629fd2ef74.png","sha256":"ed635427a04043d894e7dc8facdef993394142df9936b443107cb5629fd2ef74","width":1536,"height":1024,"label":"저녁 풀밭 · 창작 배경"}};
const scenery=document.querySelector('.scenery');if(!scenery)return;
let storage=null;try{storage=window.localStorage;}catch{}
const adapter=createBackgroundDomAdapter({body:document.body,scenery,assets});
const controller=createBackgroundController({storage,...adapter});
const choice=document.getElementById('background-choice'),status=document.getElementById('background-status');
const render=state=>{
 if(choice)choice.value=state.requested;
 if(status)status.textContent=state.status==='loading'?'배경을 불러오는 중 · 기존 배경 유지':state.error?'배경을 불러오지 못해 기존 배경으로 표시':assets[state.active]?assets[state.active].label+' · 정적 장식': '기존 배경 · 기본값';
 if(status&&state.persistence==='unavailable')status.textContent+=' · 설정 저장 불가';
};
controller.subscribe(render);render(controller.getState());
choice?.addEventListener('change',()=>controller.setSelection(choice.value));
// Reads/writes cv-background-v1 only. No time-of-day selection, study state,
// actor creation, motion preference or navigation hooks.

})();
