/* Same-tab, same-directory, one-use document handoff. Never stores preferences. */
(() => {
  'use strict';
  const continuationKey='cv-study-continuation-v1';
  const key='cv-page-handoff-v1', studyKey='jlpt-local-vocabulary-v1';
  const allowed=new Set(['index.html','character-settings.html','word-selection.html','study.html','unknown-words.html','study-records.html']);
  const current=new URL(location.href), directory=new URL('.',current).pathname;
  const kind=performance.getEntriesByType?.('navigation')?.[0]?.type||'navigate';
  let carried=null, studyReader=null, kaniReader=null, navigationPending=false;const leaveHooks=[];
  const stored=()=>{try{return {ok:true,value:localStorage.getItem(studyKey)};}catch{return {ok:false,value:null};}};
  const latest=state=>{if(!state)return null;const now=stored();return state.unsaved?(!now.ok||now.value===state.fingerprint?state:null):(now.ok&&now.value===state.fingerprint?state:null);};
  const token=current.searchParams.get('_cvnav');
  try {
    const raw=sessionStorage.getItem(key);sessionStorage.removeItem(key);
    if(raw&&token&&kind!=='reload'&&kind!=='back_forward'){
      const value=JSON.parse(raw);
      if(value?.version===1&&value.nonce===token&&value.to===current.pathname&&Date.now()-value.created>=0&&Date.now()-value.created<120000){carried={study:value.study?.unsaved?value.study:latest(value.study),kani:value.kani===true};}
    }
  }catch{}
  if(token){current.searchParams.delete('_cvnav');history.replaceState(history.state,'',current);}
  if(kind==='back_forward'&&history.state?.cvPageState?.version===1)carried={study:history.state.cvPageState.study?.unsaved?history.state.cvPageState.study:latest(history.state.cvPageState.study),kani:false};
  if(!carried?.study){try{const saved=JSON.parse(sessionStorage.getItem(continuationKey)||'null');if(saved?.version===1&&saved.directory===directory&&Date.now()-saved.created<86400000){const valid=latest(saved.study);if(valid)carried={study:valid,kani:false};}}catch{}}
  const message=(text,recovery)=>{const node=document.getElementById('navigation-status');if(node){node.textContent=text;node.focus?.();if(recovery){const button=document.createElement('button');button.type='button';button.textContent='저장되지 않은 현재 창 기록 백업';button.addEventListener('click',()=>{
    let url;try{url=URL.createObjectURL(new Blob([JSON.stringify({format:'chiikawa-study-record',version:1,dataset:'sha256:2112bf91d9ec0eac1f5212c30e89171a639ac4b156a0a92403b75c4b18df3c5e',state:recovery},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='chiikawa-study-record-unsaved.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch{message('파일을 저장하지 못했습니다. 현재 창은 닫지 말아 주세요.');}
  });node.appendChild(button);}}else window.alert(text);};
  function snapshot(){const rawStudy=studyReader?studyReader():carried?.study,study=latest(rawStudy);return {study,recovery:rawStudy?.unsaved?rawStudy.state:null,conflict:!!rawStudy?.unsaved&&!study,kani:kaniReader?kaniReader()===true:carried?.kani===true};}
  function historySnapshot(){const state=snapshot(),raw=studyReader?studyReader():carried?.study;try{if(state.study&&!state.study.unsaved)sessionStorage.setItem(continuationKey,JSON.stringify({version:1,directory,created:Date.now(),study:state.study}));else if(!state.study)sessionStorage.removeItem(continuationKey);}catch{}try{history.replaceState({...history.state,cvPageState:{version:1,study:raw?.unsaved?raw:state.study}},'',location.href);}catch{}}
  function go(href,{replace=false,restoreStudy=true}={}){
    if(navigationPending)return false;
    const url=new URL(href,location.href);
    if(url.origin!==location.origin||new URL('.',url).pathname!==directory||!allowed.has(url.pathname.split('/').pop()))return false;
    const state=snapshot();if(state.conflict){message('다른 창에서 학습 기록이 바뀌었습니다. 저장되지 않은 현재 창의 기록을 보호하기 위해 이동을 멈췄습니다. 먼저 현재 창 기록을 백업해 주세요.',state.recovery);return false;}if(!restoreStudy&&state.study)state.study={...state.study,transient:null};
    if(url.pathname.endsWith('/index.html')&&state.study?.transient)state.study={...state.study,transient:{...state.study.transient,lastAnswer:null}};
    const nonce=typeof crypto?.randomUUID==='function'?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2);
    let transferred=false;
    try{sessionStorage.setItem(key,JSON.stringify({version:1,to:url.pathname,nonce,created:Date.now(),study:state.study,kani:state.kani}));transferred=true;}catch{}
    if(!transferred&&state.study?.unsaved){message('브라우저 저장이 차단되어 페이지를 이동하면 현재 학습 기록이 사라집니다. 이 화면에서 계속 공부하거나 학습 기록을 백업해 주세요.',state.recovery);return false;}
    if(transferred)url.searchParams.set('_cvnav',nonce);
    for(const hook of leaveHooks)hook(url);historySnapshot();navigationPending=true;
    if(replace)location.replace(url.href);else location.assign(url.href);
    return true;
  }
  document.addEventListener('click',event=>{
    const a=event.target.closest?.('a[data-cv-link]');
    if(!a||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||a.hasAttribute('download')||(a.target&&a.target!=='_self'))return;
    event.preventDefault();go(a.href);
  });
  window.addEventListener('pagehide',historySnapshot);
  // BFCache DOM contains old preferences. Re-enter once with fresh storage and only
  // a fingerprint-matched study continuation; character transients stay OFF.
  window.addEventListener('pageshow',event=>{if(event.persisted){navigationPending=false;const raw=studyReader?studyReader():carried?.study;carried={study:raw?.unsaved?raw:latest(raw),kani:false};kaniReader=()=>false;go(location.href,{replace:true});}});
  window.CVPage={page:document.body.dataset.page,get incoming(){return carried;},go,stored,
    beforeNavigate(fn){leaveHooks.push(fn);},registerStudy(reader){studyReader=reader;},registerKani(reader){kaniReader=reader;},
    clearStudy(){carried={...carried,study:null};try{sessionStorage.removeItem(continuationKey);}catch{}},message,
    get navigating(){return navigationPending;}
  };
})();
