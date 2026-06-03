import { describe, expect, test } from "bun:test"

import { CaptureSdkRuntime } from "../src/runtime/capture-runtime"
import {
  sdkTestState,
  setupCaptureSdkTestHooks,
  waitFor,
} from "./lib/sdk-test-harness"

const KEY = "crk_test_site"
const HOST = "https://crikket.gotomarketpro.de"

// The debugger page runtime monkey-patches console.* and wraps fetch/XHR. That
// must NEVER run at page load (it looks like a data skimmer and hurts host-domain
// reputation). It installs only once the user opens the feedback widget.
describe("debugger install timing", () => {
  setupCaptureSdkTestHooks()

  test("does NOT install the debugger at init, even with autoMount", async () => {
    const runtime = new CaptureSdkRuntime()
    runtime.init({ key: KEY, host: HOST })

    // Give any stray async install a chance to fire before asserting a negative.
    await new Promise((resolve) => {
      setTimeout(resolve, 50)
    })

    expect(sdkTestState.installCalls).toBe(0)
  })

  test("installs the debugger when the widget is opened programmatically", async () => {
    const runtime = new CaptureSdkRuntime()
    runtime.init({ key: KEY, host: HOST })
    expect(sdkTestState.installCalls).toBe(0)

    runtime.open()

    await waitFor(() => sdkTestState.installCalls > 0)
    expect(sdkTestState.installCalls).toBe(1)
  })

  test("installs the debugger when the launcher (feedback) button is clicked", async () => {
    const runtime = new CaptureSdkRuntime()
    runtime.init({ key: KEY, host: HOST })
    expect(sdkTestState.installCalls).toBe(0)

    // Simulate the launcher button click path (onLauncherClick -> runtime callback).
    sdkTestState.lastUiCallbacks?.onLauncherClick()

    await waitFor(() => sdkTestState.installCalls > 0)
    expect(sdkTestState.installCalls).toBe(1)
  })
})
