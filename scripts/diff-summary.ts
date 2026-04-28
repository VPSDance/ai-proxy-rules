#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Command } from "commander";
import { countRulesFromText } from "./checks/guard.js";

const exec = promisify(execFile);

interface DiffOptions {
  input: string;
  ref: string;
  max: string;
}

const program = new Command();

program
  .name("diff-summary")
  .description("Print a one-line summary of rule count changes between current data/providers and a git ref.")
  .option("-i, --input <dir>", "provider data directory", "data/providers")
  .option("-r, --ref <ref>", "git ref to compare against", "HEAD")
  .option("--max <n>", "maximum providers to list before truncating", "12")
  .action(async (options: DiffOptions) => {
    console.log(await diffSummary(options));
  });

await program.parseAsync();

async function diffSummary(options: DiffOptions): Promise<string> {
  const max = Number.parseInt(options.max, 10);
  const entries = await readdir(options.input, { withFileTypes: true });
  const yamlNames = entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const newSet = new Set(yamlNames);
  const oldNames = await listFilesAtRef(options.ref, options.input);

  const allNames = new Set<string>([...newSet, ...oldNames]);
  const changes: { id: string; delta: number; newCount: number }[] = [];

  for (const fileName of allNames) {
    const id = fileName.replace(/\.ya?ml$/i, "");
    const relPath = path.join(options.input, fileName).replace(/\\/g, "/");
    const newCount = newSet.has(fileName) ? countRulesFromText(await readFile(relPath, "utf8")) : 0;
    const oldRaw = await getFileAtRef(options.ref, relPath);
    const oldCount = oldRaw ? countRulesFromText(oldRaw) : 0;
    const delta = newCount - oldCount;
    if (delta === 0) {
      continue;
    }
    changes.push({ id, delta, newCount });
  }

  if (changes.length === 0) {
    return "no rule changes";
  }

  changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const head = changes.slice(0, max).map(({ id, delta }) => `${id} ${delta > 0 ? "+" : ""}${delta}`);
  const tail = changes.length > max ? `, +${changes.length - max} more` : "";
  return head.join(", ") + tail;
}

async function listFilesAtRef(ref: string, dir: string): Promise<Set<string>> {
  const norm = dir.replace(/\\/g, "/");
  try {
    const { stdout } = await exec("git", ["ls-tree", "--name-only", `${ref}:${norm}`], { maxBuffer: 1 * 1024 * 1024 });
    return new Set(
      stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /\.ya?ml$/i.test(line))
    );
  } catch {
    return new Set();
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
