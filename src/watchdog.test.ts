import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { startWatchdog } from "./watchdog.js";

describe("watchdog", () => {
  let stop: (() => void) | undefined;

  beforeEach(() => {
    if (stop) {
      stop();
      stop = undefined;
    }
  });

  it("calls onStall when stall exceeds warn threshold", async () => {
    const stalls: number[] = [];
    stop = startWatchdog({
      checkIntervalMs: 30,
      warnThresholdMs: 40,
      fatalThresholdMs: 5000,
      onStall: (ms) => stalls.push(ms),
    });

    // Block event loop longer than checkInterval + warnThreshold
    const start = Date.now();
    while (Date.now() - start < 120) {
      // busy-wait
    }

    // Let the interval fire
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(stalls.length > 0, "onStall should have been called");
    assert.ok(stalls[0] >= 40, `stall duration ${stalls[0]} should be >= 40ms`);

    stop();
    stop = undefined;
  });

  it("calls onFatal when stall exceeds fatal threshold", async () => {
    const fatals: number[] = [];
    stop = startWatchdog({
      checkIntervalMs: 30,
      warnThresholdMs: 20,
      fatalThresholdMs: 50,
      onStall: () => {},
      onFatal: (ms) => fatals.push(ms),
    });

    // Block event loop longer than checkInterval + fatalThreshold
    const start = Date.now();
    while (Date.now() - start < 150) {
      // busy-wait
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(fatals.length > 0, "onFatal should have been called");
    assert.ok(fatals[0] >= 50, `fatal duration ${fatals[0]} should be >= 50ms`);

    stop();
    stop = undefined;
  });

  it("does not fire when event loop is healthy", async () => {
    const stalls: number[] = [];
    const fatals: number[] = [];
    stop = startWatchdog({
      checkIntervalMs: 30,
      warnThresholdMs: 500,
      fatalThresholdMs: 1000,
      onStall: (ms) => stalls.push(ms),
      onFatal: (ms) => fatals.push(ms),
    });

    // Wait without blocking — interval fires on time
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(stalls.length, 0, "onStall should not fire for healthy loop");
    assert.equal(fatals.length, 0, "onFatal should not fire for healthy loop");

    stop();
    stop = undefined;
  });

  it("stop function cleans up the interval", () => {
    stop = startWatchdog({
      checkIntervalMs: 30,
      warnThresholdMs: 10,
      fatalThresholdMs: 20,
      onStall: () => {},
      onFatal: () => {},
    });

    // Should not throw on double-stop
    stop();
    stop();
    stop = undefined;
  });
});
