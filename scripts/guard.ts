#!/usr/bin/env node
import { Command } from "commander";
import { evaluateGuard } from "./checks/guard.js";

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
  const isGithubActions = process.env.GITHUB_ACTIONS === "true";
  const result = await evaluateGuard({
    input: options.input,
    threshold: Number.parseFloat(options.threshold),
    ref: options.ref
  });

  for (const entry of result.inspected) {
    const delta = entry.newCount - entry.oldCount;
    const sign = delta >= 0 ? "+" : "";
    console.log(`[guard] ${entry.relPath}: ${entry.oldCount} → ${entry.newCount} (${sign}${delta})`);
  }

  for (const fail of result.failures) {
    const message = `${fail.relPath}: ${fail.oldCount} → ${fail.newCount} rules (-${fail.dropPct.toFixed(1)}%, threshold ${options.threshold}%)`;
    if (isGithubActions) {
      console.log(`::error::Guard failed for ${message}`);
    } else {
      console.error(`[guard] ${message}`);
    }
  }

  if (!result.ok) {
    throw new Error(
      `Guard failed: ${result.failures.length} provider(s) lost more than ${options.threshold}% of rules. Review the diff and either fix the upstream issue or rerun with --threshold to override.`
    );
  }
}
