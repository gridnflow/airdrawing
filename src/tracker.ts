import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'

export type Landmarks = NormalizedLandmark[]

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export class HandTracker {
  private landmarker!: HandLandmarker
  private lastVideoTime = -1
  private lastResult: Landmarks | null = null

  async init(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL)
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })
  }

  /** 새 비디오 프레임이 있으면 감지, 아니면 직전 결과 반환. 손이 없으면 null. */
  detect(video: HTMLVideoElement, timestampMs: number): Landmarks | null {
    if (video.currentTime === this.lastVideoTime) return this.lastResult
    this.lastVideoTime = video.currentTime
    const result = this.landmarker.detectForVideo(video, timestampMs)
    this.lastResult = result.landmarks[0] ?? null
    return this.lastResult
  }
}
