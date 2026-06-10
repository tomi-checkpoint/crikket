import { describe, expect, test } from "bun:test"

import { SCREENSHOT_LOOKBACK_MS } from "../src/constants"
import { CaptureSdkRuntime } from "../src/runtime/capture-runtime"
import { sdkTestState, setupCaptureSdkTestHooks } from "./lib/sdk-test-harness"

const KEY = "crk_console_test"
const HOST = "https://crikket.gotomarketpro.de"

describe("console capture session", () => {
  setupCaptureSdkTestHooks()

  test("startConsoleSession starts an open-ended session (lookback 0)", async () => {
    const runtime = new CaptureSdkRuntime()
    runtime.init({ key: KEY, host: HOST })

    const result = await runtime.startConsoleSession()

    expect(typeof result.startedAt).toBe("number")
    expect(sdkTestState.startSessionCalls).toEqual([
      { captureType: "screenshot", lookbackMs: 0 },
    ])

    // Clean up the 180s timer so it doesn't linger past the test.
    runtime.reset()
  })

  test("a screenshot during a console session preserves it (no fresh session) and finalizes", async () => {
    const runtime = new CaptureSdkRuntime()
    runtime.init({ key: KEY, host: HOST })

    await runtime.startConsoleSession()
    await runtime.takeScreenshot()

    // Still ONLY the console session start — never a second
    // startScreenshotSession (which would discard the captured console + steps).
    expect(sdkTestState.startSessionCalls).toEqual([
      { captureType: "screenshot", lookbackMs: 0 },
    ])
    expect(sdkTestState.finalizeSessionCalls).toBe(1)
    expect(sdkTestState.uiShowReviewInputs).toHaveLength(1)
  })

  test("a normal screenshot (no console session) starts a lookback screenshot session", async () => {
    const runtime = new CaptureSdkRuntime()
    runtime.init({ key: KEY, host: HOST })

    await runtime.takeScreenshot()

    expect(sdkTestState.startSessionCalls).toEqual([
      { captureType: "screenshot", lookbackMs: SCREENSHOT_LOOKBACK_MS },
    ])
  })

  test("stopConsoleSession cancels the session; a later screenshot is a normal one", async () => {
    const runtime = new CaptureSdkRuntime()
    runtime.init({ key: KEY, host: HOST })

    await runtime.startConsoleSession()
    runtime.stopConsoleSession()

    expect(sdkTestState.clearSessionCalls).toBeGreaterThan(0)

    await runtime.takeScreenshot()

    expect(sdkTestState.startSessionCalls).toContainEqual({
      captureType: "screenshot",
      lookbackMs: SCREENSHOT_LOOKBACK_MS,
    })
  })
})
