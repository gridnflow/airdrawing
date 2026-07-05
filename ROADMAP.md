# 미래의 Opus에게 — Air Drawing 개발 지시서

이 문서는 이 프로젝트를 이어받을 미래의 AI 어시스턴트(Opus, 그리고 사람)를 위한 핸드오프 문서이자 **실행 가능한 작업 지시서**다. 2026-07-06 기준 상태를 요약하고, 무엇을 어떤 순서로 어떻게 구현해야 하는지까지 적어둔다. 각 작업에는 완료 기준이 있으니, 그대로 따라가면 된다.

---

## 1. 현재 상태 (v0.1)

웹캠 앞에서 검지로 허공에 그림을 그리는 브라우저 앱. 백엔드 없음.

- **스택**: Vite + TypeScript (vanilla, 프레임워크 없음), MediaPipe Tasks Vision HandLandmarker, Canvas 2D, OpenAI API (그림 인식)
- **제스처**: ☝️ 검지만 폄 = 그리기 / ✊ 주먹 = 펜 업 / 🖐️ 손바닥 = 지우개
- **AI 인식**: 그린 스트로크를 흰 배경 PNG로 합성해 `gpt-4o-mini`에 보내 "뭘 그렸는지" 추측 (`src/ai.ts`)

### 모듈 구조

```
src/
├── main.ts        rAF 루프 오케스트레이션, UI 바인딩, 좌표 변환(미러)
├── camera.ts      getUserMedia + 카메라 줌 최소화 시도 (지원 기기 한정)
├── tracker.ts     HandLandmarker 래퍼 (비디오 프레임 변경 시에만 감지)
├── gestures.ts    손가락 펴짐 판정 + 제스처 분류 + N프레임 디바운서
├── smoothing.ts   One Euro Filter (검지 좌표 떨림 제거)
├── drawing.ts     펜 상태머신, 스트로크 렌더링, destination-out 지우개, PNG 저장
└── ai.ts          OpenAI 클라이언트 (키는 localStorage, dangerouslyAllowBrowser)
```

### 실행 방법

```sh
npm install
npm run dev    # 포트 5173 (사용 중이면 자동으로 다음 포트)
npm run build  # tsc 타입체크 + vite 번들 — 커밋 전 반드시 통과시킬 것
```

AI 인식은 OpenAI API 키 필요 (버튼 첫 클릭 시 입력 → localStorage `openai-api-key`에 저장).

---

## 2. Opus 작업 규칙

미래의 Opus는 아래 규칙을 지켜라:

1. **커밋 메시지는 영어로, Co-Authored-By 줄은 절대 넣지 않는다.** (사용자의 전역 지침)
2. **모든 변경 후 `npm run build`를 통과시킨다.** 이 템플릿의 tsconfig는 엄격하다 (아래 함정 참고).
3. **웹캠·제스처 동작은 headless로 검증 불가.** 빌드 통과 후 사용자에게 브라우저 확인을 요청하고, 무엇을 확인해야 하는지 구체적으로 알려줘라 (예: "주먹 쥐는 순간 선이 삐죽 그어지지 않는지").
4. **프레임워크를 도입하지 마라.** rAF 루프 중심 구조에 React 등은 오히려 방해다. vanilla TS를 유지한다.
5. **모듈 경계를 지켜라.** 제스처 로직은 `gestures.ts`, 렌더링은 `drawing.ts`. `main.ts`가 비대해지면 분리하라.
6. 새 기능은 아래 §4 작업 목록의 우선순위를 따르되, 사용자가 다른 걸 원하면 당연히 그게 우선이다.

### 함정 (건드리기 전에 읽어라)

- **미러 좌표 이중 반전**: 비디오는 CSS `scaleX(-1)`, 캔버스 좌표는 코드에서 `x = (1 - lm.x) * width`. 둘 중 하나만 고치면 그림이 좌우 반대로 그려진다. `main.ts`의 `toCanvas()`가 유일한 변환 지점이다.
- **erasableSyntaxOnly**: tsconfig가 생성자 파라미터 프로퍼티(`constructor(private x)`)를 금지한다. 명시적 필드 선언으로 써라.
- **stroke() 중복 누적**: `lineTo` 후 `stroke()`만 반복하면 path 전체가 매번 다시 그려져 선이 두꺼워진다. 세그먼트마다 `beginPath()` 리셋 (`drawing.ts:penMove` 참고).
- **MediaPipe 에셋은 CDN**: WASM은 jsdelivr(0.10.35 버전 고정), 모델(.task, ~8MB)은 Google storage. 첫 로드에 인터넷 필요.
- **디바운스 튜닝**: 제스처 전환은 4프레임 연속 일치 필요 (`main.ts`의 `GestureDebouncer(4)`). 줄이면 반응 빨라지지만 주먹 쥐는 도중 선이 삐죽 그어진다.
- **AI 키는 클라이언트에 있다**: 공개 서비스로 배포하면 키가 노출된다. 배포 전에 반드시 Task 7(서버 프록시)을 먼저 하라.

