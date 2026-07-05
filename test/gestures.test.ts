import { describe, it, expect } from 'vitest'
import { classify, GestureDebouncer } from '../src/gestures'
import { hand } from './fixtures'

describe('classify', () => {
  it('모두 굽히면 fist', () => {
    expect(classify(hand())).toBe('fist')
  })

  it('모두 굽히고 엄지만 펴면 thumbsUp', () => {
    expect(classify(hand({ thumb: true }))).toBe('thumbsUp')
  })

  it('검지만 펴면 point', () => {
    expect(classify(hand({ index: true }))).toBe('point')
  })

  it('검지+엄지는 여전히 point (엄지는 point 판정에 영향 없음)', () => {
    expect(classify(hand({ index: true, thumb: true }))).toBe('point')
  })

  it('검지+중지면 two', () => {
    expect(classify(hand({ index: true, middle: true }))).toBe('two')
  })

  it('네 손가락 모두 펴면 palm', () => {
    expect(classify(hand({ index: true, middle: true, ring: true, pinky: true }))).toBe('palm')
  })

  it('세 손가락(검지·중지·약지)도 palm', () => {
    expect(classify(hand({ index: true, middle: true, ring: true }))).toBe('palm')
  })

  it('약지만 펴는 애매한 손은 none', () => {
    expect(classify(hand({ ring: true }))).toBe('none')
  })

  it('중지+약지(검지 없음)는 none', () => {
    expect(classify(hand({ middle: true, ring: true }))).toBe('none')
  })
})

describe('GestureDebouncer', () => {
  it('threshold 미만 연속으로는 전환되지 않는다', () => {
    const d = new GestureDebouncer(3)
    expect(d.update('point')).toBe('none')
    expect(d.update('point')).toBe('none')
    expect(d.update('point')).toBe('point')
  })

  it('중간에 다른 제스처가 끼면 streak이 리셋된다', () => {
    const d = new GestureDebouncer(3)
    d.update('point')
    d.update('point')
    d.update('fist') // 리셋
    expect(d.update('point')).toBe('none')
    expect(d.update('point')).toBe('none')
    expect(d.update('point')).toBe('point')
  })

  it('전환 후에는 새 제스처가 안정될 때까지 이전 값을 유지한다', () => {
    const d = new GestureDebouncer(2)
    d.update('point')
    d.update('point')
    expect(d.update('fist')).toBe('point') // 아직 point
    expect(d.update('fist')).toBe('fist')
  })

  it('reset하면 none으로 돌아간다', () => {
    const d = new GestureDebouncer(2)
    d.update('point')
    d.update('point')
    d.reset()
    expect(d.update('fist')).toBe('none')
  })
})
