#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Command } from "commander";
import { parse } from "yaml";

const exec = promisify(execFile);

interface GuardOptions {
  input: string;
  threshold: string;
  ref: string;
}

const program = new Command();

program
  .name("guard-provider-data")
  .description("Detect suspicious mass deletions of rules between current data/providers and the previous git ref.")
  .option("-i, --input <dir>", "provider data directory", "data/providers")
  .option("-t, --threshold <pct>", "fail when a provider loses more than this percent of rules", "30")
  .option("-r, --ref <ref>", "git ref to compare against", "HEAD")
  .action(async (options: GuardOptions) => {
    await guard(options);
  });

await program.parseAsync();

async function guard(options: GuardOptions): Promise<void> {
  const threshold = Number.parseFloat(options.threshold);
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 100) {
    throw new Error(`Invalid threshold: ${options.threshold}`);
  }

  const entries = await readdir(options.input, { withFileTypes: true });
  const yamlFiles = entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const failures: string[] = [];
  const isGithubActions = process.env.GITHUB_ACTIONS === "true";

  for (const fileName of yamlFiles) {
    const relPath = path.join(options.input, fileName).replace(/\\/g, "/");
    const newCount = await countRulesFromFile(relPath);
    const oldRaw = await getFileAtRef(options.ref, relPath);

    if (oldRaw === null) {
      continue;
    }

    const oldCount = countRulesFromText(oldRaw);
    if (oldCount === 0) {
      continue;
    }

    const dropPct = ((oldCount - newCount) / oldCount) * 100;
    if (dropPct > threshold) {
      const message = `${relPath}: ${oldCount} → ${newCount} rules (-${dropPct.toFixed(1)}%, threshold ${threshold}%)`;
      failures.push(message);
      if (isGithubActions) {
        console.log(`::error::Guard failed for ${message}`);
      } else {
        console.error(`[guard] ${message}`);
      }
    } else {
      const delta = newCount - oldCount;
      const sign = delta >= 0 ? "+" : "";
      console.log(`[guard] ${relPath}: ${oldCount} → ${newCount} (${sign}${delta})`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Guard failed: ${failures.length} provider(s) lost more than ${threshold}% of rules. Review the diff and either fix the upstream issue or rerun with --threshold to override.`
    );
  }
}

async function getFileAtRef(ref: string, relPath: string): Promise<string | null> {
  try {
    const { stdout } = await exec("git", ["show", `${ref}:${relPath}`], { maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch {
    return null;
  }
}

async function countRulesFromFile(filePath: string): Promise<number> {
  return countRulesFromText(await readFile(filePath, "utf8"));
}

function countRulesFromText(text: string): number {
  const parsed = parse(text) as
    | {
        groups?: Array<{
          rules?: {
            domain?: unknown[];
            domainSuffix?: unknown[];
            domainKeyword?: unknown[];
            domainRegex?: unknown[];
            ipCidr?: unknown[];
            ipCidr6?: unknown[];
            asn?: unknown[];
          };
        }>;
      }
    | null
    | undefined;

  if (!parsed?.groups) {
    return 0;
  }

  let count = 0;
  for (const group of parsed.groups) {
    const rules = group.rules ?? {};
    count += rules.domain?.length ?? 0;
    count += rules.domainSuffix?.length ?? 0;
    count += rules.domainKeyword?.length ?? 0;
    count += rules.domainRegex?.length ?? 0;
    count += rules.ipCidr?.length ?? 0;
    count += rules.ipCidr6?.length ?? 0;
    count += rules.asn?.length ?? 0;
  }
  return count;
}
