# Chiikawa JLPT Vocabulary

최신 재현 스냅샷: **로컬 MP3 · 단어 표시 유지 + 모바일 직접 입력 hotfix**. 연속 걷기는 포함하지 않습니다.
정적 27파일이며 아래 고정 manifest로 검증합니다. 이 소스 백업 자체는 운영 배포를 수행하지 않습니다.

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
- `dist/separate-pages/manifest.json`은 생성된 나머지 26파일의 SHA-256을 기록합니다. 공개된 PNG 13개는 원본 바이트 그대로 재사용합니다. 배포 명령·CDN·새 의존성은 추가하지 않습니다.

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
CV_SEPARATE_TEST_SITE="$PWD/dist/separate-pages" node --test tests/page-fixture-calibration.test.cjs tests/page-navigation.test.cjs tests/study-overlay-layout.test.mjs tests/page-bgm.test.cjs tests/mobile-input-regression.test.mjs tests/mobile-input-v2.test.mjs
python3 -m unittest discover -s tests -p 'test_separate_pages.py' -v
python3 -c "from pathlib import Path; import hashlib; assert hashlib.sha256(Path('dist/separate-pages/manifest.json').read_bytes()).hexdigest() == '159160a4f3045bac2c1b31d9c920f2290c4f12cffbfe755a1d91a5e1901eb448'"
```

- 고정 입력 `legacy-self-contained.html`: SHA-256 `777f3694738039dc1a244d5661136eef75c7778bbebcace02caa5115c6e4231c`.
- 최신 재현 대상: 아래 manifest 해시로 고정한 **MP3·단어 표시·직접 터치 통합판**의 3 HTML과 공통 자원. 이전 3페이지 운영 `597fb7f34eccc6ed652adc6400832c5e71681510` 재현 소스는 백업 커밋 `4f75de71c21dc49bdf29aae83f00482ec93ec6d9`에 그대로 보존되어 있습니다. 이 소스 스냅샷 자체는 운영 배포나 브라우저 검수 결과를 뜻하지 않습니다.
- 공개 산출물은 27파일(빈 `.nojekyll`과 해시 manifest 포함)입니다. PNG 13개를 변경 없이 재사용합니다.
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

## 공부 화면 overlay 기반과 유지 기능

- 공부 화면의 캐릭터 선택 dock·빈 예약 공간을 제거합니다. 설정 페이지에는 기존 선택/크기/배경/동작 설정과 미리보기를 유지합니다.
- 공부 화면의 기존 캐릭터 배우가 viewport에서 기존 잡기/놓기 등 입력을 받습니다. 실제 글줄과 버튼 등 조작부의 사각형을 피하고, 안전한 공간이 없으면 겹침을 강행하지 않습니다. 빈 투명 overlay로 입력을 가로막지 않습니다.
- 캐릭터 선택·크기·학습 localStorage 키, 단어 7,180개, 원본 이미지 payload와 PNG 13개는 그대로입니다. 배우 동작 확률이나 원화/이미지 인코딩은 바꾸지 않습니다.
- 부모 CSS는 원본 HTML의 `<head>`에서만 추출하여 iframe `srcdoc` 안의 CSS가 공부 화면 스크롤을 잠그지 않게 합니다. 설정 페이지의 내부 스크롤과 캐릭터 전용 보기의 스크롤 규칙은 따로 유지합니다.
- 각 HTML의 CSS/실행 JS 참조는 상대 경로와 해당 파일 SHA-256 앞 12자리 `?v=`를 사용합니다. 외부 CDN·네트워크 빌드 의존성은 없습니다.
- 공개 한정 검사는 Node 66개와 Python 7개이며, 단어/원본 이미지 보존·학습 이동/저장·설정 왕복·레이아웃 helper·CSS 추출·asset hash query·27파일 고정 manifest를 검사합니다. 제어된 DOM/좌표 검사는 실제 브라우저 레이아웃·스크롤/터치 검사를 대체하지 않습니다. 전체 기존 회귀 suite를 재실행했다는 뜻도 아닙니다.
- `tests/study-overlay-layout.test.mjs`는 생성된 실제 runtime의 주 엔진 helper를 검사합니다. 내부 진단 폴더, 사용자 사진, 작업 경로, 별도 mock 패키지는 필요 없습니다.

최신 고정 manifest SHA-256:
`159160a4f3045bac2c1b31d9c920f2290c4f12cffbfe755a1d91a5e1901eb448`

기존 전체 단일 파일(full777f), 원본 소스·단어 데이터, 이전 3페이지 스냅샷은
보존합니다. `legacy-self-contained.html`과 `dist/`는 공개 소스만으로 로컬 재생성하며,
원본 PNG를 다시 인코딩하거나 생성된 대형 HTML을 중복 업로드할 필요가 없습니다.

## 로컬 MP3·단어 표시·직접 터치 통합판

- 세 페이지에서 MP3 여러 파일 선택, 재생/일시정지, 정지/처음으로, 이전/다음, 곡 선택, 음량, 반복을 제공합니다. 초기 플레이어는 접혀 있으며 파일 선택만으로 자동재생하지 않습니다.
- 파일·파일명·목록·시간·URL·재생 상태는 현재 문서 메모리에만 존재합니다. 업로드, 원음 변환, 파일 바이트 영구저장, 음원 동봉은 없습니다. 실제 페이지 이동/새로고침에서는 정지하고 URL/파일 참조를 해제하므로 파일을 다시 선택해야 합니다. 차단된 학습 이동은 현재 음악을 끊지 않습니다.
- `cv-bgm-preferences-v1`은 `{version:1,volume:0..1,repeat:'off'|'one'|'all'}`만 저장합니다. 자동재생은 OFF 고정이며 저장하지 않습니다. 음량/반복 저장이 막혀도 현재 페이지 재생은 사용할 수 있습니다.
- 수동 이전/다음은 끝에서 순환하고 정지 상태면 선택만 바꿉니다. 자연 종료의 반복없음은 다음 곡/목록끝 정지, 한곡은 현재곡, 전체는 끝에서 첫곡입니다. 재생 오류를 자동으로 건너뛰지 않습니다. 늦은 Promise/event와 객체 URL 수명을 제한합니다.
- 공부 화면의 뜻 표시 checkbox와 히라가나·예문·번역 묶음 checkbox는 기본 모두 켜짐입니다. `cv-study-visibility-v1`에 version/meaning/readingExample만 저장하며 원문·단어·진도·답변취소·학습백업 형식을 바꾸지 않습니다.
- 공부 배우의 직접 터치 drag 경로를 추가하고 tap/중단/두 번째 손가락 처리를 구분합니다. 배우 바깥의 페이지 스크롤, 설정/캐릭터만 보기에서도 배우 hitbox는 직접 끌기를 받으며 배우 바깥의 dock 스크롤은 유지합니다. 새 걷기 원화·확률 변경이 아닙니다.
- 추가 소스는 `page-adapters/bgm-player.{js,css,html}`, `page-adapters/study-visibility.{js,css}`와 `study_overlay.py`의 좁은 입력 수정입니다.
- 공개 한정 검사는 source-only 재현 Node84/Python7입니다. VM media·pointer 테스트는 실제 MP3 decode/청취나 실터치를 증명하지 않습니다. 실제 사용자 파일/사진/스크린샷은 테스트나 공개소스에 포함하지 않습니다.
- 이전 overlay v3 source는 `e4bfb8c6be09d8aad65cacfe474ca4bb37bc7ec2`, 이전 3페이지 source는 `4f75de71c21dc49bdf29aae83f00482ec93ec6d9`에 보존됩니다. full777f·compact262·원본PNG13은 계속 같은 바이트로 재사용합니다.

## 모바일 직접 입력 hotfix (연속 걷기와 분리)

- 공부/설정/캐릭터만 보기의 배우 hitbox에 같은 직접 터치 끌기를 적용합니다. 자식 figure의 암묵 capture가 부모 배우로 이전될 때 버블링되는 자식 capture-loss는 부모가 같은 pointer를 소유하면 무시하지만, 실제 부모 capture 상실/취소는 계속 취소합니다. 페이지 전체를 스크롤 금지하지 않습니다.
- 기존 고급 반응 dispatch가 명시적으로 false를 반환한 짧은 tap만, 안정된 학습 상태·편집 입력/IME 없음 조건에서 기존 generic 반응을 한 번 사용할 수 있습니다. 45ms 큐 처리 직전에도 조건을 다시 확인하고 안전하지 않으면 폐기하며 나중에 재생하지 않습니다. 기존 opt-in을 자동으로 켜거나 고급 원화 반응을 강요하지 않습니다.
- 단어/학습 저장/MP3 수명/표시 설정과 원본 에셋은 그대로입니다. 새 연속 걷기 컨트롤러·UI·확률 변경은 없습니다.
- `study_overlay.py` 한 제품 파일과 공개 mobile 회귀검사 두 파일이 갱신되었습니다. `test_separate_pages.py`의 고정 manifest SHA 한 줄은 이 hotfix의 실제 산출물을 검증하도록 갱신했고, 기존 27파일 검사와 다른 assertion은 제거/완화하지 않았습니다.
- 공개 최소 입력만으로 full777f를 복원하고 27파일을 두 번 정확 재빌드하여 확인합니다. 위 공개 한정 검사는 Node84/Python7이며 전체 제품 suite나 실폰 검증을 대신하지 않습니다. VM pointer 검사만으로 실제 휴대전화의 터치/hit testing 성공을 확정하지 않습니다.
- 이전 MP3 통합 소스는 `b495980638ca7eb16201aff766df29b57986f5e2`에 보존됩니다. 이 소스 스냅샷 자체는 운영 승격을 수행하지 않습니다. 큰 전체 HTML·PNG·음원·사용자 사진의 신규 업로드는 없습니다.


## 바닥 배치 v2 및 BGM 정리 — 부분 운영 반영

운영 버전 `ab1fbd9bab7a4516b808cf7a203624ed6cc2897e`에 바닥 배치와 BGM 정리를 반영했습니다. 기존 모바일 직접 입력·3페이지·학습 데이터를 보존합니다. 오래된 공부 화면의 `padding-top:24px` 선택자가 `.cv-floor-layout`에는 적용되지 않도록 한정하여, 좁은 화면에서 콘텐츠 영역이 바닥 배우를 가리던 문제를 수정했습니다. 상단 빈공간 재배치 UI는 없습니다.

- 390px·320px 검수 환경에서 바닥의 6배우 표시와 잡기/착지, 학습 답변/되돌리기를 확인했습니다. 운영 390px 읽기 전용 확인에서는 기존 학습 기록을 변경하지 않았습니다. 이 결과를 실제 휴대전화 터치나 모든 기기에서의 성공으로 확대하지 않습니다.
- **모바일 연속 걷기는 미완료입니다.** 320px 검사에서는 첫 프레임 뒤 약0.36초에 안전 정지하여 반복 보행을 통과하지 못했습니다. 걷기는 기본 OFF이며 명시적 시작 요청으로만 실행되고, 잡기·학습 입력·실제 창 이탈 등에는 정지합니다. 자연스러운 전체 보행 완료를 보증하지 않습니다.
- BGM은 기존 단일 음원 `assets/bgm/chiikawa-mix.mp3`를 참조합니다. 파일 선택·음량 UI는 제거했고, 자동재생은 OFF이며 재생 위치는 저장하지 않습니다. 기존 음원 blob `e74e698356d0d7dbd4e2d29ce14a7a8b22001659`를 재사용합니다. 이 소스 백업에서 음원을 다시 전송하지 않습니다.
- 기존 원본 full777f와 13PNG, 이전 소스 `653d8d2a7f215b52851a1503427c32ad511d00dc`를 보존합니다. 새 하치와레·시사·랏코 생성 후보는 포함하지 않습니다.
- 공개 최소 입력으로 28파일을 두 번 정확 재현했습니다. 이 버전의 공개 집중검사는 Node63/Python9이며, 앞 절의 이전 버전 검사 수치와 구분합니다. 소스 검사가 실제 화면 검사를 대신하지는 않습니다.

현재 공개 산출물 manifest SHA256: `e224beb4b575c404e11432a0d0115e433cb0ec1e334ebf6a9d69ffd6b81961d8`.
