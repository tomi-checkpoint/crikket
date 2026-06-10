import { CONSOLE_SESSION_TIMEOUT_MS } from "../constants"
import { LazyDebuggerCollector } from "../debugger/lazy-debugger-collector"
import {
  captureScreenshot,
  captureScreenshotFromFile,
  startDisplayRecording,
} from "../media/lazy-capture-media"
import type {
  CapturedMedia,
  CaptureInitOptions,
  CaptureRuntimeConfig,
  CaptureRuntimeController,
  CaptureSubmissionDraft,
  CaptureSubmitTransport,
  RecordingController,
  ReviewSnapshot,
} from "../types"
import { mountCaptureUi } from "../ui/mount-capture-ui"
import type { CaptureReviewSubmitOptions, MountedCaptureUi } from "../ui/types"
import {
  normalizeHost,
  normalizeKey,
  normalizeSubmitPath,
  normalizeZIndex,
} from "../utils"

export class CaptureSdkRuntime implements CaptureRuntimeController {
  private runtimeConfig: CaptureRuntimeConfig | null = null
  private submitTransport: CaptureSubmitTransport | undefined
  private mountedTarget: HTMLElement | null = null
  private mountedUi: MountedCaptureUi | null = null
  private readonly debuggerCollector = new LazyDebuggerCollector()
  private activeRecording: RecordingController | null = null
  private currentMedia: CapturedMedia | null = null
  private currentReview: ReviewSnapshot | null = null
  private consoleSessionActive = false
  private consoleSessionStartedAt: number | null = null
  private consoleSessionTimer: ReturnType<typeof setTimeout> | null = null

  init(options: CaptureInitOptions): CaptureRuntimeController {
    const config: CaptureRuntimeConfig = {
      key: normalizeKey(options.key),
      host: normalizeHost(options.host),
      submitPath: normalizeSubmitPath(options.submitPath),
      zIndex: normalizeZIndex(options.zIndex),
    }

    this.runtimeConfig = config
    this.submitTransport = options.submitTransport

    if (options.autoMount ?? true) {
      this.mount(options.mountTarget)
    }

    return this
  }

  isInitialized(): boolean {
    return this.runtimeConfig !== null
  }

  getConfig(): CaptureRuntimeConfig | null {
    return this.runtimeConfig
  }

  mount(target?: HTMLElement): void {
    const config = this.getRuntimeConfig()
    this.ensureBrowserContext()

    if (this.mountedTarget) {
      return
    }

    const mountTarget = target ?? document.body
    this.mountedUi = mountCaptureUi(mountTarget, config.zIndex, {
      onClose: () => {
        this.close()
      },
      onStartVideo: () => {
        return this.startRecording()
      },
      onStartConsole: () => {
        return this.startConsoleSession()
      },
      onStopConsole: () => {
        this.stopConsoleSession()
      },
      onTakeScreenshot: async () => {
        const blob = await this.takeScreenshot()
        if (!blob) {
          throw new Error("Screenshot capture failed.")
        }
      },
      onPickScreenshotFile: async (file) => {
        const blob = await this.takeScreenshotFromFile(file)
        if (!blob) {
          throw new Error("Screenshot upload failed.")
        }
      },
      onStopRecording: async () => {
        const blob = await this.stopRecording()
        if (!blob) {
          throw new Error("Recording capture failed.")
        }
      },
      onSubmit: (draft, options) => {
        return this.submit(draft, options).then(() => undefined)
      },
      onReset: () => {
        this.reset()
      },
      onLauncherClick: () => {
        // Start console/network/action capture only once the user opens the
        // feedback widget — never at page load (eager-at-load capture looked
        // like a data skimmer and hurt host-domain reputation).
        this.primeDebugger()
        // Report any live console session so re-opening the widget resumes it
        // (shows the "capture in progress" chooser) instead of resetting and
        // discarding the events captured so far.
        return this.isConsoleSessionActive()
      },
    })
    this.mountedTarget = mountTarget
  }

  unmount(): void {
    this.abortActiveRecording()
    this.clearConsoleTimeout()
    this.consoleSessionActive = false
    this.consoleSessionStartedAt = null
    this.setUiHidden(false)
    this.mountedUi?.unmount()
    this.mountedUi = null
    this.debuggerCollector.dispose()
    this.mountedTarget = null
  }

