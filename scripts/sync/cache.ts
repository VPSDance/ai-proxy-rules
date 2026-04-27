import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface CacheWarning {
  url: string;
  reason: string;
  cachedAt?: string;
}

export class FetchCache {
  private warnings: CacheWarning[] = [];
  private indexCache: Record<string, string> | null = null;

  constructor(private cacheDir: string) {}

  async fetch(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const text = await response.text();
      await this.write(url, text);
      return text;
    } catch (error) {
      const cached = await this.read(url);
      if (cached !== null) {
        this.warnings.push({
          url,
          reason: error instanceof Error ? error.message : String(error),
          cachedAt: cached.cachedAt
        });
        return cached.text;
      }
      throw new Error(
        `Failed to fetch ${url} and no cache available: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  getWarnings(): CacheWarning[] {
    return [...this.warnings];
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