---

## 3. 목표 비전

**"허공에 그리면 AI가 알아맞히는 게임"**을 완성형으로 본다. 포트폴리오 데모로서 한 방(제시어 → 그리기 → AI 채점)이 있고, 그 아래에 탄탄한 드로잉 도구가 받쳐주는 그림이다.

---

## 4. 작업 목록 (우선순위 순)

각 작업은 독립 커밋(들)으로 완결하라. **완료 기준(DoD)을 만족하지 못하면 다음 작업으로 넘어가지 마라.**

### ✅ Task 1 — 스트로크 히스토리 리팩터링 (완료 2026-07-06)

현재 `drawing.ts`는 캔버스에 직접 굽기 때문에 undo가 불가능하다. 이걸 먼저 풀어야 Task 2~3이 쉬워진다.

**구현 순서:**
1. `src/strokes.ts` 신설:
   ```ts
   interface Stroke { points: {x: number; y: number}[]; color: string; width: number }
   ```
   `StrokeStore` 클래스: `beginStroke()`, `addPoint()`, `endStroke()`, `undo()`, `clear()`, `strokes` 게터.
2. `drawing.ts`를 "StrokeStore를 받아 전체 리렌더"하는 방식으로 변경. 매 프레임 전체를 다시 그리면 스트로크가 많을 때 느려지므로: **완성된 스트로크는 오프스크린 캔버스에 구워두고, 진행 중인 스트로크만 매 프레임 다시 그려라.** undo 시에만 오프스크린을 전체 리빌드.
3. 지우개는 "스트로크 삭제" 방식으로 변경 (지우개 원과 교차하는 스트로크를 통째로 삭제). destination-out 픽셀 지우개보다 undo와 일관성 있다.
4. 렌더는 점 배열을 quadratic curve(중점 보간)로 그려 부드럽게.
5. UI에 실행취소 버튼 추가 + `Cmd/Ctrl+Z` 키보드 지원.

**DoD**: 그리기→undo→다시 그리기가 자연스럽고, 스트로크 50개 이상에서도 60fps 유지. `npm run build` 통과.

### ✅ Task 2 — 게임 모드 "AI 캐치마인드" (완료 2026-07-06)

**구현 순서:**
1. `src/game.ts` 신설. 상태머신: `idle → countdown(3초) → drawing(30초) → judging → result`.
2. 제시어 목록 (쉬운 명사 50개+: 고양이, 집, 자전거, 우산, 물고기…) 하드코딩으로 시작.
3. 라운드 시작: 캔버스 클리어 → 제시어 + 남은 시간 표시 (stage 위 오버레이).
4. 시간 종료 또는 "제출" 제스처(👍 또는 버튼)에서 `ai.ts` 호출. **채점용 프롬프트는 별도로 만들어라**: 제시어를 알려주지 말고 "무엇인지 한 단어로 답하라"고 한 뒤 클라이언트에서 제시어와 비교하는 방식이 치팅 없는 정직한 채점이다. 응답은 JSON(`{ guess: string, confidence: number }`)으로 받아라 (`response_format: { type: 'json_object' }` 사용).
5. 결과 화면: AI의 추측, 정답 여부, 점수(남은 시간 비례). 연속 라운드 + 누적 점수.
6. 게임 중에는 지우개 대신 "전체 지우기" 제스처만 허용하는 게 조작 실수를 줄인다.

**DoD**: 시작→그리기→채점→결과→다음 라운드 루프가 끊김 없이 돌고, AI 오답 시에도 UX가 자연스럽다 (예: "고양이인 줄 알았는데 강아지였군요!").

### ✅ Task 3 — 제스처 확장 (완료 2026-07-06 — 실사용 오인식률은 브라우저에서 계속 관찰할 것)

