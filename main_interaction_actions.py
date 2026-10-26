"""Bind existing ordinary actor input states to prepared frame sequences.

Asset/fragment registration is supplied separately through profile.inputSequences.
No autonomous probabilities or operational selection are changed here.
"""
from main_candidate_actions import once


def input_helpers(root):
    return (root/'chiikawa-pets/candidate-sequences/input-sequences.mjs').read_text().replace('export function ', 'function ').replace('export const ', 'const ')


def adapt_engine_input_sequences(s, root):
    if '  const ReviewedStep=' in s:
        a,b=s.split('  const ReviewedStep=',1)
        return adapt_engine_input_sequences(a,root)+'  const ReviewedStep='+b
    marker='  const sequenceFor = (p, action, direction = p.dir < 0 ? \'left\' : \'right\') => resolvePetSequence(profile(p), action, direction, { allowDraft: isBeta(p) });'
    helpers=input_helpers(root)+'''
  const inputReady=new Set();
  const inputSequenceFor=(p,state)=>{const sequence=resolveActorInputSequence(profile(p),state,p.dir<0?'left':'right');return sequence&&sequence.frames.every(f=>inputReady.has(f.source))?sequence:null;};
  function clearInputFrame(p,reason='state-change') {
    p.inputFrame=null;p.inputLastBounds=null;
    if(p.inputSavedStyle){Object.assign(p.el.style,p.inputSavedStyle.root);Object.assign(p.figure.style,p.inputSavedStyle.figure);p.inputSavedStyle=null;}
    p.el.dataset.interactionFallback=reason;
  }
  function inputPaintRect(p,x,y,original) {
    const bounds=inputFrameBounds(p.inputFrame,{x,y,width:p.width,height:p.height});
    return bounds?candidateUnion(original,bounds):original;
  }
  function inputFrameSafe(p,frame) {
    if(destroyed||document.hidden||paused()||p.el.hidden||!requestedVisible.has(p.id)||p.assetUnavailable||externalPresentation||presentationRegistry.get()||failed.has(frame.source))return false;
    const active=document.activeElement,study=readStudyState?.();
    if(active?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(active?.tagName)||study&&(study.busy||study.composing||study.audioPending||study.transactionDepth>0)||!candidateStyleSafe(p))return false;
    if(p.pointerId!==null&&p.el.hasPointerCapture?.(p.pointerId)!==true)return false;
    dirty=true;refreshObstacles();
    const bounds=inputFrameBounds(frame,p);if(!bounds)return false;
    const original=originalPaintRect(p),swept=candidateUnion(original,bounds,...(p.inputLastBounds?[p.inputLastBounds]:[]));
    const v=viewport(),stage=stageRect(p),dock=mobileStage(p)&&mobileStageViewport?mobileStageViewport.getBoundingClientRect():null;
    // The floor host already grants owned lift on successful direct capture only.
    // Other input sequences keep the actual owned viewport/clip and UI protection.
    const lift=p.floorInputLift===true,clips=lift?[]:[stage,dock].filter(Boolean);
    const view={left:Math.max(0,...clips.map(r=>r.left)),top:Math.max(0,...clips.map(r=>r.top)),right:Math.min(v.w,...clips.map(r=>r.right)),bottom:Math.min(v.h,...clips.map(r=>r.bottom))};
    if(swept.left<view.left+4.25||swept.top<view.top+4.25||swept.right>view.right-4.25||swept.bottom>view.bottom-4.25)return false;
    const avoid=[...(lift?[]:obstacles),...pets.filter(q=>q!==p&&!q.el.hidden&&!q.assetUnavailable).map(q=>paintRect(q))];
    if(avoid.some(r=>swept.left<r.right+4.25&&swept.right>r.left-4.25&&swept.top<r.bottom+4.25&&swept.bottom>r.top-4.25))return false;
    return true;
  }
  function paintInputFrame(p,frame) {
    if(!inputFrameSafe(p,frame))return false;
    if(!p.inputSavedStyle){const fields=(el,keys)=>Object.fromEntries(keys.map(k=>[k,el.style[k]||'']));p.inputSavedStyle={root:fields(p.el,['width','height','overflow']),figure:fields(p.figure,['position','left','top','width','height'])};}
    p.inputLastBounds=inputFrameBounds(frame,p);
    p.inputFrame=frame;display(p,frame.frameId,frame.source,p.action?.sequence?.distinctDrawings===1?'input-frame-static':'input-frame-sequence',frame);
    p.el.dataset.interactionFallback='';return true;
  }
  function playInputAction(id,state='tap') {
    if(state==='walk'&&candidateActions?.has(id))return playCandidateAction(id);
    const p=pets.find(p=>p.id===id),sequence=p&&inputSequenceFor(p,state);
    if(!p||!sequence||!['tap','walk'].includes(state)||paused()||p.pointerId!==null||p.touch||PHYSICAL.has(p.mode)||!onScreen(p)||!ownedAdmission(p)||!inputFrameSafe(p,sequence.frames[0]))return false;
    cancelPair();pending=null;
    const duration=sequence.frames.reduce((n,f)=>n+f.durationMs,0)/1000;
    start(p,state==='tap'?'start':'input-walk','idle',duration,null,{...sequence,loop:false});return true;
  }
  function inputPress(p){
    const sequence=inputSequenceFor(p,'press');
    if(sequence)start(p,'press','idle',Infinity,null,sequence);
    else {p.el.dataset.interactionState='press';p.el.dataset.interactionFallback='missing-press-frames';}
  }
'''
    s=once(s,marker,helpers+'\n'+marker)
    s=once(s,'if(!p.candidateSession)return original;','if(!p.candidateSession)return inputPaintRect(p,x,y,original);')
    s=once(s,"    if (frame?.assetSize) {", """    if(frame?.paint&&validInputFramePaint(frame.paint)) {
      const f=frame.paint,k=p.width/f.referenceWidth;
      Object.assign(p.img.style,{position:'absolute',objectFit:'fill',width:(f.width*k)+'px',height:(f.height*k)+'px',maxWidth:'none',left:(f.left*k)+'px',top:(f.top*k)+'px',clipPath:f.clipInset?`inset(${f.clipInset.map(n=>n*k+'px').join(' ')})`:'none'});
    } else if (frame?.assetSize) {""")
    s=once(s,"    inlineFor(p)?.cancel('other-action');", "    inlineFor(p)?.cancel('other-action');\n    const previousInputBounds=p.inputLastBounds;clearInputFrame(p);")
    s=once(s,"(providedSequence??sequenceFor(p, action, direction))", "(providedSequence??(PHYSICAL.has(action)?inputSequenceFor(p,action):null)??sequenceFor(p, action, direction))")
    s=once(s,"    mode(p, action); pose(p, fallback);", "    mode(p, action); pose(p, fallback);\n    if(sequence?.inputOnly)p.inputLastBounds=previousInputBounds;\n    p.el.dataset.interactionState=inputSequenceState(action);\n    p.el.dataset.interactionFallback=sequence?'':('missing-'+inputSequenceState(action)+'-frames');")
    s=once(s,"function idle(p) { cancelCandidate(p);", "function idle(p) { clearInputFrame(p,'idle');p.el.dataset.interactionState='idle';cancelCandidate(p);")
    s=once(s,'    a.elapsed += dt;', '''    if(a.sequence?.inputOnly){
      a.elapsed+=dt;const sample=inputSequenceSample(a.sequence,a.elapsed*1000);
      if(sample&&a.sequence.state==='walk'&&dt>0){
        const old=p.x;p.x=constrainX(p,p.x+p.dir*16*dt);
        if(p.x===old||!inputFrameSafe(p,sample.frame)){p.x=old;idle(p);p.el.dataset.interactionFallback='walk-path-blocked';return;}
      }
      if(!sample||a.inputSlot!==undefined&&(sample.slot<a.inputSlot||sample.slot>a.inputSlot+1)||!paintInputFrame(p,sample.frame)){
        clearInputFrame(p,'input-sequence-unavailable-or-unsafe');a.sequence=null;pose(p,a.fallback);
      }else{
        a.inputSlot=sample.slot;
        if(!sample.done||a.id==='hold'||a.id==='fall')return;
        const next=a.next;p.action=null;clearInputFrame(p,'sequence-ended');if(next)next();else idle(p);return;
      }
    }else a.elapsed += dt;''')
    s=once(s,"    if(p.capturePose&&p.pointerId!==null)","    if(p.capturePose&&!p.inputFrame&&p.pointerId!==null)")
    s=once(s,'    refreshObstacles();syncStagePosition(p);\n    syncScaleAvailability(p);', "    refreshObstacles();syncStagePosition(p);\n    if(p.inputFrame&&!inputFrameSafe(p,p.inputFrame)){clearInputFrame(p,'input-paint-changed');if(p.action)p.action.sequence=null;pose(p,p.action?.fallback??'idle');}\n    syncScaleAvailability(p);")
    s=once(s,'    const rootPaint=p.candidateSession?originalPaintRect(p):hit;', '''    if(p.inputFrame){
      Object.assign(p.el.style,{width:hit.width+'px',height:hit.height+'px',overflow:'hidden'});
      Object.assign(p.figure.style,{position:'absolute',left:(p.x-hit.left)+'px',top:(p.y-hit.top)+'px',width:p.width+'px',height:p.height+'px'});
    }
    if(p.candidateSession){
      Object.assign(p.el.style,{width:hit.width+'px',height:hit.height+'px',overflow:'hidden'});
      Object.assign(p.figure.style,{position:'absolute',left:(p.x-hit.left)+'px',top:(p.y-hit.top)+'px',width:p.width+'px',height:p.height+'px'});
    }
    const rootPaint=hit;''')
    s=once(s,"    p.captureVisual?.cancel('capture-release');", "    clearInputFrame(p,'capture-release');\n    p.captureVisual?.cancel('capture-release');")
    s=once(s,"    if(p.id!=='chiikawa')return null;", "    if(p.id!=='chiikawa'||inputSequenceFor(p,'grab')||inputSequenceFor(p,'held'))return null;")
    s=once(s,"    inlineFor(p)?.cancel('pointer-intent');", "    inlineFor(p)?.cancel('pointer-intent');\n    if(p.action?.sequence?.inputOnly&&!PHYSICAL.has(p.mode))idle(p);")
    s=once(s,"at: performance.now() }; wake(); return; }", "at: performance.now() }; inputPress(p);wake(); return; }")
    s=once(s,"(inlineFor(p)||decorativeStage(p))", "(inlineFor(p)||decorativeStage(p)||profile(p).inputSequences?.actions?.tap)")
    s=once(s,"at:performance.now()};wake();return;", "at:performance.now()};inputPress(p);wake();return;")
    s=once(s,'      const press = p.touch; p.touch = null;', "      const press = p.touch; p.touch = null;if(p.action?.id==='press')idle(p);")
    s=once(s,'  function reaction(p, type, duration) {', '''  // Decode readiness never starts or restarts an action. Only subsequent ordinary input may do so.
  for(const p of pets)for(const entry of Object.values(profile(p).inputSequences?.actions??{})){
    const views=entry.views?Object.values(entry.views):[entry];
    for(const view of views)for(const frame of view.frames??[]){
      if(preloads.some(im=>im.inputSource===frame.source))continue;
      const im=new Image();im.inputSource=frame.source;preloads.push(im);im.src=frame.source;
      void im.decode().then(()=>{if(!destroyed&&im.naturalWidth===frame.assetSize?.[0]&&im.naturalHeight===frame.assetSize?.[1])inputReady.add(frame.source);},()=>{if(!destroyed)failed.add(frame.source);});
    }
  }
  function reaction(p, type, duration) {''')
    s=once(s,"    const weights = availablePetWeights(profile(p).behavior ?? { idle: 100 }, profile(p), { allowDraft: isBeta(p) });", """    const configured=profile(p).behavior??{idle:100},weights=availablePetWeights(configured,profile(p),{allowDraft:isBeta(p)});
    // Assembly reuses the existing walk percentage. Missing walk art stays idle.
    // Input/candidate sequences are finite, and never promote manifest loop flags.
    if(profile(p).inputSequences?.enabled===true&&(candidateActions?.has(p.id)||inputSequenceFor(p,'walk'))&&!sequenceFor(p,'walk','right')&&!sequenceFor(p,'walk','left')){weights.idle-=configured.walk??0;weights.walk=configured.walk??0;}""")
    s=once(s,"    if (action === 'walk') {\n      p.dir", "    if (action === 'walk'&&profile(p).inputSequences?.enabled===true){p.dir=Math.random()<.5?-1:1;if(!playInputAction(p.id,'walk'))p.wait=1;return;}\n    if (action === 'walk') {\n      p.dir")
    s=once(s,"    const p = pets.find(p => p.id === target);\n    if (!p || !isBeta(p)", "    const p = pets.find(p => p.id === target);\n    if(action==='walk'&&p&&!isBeta(p))return playInputAction(p.id,'walk');\n    if (!p || !isBeta(p)")
    # Candidate presenter plans remain exact; the host owns this bounded root step.
    s=once(s,"if(session&&(p.x!==session.x||p.y!==session.y||p.width!==session.width||p.height!==session.height))return false;", "if(session&&(p.y!==session.y||p.width!==session.width||p.height!==session.height))return false;")
    s=once(s,'    // This first integration is stationary. Any root/size/geometry change cancels;\n    // stationary endpoint fits never authorize locomotion or a teleported exit.', '    // Every horizontal step protects the previous/current full canvas union.\n    // Size, vertical anchor, revision and owned geometry changes still cancel.')
    s=once(s,"left:(image.left+p.x-rootPaint.left)+'px',top:(image.top+p.y-rootPaint.top)+'px'", "left:image.left+'px',top:image.top+'px'")
    s=once(s,"      if(sample.done){idle(p);return;}\n      if(!candidateFrame", """      if(sample.done){idle(p);return;}
      if(dt>0){const old=p.x;p.x=constrainX(p,p.x+p.dir*16*dt);const plan=candidatePlan(p,sample.index);if(p.x===old||!candidatePaintSafe(p,plan)){p.x=old;cancelCandidate(p,'candidate-path-blocked');return;}}
      if(!candidateFrame""")
    s=once(s,"    if(a.sequence?.candidate){\n      a.elapsed+=dt;", "    if(a.sequence?.candidate){\n      if(!Number.isFinite(dt)||dt<0||!Number.isFinite(a.elapsed)){cancelCandidate(p,'candidate-invalid-clock');return;}\n      a.elapsed+=dt;")
    # Source bindings reuse ordinary actions, with no extra review button.
    s=once(s,'    playCandidateAction, react, playAction, pause()', '    playInputAction, playCandidateAction, react, playAction, pause()')
    s=once(s,'assetMode: p.el.dataset.assetMode, assetUnavailable:', 'assetMode: p.el.dataset.assetMode, interactionState:p.el.dataset.interactionState??p.mode, interactionFallback:p.el.dataset.interactionFallback??null, assetUnavailable:')
    return s


def adapt_integration_input_sequences(s):
    s=once(s,"enabled:true,characters:['hachiware'],assetBaseURL:", "enabled:true,characters:document.body.dataset.interactionAssembly==='true'?['hachiware','usagi','shisa','rakko']:['hachiware'],assetBaseURL:")
    s=once(s,"document.body.dataset.frameReview==='hachiware'?", "(document.body.dataset.interactionAssembly==='true'||document.body.dataset.frameReview==='hachiware')?")
    return once(s,"onDeliberateInteraction:(id,input)=>{if(candidateActions", "onDeliberateInteraction:(id,input)=>{if(!input.repeat&&pets?.playInputAction?.(id,'tap'))return true;if(candidateActions&&!characterProfiles[id]?.inputSequences?.actions?.tap")


def adapt_main_input_sequences(s,root):
    return adapt_integration_input_sequences(adapt_engine_input_sequences(s,root))
