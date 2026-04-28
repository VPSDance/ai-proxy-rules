import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { emptyRuleSet, mergeRuleSets, normalizeRuleSet } from "./rules.js";
import { providerCategories, type ProviderCategory, type ProviderSource, type RenderTarget, type RuleGroup, type RuleSet } from "./types.js";

const rulesSchema = z
  .object({
    domain: z.array(z.string()).default([]),
    domainSuffix: z.array(z.string()).default([]),
    domainKeyword: z.array(z.string()).default([]),
    domainRegex: z.array(z.string()).default([]),
    ipCidr: z.array(z.string()).default([]),
    ipCidr6: z.array(z.string()).default([]),
    asn: z.array(z.coerce.number().int().positive()).default([])
  })
  .default({
    domain: [],
    domainSuffix: [],
    domainKeyword: [],
    domainRegex: [],
    ipCidr: [],
    ipCidr6: [],
    asn: []
  });

const providerSchema = z.object({
  provider: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(providerCategories).default("assistant"),
  aliases: z.array(z.string().min(1)).default([]),
  allowDangerousDomainSuffix: z.array(z.string().min(1)).default([]),
  rules: rulesSchema.optional(),
  groups: z
    .array(
      z.object({
        name: z.string().min(1),
        rules: rulesSchema
      })
    )
    .optional()
}).refine((data) => data.rules || data.groups, {
  message: "Provider must define rules or groups"
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
  const groups = providers.flatMap((provider) =>
    provider.groups.map((group) => ({
      name: `${provider.name} / ${group.name}`,
      rules: group.rules
    }))
  );

  return {
    id: "all",
    name: "All AI Providers",
    description: "Aggregated AI provider rules.",
    groups,
    rules: mergeRuleSets(providers.map((provider) => provider.rules))
  };
}

export function aggregateProvidersByCategory(providers: ProviderSource[]): RenderTarget[] {
  const byCategory = new Map<ProviderCategory, ProviderSource[]>();
  for (const provider of providers) {
    const category = provider.category ?? "assistant";
    const categoryProviders = byCategory.get(category) ?? [];
    categoryProviders.push(provider);
    byCategory.set(category, categoryProviders);
  }

  return providerCategories.flatMap((category) => {
      const categoryProviders = byCategory.get(category) ?? [];
      if (categoryProviders.length === 0) {
        return [];
      }

      const groups = categoryProviders.flatMap((provider) =>
        provider.groups.map((group) => ({
          name: `${provider.name} / ${group.name}`,
          rules: group.rules
        }))
      );

      return [{
        id: category,
        name: categoryName(category),
        description: `Aggregated ${category} AI provider rules.`,
        category,
        groups,
        rules: mergeRuleSets(categoryProviders.map((provider) => provider.rules))
      }];
    });
}

export function providerToTarget(provider: ProviderSource): RenderTarget {
  return {
    id: provider.provider,
    name: provider.name,
    description: provider.description,
    category: provider.category,
    groups: provider.groups,
    rules: provider.rules
  };
}

export { mergeRuleSets };

async function parseProviderFile(filePath: string): Promise<ProviderSource> {
  const raw = await readFile(filePath, "utf8");
  const result = providerSchema.safeParse(parse(raw));
  if (!result.success) {
    throw new Error(`Invalid provider data in ${filePath}:\n${z.prettifyError(result.error)}`);
  }
  const parsed = result.data;
  const groups = normalizeRuleGroups(
    parsed.groups ?? [
      {
        name: "Rules",
        rules: parsed.rules ?? emptyRuleSet()
      }
    ]
  );

  return {
    provider: parsed.provider,
    name: parsed.name,
    description: parsed.description,
    category: parsed.category,
    aliases: parsed.aliases,
    allowDangerousDomainSuffix: parsed.allowDangerousDomainSuffix,
    groups,
    rules: mergeRuleSets(groups.map((group) => group.rules))
  };
}

function categoryName(category: ProviderCategory): string {
  switch (category) {
    case "assistant":
      return "AI Assistants";
    case "coding":
      return "AI Coding Tools";
    case "inference":
      return "AI Inference Providers";
    case "media":
      return "AI Media Tools";
    case "search":
      return "AI Search Tools";
    case "agent":
      return "AI Agent Platforms";
    case "local":
      return "Local AI Tools";
    case "productivity":
      return "AI Productivity Tools";
  }
}

function normalizeRuleGroups(groups: RuleGroup[]): RuleGroup[] {
  return groups.map((group) => ({
    name: group.name,
    rules: normalizeRuleSet(group.rules)
  }));
}
