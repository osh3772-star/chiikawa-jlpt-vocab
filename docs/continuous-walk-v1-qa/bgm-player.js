if(window.__CV_QA_LOCAL_READY__!==true||window.__CV_QA_SESSION_READY__!==true)throw Error('QA dual storage isolation required');
/* Local MP3 player. No upload, remote source, file-byte persistence or autoplay.
 * The controller owns one media element/object URL at a time. */
(function(root){
  'use strict';
  const PREFERENCES_KEY='cv-bgm-preferences-v1';
  const defaults=()=>({version:1,volume:0.5,repeat:'off'});
  function normalizePreferences(value){
    const result=defaults();
    if(!value||value.version!==1)return result;
    if(typeof value.volume==='number'&&Number.isFinite(value.volume)&&value.volume>=0&&value.volume<=1)result.volume=value.volume;
    if(['off','one','all'].includes(value.repeat))result.repeat=value.repeat;
    return result;
  }
  function createPlayer({createMedia,createURL,revokeURL,onChange=()=>{},preferences}={}){
    let files=[],index=-1,live=null,epoch=0,wanted=false,status='empty',message='MP3 파일을 선택해 주세요.',prefs=normalizePreferences(preferences);
    const state=()=>({tracks:files.map(file=>file.name),index,status,message,preferences:{...prefs}});
    const notify=()=>onChange(state());
    const safePause=media=>{try{media.pause();}catch{}};
    function release(){
      ++epoch;wanted=false;
      const old=live;live=null;
      if(!old)return;
      for(const [type,fn] of old.listeners)old.media.removeEventListener(type,fn);
      safePause(old.media);
      try{old.media.removeAttribute('src');old.media.load();}catch{}
      try{revokeURL(old.url);}catch{}
    }
    function failure(text){++epoch;wanted=false;status='error';message=text;if(live)safePause(live.media);notify();}
    function resetTime(){if(!live)return;try{live.media.currentTime=0;live.resetPending=false;}catch{live.resetPending=true;}}
    function play(){
      if(!live||!files.length)return;
      if(wanted&&(status==='playing'||status==='pending'))return;
      const item=live,command=++epoch;wanted=true;status='pending';message='재생을 준비하고 있어요.';notify();
      let result;
      if(item.resetPending)resetTime();
      try{result=item.media.play();}catch(error){failed(error);return;}
      Promise.resolve(result).then(()=>{
        if(live!==item){safePause(item.media);return;}
        if(command!==epoch){if(!wanted)safePause(item.media);return;}
        if(!wanted){safePause(item.media);return;}
        status='playing';message='재생 중';notify();
      },failed);
      function failed(error){
        if(live!==item||command!==epoch)return;
        failure(error?.name==='NotAllowedError'?'브라우저가 재생을 막았습니다. 재생 버튼을 다시 눌러 주세요.':'이 MP3를 재생할 수 없습니다. 다른 곡을 선택하거나 파일을 다시 선택해 주세요.');
      }
    }
    function activate(next,autoplay=false){
      if(!Number.isInteger(next)||next<0||next>=files.length)return false;
      release();index=next;status='ready';message='선택한 곡을 재생할 수 있어요.';
      let url,media;
      try{
        url=createURL(files[index]);media=createMedia();
        const item={media,url,listeners:[],resetPending:false};live=item;
        const listen=(type,fn)=>{const guarded=()=>{if(live===item)fn();};item.listeners.push([type,guarded]);media.addEventListener(type,guarded);};
        media.autoplay=false;media.loop=false;media.preload='metadata';media.volume=prefs.volume;
        listen('loadedmetadata',()=>{if(item.resetPending)resetTime();});
        listen('playing',()=>{if(!wanted){safePause(media);return;}status='playing';message='재생 중';notify();});
        listen('pause',()=>{if(wanted&&media.paused&&!media.ended){++epoch;wanted=false;status='paused';message='일시정지';notify();}});
        listen('error',()=>failure('파일을 읽거나 MP3를 해석하지 못했습니다. 다른 곡을 선택하거나 파일을 다시 선택해 주세요.'));
        listen('ended',()=>{
          if(!wanted||!media.ended)return;
          const next=prefs.repeat==='one'?index:index+1<files.length?index+1:prefs.repeat==='all'?0:-1;
          if(next>=0)activate(next,true);else stop('목록 재생이 끝났어요.');
        });
        media.src=url;
      }catch{
        if(live)release();else if(url)try{revokeURL(url);}catch{}
        status='error';message='이 브라우저에서 로컬 MP3를 열지 못했습니다. 파일을 다시 선택해 주세요.';notify();return false;
      }
      notify();if(autoplay)play();return true;
    }
    function choose(selected){
      const candidates=Array.from(selected||[]);
      if(!candidates.length)return false; // File-picker cancel preserves playback.
      const accepted=candidates.filter(file=>file&&typeof file.name==='string'&&/\.mp3$/i.test(file.name)&&Number.isFinite(file.size)&&file.size>0);
      if(!accepted.length){message='비어 있지 않은 .mp3 파일을 선택해 주세요. 기존 목록은 유지됩니다.';notify();return false;}
      release();files=accepted;index=-1;activate(0,false);
      if(accepted.length!==candidates.length){message='MP3 '+accepted.length+'곡을 선택했어요. 비어 있거나 MP3가 아닌 파일은 제외했습니다.';notify();}
      return true;
    }
    function pause(){if(!live)return;++epoch;wanted=false;safePause(live.media);status='paused';message='일시정지';notify();}
    function stop(text='정지 · 처음부터 다시 재생할 수 있어요.'){
      if(!live)return;++epoch;wanted=false;safePause(live.media);resetTime();status='stopped';message=text;notify();
    }
    function select(next){const autoplay=wanted;if(next===index)return true;return activate(Number(next),autoplay);}
    function step(delta){if(!files.length)return;activate((index+delta+files.length)%files.length,wanted);}
    function clear(text='선택한 파일을 해제했어요. MP3 파일을 다시 선택해 주세요.'){
      release();files=[];index=-1;status='empty';message=text;notify();
    }
    function setPreferences(value){prefs=normalizePreferences(value);if(live)try{live.media.volume=prefs.volume;}catch{}notify();}
    return {state,choose,play,pause,stop,select,next:()=>step(1),previous:()=>step(-1),clear,setPreferences};
  }
  function mount(){
    const document=root.document,panel=document.getElementById('bgm-player');
    if(!panel||panel.dataset.initialized==='true')return;
    panel.dataset.initialized='true';
    const ids=['files','track','play','stop','prev','next','volume','volume-value','repeat','clear','status','preferences-status'];
    const el=Object.fromEntries(ids.map(id=>[id,document.getElementById('bgm-'+id)]));
    let preferences=defaults(),renderedNames=[],player;
    function storageNotice(text){el['preferences-status'].textContent=text;}
    try{const raw=root.localStorage.getItem(PREFERENCES_KEY);if(raw!==null)preferences=normalizePreferences(JSON.parse(raw));}
    catch{storageNotice('음량·반복 설정을 읽지 못했습니다. 이 페이지에서는 사용할 수 있어요.');}
    function render(value){
      if(value.tracks.length!==renderedNames.length||value.tracks.some((name,i)=>name!==renderedNames[i])){
        el.track.replaceChildren();
        value.tracks.forEach((name,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=(i+1)+'. '+name;el.track.appendChild(option);});
        if(!value.tracks.length){const option=document.createElement('option');option.value='';option.textContent='선택한 곡 없음';el.track.appendChild(option);}
        renderedNames=value.tracks.slice();
      }
      el.track.value=value.index<0?'':String(value.index);
      const empty=value.index<0;
      for(const name of ['track','play','stop','prev','next','clear'])el[name].disabled=empty;
      const active=value.status==='pending'||value.status==='playing';
      el.play.textContent=active?'일시정지':'재생';el.play.setAttribute('aria-label',active?'음악 일시정지':'음악 재생');
      el.play.setAttribute('aria-pressed',String(active));
      el.volume.value=String(Math.round(value.preferences.volume*100));el['volume-value'].textContent=el.volume.value+'%';el.repeat.value=value.preferences.repeat;
      el.status.textContent=value.message+(empty?'':' · '+(value.index+1)+' / '+value.tracks.length+'곡');
    }
    player=createPlayer({createMedia:()=>new root.Audio(),createURL:file=>root.URL.createObjectURL(file),revokeURL:url=>root.URL.revokeObjectURL(url),onChange:render,preferences});
    render(player.state());
    el.files.addEventListener('change',()=>{player.choose(el.files.files);el.files.value='';});
    el.play.addEventListener('click',()=>{['pending','playing'].includes(player.state().status)?player.pause():player.play();});
    el.stop.addEventListener('click',()=>player.stop());el.prev.addEventListener('click',()=>player.previous());el.next.addEventListener('click',()=>player.next());
    el.track.addEventListener('change',()=>player.select(Number(el.track.value)));el.clear.addEventListener('click',()=>{player.clear();el.files.value='';});
    function savePreferences(){
      const next=normalizePreferences({version:1,volume:Number(el.volume.value)/100,repeat:el.repeat.value});player.setPreferences(next);
      try{root.localStorage.setItem(PREFERENCES_KEY,JSON.stringify(next));storageNotice('음량·반복 설정만 이 브라우저에 저장됩니다.');}
      catch{storageNotice('설정 저장이 차단되었습니다. 음량·반복은 현재 페이지에서만 유지됩니다.');}
    }
    el.volume.addEventListener('input',savePreferences);el.repeat.addEventListener('change',savePreferences);
    root.addEventListener('storage',event=>{if(event.key!==PREFERENCES_KEY&&event.key!==null)return;try{const raw=root.localStorage.getItem(PREFERENCES_KEY);player.setPreferences(raw?JSON.parse(raw):defaults());storageNotice('다른 페이지의 음량·반복 설정을 반영했습니다.');}catch{storageNotice('다른 페이지의 설정을 읽지 못해 현재 값을 유지합니다.');}});
    const cleanup=()=>{player.clear('페이지를 이동하거나 새로고침한 뒤에는 MP3 파일을 다시 선택해 주세요.');el.files.value='';};
    root.CVPage?.beforeNavigate(cleanup);root.addEventListener('pagehide',cleanup);
  }
  if(typeof module==='object'&&module.exports)module.exports={createPlayer,normalizePreferences,PREFERENCES_KEY};
  if(root?.document)mount();
})(typeof window==='object'?window:null);
