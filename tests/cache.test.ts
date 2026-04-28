import { mkdtemp, readFile, rm, utimes, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FetchCache } from "../scripts/sync/cache.js";

describe("FetchCache", () => {
  let cacheDir: string;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    cacheDir = await mkdtemp(path.join(os.tmpdir(), "ai-proxy-cache-"));
    originalFetch = globalThis.fetch;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await rm(cacheDir, { recursive: true, force: true });
  });

  it("caches successful fetches and returns the body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("hello world", { status: 200 })
    ) as typeof globalThis.fetch;

    const cache = new FetchCache(cacheDir);
    const text = await cache.fetch("https://example.com/a");

    expect(text).toBe("hello world");
    expect(cache.getWarnings()).toEqual([]);

    const indexRaw = await readFile(path.join(cacheDir, "_index.json"), "utf8");
    expect(indexRaw).toContain("https://example.com/a");
  });

  it("falls back to cache and emits a warning when fetch fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("fresh", { status: 200 })
    ) as typeof globalThis.fetch;
    const cache1 = new FetchCache(cacheDir);
    await cache1.fetch("https://example.com/b");

    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network unreachable")) as typeof globalThis.fetch;
    const cache2 = new FetchCache(cacheDir);
    const text = await cache2.fetch("https://example.com/b");

    expect(text).toBe("fresh");
    const warnings = cache2.getWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.url).toBe("https://example.com/b");
    expect(warnings[0]?.reason).toContain("network unreachable");
  });

  it("throws when both fetch fails and no cache exists", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline")) as typeof globalThis.fetch;
    const cache = new FetchCache(cacheDir);
    await expect(cache.fetch("https://example.com/c")).rejects.toThrow(/no cache available/);
  });

  it("emits stale warning when cached entry is older than 30 days", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("ancient", { status: 200 })
    ) as typeof globalThis.fetch;
    const cache1 = new FetchCache(cacheDir);
    await cache1.fetch("https://example.com/d");

    // Backdate the cache file mtime by 40 days
    const cacheFiles = (await import("node:fs/promises")).readdir;
    const entries = await cacheFiles(cacheDir);
    const cacheFile = entries.find((name) => name.endsWith(".txt"));
    expect(cacheFile).toBeTruthy();
    const target = path.join(cacheDir, cacheFile!);
    const oldDate = new Date(Date.now() - 40 * 86_400_000);
    await utimes(target, oldDate, oldDate);

    globalThis.fetch = vi.fn().mockRejectedValue(new Error("temporary 503")) as typeof globalThis.fetch;
    const cache2 = new FetchCache(cacheDir);
    await cache2.fetch("https://example.com/d");

    const stale = cache2.getStaleWarnings();
    expect(stale).toHaveLength(1);
    expect(stale[0]?.ageDays).toBeGreaterThanOrEqual(40);
  });

  it("prunes orphan cache entries not used in this run", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(new Response(`body-of-${url}`, { status: 200 }))
    ) as typeof globalThis.fetch;
    const cache1 = new FetchCache(cacheDir);
    await cache1.fetch("https://example.com/keep");
    await cache1.fetch("https://example.com/drop");

    // Second run only uses one URL
    const cache2 = new FetchCache(cacheDir);
    await cache2.fetch("https://example.com/keep");
    const removed = await cache2.pruneOrphans();

    expect(removed.some((entry) => entry.includes("drop"))).toBe(true);

    const indexRaw = await readFile(path.join(cacheDir, "_index.json"), "utf8");
    expect(indexRaw).toContain("/keep");
    expect(indexRaw).not.toContain("/drop");
  });

  it("removes stray files in cache dir during prune", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("kept", { status: 200 })
    ) as typeof globalThis.fetch;
    const cache = new FetchCache(cacheDir);
    await cache.fetch("https://example.com/k");

    await mkdir(cacheDir, { recursive: true });
    await writeFile(path.join(cacheDir, "stray.txt"), "leftover", "utf8");

    const removed = await cache.pruneOrphans();
    expect(removed).toContain("stray.txt");
  });
});
