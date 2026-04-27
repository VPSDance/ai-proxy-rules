#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { parse } from "yaml";

interface CheckOptions {
  sources: string;
  readme: string;
}

const program = new Command();

program
  .name("check-readme")
  .description("Verify README provider list matches data/sources/.")
  .option("-s, --sources <dir>", "provider source directory", "data/sources")
  .option("-r, --readme <file>", "README file", "README.md")
  .action(async (options: CheckOptions) => {
    await check(options);
  });

await program.parseAsync();

async function check(options: CheckOptions): Promise<void> {
  const sourceIds = await collectSourceIds(options.sources);
  const readmeIds = collectReadmeIds(await readFile(options.readme, "utf8"));

  const missingInReadme = [...sourceIds].filter((id) => !readmeIds.has(id)).sort();
  const stalenInReadme = [...readmeIds].filter((id) => !sourceIds.has(id)).sort();

  const errors: string[] = [];
  if (missingInReadme.length > 0) {
    errors.push(
      `${options.readme} is missing ${missingInReadme.length} provider(s) present in ${options.sources}: ${missingInReadme.join(", ")}`
    );
  }
  if (stalenInReadme.length > 0) {
    errors.push(
      `${options.readme} mentions ${stalenInReadme.length} provider(s) not present in ${options.sources}: ${stalenInReadme.join(", ")}`
    );
  }

  if (errors.length > 0) {
    const isGithubActions = process.env.GITHUB_ACTIONS === "true";
    for (const message of errors) {
      if (isGithubActions) {
        console.log(`::error::${message}`);
      } else {
        console.error(`[check-readme] ${message}`);
      }
    }
    throw new Error("README is out of sync with data/sources/. Update README provider list.");
  }

  console.log(`[check-readme] OK — ${sourceIds.size} provider(s) in sync.`);
}

async function collectSourceIds(sourcesDir: string): Promise<Set<string>> {
  const entries = await readdir(sourcesDir, { withFileTypes: true });
  const yamlFiles = entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => path.join(sourcesDir, entry.name));

  const ids = new Set<string>();
  for (const file of yamlFiles) {
    const raw = await readFile(file, "utf8");
    const parsed = parse(raw) as { provider?: unknown };
    if (typeof parsed?.provider !== "string") {
      throw new Error(`Source file ${file} is missing a string "provider" field.`);
    }
    ids.add(parsed.provider);
  }
  return ids;
}

function collectReadmeIds(text: string): Set<string> {
  const startMarker = "规则覆盖范围：";
  const endMarker = "支持的客户端格式：";
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error('Could not locate provider list section between "规则覆盖范围：" and "支持的客户端格式：" in README.');
  }

  const section = text.slice(startIdx + startMarker.length, endIdx);
  const ids = new Set<string>();
  for (const match of section.matchAll(/\(`([a-z0-9][a-z0-9-]*)`\)/g)) {
    ids.add(match[1]!);
  }
  return ids;
}
