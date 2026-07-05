import { describe, it, expect } from 'vitest'
import { isMatch } from '../src/game'

describe('isMatch (게임 정답 판정)', () => {
  it('완전 일치', () => {
    expect(isMatch('고양이', '고양이')).toBe(true)
  })

  it('공백/문장부호 차이는 무시한다', () => {
    expect(isMatch('고양이', ' 고양이. ')).toBe(true)
    expect(isMatch('아이스크림', '아이스 크림')).toBe(true)
  })

  it('부분 포함도 정답 (풋사과 ⊃ 사과)', () => {
    expect(isMatch('사과', '풋사과')).toBe(true)
    expect(isMatch('눈사람', '사람')).toBe(true)
  })

  it('다른 단어는 오답', () => {
    expect(isMatch('고양이', '강아지')).toBe(false)
  })

  it('빈 추측은 오답', () => {
    expect(isMatch('고양이', '')).toBe(false)
    expect(isMatch('고양이', '   ')).toBe(false)
  })
})
