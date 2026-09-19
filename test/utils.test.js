import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, parseDuration, safeFileName } from "../server/utils.js";

test("parseDuration understands minutes, hours and days", () => {
  assert.equal(parseDuration("30m"), 30 * 60_000);
  assert.equal(parseDuration("2h"), 2 * 3_600_000);
  assert.equal(parseDuration("7d"), 7 * 86_400_000);
});

test("parseDuration rejects invalid and excessive durations", () => {
  assert.throws(() => parseDuration("abc"));
  assert.throws(() => parseDuration("31d"));
});

test("password hashing is deterministic", () => {
  assert.equal(hashPassword("hello"), hashPassword("hello"));
  assert.notEqual(hashPassword("hello"), hashPassword("world"));
});

test("safeFileName removes unsafe characters", () => {
  assert.equal(safeFileName("../../secret.txt"), ".._.._secret.txt");
  assert.equal(safeFileName(""), "download");
});
