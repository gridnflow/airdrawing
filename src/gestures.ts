import type { Landmarks } from './tracker'

export type Gesture = 'point' | 'fist' | 'palm' | 'none'

// MediaPipe hand landmark 인덱스
const WRIST = 0
// [PIP, TIP] 쌍 — 엄지는 판정이 불안정해 제외
const FINGERS: Array<[pip: number, tip: number]> = [
  [6, 8], // 검지
  [10, 12], // 중지
  [14, 16], // 약지
  [18, 20], // 새끼
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

export function classify(lm: Landmarks): Gesture {
  const extended = FINGERS.map(([pip, tip]) => isExtended(lm, pip, tip))
  const count = extended.filter(Boolean).length

  if (count === 0) return 'fist'
  if (extended[0] && count === 1) return 'point'
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
