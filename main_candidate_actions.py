"""Opt-in normal-actor action routing. Native presenter files remain byte-exact."""
import re,hashlib

def once(s,a,b):
    if s.count(a)!=1:raise ValueError('Candidate action target mismatch: '+a[:70]+' count='+str(s.count(a)))
    return s.replace(a,b,1)

def adapt_engine_candidate_actions(s,root):
    if '  const ReviewedStep=' in s:
        a,b=s.split('  const ReviewedStep=',1);return adapt_engine_candidate_actions(a,root)+'  const ReviewedStep='+b
    s=once(s,'displayScalePercents = null,','displayScalePercents = null, candidateActions = null,')
    old='  const paintRect=(p,x=p.x,y=p.y)=>paddedGeometry(p,x,y)?.outer??{left:x,top:y,right:x+p.width,bottom:y+p.height,width:p.width,height:p.height};'
    helper=(root/'chiikawa-pets/candidate-sequences/engine-host.js').read_text().rstrip()
    walkOld=old.replace('=>paddedGeometry',"=>continuousWalk&&p.id==='chiikawa'?chiFootReviewBounds({...p,x,y}):paddedGeometry")
    if walkOld in s:
        helper=helper.replace('  const originalPaintRect='+old.split('  const paintRect=',1)[1],walkOld.replace('  const paintRect=','  const originalPaintRect='))
        old=walkOld
    s=once(s,old,helper)
    s=once(s,"function start(p, action, fallback = 'idle', duration = .6, next = null) {","function start(p, action, fallback = 'idle', duration = .6, next = null, providedSequence = null) {\n    if(!providedSequence)cancelCandidate(p,'other-action');")
    s=once(s,"const sequence = !reduced && !manualPaused ? sequenceFor(p, action, direction) : null;","const sequence = !reduced && !manualPaused ? (providedSequence??sequenceFor(p, action, direction)) : null;")
    s=once(s,"function idle(p) {","function idle(p) { cancelCandidate(p);")
    s=once(s,"    p.captureVisual?.cancel('capture-release');","    p.captureVisual?.cancel('capture-release');\n    cancelCandidate(p,'capture-release');")
    old='    a.elapsed += dt;'
    new='''    if(a.sequence?.candidate){
      a.elapsed+=dt;
      const sample=samplePetSequence(a.sequence,a.elapsed*1000),session=p.candidateSession;
      if(!session||sample.index<(session.index??0)||sample.index>(session.index??0)+1){cancelCandidate(p,'candidate-missed-frame');return;}
      if(sample.done){idle(p);return;}
      if(!candidateFrame(p,sample.index))return;
      return;
    }
'''+old
    s=once(s,old,new)
    old='    p.el.style.transform = `translate3d(${hit.left.toFixed(1)}px, ${hit.top.toFixed(1)}px, 0)`;'
    new='    const rootPaint=p.candidateSession?originalPaintRect(p):hit;\n    p.el.style.transform = `translate3d(${rootPaint.left.toFixed(1)}px, ${rootPaint.top.toFixed(1)}px, 0)`;'
    s=once(s,old,new)
    s=once(s,"    if(!painted||blocked)inlineFor(p)?.cancel('paint-ineligible');","    if(!painted||blocked)inlineFor(p)?.cancel('paint-ineligible');\n    if(p.candidateSession)candidateFrame(p,p.candidateSession.index);")
    s=once(s,'    react, playAction, pause()', '    playCandidateAction, react, playAction, pause()')
    s=once(s,'for(const p of pets)p.captureVisual?.destroy();','for(const p of pets)p.captureVisual?.destroy();candidateActions?.destroy();')
    needle='  layout(); root.dataset.paused = String(paused()); started = true; wake();'
    setup='''  if(candidateActions){
    root.dataset.candidateReview='loading';
    void candidateActions.prepare().then(ok=>{if(!destroyed){root.dataset.candidateReview=ok?'ready':'unavailable';invalidate();}});
    for(const type of ['pointerdown','keydown','beforeinput','compositionstart','play'])listen(document,type,()=>{for(const p of pets)cancelCandidate(p,'input-priority');},{capture:true,passive:true});
  }
'''
    return once(s,needle,setup+needle)

def candidate_module(root):
    folder=root/'chiikawa-pets/candidate-sequences'
    for name,expected in [('candidate-presenter.mjs','73c114cb57871aa85d20b5b30d8dbcd9df31755bf647002654acda6fd58498cc'),('candidate-registry.mjs','144cbddd86c6ba32e3644ecc8ebcd769c904f63957b5ba6b702d16c3dfd9bb33')]:
        if hashlib.sha256((folder/name).read_bytes()).hexdigest()!=expected:raise ValueError('Native candidate module identity changed')
    registry=(folder/'candidate-registry.mjs').read_text().replace('export const CANDIDATE_REGISTRY = freeze(','return freeze(')
    presenter=(folder/'candidate-presenter.mjs').read_text();presenter=re.sub(r'^import .*?;\n|^export \{CANDIDATE_REGISTRY\};\n','',presenter,flags=re.M);presenter=presenter.replace('export function ','function ').replace('export const ','const ')
    service=(folder/'action-source.mjs').read_text();service=re.sub(r'^import .*?;\n','',service,flags=re.M).replace('export function ','function ')
    return '(()=>{const CANDIDATE_REGISTRY=(()=>{'+registry+'})();\n'+presenter+'\n'+service+';return{createCandidateActionSource};})()'

def adapt_integration_candidate_actions(s,root):
    needle='    pets=mountChiikawaPets({spriteSources,characterProfiles,'
    setup="    const candidateActions=document.body.dataset.frameReview==='hachiware'?"+candidate_module(root)+".createCandidateActionSource({enabled:true,characters:['hachiware'],assetBaseURL:new URL('animation-candidates-20261027/',document.baseURI).href}):null;\n"
    s=once(s,needle,setup+'    pets=mountChiikawaPets({candidateActions,spriteSources,characterProfiles,')
    return once(s,'onDeliberateInteraction:(id,input)=>{','onDeliberateInteraction:(id,input)=>{if(candidateActions&&!input.repeat&&pets?.playCandidateAction?.(id))return true;')

def adapt_main_candidate_actions(s,root):
    return adapt_integration_candidate_actions(adapt_engine_candidate_actions(s,root),root)
