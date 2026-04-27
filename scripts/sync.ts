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

interface SyncOptions {
  input: string;
  output: string;
  provider: string;
}

const program = new Command();

program
  .name("sync-provider-data")
  .description("Sync normalized provider data from upstream sources and local patches.")
  .option("-i, --input <dir>", "provider source directory", "data/sources")
  .option("-o, --output <dir>", "normalized provider data directory", "data/providers")
  .option("-p, --provider <names>", "comma-separated provider names or all", "all")
  .action(async (options: SyncOptions) => {
    await sync(options);
  });

await program.parseAsync();

async function sync(options: SyncOptions): Promise<void> {
  const sourceFiles = await selectSourceFiles(options.input, options.provider);
  const writes: string[] = [];

  await mkdir(options.output, { recursive: true });

  for (const sourceFile of sourceFiles) {
    const provider = await loadSourceProvider(sourceFile);
    const normalized = await buildProviderData(provider, path.dirname(sourceFile));
    const outPath = path.join(options.output, `${provider.provider}.yaml`);

    await writeFile(outPath, stringifyProviderData(normalized), "utf8");
    writes.push(outPath);
  }

  for (const filePath of writes) {
    console.log(filePath);
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
