import { describe, it, expect } from 'vitest'
import { PointSmoother } from '../src/smoothing'

describe('PointSmoother (One Euro Filter)', () => {
  it('첫 입력은 그대로 반환한다', () => {
    const s = new PointSmoother()
    expect(s.filter(100, 200, 0)).toEqual({ x: 100, y: 200 })
  })

  it('고정 입력을 반복하면 그 점으로 수렴한다', () => {
    const s = new PointSmoother()
    s.filter(0, 0, 0)
    let p = { x: 0, y: 0 }
    for (let i = 1; i <= 100; i++) p = s.filter(50, 80, i * 16)
    expect(p.x).toBeCloseTo(50, 0)
    expect(p.y).toBeCloseTo(80, 0)
  })

  it('출력은 항상 이전 값과 목표 값 사이에 있다 (오버슈트 없음)', () => {
    const s = new PointSmoother()
    s.filter(0, 0, 0)
    let prev = 0
    for (let i = 1; i <= 20; i++) {
      const { x } = s.filter(100, 0, i * 16)
      expect(x).toBeGreaterThanOrEqual(prev)
      expect(x).toBeLessThanOrEqual(100)
      prev = x
    }
  })

  it('reset하면 다음 입력을 그대로 반환한다', () => {
    const s = new PointSmoother()
    s.filter(0, 0, 0)
    s.filter(10, 10, 16)
    s.reset()
    expect(s.filter(500, 500, 32)).toEqual({ x: 500, y: 500 })
  })
})
