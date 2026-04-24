import type { RecordingController } from "../types"

export async function captureScreenshot(): Promise<Blob> {
  const mediaModule = await import("./capture-screenshot")
  return mediaModule.captureScreenshot()
}

export async function captureScreenshotFromFile(
  file: File | Blob
): Promise<Blob> {
  const mediaModule = await import("./capture-screenshot")
  return mediaModule.captureScreenshotFromFile(file)
}

export function supportsDisplayMedia(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function"
  )
}

export async function startDisplayRecording(): Promise<RecordingController> {
  const mediaModule = await import("./start-display-recording")
  return mediaModule.startDisplayRecording()
}
