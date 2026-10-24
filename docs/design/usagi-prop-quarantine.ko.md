# 우사기 잘못된 무기 포즈 격리

기존 `chiikawa_hachiware_usagi_assets/usagi/assets/characters/usagi/sasumata.png`는 우사기에게 파란 Y자 사스마타를 들려 줍니다. 공식 상품에서는 우사기 **討伐棒**, 치이카와/하치와레 **さすまた**로 구분합니다. 소품 정체성 오류이므로 원본 파일은 보존하되 실행 그림을 정상 idle로 대체하고 자율행동 선택에서 제거했습니다. 초기 격리 단계에서는 새로운 토벌봉 그림이나 동작을 만들지 않았습니다. 아래 후속 정적 소품 보수는 별도 아트 검수와 승인 후 시행했으며 새 동작 승인은 아닙니다.

근거: https://chiikawamarket.jp/products/4571609354970 와 https://chiikawamarket.jp/collections/chiikawapark?page=7 .

`art_quarantine.py`를 최종 아트 덮어쓰기와 행동표 선택 **후** 적용합니다. 초기 격리 단계에서는 남아 있는 이름의 직접 참조도 idle 픽셀로 귀결되며, 원래5% 자율선택 가중치는 idle로 옮깁니다. 학습 데이터/이벤트를 지우지 않습니다.

이 수정은 로컬 소스/빌드에 적용됩니다. `docs/index.html`의 기존 배포본은 별도 명시적 배포 절차 전에는 바뀌지 않습니다.


## 치이카와 대표 소품 색상 추가 격리
`chiikawa_hachiware_usagi_assets/chiikawa/assets/characters/chiikawa/sasumata.png`의 파란 Y자 소품도 검수한 기본 모델과 다릅니다. 라이선스 상품의 대표 치이카와 소품은 분홍색이며 하치와레의 파란색과 구분됩니다. 따라서 치이카와도 같은 런타임 idle 대체/확률 이관을 적용합니다. 하치와레 파란 Y자 포즈는 이 검수 범위에서 유지합니다. 모든 원작 장면에 예외가 없다는 주장은 아닙니다.

근거: [Parade 공식 라이선스 토벌 마스코트 상품](https://www.parade-inc.net/products/chiikawa_toubatsu_mascot).


## 승인된 우사기 정적 소품 보수
후속 검수된 `chiikawa-pets/art-corrections/assets/usagi-rod-r1.png`를 legacy `sasumata` 키에 연결합니다. 키는 호환용 이름일 뿐 실제 그림은 노란 직선 토벌봉+흰 양끝입니다. 원본 결함 기록과 파란 PNG는 보존하고, 자율 행동 선택 확률은 계속 0입니다. PNG SHA256 및 원본 3:4 canvas 대응은 `usagi-rod.json`과 `art_corrections.py`에서 고정합니다. 이것은 소품 정체성 보수이며 새 원작 동작 승인이나 연속 프레임 완성이 아닙니다.

치이카와도 독립 검수된 `chiikawa-pink-sasumata-r1.png`로 후속 정적 보수를 적용합니다. 분홍 기본색 교정과 3:4 표시 안정성만 승인되며 포크 돌기의 모든 상세 위상이나 공격 동작을 승인한 것은 아닙니다. 두 캐릭터 모두 결함 원본은 보존하고 `sasumata` 자율 확률은 0을 유지합니다.
