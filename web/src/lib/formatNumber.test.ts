import assert from "node:assert/strict";
import test from "node:test";
import { formatNumber } from "./formatNumber";

test("formatNumber formats numbers with commas", () => {
  assert.equal(formatNumber(1234567), "1,234,567");
  assert.equal(formatNumber("1234567"), "1,234,567");
  assert.equal(formatNumber("1,234,567"), "1,234,567");
  assert.equal(formatNumber(null), "0");
  assert.equal(formatNumber(undefined), "0");
  assert.equal(formatNumber("not-a-number"), "0");
});
