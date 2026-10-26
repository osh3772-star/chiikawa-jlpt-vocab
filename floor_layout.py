"""Floor-only layout correction; retain actor art/input and never change preferences."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
def once(s,a,b):
    assert s.count(a)==1,(a[:100],s.count(a));return s.replace(a,b,1)
def adapt_floor_layout(s):
    if '  const ReviewedStep=' in s:
        a,b=s.split('  const ReviewedStep=',1);return adapt_floor_layout(a)+'  const ReviewedStep='+b
    s=once(s,'viewportOverlay = false, readOverlayObstacles = null,','viewportOverlay = false, readOverlayObstacles = null, floorWalk = false, readFloorWalkViewport = null, onFloorLayout = null,')
    helper=(ROOT/'page-adapters/floor-layout.js').read_text()
    s=once(s,'  const visibleIds = () => {',helper+'\n  const visibleIds = () => {')
    s=once(s,"    const scale = decorativeStage(p) ? 1 : viewport().w < 640 ? (mobilePetStages ? .70 : visibleIds().length > 3 ? .40 : .62) : viewport().w <= 900 ? .8 : 1;","    const baseScale = decorativeStage(p) ? 1 : viewport().w < 640 ? (mobilePetStages ? .70 : visibleIds().length > 3 ? .40 : .62) : viewport().w <= 900 ? .8 : 1;\n    const scale=baseScale*(floorWalk&&!stageRect(p)?floorFitScale(baseScale):1);")
    s=once(s,'    initialBodyPositionsApplied=true;','    if(floorWalk)placeFloorRow();\n    initialBodyPositionsApplied=true;')
    return s
