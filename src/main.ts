import './style.css'
import { setupCamera } from './camera'
import { HandTracker, type Landmarks } from './tracker'
import { classify, GestureDebouncer, type Gesture } from './gestures'
import { PointSmoother } from './smoothing'
import { DrawingLayer } from './drawing'
import { recognizeDrawing, judgeDrawing } from './ai'
import { Game } from './game'

const video = document.querySelector<HTMLVideoElement>('#video')!
const drawCanvas = document.querySelector<HTMLCanvasElement>('#draw')!
const uiCanvas = document.querySelector<HTMLCanvasElement>('#ui')!
const stage = document.querySelector<HTMLDivElement>('#stage')!
const statusEl = document.querySelector<HTMLDivElement>('#status')!
const badge = document.querySelector<HTMLDivElement>('#mode-badge')!
const gameOverlay = document.querySelector<HTMLDivElement>('#game-overlay')!
const colorInput = document.querySelector<HTMLInputElement>('#color')!
const widthInput = document.querySelector<HTMLInputElement>('#width')!
const undoBtn = document.querySelector<HTMLButtonElement>('#undo')!
const clearBtn = document.querySelector<HTMLButtonElement>('#clear')!
const saveBtn = document.querySelector<HTMLButtonElement>('#save')!
const recognizeBtn = document.querySelector<HTMLButtonElement>('#recognize')!
const gameBtn = document.querySelector<HTMLButtonElement>('#game')!
const debugInput = document.querySelector<HTMLInputElement>('#debug')!
const aiResult = document.querySelector<HTMLDivElement>('#ai-result')!

const uiCtx = uiCanvas.getContext('2d')!
const drawing = new DrawingLayer(drawCanvas)
const smoother = new PointSmoother()
const debouncer = new GestureDebouncer(4)

const PALETTE = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#ffffff']

const BADGE_TEXT: Record<Gesture, string> = {
  point: '✍️ 그리기',
  two: '🎨 색 변경',
  fist: '✊ 펜 업',
  palm: '🖐️ 지우개',
  thumbsUp: '👍',
  none: '· 대기',
}

// 손 스켈레톤 연결 (디버그 표시용)
const CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

const game = new Game(
  {
    clearCanvas: () => drawing.clear(),
    capture: () => drawing.toDataURL(),
    judge: (png) => judgeDrawing(png),
  },
  renderGameOverlay,
)

/** 정규화 랜드마크 → 캔버스 픽셀 (거울 모드라 x 반전) */
function toCanvas(lm: { x: number; y: number }): { x: number; y: number } {
  return { x: (1 - lm.x) * drawCanvas.width, y: lm.y * drawCanvas.height }
}

function palmCenter(lm: Landmarks): { x: number; y: number } {
  const ids = [0, 5, 9, 13, 17]
  let x = 0
  let y = 0
  for (const i of ids) {
    x += lm[i].x
    y += lm[i].y
  }
  return toCanvas({ x: x / ids.length, y: y / ids.length })
}

function drawSkeleton(lm: Landmarks): void {
  uiCtx.strokeStyle = 'rgba(0, 255, 140, 0.6)'
  uiCtx.lineWidth = 2
  for (const [a, b] of CONNECTIONS) {
    const p = toCanvas(lm[a])
    const q = toCanvas(lm[b])
    uiCtx.beginPath()
    uiCtx.moveTo(p.x, p.y)
    uiCtx.lineTo(q.x, q.y)
    uiCtx.stroke()
  }
  uiCtx.fillStyle = 'rgba(0, 255, 140, 0.9)'
  for (const p of lm) {
    const c = toCanvas(p)
    uiCtx.beginPath()
    uiCtx.arc(c.x, c.y, 3, 0, Math.PI * 2)
    uiCtx.fill()
  }
}

function drawCursor(mode: Gesture, x: number, y: number): void {
  uiCtx.lineWidth = 2
  if (mode === 'point') {
    uiCtx.fillStyle = drawing.color
    uiCtx.beginPath()
    uiCtx.arc(x, y, drawing.lineWidth / 2 + 3, 0, Math.PI * 2)
    uiCtx.fill()
  } else if (mode === 'palm') {
    uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    uiCtx.beginPath()
    uiCtx.arc(x, y, drawing.eraserRadius, 0, Math.PI * 2)
    uiCtx.stroke()
  } else if (mode === 'two') {
    // 현재 색을 크게 보여줌
    uiCtx.fillStyle = drawing.color
    uiCtx.strokeStyle = '#fff'
    uiCtx.beginPath()
    uiCtx.arc(x, y, 16, 0, Math.PI * 2)
    uiCtx.fill()
    uiCtx.stroke()
  } else {
    uiCtx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    uiCtx.beginPath()
    uiCtx.arc(x, y, 5, 0, Math.PI * 2)
    uiCtx.fill()
  }
}

function cycleColor(): void {
  const idx = PALETTE.indexOf(drawing.color)
  drawing.color = PALETTE[(idx + 1) % PALETTE.length]
  colorInput.value = drawing.color
}

