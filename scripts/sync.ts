#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { parse, stringify } from "yaml";
import { z } from "zod";
import {
  buildProviderData,
  sourceProviderSchema,
  type SourceProvider,
  type SourceProviderData
} from "./sync/build.js";
import { FetchCache } from "./sync/cache.js";

interface SyncOptions {
  input: string;
  output: string;
  provider: string;
  cache: string;
}

const program = new Command();

program
  .name("sync-provider-data")
  .description("Sync normalized provider data from upstream sources and local patches.")
  .option("-i, --input <dir>", "provider source directory", "data/sources")
  .option("-o, --output <dir>", "normalized provider data directory", "data/providers")
  .option("-p, --provider <names>", "comma-separated provider names or all", "all")
  .option("--cache <dir>", "fetch cache directory used as fallback on upstream failure", "data/cache")
  .action(async (options: SyncOptions) => {
    await sync(options);
  });

await program.parseAsync();

async function sync(options: SyncOptions): Promise<void> {
  const sourceFiles = await selectSourceFiles(options.input, options.provider);
  const writes: string[] = [];
  const cache = new FetchCache(options.cache);

  await mkdir(options.output, { recursive: true });

  for (const sourceFile of sourceFiles) {
    const provider = await loadSourceProvider(sourceFile);
    const normalized = await buildProviderData(provider, path.dirname(sourceFile), {
      fetcher: (url) => cache.fetch(url),
      cache
    });
    const outPath = path.join(options.output, `${provider.provider}.yaml`);

    await writeFile(outPath, stringifyProviderData(normalized), "utf8");
    writes.push(outPath);
  }

  for (const filePath of writes) {
    console.log(filePath);
  }

  const removed = await cache.pruneOrphans();
  if (options.provider === "all" && removed.length > 0) {
    const isGithubActions = process.env.GITHUB_ACTIONS === "true";
    const tag = isGithubActions ? "::notice::" : "[notice] ";
    console.log(`${tag}Pruned ${removed.length} orphan cache entry/entries.`);
  }

  reportCacheWarnings(cache);
}

function reportCacheWarnings(cache: FetchCache): void {
  const warnings = cache.getWarnings();
  const staleWarnings = cache.getStaleWarnings();
  const isGithubActions = process.env.GITHUB_ACTIONS === "true";
  const warn = (msg: string) => {
    if (isGithubActions) {
      console.log(`::warning::${msg}`);
    } else {
      console.warn(`[warning] ${msg}`);
    }
  };

  for (const warning of warnings) {
    const cachedHint = warning.cachedAt ? ` (cached at ${warning.cachedAt})` : "";
    warn(`Upstream fetch failed for ${warning.url}: ${warning.reason}. Using cached copy${cachedHint}.`);
  }

  for (const stale of staleWarnings) {
    warn(`Cached copy of ${stale.url} is ${stale.ageDays} days old; upstream may be permanently down.`);
  }

  if (warnings.length > 0) {
    warn(`${warnings.length} upstream source(s) served from cache. Investigate and refresh when convenient.`);
  }
}

async function selectSourceFiles(inputDir: string, providerOption: string): Promise<string[]> {
  const selected = parseCsv(providerOption);

  if (!selected.includes("all")) {
    return selected.map((provider) => path.join(inputDir, `${provider}.yaml`));
  }

  const entries = await readdir(inputDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => path.join(inputDir, entry.name))
    .sort();
}

async function loadSourceProvider(filePath: string): Promise<SourceProvider> {
  const raw = await readFile(filePath, "utf8");
  const result = sourceProviderSchema.safeParse(parse(raw));
  if (!result.success) {
    throw new Error(`Invalid source config in ${filePath}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

function stringifyProviderData(provider: SourceProviderData): string {
  return stringify(provider, {
    lineWidth: 0,
    sortMapEntries: false
  });
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
