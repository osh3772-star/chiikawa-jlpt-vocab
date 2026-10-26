"""Keep an explicitly owned floor drag visible above study content; no idle exemption."""
def once(s,a,b):
    assert s.count(a)==1,(a[:100],s.count(a));return s.replace(a,b,1)
def adapt_floor_drag(s):
    if '  const ReviewedStep=' in s:
        a,b=s.split('  const ReviewedStep=',1);return adapt_floor_drag(a)+'  const ReviewedStep='+b
    helper='''  let floorClickSuppression=null;
  function floorOwnedLift(p){return floorWalk&&p.floorInputLift===true&&(p.pointerId!==null||p.airborne||PHYSICAL.has(p.mode));}
  function syncFloorLiftLayer(){if(floorWalk)root.dataset.floorLift=String(pets.some(floorOwnedLift));}
  function suppressFloorReleaseClick(e){
    const pending=floorClickSuppression;if(!pending)return;
    if(performance.now()>pending.until){floorClickSuppression=null;return;}
    if(e.detail===0||!Number.isFinite(e.clientX)||!Number.isFinite(e.clientY))return;
    if(Number.isFinite(e.pointerId)&&e.pointerId>0&&e.pointerId!==pending.pointerId)return;
    if(Math.hypot(e.clientX-pending.x,e.clientY-pending.y)>12)return;
    floorClickSuppression=null;e.preventDefault();e.stopImmediatePropagation();
  }
'''
    s=once(s,'  function onScreen(p) {',helper+'  function onScreen(p) {')
    a=s.index('  function onScreen(p) {');b=s.index('  function ownedAdmission',a);part=s[a:b]
    part=once(part,'const dock = mobileStage(p)', 'const dock = !floorOwnedLift(p) && mobileStage(p)')
    part=once(part,'const ownedStage=sourceStage&&','const ownedStage=!floorOwnedLift(p)&&sourceStage&&')
    s=s[:a]+part+s[b:]
    s=once(s,"function idle(p) { inlineFor(p)?.cancel('idle');", "function idle(p) { p.floorInputLift=false;syncFloorLiftLayer();inlineFor(p)?.cancel('idle');")
    s=once(s,'try { p.el.setPointerCapture(e.pointerId); } catch (_) { p.pointerId = null; return; }','try { p.el.setPointerCapture(e.pointerId); } catch (_) { p.pointerId = null; return; }\n    p.floorInputLift=floorWalk&&!decorativeStage(p)&&!isBeta(p);')
    s=once(s,'    if (p.pointerId !== e.pointerId) return;\n    releaseCapture(p);','    if (p.pointerId !== e.pointerId) return;\n    if(floorOwnedLift(p)&&!cancelled&&Number.isFinite(e.clientX)&&Number.isFinite(e.clientY))floorClickSuppression={pointerId:e.pointerId,x:e.clientX,y:e.clientY,until:performance.now()+600};\n    releaseCapture(p);')
    a=s.index('  function render(p) {');b=s.index('  function captureVisualFor',a);part=s[a:b]
    part=once(part,'const dock = mobileStage(p)','const lifted=floorOwnedLift(p);p.el.dataset.floorLift=String(lifted);p.el.style.pointerEvents=lifted&&p.pointerId===null?\'none\':\'\';syncFloorLiftLayer();\n    const dock = !lifted && mobileStage(p)')
    part=once(part,'const ownedPresentation=ownedViewportGeometry?.','const ownedPresentation=!lifted&&ownedViewportGeometry?.')
    part=once(part,'const blocked = (viewportOverlay','const blocked = !lifted && (viewportOverlay')
    s=s[:a]+part+s[b:]
    s=once(s,'  layout(); root.dataset.paused = String(paused()); started = true; wake();',"  if(floorWalk){listen(document,'pointerdown',()=>{floorClickSuppression=null;},{capture:true,passive:true});listen(document,'click',suppressFloorReleaseClick,{capture:true});}\n  layout(); root.dataset.paused = String(paused()); started = true; wake();")
    return s
