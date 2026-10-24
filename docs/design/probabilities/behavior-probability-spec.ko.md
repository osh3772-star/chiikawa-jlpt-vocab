# 여섯 캐릭터 행동 확률 명세 — 설계안 v1

**상태: 제안 / 런타임 미적용.** 2026-10-24 코드·아트 계약을 읽고 작성했다. 이 문서와 동반 JSON은 자동으로 읽어 활성화할 설정 파일이 아니다. 원작에서 관찰한 자세·변화는 동작 근거이고, 아래 숫자는 학습 방해를 줄이기 위한 **앱 UX 가설**이다. 애니 속 행동 빈도를 측정했다는 뜻이 아니다.

## 1. 현재 상태와 변경 제안의 경계

저장소 기준 경로:
- 기존 앱의 `behavior-config.json`: 캐릭터별 합계 100인 **자율 결정 1회당** 비중. 화면 시간 점유율이 아니다.
- 기존 앱의 `pet-engine.js`: `availablePetWeights`는 누락 행동 비중을 idle로 합친다. static frame 존재도 허용 근거가 될 수 있다. `decide`는 idle 1.5–4.5초, walk 요청 1.5–3.2초, 그 외 요청 1.0–1.8초를 쓰지만 실제 sequence 길이/루프 경계/후속 idle 대기가 체류 시간을 바꾼다. 현재 숫자로 시간 점유율을 단정할 수 없다.
- 기존 앱의 `README-animation.md`, `animation_manifest.py`: 정상 제작 승인 production 보행은 아직 없음. 기존 여섯 팩은 정지 일러스트다. 명시적 Chiikawa beta opt-in의 draft 허용은 production 승인과 다르다.
- 기존 앱의 `evidence → registry.json`, `evidence_registry.py`: 원작 동작 `enabledCount=0`, `runtimeEnabled=false`, 활성화 바인딩 미구현. 영상 관찰/설계 검토/아트 검토를 서로 대체하지 않는다.
- `art_quarantine.py`: Momonga hang/sleep/pout/fake-cry/grabbed/jump는 손상 원본 대신 idle 정지 alias. alias 존재는 행동 승인 아님. glide 등도 이름/성격 설명으로 허용하지 않는다.

이하 내용은 새 scheduler를 구현한다면 적용할 계약이다. 현재 엔진이 이미 충족한다는 보고가 아니다. 특히 **차단 가중치 재정규화**, 역사 cooldown, 원작 개인/짝 게이트 분리는 구현 전 검증 항목이다.

## 2. 여섯 개 기본 분포

|캐릭터|idle|walk|승인된 특수 자율 행동|원작 후보/preview|
|---|---:|---:|---:|---:|
|치이카와|85|15|0|0|
|하치와레|75|25|0|0|
|우사기|65|35|0|0|
|시사|85|15|0|0|
|모몽가|75|25|0|0|
|랏코|90|10|0|0|

이 표는 **허용 조건 적용 전 상대 가중치**다. 우사기의 더 큰 보행 비중도 원작 통계/성격 증명이 아닌 조정 가능한 UX 차이다. 시사와 치이카와처럼 같은 비중을 허용한다. 차별화를 위해 근거 없는 행동을 만들지 않는다.

현재 승인된 특수 **자율** 행동 목록은 비워 둔다. 기존 wave/encourage/weeding/sasumata/guitar/camera/cheer/jump/onigiri/study/bow/ramen-serve/charm/tail-proud/pout/fake-cry/glide/sword/dessert/sleep 이름과 정지 PNG가 있다는 이유로 새 명세에 이식하지 않는다. legacy 정지 그림을 유지하는 별도 호환 모드는 원작 행동 승인으로 표기하지 않으며, 이 제안의 승인 목록과 섞지 않는다.

