/* Approved same-site playlist only. No local file access, upload or autoplay. */
(function(root){
  'use strict';
  const PREFERENCES_KEY='cv-bgm-preferences-v1';
  const TRACK_KEY='cv-bgm-selected-track-v1';
  // Fixed same-origin repository root: QA subdirectories share the verified asset.
  const SITE_ROOT='/chiikawa-jlpt-vocab/';
  const defaults=()=>({version:1,volume:1,repeat:'off'});
  function normalizePreferences(value){
    const result=defaults();
    if(!value||value.version!==1)return result;
    if(['off','one','all'].includes(value.repeat))result.repeat=value.repeat;
    return result;
  }
  function createPlayer({createMedia,onChange=()=>{},preferences}={}){
    let files=[],index=-1,live=null,epoch=0,wanted=false,status='empty',message='등록된 곡이 없습니다. 음원 연결을 준비 중입니다.',prefs=normalizePreferences(preferences);
    const state=()=>({tracks:files.map(file=>file.title),index,status,message,preferences:{...prefs}});
    const notify=()=>onChange(state());
    const safePause=media=>{try{media.pause();}catch{}};
    function release(){
      ++epoch;wanted=false;
      const old=live;live=null;
      if(!old)return;
      for(const [type,fn] of old.listeners)old.media.removeEventListener(type,fn);
      safePause(old.media);
      try{old.media.removeAttribute('src');old.media.load();}catch{}
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
        failure(error?.name==='NotAllowedError'?'브라우저가 재생을 막았습니다. 재생 버튼을 다시 눌러 주세요.':'이 MP3를 재생할 수 없습니다. 다른 곡을 선택해 주세요.');
      }
    }
    function activate(next,autoplay=false){
      if(!Number.isInteger(next)||next<0||next>=files.length)return false;
      release();index=next;status='loading';message='곡 정보를 불러오는 중입니다. 재생은 버튼을 눌러 시작해 주세요.';
      let url,media;
      try{
        url=SITE_ROOT+files[index].src;media=createMedia();
        const item={media,url,listeners:[],resetPending:false};live=item;
        const listen=(type,fn)=>{const guarded=()=>{if(live===item)fn();};item.listeners.push([type,guarded]);media.addEventListener(type,guarded);};
        media.autoplay=false;media.loop=false;media.preload='metadata';media.volume=prefs.volume;
        listen('loadedmetadata',()=>{if(item.resetPending)resetTime();if(status==='loading'&&!wanted){status='ready';message='선택한 곡을 재생할 수 있어요.';notify();}});
        listen('playing',()=>{if(!wanted){safePause(media);return;}status='playing';message='재생 중';notify();});
        listen('pause',()=>{if(wanted&&media.paused&&!media.ended){++epoch;wanted=false;status='paused';message='일시정지';notify();}});
        listen('error',()=>failure('파일을 읽거나 MP3를 해석하지 못했습니다. 다른 곡을 선택해 주세요.'));
        listen('ended',()=>{
          if(!wanted||!media.ended)return;
          const next=prefs.repeat==='one'?index:index+1<files.length?index+1:prefs.repeat==='all'?0:-1;
          if(next>=0)activate(next,true);else stop('목록 재생이 끝났어요.');
        });
        media.src=url;
      }catch{
        if(live)release();
        status='error';message='이 곡을 열지 못했습니다. 연결 상태를 확인해 주세요.';notify();return false;
      }
      notify();if(autoplay)play();return true;
    }
    function setTracks(manifest){
      if(!manifest||manifest.version!==1||!Array.isArray(manifest.tracks)||manifest.tracks.some(track=>!track||typeof track.title!=='string'||!track.title.trim()||track.title.length>200||typeof track.src!=='string'||!/^assets\/bgm\/[a-zA-Z0-9_-]+\.mp3$/.test(track.src))){
        release();files=[];index=-1;status='error';message='곡 목록 형식이 올바르지 않습니다.';notify();return false;
      }
      release();files=manifest.tracks.map(({title,src})=>({title,src}));index=-1;
      if(!files.length){status='empty';message='등록된 곡이 없습니다. 음원 연결을 준비 중입니다.';notify();return true;}
      return activate(0,false);
    }
    function pause(){if(!live)return;++epoch;wanted=false;safePause(live.media);status='paused';message='일시정지';notify();}
    function stop(text='정지 · 처음부터 다시 재생할 수 있어요.'){
      if(!live)return;++epoch;wanted=false;safePause(live.media);resetTime();status='stopped';message=text;notify();
    }
    function select(next){const autoplay=wanted;if(next===index)return true;return activate(Number(next),autoplay);}
    function step(delta){if(files.length<2)return;activate((index+delta+files.length)%files.length,wanted);}
    function clear(text='재생을 정리했습니다.'){
      release();files=[];index=-1;status='empty';message=text;notify();
    }
    function setPreferences(value){prefs=normalizePreferences(value);if(live)try{live.media.volume=prefs.volume;}catch{}notify();}
    return {state,setTracks,play,pause,stop,select,next:()=>step(1),previous:()=>step(-1),clear,setPreferences};
  }
  function mount(){
    const document=root.document,panel=document.getElementById('bgm-player');
    if(!panel||panel.dataset.initialized==='true')return;
    panel.dataset.initialized='true';
    const ids=['track','play','stop','prev','next','repeat','status','preferences-status'];
    const el=Object.fromEntries(ids.map(id=>[id,document.getElementById('bgm-'+id)]));
    let preferences=defaults(),renderedNames=[],player,loadingPlaylist=false,trackSources=[];
    function storageNotice(text){el['preferences-status'].textContent=text;}
    try{const raw=root.localStorage.getItem(PREFERENCES_KEY);if(raw!==null)preferences=normalizePreferences(JSON.parse(raw));}
    catch{storageNotice('반복 설정을 읽지 못했습니다. 이 페이지에서는 사용할 수 있어요.');}
    function render(value){
      if(!loadingPlaylist&&value.index>=0&&trackSources[value.index]){try{root.localStorage.setItem(TRACK_KEY,trackSources[value.index]);}catch{}}
      if(value.tracks.length!==renderedNames.length||value.tracks.some((name,i)=>name!==renderedNames[i])){
        el.track.replaceChildren();
        value.tracks.forEach((name,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=(i+1)+'. '+name;el.track.appendChild(option);});
        if(!value.tracks.length){const option=document.createElement('option');option.value='';option.textContent='선택한 곡 없음';el.track.appendChild(option);}
        renderedNames=value.tracks.slice();
      }
      el.track.value=value.index<0?'':String(value.index);
      const empty=value.index<0;
      for(const name of ['track','play','stop','prev','next'])el[name].disabled=empty;
      el.prev.disabled=el.next.disabled=value.tracks.length<2;
      const active=value.status==='pending'||value.status==='playing';
      el.play.textContent=active?'일시정지':'재생';el.play.setAttribute('aria-label',active?'음악 일시정지':'음악 재생');
      el.play.setAttribute('aria-pressed',String(active));
      el.repeat.value=value.preferences.repeat;
      el.status.textContent=value.message+(empty?'':' · '+(value.index+1)+' / '+value.tracks.length+'곡'+(value.tracks.length===1?' · 한 파일만 등록되어 이전곡·다음곡은 사용하지 않습니다.':''));
    }
    player=createPlayer({createMedia:()=>new root.Audio(),onChange:render,preferences});
    render(player.state());
    function loadPlaylist(){loadingPlaylist=true;try{const manifest=JSON.parse(document.getElementById('bgm-playlist')?.textContent||'{"version":1,"tracks":[]}');trackSources=Array.isArray(manifest.tracks)?manifest.tracks.map(t=>t.src):[];player.setTracks(manifest);let selected=null;try{selected=root.localStorage.getItem(TRACK_KEY);}catch{}const index=trackSources.indexOf(selected);if(index>=0)player.select(index);}catch{player.setTracks(null);}finally{loadingPlaylist=false;}}
    loadPlaylist();
    root.addEventListener('pageshow',event=>{if(event.persisted)loadPlaylist();});
    el.play.addEventListener('click',()=>{['pending','playing'].includes(player.state().status)?player.pause():player.play();});
    el.stop.addEventListener('click',()=>player.stop());el.prev.addEventListener('click',()=>player.previous());el.next.addEventListener('click',()=>player.next());
    el.track.addEventListener('change',()=>player.select(Number(el.track.value)));
    function savePreferences(){
      const next=normalizePreferences({version:1,repeat:el.repeat.value});player.setPreferences(next);
      try{root.localStorage.setItem(PREFERENCES_KEY,JSON.stringify(next));storageNotice('선택한 곡과 반복 설정을 이 브라우저에 저장합니다.');}
      catch{storageNotice('설정 저장이 차단되었습니다. 반복은 현재 페이지에서만 유지됩니다.');}
    }
    el.repeat.addEventListener('change',savePreferences);
    root.addEventListener('storage',event=>{if(event.key!==PREFERENCES_KEY&&event.key!==null)return;try{const raw=root.localStorage.getItem(PREFERENCES_KEY);player.setPreferences(raw?JSON.parse(raw):defaults());storageNotice('다른 페이지의 반복 설정을 반영했습니다.');}catch{storageNotice('다른 페이지의 설정을 읽지 못해 현재 값을 유지합니다.');}});
    const cleanup=()=>{player.clear('페이지 이동으로 음악을 정지했습니다. 다시 재생하려면 재생 버튼을 눌러 주세요.');};
    root.CVPage?.beforeNavigate(cleanup);root.addEventListener('pagehide',cleanup);
  }
  if(typeof module==='object'&&module.exports)module.exports={createPlayer,normalizePreferences,PREFERENCES_KEY};
  if(root?.document)mount();
})(typeof window==='object'?window:null);
