# 행동 확률 가상시계 실험 결과

**결론:** 현재 승인 동작 0이라는 조건에서 여섯 캐릭터 모두 자율 idle 100%였다. 별도 **가상 승인 walk fixture**에서는 연속 실행·20초 cooldown·글로벌 슬롯 중복·학습 입력 보호창 위반 없이 확률과 체류시간을 측정했다. 이 실험은 런타임 구현, 아트 승인, 브라우저 QA, 캐릭터 자연스러움 검증이 아니다.

## 재현

```sh
python docs/design/probabilities/simulate_probabilities.py
```

Python 표준 라이브러리만 사용하며 설치·네트워크·실앱 import가 없다. `behavior-probability-proposal.json`을 읽고 같은 폴더에 `simulation-results.json`을 쓴다. 결과에 실행한 simulator SHA-256을 기록한다. 원래 앱 파일과 registry/asset/activation 값은 바꾸지 않는다.

## 표본과 모델

- 고정 분포: 캐릭터별 100,000회, 총 600,000회 추첨. 별도로 캐릭터별 100,000회 독립 renewal 체류시간 실험.
- scheduler: 시나리오마다 seeds 0–19 × 24시간, 초기 10분 제외. 7개 시나리오: 현재 승인0, 현재 승인0+중단, 가상 walk 승인 1/3/6명, 가상 승인6명+중단, 동일 가중치 공정성 fixture.
- 현재 승인0 시나리오에는 idle 외 모든 항목이 차단된다. 가상 승인 시나리오는 실제 아트 승인을 주장하지 않고 `approved_walk=True`라는 시험 입력만 사용한다. 영상 개인조각·Momonga preview·pair는 어느 시나리오에서도 실행 후보가 아니다.
- 자율 idle U(8,16)초, walk U(1.6,3.2)초, 종료 후 quiet 2초. 직전 결정 walk 제외 + 종료 후 visible/unpaused 시계 20초 cooldown. 공유 비-idle 슬롯 1개. cooldown 차단 시 idle로 정규화.
- ready-time heap+캐릭터별 seeded RNG를 쓴다. 제안된 production round-robin 방문 순서를 완전히 구현한 것이 아니므로 실제 구현의 공정성을 대신 증명하지 않는다.
- interruption fixture: 주기적 hidden 60초, pause 30초, reduced 30초, 20Hz×5초 학습 입력 burst, drag 독점 3초. 12시간 시점에 첫 캐릭터 walk 자산 실패를 주입해 영구 제외한다. resume에는 새 8–16초 준비시간이 적용된다.
- 점유율 분모는 warm-up 이후 **화면 visible 시간**이며 hidden만 제외한다. pause/reduced 정지시간은 idle에 포함한다. cooldown 시계는 hidden/pause/reduced에서 모두 멈춘다. 실험 walk duration은 fixture이며 실제 manifest의 종료 경계 보정은 미모델링이다.

## 주요 결과

### 현재 승인 0

여섯 캐릭터 모두 walk 시작 0회, walk 점유율 0%, idle 100%. 중단을 주입해도 동일하다. 실행할 수 없는 행동의 오랜 미실행은 starvation 결함이 아니라 의도된 차단이다.

### 가상 walk 승인, 여섯 캐릭터 동시 표시

|캐릭터|평균 walk 시간 비중|20개 seed 전체에서 가장 긴 시작 간격*|
|---|---:|---:|
|치이카와|2.424%|785.4초|
|하치와레|3.622%|480.1초|
|우사기|4.598%|398.8초|
|시사|2.426%|864.2초|
|모몽가|3.626%|490.0초|
|랏코|1.710%|1229.9초|

\* 초기/종료 경계까지 포함한 최대 무실행 구간. 자세한 seed별 시작 수·점유율·쿨다운 거절은 JSON에 있다.

