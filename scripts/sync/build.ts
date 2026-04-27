import { readFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
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
} from "../rules.js";
import { parseSourceRules, type SourceParser } from "./parsers.js";
import type { RuleGroup, RuleSet } from "../types.js";

const partialRulesSchema = z
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

const commonSourceFields = {
  name: z.string().min(1),
  parser: z.enum(["classical", "mihomo-yaml", "domain-list-community"]),
  followIncludes: z.boolean().default(true),
  importAsn: z.boolean().default(true)
};

const sourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("remote-text"),
    url: z.string().url(),
    ...commonSourceFields
  }),
  z.object({
    type: z.literal("remote-html"),
    url: z.string().url(),
    selector: z.string().min(1),
    ...commonSourceFields
  }),
  z.object({
    type: z.literal("local-text"),
    path: z.string().min(1),
    ...commonSourceFields
  })
]);

const fromSourceSchema = z
  .union([z.boolean(), z.array(z.enum(ruleKeys))])
  .default(false);

export const sourceProviderSchema = z.object({
  provider: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().optional(),
  sources: z.array(sourceSchema).default([]),
  groups: z
    .array(
      z.object({
        name: z.string().min(1),
        include: partialRulesSchema.optional(),
        fromSource: fromSourceSchema
      })
    )
    .min(1),
  patch: z
    .object({
      remove: partialRulesSchema.optional()
    })
    .default({})
});

export type SourceProvider = z.infer<typeof sourceProviderSchema>;
type SourceConfig = z.infer<typeof sourceSchema>;

export interface OutputGroup {
  name: string;
  rules: Partial<RuleSet>;
}

export interface SourceProviderData {
  provider: string;
  name: string;
  description?: string;
  groups: OutputGroup[];
}

export type Fetcher = (url: string) => Promise<string>;

export interface BuildContext {
  fetcher?: Fetcher;
}

export async function buildProviderData(
  provider: SourceProvider,
  baseDir: string,
  context: BuildContext = {}
): Promise<SourceProviderData> {
  const fetcher = context.fetcher ?? defaultFetcher;
  const sourceRules = await loadSourceRules(provider.sources, baseDir, fetcher);
  const removeRules = normalizePartialRuleSet(provider.patch.remove);
  const explicitRules = mergeRuleSets(
    provider.groups.map((group) => normalizePartialRuleSet(group.include))
  );
  let remainingSourceRules = subtractRuleSet(subtractRuleSet(sourceRules, removeRules), explicitRules);

  const groups: RuleGroup[] = [];

  for (const group of provider.groups) {
    const includeRules = normalizePartialRuleSet(group.include);
    const requestedKeys = resolveFromSourceKeys(group.fromSource);
    const sourceGroupRules = pickRuleKeys(remainingSourceRules, requestedKeys);
    let rules = mergeRuleSets([includeRules, sourceGroupRules]);
    rules = subtractRuleSet(rules, removeRules);

    groups.push({
      name: group.name,
      rules
    });

    if (requestedKeys.length > 0) {
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

function resolveFromSourceKeys(value: boolean | RuleKey[]): RuleKey[] {
  if (value === true) {
    return [...ruleKeys];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

async function loadSourceRules(
  sources: SourceConfig[],
  baseDir: string,
  fetcher: Fetcher
): Promise<RuleSet> {
  const textCache = new Map<string, Promise<string>>();
  const rules = await Promise.all(
    sources.map(async (source) => {
      const text = await loadSourceText(source, baseDir, fetcher);
      const parsed = await parseSourceRules(text, source.parser as SourceParser, {
        sourceUrl: source.type === "remote-text" || source.type === "remote-html" ? source.url : undefined,
        followIncludes: source.followIncludes,
        fetchText: async (url) => {
          const cached = textCache.get(url);
          if (cached) {
            return cached;
          }

          const fetched = fetcher(url);
          textCache.set(url, fetched);
          return fetched;
        }
      });

      if (!source.importAsn) {
        parsed.asn = [];
      }

      return parsed;
    })
  );

  return mergeRuleSets(rules);
}

async function loadSourceText(
  source: SourceConfig,
  baseDir: string,
  fetcher: Fetcher
): Promise<string> {
  if (source.type === "local-text") {
    return readFile(path.resolve(baseDir, source.path), "utf8");
  }

  const text = await fetcher(source.url);
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

async function defaultFetcher(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
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
