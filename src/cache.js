// A small LRU cache with per-entry expiry. When given a Storage object (such as
// localStorage) it mirrors entries there, so a reload or a shared link that was
// opened recently answers instantly instead of spending AniList's rate limit.
// Storage is a convenience only: every access is guarded, and a full or blocked
// storage simply leaves the cache memory-only.

export class TtlCache {
  constructor({ maxEntries = 100, storage = null, prefix = "cache:", now = () => Date.now() } = {}) {
    this.maxEntries = maxEntries;
    this.storage = storage;
    this.prefix = prefix;
    this.now = now;
    this.entries = new Map();
    this.loadFromStorage();
  }

  loadFromStorage() {
    if (!this.storage) return;
    try {
      const stored = [];
      for (let index = 0; index < this.storage.length; index += 1) {
        const storageKey = this.storage.key(index);
        if (!storageKey?.startsWith(this.prefix)) continue;
        try {
          const entry = JSON.parse(this.storage.getItem(storageKey));
          if (entry && typeof entry.expiresAt === "number") stored.push([storageKey.slice(this.prefix.length), entry]);
        } catch {
          stored.push([storageKey.slice(this.prefix.length), null]);
        }
      }
      stored.sort((left, right) => (left[1]?.savedAt ?? 0) - (right[1]?.savedAt ?? 0));
      for (const [key, entry] of stored) {
        if (!entry || entry.expiresAt <= this.now()) this.removeStored(key);
        else this.entries.set(key, entry);
      }
      this.trim();
    } catch {
      // Storage that cannot be read is treated as empty.
    }
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.delete(key);
      return null;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key, value, ttl) {
    const savedAt = this.now();
    const entry = { savedAt, expiresAt: savedAt + ttl, value };
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.trim();
    this.writeStored(key, entry);
  }

  delete(key) {
    this.entries.delete(key);
    this.removeStored(key);
  }

  trim() {
    while (this.entries.size > this.maxEntries) this.delete(this.entries.keys().next().value);
  }

  writeStored(key, entry) {
    if (!this.storage) return;
    const serialized = JSON.stringify(entry);
    // When storage is full, drop the oldest entries until this one fits.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        this.storage.setItem(this.prefix + key, serialized);
        return;
      } catch {
        const oldest = this.entries.keys().next().value;
        if (oldest === undefined || oldest === key) break;
        this.delete(oldest);
      }
    }
    this.removeStored(key);
  }

  removeStored(key) {
    if (!this.storage) return;
    try {
      this.storage.removeItem(this.prefix + key);
    } catch {
      // Nothing to do: the memory copy is already gone.
    }
  }
}

// Stable, short cache keys for long GraphQL documents.
export function hashKey(text) {
  let first = 0x811c9dc5;
  let second = 0x01000193;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x5bd1e995);
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}${text.length.toString(36)}`;
}
