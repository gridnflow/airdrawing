export class DrawingLayer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private penIsDown = false
  color = '#ff3b30'
  lineWidth = 6
  eraserRadius = 40

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
  }

  resize(width: number, height: number): void {
    this.canvas.width = width
    this.canvas.height = height
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
  }

  penMove(x: number, y: number): void {
    if (!this.penIsDown) {
      // 새 스트로크 시작 — 이전 위치와 이어지지 않게
      this.ctx.beginPath()
      this.ctx.moveTo(x, y)
      this.penIsDown = true
      return
    }
    this.ctx.strokeStyle = this.color
    this.ctx.lineWidth = this.lineWidth
    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.lineTo(x, y)
    this.ctx.stroke()
    // stroke()가 매번 전체 path를 다시 그리며 두꺼워지는 것 방지
    this.ctx.beginPath()
    this.ctx.moveTo(x, y)
  }

  penUp(): void {
    this.penIsDown = false
  }

  erase(x: number, y: number): void {
    this.penIsDown = false
    this.ctx.globalCompositeOperation = 'destination-out'
    this.ctx.beginPath()
    this.ctx.arc(x, y, this.eraserRadius, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.globalCompositeOperation = 'source-over'
  }

  clear(): void {
    this.penIsDown = false
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
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
    octx.drawImage(this.canvas, 0, 0)

    const a = document.createElement('a')
    a.href = out.toDataURL('image/png')
    a.download = `air-drawing-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`
    a.click()
  }
}
