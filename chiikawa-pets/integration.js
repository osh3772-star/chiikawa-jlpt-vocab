(() => {
  // Self-contained offline application. UI state never writes study data.
  __PET_ENGINE__
  __EVIDENCE_HELPERS__
  __VISIBILITY_HELPERS__
  __MOMONGA_PREVIEW_HELPERS__
  const momongaPreviewAsset = __MOMONGA_PREVIEW_CONFIG__;
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
  let momongaPreview;

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
    getContext:()=>({visible:preferences.visible.momonga,paused:pets?.isPaused()??true,reduced:motionQuery.matches}),
    onBegin:()=>pets?.beginExternalPresentation('momonga')??false,onEnd:()=>pets?.endExternalPresentation('momonga'),
    prepareStage:preparePreviewStage,
    readObstacles:()=>[...document.querySelectorAll('main, button, input, select, textarea, a, [tabindex]')]
      .filter(el=>!previewRail.contains(el)&&!el.closest('.cv-pet-layer'))
      .map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0)});
  previewStart.addEventListener('click',()=>momongaPreview.start());
  previewClose.addEventListener('click',()=>momongaPreview.cancel('closed'));
  for(const type of ['resize','blur','pagehide'])window.addEventListener(type,()=>momongaPreview.cancel(type));
  window.addEventListener('scroll',()=>{if(momongaPreview.getState().active)momongaPreview.cancel('scroll');},{passive:true,capture:true});
  document.addEventListener('visibilitychange',()=>momongaPreview.cancel('visibility'));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&momongaPreview.getState().active){event.preventDefault();momongaPreview.cancel('escape');}});
  motionQuery.addEventListener('change',()=>momongaPreview.cancel('reduced-motion'));


  function saveVisibility(){preferences.paused=userPaused;try{localStorage.setItem(visibilityKey,JSON.stringify(preferences));}catch(_) {}}
  function syncVisibilityUI(){
    for(const id of groups.all){visibleInputs[id].checked=preferences.visible[id];mobileStages[id].hidden=!preferences.visible[id];}
    const count=selectedPetIds(preferences).length;mobileDock.hidden=count===0;
    previewStart.disabled=!momongaPreviewAsset||!preferences.visible.momonga;
    visibilityStatus.textContent=`${count}명 꺼냄 · 자동 동작 설정: ${pets?.isPaused()?'일시정지':'재개'}`;
    betaStage.hidden=!betaToggle.checked||!preferences.visible.chiikawa||window.innerWidth<640;
    betaWalk.disabled=!betaToggle.checked||!preferences.visible.chiikawa;
    const directional=!!characterProfiles.chiikawa?.betaManifest?.actions?.walk;
    betaWalk.textContent=directional?'걷기 보기':'제자리 동작 보기';
    betaNote.textContent=!preferences.visible.chiikawa?'치이카와 숨김 · 베타 선택은 보존됩니다':betaToggle.checked?'기존 창작 베타 · 영상 재현 아님 · 외형/발 미끄럼 검수 중':'선택 시 기존 창작 원화를 사용합니다 · 영상 근거 동작과 별도';
  }
  function syncToggle(){
    const paused=pets.isPaused();toggle.textContent=paused?'자동 동작 재개':'자동 동작 일시정지';toggle.setAttribute('aria-pressed',String(paused));
    toggle.title=motionQuery.matches?'시스템 동작 줄이기 설정이 적용 중입니다':'보이는 캐릭터는 그대로 두고 자동 동작만 조절합니다';
    syncVisibilityUI();
  }
  function applyVisibility(){momongaPreview?.cancel('visibility-change');syncVisibilityUI();pets?.setVisibleCharacters(selectedPetIds(preferences));saveVisibility();}
  function mount(){
    syncVisibilityUI();const mobile=groups[picker.value];
    pets=mountChiikawaPets({spriteSources,characterProfiles,enabledCharacters:groups.all,
      visibleCharacters:selectedPetIds(preferences),mobilePetStages:mobileStages,mobileStageViewport:mobileDock,
      onCharacterHidden:(id,{hadFocus})=>{if(hadFocus)visibleInputs[id].focus();},
      onPresentationCancelled:reason=>momongaPreview?.cancel(reason),
      avoidSelector:'#card, button, select, input, textarea, a, .table-scroll, .cv-momonga-preview-rail:not([hidden])',
      experimentalCharacters:betaToggle.checked?['chiikawa']:[],experimentalStage:betaStage,
      startPaused:userPaused,maxVisibleMobile:mobile.length,mobilePriority:mobile});
    syncToggle();
  }
  document.getElementById('pets-show-all').addEventListener('click',()=>{for(const id of groups.all)preferences.visible[id]=true;applyVisibility();});
  document.getElementById('pets-hide-all').addEventListener('click',()=>{for(const id of groups.all)preferences.visible[id]=false;applyVisibility();});
  toggle.addEventListener('click',()=>{userPaused=!pets.isPaused();if(userPaused)pets.pause();else pets.resume();saveVisibility();syncToggle();});
  picker.addEventListener('change',()=>{pets.setMobileCharacters(groups[picker.value]);try{localStorage.setItem(preferenceKey,picker.value);}catch(_) {}});
  betaToggle.addEventListener('change',()=>{pets.destroy();mount();try{localStorage.setItem(betaPreferenceKey,String(betaToggle.checked));}catch(_) {}if(betaToggle.checked)pets.playAction('walk','chiikawa');});
  betaWalk.addEventListener('click',()=>pets.playAction('walk','chiikawa'));
  motionQuery.addEventListener('change',syncToggle);
  window.addEventListener('resize',syncVisibilityUI);
  window.addEventListener('pagehide',()=>pets.destroy());
  window.addEventListener('pageshow',event=>{if(event.persisted)mount();});
  mount();
})();