현재 production 보행이 없다는 조건에서는 여섯 캐릭터 모두 **유효 자율 분포 idle 100%, 나머지 0%**다. 이후 승인된 walk가 생겨도 관련 캐릭터·방향·아트 해시만 허용한다. 특수 행동의 향후 도입에는 명시적 action ID, 승인/트리거/지속시간/가중치/쿨다운을 포함하는 별도 명세 변경이 필요하다. 빈 목록을 자동 채우지 않는다.

## 3. 허용성 및 확률 계산

각 후보 a에 대해 먼저 다음 AND 게이트를 검사한다.
1. 해당 캐릭터의 명시적 자율 allowlist에 정확한 ID가 있음. 모르는 키, NaN, 음수, 빈 ID는 설정 검증 실패 → 안전 정지 및 진단.
2. production 승인과 정확한 자산 binding/해시·방향·범위 일치. draft/beta/limited-preview와 production은 별도 namespace. 파일 존재만으로 통과하지 않음.
3. 필요한 모든 자산 로딩 성공; quarantine/alias/damaged 제외. walk는 실제 승인된 방향 프레임·loop·rootDistance·안전한 이동 공간이 있어야 함. 없는 방향을 반전 생성하지 않음.
4. visible, on-screen, unpaused, reduced-motion 아님, 학습 보호창 아님, pair/drag 예약 없음, cooldown/history 통과.
5. 원작 후보는 evidence+design+art+safety+accessibility+runtime binding+explicit activation 모두 필요. 현재 구현에서 이를 합성해 true로 만들지 않는다. **승인돼도 trigger가 direct-click/session-complete라면 autonomous에서는 계속 제외**한다.

허용 집합 E에서 `P(a | context, history) = w(a) / Σ[E]w`로 재정규화한다. 예: 75/25에서 walk 차단 → idle 100. 미래 가상 60/25/15에서 15 후보만 차단 → 70.588%/29.412%; 해당 15를 idle에 더한 75/25와 다르다. 이것은 수학 예시이며 세 번째 행동 추가 승인이 아니다.

idle은 검수된 정지 fallback을 뜻하며 항상 안전한 후보다. 그 자산까지 없으면 캐릭터를 숨기고 움직이지 않는다. 총합 0/설정 오류도 동일 fail-closed. 취소된 행동의 잔여 확률을 다른 행동에 즉시 재추첨하지 않는다. 자산 오류 후 승인된 새 revision으로 명시적 재로딩되기 전에는 실패 항목을 제외한다.

## 4. 시계, 반복 방지, 체류 시간

- scheduler 시계는 **화면에 보이고 pause/reduced-motion이 아닌 시간**에만 진행한다. 탭 숨김/화면 밖 시간은 cooldown도 정지한다. 복귀 시 밀린 재생 없음.
- idle 결정은 U(8,16)초 정지, 평균 12초. walk 요청은 U(1.6,3.2)초, 목표 평균 2.4초. 실제 종료는 승인 manifest의 허용 경계에 맞추고 실제 시간을 기록한다. 원작 player 읽음값을 animation duration으로 변환하지 않는다.
- walk 뒤 최소 2초 조용한 정지. walk 종료/중단 후 해당 캐릭터에 20초 cooldown. 직전 결정이 walk이면 다음 결정에서 walk 제외. 다음 idle 결정은 정상 idle 시간 소비 후 history가 갱신된다. idle 반복은 허용한다.
- 최근 3개 실행 ID와 시작/종료/중단 시간을 보관. 현재 special은 없음. 향후 special 도입 시 같은 ID를 최근 3개 **비-idle 실행**에서 제외하고 최소 45초 cooldown; 승인 목록이 좁아져 실행할 것이 없으면 idle, 강제 variety/루프 없음. 취소도 실행 이력에 남겨 재시작 폭주 방지. 직접클릭 중 중복클릭은 queue 없이 무시.

### 시간 점유율 계산

고정된 허용 집합, 독립 선택, history/경합/중단이 없는 비교 기준에서 평균 active 시간 D, 종료 후 idle quiet Q를 쓰면:

`walk 시간 비중 = p_walk × E[D_walk] / (p_idle × E[D_idle] + p_walk × (E[D_walk]+E[Q]))`.

