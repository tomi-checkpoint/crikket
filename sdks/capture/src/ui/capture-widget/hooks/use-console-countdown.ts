import { useEffect, useState } from "react"
import { CONSOLE_SESSION_TIMEOUT_MS } from "../../../constants"
import { formatDuration } from "../../../utils"

const COUNTDOWN_TICK_MS = 250

// Remaining time (MM:SS) until a console-capture session auto-stops. Mirrors
// useRecordingClock but counts DOWN from CONSOLE_SESSION_TIMEOUT_MS.
export function useConsoleCountdown(input: {
  consoleDockOpen: boolean
  consoleSessionStartedAt: number | null
}): string {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!(input.consoleDockOpen && input.consoleSessionStartedAt)) {
      return
    }

    setNow(Date.now())
    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, COUNTDOWN_TICK_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [input.consoleDockOpen, input.consoleSessionStartedAt])

  if (input.consoleSessionStartedAt === null) {
    return formatDuration(CONSOLE_SESSION_TIMEOUT_MS)
  }

  const remaining = Math.max(
    0,
    CONSOLE_SESSION_TIMEOUT_MS - (now - input.consoleSessionStartedAt)
  )
  return formatDuration(remaining)
}
