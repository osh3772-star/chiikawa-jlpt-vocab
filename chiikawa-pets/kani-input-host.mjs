/** Explicit, session-only bounded iframe host. No storage or parent engine mutation. */
export function createKaniInputHost({read,mount,unmount,exclusive,status}){
 let requested=false,disposed=false,frame=null,serial=0,failed=false;
 function clear(){serial++;if(frame){unmount(frame);frame=null;}exclusive(false);}
 function sync(){if(disposed)return;const r=read();const safe=requested&&r.characterOnly&&r.open&&!r.hidden&&!r.paused&&!r.reduced&&r.geometrySafe;
  if(!safe||failed){clear();status(!requested?'잡고 놓기 꺼짐':failed?'불러오기 실패 · 껐다 켜서 다시 시도':'잡고 놓기 대기 · 전용 화면과 안전한 공간이 필요합니다');return;}
  if(frame)return;const token=++serial;exclusive(true);
  try{frame=mount(()=>{if(token!==serial||disposed)return;failed=true;clear();status('불러오기 실패 · 껐다 켜서 다시 시도');});status('카니를 잡고 옮긴 뒤 놓아 보세요 · 전용 무대 안에서만 이동');}
  catch(_){failed=true;clear();status('불러오기 실패 · 껐다 켜서 다시 시도');}
 }
 return{setRequested(value){if(disposed)return;requested=!!value;failed=false;sync();},sync,getState:()=>({requested,active:!!frame,failed,disposed}),destroy(){if(disposed)return;disposed=true;requested=false;clear();}};
}
