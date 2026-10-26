/** Study-only viewport layout, not an animation or a preference change.
 * Reuse the existing exact paint-box and nearestScalePlacement safety policy.
 */
function nearestViewportOverlayPlacement({x,y,width,height,padding,viewport,obstacles}) {
  const ys=[y,viewport.top+padding.top,viewport.bottom-height-padding.bottom];
  for(const r of obstacles)ys.push(r.top-4-height-padding.bottom,r.bottom+4+padding.top);
  let best=null,bestDistance=Infinity;
  for(const nextY of new Set(ys)){
    const fit=nearestScalePlacement({x,y:nextY,width,height,padding,viewport,obstacles});
    if(!fit)continue;
    const distance=(fit.x-x)**2+(fit.y-y)**2;
    if(distance<bestDistance){best=fit;bestDistance=distance;}
  }
  return best;
}