  open(): void {
    this.getRuntimeConfig()
    if (!this.mountedTarget) {
      this.mount()
    }

    this.primeDebugger()
    this.mountedUi?.store.openChooser()
  }

  private primeDebugger(): void {
    // Install the debugger page runtime (console/network/action capture) on
    // demand when the widget opens. Fire-and-forget; prime() never rejects.
    this.debuggerCollector.prime().catch(() => undefined)
  }

  close(): void {
    if (this.consoleSessionActive) {
      this.cancelConsoleSession()
      return
    }

    this.setUiHidden(false)
    this.mountedUi?.store.close()
  }

  destroy(): void {
    this.reset()
    this.unmount()
    this.runtimeConfig = null
    this.submitTransport = undefined
  }

  async startRecording(): Promise<{ startedAt: number }> {
    this.getRuntimeConfig()
    this.ensureBrowserContext()
    this.abortActiveRecording()
    await this.debuggerCollector.startRecordingSession()

    try {
      await this.hideUiForCapture()
      const controller = await startDisplayRecording()
      this.debuggerCollector.markRecordingStarted(controller.startedAt)
      this.activeRecording = controller
      controller.finished
        .then(async (result) => {
          if (this.activeRecording !== controller) {
            return
          }

          this.activeRecording = null
          await this.finalizeCapturedMedia({
            blob: result.blob,
            captureType: "video",
            durationMs: result.durationMs,
          })
        })
        .catch(() => undefined)

      return {
        startedAt: controller.startedAt,
      }
    } catch (error) {
      this.setUiHidden(false)
      this.debuggerCollector.clearSession()
      throw error
    }
  }

  async stopRecording(): Promise<Blob | null> {
    if (!this.activeRecording) {
      return null
    }

    const recording = this.activeRecording
    this.activeRecording = null

    const result = await recording.stop()
    await this.finalizeCapturedMedia({
      blob: result.blob,
      captureType: "video",
      durationMs: result.durationMs,
    })

    return result.blob
  }

  async startConsoleSession(): Promise<{ startedAt: number }> {
    this.getRuntimeConfig()
    this.ensureBrowserContext()
    // Idempotent: if a console session is already running (e.g. the user
    // re-opened the widget and clicked "Capture console logs" again), resume it
    // instead of starting a new one. Restarting would call startSession() again
    // and DISCARD the console + action events captured so far — the root cause
    // of "0 logs" reports.
    if (this.consoleSessionActive && this.consoleSessionStartedAt !== null) {
      return { startedAt: this.consoleSessionStartedAt }
    }
    // A console session and a video recording both own the single debugger
    // session + the open dock, so they are mutually exclusive.
    this.abortActiveRecording()
    await this.debuggerCollector.startConsoleSession()
    const startedAt = Date.now()
    this.consoleSessionActive = true
    this.consoleSessionStartedAt = startedAt
    this.startConsoleTimeout()

    return { startedAt }
  }

  isConsoleSessionActive(): number | null {
    return this.consoleSessionActive ? this.consoleSessionStartedAt : null
  }

  stopConsoleSession(): void {
    this.cancelConsoleSession()
  }

  async takeScreenshot(): Promise<Blob | null> {
    this.getRuntimeConfig()
    this.ensureBrowserContext()
    await this.beginScreenshotCapture()

    let blob: Blob
    try {
      await this.hideUiForCapture()
      blob = await captureScreenshot()
    } catch (error) {
      this.setUiHidden(false)
      this.debuggerCollector.clearSession()
      throw error
    }
    await this.finalizeCapturedMedia({
      blob,
      captureType: "screenshot",
      durationMs: null,
    })

    return blob
  }

  async takeScreenshotFromFile(file: File | Blob): Promise<Blob | null> {
    this.getRuntimeConfig()
    this.ensureBrowserContext()
    await this.beginScreenshotCapture()

    let blob: Blob
    try {
      blob = await captureScreenshotFromFile(file)
    } catch (error) {
      this.debuggerCollector.clearSession()
      throw error
    }
    await this.finalizeCapturedMedia({
      blob,
      captureType: "screenshot",
      durationMs: null,
    })

    return blob
  }

