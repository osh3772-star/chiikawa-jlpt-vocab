  // A single viewport-bottom row. No DOM cloning, storage writes, or upper-space search.
  function floorFootprint(p){
    const body=paintRect(p,0,0),walk=p.id==='chiikawa'?chiFootReviewBounds({...p,x:0,y:0}):null;
    if(!walk)return body;
    return{left:Math.min(body.left,walk.left),top:Math.min(body.top,walk.top),right:Math.max(body.right,walk.right),bottom:Math.max(body.bottom,walk.bottom)};
  }
  function floorFitScale(baseScale){
    const ids=visibleIds(),actors=selected.filter(q=>ids.includes(q.id)&&!decorativeStage(q)&&!isBeta(q));
    if(!actors.length)return 1;
    let total=0;for(const q of actors){const width=q.size*baseScale*appliedScalePercent(q)/100,r=floorFootprint({...q,width,height:width*4/3});total+=r.right-r.left;}
    const reserve=actors.length>1&&actors.some(q=>q.id==='chiikawa')?(viewport().w<640?8:24):0;
    return Math.min(1,Math.max(.05,(viewport().w-8-4*(actors.length-1)-reserve)/total));
  }
  function placeFloorRow(){
    const actors=pets.filter(p=>!p.el.hidden&&!stageRect(p)),v=viewport();
    if(!actors.length){onFloorLayout?.(0);return;}
    const rects=actors.map(floorFootprint),reserve=actors.length>1&&actors.some(q=>q.id==='chiikawa')?(v.w<640?8:24):0;
    const total=rects.reduce((sum,r)=>sum+r.right-r.left,0)+4*(actors.length-1)+reserve;
    let x=Math.max(4,(v.w-total)/2),height=0;
    actors.forEach((p,i)=>{p.x=x-rects[i].left;p.y=ground(p);x+=rects[i].right-rects[i].left+4+(p.id==='chiikawa'?reserve:0);height=Math.max(height,v.h-(p.y+rects[i].top)+4);});
    root.dataset.floorLayout='true';root.dataset.floorHeight=String(Math.ceil(height));
    onFloorLayout?.(Math.ceil(height));dirty=true;refreshObstacles();
    for(const p of actors)render(p);
  }
