# 치이카와 단어장 추가 캐릭터 3종 통합팩

**시사 + 모몽가 + 랏코** 세 캐릭터의 개인용 생성 PNG, 동작 설정, 자율 이동·드래그 엔진, 독립 데모, Codex 통합 작업 지침을 묶었습니다.

## 가장 빠른 적용

1. 기존 단어장 프로젝트 루트에 이 ZIP을 압축 해제합니다.
2. Codex를 **기존 단어장 프로젝트 루트**에서 실행합니다.
3. `CODEX_PROMPT.txt` 내용을 Codex에 전달합니다.
4. Codex가 기존 앱 구조를 분석한 후 기존 엔진을 업데이트하도록 합니다.
5. 실행 후 3종 추가 + 기존 3종 유지 여부를 검증합니다.

## 폴더

```text
chiikawa_three_pet_integration/
  CODEX_PROMPT.txt                 <- 복사해서 전달할 짧은 프롬프트
  CODEX_INSTRUCTIONS.md           <- 자세한 설치/테스트 지침
  README.md
  animation-config.json           <- 모든 PNG 파일과 상태명 정의
  PREVIEW.jpg                     <- 3종 미리보기
  src/
    pet-engine.js                 <- 3+3 합쳐서 쓸 수 있는 기존 API 호환 엔진
    chiikawa-pets.css             <- 캐릭터 전용 범위 제한 CSS
  assets/characters/
    shisa/                        <- 11 PNG
    momonga/                      <- 21 PNG
    rakko/                        <- 13 PNG (원본에서 분리한 이미지 포함)
  demo/index.html                 <- 데모 웹페이지
  demo/demo.css
  references/{shisa,momonga,rakko}/ <- 작업 시트/원본 설정/미리보기
  MANIFEST_SHA256.json
```

## 참고

**이 ZIP에는 기존 치이카와·하치와레·우사기 이미지가 들어 있지 않습니다.** 사용자 프로젝트에 기존 3종 에셋이 이미 있으면 그대로 둡니다. `enabledCharacters` 옵션으로 6종을 켤 수 있습니다. 기존 것 없이 이 패키지만 데모 실행하면 시사·모몽가·랏코 3종이 나옵니다.

기존 애니메이션과 동일한 부드러운 연속 작화가 아닌 정지 포즈 기반 교체+CSS 연출입니다. 원작 공식 추출 프레임이 아니며 개인용 사용을 전제로 합니다.
