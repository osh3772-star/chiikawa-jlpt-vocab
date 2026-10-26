/** Narrow CSS paint-containment audit for the host's one captured background-status P.
 * CSS Containment 2 §3.4 clips contents to the overflow clip edge, not arbitrary self ink.
 * We therefore reject expanded clip margins, own effects, generated content and descendants.
 * This does not waive any ancestor coordinate-system checks or remove the raw obstacle.
 */
export function createBackgroundStatusAudit(expected,getStyle){
 const none=v=>v===undefined||v===''||v==='none';
 return (el,s)=>{
  if(!expected||el!==expected||el.tagName!=='P'||el.id!=='background-status'||el.className!=='cv-background-status'||el.getAttribute?.('role')!=='status'||el.childElementCount!==0||el.shadowRoot)return false;
  if(!el.childNodes||!Array.from(el.childNodes).every(n=>n.nodeType===3||n.nodeType===8))return false;
  if(s.contain!=='paint'||s.display!=='block'||s.position!=='static'||s.overflowX!=='hidden'||s.overflowY!=='hidden'||s.overflowClipMargin!=='0px')return false;
  if(['transform','perspective','filter','backdropFilter','clipPath','maskImage','webkitMaskImage','translate','rotate','scale','offsetPath','boxShadow','textShadow','borderImageSource'].some(k=>!none(s[k])))return false;
  if(s.zoom!=='normal'&&Number(s.zoom)!==1||s.contentVisibility&&s.contentVisibility!=='visible')return false;
  if(!['none','hidden'].includes(s.outlineStyle)||!/^0(?:px)?(?:\s+0(?:px)?){0,3}$/.test(s.borderImageOutset??''))return false;
  for(const pseudo of ['::before','::after']){const p=getStyle(el,pseudo);if(!p||!['none','normal'].includes(p.content))return false;}
  return true;
 };
}
