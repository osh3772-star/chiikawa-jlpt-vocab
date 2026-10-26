/** Full painted bounds, not alpha-only collision. Inputs must come from audited live geometry. */
export const validRect=r=>r&&['left','top','right','bottom'].every(k=>Number.isFinite(r[k]))&&r.right>r.left&&r.bottom>r.top;
const contains=(a,b)=>a.left>=b.left&&a.top>=b.top&&a.right<=b.right&&a.bottom<=b.bottom;
const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
export function translateBounds(bounds,from,to){const x=to.x-from.x,y=to.y-from.y;return{left:bounds.left+x,top:bounds.top+y,right:bounds.right+x,bottom:bounds.bottom+y};}
export function sweptPaintSafe({bounds,from,to,viewport,obstacles,margin=4}){
 if(!validRect(bounds)||!validRect(viewport)||!from||!to||![from.x,from.y,to.x,to.y,margin].every(Number.isFinite)||margin<0||!Array.isArray(obstacles)||!obstacles.every(validRect))return false;
 const end=translateBounds(bounds,from,to),swept={left:Math.min(bounds.left,end.left)-margin,top:Math.min(bounds.top,end.top)-margin,right:Math.max(bounds.right,end.right)+margin,bottom:Math.max(bounds.bottom,end.bottom)+margin};
 return contains(swept,viewport)&&obstacles.every(r=>!overlap(swept,r));
}
/** Deterministic short horizontal corridor only; no automatic vertical teleport or random search.
 * 24 CSS px is a conservative test displacement, not measured gait speed or stride.
 */
export function proposeWalkPath({position,bounds,viewport,obstacles,distance=24}){
 if(!position||![position.x,position.y,distance].every(Number.isFinite)||distance<4||distance>128)return null;
 for(const sign of [1,-1]){
  const target={x:position.x+sign*distance,y:position.y};
  if(sweptPaintSafe({bounds,from:position,to:target,viewport,obstacles}))return[{...position},target];
 }
 return null;
}