위 평균 12/2.4/2초를 넣은 **기준 계산**:

|캐릭터|결정 시 walk|기준 walk 시간 비중|
|---|---:|---:|
|치이카와|15%|3.31%|
|하치와레|25%|5.94%|
|우사기|35%|8.99%|
|시사|15%|3.31%|
|모몽가|25%|5.94%|
|랏코|10%|2.14%|

나머지는 idle+quiet다. **이 표는 운영 예측치가 아니다.** 20초 cooldown, repeat 차단, 공유 슬롯, 입력 중단, 실제 프레임 경계가 있는 최종 기대 점유율은 시뮬레이션으로 계산한다. 특히 모든 walk가 막힌 현재 production 적용 가정에서는 walk 0%, visible-time idle 100%다. hidden 시간은 분모에서 제외하고, 정지 fallback도 body motion으로 세지 않는다. 여러 캐릭터의 시간 점유율을 더한 값을 화면 전체 비율로 착각하지 않는다.

## 5. 입력과 중단 우선순위

높은 순서로 처리하며, 같은 프레임에는 더 높은 제약이 승리한다.
1. destroy/개별 숨김/document hidden/자산 안전 실패: 동작·소품·예약·이벤트 제거, pointer capture 해제. hidden에서는 표시와 샘플링 모두 없음.
2. manual pause 또는 reduced-motion: 진행 동작 취소, 검수된 정지 1장만. 자동결정/물리 이동/preview 없음. resume은 reduced-motion을 우회하지 못함. 해제 시 새 8–16초 대기.
3. 학습 입력: 답안·다음 단어·카드 탐색은 같은 이벤트 처리에서 먼저 적용. 진행 장식과 pair 취소, 이후 2초 자율 시작 금지. 학습 input은 절대로 캐릭터 종료를 기다리지 않음. 드래그 중 발생하면 안전 위치로 정리하고 capture 해제한 뒤 학습 동작 유지.
4. 유효 pointer drag / 명시적 개인 preview 요청: 자율 슬롯·pair 취소 후 독점. drag는 숨김/pause/reduced 제약을 우회하지 않음. 동시에 들어온 학습 입력에 밀린 preview는 재생 대기열에 남기지 않음.
5. 실제 session-complete의 허용된 1회 반응.
6. 그 외 허용된 학습 정지 반응, 마지막으로 자율 idle/walk.

같은 학습 이벤트의 완료 반응은 그 입력으로 이전 연출을 정리한 후 선택할 수 있다. 이벤트 ID로 중복 제거; 최신 1개만, 45ms coalescing, 1초 expiry는 현재 계약과 호환. 빠른 known/unknown 입력을 응원 폭주로 전환하지 않는다. unknown은 처벌/울음/삐침으로 해석하지 않음. 매 취소는 actor+소품+timer+pair role+pointer capture를 원자적으로 정리하고 새 복귀 몸동작을 발명하지 않는다.

## 6. 개인 동작과 짝 연출

각 캐릭터는 독립 RNG/대기/history를 갖되, 화면 전체에는 **자율 비-idle 슬롯 1개**만 둔다. due 후보를 회전 round-robin으로 방문하고 현재 문맥에서 확률을 뽑는다. idle이면 자기 대기만 갱신; walk면 슬롯을 획득하고 다음 프레임까지 다른 비-idle 추첨을 막는다. 슬롯이 바쁘면 추첨/가짜 실행 이력을 만들지 않고 U(0.5,1.5)초 뒤 다시 eligibility 확인한다. 라운드 시작점을 회전해 배열 첫 캐릭터 편향을 피한다. 화면에 없는 캐릭터는 순환에서 제외한다.

**자율 pair 확률 0, 새로운 pair 기능 off.** 개인단계 검증보다 관계 연구/구현을 앞세우지 않는다. 현재 엔진에 있는 완료 시 대표+300ms 파트너 응답은 authored web choreography이며 관찰된 원작 관계가 아니다. 이 설계로 새로운 원작 pair를 승인하지 않는다. 이 제안을 적용하는 경우 별도 pair 승인 전에는 개인 대표 1명만; 기존 pair 유지 여부는 구현 변경 검토에 명시한다.

