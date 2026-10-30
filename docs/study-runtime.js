
  (() => {
    'use strict';
    /** Owned by the study template. Consumers receive read(), never mutation methods. */
function createStudyState(onChange=()=>{}){
 let phase='initializing',depth=0,revision=0,composing=false;
 const read=()=>Object.freeze({phase,transactionDepth:depth,revision,composing,busy:phase!=='home'||depth>0||composing,audioPending:false});
 const changed=()=>{revision++;try{onChange(read());}catch(_){/* Decoration must not stop learning. */}};
 return Object.freeze({read,
  setPhase(value){phase=['home','study','review'].includes(value)?value:'unknown';changed();},
  setComposing(value){composing=value===true;changed();},
  run(fn){depth++;changed();try{const result=fn();if(result&&typeof result.then==='function'){phase='unknown';changed();}return result;}finally{depth--;changed();}}
 });
}

    const studyGuard=createStudyState(snapshot=>document.dispatchEvent(new CustomEvent('vocab:busy',{detail:snapshot})));
    Object.defineProperty(window,'__cvStudyRead',{value:studyGuard.read,configurable:true});
    document.addEventListener('compositionstart',()=>studyGuard.setComposing(true),true);
    document.addEventListener('compositionend',()=>studyGuard.setComposing(false),true);
    const data=window.CVVocabulary;const page=window.CVPage.page;let reviewFilter='all',explicitStudyStart=false;
    const storageKey = 'jlpt-local-vocabulary-v1';
    const levels = Object.keys(data);
    const el = Object.fromEntries(['home', 'study', 'level-buttons', 'review-level', 'review-summary',
      'start-review', 'review-empty', 'review-table', 'review-rows', 'go-home', 'level', 'study-title',
      'position', 'progress', 'counts', 'card', 'word', 'reading', 'meaning', 'example', 'translation',
      'answer', 'prev', 'next', 'known', 'unknown', 'undo-answer', 'message', 'storage-note']
      .map(id => [id, document.getElementById(id)]));
    const allWords = levels.flatMap(level => data[level].map(word => ({ ...word, level })));
    const byId = Object.fromEntries(allWords.map(word => [word.id, word]));
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; }
    catch (_) { el['storage-note'].textContent = '저장 기록을 읽을 수 없어 새 세션으로 시작합니다.'; }
    if (typeof saved !== 'object' || Array.isArray(saved)) saved = {};
    let level = levels.includes(saved.level) ? saved.level : 'N5';
    const positions = {}, answers = {};
    for (const key of levels) {
      const p = saved.positions?.[key];
      positions[key] = Number.isInteger(p) && p >= 0 && p < data[key].length ? p : 0;
      for (const word of data[key]) {
        const value = saved.answers?.[word.id];
        if (value === 'known' || value === 'unknown') answers[word.id] = value;
      }
    }
    let mode = 'all', reviewIds = [], reviewIndex = 0, reviewTotal = 0;
    let lastAnswer = null;
    function clearAnswerUndo() { lastAnswer = null; if(el['undo-answer'])el['undo-answer'].disabled = true; }
    function save() {
      try {
        const text=JSON.stringify({ level, positions, answers });localStorage.setItem(storageKey,text);lastStorageRaw=text;unsavedProgress=false;
        el['storage-note'].textContent = '급수별 위치와 학습 기록은 이 브라우저에 자동 저장됩니다.';
        return true;
      } catch (_) {
        unsavedProgress=true;el['storage-note'].textContent = '브라우저 저장이 차단되어 있습니다. 현재 창에서만 기록이 유지됩니다.';
        return false;
      }
    }
    function unknownWords() {
      const filter = el['review-level']?.value||reviewFilter;
      return allWords.filter(word => answers[word.id] === 'unknown' && (filter === 'all' || word.level === filter));
    }
    function stats(list) {
      let known = 0, unknown = 0;
      for (const word of list) {
        if (answers[word.id] === 'known') known++;
        if (answers[word.id] === 'unknown') unknown++;
      }
      return { known, unknown };
    }
    function renderHomeImpl() {
      if(el['level-buttons']){
      el['level-buttons'].replaceChildren();
      for (const key of levels) {
        const { known, unknown } = stats(data[key]);
        const row = document.createElement('p');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `${key} 학습 · 전체 ${data[key].length.toLocaleString('ko-KR')}개`;
        button.addEventListener('click', () => startLevel(key));
        row.append(button, document.createTextNode(` 알고 있음 ${known}개 / 모르겠음 ${unknown}개 / 이어보기 ${positions[key] + 1}번째`));
        el['level-buttons'].append(row);
      }
      }
      if(!el['review-rows'])return;
      const list = unknownWords();
      el['review-summary'].textContent = `${el['review-level'].value === 'all' ? '전체 급수' : el['review-level'].value} · 모르겠음 ${list.length.toLocaleString('ko-KR')}개`;
      el['start-review'].disabled = list.length === 0;
      el['review-empty'].hidden = list.length !== 0;
      el['review-table'].hidden = list.length === 0;
      el['review-rows'].replaceChildren();
      const fragment = document.createDocumentFragment();
      list.forEach((word, index) => {
        const row = document.createElement('tr');
        const grade = document.createElement('td'); grade.textContent = word.level;
        const cell = document.createElement('td');
        const button = document.createElement('button'); button.type = 'button';
        button.textContent = word.kanji; button.lang = 'ja';
        button.addEventListener('click', () => startReview(index)); cell.append(button);
        const reading = document.createElement('td'); reading.textContent = word.hiragana; reading.lang = 'ja';
        const meaning = document.createElement('td'); meaning.textContent = word.korean;
        row.append(grade, cell, reading, meaning); fragment.append(row);
      });
      el['review-rows'].append(fragment);
    }
    function showHomeImpl() {
      clearAnswerUndo();
      studyGuard.setPhase('home');
      if(page==='study'){window.CVPage.go('index.html');return;}
      if(el.home)el.home.hidden = false;
      renderHome();
      document.dispatchEvent(new CustomEvent('vocab:view'));
    }
    function startLevelImpl(key) {
      explicitStudyStart=true;
      clearAnswerUndo();
      studyGuard.setPhase('study');
      if(!levels.includes(key))key=level;level = key; mode = 'all';
      if(page!=='study'){save();window.CVPage.go('study.html?level='+encodeURIComponent(key),{restoreStudy:false});return;}
      el.study.hidden = false;
      save(); render();
      document.dispatchEvent(new CustomEvent('vocab:start'));
    }
    function startReviewImpl(index = 0) {
      explicitStudyStart=true;
      clearAnswerUndo();
      reviewIds = unknownWords().map(word => word.id);
      if (!reviewIds.length) return;
      studyGuard.setPhase('review');
      reviewIndex = Math.min(reviewIds.length-1,Math.max(0,Number.isInteger(index)?index:0)); reviewTotal = reviewIds.length; mode = 'review';
      if(page!=='study'){reviewFilter=el['review-level'].value;window.CVPage.go('study.html?review='+encodeURIComponent(reviewFilter));return;}
      el.study.hidden = false;
      render();
      document.dispatchEvent(new CustomEvent('vocab:start'));
    }
    function currentList() { return mode === 'all' ? data[level] : reviewIds.map(id => byId[id]); }
    function currentIndex() { return mode === 'all' ? positions[level] : reviewIndex; }
    function renderImpl(message = '') {
      const list = currentList(), index = currentIndex(), word = list[index];
      const { known, unknown } = stats(mode === 'all' ? list : allWords);
      el.level.value = level;
      el.level.hidden = mode === 'review';
      document.querySelector('label[for="level"]').hidden = mode === 'review';
      el['study-title'].textContent = mode === 'review' ? '모르겠음 단어 복습' : `${level} 전체 단어 학습`;
      el.progress.max = mode === 'review' ? reviewTotal : list.length;
      el.progress.value = mode === 'review' ? reviewTotal - list.length + Math.min(index, list.length) : known + unknown;
      el.counts.textContent = mode === 'review'
        ? `전체 급수에 남은 모르겠음 ${unknown}개 · ↑ 알고 있음으로 바꾸면 모음에서 빠집니다.`
        : `알고 있음 ${known}개 / 모르겠음 ${unknown}개 / 미평가 ${list.length - known - unknown}개`;
      el.card.hidden = !word;
      el.prev.disabled = index === 0 || list.length === 0;
      el.next.disabled = !word || index >= list.length - 1;
      el.known.disabled = el.unknown.disabled = !word;
      el['undo-answer'].disabled = !lastAnswer;
      el.known.setAttribute('aria-pressed', String(!!word && answers[word.id] === 'known'));
      el.unknown.setAttribute('aria-pressed', String(!!word && answers[word.id] === 'unknown'));
      if (word) {
        el.position.textContent = `${mode === 'review' ? word.level + ' · 복습' : level} · ${index + 1} / ${list.length.toLocaleString('ko-KR')} · 원본 ID ${word.id}`;
        el.word.textContent = word.kanji; el.reading.textContent = word.hiragana;
        el.meaning.textContent = `뜻: ${word.korean}`;
        el.example.textContent = word.ex; el.translation.textContent = word.tr;
        el.answer.textContent = `현재 기록: ${answers[word.id] === 'known' ? '알고 있음' : answers[word.id] === 'unknown' ? '모르겠음' : '미평가'}`;
      } else {
        el.position.textContent = '이번 복습을 마쳤습니다.';
      }
      el.message.textContent = message || (!word ? '모르는 단어 페이지에서 남은 단어를 다시 확인할 수 있습니다.' : '');
    }
    function moveImpl(delta) {
      clearAnswerUndo();
      const list = currentList(), current = currentIndex();
      if (!list.length) return;
      const next = Math.min(list.length - 1, Math.max(0, current + delta));
      if (mode === 'review') reviewIndex = next; else positions[level] = next;
      save(); render(next === current ? (delta < 0 ? '첫 번째 단어입니다.' : '마지막 단어입니다.') : '');
    }
    function markImpl(answer) {
      const list = currentList(), index = currentIndex(), word = list[index];
      if (!word) return;
      // One session-local record only; never an unbounded history or persisted backup.
      lastAnswer = { id: word.id, previous: answers[word.id], level, mode,
        position: positions[level], reviewIds: reviewIds.slice(), reviewIndex, reviewTotal };
      const wasComplete = mode === 'all' && list.every(item => answers[item.id]);
      answers[word.id] = answer;
      let suffix = '';
      if (mode === 'review') {
        if (answer === 'known') reviewIds.splice(reviewIndex, 1);
        else reviewIndex++;
      } else if (index < list.length - 1) positions[level]++;
      else suffix = list.every(item => answers[item.id]) ? ' 이 급수의 모든 단어를 평가했습니다.' : ' 마지막 단어입니다.';
      const persisted = save();
      render(`${word.kanji}: ${answer === 'known' ? '알고 있음' : '모르겠음'}으로 ${persisted ? '저장했습니다.' : '현재 창에만 기록했습니다.'}${suffix}`);
      document.dispatchEvent(new CustomEvent(answer === 'known' ? 'vocab:correct' : 'vocab:wrong'));
      const completed = mode === 'review' ? reviewIndex >= reviewIds.length : !wasComplete && list.every(item => answers[item.id]);
      if (completed) document.dispatchEvent(new CustomEvent('vocab:complete'));
    }
    function undoAnswerImpl() {
      const previous = lastAnswer;
      if (!previous || el.study.hidden || previous.level !== level || previous.mode !== mode) {
        clearAnswerUndo(); return;
      }
      clearAnswerUndo();
      if (previous.previous === undefined) delete answers[previous.id];
      else answers[previous.id] = previous.previous;
      positions[level] = previous.position;
      reviewIds = previous.reviewIds.slice(); reviewIndex = previous.reviewIndex; reviewTotal = previous.reviewTotal;
      const persisted = save();
      render(`${byId[previous.id].kanji}: 방금 답변을 취소했습니다. ${persisted ? '이전 기록과 위치를 저장했습니다.' : '저장이 차단되어 현재 창에서만 복원했습니다.'}`);
    }
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
      transient:(page==='study'||explicitStudyStart)?{level,mode,reviewIds:reviewIds.slice(),reviewIndex,reviewTotal,lastAnswer,reviewFilter}:(window.CVPage.incoming?.study?.transient||{level,mode,reviewIds:reviewIds.slice(),reviewIndex,reviewTotal,lastAnswer,reviewFilter})}));
    window.addEventListener('storage',event=>{if(event.key===storageKey||event.key===null){if(syncExternalState()&&!storageConflict){if(page==='study')render('다른 화면에서 바뀐 최신 학습 기록을 불러왔습니다.');else renderHome();}}});

    // Optional local learning-record transfer. File reads never hold the synchronous study guard.
    const backupUI = Object.fromEntries(['export','file','status','preview','summary','apply','cancel'].map(key => [key, document.getElementById('backup-' + key)]));
    const backupFormat = 'chiikawa-study-record';
    const backupDataset = 'sha256:2112bf91d9ec0eac1f5212c30e89171a639ac4b156a0a92403b75c4b18df3c5e';
    let pendingBackup = null, backupReadToken = 0;
    function backupMessage(text) { backupUI.status.textContent = text; }
    function clearBackup() {
      backupReadToken++;
      pendingBackup = null;
      backupUI.file.value = '';
      backupUI.preview.hidden = true;
      backupUI.apply.disabled = true;
      backupUI.summary.textContent = '';
    }
    function currentBackupState() { return { level, positions: { ...positions }, answers: { ...answers } }; }
    function backupCounts(state) {
      const values = Object.values(state.answers);
      return `알고 있음 ${values.filter(v=>v==='known').length}개 / 모르겠음 ${values.filter(v=>v==='unknown').length}개 / 최근 급수 ${state.level} / 위치 ${levels.map(key=>key+': '+(state.positions[key]+1)).join(', ')}`;
    }
    function strictObject(value, keys) {
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error('기록 객체 형식이 올바르지 않습니다.');
      const actual = Object.keys(value);
      if (keys && (actual.length !== keys.length || actual.some(key=>!keys.includes(key)))) throw new Error('기록 항목 구성이 올바르지 않습니다.');
    }
    function validateBackup(text) {
      const payload = JSON.parse(text, (key, value) => {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('허용하지 않는 기록 항목입니다.');
        return value;
      });
      strictObject(payload, ['format','version','dataset','state']);
      if (payload.format !== backupFormat || payload.version !== 1 || payload.dataset !== backupDataset) throw new Error('이 단어장 버전에서 사용할 수 없는 백업입니다.');
      const state = payload.state;
      strictObject(state, ['level','positions','answers']);
      if (!levels.includes(state.level)) throw new Error('급수가 올바르지 않습니다.');
      strictObject(state.positions, levels);
      for (const key of levels) {
        const position = state.positions[key];
        if (!Number.isInteger(position) || position < 0 || position >= data[key].length) throw new Error('학습 위치가 범위를 벗어났습니다.');
      }
      strictObject(state.answers);
      for (const [id, value] of Object.entries(state.answers)) {
        if (!Object.prototype.hasOwnProperty.call(byId, id) || (value !== 'known' && value !== 'unknown')) throw new Error('단어 ID 또는 평가 기록이 올바르지 않습니다.');
      }
      return state;
    }
    if(backupUI.export){
    backupUI.export.addEventListener('click', () => {
      let url = null;
      try {
        if (typeof Blob !== 'function' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || typeof URL.revokeObjectURL !== 'function') throw new Error('이 브라우저는 파일 저장을 지원하지 않습니다. Chrome에서 열어 주세요.');
        const anchor = document.createElement('a');
        if (!('download' in anchor)) throw new Error('이 브라우저는 파일 다운로드를 지원하지 않습니다. Chrome에서 열어 주세요.');
        const payload = { format: backupFormat, version: 1, dataset: backupDataset, state: currentBackupState() };
        url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type:'application/json;charset=utf-8'}));
        anchor.href = url; anchor.download = 'chiikawa-study-record.json';
        document.body.append(anchor); anchor.click(); anchor.remove();
        const releasedURL = url;
        setTimeout(()=>URL.revokeObjectURL(releasedURL), 30000);
        url = null;
        backupMessage('현재 창의 학습 기록 다운로드를 요청했습니다. 저장된 파일을 확인해 주세요.');
      } catch (error) {
        if (url) URL.revokeObjectURL(url);
        backupMessage(error.message || '학습 기록 파일을 저장하지 못했습니다.');
      }
    });
    backupUI.file.addEventListener('change', async () => {
      const file = backupUI.file.files && backupUI.file.files[0];
      clearBackup();
      const token = backupReadToken;
      if (!file) { backupMessage('복원할 파일을 선택해 주세요.'); return; }
      try {
        if (!Number.isInteger(file.size) || file.size <= 0 || file.size > 1024 * 1024) throw new Error('파일은 비어 있지 않은 1MB 이하 JSON이어야 합니다.');
        if (typeof file.text !== 'function') throw new Error('이 브라우저는 파일 읽기를 지원하지 않습니다. Chrome에서 열어 주세요.');
        backupMessage('파일을 확인하는 중입니다. 아직 기록은 바뀌지 않았습니다.');
        const text = await file.text();
        if (token !== backupReadToken) return;
        if (typeof text !== 'string' || text.length > 1024 * 1024) throw new Error('파일 크기 또는 형식이 올바르지 않습니다.');
        pendingBackup = validateBackup(text);
        backupUI.summary.textContent = `현재: ${backupCounts(currentBackupState())}\n복원 예정: ${backupCounts(pendingBackup)}`;
        backupUI.preview.hidden = false;
        backupUI.apply.disabled = false;
        backupMessage('검증 완료. 아직 적용하지 않았습니다. 내용을 확인한 뒤 교체 버튼을 눌러 주세요.');
      } catch (error) {
        if (token !== backupReadToken) return;
        clearBackup();
        backupMessage('복원할 수 없습니다: ' + (error.message || '잘못된 JSON 파일입니다.'));
      }
    });
    backupUI.cancel.addEventListener('click', () => { clearBackup(); backupMessage('복원을 취소했습니다. 학습 기록은 바뀌지 않았습니다.'); });
    backupUI.apply.addEventListener('click', () => {
      if (!pendingBackup) return;
      studyGuard.run(() => {
        const next = pendingBackup;
        // A single Web Storage write is atomic: on failure, neither live state nor stored value changes.
        try { const text=JSON.stringify(next);localStorage.setItem(storageKey,text);lastStorageRaw=text;unsavedProgress=false;window.CVPage.clearStudy(); }
        catch (_) { backupMessage('브라우저 저장에 실패하여 복원하지 않았습니다. 기존 기록을 유지합니다. 저장 권한을 확인해 주세요.'); return; }
        clearAnswerUndo();
        level = next.level;
        for (const key of levels) positions[key] = next.positions[key];
        for (const key of Object.keys(answers)) delete answers[key];
        Object.assign(answers, next.answers);
        mode = 'all'; reviewIds = []; reviewIndex = 0; reviewTotal = 0;
        clearBackup();
        reviewFilter='all';if(el['review-level'])el['review-level'].value = 'all';window.CVPage.clearStudy();
        try { showHome(); }
        catch (_) { backupMessage('학습 기록은 저장했지만 화면을 갱신하지 못했습니다. 파일을 다시 열어 저장된 기록을 확인해 주세요.'); return; }
        el['storage-note'].textContent = '급수별 위치와 학습 기록은 이 브라우저에 자동 저장됩니다.';
        backupMessage('학습 기록을 복원했습니다. 급수를 선택해 이어서 학습하세요.');
      });
    });

    window.CVPage.beforeNavigate(()=>{clearBackup();backupMessage('페이지를 이동하여 적용하지 않은 복원 선택을 취소했습니다.');});
    }
    window.CVPage.beforeNavigate(url=>{if(url.pathname.endsWith('/index.html'))clearAnswerUndo();});
    el['go-home']?.addEventListener('click', showHome);
    el['review-level']?.addEventListener('change', () => studyGuard.run(() => { clearAnswerUndo();reviewFilter=el['review-level'].value;renderHome(); }));
    el['start-review']?.addEventListener('click', () => startReview());
    el.level?.addEventListener('change', () => { startLevel(el.level.value); el.level.blur(); });
    el.prev?.addEventListener('click', () => move(-1));
    el.next?.addEventListener('click', () => move(1));
    el.known?.addEventListener('click', () => mark('known'));
    el.unknown?.addEventListener('click', () => mark('unknown'));
    el['undo-answer']?.addEventListener('click', () => studyGuard.run(()=>{if(!syncExternalState())undoAnswerImpl();else render('최신 기록으로 갱신되어 이전 답변 취소를 해제했습니다.');}));
    document.addEventListener('keydown', event => {
      if (!el.study || el.study.hidden || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      if (event.target.closest?.('select, input, textarea, [contenteditable="true"], .cv-pet, #study-backup, #bgm-player, #continuous-walk-controls')) return;
      const action = { ArrowLeft: () => move(-1), ArrowRight: () => move(1),
        ArrowUp: () => mark('known'), ArrowDown: () => mark('unknown') }[event.key];
      if (action) { event.preventDefault(); if (!event.repeat) action(); }
    });
    function showHome(...args){return studyGuard.run(()=>{syncExternalState();if(storageConflict)return;return showHomeImpl(...args);});}
    function startLevel(...args){return studyGuard.run(()=>{syncExternalState();if(storageConflict)return;return startLevelImpl(...args);});}
    function startReview(...args){return studyGuard.run(()=>{syncExternalState();if(storageConflict)return;return startReviewImpl(...args);});}
    function renderHome(...args){return studyGuard.run(()=>renderHomeImpl(...args));}
    function render(...args){return studyGuard.run(()=>renderImpl(...args));}
    function move(...args){return studyGuard.run(()=>{syncExternalState();if(storageConflict)return;return moveImpl(...args);});}
    function mark(...args){return studyGuard.run(()=>{syncExternalState();if(storageConflict)return;return markImpl(...args);});}
    if(page!=='study'){
      const incoming=window.CVPage.incoming?.study;
      if(incoming?.unsaved&&incoming.state){adoptState(incoming.state);lastStorageRaw=incoming.fingerprint;unsavedProgress=true;}
      if(['all',...levels].includes(incoming?.transient?.reviewFilter)){reviewFilter=incoming.transient.reviewFilter;if(el['review-level'])el['review-level'].value=reviewFilter;}
      showHome();
    }else{
      const incoming=window.CVPage.incoming?.study;
      if(incoming?.unsaved&&incoming.state){adoptState(incoming.state);lastStorageRaw=incoming.fingerprint;unsavedProgress=true;}
      const params=new URLSearchParams(location.search),requested=params.get('level'),review=params.get('review');
      if(unsavedProgress&&syncExternalState()&&storageConflict){studyGuard.setPhase('study');render('저장 충돌로 현재 창의 기록을 유지하고 있습니다. 위에서 먼저 백업해 주세요.');}
      else if(levels.includes(requested))startLevel(requested);
      else if((!review||(incoming?.transient?.mode==='review'&&incoming.transient.reviewFilter===review))&&restoreContinuation(incoming)){}
      else if(['all',...levels].includes(review)){
        reviewFilter=review;const list=unknownWords();
        if(list.length)startReview(0);else{mode='review';reviewIds=[];reviewTotal=reviewIndex=0;studyGuard.setPhase('review');render();}
      }else startLevel(level);
    }
  })();
  