/** 안정 제스처가 바뀌는 순간 한 번만 실행되는 액션 */
function onGestureChange(from: Gesture, to: Gesture): void {
  if (to === 'two') cycleColor()
  if (to === 'thumbsUp') {
    if (game.isRunning) game.submit()
    else drawing.undo()
  }
  void from
}

function renderGameOverlay(): void {
  gameBtn.textContent = game.isRunning ? '⏹️ 게임 종료' : '🎮 게임 시작'
  if (game.phase === 'idle') {
    gameOverlay.classList.add('hidden')
    return
  }
  gameOverlay.classList.remove('hidden')

  switch (game.phase) {
    case 'countdown':
      gameOverlay.innerHTML = `
        <div class="sub">라운드 ${game.round} — 제시어</div>
        <div class="word">${game.word}</div>
        <div class="big">${game.secondsLeft}</div>`
      break
    case 'drawing':
      gameOverlay.innerHTML = `
        <div class="word">✏️ ${game.word}</div>
        <div class="big">${game.secondsLeft}초</div>
        <div class="sub">다 그렸으면 👍 엄지척 · 점수 ${game.totalScore}</div>`
      break
    case 'judging':
      gameOverlay.innerHTML = `
        <div class="word">🤖 채점 중…</div>
        <div class="sub">AI가 그림을 보고 있어요</div>`
      break
    case 'result': {
      const verdict = game.lastError
        ? `<div class="wrong">채점 실패: ${game.lastError}</div>`
        : game.lastCorrect
          ? `<div class="big correct">정답! +${game.lastPoints}점</div>`
          : `<div class="big wrong">아쉽네요</div>`
      const guess = game.lastGuess
        ? `<div class="sub">AI의 추측: <b>${game.lastGuess}</b> (정답: ${game.word})</div>`
        : ''
      gameOverlay.innerHTML = `
        ${verdict}${guess}
        <div class="sub">총점 ${game.totalScore} · ${game.secondsLeft}초 후 다음 라운드 (👍로 바로 넘기기)</div>`
      break
    }
  }
}

/** 그림 캔버스를 흰 배경에 합성한 dataURL — 투명 배경은 AI가 인식하기 어려움 */
function captureDrawing(): string {
  return drawing.toDataURL()
}

async function onRecognize(): Promise<void> {
  recognizeBtn.disabled = true
  aiResult.classList.remove('hidden', 'error')
  aiResult.textContent = '🤔 AI가 그림을 보는 중…'
  try {
    aiResult.textContent = await recognizeDrawing(captureDrawing())
  } catch (err) {
    aiResult.classList.add('error')
    aiResult.textContent = err instanceof Error ? err.message : String(err)
  } finally {
    recognizeBtn.disabled = false
  }
}

function bindToolbar(): void {
  colorInput.oninput = () => (drawing.color = colorInput.value)
  widthInput.oninput = () => (drawing.lineWidth = Number(widthInput.value))
  undoBtn.onclick = () => drawing.undo()
  clearBtn.onclick = () => drawing.clear()
  saveBtn.onclick = () => drawing.savePNG(video)
  recognizeBtn.onclick = () => void onRecognize()
  gameBtn.onclick = () => (game.isRunning ? game.stop() : game.start())

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault()
      drawing.undo()
    }
  })
}

async function main(): Promise<void> {
  bindToolbar()

  statusEl.textContent = '카메라 준비 중…'
  await setupCamera(video)

  const w = video.videoWidth
  const h = video.videoHeight
  stage.style.aspectRatio = `${w} / ${h}`
  drawing.resize(w, h)
  uiCanvas.width = w
  uiCanvas.height = h

  statusEl.textContent = '손 추적 모델 로딩 중…'
  const tracker = new HandTracker()
  await tracker.init()
  statusEl.classList.add('hidden')

  let prevStable: Gesture = 'none'

  const loop = (t: number) => {
    const lm = tracker.detect(video, t)
    uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height)

    if (!lm) {
      // 손을 놓치면 즉시 펜 업 + 필터 리셋
      drawing.penUp()
      smoother.reset()
      debouncer.reset()
      prevStable = 'none'
      badge.textContent = '👀 손을 보여주세요'
      drawing.render()
      requestAnimationFrame(loop)
      return
    }

    const mode = debouncer.update(classify(lm))
    if (mode !== prevStable) {
      onGestureChange(prevStable, mode)
      prevStable = mode
    }
    badge.textContent = BADGE_TEXT[mode]

    const tip = toCanvas(lm[8])
    const { x, y } = smoother.filter(tip.x, tip.y, t)

    if (mode === 'point') {
      drawing.penMove(x, y)
      drawCursor(mode, x, y)
    } else if (mode === 'palm') {
      const c = palmCenter(lm)
      drawing.erase(c.x, c.y)
      drawCursor(mode, c.x, c.y)
    } else {
      drawing.penUp()
      drawCursor(mode, x, y)
    }

    drawing.render()
    if (debugInput.checked) drawSkeleton(lm)
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}

main().catch((err) => {
  statusEl.classList.remove('hidden')
  statusEl.textContent =
    err instanceof DOMException && err.name === 'NotAllowedError'
      ? '카메라 권한이 필요합니다. 허용 후 새로고침하세요.'
      : `초기화 실패: ${err}`
  console.error(err)
})
