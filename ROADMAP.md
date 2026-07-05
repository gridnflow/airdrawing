# 미래의 Opus에게 — Air Drawing 발전 가이드

이 문서는 이 프로젝트를 이어받아 발전시킬 미래의 AI 어시스턴트(그리고 사람)를 위한 핸드오프 문서다. 2026-07-06 기준 상태를 요약하고, 어디를 어떻게 발전시키면 좋을지 정리한다.

## 현재 상태 (v0.1)

웹캠 앞에서 검지로 허공에 그림을 그리는 브라우저 앱. 백엔드 없음.

- **스택**: Vite + TypeScript (vanilla, 프레임워크 없음), MediaPipe Tasks Vision HandLandmarker, Canvas 2D, OpenAI API (그림 인식)
- **제스처**: ☝️ 검지만 폄 = 그리기 / ✊ 주먹 = 펜 업 / 🖐️ 손바닥 = 지우개
- **AI 인식**: 그린 스트로크를 흰 배경 PNG로 합성해 `gpt-4o-mini`에 보내 "뭘 그렸는지" 추측 (`src/ai.ts`)

### 모듈 구조

```
src/
├── main.ts        rAF 루프 오케스트레이션, UI 바인딩, 좌표 변환(미러)
├── camera.ts      getUserMedia + 카메라 줌 최소화 시도
├── tracker.ts     HandLandmarker 래퍼 (비디오 프레임 변경 시에만 감지)
├── gestures.ts    손가락 펴짐 판정 + 제스처 분류 + N프레임 디바운서
├── smoothing.ts   One Euro Filter (검지 좌표 떨림 제거)
├── drawing.ts     펜 상태머신, 스트로크 렌더링, destination-out 지우개, PNG 저장
└── ai.ts          OpenAI 클라이언트 (키는 localStorage, dangerouslyAllowBrowser)
```

### 알아두면 좋은 함정들

- **미러 좌표**: 비디오는 CSS `scaleX(-1)`로 뒤집고, 캔버스 좌표는 코드에서 `x = (1 - lm.x) * width`로 뒤집는다. 둘 중 하나만 고치면 그림이 반대로 그려진다.
- **erasableSyntaxOnly**: 이 Vite 템플릿의 tsconfig가 생성자 파라미터 프로퍼티(`constructor(private x)`)를 금지한다. 명시적 필드로 써야 한다.
- **stroke() 중복 누적**: `lineTo` 후 `stroke()`만 반복하면 path 전체가 매번 다시 그려져 선이 두꺼워진다. 매 세그먼트 후 `beginPath()`로 리셋한다 (`drawing.ts` 참고).
- **MediaPipe 에셋은 CDN**: WASM은 jsdelivr(버전 고정), 모델(.task, ~8MB)은 Google storage. 오프라인 데모가 필요하면 `public/`에 번들할 것.
- **디바운스**: 제스처 전환은 4프레임 연속 일치가 필요 (`main.ts`의 `GestureDebouncer(4)`). 주먹 쥐는 도중 선이 삐죽 그어지는 문제 방지용. 반응이 굼뜨면 이 값을 줄인다.

## 발전 방향 (우선순위 순 제안)

### 1. 게임 모드 — "AI 캐치마인드" (가장 임팩트 큼)
제시어를 주고 제한시간 안에 그리면 AI가 맞추는 게임. 이미 인식 파이프라인이 있으므로 추가 작업은 제시어 목록, 타이머, 채점 UI 정도. 데모/포트폴리오 한 방이 나온다.

### 2. 스트로크 품질
- 속도 기반 선 굵기 (빠르게 그으면 얇게) — 붓 느낌
- 스트로크를 점 배열로 저장하고 렌더는 Catmull-Rom/quadratic 곡선으로 → 실행취소(undo) 구현도 같이 풀림
- 현재는 캔버스에 직접 굽기 때문에 undo가 불가능하다. 스트로크 히스토리 자료구조 도입이 선행 과제.

### 3. 제스처 확장
- 엄지 인식 추가 (현재 판정에서 제외됨 — `gestures.ts`의 FINGERS 참고)
- ✌️ 두 손가락 = 색상 변경, 👌 OK = undo 같은 매핑
- 두 손 지원 (`numHands: 2`) — 한 손은 팔레트, 한 손은 펜

### 4. AI 기능 심화
- 인식 결과 스트리밍 표시
- "낙서를 깔끔한 그림으로 변환" (이미지 생성 API 연동)
- 허공 글씨 OCR → 텍스트 입력기
- 공개 배포 시 API 키 보호를 위한 서버 프록시 (현재는 키가 localStorage에 있어 개인용만 가능)

### 5. 출력/공유
- 그리는 과정 녹화 (MediaRecorder → webm)
- OBS Virtual Camera 연동으로 화상회의에서 판서

### 6. 기술 부채
- 테스트 없음. `gestures.ts`(순수 함수)와 `smoothing.ts`부터 vitest 붙이는 게 가성비 좋다.
- 모바일 미지원 (성능/레이아웃 미검증)
- 손 인식 신뢰도가 낮은 조명 환경에서 UX 안내 없음

## 실행 방법

```sh
npm install
npm run dev    # http://localhost:5173
npm run build  # 타입체크 + 번들
```

AI 인식을 쓰려면 OpenAI API 키가 필요하다 (버튼 첫 클릭 시 입력 → localStorage 저장).