향후 별도 승인된 pair는 두 캐릭터의 적격성/소품/안전영역을 함께 검사하고 두 actor와 글로벌 슬롯을 원자 예약한다. 하나라도 실패하면 pair 전체를 생략하고 승인된 개인 반응만 선택한다. 한 actor를 drag/숨김하면 둘 다 정리. pair 끝난 후 자율 cooldown을 양쪽에 적용. 무작위로 근처 둘을 묶거나 개인 관찰을 관계 증거로 확대하지 않는다. 이벤트 대표 선정과 자율 행동 가중치는 별도 분포다.

## 7. 원작 개인 패킷의 정확한 예약 위치

연구 입력은 개별 동작 아트 패킷 및 모션 활성화 계약(이 공개 묶음에 미포함)이다. 저장소에 포함된 계약은 registry pointer가 가리키는 snapshot을 기준으로 검증한다. 원본 패킷은 연구 입력이며 production 승인 파일이 아니다.

|ID|제안된 이벤트 범위|현재 자율확률 및 이유|
|---|---|---|
|`chiikawa.video_turn`|직접클릭 1회, 상체 dock, C 정지|0: 생성 후보도 art HOLD, runtime 미승인|
|`hachiware.video_packet_lift`|직접클릭 1회, 원래 붉은 봉지|0: 새 아트/production 미승인|
|`usagi.video_bounce_still`|직접클릭 또는 실제 완료 1회|0: 관찰 범위만, production 미승인|
|`rakko.video_cup_eye_fragment`|완료 휴식 반응 1회|0: 컵을 이미 든 관찰 조각, production 미승인|
|`shisa.video_pour_fragment`|완료 소무대 1회|0: 아트 및 잔의 authored 배치 검토 미완료|
|Momonga 단일 공중 BODY authored path|명시적 제한 preview 요청만|0: `LIMITED_PREVIEW_TESTING`, production 및 자동재생 승인 아님|

완료 이벤트의 위 동작들도 **현재는 재생 0회**다. 승인 이후에도 대표 1명 선정/trigger 계약을 통과해야 한다. Shisa의 원장면 잔은 다른 인물이 들고 있으므로 정지 웹 소품 재배치는 별도 설계 승인 대상이다. Momonga의 원작 몸 근거와 웹 이동경로의 창작성을 분리한다. 포즈·예고·회복·좌우 반전·무한 루프를 추가해 확률표를 채우지 않는다.

## 8. 측정 및 통과 기준

로그는 로컬 검증용이며 단어 내용/사용자 식별자는 수집하지 않는다. 각 선택에 seed, 가상시간, character/action ID, eligibility 이유, 원가중치, 유효확률, history/cooldown, asset revision, 시작·종료·취소 이유, visible 시간, 글로벌 예약만 기록한다.

