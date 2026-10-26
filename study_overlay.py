"""Narrow opt-in engine adaptation; default/settings engine behavior is unchanged."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
def once(text,old,new):
    assert text.count(old)==1,(old[:100],text.count(old));return text.replace(old,new,1)
def adapt_engine(text):
    if '  const ReviewedStep=' in text:
        head,tail=text.split('  const ReviewedStep=',1);return adapt_engine(head)+'  const ReviewedStep='+tail
    text=once(text,'export function mountChiikawaPets(options = {}) {','export function mountChiikawaPets(options = {}) {') if 'export function mountChiikawaPets' in text else text
    text=once(text,'    ownedViewportGeometry = null, avoidSelector =', '    viewportOverlay = false, readOverlayObstacles = null, ownedViewportGeometry = null, avoidSelector =')
    text=once(text,'  const listeners = [], pets = [], preloads = [], failed = new Set(), seen = new Map();','  let overlayRevision=0;\n  const listeners = [], pets = [], preloads = [], failed = new Set(), seen = new Map();')
    text=once(text,'p.assetUnavailable || p.scalePlacementUnavailable || document.hidden','p.assetUnavailable || p.scalePlacementUnavailable || p.overlayUnavailable || document.hidden')
    old="  function refreshObstacles() { if (dirty) { obstacles = [...document.querySelectorAll(avoidSelector)].filter(petObstacleIsDisplayed).map(el => ownedViewportGeometry?.obstacleRect(el,el.getBoundingClientRect())??el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0); dirty = false; } }"
    new="  function refreshObstacles() { if (dirty) { const custom=viewportOverlay&&typeof readOverlayObstacles==='function'?readOverlayObstacles():null;obstacles=custom??[...document.querySelectorAll(avoidSelector)].filter(petObstacleIsDisplayed).map(el => ownedViewportGeometry?.obstacleRect(el,el.getBoundingClientRect())??el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);overlayRevision++;dirty = false; } }"
    text=once(text,old,new)
    helper=(ROOT/'page-adapters/study-overlay.js').read_text()+'''
  function syncOverlayPlacement(p){
    if(!viewportOverlay||p.el.hidden||stageRect(p))return;
    const hit=paintRect(p),v=viewport(),visual=window.visualViewport;
    const bounds=visual&&[visual.offsetLeft,visual.offsetTop,visual.width,visual.height].every(Number.isFinite)&&visual.width>0&&visual.height>0?{left:Math.max(0,visual.offsetLeft),top:Math.max(0,visual.offsetTop),right:Math.min(v.w,visual.offsetLeft+visual.width),bottom:Math.min(v.h,visual.offsetTop+visual.height)}:{left:0,top:0,right:v.w,bottom:v.h};
    const others=pets.filter(q=>q!==p&&!q.el.hidden&&!q.overlayUnavailable&&!q.assetUnavailable).map(q=>paintRect(q));
    const protectedRects=[...obstacles,...others];
    if(hachiPaintSafe({outer:hit},bounds,null,protectedRects)){p.overlayUnavailable=false;p.scalePlacementUnavailable=false;return;}
    const signature=JSON.stringify([overlayRevision,p.x,p.y,p.width,p.height,bounds,others]);
    if(signature===p.overlaySignature)return;p.overlaySignature=signature;
    const fit=nearestViewportOverlayPlacement({x:p.x,y:p.y,width:p.width,height:p.height,padding:{left:Math.max(0,p.x-hit.left),right:Math.max(0,hit.right-p.x-p.width),top:Math.max(0,p.y-hit.top),bottom:Math.max(0,hit.bottom-p.y-p.height)},viewport:bounds,obstacles:protectedRects});
    p.overlayUnavailable=!fit;
    if(fit){p.scalePlacementUnavailable=false;const moved=Math.abs(fit.x-p.x)>1e-6||Math.abs(fit.y-p.y)>1e-6;p.x=fit.x;p.y=fit.y;if(moved&&p.pointerId===null&&PHYSICAL.has(p.mode)){p.airborne=false;p.vx=p.vy=0;idle(p);}}
    else if(p.pointerId!==null){releaseCapture(p);p.airborne=false;p.vx=p.vy=0;idle(p);}
  }
'''
    text=once(text,'  function render(p) {',helper+'\n  function render(p) {')
    text=once(text,'    refreshObstacles();syncStagePosition(p);\n    syncScaleAvailability(p);','    refreshObstacles();syncStagePosition(p);\n    syncScaleAvailability(p);syncOverlayPlacement(p);')
    text=text.replace('refreshObstacles();syncStagePosition(p);syncScaleAvailability(p);if(!onScreen(p))return;','refreshObstacles();syncStagePosition(p);syncScaleAvailability(p);syncOverlayPlacement(p);if(!onScreen(p))return;')
    text=once(text,'    const blocked = p.pointerId === null && obstacles.some(', '    const blocked = (viewportOverlay || p.pointerId === null) && obstacles.some(')
    text=once(text,"  listen(window, 'resize', () => { cancelExternalPresentation('resize'); layout(); });", "  listen(window, 'resize', () => { cancelExternalPresentation('resize'); layout(); });\n  if(viewportOverlay){listen(document,'vocab:busy',invalidate,true);for(const type of ['resize','scroll'])if(window.visualViewport?.addEventListener)listen(window.visualViewport,type,()=>{invalidate();for(const p of pets)render(p);},{passive:true});}")
    return text
