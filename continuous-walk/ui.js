  if(document.body?.dataset.page!=='study'||document.getElementById('continuous-walk-controls'))return;
  const panel=document.createElement('div');panel.id='continuous-walk-controls';panel.className='cv-continuous-walk';
  panel.innerHTML='<button id="continuous-walk-start" type="button">치이카와 걷기</button> <button id="continuous-walk-stop" type="button" disabled>걷기 정지</button><p id="continuous-walk-status" role="status" data-mode="off" data-reason="default-off">걷기 꺼짐 · 누르면 바닥에서 걷습니다.</p>';
  document.getElementById('study').before(panel);
  const start=document.getElementById('continuous-walk-start'),stop=document.getElementById('continuous-walk-stop'),status=document.getElementById('continuous-walk-status');
  let enabled=false;
  const engine=()=>window[Symbol.for('jlpt.chiikawa-pets')];
  const bridge=createContinuousWalkEngineAdapter({getEngine:engine,readUI:()=>({enabled,floorRequested:true,documentHidden:document.hidden,inputBusy:false,composing:false,mediaBusy:document.getElementById('bgm-play')?.getAttribute('aria-pressed')==='true'})});
  const controller=createContinuousWalkController({fixture:art,host:bridge,decode:decodeReviewedStep,onState:s=>{
    const active=s.mode!=='off';start.disabled=active;stop.disabled=!active;
    status.dataset.mode=s.mode;status.dataset.reason=s.reason||'';status.dataset.cause=s.diagnostic?.cause||'';status.dataset.engineReleaseReason=s.diagnostic?.engineReleaseReason||'';
    status.dataset.frameGapMs=Number.isFinite(s.diagnostic?.frameGapMs)?String(Math.round(s.diagnostic.frameGapMs)):'';
    if(s.mode==='off'&&s.reason)status.dataset.lastStopReason=s.reason;
    const manual=['default-off','disabled','manual-stop','navigation','pagehide','restored-off','destroyed','unbind'].includes(s.reason);
    const label={'context-changed':'화면이나 동작 상태 변경','invalid-or-delayed-frame':'화면 갱신 지연','frame-stalled':'화면 갱신 멈춤','unsafe-placement':'안전 영역 변경','blur':'창 비활성화','scroll':'화면 스크롤','resize':'화면 크기 변경','pointerdown':'직접 입력','keydown':'키보드 입력','vocab:busy':'학습 동작','visibility':'페이지 표시 변경'}[s.reason]||'안전 조건 변경';
    status.textContent=s.mode==='loading'?'걷기 준비 중…':s.mode==='walking'?'바닥에서 걷는 중 · 잡거나 정지할 수 있어요.':!manual?'걷기 자동 정지 · 멈춘 이유: '+label+' ['+s.reason+(s.diagnostic?.cause?'/'+s.diagnostic.cause:'')+']'+(status.dataset.frameGapMs?' · '+status.dataset.frameGapMs+'ms':''):s.enabled?'걷기 멈춤 · 다시 누르면 시작합니다.':s.reason==='manual-stop'?'걷기 정지 · 다시 누르면 시작합니다.':'걷기 꺼짐 · 누르면 바닥에서 걷습니다.';
  }});
  const unbind=bindContinuousWalkCancellation({controller,window,document,controls:panel});
  async function begin(){
    await Promise.resolve();if(controller.getState().mode!=='off')return;
    enabled=true;controller.setEnabled(true);
    // Settle our own loading text before canStart/initial geometry is measured.
    status.textContent='걷기 준비 중…';
    let ok=false;try{ok=await controller.start();}catch{controller.stop('decode-or-host-error');}
    if(!ok&&controller.getState().mode==='off'){
      let admission;try{admission=bridge.read(null);}catch{}
      const reason=admission?.mediaBusy?'audio-active':admission?.reason||controller.getState().reason||'state-changed';
      enabled=false;controller.setEnabled(false,reason);status.dataset.reason=reason;
      status.textContent=reason==='paused'?'일시정지를 풀면 걸을 수 있어요.':reason==='audio-active'?'음악을 정지한 뒤 걸어 주세요.':['no-safe-placement','no-safe-path','protected-space','outside-viewport'].includes(reason)?'바닥에서 걸을 공간이 부족해요. 다른 캐릭터를 옮긴 뒤 다시 눌러 주세요.':'아직 시작하지 못했어요. 입력이 끝난 뒤 다시 눌러 주세요.';
    }
  }
  start.addEventListener('click',begin);
  const reset=(reason='manual-stop')=>{enabled=false;controller.setEnabled(false,reason);};
  stop.addEventListener('click',()=>reset('manual-stop'));
  window.CVPage?.beforeNavigate(()=>reset('navigation'));
  window.addEventListener('pagehide',event=>{reset('pagehide');if(!event.persisted){controller.destroy();bridge.destroy();unbind();}});
  window.addEventListener('pageshow',event=>{if(event.persisted)reset('restored-off');});
