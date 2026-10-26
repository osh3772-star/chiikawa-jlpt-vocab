# Chiikawa JLPT Vocabulary

A browser-based JLPT vocabulary app with 7,180 entries and six interactive character companions. Built with HTML, CSS, vanilla JavaScript and a Python standard-library build script.

## Features

- N5–N1 vocabulary with readings, Korean meanings, examples and translations.
- Arrow keys: left/right to navigate, up for known, down for unknown.
- Review only unknown words, with filters by JLPT level.
- Progress and ratings saved in the current browser's local storage.
- Six companions with individual poses, autonomous actions, dragging, falling and learning reactions.
- Responsive desktop and mobile layouts. Character settings retain their dock; the study page uses interactive viewport actors without a character-selection dock or reserved lane.

## Run locally

```sh
python build_html.py
```

Open `단어장.html` in a browser. It contains the vocabulary, styles, scripts and character images and does not require a server.

## Publish with GitHub Pages

The `main` branch's `/docs` directory contains the current three-page static site.
This source-backup branch preserves its older `docs/` files; do not treat those
files as the latest deployment and do not overwrite `docs/index.html` with the
single-file offline build. Reproduce the three-page package locally with the
commands below. Publication is a separate step and is not performed by a build.

Keep `docs/.nojekyll` in place. The public site does not upload or synchronize study progress. Progress from a local file remains in that browser storage and is separate from the hosted site's storage.

## Source layout

- `단어장.template.html`: vocabulary UI and study logic.
- `theme.css`: page layout and theme.
- `chiikawa-pets/`: character engine, scoped styles and integration.
- `전체_단어장.json`, `원본데이터/section*.json`: vocabulary and level ranges.
- Asset folders: supplied character images and pose configurations.
- `build_html.py`: creates the self-contained local application.
- `docs/`: preserved historical generated output on the source-backup branch; current hosted output is on `main`.

## Autonomous action probabilities

The table below is the legacy decision-weight baseline, not a promise that every action is playable: unavailable directional sequences and quarantined artwork use explicit idle/static fallbacks.

Edit `chiikawa-pets/behavior-config.json`, then rebuild. Each character's table sums to 100 and is sampled once whenever the character chooses its next autonomous action. Percentages describe decisions, not time spent in each pose. Movement direction and durations are randomized separately. Dragging, physics and vocabulary-event reactions retain priority.

| Character | Rest | Move | Character actions |
| --- | ---: | ---: | ---: |
| Chiikawa | 25% | 30% | 45% |
| Hachiware | 20% | 30% | 50% |
| Usagi | 10% | 35% | 55% |
| Shisa | 25% | 25% | 50% |
| Momonga | 15% | 30% | 55% |
| Rakko | 30% | 20% | 50% |

Run the distribution and validation checks with `node --test tests/behavior.test.mjs`.

Raw APK files, local verification backups and screenshot outputs are excluded from Git.

## Sequence engine (local implementation)

The engine now supports explicitly approved directional frame sequences and
sheet rectangles. Existing artwork remains a static fallback: it is not warped,
shaken or mirrored to simulate animation. Missing walk assets rest instead.
See [animation contract and verification](chiikawa-pets/README-animation.md).
Run `node --test tests/*.test.mjs`, then `python build_html.py` and
`python build_preview.py`, then
`python -m unittest discover -s tests -p 'test_*.py' -v` for local checks.
The second build prepares the existing isolated DRAFT lab HTML consumed by
`DraftPreviewTests`; it packages existing PNGs without creating new artwork.
It does not approve that artwork or add the lab to the published `/docs` app.

The local vocabulary app also includes an explicit **치이카와 동작 베타** opt-in:
separate left/right four-keypose walking, held reactions and landing in a safe
header lane. It is off by default and clearly unapproved/coarse beta artwork,
not a completed 12-frame cycle. Other characters and study storage are preserved.
See [Korean code guide](chiikawa-pets/코드_안내.md).

## 세 개의 독립 페이지 (2026-10-26)

```sh
python3 assemble_legacy.py
python3 build_pages.py --output dist/separate-pages
python3 -m http.server --directory dist/separate-pages 8000
# http://localhost:8000/index.html
```

