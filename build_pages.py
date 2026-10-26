"""Build three real HTML entrypoints from the exact frozen, self-contained release.
The old build_html.py/offline document remains intact. No new artwork or libraries.
"""
from pathlib import Path
import re, json, hashlib, base64, argparse
ROOT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
BASE_SHA='777f3694738039dc1a244d5661136eef75c7778bbebcace02caa5115c6e4231c'
PUBLIC_PNGS={'fde3946e1ad5a74f1830657510b5c3efad3ca9892c3653cdd8addaa3a6d8311c'}
# Resolve the complete 13 already-public image identities from the legacy build's
# reviewed step registrations, instead of rewriting/re-encoding any PNG.
def replace_once(s,before,after):
    assert s.count(before)==1,(before[:100],s.count(before));return s.replace(before,after,1)
def build(output):
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    raw=(ROOT/'legacy-self-contained.html').read_bytes();assert sha(raw)==BASE_SHA
    full=raw.decode(); pattern=r'''data:image/[^\s"'<>`\\]+'''
    # The only externalized PNGs are the 12 Chi foot frames and existing H5 reuse.
    # All 13 public PNGs are exactly the large reviewed-step sources at the end.
    script=re.findall(r'<script([^>]*)>(.*?)</script>',full,re.S)[3][1]
    foot=script[script.index('const StepModule=ReviewedStep'):]
    public={}
    # Current accepted Chi manifest is authoritative for the remaining frame hashes.
    manifest=json.loads((ROOT/'chiikawa-pets/reviewed-foot-assets/manifest.json').read_text())
    approved=PUBLIC_PNGS|{frame['sha256'] for frame in manifest['frames']}
    for uri in re.findall(pattern,foot):
        b=base64.b64decode(uri.split(',',1)[1]);h=sha(b)
        if h in approved:public[uri]=(h,b)
    assert len(public)==13,len(public)
    (output/'assets').mkdir(exist_ok=True)
    for uri,(h,b) in public.items():(output/'assets'/f'{h}.png').write_bytes(b)
    html=re.sub(pattern,lambda m:f'assets/{public[m[0]][0]}.png' if m[0] in public else m[0],full)
    scripts=re.findall(r'<script([^>]*)>(.*?)</script>',html,re.S)
    data={re.search(r'id="([^"]+)"',a)[1]:b for a,b in scripts if 'application/json' in a}
    integration=scripts[3][1];study=scripts[4][1]
    from study_overlay import adapt_engine
    integration=adapt_engine(integration)
    from floor_layout import adapt_floor_layout
    integration=adapt_floor_layout(integration)
    from floor_drag import adapt_floor_drag
    integration=adapt_floor_drag(integration)
    from floor_animation import adapt_floor_animation
    integration=adapt_floor_animation(integration)
    from interaction_sequences import adapt_kani_interactions
    integration=adapt_kani_interactions(integration, ROOT)
    from continuous_walk import adapt_continuous_walk
    integration=adapt_continuous_walk(integration)
    from main_candidate_actions import adapt_main_candidate_actions
    integration=adapt_main_candidate_actions(integration, ROOT)
    from main_interaction_actions import adapt_main_input_sequences
    integration=adapt_main_input_sequences(integration, ROOT)
    from ordinary_input_bindings import assemble_input_bindings,inject_input_bindings
    def input_asset_source(path,digest,raw):
        relative='assets/interaction-sequences/'+digest+'.png'
        dest=output/relative;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(raw)
        return relative
    integration=inject_input_bindings(integration,assemble_input_bindings(ROOT,input_asset_source))
    # Only document-head styles belong to the parent page. The body contains a
    # literal <style> inside Kani's iframe srcdoc JavaScript; never promote it.
    head=html.split('</head>',1)[0]
    styles='\n'.join(re.findall(r'<style[^>]*>(.*?)</style>',head,re.S))+'\n'+(ROOT/'page-adapters/pages.css').read_text()+'\n'+(ROOT/'page-adapters/bgm-player.css').read_text()+'\n'+(ROOT/'continuous-walk/ui.css').read_text()
    # Legacy study top padding belongs to the old document scroller, not the floor owner.
    styles=replace_once(styles,'body:has(#study:not([hidden])) { padding-top: 24px; }','body:not(.cv-floor-layout):has(#study:not([hidden])) { padding-top: 24px; }')
    body=html.split('<body>',1)[1].split('<script id="vocabulary"',1)[0]
    scenery=body[:body.index('  <header')]
    home=body[body.index('    <section id="home"'):body.index('    <section id="study"')]
    study_markup=body[body.index('    <section id="study"'):body.index('    <details id="study-backup"')].replace('aria-label="단어 학습 화면" hidden','aria-label="단어 학습 화면"')
    backup=body[body.index('    <details id="study-backup"'):body.index('  </main>')]
    controls=body[body.index('    <div class="pet-tools"'):body.index('  </header>')]
    # Home never initializes the pet engine. Settings never initializes vocabulary.
    home=home.replace('<h2 id="grade-title">어디부터 시작할까요?</h2>','<h2 id="grade-title">어디부터 시작할까요?</h2><p><a class="cv-primary-link" data-cv-link href="study.html">마지막 학습 이어하기 →</a></p>')
    # Existing DOM lookups in the pet adapter can access detached dependencies, but
    # study never inserts any settings form into the actual document.
    prefix='''
  const page=window.CVPage.page;
  document.body.classList.add('cv-floor-layout');
  const settingsRoot=document.createElement('div');
  if(page!=='settings')settingsRoot.innerHTML=__CONTROLS__;
  const control=id=>document.getElementById(id)||settingsRoot.querySelector('[id="'+id+'"]');
  const controlQuery=selector=>document.querySelector(selector)||settingsRoot.querySelector(selector);
'''.replace('__CONTROLS__',json.dumps(controls,ensure_ascii=False))
    integration=replace_once(integration,'  // Self-contained offline application.',prefix+'  // Self-contained offline application.')
    integration=replace_once(integration,"owner:!characterOnlyMode&&B_LAYOUT_ENABLED&&((window.innerWidth>=1000&&window.innerHeight>=640)||(window.innerWidth<640&&window.innerHeight>=380))?contentViewport:null","owner:!characterOnlyMode?contentViewport:null")
    # Restrict the fallback to known setting controls; actor geometry stays real DOM.
    for ident in ['background-choice','background-status','pet-toggle','mobile-pets','pets-visibility-status','pets-show-all','pets-hide-all','motion-preview-summary','chiikawa-beta','chiikawa-beta-walk','chiikawa-beta-note','momonga-preview-start','momonga-preview-close','momonga-preview-status','chiikawa-cameo-start','chiikawa-cameo-close','chiikawa-cameo-status']:
        integration=integration.replace("document.getElementById('"+ident+"')","control('"+ident+"')")
    integration=integration.replace("document.getElementById('pet-scale-effective-'+id)","control('pet-scale-effective-'+id)")
    integration=integration.replace("document.querySelector('.pet-tools')","controlQuery('.pet-tools')")
    integration=integration.replace("!document.getElementById('study').hidden","!!document.getElementById('study')&&!document.getElementById('study').hidden")
    integration=integration.replace("const studyVisible=!document.getElementById('study')?.hidden;","const studyVisible=!!document.getElementById('study')&&!document.getElementById('study').hidden;")
    integration=integration.replace("const readPairStudy=()=>{const s=window.__cvStudyRead?.();","const readPairStudy=()=>{const s=window.__cvStudyRead?.()??(page==='settings'?{phase:'home',busy:false,composing:false}:null);")
    integration=replace_once(integration,'let requested=false,disposed=false,inputExclusive=false;',"let requested=window.CVPage.incoming?.kani===true,disposed=false,inputExclusive=false;")
    integration=replace_once(integration,'// Session-only default OFF: no saved key, no automatic load/replay after reload.',"// One-use internal navigation carries only requested visibility; reload stays OFF.\n  window.CVPage.registerKani(()=>requested);input.checked=requested;kaniPanel.open=requested;")
    # Attach only display stages to study, not their labels, controls or option forms.
    marker='  if(B_LAYOUT_ENABLED){'
    layout='''  if(page!=='settings'){
    const actions=document.createElement('div');actions.className='cv-study-pet-actions';
    document.querySelector('.site-header').appendChild(actions);actions.appendChild(toggle);
    // These controls are retained off-document for original engine callbacks only.
    settingsRoot.append(visibilityTools,evidencePanel,previewPanel,pairPanel,directStatus);
    document.querySelector('.site-header').appendChild(directStage);
    const display=document.createElement('div');display.className='cv-study-extras';document.querySelector('main').after(display);
    for(const panel of [extraPanel,pajamaPanel,...ownedContentPanels.filter(p=>p.classList.contains('cv-kani-static-panel'))]){
      display.appendChild(panel);
      for(const child of [...panel.children])if(!child.classList.contains('cv-extra-static-rail')&&child.getAttribute('role')!=='status')settingsRoot.appendChild(child);
    }
    for(const panel of ownedContentPanels.filter(p=>!p.classList.contains('cv-kani-static-panel')))settingsRoot.appendChild(panel);
  }
'''
    for var in ['extraPanel','pajamaPanel','kaniPanel']:
        integration=integration.replace(var+"=document.createElement('details')",var+"=document.createElement(page==='settings'?'details':'section')")
    integration=integration.replace("extraRail.hidden=!a.requested;","extraRail.hidden=!a.requested;if(page!=='settings'){extraPanel.hidden=!a.requested;extraPanel.open=a.requested;}")
    integration=integration.replace("pajamaRail.hidden=!a.requested;","pajamaRail.hidden=!a.requested;if(page!=='settings'){pajamaPanel.hidden=!a.requested;pajamaPanel.open=a.requested;}")
    integration=integration.replace("input.checked=requested;rail.hidden=!requested||inputExclusive;","input.checked=requested;if(page!=='settings'){kaniPanel.hidden=!requested;kaniPanel.open=requested;}rail.hidden=!requested||inputExclusive;")
    integration=replace_once(integration,marker,layout+marker)
    integration=replace_once(integration,"for(const el of [document.querySelector('.site-header'),document.querySelector('main'),pairPanel,extraPanel,pajamaPanel,...ownedContentPanels])contentViewport.appendChild(el);","for(const el of [document.querySelector('.cv-page-nav'),document.getElementById('navigation-status'),document.querySelector('.site-header'),document.querySelector('main'),...(page==='settings'?[pairPanel,extraPanel,pajamaPanel,...ownedContentPanels]:[document.querySelector('.cv-study-extras')])].filter(Boolean))contentViewport.appendChild(el);")
    integration=integration.replace('movable:[mobileDock,directStage,betaStage,extraPanel,pajamaPanel,',"movable:[characterViewBar,document.querySelector('.cv-page-nav'),document.getElementById('navigation-status'),mobileDock,directStage,betaStage,extraPanel,pajamaPanel,")
    integration=replace_once(integration,'document.body.append(characterViewStage,characterViewButton);',"const characterViewBar=document.createElement('div');characterViewBar.className='cv-character-view-bar';if(page==='settings'){document.querySelector('.cv-page-nav').after(characterViewBar);characterViewBar.appendChild(characterViewButton);document.body.appendChild(characterViewStage);}")
    integration=integration.replace("active?'단어장으로 돌아가기':'캐릭터만 보기'","active?'캐릭터 설정으로 돌아가기':'캐릭터만 크게 보기'")
    integration=integration.replace("active?'단어장 다시 표시하기':'단어장을 숨기고 캐릭터만 보기'","active?'캐릭터 설정 다시 표시하기':'설정을 접고 캐릭터만 크게 보기'")
    integration=integration.replace("'먼저 단어장 설정에서 모몽가를 켜 주세요'","'먼저 캐릭터 설정에서 모몽가를 켜 주세요'")
    # Study uses the real viewport engine, not an invisible dock/stage rectangle.
    integration=integration.replace('const B_LAYOUT_ENABLED=true;',"const B_LAYOUT_ENABLED=page==='settings';")
    integration=integration.replace('mobilePetStages:mobileStages,mobileStageViewport:mobileDock,',"mobilePetStages:page==='study'?null:mobileStages,mobileStageViewport:page==='study'?null:mobileDock,viewportOverlay:false,readOverlayObstacles:studyOverlayObstacles,floorWalk:true,readFloorWalkViewport:()=>floorLane?.getBoundingClientRect(),onFloorLayout:height=>{const value=(page==='settings'&&window.innerWidth<640&&!mobileDock.hidden?184:height)+'px';if(document.documentElement.style.getPropertyValue('--cv-floor-height')!==value)document.documentElement.style.setProperty('--cv-floor-height',value);},")
    integration=integration.replace('maxVisibleMobile:mobile.length,mobilePriority:mobile',"maxVisibleMobile:page==='study'?-1:mobile.length,mobilePriority:mobile")
    integration=integration.replace("const mobileDock=document.createElement('div');",(ROOT/'page-adapters/study-obstacles.js').read_text()+"\n"+(ROOT/'page-adapters/floor-page.js').read_text()+"\n  const mobileDock=document.createElement('div');")
    integration=integration.replace("    settingsRoot.append(visibilityTools,evidencePanel,previewPanel,pairPanel,directStatus);","    settingsRoot.append(visibilityTools,evidencePanel,previewPanel,pairPanel,directStatus,mobileDock);\n    document.body.classList.remove('cv-mobile-dock-enabled');")
    integration=replace_once(integration,'characterViewStage.insertBefore(mobileMotionToolbar,characterViewStage.firstChild);','characterViewStage.appendChild(mobileMotionToolbar);')
    integration=replace_once(integration,'  render();onChange(active);','  render();if(active)window.scrollTo(0,0);onChange(active);')
    # Home navigation remains reachable in settings' optional fullscreen preview.
    integration=replace_once(integration,'  syncMobileMotionToolbar();refreshGreeting();',"  syncMobileMotionToolbar();refreshGreeting();\n  if(page!=='settings'){settingsRoot.append(flightTools,greetingTools);}")
    # Shared original study/backup behavior with page-specific wiring.
    study=replace_once(study,"    const data = JSON.parse(document.getElementById('vocabulary').textContent);","    const data=window.CVVocabulary;const page=window.CVPage.page;let reviewFilter='all';")
    study=study.replace("el['undo-answer'].disabled = true;","if(el['undo-answer'])el['undo-answer'].disabled = true;")
    study=replace_once(study,"        localStorage.setItem(storageKey, JSON.stringify({ level, positions, answers }));","        const text=JSON.stringify({ level, positions, answers });localStorage.setItem(storageKey,text);lastStorageRaw=text;unsavedProgress=false;")
    study=replace_once(study,"        el['storage-note'].textContent = '브라우저 저장이 차단되어 있습니다. 현재 창에서만 기록이 유지됩니다.';","        unsavedProgress=true;el['storage-note'].textContent = '브라우저 저장이 차단되어 있습니다. 현재 창에서만 기록이 유지됩니다.';")
    study=replace_once(study,"      const filter = el['review-level'].value;","      const filter = el['review-level']?.value||reviewFilter;")
    study=replace_once(study,'    function renderHomeImpl() {','    function renderHomeImpl() {\n      if(!el.home)return;')
    study=replace_once(study,"      studyGuard.setPhase('home');\n      el.home.hidden = false; el.study.hidden = true;","      studyGuard.setPhase('home');\n      if(page==='study'){window.CVPage.go('index.html');return;}\n      el.home.hidden = false;")
    study=replace_once(study,"      level = key; mode = 'all';\n      el.home.hidden = true; el.study.hidden = false;","      if(!levels.includes(key))key=level;level = key; mode = 'all';\n      if(page!=='study'){save();window.CVPage.go('study.html?level='+encodeURIComponent(key),{restoreStudy:false});return;}\n      el.study.hidden = false;")
    study=replace_once(study,"      reviewIndex = index; reviewTotal = reviewIds.length; mode = 'review';\n      el.home.hidden = true; el.study.hidden = false;","      reviewIndex = Math.min(reviewIds.length-1,Math.max(0,Number.isInteger(index)?index:0)); reviewTotal = reviewIds.length; mode = 'review';\n      if(page!=='study'){reviewFilter=el['review-level'].value;window.CVPage.go('study.html?review='+encodeURIComponent(reviewFilter));return;}\n      el.study.hidden = false;")
    # Runtime restore is applied only after strict bounds and storage fingerprint checks.
    study=replace_once(study,'    // Optional local learning-record transfer.',(ROOT/'page-adapters/study-session.js').read_text()+'\n    // Optional local learning-record transfer.')
    study=replace_once(study,"    backupUI.export.addEventListener('click', () => {","    if(backupUI.export){\n    backupUI.export.addEventListener('click', () => {")
    study=replace_once(study,"        try { localStorage.setItem(storageKey, JSON.stringify(next)); }","        try { const text=JSON.stringify(next);localStorage.setItem(storageKey,text);lastStorageRaw=text;unsavedProgress=false;window.CVPage.clearStudy(); }")
    study=replace_once(study,"    el['go-home'].addEventListener('click', showHome);","    window.CVPage.beforeNavigate(()=>{clearBackup();backupMessage('페이지를 이동하여 적용하지 않은 복원 선택을 취소했습니다.');});\n    }\n    el['go-home']?.addEventListener('click', showHome);")
    for target in ["el['review-level']","el['start-review']","el.level","el.prev","el.next","el.known","el.unknown","el['undo-answer']"]:
        study=study.replace(target+".addEventListener(",target+"?.addEventListener(")
    study=study.replace(".cv-pet, #study-backup'",".cv-pet, #study-backup, #bgm-player, #continuous-walk-controls'")
    study=study.replace("if (el.study.hidden || event.altKey", "if (!el.study || el.study.hidden || event.altKey")
    study=study.replace("clearAnswerUndo(); renderHome();","clearAnswerUndo();reviewFilter=el['review-level'].value;renderHome();")
    study=replace_once(study,"    el['go-home']?.addEventListener('click', showHome);","    window.CVPage.beforeNavigate(url=>{if(url.pathname.endsWith('/index.html'))clearAnswerUndo();});\n    el['go-home']?.addEventListener('click', showHome);")
    # External updates are loaded before any whole-state mutation or undo.
    for name in ['showHome','startLevel','startReview','move','mark']:
        study=study.replace(f"studyGuard.run(()=>{name}Impl(...args))",f"studyGuard.run(()=>{{syncExternalState();if(storageConflict)return;return {name}Impl(...args);}})")
    study=study.replace("studyGuard.run(undoAnswerImpl)","studyGuard.run(()=>{if(!syncExternalState())undoAnswerImpl();else render('최신 기록으로 갱신되어 이전 답변 취소를 해제했습니다.');})")
    startup='''    if(page==='home'){
      const incoming=window.CVPage.incoming?.study;
      if(incoming?.unsaved&&incoming.state){adoptState(incoming.state);lastStorageRaw=incoming.fingerprint;unsavedProgress=true;}
      if(['all',...levels].includes(incoming?.transient?.reviewFilter)){reviewFilter=incoming.transient.reviewFilter;el['review-level'].value=reviewFilter;}
      showHome();
    }else{
      const incoming=window.CVPage.incoming?.study;
      if(incoming?.unsaved&&incoming.state){adoptState(incoming.state);lastStorageRaw=incoming.fingerprint;unsavedProgress=true;}
      const params=new URLSearchParams(location.search),requested=params.get('level'),review=params.get('review');
      if(unsavedProgress&&syncExternalState()&&storageConflict){studyGuard.setPhase('study');render('저장 충돌로 현재 창의 기록을 유지하고 있습니다. 위에서 먼저 백업해 주세요.');}
      else if(restoreContinuation(incoming)){}
      else if(levels.includes(requested))startLevel(requested);
      else if(['all',...levels].includes(review)){
        reviewFilter=review;const list=unknownWords();
        if(list.length)startReview(0);else{mode='review';reviewIds=[];reviewTotal=reviewIndex=0;studyGuard.setPhase('review');render();}
      }else startLevel(level);
    }
'''
    study=replace_once(study,'    showHome();\n  })();',startup+'  })();')
    (output/'app.css').write_text(styles)
    (output/'navigation.js').write_text((ROOT/'page-adapters/navigation.js').read_text())
    (output/'vocabulary.js').write_text('window.CVVocabulary='+data['vocabulary']+';\n')
    (output/'pet-data.js').write_text('window.CVPetData='+json.dumps({k:json.loads(v) for k,v in data.items() if k!='vocabulary'},ensure_ascii=False,separators=(',',':'))+';\n')
    integration=integration.replace("JSON.parse(document.getElementById('pet-sprites').textContent)","window.CVPetData['pet-sprites']").replace("JSON.parse(document.getElementById('pet-profiles').textContent)","window.CVPetData['pet-profiles']")
    (output/'pet-runtime.js').write_text(integration)
    (output/'study-runtime.js').write_text(study)
    (output/'bgm-player.js').write_text((ROOT/'page-adapters/bgm-player.js').read_text())
    for name in ['study-visibility.js','study-visibility.css']:(output/name).write_text((ROOT/'page-adapters'/name).read_text())
    bgm_markup=(ROOT/'page-adapters/bgm-player.html').read_text()
    from continuous_walk import build_continuous_script
    (output/'continuous-walk.js').write_text(build_continuous_script())
    asset_ref=lambda name:name+'?v='+sha((output/name).read_bytes())[:12]
    title={'home':'JLPT 단어장 · 시작','settings':'캐릭터 설정 · JLPT 단어장','study':'단어 공부 · JLPT 단어장'}
    for page,name,content in [('home','index.html',home+backup),('settings','character-settings.html','<section class="paper-panel cv-settings-intro"><h2>나와 함께할 친구들</h2><p>캐릭터·크기·배경·동작을 여기서 설정해요. 아래 미리보기와 캐릭터만 크게 보기에서 직접 확인할 수 있어요.</p><p>수동 동작·자동 날기·인사·카니 입력 동작은 페이지를 떠나면 멈춥니다. 새로고침하면 세션 전용 선택은 꺼집니다.</p></section>'),('study','study.html',study_markup)]:
        nav='<nav class="cv-page-nav" aria-label="페이지 이동">'+''.join(f'<a data-cv-link href="{p}"'+(' aria-current="page"' if p==name else '')+f'>{label}</a>' for p,label in [('index.html','시작'),('character-settings.html','캐릭터 설정'),('study.html','공부 이어하기')])+'</nav>'
        header='<header class="site-header"><p class="header-sticker" lang="ja">ひとつずつ、ゆっくり。</p><h1>'+title[page]+'</h1><p class="header-description">'+('내 속도로, 한 단어씩.' if page=='study' else '작은 한 걸음도 차곡차곡. 오늘도 내 속도로 공부해요.')+'</p><p id="storage-note">급수별 위치와 학습 기록은 이 브라우저에 자동 저장됩니다.</p>'+(controls if page=='settings' else '')+'</header>'
        modules=['navigation.js']+(['vocabulary.js','study-runtime.js'] if page=='home' else ['pet-data.js','pet-runtime.js']+(['vocabulary.js','study-runtime.js'] if page=='study' else []))+['bgm-player.js']+(['study-visibility.js','continuous-walk.js'] if page=='study' else [])
        markup='<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+title[page]+'</title><link rel="stylesheet" href="'+asset_ref('app.css')+'">'+('<link rel="stylesheet" href="'+asset_ref('study-visibility.css')+'">' if page=='study' else '')+'</head><body data-page="'+page+'">'+scenery+nav+'<p id="navigation-status" role="status" tabindex="-1"></p>'+header+'<main>'+bgm_markup+content+'</main>'+''.join('<script src="'+asset_ref(x)+'"></script>' for x in modules)+'</body></html>\n'
        (output/name).write_text(markup)
    (output/'.nojekyll').touch()
    report={'legacySha256':BASE_SHA,'vocabularySha256':sha(data['vocabulary'].encode()),'wordCount':sum(map(len,json.loads(data['vocabulary']).values())),'publicPNGCount':len(public),'existingSharedAssets':{'assets/bgm/chiikawa-mix.mp3':{'sha256':'ae49185bb5b7d0cfbfb9da0d24111d2566ba992580d3c73ec790e222809f0345','bytes':23808500,'gitBlob':'e74e698356d0d7dbd4e2d29ce14a7a8b22001659','preserveExisting':True}},'files':{str(p.relative_to(output)):{'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} for p in sorted(output.rglob('*')) if p.is_file() and p.name!='manifest.json'}}
    (output/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='files'},indent=2))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',default=str(ROOT.parent/'site'));args=parser.parse_args();build(args.output)
