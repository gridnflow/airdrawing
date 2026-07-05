import { StrokeStore, type Stroke } from './strokes'

export class DrawingLayer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  /** 확정된 스트로크를 구워두는 오프스크린 캔버스 (매 프레임 전체 리렌더 방지) */
  private baked: HTMLCanvasElement
  private bakedCtx: CanvasRenderingContext2D
  private store = new StrokeStore()
  private penIsDown = false
  color = '#ff3b30'
  lineWidth = 6
  eraserRadius = 40

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.baked = document.createElement('canvas')
    this.bakedCtx = this.baked.getContext('2d')!
  }

  resize(width: number, height: number): void {
    this.canvas.width = width
    this.canvas.height = height
    this.baked.width = width
    this.baked.height = height
    this.rebake()
  }

  penMove(x: number, y: number): void {
    if (!this.penIsDown) {
      this.store.beginStroke(this.color, this.lineWidth)
      this.penIsDown = true
    }
    this.store.addPoint(x, y)
  }

  penUp(): void {
    this.penIsDown = false
    const done = this.store.endStroke()
    if (done) drawStroke(this.bakedCtx, done)
  }

  erase(x: number, y: number): void {
    this.penUp()
    if (this.store.eraseAt(x, y, this.eraserRadius)) this.rebake()
  }

  undo(): void {
    this.penIsDown = false
    if (this.store.undo()) this.rebake()
  }

  clear(): void {
    this.penIsDown = false
    this.store.clear()
    this.rebake()
  }

  get isEmpty(): boolean {
    return this.store.all.length === 0 && !this.store.active
  }

  /** 매 프레임 호출: 구워둔 스트로크 + 진행 중 스트로크를 화면 캔버스에 그림 */
  render(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.drawImage(this.baked, 0, 0)
    if (this.store.active) drawStroke(this.ctx, this.store.active)
  }

  private rebake(): void {
    this.bakedCtx.clearRect(0, 0, this.baked.width, this.baked.height)
    for (const s of this.store.all) drawStroke(this.bakedCtx, s)
  }

  /** 웹캠 프레임(미러링) 위에 그림을 합성해 PNG로 저장 */
  savePNG(video: HTMLVideoElement): void {
    const out = document.createElement('canvas')
    out.width = this.canvas.width
    out.height = this.canvas.height
    const octx = out.getContext('2d')!
    octx.translate(out.width, 0)
    octx.scale(-1, 1)
    octx.drawImage(video, 0, 0, out.width, out.height)
    octx.setTransform(1, 0, 0, 1, 0, 0)
    octx.drawImage(this.baked, 0, 0)

    const a = document.createElement('a')
    a.href = out.toDataURL('image/png')
    a.download = `air-drawing-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`
    a.click()
  }

  /** 그림만 흰 배경에 합성한 dataURL (AI 인식용) */
  toDataURL(): string {
    const out = document.createElement('canvas')
    out.width = this.canvas.width
    out.height = this.canvas.height
    const octx = out.getContext('2d')!
    octx.fillStyle = '#fff'
    octx.fillRect(0, 0, out.width, out.height)
    octx.drawImage(this.baked, 0, 0)
    if (this.store.active) drawStroke(octx, this.store.active)
    return out.toDataURL('image/png')
  }
}

/** 점 배열을 중점 보간 quadratic curve로 부드럽게 렌더 */
function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke): void {
  if (s.points.length === 0) return
  ctx.strokeStyle = s.color
  ctx.fillStyle = s.color
  ctx.lineWidth = s.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (s.points.length < 3) {
    const p = s.points[0]
    ctx.beginPath()
    ctx.arc(p.x, p.y, s.width / 2, 0, Math.PI * 2)
    ctx.fill()
    if (s.points.length === 2) {
      ctx.beginPath()
      ctx.moveTo(s.points[0].x, s.points[0].y)
      ctx.lineTo(s.points[1].x, s.points[1].y)
      ctx.stroke()
    }
    return
  }

  ctx.beginPath()
  ctx.moveTo(s.points[0].x, s.points[0].y)
  for (let i = 1; i < s.points.length - 1; i++) {
    const midX = (s.points[i].x + s.points[i + 1].x) / 2
    const midY = (s.points[i].y + s.points[i + 1].y) / 2
    ctx.quadraticCurveTo(s.points[i].x, s.points[i].y, midX, midY)
  }
  const last = s.points[s.points.length - 1]
  ctx.lineTo(last.x, last.y)
  ctx.stroke()
}