- `index.html`: 급수 선택, 이어하기, 모르겠음 복습 목록, 학습 기록 백업/복원.
- `character-settings.html`: 캐릭터 선택, 크기, 배경, 동작 옵션과 기존 미리보기.
- `study.html`: 학습 카드/평가/취소, 최소 이동 링크와 캐릭터. 설정 폼은 실제 문서에 없습니다.
- 같은 origin의 기존 localStorage 키와 학습 백업 형식을 그대로 사용합니다.
- `page-adapters/`와 `study_overlay.py`는 페이지 경계/세션 전송/공부 화면 배치를 담당합니다. 기존 학습·캐릭터 엔진과 배우 입력을 재사용하며 확률, 원화, 단어를 변경하지 않습니다.
- `python3 assemble_legacy.py`가 기존 공개 compact HTML과 PNG 13개의 바이트를 검증하여 `legacy-self-contained.html`을 복원합니다. 이 파일은 분리 직전 compact 전체 단어장(full777f)의 바이트 고정 백업이자 새 패키지의 기준 입력입니다. 기존 `build_html.py`와 원본 소스·전체 오프라인 `단어장.html`도 보존되어 있습니다. 새 UI 수정은 `build_pages.py`/`page-adapters/`에 적용합니다.
- 세 페이지는 HTTP(S) 동일 origin용입니다. `file://` 사용 시 브라우저별 저장소 격리가 다르므로 오프라인은 기존 `단어장.html`/`legacy-self-contained.html` 단일 파일을 사용하세요.
- `dist/separate-pages/manifest.json`은 생성된 나머지 23파일의 SHA-256을 기록합니다. 공개된 PNG 13개는 원본 바이트 그대로 재사용합니다. 배포 명령·CDN·새 의존성은 추가하지 않습니다.

### 페이지 이동의 저장 계약

`cv-page-handoff-v1`은 localStorage가 아닌 **sessionStorage 한 개 슬롯**입니다. 앱의 같은 탭 내부 링크 이동에서만 목적지/nonce/2분 만료를 갖는 일회용 전달이 만들어지고, 도착 즉시 삭제됩니다. URL에는 nonce·급수·복습 필터만 들어가며 학습 답변은 들어가지 않습니다. reload/direct link는 전달을 복원하지 않습니다.

전달 대상은 학습 모드·복습 큐/위치·최근 1회 답변 취소·복습 급수와 카니 일반 표시 요청뿐입니다. 이미 저장된 학습 답변 전체는 복제하지 않습니다. localStorage 쓰기가 실패한 때만 현재 창의 미저장 학습 상태를 전송합니다. sessionStorage도 실패하면 이동을 막고 현재 창 기록의 JSON 다운로드를 제공합니다. 저장 fingerprint가 달라진 미저장 상태는 덮어쓰지 않고 충돌 안내/백업을 제공합니다.

캐릭터의 진행 중 동작, 카니 잡고 놓기 iframe, 자동 날기/인사, 미적용 백업 파일은 전달하지 않습니다. 시작 페이지로 이동하면 undo는 해제됩니다. Back/Forward는 history.state의 제한된 학습 continuation을 fingerprint가 맞을 때만 사용하고, BFCache 재진입은 최신 캐릭터 설정을 읽는 새 문서로 한 번 교체합니다. 다른 문서 저장값이 바뀌면 낡은 undo를 폐기하며 미저장 상태는 충돌 차단합니다. Web Storage는 CAS를 제공하지 않으므로 정확히 동시의 쓰기를 원자적으로 합치는 기능은 아닙니다.

### 공개 소스만으로 재현 및 한정 검사

Python 3 표준 라이브러리와 Node.js 18 이상이 필요합니다. 추가 패키지 설치,
외부 테스트 도구, 원격 이미지 다운로드 없이 저장소 안에서 실행합니다.
아래 검사는 페이지 분리 전용이며 전체 회귀 검사나 실브라우저 검사를 대신하지 않습니다.

```sh
python3 assemble_legacy.py
python3 build_pages.py --output dist/separate-pages
CV_SEPARATE_TEST_SITE="$PWD/dist/separate-pages" node --test tests/page-fixture-calibration.test.cjs tests/page-navigation.test.cjs tests/study-overlay-layout.test.mjs
python3 -m unittest discover -s tests -p 'test_separate_pages.py' -v
python3 -c "from pathlib import Path; import hashlib; assert hashlib.sha256(Path('dist/separate-pages/manifest.json').read_bytes()).hexdigest() == '0b5bbfbfef25a4908a9d80fab330f42096c6e62f32284efae663c47b5ace847d'"
```

