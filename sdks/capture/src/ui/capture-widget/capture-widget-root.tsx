import { useSyncExternalStore } from "react"
import type {
  CaptureUiCallbacks,
  CaptureUiCapabilities,
  CaptureUiStore,
} from "../types"
import { CaptureWidgetShell } from "./capture-widget-shell"
import { useCaptureUiHandlers } from "./hooks/use-capture-ui-handlers"
import { useRecordingClock } from "./hooks/use-recording-clock"

export function CaptureWidgetRoot(props: {
  callbacks: CaptureUiCallbacks
  capabilities: CaptureUiCapabilities
  store: CaptureUiStore
  zIndex: number
}): React.JSX.Element {
  const state = useSyncExternalStore(
    props.store.subscribe,
    props.store.getSnapshot,
    props.store.getSnapshot
  )
  const { handlers, isSubmitPending } = useCaptureUiHandlers({
    callbacks: props.callbacks,
    shareUrl: state.shareUrl,
    store: props.store,
  })
  const recordingTime = useRecordingClock({
    recordingDockOpen: state.recordingDockOpen,
    recordingStartedAt: state.recordingStartedAt,
  })

  return (
    <CaptureWidgetShell
      capabilities={props.capabilities}
      handlers={handlers}
      isSubmitPending={isSubmitPending}
      recordingTime={recordingTime}
      state={state}
      zIndex={props.zIndex}
    />
  )
}
