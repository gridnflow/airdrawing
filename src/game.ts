export type GamePhase = 'idle' | 'countdown' | 'drawing' | 'judging' | 'result'

const DRAW_SECONDS = 30
const COUNTDOWN_SECONDS = 3
const RESULT_SECONDS = 6

const WORDS = [
  '고양이', '강아지', '집', '나무', '자동차', '자전거', '우산', '물고기', '꽃', '해',
  '달', '별', '산', '구름', '비행기', '배', '사과', '바나나', '컵', '모자',
  '안경', '시계', '의자', '책', '연필', '하트', '눈사람', '피자', '아이스크림', '케이크',
  '나비', '새', '뱀', '거북이', '토끼', '버섯', '번개', '열쇠', '문', '창문',
  '공', '풍선', '왕관', '로켓', '기타', '숟가락', '포크', '양말', '신발', '무지개',
]

export interface GameHooks {
  /** 라운드 시작 시 캔버스 비우기 */
  clearCanvas(): void
  /** 현재 그림을 dataURL로 캡처 */
  capture(): string
  /** AI에게 그림을 보내 한 단어 추측을 받음 */
  judge(png: string): Promise<string>
}

/** '고양이 ' vs '고양이.' 같은 표기 차이를 흡수하는 정답 판정 */
export function isMatch(answer: string, guess: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s.·'"「」()]/g, '')
  const a = norm(answer)
  const g = norm(guess)
  if (!a || !g) return false
  return a.includes(g) || g.includes(a)
}

export class Game {
  phase: GamePhase = 'idle'
  word = ''
  round = 0
  totalScore = 0
  secondsLeft = 0
  lastGuess = ''
  lastCorrect = false
  lastPoints = 0
  lastError = ''

  private hooks: GameHooks
  private onChange: () => void
  private timer: ReturnType<typeof setInterval> | null = null
  private usedWords = new Set<string>()

  constructor(hooks: GameHooks, onChange: () => void) {
    this.hooks = hooks
    this.onChange = onChange
  }

  get isRunning(): boolean {
    return this.phase !== 'idle'
  }

  start(): void {
    if (this.isRunning) return
    this.round = 0
    this.totalScore = 0
    this.usedWords.clear()
    this.nextRound()
  }

  stop(): void {
    this.clearTimer()
    this.phase = 'idle'
    this.onChange()
  }

  /** 👍 제스처 / 제출 버튼: drawing이면 채점, result면 다음 라운드로 스킵 */
  submit(): void {
    if (this.phase === 'drawing') void this.judge()
    else if (this.phase === 'result') this.nextRound()
  }

  private nextRound(): void {
    this.clearTimer()
    this.round++
    this.word = this.pickWord()
    this.phase = 'countdown'
    this.secondsLeft = COUNTDOWN_SECONDS
    this.onChange()
    this.timer = setInterval(() => {
      this.secondsLeft--
      if (this.secondsLeft <= 0) this.beginDrawing()
      this.onChange()
    }, 1000)
  }

  private beginDrawing(): void {
    this.clearTimer()
    this.hooks.clearCanvas()
    this.phase = 'drawing'
    this.secondsLeft = DRAW_SECONDS
    this.onChange()
    this.timer = setInterval(() => {
      this.secondsLeft--
      if (this.secondsLeft <= 0) void this.judge()
      this.onChange()
    }, 1000)
  }

  private async judge(): Promise<void> {
    if (this.phase !== 'drawing') return
    const remaining = this.secondsLeft
    this.clearTimer()
    this.phase = 'judging'
    this.lastError = ''
    this.onChange()

    try {
      this.lastGuess = await this.hooks.judge(this.hooks.capture())
      this.lastCorrect = isMatch(this.word, this.lastGuess)
      this.lastPoints = this.lastCorrect ? 100 + Math.max(0, remaining) * 10 : 0
      this.totalScore += this.lastPoints
    } catch (err) {
      this.lastGuess = ''
      this.lastCorrect = false
      this.lastPoints = 0
      this.lastError = err instanceof Error ? err.message : String(err)
    }

    this.phase = 'result'
    this.secondsLeft = RESULT_SECONDS
    this.onChange()
    this.timer = setInterval(() => {
      this.secondsLeft--
      if (this.secondsLeft <= 0) this.nextRound()
      this.onChange()
    }, 1000)
  }

  private pickWord(): string {
    if (this.usedWords.size >= WORDS.length) this.usedWords.clear()
    let word: string
    do {
      word = WORDS[Math.floor(Math.random() * WORDS.length)]
    } while (this.usedWords.has(word))
    this.usedWords.add(word)
    return word
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
