"""Dedicated explicit Chi walking capability; manual preview policy stays unchanged."""
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parent
D=ROOT/'continuous-walk'
def once(text,before,after):
    assert text.count(before)==1,(before[:120],text.count(before));return text.replace(before,after,1)
def adapt_continuous_walk(text):
    if '  const ReviewedStep=' in text:
        head,tail=text.split('  const ReviewedStep=',1);return adapt_continuous_walk(head)+'  const ReviewedStep='+tail
    geometry=(D/'continuous-walk-geometry.mjs').read_text().replace('export ','')
    placement=re.sub(r'^import .*?;\n','',(D/'placement-planner.mjs').read_text(),flags=re.M).replace('export ','')
    floor=re.sub(r'^import .*?;\n','',(D/'floor-plan.mjs').read_text(),flags=re.M).replace('export ','')
    helper=(D/'engine-host.js').read_text().replace('__WALK_FRAMES__',json.dumps(json.loads((D/'art.json').read_text())['frames'],separators=(',',':'))).replace('__WALK_GEOMETRY__',geometry).replace('__WALK_PLACEMENT__',placement).replace('__FLOOR_PLAN__',floor)
    text=once(text,'  const visibleIds = () => {',helper+'\n  const visibleIds = () => {')
    text=once(text,'const paintRect=(p,x=p.x,y=p.y)=>paddedGeometry(p,x,y)?.outer??',"const paintRect=(p,x=p.x,y=p.y)=>continuousWalk&&p.id==='chiikawa'?chiFootReviewBounds({...p,x,y}):paddedGeometry(p,x,y)?.outer??")
    text=once(text,'  function render(p) {','  function render(p) {\n    if(renderContinuousWalk(p))return;')
    text=once(text,'  function cancelExternalPresentation(reason) {','  function cancelExternalPresentation(reason) {\n    cancelContinuousWalk(reason);')
    text=once(text,'  function layout() {','  function layout() {\n    cancelContinuousWalk("layout");')
    text=once(text,'  function pointerDown(p, e) {','  function pointerDown(p, e) {\n    cancelContinuousWalk("pointer-input");')
    text=once(text,"  function react(type, target = 'all', metadata = {}) {","  function react(type, target = 'all', metadata = {}) {\n    cancelContinuousWalk('learning-reaction');")
    text=once(text,"  function start(p, action, fallback = 'idle', duration = .6, next = null) {","  function start(p, action, fallback = 'idle', duration = .6, next = null) {\n    if(continuousWalk?.scope!==CW_FLOOR_SCOPE||p.id==='chiikawa'||PHYSICAL.has(action)||PHYSICAL.has(p.mode)||['walk-start','walk','walk-stop'].includes(action)||['walk-start','walk','walk-stop'].includes(p.mode)||p.airborne||p.pointerId!==null)cancelContinuousWalk('other-action');")
    text=once(text,"    listen(el, 'keydown', e => {","    listen(el, 'keydown', e => {\n      cancelContinuousWalk('keyboard-input');")
    text=once(text,"    listen(p.img, 'error', () => {","    listen(p.img, 'error', () => {\n      if(continuousWalk&&p.id==='chiikawa'){failed.add(p.src);cancelContinuousWalk('image-error');return;}")
    text=once(text,"    listen(p.img, 'load', () => { failed.delete(p.src);", "    listen(p.img, 'load', () => { if(continuousWalk&&p.id==='chiikawa'){p.assetUnavailable=false;render(p);return;}failed.delete(p.src);")
    text=once(text,'  const api = {','  const api = {\n    readContinuousWalkAdmission,tryAcquireContinuousWalk,ownsContinuousWalk,presentContinuousWalk,releaseContinuousWalk,')
    return text

def build_continuous_script():
    reviewed=(ROOT/'chiikawa-pets/reviewed-step-controller.mjs').read_text()
    # Reuse the exact art validator/decoder in a private bundle, not a new global API.
    reviewed=re.sub(r'^import .*?;\n','',reviewed,flags=re.M).replace('export ','')
    parts=[reviewed]
    for name in ['continuous-walk-controller.mjs','continuous-walk-engine-adapter.mjs']:
        parts.append(re.sub(r'^import .*?;\n','',(D/name).read_text(),flags=re.M).replace('export ',''))
    return '(function(){\n'+ '\n'.join(parts)+'\nconst art='+ (D/'art.json').read_text()+';\n'+(D/'ui.js').read_text()+'\n})();\n'
