import { describe, expect, test } from "bun:test"

import { EAGER_DEBUGGER_KEYS } from "../src/constants"
import { CaptureSdkRuntime } from "../src/runtime/capture-runtime"
import { shouldEagerlyCaptureDebugger } from "../src/utils"
import {
  sdkTestState,
  setupCaptureSdkTestHooks,
  waitFor,
} from "./lib/sdk-test-harness"

// joinco.co ("coco") capture key — eager by default per the allow-list.
const COCO_KEY = "crk_S0nrUVc8FQJ1dSSZWP6hQIMl"
// An arbitrary key for a site that has NOT opted into eager capture.
const OTHER_KEY = "crk_some_other_customer_site_000000"

const HOST = "https://crikket.gotomarketpro.de"

// Give the (potential) lazy dynamic-import + install chain time to resolve so
// that asserting "not primed" is a true negative rather than a race.
async function settlePotentialPrime(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 50)
  })
}

describe("shouldEagerlyCaptureDebugger gating matrix", () => {
  test("allow-listed key is eager when no flag is passed", () => {
    expect(shouldEagerlyCaptureDebugger(COCO_KEY)).toBe(true)
  })

  test("non-allow-listed key is lazy when no flag is passed", () => {
    expect(shouldEagerlyCaptureDebugger(OTHER_KEY)).toBe(false)
  })

  test("explicit true opts any key in", () => {
    expect(shouldEagerlyCaptureDebugger(OTHER_KEY, true)).toBe(true)
  })

  test("explicit false opts an allow-listed key out", () => {
    expect(shouldEagerlyCaptureDebugger(COCO_KEY, false)).toBe(false)
  })

  test("the joinco.co key is on the allow-list", () => {
    expect(EAGER_DEBUGGER_KEYS.has(COCO_KEY)).toBe(true)
  })
})

describe("eager debugger capture at SDK init", () => {
  setupCaptureSdkTestHooks()

  test("primes the debugger at init for an allow-listed key, without starting a session", async () => {
    const runtime = new CaptureSdkRuntime()
    runtime.init({ key: COCO_KEY, host: HOST, autoMount: false })

    await waitFor(() => sdkTestState.installCalls > 0)

    expect(sdkTestState.installCalls).toBe(1)
    // Priming must buffer events without capturing anything yet.
    expect(sdkTestState.startSessionCalls).toHaveLength(0)
  })

  test("does NOT prime at init for a non-allow-listed key", async () => {
    const runtime = new CaptureSdkRuntime()
    runtime.init({ key: OTHER_KEY, host: HOST, autoMount: false })

    await settlePotentialPrime()

    expect(sdkTestState.installCalls).toBe(0)
  })

  test("primes at init for any key when eagerDebugger: true", async () => {
    const runtime = new CaptureSdkRuntime()
    runtime.init({
      key: OTHER_KEY,
      host: HOST,
      autoMount: false,
      eagerDebugger: true,
    })

    await waitFor(() => sdkTestState.installCalls > 0)

    expect(sdkTestState.installCalls).toBe(1)
  })

  test("eagerDebugger: false opts an allow-listed key out of eager capture", async () => {
    const runtime = new CaptureSdkRuntime()
    runtime.init({
      key: COCO_KEY,
      host: HOST,
      autoMount: false,
      eagerDebugger: false,
    })

    await settlePotentialPrime()

    expect(sdkTestState.installCalls).toBe(0)
  })
})
