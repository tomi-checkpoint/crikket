import type {
  CaptureDebuggerSummary,
  CapturedMedia,
  CaptureSubmissionDraft,
} from "../types"

export interface CaptureReviewSubmitOptions {
  screenshotBlobOverride?: Blob
}

export interface CaptureUiState {
  view: "chooser" | "recording" | "console" | "review" | "success"
  overlayOpen: boolean
  recordingDockOpen: boolean
  consoleDockOpen: boolean
  busy: boolean
  errorMessage: string | null
  recordingStartedAt: number | null
  consoleSessionStartedAt: number | null
  warnings: string[]
  summary: CaptureDebuggerSummary
  media: CapturedMedia | null
  shareUrl: string
  copyLabel: string
  reviewDraft: CaptureSubmissionDraft
  reviewFormKey: string
}

export interface CaptureUiHandlers {
  onLauncherClick: () => void
  onClose: () => void
  onStartVideo: () => void
  onStartConsole: () => void
  onStopConsole: () => void
  onTakeScreenshot: () => void
  onPickScreenshotFile: (file: File | Blob) => void
  onStopRecording: () => void
  onSubmit: (
    draft: CaptureSubmissionDraft,
    options?: CaptureReviewSubmitOptions
  ) => Promise<void>
  onCancel: () => void
  onRetry: () => void
  onCopyLink: () => void
  onOpenLink: () => void
}

export interface CaptureUiCallbacks {
  onLauncherClick: () => void
  onClose: () => void
  onStartVideo: () => Promise<{ startedAt: number }>
  onStartConsole: () => Promise<{ startedAt: number }>
  onStopConsole: () => void
  onTakeScreenshot: () => Promise<void>
  onPickScreenshotFile: (file: File | Blob) => Promise<void>
  onStopRecording: () => Promise<void>
  onSubmit: (
    draft: CaptureSubmissionDraft,
    options?: CaptureReviewSubmitOptions
  ) => Promise<void>
  onReset: () => void
}

export interface CaptureUiCapabilities {
  supportsDisplayMedia: boolean
}

export interface CaptureUiStore {
  getSnapshot: () => CaptureUiState
  subscribe: (listener: () => void) => () => void
  patchState: (patch: Partial<CaptureUiState>) => void
  openChooser: () => void
  close: () => void
  showRecording: (startedAt: number) => void
  showConsoleSession: (startedAt: number) => void
  showReview: (input: {
    media: CapturedMedia
    warnings: string[]
    summary: CaptureDebuggerSummary
  }) => void
  showSuccess: (shareUrl?: string) => void
  showError: (message: string) => void
  setTitleIfEmpty: (value: string) => void
  destroy: () => void
}

export interface MountedCaptureUi {
  setHidden: (hidden: boolean) => void
  store: CaptureUiStore
  unmount: () => void
}
