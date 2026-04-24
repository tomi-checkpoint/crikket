import {
  assertBrowserTabSurface,
  canvasToBlob,
  prepareCaptureVideo,
  releaseCaptureVideo,
  requestDisplayStream,
} from "./display-capture"

export function supportsDisplayMedia(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function"
  )
}

export async function captureScreenshot(): Promise<Blob> {
  if (!supportsDisplayMedia()) {
    return captureScreenshotViaDom()
  }
  try {
    return await captureScreenshotViaDisplayMedia()
  } catch (error) {
    // User cancel / permission denied → propagate. Otherwise try DOM fallback.
    if (isPermissionError(error)) {
      throw error
    }
    return captureScreenshotViaDom()
  }
}

async function captureScreenshotViaDisplayMedia(): Promise<Blob> {
  const stream = await requestDisplayStream(false)
  assertBrowserTabSurface(stream)
  const video = document.createElement("video")

  try {
    const track = stream.getVideoTracks()[0]
    if (!track) {
      throw new Error("No video track available for screenshot capture.")
    }

    await prepareCaptureVideo(video, stream)

    const width = video.videoWidth
    const height = video.videoHeight
    if (!(width > 0 && height > 0)) {
      throw new Error("Captured screen dimensions were invalid.")
    }

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("Failed to initialize screenshot canvas.")
    }

    context.drawImage(video, 0, 0, width, height)
    return canvasToBlob(canvas, "image/png")
  } finally {
    releaseCaptureVideo(video)
    for (const currentTrack of stream.getTracks()) {
      currentTrack.stop()
    }
  }
}

/**
 * DOM-rasterization fallback used on mobile browsers (and any context where
 * getDisplayMedia is unavailable). Quality is lower than a real screen grab:
 * WebGL / cross-origin iframes render as blank, and some modern CSS features
 * depend on the html2canvas-pro fork's support matrix.
 */
async function captureScreenshotViaDom(): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("This browser does not support screen capture.")
  }
  const html2canvas = await loadHtml2Canvas()
  const canvas = await html2canvas(document.body, {
    backgroundColor: null,
    logging: false,
    useCORS: true,
    allowTaint: false,
    // Capture only what's in the viewport, not the full scroll height.
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
    x: window.scrollX,
    y: window.scrollY,
    scale: Math.min(window.devicePixelRatio || 1, 2),
  })
  return canvasToBlob(canvas, "image/png")
}

type Html2CanvasFn = (
  el: HTMLElement,
  options?: Record<string, unknown>
) => Promise<HTMLCanvasElement>

async function loadHtml2Canvas(): Promise<Html2CanvasFn> {
  const mod: { default?: Html2CanvasFn } | Html2CanvasFn = await import(
    "html2canvas-pro"
  )
  const fn = typeof mod === "function" ? mod : mod.default
  if (typeof fn !== "function") {
    throw new Error("DOM screenshot fallback failed to load.")
  }
  return fn
}

function isPermissionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const e = error as { name?: string; message?: string }
  return (
    e.name === "NotAllowedError" ||
    e.name === "SecurityError" ||
    (typeof e.message === "string" && e.message.toLowerCase().includes("denied"))
  )
}

/**
 * Wraps a user-provided image File/Blob into a PNG Blob, normalizing type and
 * stripping EXIF so the submit pipeline treats it the same as any other
 * screenshot.
 */
export async function captureScreenshotFromFile(file: File | Blob): Promise<Blob> {
  if (!(file instanceof Blob)) {
    throw new Error("Invalid file provided for screenshot upload.")
  }
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("Failed to load the uploaded image."))
      img.src = objectUrl
    })
    const canvas = document.createElement("canvas")
    canvas.width = img.naturalWidth || 1
    canvas.height = img.naturalHeight || 1
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      throw new Error("Failed to initialize screenshot canvas.")
    }
    ctx.drawImage(img, 0, 0)
    return canvasToBlob(canvas, "image/png")
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
