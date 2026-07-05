export async function setupCamera(video: HTMLVideoElement): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 960 },
      facingMode: 'user',
    },
    audio: false,
  })
  await zoomOutIfSupported(stream)

  video.srcObject = stream
  await new Promise<void>((resolve) => {
    video.onloadedmetadata = () => resolve()
  })
  await video.play()
}

/** 카메라가 줌을 지원하면 최소 줌(최대 광각)으로 설정. 미지원이면 조용히 넘어감. */
async function zoomOutIfSupported(stream: MediaStream): Promise<void> {
  const track = stream.getVideoTracks()[0]
  if (!track?.getCapabilities) return
  // zoom은 표준 TS 타입에 없는 확장 capability
  const caps = track.getCapabilities() as MediaTrackCapabilities & {
    zoom?: { min: number; max: number }
  }
  if (!caps.zoom) {
    console.info('이 카메라는 줌 제어를 지원하지 않습니다.')
    return
  }
  try {
    await track.applyConstraints({
      advanced: [{ zoom: caps.zoom.min } as MediaTrackConstraintSet],
    })
    console.info(`카메라 줌을 최소값(${caps.zoom.min})으로 설정했습니다.`)
  } catch (err) {
    console.warn('카메라 줌 설정 실패:', err)
  }
}
