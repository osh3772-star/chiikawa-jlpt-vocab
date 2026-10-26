"""Refresh the owned study obstacle cache after its known entrance transform ends."""
def once(s,a,b):
    assert s.count(a)==1,(a[:100],s.count(a));return s.replace(a,b,1)
def adapt_floor_animation(s):
    if '  const ReviewedStep=' in s:
        a,b=s.split('  const ReviewedStep=',1);return adapt_floor_animation(a)+'  const ReviewedStep='+b
    return once(s,'  layout(); root.dataset.paused = String(paused()); started = true; wake();',"""  if(floorWalk)listen(document,'animationend',event=>{
    const study=document.getElementById('study');
    if(destroyed||document.hidden||!study||study.hidden||event.target!==study||event.animationName!=='soft-enter')return;
    invalidate();for(const actor of pets)render(actor);
  },true);
  layout(); root.dataset.paused = String(paused()); started = true; wake();""")