고정 독립 비교식보다 점유율이 낮아지는 것은 cooldown/history/공유 슬롯의 결과다. 여섯 캐릭터의 mean walk 비중 합계는 약 18.4%이며, 이는 이 fixture에서 화면 어딘가에 자율 walk가 진행되는 시간 비중이다. 캐릭터별 나머지 visible 시간은 정지다.

**장기간 미실행은 여전히 UX 검토 대상이다.** 이 유한 실험에서 1시간 굶는 actor는 없었지만 랏코는 약 20.5분 동안 walk가 없었던 구간이 있었다. 확률 추첨은 수학적으로 대기시간 상한을 보장하지 않는다. “최대 5분마다 반드시 움직인다” 같은 요구가 생기면 별도의 bounded-wait 정책과 재검증이 필요하다. 그런 정책도 승인/입력 보호/cooldown을 우회하면 안 된다. 현재 결과만으로 starvation 문제가 영구 해결됐다고 하지 않는다.

### 중단 및 자산 실패

가상 승인 중단 시나리오에 학습 입력 288,000회를 주입했다. 각 입력 시 진행 actor를 즉시 취소하고 보호창 내 자동 시작을 막는 assert가 통과했다. hidden/pause/reduced/drag와 자산 실패도 진행 동작을 취소했다. 입력 장치 좌표·pointer capture·DOM 소품 정리는 이 모델에 없으므로 실브라우저 검증은 남는다.

첫 캐릭터가 12시간에 자산 실패한 뒤 긴 무실행 구간을 갖는 것은 의도된 fail-closed 결과다. 이를 공정성 실패나 다시 활성화할 근거로 쓰지 않는다. 나머지 캐릭터의 자동 동작은 계속 검사된다.

## 통과한 불변식과 검증 한계

|항목|실험 결과 / 범위|
|---|---|
|분포/독립 시간 기준|600,000 추첨이 지정 통계 허용오차 내, 600,000 renewal 표본이 수식 ±0.5 percentage point 내|
|현재 승인 0|idle 100%, 다른 시작 0|
|반복|직전 결정이 walk인 상태에서 walk 시작 0|
|cooldown|active-clock 종료 후 20초 미만 walk 시작 0|
|공유 예약|동시 자율 actor 2명 이상 0; 점유율 합계 ≤100%|
|입력 보호|같은 가상시각에 즉시 취소, 마지막 입력 뒤 2초 보호창 중 시작 0|
|숨김/pause/reduced|차단 구간 자동 시작 0, 복귀 시 밀린 재생 없음|
|자산 실패|실패 후 해당 actor walk 시작 차단|
|공정성 fixture|동일 25% 가중치에서 actor별 시작 비중이 1/6 ±2 percentage points 내|
|장기간 미실행|항시 승인된 6명 시나리오에서 최대 약20.5분; 유한 표본 관찰이며 상한 보장 아님|
|짝 중복|pair 생성 경로 자체 off이므로 pair 시작/중복 0. **향후 pair 양자 예약/취소 알고리즘은 미검증**|

금지 action ID/손상 asset를 실제 registry parser에 주입하는 통합 시험, 실제 프레임 경계·루프 자연스러움, mobile 안전영역, 100ms 입력 렌더 지연, pointer capture 해제, 실제 짝 연출은 이 실험의 통과 범위가 아니다. 숫자로 캐릭터다움이나 원작 충실성을 증명할 수 없다. 기존 설계 명세의 브라우저/아트/증거 게이트는 계속 필요하다.


## Eligible 시간 공정성 후속

초기 wall-clock 무실행 간격은 선택기회 박탈과 다르다. 학습 입력·hidden·pause 등으로 조용한 시간을 starvation에 넣지 않는 후속 비교를 `opportunity-fairness-design.ko.md`와 `opportunity-fairness-report.ko.md`에 추가했다. 조건부 확률을 유지하고 장기 eligible 미선택 이후 선택기회만 늘리는 C안은 별도 실험 후보이며, 원래 JSON/실앱 설정을 바꾼 것이 아니다. 시간당 비율 왜곡과 다른 캐릭터 경합 비용도 함께 보고한다.
