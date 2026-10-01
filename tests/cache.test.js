import assert from "node:assert/strict";
import test from "node:test";
import { hashKey, TtlCache } from "../src/cache.js";

class MemoryStorage {
  constructor(quota = Infinity) {
    this.map = new Map();
    this.quota = quota;
  }
  get length() {
    return this.map.size;
  }
  key(index) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    const used = [...this.map].reduce((total, [name, item]) => total + (name === key ? 0 : item.length), 0);
    if (used + value.length > this.quota) throw new Error("QuotaExceededError");
    this.map.set(key, value);
  }
  removeItem(key) {
    this.map.delete(key);
  }
}

test("entries expire after their own time to live", () => {
  let now = 1_000;
  const cache = new TtlCache({ now: () => now });
  cache.set("short", 1, 100);
  cache.set("long", 2, 1_000);
  now += 500;

  assert.equal(cache.get("short"), null);
  assert.equal(cache.get("long"), 2);
});

test("the least recently used entry is evicted first", () => {
  const cache = new TtlCache({ maxEntries: 2 });
  cache.set("a", 1, 10_000);
  cache.set("b", 2, 10_000);
  cache.get("a");
  cache.set("c", 3, 10_000);

  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("b"), null);
  assert.equal(cache.get("c"), 3);
});

test("entries survive a reload through storage, expired ones are cleaned up", () => {
  let now = 0;
  const storage = new MemoryStorage();
  const first = new TtlCache({ storage, prefix: "t:", now: () => now });
  first.set("fresh", { ok: true }, 1_000);
  first.set("stale", { ok: false }, 10);
  storage.setItem("t:broken", "{not json");
  storage.setItem("other", "untouched");
  now = 100;

  const second = new TtlCache({ storage, prefix: "t:", now: () => now });
  assert.deepEqual(second.get("fresh"), { ok: true });
  assert.equal(second.get("stale"), null);
  assert.equal(storage.getItem("t:stale"), null);
  assert.equal(storage.getItem("t:broken"), null);
  assert.equal(storage.getItem("other"), "untouched");
});

test("a full storage evicts old entries instead of failing", () => {
  const storage = new MemoryStorage(260);
  const cache = new TtlCache({ storage, prefix: "t:" });
  for (let index = 0; index < 6; index += 1) cache.set(`k${index}`, "x".repeat(40), 10_000);

  assert.equal(cache.get("k5"), "x".repeat(40));
  assert.ok(storage.getItem("t:k5"));
  assert.equal(storage.getItem("t:k0"), null);
});

test("hashKey is stable and distinguishes different queries", () => {
  assert.equal(hashKey("query { a }"), hashKey("query { a }"));
  assert.notEqual(hashKey("query { a }"), hashKey("query { b }"));
});
