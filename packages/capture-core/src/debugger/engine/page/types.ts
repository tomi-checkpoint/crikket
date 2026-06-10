export type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug"

export interface Reporter {
  reportNonFatalError: (context: string, error: unknown) => void
}

export interface EventQueue {
  enqueueEvent: (event: unknown) => void
  flushEventQueue: () => void
  // Synchronously remove and return all queued-but-unflushed events. Used to
  // capture the tail of a session at finalize time without waiting for the
  // async postMessage flush.
  drainPendingEvents: () => unknown[]
}

export interface PageRuntimeDiagnostics {
  version: number
  installedAt: number
  url: string
  hooks: {
    fetch: "pending" | "accessor" | "assignment" | "failed"
    xhr: boolean
  }
  counters: {
    actionEvents: number
    consoleEvents: number
    networkEvents: number
    fetchCalls: number
    fetchFailures: number
    xhrCalls: number
    queuedEvents: number
    flushedBatches: number
  }
  last: {
    networkUrl?: string
    fetchError?: string
  }
  errors: string[]
}
