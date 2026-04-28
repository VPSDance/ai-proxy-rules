#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { parse } from "yaml";
import { countRulesFromText } from "./checks/guard.js";

interface StatusOptions {
  sources: string;
  providers: string;
  cache: string;
  output: string;
}

const program = new Command();

program
  .name("generate-status")
  .description("Write STATUS.md summarizing per-provider rule counts and source freshness.")
  .option("-s, --sources <dir>", "provider source directory", "data/sources")
  .option("-p, --providers <dir>", "provider data directory", "data/providers")
  .option("-c, --cache <dir>", "cache directory", "data/cache")
  .option("-o, --output <file>", "output markdown file", "STATUS.md")
  .action(async (options: StatusOptions) => {
    await run(options);
  });

await program.parseAsync();

interface SourceEntry {
  name: string;
  url?: string;
  lastFetched?: string;
  ageDays?: number;
  staleFlag: boolean;
}

interface Row {
  id: string;
  name: string;
  categories: string[];
  aliases: string[];
  rules: number;
  sources: SourceEntry[];
}

async function run(options: StatusOptions): Promise<void> {
  const rows: Row[] = [];

  const entries = await readdir(options.sources, { withFileTypes: true });
  const sourceFiles = entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  for (const fileName of sourceFiles) {
    const sourcePath = path.join(options.sources, fileName);
    const sourceParsed = parse(await readFile(sourcePath, "utf8")) as {
      provider?: string;
      name?: string;
      categories?: string[];
      aliases?: string[];
      sources?: Array<{ name?: string; url?: string; type?: string; selector?: string }>;
    };
    const id = sourceParsed.provider ?? fileName.replace(/\.ya?ml$/i, "");
    const name = sourceParsed.name ?? id;
    const categories = sourceParsed.categories ?? [];
    const aliases = sourceParsed.aliases ?? [];

    const providerPath = path.join(options.providers, `${id}.yaml`);
    const providerRaw = await readFile(providerPath, "utf8").catch(() => null);
    const rules = providerRaw ? countRulesFromText(providerRaw) : 0;

    const sourceEntries: SourceEntry[] = [];
    for (const source of sourceParsed.sources ?? []) {
      const cacheKey = source.url
        ? source.type === "remote-html"
          ? `html-extract:${source.url}#${source.selector ?? ""}`
          : source.url
        : undefined;
      const entry: SourceEntry = { name: source.name ?? "?", url: source.url, staleFlag: false };
      if (cacheKey) {
        const stats = await statCacheFile(options.cache, cacheKey);
        if (stats) {
          entry.lastFetched = stats.mtime.toISOString().slice(0, 10);
          entry.ageDays = Math.floor((Date.now() - stats.mtime.getTime()) / 86_400_000);
          entry.staleFlag = entry.ageDays > 30;
        }
      }
      sourceEntries.push(entry);
    }

    rows.push({ id, name, categories, aliases, rules, sources: sourceEntries });
  }

  await writeFile(options.output, renderMarkdown(rows), "utf8");
  console.log(`[status] wrote ${options.output} (${rows.length} providers)`);
}

async function statCacheFile(cacheDir: string, key: string): Promise<{ mtime: Date } | null> {
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
  const file = path.join(cacheDir, `${hash}.txt`);
  try {
    const stats = await stat(file);
    return { mtime: stats.mtime };
  } catch {
    return null;
  }
}

function renderMarkdown(rows: Row[]): string {
  const totalRules = rows.reduce((sum, row) => sum + row.rules, 0);
  const lines: string[] = [];
  lines.push("# STATUS");
  lines.push("");
  lines.push(`Last generated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`Providers: ${rows.length} · Total rules: ${totalRules}`);
  lines.push("");
  lines.push("| Provider | ID | Categories | Aliases | Rules | Sources |");
  lines.push("|---|---|---|---|---:|---|");
  for (const row of rows) {
    const categories = row.categories.length > 0 ? row.categories.join(", ") : "-";
    const aliases = row.aliases.length > 0 ? row.aliases.join(", ") : "-";
    const sources = row.sources.length === 0
      ? "_handwritten_"
      : row.sources
          .map((source) => {
            const parts: string[] = [source.name];
            if (source.lastFetched) {
              parts.push(`fetched ${source.lastFetched}`);
            }
            if (source.staleFlag) {
              parts.push("⚠️ stale");
            }
            return parts.join(", ");
          })
          .join("; ");
    lines.push(`| ${row.name} | \`${row.id}\` | ${categories} | ${aliases} | ${row.rules} | ${sources} |`);
  }
  lines.push("");
  return lines.join("\n");
}
