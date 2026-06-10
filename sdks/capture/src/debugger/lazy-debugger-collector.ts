import { SCREENSHOT_LOOKBACK_MS } from "../constants"
import type { CaptureType, ReviewSnapshot } from "../types"

interface DebuggerCollectorInstance {
  dispose: () => void
  clearSession: () => void
  finalizeSession: () => ReviewSnapshot
  markRecordingStarted: (recordingStartedAt: number) => void
  startSession: (captureType: CaptureType, lookbackMs?: number) => void
}

export class LazyDebuggerCollector {
  private collector: DebuggerCollectorInstance | null = null
  private collectorPromise: Promise<DebuggerCollectorInstance> | null = null

  /**
   * Install the page runtime (console/network/action hooks + message listener)
   * without starting a capture session, so the pre-capture buffer is warm by
   * the time a screenshot is taken. Best-effort: failures are swallowed because
   * buffering is non-critical and must never break SDK init. Idempotent — a
   * later session start reuses the same collector.
   */
  async prime(): Promise<void> {
    try {
      await this.ensureCollector()
    } catch {
      // Debugger buffering is best-effort; never let it break the host page.
    }
  }

  async startScreenshotSession(): Promise<void> {
    const collector = await this.ensureCollector()
    collector.startSession("screenshot", SCREENSHOT_LOOKBACK_MS)
  }

  async startRecordingSession(): Promise<void> {
    const collector = await this.ensureCollector()
    collector.startSession("video")
  }

  async startConsoleSession(): Promise<void> {
    const collector = await this.ensureCollector()
    // Open-ended session anchored to now (lookbackMs 0) so console + action
    // events captured while the user reproduces the bug accumulate until a
    // screenshot finalizes them.
    collector.startSession("screenshot", 0)
  }

  markRecordingStarted(recordingStartedAt: number): void {
    this.collector?.markRecordingStarted(recordingStartedAt)
  }

  finalizeSession(): ReviewSnapshot {
    return this.collector?.finalizeSession() ?? buildMissingSessionReview()
  }

  clearSession(): void {
    this.collector?.clearSession()
  }

  dispose(): void {
    this.collectorPromise = null
    this.collector?.dispose()
    this.collector = null
  }

  private ensureCollector(): Promise<DebuggerCollectorInstance> {
    if (this.collector) {
      return Promise.resolve(this.collector)
    }

    if (this.collectorPromise) {
      return this.collectorPromise
    }

    const collectorPromise = import("./debugger-collector")
      .then(({ DebuggerCollector }) => {
        const collector = new DebuggerCollector()
        collector.install()
        this.collector = collector
        return collector satisfies DebuggerCollectorInstance
      })
      .finally(() => {
        if (this.collectorPromise === collectorPromise) {
          this.collectorPromise = null
        }
      })

    this.collectorPromise = collectorPromise
    return collectorPromise
  }
}

function buildMissingSessionReview(): ReviewSnapshot {
  return {
    warnings: [
      "Debugger session was not available. This report will not include debugger data.",
    ],
    debuggerSummary: {
      actions: 0,
      logs: 0,
      networkRequests: 0,
    },
  }
}
