import assert from "node:assert/strict";
import test from "node:test";
import { calculateScale, parseMeasurement } from "./scale.js";

test("accepts decimal comma and decimal point", () => {
  assert.equal(parseMeasurement("12,5"), 12.5);
  assert.equal(parseMeasurement("12.5"), 12.5);
});
test("calculates increases and reductions", () => {
  assert.equal(calculateScale(12, 20).state, "increase");
  assert.equal(calculateScale(20, 12).scale, 60);
  assert.equal(calculateScale(12, 12).state, "original");
});
test("rejects invalid measurements", () => {
  assert.equal(calculateScale(0, 20), null);
  assert.equal(calculateScale(-1, 20), null);
  assert.equal(calculateScale(10, -2), null);
  assert.equal(parseMeasurement("abc"), null);
});