  async submit(
    draft: CaptureSubmissionDraft,
    options?: CaptureReviewSubmitOptions
  ) {
    const config = this.getRuntimeConfig()
    if (!(this.currentMedia && this.currentReview)) {
      throw new Error(
        "No capture is ready to submit. Start a recording or take a screenshot first."
      )
    }

    const { submitCapturedReport } = await import("./submit-captured-report")
    const media =
      this.currentMedia.captureType === "screenshot" &&
      options?.screenshotBlobOverride
        ? {
            ...this.currentMedia,
            blob: options.screenshotBlobOverride,
          }
        : this.currentMedia
    const result = await submitCapturedReport({
      config,
      draft,
      media,
      review: this.currentReview,
      submitTransport: this.submitTransport,
    })

    if (this.mountedUi) {
      this.mountedUi.store.showSuccess(result.shareUrl)
    }

    return result
  }

  reset(): void {
    this.abortActiveRecording()
    this.clearConsoleTimeout()
    this.consoleSessionActive = false
    this.consoleSessionStartedAt = null
    this.setUiHidden(false)
    this.clearMedia()
    this.currentReview = null
    this.debuggerCollector.clearSession()
  }

  private setMedia(input: {
    blob: Blob
    captureType: CapturedMedia["captureType"]
    durationMs: number | null
  }): CapturedMedia {
    this.clearMedia()

    this.currentMedia = {
      blob: input.blob,
      captureType: input.captureType,
      durationMs: input.durationMs,
      objectUrl: URL.createObjectURL(input.blob),
    }

    return this.currentMedia
  }

  private clearMedia(): void {
    if (!this.currentMedia) {
      return
    }

    URL.revokeObjectURL(this.currentMedia.objectUrl)
    this.currentMedia = null
  }

  private finalizeCapturedMedia(input: {
    blob: Blob
    captureType: CapturedMedia["captureType"]
    durationMs: number | null
  }): void {
    this.setUiHidden(false)

    const review = this.debuggerCollector.finalizeSession()
    const media = this.setMedia(input)

    this.currentReview = review
    if (!this.mountedUi) {
      return
    }

    this.mountedUi.store.showReview({
      media,
      warnings: review.warnings,
      summary: review.debuggerSummary,
    })
    this.prefillTitle()
  }

  private abortActiveRecording(): void {
    if (!this.activeRecording) {
      return
    }

    this.activeRecording.abort()
    this.activeRecording = null
  }

  private async beginScreenshotCapture(): Promise<void> {
    if (this.consoleSessionActive) {
      // Finalize the running console session with this screenshot — do NOT
      // start a fresh screenshot session, which would discard the console +
      // step history accumulated during the session.
      this.clearConsoleTimeout()
      this.consoleSessionActive = false
      this.consoleSessionStartedAt = null
      return
    }

    await this.debuggerCollector.startScreenshotSession()
  }

  private startConsoleTimeout(): void {
    this.clearConsoleTimeout()
    this.consoleSessionTimer = setTimeout(() => {
      this.cancelConsoleSession()
    }, CONSOLE_SESSION_TIMEOUT_MS)
  }

  private clearConsoleTimeout(): void {
    if (this.consoleSessionTimer !== null) {
      clearTimeout(this.consoleSessionTimer)
      this.consoleSessionTimer = null
    }
  }

  private cancelConsoleSession(): void {
    if (!this.consoleSessionActive) {
      return
    }

    this.clearConsoleTimeout()
    this.consoleSessionActive = false
    this.consoleSessionStartedAt = null
    this.debuggerCollector.clearSession()
    this.setUiHidden(false)
    this.mountedUi?.store.close()
  }

  private async hideUiForCapture(): Promise<void> {
    this.setUiHidden(true)
    await waitForNextPaint()
  }

  private setUiHidden(hidden: boolean): void {
    this.mountedUi?.setHidden(hidden)
  }

  private prefillTitle(): void {
    const captureTitle = document.title.trim()
    if (captureTitle.length === 0) {
      return
    }

    this.mountedUi?.store.setTitleIfEmpty(captureTitle)
  }

  private getRuntimeConfig(): CaptureRuntimeConfig {
    if (!this.runtimeConfig) {
      throw new Error(
        "Capture SDK is not initialized. Call capture.init({ key }) first."
      )
    }

    return this.runtimeConfig
  }

  private ensureBrowserContext(): void {
    if (typeof window === "undefined" || typeof document === "undefined") {
      throw new Error("Capture SDK can only run in a browser environment.")
    }
  }
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  })
}