1. **안전 0건:** 최소 100,000 decisions에서 disabled 영상/preview/quarantine/불명 action 실행 0, slot 중복 0, 숨김·pause·reduced 중 자동 시작 0. 음수/NaN/합 0/자산 실패 입력은 결정론적 안전 fallback.
2. **분포:** history를 끈 단일 actor 고정 eligible-set sampler를 각각 100,000회 실행. 각 확률 오차 ≤ `max(0.005, 5*sqrt(p*(1-p)/N))`; p=0 항목은 정확히 0. 75/25에서 walk 차단 시 idle 정확히 100. 동적 history 실험에 원가중치 75/25를 그대로 기대하지 않음.
3. **시간:** 고정 비교 기준의 평균 점유율이 위 수식에서 절대 0.5 percentage point 이내. 실제 시뮬레이션에서는 history/경합/중단별 실측값과 seed별 구간을 별도 보고. duration은 actual start/end를 쓰며 중단된 잔여 길이는 제외.
4. **반복/공정성:** walk 연속 결정 0, walk 종료 이후 20초 미만 재실행 0. 6명 동일 자격/가중치의 공정성 fixture에서 24시간×20 seeds 동안 각 actor 시작 비중 1/6에서 ±2 percentage points. 다른 가중치의 여섯 캐릭터에 같은 실행 횟수를 요구하지 않음.
5. **학습 보호:** mocked time에서 입력 이벤트 즉시 기존 연출 취소, 2초 내 자율 새 시작 0. 실제 브라우저에서 20Hz 입력 5초 중 단어 입력 누락 0, 입력 반영 p95 ≤100ms, 정상 화면 다음 렌더에서 장식 정리. background throttling은 숨김 처리로 검증.
6. **lifecycle:** walk/pair/preview/drag 각 상태에 hide→show, pause→resume, reduced toggle, resize, pointercancel을 주입. capture·소품·역할 잔존 0, 복귀 후 밀린 재생 0. actor/소품이 카드·버튼 hit target을 가리는 경우 0.
7. **증거 경계:** schema에 `enabled=true`만 넣기, 기존 frame 이름으로 alias, beta asset를 production으로 전달, approved body를 autonomous preview에 연결 등 모두 차단. 기존 evidence registry 집계는 0 active 유지.

## 9. 설치 없는 작은 시뮬레이션 계획

동반 `behavior-probability-proposal.json`은 입력 사양일 뿐 실행 코드가 아니다. Python 표준 라이브러리 `random`, `heapq`, `json`, `statistics`만으로 독립 시뮬레이터를 만들면 된다. 런타임 파일을 import/수정하거나 PNG를 생성할 필요가 없다.

- 단계 A: seeds 0–19, 캐릭터별 100,000회 고정 분포 추첨. 전부 차단/보행 허용/가상 특수 후보 차단의 정규화 검사. 권한이 없는 동작은 fixture ID로만 표현.
- 단계 B: 24시간 가상 visible-time, 1/3/6명, 위 clock/history/슬롯 정확히 모사. ready-time min-heap, actor별 RNG(`seed*100 + stable character index`) 사용. 첫 10분 warm-up 별도 제외. 실측 action occupancy, 시작/분, idle 대기, cooldown 거절, actor별 fairness를 보고.
- 단계 C: 10분 간격 hidden 60초, pause 30초, reduced 30초, 20Hz 학습 입력 burst 5초, drag 3초, 임의 asset 실패를 가상시계에 주입. production-safe / 승인 walk fixture / 명시적 preview fixture를 분리. preview fixture도 자율 선택에서는 계속 0.
- 단계 D: 위 1–7 불변식을 assert하고 실패 seed/event를 최소 재현 로그로 저장. 실패 시 확률을 보기 좋게 맞추지 말고 scheduler/게이트 원인을 수정한 후 재실행.

**이번 산출물에서 실시한 검증:** JSON 파싱, 여섯 행 합계 100, 후보/preview 0, 수식 산술, 공개 문서 금지 식별자 점검. 후속으로 독립 표준 라이브러리 시뮬레이터를 실행했으며 결과는 `simulation-report.ko.md`와 `simulation-results.json`에 있다. 실제 운영 점유율·브라우저 QA는 아직 측정하지 않았다. 따라서 런타임 적용 완료를 주장하지 않는다.


## Eligible 시간 공정성 후속

초기 wall-clock 무실행 간격은 선택기회 박탈과 다르다. 학습 입력·hidden·pause 등으로 조용한 시간을 starvation에 넣지 않는 후속 비교를 `opportunity-fairness-design.ko.md`와 `opportunity-fairness-report.ko.md`에 추가했다. 조건부 확률을 유지하고 장기 eligible 미선택 이후 선택기회만 늘리는 C안은 별도 실험 후보이며, 원래 JSON/실앱 설정을 바꾼 것이 아니다. 시간당 비율 왜곡과 다른 캐릭터 경합 비용도 함께 보고한다.
