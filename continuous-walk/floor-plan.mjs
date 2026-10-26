import {validRect,translateBounds,sweptPaintSafe} from './continuous-walk-geometry.mjs';
/** Explicit-start floor only. Never searches another y or an upper viewport slot. */
export function proposeFloorWalk({position,walkingBounds,actorBounds,viewport,obstacles,floorY,margin=4.25}={}){
 if(!position||![position.x,position.y,floorY,margin].every(Number.isFinite)||margin<4||![walkingBounds,actorBounds,viewport].every(validRect)||!Array.isArray(obstacles)||!obstacles.every(validRect))return null;
 const plans=[];
 for(const distance of [24,12,8,4])for(const sign of [1,-1]){
  const dx=sign*distance,left=walkingBounds.left-position.x+Math.min(0,dx)-margin,right=walkingBounds.right-position.x+Math.max(0,dx)+margin;
  const min=viewport.left-left,max=viewport.right-right;if(min>max)continue;
  const xs=new Set([Math.max(min,Math.min(max,position.x)),min,max]);
  for(const r of obstacles)for(const x of [r.left-right,r.right-left])if(x>=min&&x<=max)xs.add(x);
  for(const x of xs){const start={x,y:floorY},end={x:x+dx,y:floorY},bounds=translateBounds(walkingBounds,position,start),body=translateBounds(actorBounds,position,start);
   if(!sweptPaintSafe({bounds,from:start,to:end,viewport,obstacles,margin})||!sweptPaintSafe({bounds:body,from:start,to:start,viewport,obstacles,margin}))continue;
   plans.push({path:[start,end],start,end,walkDistance:distance,floorY,shift:Math.abs(x-position.x),walkingBounds:bounds});
  }
 }
 plans.sort((a,b)=>a.shift-b.shift||b.walkDistance-a.walkDistance||a.start.x-b.start.x||b.end.x-a.end.x);
 return plans[0]??null;
}
