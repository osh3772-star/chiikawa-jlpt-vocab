/** Owned by the study template. Consumers receive read(), never mutation methods. */
export function createStudyState(onChange=()=>{}){
 let phase='initializing',depth=0,revision=0,composing=false;
 const read=()=>Object.freeze({phase,transactionDepth:depth,revision,composing,busy:phase!=='home'||depth>0||composing,audioPending:false});
 const changed=()=>{revision++;try{onChange(read());}catch(_){/* Decoration must not stop learning. */}};
 return Object.freeze({read,
  setPhase(value){phase=['home','study','review'].includes(value)?value:'unknown';changed();},
  setComposing(value){composing=value===true;changed();},
  run(fn){depth++;changed();try{const result=fn();if(result&&typeof result.then==='function'){phase='unknown';changed();}return result;}finally{depth--;changed();}}
 });
}
