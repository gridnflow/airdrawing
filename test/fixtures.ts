import type { Landmarks } from '../src/tracker'

export interface HandSpec {
  index?: boolean
  middle?: boolean
  ring?: boolean
  pinky?: boolean
  thumb?: boolean
}

/**
 * 합성 손 랜드마크 생성기. classify()가 쓰는 포인트만 의미 있게 배치한다.
 * 손목 (0.5, 0.9), 손바닥 위쪽 MCP 줄 y=0.7. 펴진 손가락은 tip이 위(y 작음),
 * 굽힌 손가락은 tip이 손목 근처로 온다.
 */
export function hand(spec: HandSpec = {}): Landmarks {
  const lm: { x: number; y: number; z: number; visibility: number }[] = []
  for (let i = 0; i < 21; i++) lm.push({ x: 0.5, y: 0.8, z: 0, visibility: 1 })

  const set = (i: number, x: number, y: number) => {
    lm[i] = { x, y, z: 0, visibility: 1 }
  }

  set(0, 0.5, 0.9) // wrist
  set(9, 0.5, 0.7) // middle MCP (손바닥 크기 기준점)

  // [MCP x, PIP idx, TIP idx] — 검지/중지/약지/새끼
  const fingers: Array<[number, number, number, boolean]> = [
    [0.42, 6, 8, spec.index ?? false],
    [0.5, 10, 12, spec.middle ?? false],
    [0.58, 14, 16, spec.ring ?? false],
    [0.66, 18, 20, spec.pinky ?? false],
  ]
  for (const [bx, pip, tip, extended] of fingers) {
    set(pip, bx, 0.6)
    set(tip, bx, extended ? 0.4 : 0.75)
  }

  set(17, 0.66, 0.7) // pinky MCP
  // 엄지: 펴면 새끼 MCP에서 멀리, 굽히면 손바닥을 가로질러 새끼 쪽에 붙음
  set(4, spec.thumb ? 0.2 : 0.6, spec.thumb ? 0.7 : 0.72)

  return lm as Landmarks
}
