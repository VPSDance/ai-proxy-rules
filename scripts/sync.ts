#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { load } from "cheerio";
import { parse, stringify } from "yaml";
import { z } from "zod";
import {
  compactRuleSet,
  emptyRuleSet,
  mergeRuleSets,
  normalizeRuleSet,
  pickRuleKeys,
  removeCoveredDomains,
  ruleKeys,
  subtractRuleSet,
  type RuleKey
} from "./rules.js";
import { parseSourceRules, type SourceParser } from "./sync/parsers.js";
import type { RuleGroup, RuleSet } from "./types.js";

interface SyncOptions {
  input: string;
  output: string;
  provider: string;
}

const partialRulesSchema = z
  .object({
    domain: z.array(z.string()).default([]),
    domainSuffix: z.array(z.string()).default([]),
    domainKeyword: z.array(z.string()).default([]),
    ipCidr: z.array(z.string()).default([]),
    ipCidr6: z.array(z.string()).default([]),
    asn: z.array(z.coerce.number().int().positive()).default([])
  })
  .default({
    domain: [],
    domainSuffix: [],
    domainKeyword: [],
    ipCidr: [],
    ipCidr6: [],
    asn: []
  });

const sourceSchema = z.discriminatedUnion("type", [
  z.object({
    name: z.string().min(1),
    type: z.literal("remote-text"),
    url: z.string().url(),
    parser: z.enum(["classical", "mihomo-yaml"])
  }),
  z.object({
    name: z.string().min(1),
    type: z.literal("remote-html"),
    url: z.string().url(),
    selector: z.string().min(1),
    parser: z.enum(["classical", "mihomo-yaml"])
  }),
  z.object({
    name: z.string().min(1),
    type: z.literal("local-text"),
    path: z.string().min(1),
    parser: z.enum(["classical", "mihomo-yaml"])
  })
]);

const sourceProviderSchema = z.object({
  provider: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().optional(),
  sources: z.array(sourceSchema).default([]),
  options: z
    .object({
      importAsnFromSource: z.boolean().default(true)
    })
    .default({
      importAsnFromSource: true
    }),
  groups: z
    .array(
      z.object({
        name: z.string().min(1),
        include: partialRulesSchema.optional(),
        fromSource: z.boolean().default(false),
        fromSourceTypes: z.array(z.enum(ruleKeys)).default([])
      })
    )
    .min(1),
  patch: z
    .object({
      remove: partialRulesSchema.optional()
    })
    .default({})
});

type SourceProvider = z.infer<typeof sourceProviderSchema>;
type SourceConfig = z.infer<typeof sourceSchema>;

const program = new Command();

program
  .name("sync-provider-data")
  .description("Sync normalized provider data from upstream sources and local patches.")
  .option("-i, --input <dir>", "source provider directory", "sources/providers")
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
  return sourceProviderSchema.parse(parse(raw));
}

async function buildProviderData(provider: SourceProvider, baseDir: string): Promise<SourceProviderData> {
  const sourceRules = await loadSourceRules(provider.sources, baseDir, provider.options.importAsnFromSource);
  const removeRules = normalizePartialRuleSet(provider.patch.remove);
  const explicitRules = mergeRuleSets(
    provider.groups.map((group) => normalizePartialRuleSet(group.include))
  );
  let remainingSourceRules = subtractRuleSet(subtractRuleSet(sourceRules, removeRules), explicitRules);

  const groups: RuleGroup[] = [];

  for (const group of provider.groups) {
    const includeRules = normalizePartialRuleSet(group.include);
    const sourceGroupRules = group.fromSource
      ? remainingSourceRules
      : pickRuleKeys(remainingSourceRules, group.fromSourceTypes as RuleKey[]);
    let rules = mergeRuleSets([includeRules, sourceGroupRules]);
    rules = subtractRuleSet(rules, removeRules);

    groups.push({
      name: group.name,
      rules
    });

    if (group.fromSource || group.fromSourceTypes.length > 0) {
      remainingSourceRules = subtractRuleSet(remainingSourceRules, sourceGroupRules);
    }
  }

  const normalizedGroups = compactGroups(removeCoveredDomains(groups.map((group) => group.rules)), groups);

  return {
    provider: provider.provider,
    name: provider.name,
    description: provider.description,
    groups: normalizedGroups
  };
}

async function loadSourceRules(
  sources: SourceConfig[],
  baseDir: string,
  importAsnFromSource: boolean
): Promise<RuleSet> {
  const rules = await Promise.all(
    sources.map(async (source) => {
      const text = await loadSourceText(source, baseDir);
      const parsed = parseSourceRules(text, source.parser as SourceParser);

      if (!importAsnFromSource) {
        parsed.asn = [];
      }

      return parsed;
    })
  );

  return mergeRuleSets(rules);
}

async function loadSourceText(source: SourceConfig, baseDir: string): Promise<string> {
  if (source.type === "local-text") {
    return readFile(path.resolve(baseDir, source.path), "utf8");
  }

  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.url}: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  if (source.type === "remote-text") {
    return text;
  }

  const $ = load(text);
  const nodes = $(source.selector);
  if (nodes.length === 0) {
    throw new Error(`Selector "${source.selector}" matched no nodes in ${source.url}`);
  }

  return nodes
    .map((_, element) => $(element).text())
    .get()
    .join("\n");
}

function compactGroups(rulesByIndex: RuleSet[], groups: RuleGroup[]): OutputGroup[] {
  return groups.map((group, index) => ({
    name: group.name,
    rules: compactRuleSet(rulesByIndex[index] ?? emptyRuleSet())
  }));
}

function normalizePartialRuleSet(rules: Partial<RuleSet> | undefined): RuleSet {
  return normalizeRuleSet({
    ...emptyRuleSet(),
    ...rules
  });
}

function stringifyProviderData(provider: SourceProviderData): string {
  return `${stringify(provider, {
    lineWidth: 0,
    sortMapEntries: false
  })}`;
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

interface OutputGroup {
  name: string;
  rules: Partial<RuleSet>;
}

interface SourceProviderData {
  provider: string;
  name: string;
  description?: string;
  groups: OutputGroup[];
}
