    // Only document navigation carries this bounded state. Browser reload does not.
    let lastStorageRaw = window.CVPage.stored().value, unsavedProgress = false, storageConflict = false;
    function adoptState(next) {
      level=levels.includes(next?.level)?next.level:'N5';
      for(const key of levels){const p=next?.positions?.[key];positions[key]=Number.isInteger(p)&&p>=0&&p<data[key].length?p:0;}
      for(const id of Object.keys(answers))delete answers[id];
      for(const word of allWords){const value=next?.answers?.[word.id];if(value==='known'||value==='unknown')answers[word.id]=value;}
    }
    function syncExternalState() {
      const now=window.CVPage.stored();
      if(!now.ok||now.value===lastStorageRaw)return false;
      if(unsavedProgress){
        storageConflict=true;window.CVPage.message('다른 창에서 기록이 바뀌어 현재 창의 답변 저장과 이동을 멈췄습니다. 현재 창의 기록을 먼저 백업해 주세요.',currentBackupState());return true;
      }
      let next={};try{next=JSON.parse(now.value||'{}');}catch{}
      adoptState(next);lastStorageRaw=now.value;unsavedProgress=false;storageConflict=false;clearAnswerUndo();
      mode='all';reviewIds=[];reviewIndex=reviewTotal=0;window.CVPage.clearStudy();
      return true;
    }
    function validUndo(value) {
      return value&&Object.hasOwn(byId,value.id)&&levels.includes(value.level)&&['all','review'].includes(value.mode)&&
        [undefined,'known','unknown'].includes(value.previous)&&Number.isInteger(value.position)&&value.position>=0&&value.position<data[value.level].length&&
        Array.isArray(value.reviewIds)&&value.reviewIds.length<=allWords.length&&value.reviewIds.every(id=>Object.hasOwn(byId,id))&&
        Number.isInteger(value.reviewIndex)&&value.reviewIndex>=0&&value.reviewIndex<=value.reviewIds.length&&
        Number.isInteger(value.reviewTotal)&&value.reviewTotal>=value.reviewIds.length&&value.reviewTotal<=allWords.length;
    }
    function restoreContinuation(record) {
      const now=window.CVPage.stored();if(!record||(!record.unsaved&&(!now.ok||now.value!==record.fingerprint))||(record.unsaved&&now.ok&&now.value!==record.fingerprint))return false;
      const value=record?.transient;
      if(!value||!levels.includes(value.level)||!['all','review'].includes(value.mode))return false;
      if(!Array.isArray(value.reviewIds)||value.reviewIds.length>allWords.length||new Set(value.reviewIds).size!==value.reviewIds.length||value.reviewIds.some(id=>!Object.hasOwn(byId,id)))return false;
      if(!Number.isInteger(value.reviewIndex)||value.reviewIndex<0||value.reviewIndex>value.reviewIds.length||!Number.isInteger(value.reviewTotal)||value.reviewTotal<value.reviewIds.length||value.reviewTotal>allWords.length)return false;
      if(record.unsaved&&record.state){adoptState(record.state);lastStorageRaw=record.fingerprint;unsavedProgress=true;}
      level=value.level;mode=value.mode;reviewIds=value.reviewIds.slice();reviewIndex=value.reviewIndex;reviewTotal=value.reviewTotal;
      lastAnswer=validUndo(value.lastAnswer)?value.lastAnswer:null;
      reviewFilter=['all',...levels].includes(value.reviewFilter)?value.reviewFilter:'all';
      if(el['review-level'])el['review-level'].value=reviewFilter;
      studyGuard.setPhase(mode==='review'?'review':'study');render();return true;
    }
    window.CVPage.registerStudy(()=>({fingerprint:lastStorageRaw,unsaved:unsavedProgress,
      ...(unsavedProgress?{state:{level,positions:{...positions},answers:{...answers}}}:{}),
      transient:{level,mode,reviewIds:reviewIds.slice(),reviewIndex,reviewTotal,lastAnswer,reviewFilter}}));
    window.addEventListener('storage',event=>{if(event.key===storageKey||event.key===null){if(syncExternalState()&&!storageConflict){if(page==='study')render('다른 화면에서 바뀐 최신 학습 기록을 불러왔습니다.');else renderHome();}}});
