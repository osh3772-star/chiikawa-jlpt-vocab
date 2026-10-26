  // Protect real text line paint, not the whole blank paper card. Controls always
  // keep their full hit box. No actor or transparent overlay is an input shield.
  function studyOverlayObstacles(){
    const rects=[],seen=new Set();
    const add=r=>{if(r&&[r.left,r.top,r.right,r.bottom].every(Number.isFinite)&&r.right>r.left&&r.bottom>r.top)rects.push({left:r.left,top:r.top,right:r.right,bottom:r.bottom});};
    const displayed=el=>!el.closest('[hidden]')&&petObstacleIsDisplayed(el)&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none';
    for(const el of document.querySelectorAll('button,summary,select,input,textarea,a,progress,[contenteditable="true"],.cv-extra-static-rail:not([hidden]),.cv-direct-stage:not([hidden])')){
      if(el.closest('.cv-pet-layer')||!displayed(el))continue;seen.add(el);add(el.getBoundingClientRect());
    }
    for(const el of document.querySelectorAll('h1,h2,h3,p,label,output,th,td')){
      if(el.closest('.cv-pet-layer')||!displayed(el)||[...seen].some(control=>control===el||control.contains(el)))continue;
      if(!el.textContent.trim())continue;
      try{const range=document.createRange();range.selectNodeContents(el);const lines=[...range.getClientRects()];range.detach?.();if(lines.length){for(const r of lines)add(r);}else add(el.getBoundingClientRect());}
      catch{add(el.getBoundingClientRect());}
    }
    return rects;
  }
