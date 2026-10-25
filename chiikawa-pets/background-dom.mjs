// Decoration only. Never reads/writes study state, actors, scroll or layout dimensions.
export function createBackgroundDomAdapter({body,scenery,assets,ImageCtor=Image,setTimeoutFn=setTimeout,clearTimeoutFn=clearTimeout}) {
  const originalImage=scenery.style.getPropertyValue('background-image');
  const originalPriority=scenery.style.getPropertyPriority('background-image');
  const originalClass=body.classList.contains('cv-field-background');
  function restore(){
    if(originalImage)scenery.style.setProperty('background-image',originalImage,originalPriority);
    else scenery.style.removeProperty('background-image');
    body.classList.toggle('cv-field-background',originalClass);
  }
  function decode(selection,{signal}={}){
    return new Promise((resolve,reject)=>{
      const asset=assets?.[selection];
      if(!['field-ep6','stone-ep2'].includes(selection)||!asset?.source||signal?.aborted){reject(Error('background-unavailable'));return;}
      const img=new ImageCtor();let settled=false,timer=null;
      const dispose=()=>img.removeAttribute('src');
      const finish=(error)=>{
        if(settled)return;settled=true;clearTimeoutFn(timer);signal?.removeEventListener('abort',abort);
        if(error){dispose();reject(error);}else resolve({decoded:true,width:img.naturalWidth,height:img.naturalHeight,source:asset.source,dispose});
      };
      const abort=()=>finish(Error('background-aborted'));
      signal?.addEventListener('abort',abort,{once:true});
      timer=setTimeoutFn(()=>finish(Error('background-timeout')),8000);
      try{img.src=asset.source;Promise.resolve(img.decode()).then(()=>{
        if(signal?.aborted||img.naturalWidth!==asset.width||img.naturalHeight!==asset.height)finish(Error('background-decode'));
        else finish();
      },()=>finish(Error('background-decode')));}catch(error){finish(error);}
    });
  }
  function apply(decoded,selection){
    const asset=assets?.[selection];
    if(!['field-ep6','stone-ep2'].includes(selection)||!asset?.source||decoded?.decoded!==true||decoded.source!==asset.source||decoded.width!==1536||decoded.height!==1024)throw Error('background-invalid');
    scenery.style.setProperty('background-image',`url(${JSON.stringify(decoded.source)})`);
    body.classList.add('cv-field-background');
  }
  return {decode,apply,restore};
}
