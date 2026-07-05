import type { Landmarks } from './tracker'

export type Gesture =
  | 'point' // ☝️ 검지만 — 그리기
  | 'two' // ✌️ 검지+중지 — 색상 변경
  | 'fist' // ✊ — 펜 업
  | 'palm' // 🖐️ — 지우개
  | 'thumbsUp' // 👍 — undo / 게임 제출
  | 'none'

// MediaPipe hand landmark 인덱스
const WRIST = 0
const THUMB_TIP = 4
const MIDDLE_MCP = 9
const PINKY_MCP = 17
// [PIP, TIP] 쌍 — 검지/중지/약지/새끼
const FINGERS: Array<[pip: number, tip: number]> = [
  [6, 8],
  [10, 12],
  [14, 16],
  [18, 20],
]

function dist2(a: Landmarks[number], b: Landmarks[number]): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

/** 손가락 펴짐 = 손목에서 tip이 PIP보다 충분히 멀다 (손 회전에 강건) */
function isExtended(lm: Landmarks, pip: number, tip: number): boolean {
  return dist2(lm[tip], lm[WRIST]) > dist2(lm[pip], lm[WRIST]) * 1.2
}

/**
 * 엄지 펴짐 판정. tip-PIP 거리 비교는 엄지에서 불안정하므로
 * 엄지 tip과 새끼 MCP의 거리를 손바닥 크기(손목-중지MCP)와 비교한다.
 * 주먹에서는 엄지가 손바닥을 가로질러 새끼 쪽에 붙고, 펴면 멀어진다.
 */
function isThumbExtended(lm: Landmarks): boolean {
  const palm2 = dist2(lm[WRIST], lm[MIDDLE_MCP])
  return dist2(lm[THUMB_TIP], lm[PINKY_MCP]) > palm2 * 1.2
}

export function classify(lm: Landmarks): Gesture {
  const ext = FINGERS.map(([pip, tip]) => isExtended(lm, pip, tip))
  const [index, middle, ring, pinky] = ext
  const count = ext.filter(Boolean).length
  const thumb = isThumbExtended(lm)

  if (count === 0) return thumb ? 'thumbsUp' : 'fist'
  if (index && count === 1) return 'point'
  if (index && middle && !ring && !pinky) return 'two'
  if (count >= 3) return 'palm'
  return 'none'
}

/** N프레임 연속 같은 제스처일 때만 모드 전환 (분류 튐 방지) */
export class GestureDebouncer {
  private candidate: Gesture = 'none'
  private streak = 0
  private stable: Gesture = 'none'
  private threshold: number

  constructor(threshold = 3) {
    this.threshold = threshold
  }

  update(g: Gesture): Gesture {
    if (g === this.candidate) {
      this.streak++
    } else {
      this.candidate = g
      this.streak = 1
    }
    if (this.streak >= this.threshold) this.stable = this.candidate
    return this.stable
  }

  /** 손이 사라졌을 때 즉시 리셋 */
  reset(): void {
    this.candidate = 'none'
    this.streak = 0
    this.stable = 'none'
  }
}
