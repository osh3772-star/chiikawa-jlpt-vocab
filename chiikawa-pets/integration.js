(() => {
  // Self-contained offline application. UI state never writes study data.
  __PET_ENGINE__
  __EVIDENCE_HELPERS__
  __VISIBILITY_HELPERS__
  __MOMONGA_PREVIEW_HELPERS__
  __STATIC_CAMEO_HELPERS__
  const staticCameoAsset = __STATIC_CAMEO_CONFIG__;
  const momongaPreviewAsset = __MOMONGA_PREVIEW_CONFIG__;
  const HachiwareModule=__HACHIWARE_MODULE__;
  const UsagiModule=__USAGI_MODULE__;
  const fragmentSources=__FRAGMENT_SOURCES__;
  const ShisaModule=__SHISA_MODULE__;
  const shisaSource=__SHISA_SOURCE__;
  const motionEvidence = __MOTION_EVIDENCE__;
  const spriteSources = JSON.parse(document.getElementById('pet-sprites').textContent);
  const characterProfiles = JSON.parse(document.getElementById('pet-profiles').textContent);
  const toggle = document.getElementById('pet-toggle');
  const picker = document.getElementById('mobile-pets');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const labels = { chiikawa:'치이카와', hachiware:'하치와레', usagi:'우사기', shisa:'시사', momonga:'모몽가', rakko:'랏코' };
  const groups = { new:['shisa','momonga','rakko'], original:['chiikawa','hachiware','usagi'], all:Object.keys(labels) };
  const preferenceKey = 'jlpt-pet-mobile-group-v1';
  const betaPreferenceKey = 'jlpt-pet-chiikawa-beta-v1';
  const visibilityKey = 'jlpt-pet-visibility-v1';
  let preferences = normalizePetVisibilityPreferences(null);
  try { preferences = normalizePetVisibilityPreferences(JSON.parse(localStorage.getItem(visibilityKey))); } catch (_) {}
  try { const saved=localStorage.getItem(preferenceKey); if(Object.hasOwn(groups,saved)) picker.value=saved; } catch (_) {}
  let userPaused = preferences.paused;
  let pets;
  let momongaPreview,staticCameo,hachiwarePreview,usagiPreview;
  const previewCoordinator=createPreviewCoordinator();

  const visibilityTools = document.createElement('details');
  visibilityTools.className = 'cv-visibility-tools'; visibilityTools.open = true;
  visibilityTools.innerHTML = '<summary>캐릭터 꺼내기 / 넣기</summary><div class="cv-visibility-choices"></div><div class="cv-visibility-actions"><button type="button" id="pets-show-all">모두 꺼내기</button><button type="button" id="pets-hide-all">모두 넣기</button><span id="pets-visibility-status" role="status"></span></div><p>숨기기와 자동 동작 일시정지는 별개입니다. 모바일에서는 아래 가로 무대를 밀어 선택한 친구를 볼 수 있어요.</p>';
  document.querySelector('.pet-tools').after(visibilityTools);
  const choices = visibilityTools.querySelector('.cv-visibility-choices');
  const visibleInputs = {};
  for (const [id,label] of Object.entries(labels)) {
    const row=document.createElement('label');
    const input=document.createElement('input'); input.type='checkbox'; input.id=`pet-visible-${id}`;
    row.appendChild(input); row.appendChild(document.createTextNode(`${label} 꺼내기`)); choices.appendChild(row);
    visibleInputs[id]=input;
    input.addEventListener('change',()=>{ preferences.visible[id]=input.checked; applyVisibility(); });
  }
  const visibilityStatus=document.getElementById('pets-visibility-status');
  const mobileDock=document.createElement('div'); mobileDock.className='cv-mobile-pet-dock';
  mobileDock.setAttribute('role','region'); mobileDock.setAttribute('aria-label','선택한 캐릭터 가로 무대');
  const mobileStages={};
  for(const [id,label] of Object.entries(labels)) {
    const slot=document.createElement('div');slot.className='cv-mobile-pet-slot';slot.dataset.character=id;
    const focusButton=document.createElement('button');focusButton.type='button';focusButton.textContent=`${label} 선택`;
    focusButton.addEventListener('focus',()=>slot.scrollIntoView({block:'nearest',inline:'nearest'}));
    focusButton.addEventListener('click',()=>pets?.focusCharacter(id));
    slot.appendChild(focusButton);mobileDock.appendChild(slot);mobileStages[id]=slot;
  }
  visibilityTools.after(mobileDock);
  document.body.classList.add('cv-mobile-dock-enabled');

  const evidencePanel=document.createElement('details');evidencePanel.className='cv-evidence-status';
  const evidenceHeading=document.createElement('summary');evidencePanel.appendChild(evidenceHeading);
  try {
    const status=summarizeEvidenceRegistry(motionEvidence);evidenceHeading.textContent=status.label;
    const note=document.createElement('p');
    note.textContent='관찰 조각은 완성 동작 승인이 아닙니다. 근거·설계·실제 원화·안전 검수가 끝나기 전에는 새 동작을 재생하지 않습니다. 기존 창작 베타와 별도입니다.';
    evidencePanel.appendChild(note);const list=document.createElement('ul');
    for(const entry of status.entries){const item=document.createElement('li');item.textContent=`${entry.title} — ${evidenceStatusLabel(entry.evidenceStatus)}`;list.appendChild(item);}
    for(const mapping of status.mappings){const item=document.createElement('li');item.textContent=`웹 배치안: ${mapping.title} — 원작 궤적 재현 아님 · ${mapping.previewTestingAuthorized ? '정식 동작 비활성 / 제한 미리보기 테스트 허용' : '비활성'}`;list.appendChild(item);}
    evidencePanel.appendChild(list);
  } catch (_) { evidenceHeading.textContent='영상 근거 목록 검증 실패 · 새 동작 비활성'; }
  mobileDock.after(evidencePanel);

  const previewPanel=document.createElement('details');previewPanel.id='motion-preview-panel';previewPanel.className='cv-preview-panel';
  previewPanel.innerHTML='<summary id="motion-preview-summary">동작 미리보기 · 검토용</summary><p class="cv-preview-intro">검토 중인 관찰 조각을 명시적으로 확인하는 영역입니다. 펼치기만으로 재생하지 않습니다. 자연스러운 최종 애니메이션 완료본이 아닙니다.</p>';
  evidencePanel.after(previewPanel);
  const previewAvailable=id=>previewPanel.open&&preferences.visible[id]&&!document.hidden;

  const betaTools=document.createElement('div');betaTools.className='cv-beta-tools';
  betaTools.innerHTML='<label><input id="chiikawa-beta" type="checkbox"> 기존 창작 동작 베타 (영상 재현 아님)</label><button id="chiikawa-beta-walk" type="button" disabled>걷기 보기</button><span id="chiikawa-beta-note" role="status"></span>';
  evidencePanel.after(betaTools);
  const betaStage=document.createElement('div');betaStage.className='cv-beta-stage';
  betaStage.setAttribute('aria-label','기존 창작 치이카와 베타 전용 무대');
  betaStage.innerHTML='<span>기존 창작 베타 무대 · 영상 재현 아님</span>';betaTools.after(betaStage);
  const betaToggle=document.getElementById('chiikawa-beta');
  const betaWalk=document.getElementById('chiikawa-beta-walk');
  const betaNote=document.getElementById('chiikawa-beta-note');
  try {betaToggle.checked=localStorage.getItem(betaPreferenceKey)==='true';} catch (_) {}
  const previewTools=document.createElement('section');previewTools.className='cv-momonga-preview-tools';
  previewTools.setAttribute('aria-label','모몽가 제한 미리보기');
  previewTools.innerHTML='<strong>영상 자세 참고 + 웹 이동 연출</strong><p>파생 정지 그림 1장만 이동하는 제한 미리보기입니다. 원작 궤적·속도 재현, 날갯짓·이륙·착지가 아닙니다. 종료 뒤 빈 무대를 유지하여 학습 카드가 움직이지 않으며, 무대 닫기로 접을 수 있습니다.</p><button type="button" id="momonga-preview-start">모몽가 제한 미리보기</button><button type="button" id="momonga-preview-close">미리보기 무대 닫기</button><span id="momonga-preview-status" role="status">기본 꺼짐 · 버튼을 눌러 1회만 확인</span>';
  betaStage.after(previewTools);
  const previewRail=document.createElement('div');previewRail.className='cv-momonga-preview-rail';previewRail.hidden=true;
  previewRail.innerHTML='<span>전용 빈 무대 · 화면 경로는 웹 연출</span>';
  const previewImage=document.createElement('img');previewImage.alt='영상 자세를 참고한 모몽가 파생 정지 그림';previewImage.draggable=false;previewImage.hidden=true;previewRail.appendChild(previewImage);previewTools.after(previewRail);
  const previewStart=document.getElementById('momonga-preview-start');
  const previewClose=document.getElementById('momonga-preview-close');
  const previewStatus=document.getElementById('momonga-preview-status');
  const preparePreviewStage=async()=>{
    const rect=previewRail.getBoundingClientRect();
    if(rect.top<0||rect.bottom>window.innerHeight)previewRail.scrollIntoView({block:'nearest',behavior:'auto'});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  };
  momongaPreview=createMomongaPreviewController({asset:momongaPreviewAsset,image:previewImage,rail:previewRail,status:previewStatus,
    getContext:()=>({visible:previewAvailable('momonga'),paused:pets?.isPaused()??true,reduced:motionQuery.matches}),
    onBegin:()=>pets?.beginExternalPresentation('momonga')??false,onEnd:()=>pets?.endExternalPresentation('momonga'),
    prepareStage:preparePreviewStage,
    readObstacles:()=>[...document.querySelectorAll('main, button, input, select, textarea, a, [tabindex]')]
      .filter(el=>!previewRail.contains(el)&&!el.closest('.cv-pet-layer'))
      .map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0)});
  previewCoordinator.register('momonga',momongaPreview);
  previewStart.addEventListener('click',()=>previewCoordinator.start('momonga'));
  previewClose.addEventListener('click',()=>momongaPreview.cancel('closed'));
  for(const type of ['resize','blur','pagehide'])window.addEventListener(type,()=>previewCoordinator.cancelAll(type));
  window.addEventListener('scroll',()=>{if(previewCoordinator.anyActive())previewCoordinator.cancelAll('scroll');},{passive:true,capture:true});
  document.addEventListener('visibilitychange',()=>previewCoordinator.cancelAll('visibility'));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&previewCoordinator.hasOpen()){event.preventDefault();previewCoordinator.cancelAll('escape');}});
  motionQuery.addEventListener('change',()=>previewCoordinator.cancelAll('reduced-motion'));


  const cameoTools=document.createElement('section');cameoTools.className='cv-momonga-preview-tools';cameoTools.setAttribute('aria-label','치이카와 EP2 4포즈 상체 미리보기');
  cameoTools.innerHTML='<strong>EP2 참고 · 치이카와 확인된 4포즈</strong><p>관찰된 A→A1→B→C 순서의 파생 상체 4포즈만 한 번 표시합니다. 제작 UI 리듬이며 원작 연속동작·정확한 속도가 아닙니다. 중간각도·하체·발은 추가하지 않고 끝에는 C 정지 자세를 유지합니다.</p><button type="button" id="chiikawa-cameo-start">치이카와 4포즈 상체 보기</button><button type="button" id="chiikawa-cameo-close">카메오 무대 닫기</button><span id="chiikawa-cameo-status" role="status">기본 꺼짐 · 명시적 호출만</span>';
  previewRail.after(cameoTools);
  const cameoRail=document.createElement('div');cameoRail.className='cv-static-cameo-rail';cameoRail.hidden=true;
  cameoRail.innerHTML='<span>상체 전용 창 · 확인된 4포즈 / 동작 줄이기는 A 정지</span>';
  const cameoClip=document.createElement('div');cameoClip.className='cv-static-cameo-clip';
  const cameoImage=document.createElement('img');cameoImage.alt='EP2 정면 말린 앞팔 자세 참고 파생 상체';cameoImage.draggable=false;cameoImage.hidden=true;cameoClip.appendChild(cameoImage);cameoRail.appendChild(cameoClip);cameoTools.after(cameoRail);
  const cameoStart=document.getElementById('chiikawa-cameo-start'),cameoClose=document.getElementById('chiikawa-cameo-close'),cameoStatus=document.getElementById('chiikawa-cameo-status');
  staticCameo=createStaticCameoController({asset:staticCameoAsset,image:cameoImage,clip:cameoClip,rail:cameoRail,status:cameoStatus,
    getContext:()=>({visible:previewAvailable('chiikawa'),paused:pets?.isPaused()??true,reduced:motionQuery.matches}),
    onBegin:()=>pets?.beginExternalPresentation('chiikawa')??false,onEnd:()=>pets?.endExternalPresentation('chiikawa'),
    prepareStage:async()=>{const r=cameoRail.getBoundingClientRect();if(r.top<0||r.bottom>window.innerHeight)cameoRail.scrollIntoView({block:'nearest',behavior:'auto'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},
    readObstacles:()=>[...document.querySelectorAll('main, button, input, select, textarea, a, [tabindex]')].filter(el=>!cameoRail.contains(el)&&!el.closest('.cv-pet-layer')).map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0)});
  previewCoordinator.register('chiikawa-cameo',staticCameo);
  cameoStart.addEventListener('click',()=>previewCoordinator.start('chiikawa-cameo'));
  cameoClose.addEventListener('click',()=>staticCameo.cancel('closed'));


  function fragmentPanel({id,title,note,label,windowClass}){
    const tools=document.createElement('section');tools.className='cv-momonga-preview-tools';tools.setAttribute('aria-label',title);
    const heading=document.createElement('strong');heading.textContent=title;const text=document.createElement('p');text.textContent=note;
    const start=document.createElement('button');start.type='button';start.id=`${id}-start`;start.textContent=label;
    const close=document.createElement('button');close.type='button';close.id=`${id}-close`;close.textContent='미리보기 무대 닫기';
    const status=document.createElement('span');status.id=`${id}-status`;status.setAttribute('role','status');status.textContent='기본 꺼짐 · 명시적 호출만';
    tools.append(heading,text,start,close,status);
    const rail=document.createElement('div');rail.className='cv-fragment-rail';rail.hidden=true;
    const clip=document.createElement('div');clip.className=`cv-fragment-clip ${windowClass}`;
    const image=document.createElement('img');image.alt=title+' 파생 자세';image.draggable=false;image.hidden=true;clip.appendChild(image);rail.appendChild(clip);
    return {tools,start,close,status,rail,clip,image};
  }
  const hachiUI=fragmentPanel({id:'hachiware-preview',title:'EP5 참고 · 하치와레 봉지 2포즈',note:'같은 봉지를 두 앞발로 지지한 작은 상승 A→B만 표시합니다. 제작 UI 리듬이며 개봉·먹기·내리기 동작은 없습니다.',label:'하치와레 2포즈 보기',windowClass:'cv-fragment-upperbody'});
  const usagiUI=fragmentPanel({id:'usagi-preview',title:'EP6 참고 · 우사기 관찰 조각',note:'확인된 A→B만 한 번 표시한 뒤 숨깁니다. 착지 구간은 미관찰이므로 C까지 자연스럽게 연결하지 않습니다.',label:'우사기 A→B 조각 보기',windowClass:'cv-fragment-fullbody'});
  const safePrepare=rail=>async({signal}={})=>{if(signal?.aborted||!previewPanel.open)return;const r=rail.getBoundingClientRect();if(r.top<0||r.bottom>window.innerHeight)rail.scrollIntoView({block:'nearest',behavior:'auto'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));};
  const obstaclesFor=rail=>()=>[...document.querySelectorAll('main, button, input, select, textarea, a, [tabindex]')].filter(el=>!rail.contains(el)&&!el.closest('.cv-pet-layer')).map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
  hachiwarePreview=HachiwareModule.createHachiwareTwoPoseController({...hachiUI,asset:fragmentSources.hachiware?HachiwareModule.hachiwareTwoPoseAsset(...fragmentSources.hachiware):null,
    getContext:()=>({visible:previewAvailable('hachiware'),paused:pets?.isPaused()??true,reduced:motionQuery.matches}),onBegin:()=>pets?.beginExternalPresentation('hachiware')??false,onEnd:()=>pets?.endExternalPresentation('hachiware'),prepareStage:safePrepare(hachiUI.rail),readObstacles:obstaclesFor(hachiUI.rail)});
  usagiPreview=UsagiModule.createUsagiFragmentController({...usagiUI,asset:fragmentSources.usagi?UsagiModule.usagiFragmentAsset(...fragmentSources.usagi):null,
    getContext:()=>({visible:previewAvailable('usagi'),paused:pets?.isPaused()??true,reduced:motionQuery.matches}),onBegin:()=>pets?.beginExternalPresentation('usagi')??false,onEnd:()=>pets?.endExternalPresentation('usagi'),prepareStage:safePrepare(usagiUI.rail),readObstacles:obstaclesFor(usagiUI.rail)});
  previewCoordinator.register('hachiware',hachiwarePreview);previewCoordinator.register('usagi',usagiPreview);
  hachiUI.start.addEventListener('click',()=>previewCoordinator.start('hachiware'));hachiUI.close.addEventListener('click',()=>hachiwarePreview.cancel('closed'));
  usagiUI.start.addEventListener('click',()=>previewCoordinator.start('usagi'));usagiUI.close.addEventListener('click',()=>usagiPreview.cancel('closed'));
  const usagiLater=document.createElement('button');usagiLater.type='button';usagiLater.id='usagi-later-still';usagiLater.textContent='별도 컷 C 정지 · 착지 구간 미관찰';
  usagiUI.tools.insertBefore(usagiLater,usagiUI.status);
  usagiLater.addEventListener('click',()=>{if(!previewAvailable('usagi')||usagiPreview.getState().mode!=='off')return;previewCoordinator.cancelAll('separate-still');usagiPreview.showLaterStill();});
  const shisaUI=fragmentPanel({id:'shisa-preview',title:'시사 · 정적 UI 재배치',note:'관찰 자세 1장과 별도로 제작한 고정 UI 컵입니다. 원작에서는 쿠리만쥬가 잔을 듭니다. 붓기 애니메이션·관계 장면 재현이 아닙니다.',label:'시사 정적 구성 보기',windowClass:'cv-fragment-unused'});
  shisaUI.clip.remove();shisaUI.rail.classList.add('cv-shisa-host');
  const shisaPreview=ShisaModule.createShisaStaticController({host:shisaUI.rail,assetUrl:shisaSource,enabled:!!shisaSource,
    getContext:()=>({visible:previewAvailable('shisa'),viewport:{width:window.innerWidth,height:window.innerHeight}}),
    onBegin:()=>pets?.beginExternalPresentation('shisa')??false,onEnd:()=>pets?.endExternalPresentation('shisa'),readObstacles:obstaclesFor(shisaUI.rail),
    onState:({state,reason})=>{shisaUI.status.textContent=state==='loading'?'검토된 정적 구성 준비 중':state==='visible'?'정적 UI 재배치 · 동작 재생 없음':reason==='unavailable-or-no-safe-path'?'안전한 빈 무대가 없어 생략했습니다':'시사 미리보기 숨김';}});
  previewCoordinator.register('shisa',shisaPreview);
  shisaUI.start.addEventListener('click',()=>{if(!previewAvailable('shisa'))return;previewCoordinator.cancelAll('switch');shisaUI.rail.hidden=false;const r=shisaUI.rail.getBoundingClientRect();if(r.top<0||r.bottom>window.innerHeight)shisaUI.rail.scrollIntoView({block:'nearest',behavior:'auto'});previewCoordinator.start('shisa');});
  shisaUI.close.addEventListener('click',()=>{shisaPreview.cancel('closed');shisaUI.rail.hidden=true;});
  previewPanel.append(betaTools,betaStage,previewTools,previewRail,cameoTools,cameoRail,hachiUI.tools,hachiUI.rail,usagiUI.tools,usagiUI.rail,shisaUI.tools,shisaUI.rail);
  previewPanel.addEventListener('toggle',()=>{if(!previewPanel.open){previewCoordinator.cancelAll('panel-closed');if(previewPanel.contains(document.activeElement)&&document.activeElement.id!=='motion-preview-summary')document.getElementById('motion-preview-summary').focus();}pets?.destroy();mount();});
  document.addEventListener('keydown',event=>{if(isCharacterManagementArrow(event))event.stopPropagation();},{capture:true});


  function saveVisibility(){preferences.paused=userPaused;try{localStorage.setItem(visibilityKey,JSON.stringify(preferences));}catch(_) {}}
  function syncVisibilityUI(){
    for(const id of groups.all){visibleInputs[id].checked=preferences.visible[id];mobileStages[id].hidden=!preferences.visible[id];}
    const count=selectedPetIds(preferences).length;mobileDock.hidden=count===0;
    previewStart.disabled=!momongaPreviewAsset||!previewAvailable('momonga');
    cameoStart.disabled=!staticCameoAsset||!previewAvailable('chiikawa');
    shisaUI.start.disabled=!shisaSource||!previewAvailable('shisa');
    hachiUI.start.disabled=!fragmentSources.hachiware||!previewAvailable('hachiware');
    usagiUI.start.disabled=!fragmentSources.usagi||!previewAvailable('usagi');usagiLater.disabled=usagiUI.start.disabled;
    visibilityStatus.textContent=`${count}명 꺼냄 · 자동 동작 설정: ${pets?.isPaused()?'일시정지':'재개'}`;
    betaStage.hidden=!previewPanel.open||!betaToggle.checked||!preferences.visible.chiikawa||window.innerWidth<640;
    betaWalk.disabled=!previewPanel.open||!betaToggle.checked||!preferences.visible.chiikawa;
    const directional=!!characterProfiles.chiikawa?.betaManifest?.actions?.walk;
    betaWalk.textContent=directional?'걷기 보기':'제자리 동작 보기';
    betaNote.textContent=!preferences.visible.chiikawa?'치이카와 숨김 · 베타 선택은 보존됩니다':betaToggle.checked?'기존 창작 베타 · 영상 재현 아님 · 외형/발 미끄럼 검수 중':'선택 시 기존 창작 원화를 사용합니다 · 영상 근거 동작과 별도';
  }
  function syncToggle(){
    const paused=pets.isPaused();toggle.textContent=paused?'자동 동작 재개':'자동 동작 일시정지';toggle.setAttribute('aria-pressed',String(paused));
    toggle.title=motionQuery.matches?'시스템 동작 줄이기 설정이 적용 중입니다':'보이는 캐릭터는 그대로 두고 자동 동작만 조절합니다';
    syncVisibilityUI();
  }
  function applyVisibility(){previewCoordinator.cancelAll('visibility-change');syncVisibilityUI();pets?.setVisibleCharacters(selectedPetIds(preferences));saveVisibility();}
  function mount(){
    previewCoordinator.cancelAll('engine-remount');
    syncVisibilityUI();const mobile=groups[picker.value];
    pets=mountChiikawaPets({spriteSources,characterProfiles,enabledCharacters:groups.all,
      visibleCharacters:selectedPetIds(preferences),mobilePetStages:mobileStages,mobileStageViewport:mobileDock,
      onCharacterHidden:(id,{hadFocus})=>{if(hadFocus)visibleInputs[id].focus();},
      onPresentationCancelled:reason=>previewCoordinator.cancelAll(reason),
      avoidSelector:'#card, button, select, input, textarea, a, .table-scroll, .cv-momonga-preview-rail:not([hidden]), .cv-static-cameo-rail:not([hidden]), .cv-fragment-rail:not([hidden])',
      experimentalCharacters:betaToggle.checked&&previewPanel.open?['chiikawa']:[],experimentalStage:betaStage,
      startPaused:userPaused,maxVisibleMobile:mobile.length,mobilePriority:mobile});
    syncToggle();
  }
  document.getElementById('pets-show-all').addEventListener('click',()=>{for(const id of groups.all)preferences.visible[id]=true;applyVisibility();});
  document.getElementById('pets-hide-all').addEventListener('click',()=>{for(const id of groups.all)preferences.visible[id]=false;applyVisibility();});
  toggle.addEventListener('click',()=>{previewCoordinator.cancelAll('pause-change');userPaused=!pets.isPaused();if(userPaused)pets.pause();else pets.resume();saveVisibility();syncToggle();});
  picker.addEventListener('change',()=>{pets.setMobileCharacters(groups[picker.value]);try{localStorage.setItem(preferenceKey,picker.value);}catch(_) {}});
  betaToggle.addEventListener('change',()=>{pets.destroy();mount();try{localStorage.setItem(betaPreferenceKey,String(betaToggle.checked));}catch(_) {}if(betaToggle.checked&&previewPanel.open)pets.playAction('walk','chiikawa');});
  betaWalk.addEventListener('click',()=>pets.playAction('walk','chiikawa'));
  motionQuery.addEventListener('change',syncToggle);
  window.addEventListener('resize',syncVisibilityUI);
  window.addEventListener('pagehide',()=>pets.destroy());
  window.addEventListener('pageshow',event=>{if(event.persisted)mount();});
  for(const type of ['click','change','keydown'])document.addEventListener(type,event=>{if(shouldCancelPreviewForStudyInput(event,!document.getElementById('study').hidden))previewCoordinator.cancelAll('study-input');},{capture:true});
  for(const type of ['start','correct','wrong','complete','view'])document.addEventListener(`vocab:${type}`,()=>previewCoordinator.cancelAll('study-input'));
  mount();
})();