- 고정 입력 `legacy-self-contained.html`: SHA-256 `777f3694738039dc1a244d5661136eef75c7778bbebcace02caa5115c6e4231c`.
- 최신 재현 대상: 아래 manifest 해시로 고정한 **공부 화면 overlay v3**의 3 HTML과 공통 자원. 이전 3페이지 운영 `597fb7f34eccc6ed652adc6400832c5e71681510` 재현 소스는 백업 커밋 `4f75de71c21dc49bdf29aae83f00482ec93ec6d9`에 그대로 보존되어 있습니다. 이 소스 스냅샷 자체는 운영 배포나 브라우저 검수 결과를 뜻하지 않습니다.
- 공개 산출물은 24파일(빈 `.nojekyll`과 해시 manifest 포함)입니다. PNG 13개를 변경 없이 재사용합니다.
- `build_pages.py` 기본 출력 위치는 저장소의 형제 `site/`입니다. 위 명령은 명시적으로 저장소 내부 `dist/separate-pages/`를 사용합니다. Node 검사의 환경변수도 같은 위치를 지정하므로 다른 작업 폴더에 의존하지 않습니다.
- 기존 `build_html.py`는 원본 이미지가 포함된 독립 오프라인 `단어장.html`을 계속 생성합니다. 이 출력과 위 고정 compact 입력은 서로 다른 파일이며 덮어쓰지 않습니다.

### 고정 입력 복원 방식

`legacy-input/compact-26279961.html`은 이미 공개된 운영 커밋
`26279961032a420990e1e090c5b2199fcb7d4af6`의 `docs/index.html`과 같은
Git blob `04e886844b6d160c136c366a747b52a98ad0ff65`입니다. 저장소의
기존 `chiikawa-pets/reviewed-foot-assets/` PNG 12개와
`docs/assets/fde3946e1ad5a74f1830657510b5c3efad3ca9892c3653cdd8addaa3a6d8311c.png`
1개를 그대로 읽습니다. 새 이미지를 만들거나 PNG를 재인코딩하지 않습니다.

복원기는 compact 입력 해시·바이트 수, 13개 참조, 각 PNG 해시/서명,
최종 full777f 해시·24,646,852바이트를 모두 확인한 뒤에만 새 출력 파일을
만듭니다. 기존 `legacy-self-contained.html`이 정확하면 그대로 두며,
다르면 덮어쓰지 않고 실패합니다. `python3 assemble_legacy.py --check`는
출력 파일을 만들지 않고 모든 입력과 복원 결과를 검증합니다.
복원과 페이지 빌드 모두 저장소 안의 공개 파일만 사용하며 네트워크는 필요 없습니다.

## 공부 화면 overlay v3 소스 스냅샷

- 공부 화면의 캐릭터 선택 dock·빈 예약 공간을 제거합니다. 설정 페이지에는 기존 선택/크기/배경/동작 설정과 미리보기를 유지합니다.
- 공부 화면의 기존 캐릭터 배우가 viewport에서 기존 잡기/놓기 등 입력을 받습니다. 실제 글줄과 버튼 등 조작부의 사각형을 피하고, 안전한 공간이 없으면 겹침을 강행하지 않습니다. 빈 투명 overlay로 입력을 가로막지 않습니다.
- 캐릭터 선택·크기·학습 localStorage 키, 단어 7,180개, 원본 이미지 payload와 PNG 13개는 그대로입니다. 배우 동작 확률이나 원화/이미지 인코딩은 바꾸지 않습니다.
- 부모 CSS는 원본 HTML의 `<head>`에서만 추출하여 iframe `srcdoc` 안의 CSS가 공부 화면 스크롤을 잠그지 않게 합니다. 설정 페이지의 내부 스크롤과 캐릭터 전용 보기의 스크롤 규칙은 따로 유지합니다.
- 각 HTML의 CSS/실행 JS 참조는 상대 경로와 해당 파일 SHA-256 앞 12자리 `?v=`를 사용합니다. 외부 CDN·네트워크 빌드 의존성은 없습니다.
- 공개 한정 검사는 Node 40개와 Python 6개이며, 단어/원본 이미지 보존·학습 이동/저장·설정 왕복·레이아웃 helper·CSS 추출·asset hash query·24파일 고정 manifest를 검사합니다. 제어된 DOM/좌표 검사는 실제 브라우저 레이아웃·스크롤/터치 검사를 대체하지 않습니다. 전체 기존 회귀 suite를 재실행했다는 뜻도 아닙니다.
- `tests/study-overlay-layout.test.mjs`는 생성된 실제 runtime의 주 엔진 helper를 검사합니다. 내부 진단 폴더, 사용자 사진, 작업 경로, 별도 mock 패키지는 필요 없습니다.

최신 고정 manifest SHA-256:
`0b5bbfbfef25a4908a9d80fab330f42096c6e62f32284efae663c47b5ace847d`

기존 전체 단일 파일(full777f), 원본 소스·단어 데이터, 이전 3페이지 스냅샷은
보존합니다. `legacy-self-contained.html`과 `dist/`는 공개 소스만으로 로컬 재생성하며,
원본 PNG를 다시 인코딩하거나 생성된 대형 HTML을 중복 업로드할 필요가 없습니다.
