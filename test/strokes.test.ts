import { describe, it, expect } from 'vitest'
import { StrokeStore } from '../src/strokes'

function drawLine(store: StrokeStore, points: Array<[number, number]>): void {
  store.beginStroke('#fff', 4)
  for (const [x, y] of points) store.addPoint(x, y)
  store.endStroke()
}

describe('StrokeStore', () => {
  it('begin → addPoint → end로 스트로크가 쌓인다', () => {
    const s = new StrokeStore()
    drawLine(s, [[0, 0], [10, 10]])
    drawLine(s, [[20, 20], [30, 30]])
    expect(s.all).toHaveLength(2)
  })

  it('점 없는 스트로크는 버려진다', () => {
    const s = new StrokeStore()
    s.beginStroke('#fff', 4)
    expect(s.endStroke()).toBeNull()
    expect(s.all).toHaveLength(0)
  })

  it('undo는 진행 중 스트로크를 먼저 취소한다', () => {
    const s = new StrokeStore()
    drawLine(s, [[0, 0]])
    s.beginStroke('#fff', 4)
    s.addPoint(5, 5)
    expect(s.undo()).toBe(true)
    expect(s.active).toBeNull()
    expect(s.all).toHaveLength(1) // 확정된 스트로크는 그대로
  })

  it('undo는 마지막 확정 스트로크를 삭제한다', () => {
    const s = new StrokeStore()
    drawLine(s, [[0, 0]])
    drawLine(s, [[10, 10]])
    expect(s.undo()).toBe(true)
    expect(s.all).toHaveLength(1)
    expect(s.undo()).toBe(true)
    expect(s.all).toHaveLength(0)
    expect(s.undo()).toBe(false) // 더 이상 지울 게 없음
  })

  it('eraseAt은 반경과 교차하는 스트로크만 통째로 지운다', () => {
    const s = new StrokeStore()
    drawLine(s, [[0, 0], [10, 0]])
    drawLine(s, [[100, 100], [110, 100]])
    expect(s.eraseAt(5, 0, 10)).toBe(true)
    expect(s.all).toHaveLength(1)
    expect(s.all[0].points[0].x).toBe(100)
    expect(s.eraseAt(500, 500, 10)).toBe(false) // 아무것도 안 닿음
  })

  it('clear는 전부 비운다', () => {
    const s = new StrokeStore()
    drawLine(s, [[0, 0]])
    s.beginStroke('#fff', 4)
    s.clear()
    expect(s.all).toHaveLength(0)
    expect(s.active).toBeNull()
  })
})
