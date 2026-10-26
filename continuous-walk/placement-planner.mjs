import {validRect,translateBounds,sweptPaintSafe} from './geometry-baseline.mjs';
/** Pure explicit-request planner. No actor writes, decode, timers, automatic activation or art changes. */
export function findWalkPlacements({position,walkingBounds,actorBounds,viewport,obstacles,distance=24,margin=4,maxRelocation=Infinity}={}){
 if(!position||![position.x,position.y,distance,margin].every(Number.isFinite)||distance<4||distance>128||margin<4||!(maxRelocation===Infinity||Number.isFinite(maxRelocation)&&maxRelocation>=0&&maxRelocation<=256)||![walkingBounds,actorBounds,viewport].every(validRect)||!Array.isArray(obstacles)||!obstacles.every(validRect))return [];
 const candidates=[];
 for(const sign of [1,-1]){
  const dx=sign*distance;
  const offsets={left:walkingBounds.left-position.x+Math.min(0,dx)-margin,right:walkingBounds.right-position.x+Math.max(0,dx)+margin,top:walkingBounds.top-position.y-margin,bottom:walkingBounds.bottom-position.y+margin};
  const minX=viewport.left-offsets.left,maxX=viewport.right-offsets.right,minY=viewport.top-offsets.top,maxY=viewport.bottom-offsets.bottom;
  if(minX>maxX||minY>maxY)continue;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const xs=new Set([clamp(position.x,minX,maxX),minX,maxX]),ys=new Set([clamp(position.y,minY,maxY),minY,maxY]);
  for(const r of obstacles){for(const x of [r.left-offsets.right,r.right-offsets.left])if(x>=minX&&x<=maxX)xs.add(x);for(const y of [r.top-offsets.bottom,r.bottom-offsets.top])if(y>=minY&&y<=maxY)ys.add(y);}
  for(const x of xs)for(const y of ys){
   const start={x,y},end={x:x+dx,y},travel=Math.hypot(x-position.x,y-position.y);
   if(travel>maxRelocation)continue;
   const bounds=translateBounds(walkingBounds,position,start);
   if(!sweptPaintSafe({bounds,from:start,to:end,viewport,obstacles,margin}))continue;
   const placedActor=translateBounds(actorBounds,position,start);
   if(!sweptPaintSafe({bounds:placedActor,from:start,to:start,viewport,obstacles,margin}))continue;
   const relocationSafe=sweptPaintSafe({bounds:actorBounds,from:position,to:start,viewport,obstacles,margin});
   candidates.push({start,end,walkingBounds:bounds,relocation:[{...position},start],path:[start,end],distance:travel,walkDistance:distance,directRelocationSafe:relocationSafe,needsRelocation:travel>1e-6,requiresExplicitPlacement:travel>1e-6});
  }
 }
 candidates.sort((a,b)=>a.distance-b.distance||a.start.y-b.start.y||a.start.x-b.start.x||b.end.x-a.end.x);
 return candidates;
}

export function planWalkPlacement(input){return findWalkPlacements({...input,maxRelocation:input?.maxRelocation??192}).find(p=>p.directRelocationSafe)??null;}
/** Separate endpoint availability from how the original actor can reach it. */
export function nearestAvailableWalkPlacement(input){
 const candidates=[24,12,8,4].flatMap(distance=>findWalkPlacements({...input,distance}));
 candidates.sort((a,b)=>a.distance-b.distance||b.walkDistance-a.walkDistance||a.start.y-b.start.y||a.start.x-b.start.x);
 return candidates[0]??null;
}
