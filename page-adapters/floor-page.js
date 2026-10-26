  let floorLane=null;
  if(page==='study'){
    contentViewport=document.createElement('div');contentViewport.className='cv-floor-content';contentViewport.setAttribute('role','region');contentViewport.setAttribute('aria-label','단어 학습 · 스크롤 영역');
    document.body.appendChild(contentViewport);
    for(const el of [document.querySelector('.cv-page-nav'),document.getElementById('navigation-status'),document.querySelector('.site-header'),document.querySelector('main')].filter(Boolean))contentViewport.appendChild(el);
    floorLane=document.createElement('div');floorLane.className='cv-floor-lane';floorLane.setAttribute('aria-hidden','true');document.body.appendChild(floorLane);
  }
