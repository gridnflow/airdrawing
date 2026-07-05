export interface Point {
  x: number
  y: number
}

export interface Stroke {
  points: Point[]
  color: string
  width: number
}

/** 스트로크 히스토리. 렌더링은 drawing.ts가 담당하고 여기는 데이터만. */
export class StrokeStore {
  private strokes: Stroke[] = []
  private current: Stroke | null = null

  get all(): readonly Stroke[] {
    return this.strokes
  }

  get active(): Stroke | null {
    return this.current
  }

  beginStroke(color: string, width: number): void {
    this.current = { points: [], color, width }
  }

  addPoint(x: number, y: number): void {
    this.current?.points.push({ x, y })
  }

  /** 진행 중 스트로크를 확정. 점이 없으면 버림. 확정됐으면 해당 스트로크 반환. */
  endStroke(): Stroke | null {
    const done = this.current
    this.current = null
    if (!done || done.points.length === 0) return null
    this.strokes.push(done)
    return done
  }

  /** 진행 중 스트로크가 있으면 취소, 없으면 마지막 스트로크 삭제. 변화 여부 반환. */
  undo(): boolean {
    if (this.current) {
      this.current = null
      return true
    }
    return this.strokes.pop() !== undefined
  }

  /** (x, y) 반경 radius 원과 교차하는 스트로크를 통째로 삭제. 삭제 여부 반환. */
  eraseAt(x: number, y: number, radius: number): boolean {
    const r2 = radius * radius
    const before = this.strokes.length
    this.strokes = this.strokes.filter(
      (s) => !s.points.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 <= r2),
    )
    return this.strokes.length !== before
  }

  clear(): void {
    this.strokes = []
    this.current = null
  }
}
