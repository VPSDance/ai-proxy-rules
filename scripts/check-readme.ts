#!/usr/bin/env node
import { Command } from "commander";
import { checkReadme } from "./checks/readme.js";

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
    await run(options);
  });

await program.parseAsync();

async function run(options: CheckOptions): Promise<void> {
  const result = await checkReadme(options.sources, options.readme);
  const isGithubActions = process.env.GITHUB_ACTIONS === "true";
  const errors: string[] = [];

  if (result.missingInReadme.length > 0) {
    errors.push(
      `${options.readme} is missing ${result.missingInReadme.length} provider(s) present in ${options.sources}: ${result.missingInReadme.join(", ")}`
    );
  }
  if (result.staleInReadme.length > 0) {
    errors.push(
      `${options.readme} mentions ${result.staleInReadme.length} provider(s) not present in ${options.sources}: ${result.staleInReadme.join(", ")}`
    );
  }

  if (errors.length > 0) {
    for (const message of errors) {
      if (isGithubActions) {
        console.log(`::error::${message}`);
      } else {
        console.error(`[check-readme] ${message}`);
      }
    }
    throw new Error("README is out of sync with data/sources/. Update README provider list.");
  }

  console.log(`[check-readme] OK — ${result.sourceCount} provider(s) in sync.`);
}
