#!/usr/bin/env node
import { Command } from "commander";
import { checkMetadata } from "./checks/metadata.js";

interface CheckOptions {
  sources: string;
}

const program = new Command();

program
  .name("check-metadata")
  .description("Verify provider source metadata is complete and unambiguous.")
  .option("-s, --sources <dir>", "provider source directory", "data/sources")
  .action(async (options: CheckOptions) => {
    await run(options);
  });

await program.parseAsync();

async function run(options: CheckOptions): Promise<void> {
  const result = await checkMetadata(options.sources);
  const isGithubActions = process.env.GITHUB_ACTIONS === "true";

  if (!result.ok) {
    for (const message of result.errors) {
      if (isGithubActions) {
        console.log(`::error::${message}`);
      } else {
        console.error(`[check-metadata] ${message}`);
      }
    }
    throw new Error("Provider metadata check failed.");
  }

  console.log(`[check-metadata] OK — ${result.sourceCount} provider(s) checked.`);
}
