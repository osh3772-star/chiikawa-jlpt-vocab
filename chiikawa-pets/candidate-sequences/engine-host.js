  // Review-only ordinary-action channel. Candidate art never enters probabilities.
  const originalPaintRect=(p,x=p.x,y=p.y)=>paddedGeometry(p,x,y)?.outer??{left:x,top:y,right:x+p.width,bottom:y+p.height,width:p.width,height:p.height};
  const candidateUnion=(...rs)=>{const left=Math.min(...rs.map(r=>r.left)),top=Math.min(...rs.map(r=>r.top)),right=Math.max(...rs.map(r=>r.right)),bottom=Math.max(...rs.map(r=>r.bottom));return{left,top,right,bottom,width:right-left,height:bottom-top};};
  const candidateOwner=p=>!!p.candidateSession&&presentationRegistry.owns(p.candidateSession.lease);
  function candidatePlan(p,index,x=p.x,y=p.y){return candidateActions?.plan(p.id,index,{id:p.id,x,y,width:p.width,height:p.height},originalPaintRect(p,x,y))??null;}
  function paintRect(p,x=p.x,y=p.y){
    const original=originalPaintRect(p,x,y);
    if(!p.candidateSession)return original;
    const plan=candidatePlan(p,p.candidateSession.index,x,y);
    return plan?plan.protectedPaintBounds:p.candidateSession.lastPlan?candidateUnion(original,p.candidateSession.lastPlan.protectedPaintBounds):original;
  }
  function candidateViewport(p){
    const v=viewport();let view={left:0,top:0,right:v.w,bottom:v.h};
    const stage=stageRect(p),dock=mobileStage(p)&&mobileStageViewport?mobileStageViewport.getBoundingClientRect():null;
    const floor=typeof readFloorWalkViewport==='function'?readFloorWalkViewport():null;
    for(const clip of [stage,dock,floor].filter(Boolean)){view={left:Math.max(view.left,clip.left),top:Math.max(view.top,clip.top),right:Math.min(view.right,clip.right),bottom:Math.min(view.bottom,clip.bottom)};}
    return view;
  }
  function candidateObstacles(p){return [...obstacles,...pets.filter(q=>q!==p&&!q.el.hidden&&!q.assetUnavailable).map(q=>paintRect(q))];}
  function candidateStyleSafe(p){
    try{
      for(const el of [document.documentElement,document.body,root]){
        if(!el)return false;const style=getComputedStyle(el);
        for(const key of ['transform','filter','perspective','backdropFilter','clipPath','maskImage','webkitMaskImage','translate','rotate','scale'])if(style[key]&&style[key]!=='none')return false;
        if(style.zoom&&style.zoom!=='normal'&&Number(style.zoom)!==1)return false;
        if(el!==root&&style.contain&&style.contain!=='none'||style.contentVisibility&&style.contentVisibility!=='visible')return false;
      }
      for(const el of [p.figure,p.img]){const style=getComputedStyle(el);for(const key of ['transform','filter','perspective','backdropFilter','maskImage','webkitMaskImage','boxShadow','textShadow'])if(style[key]&&style[key]!=='none')return false;}
      return true;
    }catch{return false;}
  }
  function candidateContextSafe(p){
    if(destroyed||document.hidden||paused()||p.el.hidden||p.assetUnavailable||p.scalePlacementUnavailable||p.pointerId!==null||p.touch||p.airborne||PHYSICAL.has(p.mode)||externalPresentation||pair||pending||isBeta(p))return false;
    if(pets.some(q=>q!==p&&(q.pointerId!==null||q.touch||q.airborne||PHYSICAL.has(q.mode))))return false;
    if(presentationRegistry.get()&&!candidateOwner(p))return false;
    const active=document.activeElement;
    if(active?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(active?.tagName))return false;
    if(!candidateStyleSafe(p))return false;
    const study=readStudyState?.();
    if(study&&(study.busy||study.composing||study.audioPending||study.transactionDepth>0))return false;
    if(document.getElementById?.('bgm-play')?.getAttribute('aria-pressed')==='true')return false;
    return true;
  }
  function candidatePaintSafe(p,plan){
    dirty=true;refreshObstacles();
    if(!plan||!candidateContextSafe(p))return false;
    const session=p.candidateSession;
    // This first integration is stationary. Any root/size/geometry change cancels;
    // stationary endpoint fits never authorize locomotion or a teleported exit.
    if(session&&(p.x!==session.x||p.y!==session.y||p.width!==session.width||p.height!==session.height))return false;
    const view=candidateViewport(p),avoid=candidateObstacles(p);
    const revision=readStudyState?.()?.revision??null;
    const geometryKey=JSON.stringify([view,...avoid.map(r=>[r.left,r.top,r.right,r.bottom])]);
    if(session&&(revision!==session.revision||geometryKey!==session.geometryKey))return false;
    if(!candidateActions.fits(plan,view,avoid,4.25))return false;
    const swept=candidateUnion(originalPaintRect(p),plan.protectedPaintBounds,...(session?.lastPlan?[session.lastPlan.protectedPaintBounds]:[]));
    if(![swept.left,swept.top,swept.right,swept.bottom].every(Number.isFinite)||swept.left<view.left+4.25||swept.top<view.top+4.25||swept.right>view.right-4.25||swept.bottom>view.bottom-4.25||avoid.some(o=>swept.left<o.right+4.25&&swept.right>o.left-4.25&&swept.top<o.bottom+4.25&&swept.bottom>o.top-4.25))return false;
    return true;
  }
  function cancelCandidate(p,reason='candidate-ended'){
    const session=p.candidateSession;if(!session)return;
    // Fresh original bounds are inspected at the current root. Never restore old
    // x/y, selection or scale; normal render/yielding still protects changed UI.
    const exit=candidatePlan(p,session.index);const exitSafe=!!exit&&candidatePaintSafe(p,exit);
    p.candidateSession=null;presentationRegistry.release(session.lease);
    p.el.dataset.candidateLastReason=reason;p.el.dataset.candidateExitSafe=String(exitSafe);
    delete p.el.dataset.candidateFrame;
    if(p.action?.sequence?.candidate){p.action=null;mode(p,'idle');pose(p);}
  }
  function candidateFrame(p,index){
    const session=p.candidateSession;if(!session)return false;
    if(!candidateOwner(p)){cancelCandidate(p,'candidate-owner-lost');return false;}
    const plan=candidatePlan(p,index);
    if(!plan||failed.has(plan.url)||!candidatePaintSafe(p,plan)){cancelCandidate(p,'candidate-context-or-paint');return false;}
    session.index=index;session.lastPlan=plan;
    display(p,'candidate-step-'+plan.poseId,plan.url,'authored-candidate-sequence');
    const rootPaint=originalPaintRect(p),image=plan.image;
    Object.assign(p.img.style,{position:'absolute',maxWidth:'none',objectFit:image.objectFit,left:(image.left+p.x-rootPaint.left)+'px',top:(image.top+p.y-rootPaint.top)+'px',width:image.width+'px',height:image.height+'px',clipPath:image.clipPath});
    p.el.dataset.candidateFrame=plan.poseId;return true;
  }
  function playCandidateAction(id){
    const p=pets.find(p=>p.id===id);
    if(!p||!candidateActions?.has(id)||p.mode!=='idle'||p.action||!candidateContextSafe(p))return false;
    const sequence=candidateActions.sequence(id),first=candidatePlan(p,0);
    if(!sequence||!candidatePaintSafe(p,first))return false;
    const lease=presentationRegistry.acquire('single',[id]);if(!lease)return false;
    p.candidateSession={lease,index:0,lastPlan:null,x:p.x,y:p.y,width:p.width,height:p.height,revision:readStudyState?.()?.revision??null,geometryKey:JSON.stringify([candidateViewport(p),...candidateObstacles(p).map(r=>[r.left,r.top,r.right,r.bottom])])};
    if(!candidatePaintSafe(p,candidatePlan(p,0))){cancelCandidate(p,'candidate-acquire-changed');return false;}
    start(p,'candidate-step','idle',.96,null,sequence);return !!p.candidateSession;
  }
