import { afterEach, describe, expect, test } from "bun:test"

import { installConsoleCapture } from "../src/debugger/engine/page/console"
import type { ConsoleLevel } from "../src/debugger/engine/page/types"

const CONSOLE_LEVELS: ConsoleLevel[] = ["log", "info", "warn", "error", "debug"]

type ConsoleMethods = Pick<Console, ConsoleLevel>

function snapshotConsole(): ConsoleMethods {
  return {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  }
}

function restoreConsole(methods: ConsoleMethods): void {
  console.log = methods.log
  console.info = methods.info
  console.warn = methods.warn
  console.error = methods.error
  console.debug = methods.debug
}

const noopReporter = {
  reportNonFatalError: () => undefined,
}

describe("installConsoleCapture", () => {
  let original: ConsoleMethods | null = null

  afterEach(() => {
    if (original) {
      restoreConsole(original)
      original = null
    }
  })

  test("forwards every console level to postConsole while preserving original output", () => {
    original = snapshotConsole()

    const forwarded: Array<{ level: ConsoleLevel; args: unknown[] }> = []
    const passthrough: Array<{ level: ConsoleLevel; args: unknown[] }> = []

    // Replace each level with a spy BEFORE install so we can prove the patched
    // method still calls through to the (now spy) original.
    for (const level of CONSOLE_LEVELS) {
      console[level] = ((...args: unknown[]) => {
        passthrough.push({ level, args })
      }) as Console[ConsoleLevel]
    }

    installConsoleCapture({
      reporter: noopReporter,
      postConsole: (level, args) => {
        forwarded.push({ level, args })
      },
    })

    console.log("boot", 1)
    console.info("info")
    console.warn("warn")
    console.error("kaboom", { code: 500 })
    console.debug("debug")

    // Every level was captured for the debugger payload...
    expect(forwarded).toEqual([
      { level: "log", args: ["boot", 1] },
      { level: "info", args: ["info"] },
      { level: "warn", args: ["warn"] },
      { level: "error", args: ["kaboom", { code: 500 }] },
      { level: "debug", args: ["debug"] },
    ])
    // ...and the page's own console output was not swallowed.
    expect(passthrough).toEqual(forwarded)
  })

  test("a throwing postConsole is reported and never breaks console output", () => {
    original = snapshotConsole()

    let stillLogged = false
    console.log = (() => {
      stillLogged = true
    }) as Console["log"]

    const reported: unknown[] = []

    installConsoleCapture({
      reporter: {
        reportNonFatalError: (_message, error) => {
          reported.push(error)
        },
      },
      postConsole: () => {
        throw new Error("capture exploded")
      },
    })

    // Must not throw into the host page even when capture fails.
    expect(() => console.log("hello")).not.toThrow()
    expect(stillLogged).toBe(true)
    expect(reported).toHaveLength(1)
  })
})
