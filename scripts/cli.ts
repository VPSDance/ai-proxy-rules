#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import {
  aggregateProviders,
  aggregateProvidersByCategory,
  loadAllProviders,
  loadProvider,
  providerToTarget
} from "./data.js";
import { render } from "./generators/index.js";
import { formats, type Format, type ProviderSource, type RenderTarget } from "./types.js";

interface GenerateOptions {
  input: string;
  output: string;
  provider: string;
  format: string;
}

const program = new Command();

program
  .name("ai-proxy-rules")
  .description("Generate AI proxy rules from structured provider sources.")
  .version("0.1.0");

program
  .command("generate")
  .description("Generate client rule files.")
  .option("-i, --input <dir>", "provider data directory", "data/providers")
  .option("-o, --output <dir>", "output directory", "rules")
  .option("-p, --provider <names>", "comma-separated provider names or all", "all")
  .option("-f, --format <names>", "comma-separated formats or all", "all")
  .action(async (options: GenerateOptions) => {
    await generate(options);
  });

await program.parseAsync();

async function generate(options: GenerateOptions): Promise<void> {
  const selectedFormats = parseFormats(options.format);
  const providers = await selectProviders(options.input, options.provider);
  const targets = buildTargets(providers, options.provider);

  const writes: string[] = [];

  for (const target of targets) {
    for (const format of selectedFormats) {
      const file = render(format, target);
      const outDir = path.join(options.output, file.format);
      const outPath = path.join(outDir, `${target.id}.${file.extension}`);
      await mkdir(outDir, { recursive: true });
      await writeFile(outPath, file.content, "utf8");
      writes.push(outPath);
    }
  }

  for (const filePath of writes) {
    console.log(filePath);
  }
}

async function selectProviders(inputDir: string, providerOption: string): Promise<ProviderSource[]> {
  const providerNames = parseCsv(providerOption);

  if (providerNames.includes("all")) {
    return loadAllProviders(inputDir);
  }

  const providers = await Promise.all(
    providerNames.map((providerName) => loadProvider(inputDir, providerName))
  );

  return providers.sort((a, b) => a.provider.localeCompare(b.provider));
}

function buildTargets(providers: ProviderSource[], providerOption: string): RenderTarget[] {
  const providerTargets = providers.map(providerToTarget);
  const providerNames = parseCsv(providerOption);

  if (providerNames.includes("all") || providers.length > 1) {
    return [...providerTargets, ...aggregateProvidersByCategory(providers), aggregateProviders(providers)];
  }

  return providerTargets;
}

function parseFormats(formatOption: string): Format[] {
  const selected = parseCsv(formatOption);

  if (selected.includes("all")) {
    return [...formats];
  }

  const invalid = selected.filter((format): format is string => !isFormat(format));
  if (invalid.length > 0) {
    throw new Error(`Invalid format: ${invalid.join(", ")}`);
  }

  return selected.filter(isFormat);
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isFormat(value: string): value is Format {
  return formats.includes(value as Format);
}