1. `gestures.ts`에 엄지 판정 추가. 엄지는 tip-PIP 거리 비교가 불안정하므로 **엄지 tip(4)과 새끼 MCP(17) 거리**로 폈는지 판정하라.
2. 👍 (엄지만 폄) = 게임 모드 제출 / 일반 모드 undo.
3. ✌️ (검지+중지) = 색상 순환 (팔레트 5색). 전환 시 커서에 현재 색 1초 표시.
4. 각 제스처 추가마다 기존 3개 제스처의 오인식이 늘지 않는지 확인 (특히 point↔two-finger 경계). 디바운스 프레임을 제스처별로 다르게 줄 수 있게 `GestureDebouncer`를 확장해도 좋다.

**DoD**: 5개 제스처가 서로 오인식 없이 동작 (사용자 브라우저 테스트 필수).

### ✅ Task 4 — 테스트 도입 (완료 2026-07-06 — vitest 28케이스, CI 포함)

1. `npm install -D vitest` 후 `package.json`에 `"test": "vitest run"` 추가.
2. 순수 함수부터: `gestures.ts`의 `classify()`(합성 랜드마크 배열로 point/fist/palm 케이스), `GestureDebouncer`(전환 타이밍), `smoothing.ts`(수렴성, reset).
3. 합성 랜드마크 fixture를 만들어두면 이후 제스처 추가 때마다 회귀 테스트가 된다.

**DoD**: `npm test` 통과, 최소 15개 케이스. CI는 GitHub Actions로 `build + test` (`.github/workflows/ci.yml`).

### ✅ Task 5 — 배포 (GitHub Pages) (완료 2026-07-06)

1. `vite.config.ts`에 `base: '/airdrawing/'` 추가.
2. GitHub Actions로 main 푸시 시 빌드 → Pages 배포.
3. **주의**: 배포 후에도 AI 인식은 각자 자기 키를 넣는 구조라 데모 가능하지만, 불특정 다수용이면 Task 7 선행.
4. getUserMedia는 HTTPS 필수 — GitHub Pages는 HTTPS라 문제없다.

**DoD**: 공개 URL에서 카메라 권한 → 그리기까지 동작.

### ⛔ Task 6 — 녹화 기능 (사용자 지시로 제외 — 요청 전까지 구현하지 말 것)

1. `MediaRecorder`로 합성 스트림 녹화: 오프스크린 캔버스에 비디오(미러) + 그림 캔버스를 rAF마다 합성하고 `canvas.captureStream(30)`을 녹화.
2. 녹화 시작/정지 버튼, 정지 시 webm 다운로드.

**DoD**: 30초 녹화 시 프레임 드랍 체감 없음, webm이 QuickTime/Chrome에서 재생됨.

### 🔶 Task 7 — API 키 보호용 서버 프록시 (코드 완료, 배포는 사용자 Cloudflare 계정 필요)

1. Vercel Edge Function 또는 Cloudflare Workers 하나로 충분: `POST /api/recognize`가 이미지(base64)를 받아 서버 측 키로 OpenAI 호출 후 결과만 반환.
2. rate limit (IP당 분당 5회)과 이미지 크기 제한(1MB)을 반드시 넣어라.
3. `ai.ts`는 환경변수(`import.meta.env.VITE_API_PROXY`)가 있으면 프록시로, 없으면 기존 localStorage 키 방식으로 동작하게 분기.

**DoD**: 클라이언트 번들과 네트워크 탭 어디에도 키가 노출되지 않음.

### 백로그 (순서 무관, 여유 있을 때)

- 허공 글씨 OCR 모드 (그리기 → 텍스트 변환)
- 낙서를 이미지 생성 API로 "깔끔한 그림"으로 변환
- 두 손 지원 (`numHands: 2`): 왼손 팔레트, 오른손 펜
- 속도 기반 선 굵기 (붓 느낌)
- 모바일 대응 (성능 측정 먼저 — 저사양에서 HandLandmarker가 15fps 이하면 해상도를 640으로 낮춰라)
- MediaPipe 에셋 로컬 번들 (오프라인 데모용)
- 조명이 어두워 인식률 낮을 때 안내 배너

---

## 5. 마지막으로

- 사용자는 이 프로젝트를 포트폴리오(`~/dev/pf/`)로 만들고 있다. **"보여줄 수 있는 한 방"이 코드 우아함보다 우선**이다. Task 1은 그 기반 공사고, Task 2가 그 한 방이다.
- 막히면 이 문서를 갱신하라. 이 문서 자체가 프로젝트의 기억이다. 완료한 Task는 체크 표시하고, 새로 발견한 함정은 §2에 추가해라.

— 2026-07-06, 이전 담당 Opus가.
