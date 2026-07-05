/**
 * One Euro Filter — 저속에선 강하게(떨림 제거), 고속에선 약하게(지연 최소) 필터링.
 * https://gery.casiez.net/1euro/
 */
class OneEuro {
  private xPrev: number | null = null
  private dxPrev = 0
  private tPrev = 0

  private minCutoff: number
  private beta: number
  private dCutoff: number

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff)
    return 1 / (1 + tau / dt)
  }

  filter(x: number, tMs: number): number {
    if (this.xPrev === null) {
      this.xPrev = x
      this.tPrev = tMs
      return x
    }
    const dt = Math.max((tMs - this.tPrev) / 1000, 1e-3)
    this.tPrev = tMs

    const dx = (x - this.xPrev) / dt
    const aD = this.alpha(this.dCutoff, dt)
    this.dxPrev = aD * dx + (1 - aD) * this.dxPrev

    const cutoff = this.minCutoff + this.beta * Math.abs(this.dxPrev)
    const a = this.alpha(cutoff, dt)
    this.xPrev = a * x + (1 - a) * this.xPrev
    return this.xPrev
  }

  reset(): void {
    this.xPrev = null
    this.dxPrev = 0
  }
}

export class PointSmoother {
  private fx = new OneEuro()
  private fy = new OneEuro()

  filter(x: number, y: number, tMs: number): { x: number; y: number } {
    return { x: this.fx.filter(x, tMs), y: this.fy.filter(y, tMs) }
  }

  reset(): void {
    this.fx.reset()
    this.fy.reset()
  }
}
