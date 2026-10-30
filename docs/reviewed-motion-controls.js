(()=>{
 if(document.body.dataset.page!=='settings')return;
 const box=document.createElement('section');box.className='cv-reviewed-motion-controls';box.setAttribute('aria-label','연속동작');
 box.style.cssText='display:flex;gap:6px;flex-wrap:wrap;padding:8px;margin:8px 0';
 box.innerHTML='<label>함께 동작 <select id="reviewed-pair-select"><option value="chi-usagi">치이·우사기 식사</option><option value="hachi-usagi">하치·우사기 장난</option><option value="kuri-chi">쿠리·치이 간식</option><option value="momo-kani">모몽가·카니 반응</option><option value="rakko-hachi">랏코·하치 연습</option></select></label><button type="button" id="reviewed-pair-play">동작 1회</button><button type="button" id="reviewed-momo-walk">모몽가 걷기</button><button type="button" id="reviewed-motion-stop">정지</button><span id="reviewed-motion-status" role="status">연결 품질 검수 중 · 캐릭터를 켠 뒤 재생</span>';
 const target=document.querySelector('main');if(!target)return;target.appendChild(box);
 const engine=()=>window[Symbol.for('jlpt.chiikawa-pets')],status=box.querySelector('[role=status]');
 box.querySelector('#reviewed-pair-play').onclick=()=>{const ok=engine()?.playReviewedPair?.(box.querySelector('select').value);status.textContent=ok?'동작 준비 · 입력하면 취소됩니다.':'두 캐릭터를 켜고 바닥 공간을 확보한 뒤 다시 눌러 주세요.';};
 box.querySelector('#reviewed-momo-walk').onclick=()=>{const ok=engine()?.playAction?.('walk','momonga');status.textContent=ok?'모몽가 걷기 · 잡으면 잡힘 상태로 전환됩니다.':'모몽가를 켜고 일시정지를 풀어 주세요.';};
 box.querySelector('#reviewed-motion-stop').onclick=()=>{engine()?.stopReviewedPair?.();engine()?.pause?.();status.textContent='동작 정지 · 기존 움직임 버튼으로 다시 켤 수 있어요.';};
})();
