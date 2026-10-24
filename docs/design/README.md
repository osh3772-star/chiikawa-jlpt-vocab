# 치이카와 프로젝트 — 연구·설계 자료

## 기존 v3 구현·검수 안내

- [v3 기준 안내 (기존 문서 원문)](v3-baseline.md)
- [아트 검수](art_audit.ko.json)
- [캐릭터 표시 UI 계약](character_visibility_ui_contract.ko.json)
- [영상 동작 후보](video_action_candidates.ko.json)
- [검증 결과](verification.json)

위 네 JSON은 기존 main 문서이며 이 연구·설계 추가분에서 변경하지 않는다.

**2026-10-24 연구 스냅샷 · 설계 전용 · 앱 구현/모션 활성화 아님.**
이 문서는 미래 기능의 근거와 검수 조건을 보존한다. 관찰한 정지 화면, 기존 부분 영상 관찰, 공식 텍스트, UI 제안을 구분한다. 원작 동작 활성화는 이 묶음에서 0이며 기존 앱 코드·배포 HTML은 변경하지 않는다. 문서의 “현재”는 연구 당시 상태다.

## 읽는 순서

- [배경](backgrounds/README.md): 공식 장면의 관찰 범위, 선택기·색 대비·안전영역, 향후 검수표.
- [행동 확률](probabilities/behavior-probability-spec.ko.md): 가중치는 원작 통계가 아닌 UX 가설. [기본 실험](probabilities/simulation-report.ko.md)과 [선택기회 공정성 실험](probabilities/opportunity-fairness-report.ko.md)을 구분한다.
- [쌍 상호작용](pairs/pair_interaction_research_design.ko.txt): 관계/행동 근거, 각색 표시, 양자 예약·취소 설계. 구현 보류.
- [추가 캐릭터](additional-characters/research-and-design.ko.txt): 古本屋, 파자마 파티즈 네 멤버, 쿠리만쥬. 정지 이미지 관찰만으로 모션을 승인하지 않는다.
- [크기](sizes/character-size-research-design.ko.txt): 공식 cm와 엄밀한 상대 비율 미확정. 몸체/장식/접촉점 분리 및 표시 제안.

## 실험 재현 (앱 런타임과 독립)

저장소 루트에서 Python 3 표준 라이브러리만으로 실행한다. 스크립트는 같은 폴더의 제안 JSON을 읽고 결과 JSON만 덮어쓴다. 네트워크·설치·앱 import·실제 아트 활성화가 없다. 실행 전 기존 결과를 보존하려면 별도 복사본에서 실행한다.

```sh
python docs/design/probabilities/simulate_probabilities.py
python docs/design/probabilities/simulate_opportunity_fairness.py
```

스크립트와 두 결과 JSON은 원 연구 산출물과 동일한 바이트를 보존한다. 결과의 simulator_sha256 또는 script_sha256은 대응 Python 파일을 검증한다. 기본 실험은 캐릭터별 100,000 추첨 및 20 seeds × 24시간 시나리오, 공정성 실험은 140회/840시간 가상 실행이다. 승인0에서는 idle 100%. 가상 승인 fixture의 숫자는 실제 브라우저 QA, 원작 충실도 또는 동작 승인 근거가 아니다.

## 공개 범위와 출처 한계

텍스트·구조화된 설계·출처 URL/해시와 독립 시뮬레이션만 포함한다. 원본 스틸, 캡처, 사용자 업로드, 영상, 내부 참고 파일, 전체 회차 데이터베이스, 중복 콘솔 로그는 포함하지 않는다. 출처가 온라인/공식이라는 사실은 복제·변형·배포 허락이 아니다. 링크는 기존 조사에서 기록한 출처이며 이 내보내기 단계에서 다시 열지 않았다. 실패/미열람 출처는 문서의 해당 표기를 유지하며 직접 관찰 근거로 승격하지 않는다.

기존 비공개 표본에 의존한 관찰은 그 한계를 유지한다. 공개 파일만으로 원본 프레임의 관찰을 독립 재검증할 수 있다는 주장은 하지 않는다. 구현 전에는 당시 최신 앱 상태와 개별/쌍/배경 순서, 아트 사용허가, 실제 입력·접근성·안전영역 검수가 필요하다.
