import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import type { ProviderSource, RenderTarget, RuleSet } from "./types.js";

const rulesSchema = z
  .object({
    domain: z.array(z.string()).default([]),
    domainSuffix: z.array(z.string()).default([]),
    domainKeyword: z.array(z.string()).default([]),
    ipCidr: z.array(z.string()).default([]),
    ipCidr6: z.array(z.string()).default([])
  })
  .default({
    domain: [],
    domainSuffix: [],
    domainKeyword: [],
    ipCidr: [],
    ipCidr6: []
  });

const providerSchema = z.object({
  provider: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().optional(),
  rules: rulesSchema
});

export async function loadProvider(inputDir: string, provider: string): Promise<ProviderSource> {
  const filePath = path.join(inputDir, `${provider}.yaml`);
  return parseProviderFile(filePath);
}

export async function loadAllProviders(inputDir: string): Promise<ProviderSource[]> {
  const entries = await readdir(inputDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => path.join(inputDir, entry.name))
    .sort();

  const providers = await Promise.all(files.map((file) => parseProviderFile(file)));
  return providers.sort((a, b) => a.provider.localeCompare(b.provider));
}

export function aggregateProviders(providers: ProviderSource[]): RenderTarget {
  return {
    id: "all",
    name: "All AI Providers",
    description: "Aggregated AI provider rules.",
    rules: mergeRuleSets(providers.map((provider) => provider.rules))
  };
}

export function providerToTarget(provider: ProviderSource): RenderTarget {
  return {
    id: provider.provider,
    name: provider.name,
    description: provider.description,
    rules: provider.rules
  };
}

export function mergeRuleSets(ruleSets: RuleSet[]): RuleSet {
  return normalizeRuleSet({
    domain: ruleSets.flatMap((rules) => rules.domain),
    domainSuffix: ruleSets.flatMap((rules) => rules.domainSuffix),
    domainKeyword: ruleSets.flatMap((rules) => rules.domainKeyword),
    ipCidr: ruleSets.flatMap((rules) => rules.ipCidr),
    ipCidr6: ruleSets.flatMap((rules) => rules.ipCidr6)
  });
}

async function parseProviderFile(filePath: string): Promise<ProviderSource> {
  const raw = await readFile(filePath, "utf8");
  const parsed = providerSchema.parse(parse(raw));
  return {
    ...parsed,
    rules: normalizeRuleSet(parsed.rules)
  };
}

function normalizeRuleSet(rules: RuleSet): RuleSet {
  return {
    domain: normalizeDnsRules(rules.domain),
    domainSuffix: normalizeDnsRules(rules.domainSuffix),
    domainKeyword: normalizeTextRules(rules.domainKeyword),
    ipCidr: normalizeTextRules(rules.ipCidr),
    ipCidr6: normalizeTextRules(rules.ipCidr6)
  };
}

function normalizeDnsRules(values: string[]): string[] {
  return normalizeTextRules(values.map((value) => value.toLowerCase()));
}

function normalizeTextRules(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}
