const { test } = require("node:test");
const assert = require("node:assert/strict");
const D = require("../domain.js");

test("date ranges include pickup and return and stay stable across DST", () => {
  assert.equal(D.dateRange("2026-10-31", "2026-11-02", "2026-01-01").days, 3);
  assert.equal(D.dateRange("2026-03-07", "2026-03-09", "2026-01-01").days, 3);
  assert.equal(D.dateRange("2026-09-09", "2026-09-09", "2026-01-01").days, 1);
});

test("invalid, past, reversed, and overlong dates are rejected", () => {
  for (const [start, end] of [["2026-02-30", "2026-03-01"], ["2026-01-01", "2026-01-03"], ["2026-09-10", "2026-09-09"], ["2026-09-01", "2026-10-01"]]) {
    assert.throws(() => D.dateRange(start, end, "2026-09-01"));
  }
});

test("daily pricing uses cents and weekend rate only applies Friday through Sunday", () => {
  const tool = { daily_rate: 10.1, weekend_rate: 25 };
  assert.equal(D.quote(tool, "2026-09-08", "2026-09-10", "2026-01-01").total, 30.3);
  assert.equal(D.quote(tool, "2026-09-11", "2026-09-13", "2026-01-01").total, 25);
  assert.equal(D.quote({ daily_rate: 5, weekend_rate: 25 }, "2026-09-11", "2026-09-13", "2026-01-01").total, 15);
  assert.throws(() => D.quote({ daily_rate: 0 }, "2026-09-11", "2026-09-13", "2026-01-01"));
});

test("booked dates include the day a tool is returned", () => {
  assert.equal(D.overlaps("2026-09-10", "2026-09-12", "2026-09-12", "2026-09-14"), true);
  assert.equal(D.overlaps("2026-09-10", "2026-09-12", "2026-09-13", "2026-09-14"), false);
});

test("only the right participant gets each lifecycle action", () => {
  assert.deepEqual(D.actions("pending", "owner"), ["approve", "decline"]);
  assert.deepEqual(D.actions("pending", "renter"), ["cancel"]);
  assert.deepEqual(D.actions("approved", "renter"), ["confirm", "cancel"]);
  assert.deepEqual(D.actions("active", "owner"), ["complete"]);
  for (const status of ["completed", "declined", "cancelled"]) assert.deepEqual(D.actions(status, "owner"), []);
});

test("listing photos only use the project's public photo bucket", () => {
  assert.equal(D.safeImage("javascript:alert(1)"), "");
  assert.equal(D.safeImage("https://example.com/tracker.jpg"), "");
  assert.equal(D.safeImage("https://gduefgyrvlreemgbwqwz.supabase.co/storage/v1/object/public/tool-photos/test.jpg").endsWith("test.jpg"), true);
});
