import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export interface CacheWarning {
  url: string;
  reason: string;
  cachedAt?: string;
}

export interface StaleCacheWarning {
  url: string;
  ageDays: number;
}

const STALE_CACHE_DAYS = 30;

export class FetchCache {
  private warnings: CacheWarning[] = [];
  private staleWarnings: StaleCacheWarning[] = [];
  private indexCache: Record<string, string> | null = null;
  private usedKeys = new Set<string>();

  constructor(private cacheDir: string) {}

  async fetch(url: string): Promise<string> {
    return this.cached(url, async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return response.text();
    });
  }

  async cached(key: string, fresh: () => Promise<string>): Promise<string> {
    this.usedKeys.add(this.cacheKey(key));
    try {
      const text = await fresh();
      await this.write(key, text);
      return text;
    } catch (error) {
      const cachedEntry = await this.read(key);
      if (cachedEntry !== null) {
        this.warnings.push({
          url: key,
          reason: error instanceof Error ? error.message : String(error),
          cachedAt: cachedEntry.cachedAt
        });
        if (cachedEntry.cachedAt) {
          const ageDays = (Date.now() - new Date(cachedEntry.cachedAt).getTime()) / 86_400_000;
          if (ageDays > STALE_CACHE_DAYS) {
            this.staleWarnings.push({ url: key, ageDays: Math.floor(ageDays) });
          }
        }
        return cachedEntry.text;
      }
      throw new Error(
        `Failed to fetch ${key} and no cache available: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async pruneOrphans(): Promise<string[]> {
    const removed: string[] = [];
    const index = await this.readIndex();
    let indexChanged = false;

    for (const key of Object.keys(index)) {
      if (!this.usedKeys.has(key)) {
        const file = path.join(this.cacheDir, `${key}.txt`);
        await unlink(file).catch(() => undefined);
        removed.push(index[key] ?? key);
        delete index[key];
        indexChanged = true;
      }
    }

    if (indexChanged) {
      this.indexCache = index;
      await writeFile(
        this.indexFile(),
        `${JSON.stringify(sortKeys(index), null, 2)}\n`,
        "utf8"
      );
    }

    const expectedKeys = new Set(Object.keys(index));
    const expectedKeys2 = new Set([...expectedKeys].map((k) => `${k}.txt`));
    expectedKeys2.add("_index.json");
    try {
      const entries = await readdir(this.cacheDir);
      for (const entry of entries) {
        if (!expectedKeys2.has(entry)) {
          await unlink(path.join(this.cacheDir, entry)).catch(() => undefined);
          removed.push(entry);
        }
      }
    } catch {
      // cache dir may not exist yet
    }

    return removed;
  }

  getWarnings(): CacheWarning[] {
    return [...this.warnings];
  }

  getStaleWarnings(): StaleCacheWarning[] {
    return [...this.staleWarnings];
  }

  private cacheKey(url: string): string {
    return createHash("sha256").update(url).digest("hex").slice(0, 16);
  }

  private cacheFile(url: string): string {
    return path.join(this.cacheDir, `${this.cacheKey(url)}.txt`);
  }

  private indexFile(): string {
    return path.join(this.cacheDir, "_index.json");
  }

  private async readIndex(): Promise<Record<string, string>> {
    if (this.indexCache !== null) {
      return this.indexCache;
    }
    try {
      const raw = await readFile(this.indexFile(), "utf8");
      this.indexCache = JSON.parse(raw) as Record<string, string>;
    } catch {
      this.indexCache = {};
    }
    return this.indexCache;
  }

  private async write(url: string, text: string): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });

    const file = this.cacheFile(url);
    const existing = await readFile(file, "utf8").catch(() => null);
    if (existing !== text) {
      await writeFile(file, text, "utf8");
    }

    const index = await this.readIndex();
    if (index[this.cacheKey(url)] !== url) {
      index[this.cacheKey(url)] = url;
      await writeFile(
        this.indexFile(),
        `${JSON.stringify(sortKeys(index), null, 2)}\n`,
        "utf8"
      );
    }
  }

  private async read(url: string): Promise<{ text: string; cachedAt?: string } | null> {
    const file = this.cacheFile(url);
    try {
      const [text, stats] = await Promise.all([
        readFile(file, "utf8"),
        stat(file)
      ]);
      return { text, cachedAt: stats.mtime.toISOString() };
    } catch {
      return null;
    }
  }
}

function sortKeys(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}
