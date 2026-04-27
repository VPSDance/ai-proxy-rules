import type { RuleSet } from "./types.js";

export const ruleKeys = [
  "domain",
  "domainSuffix",
  "domainKeyword",
  "ipCidr",
  "ipCidr6",
  "asn"
] as const;

export type RuleKey = (typeof ruleKeys)[number];

export function emptyRuleSet(): RuleSet {
  return {
    domain: [],
    domainSuffix: [],
    domainKeyword: [],
    ipCidr: [],
    ipCidr6: [],
    asn: []
  };
}

export function mergeRuleSets(ruleSets: RuleSet[]): RuleSet {
  return normalizeRuleSet({
    domain: ruleSets.flatMap((rules) => rules.domain),
    domainSuffix: ruleSets.flatMap((rules) => rules.domainSuffix),
    domainKeyword: ruleSets.flatMap((rules) => rules.domainKeyword),
    ipCidr: ruleSets.flatMap((rules) => rules.ipCidr),
    ipCidr6: ruleSets.flatMap((rules) => rules.ipCidr6),
    asn: ruleSets.flatMap((rules) => rules.asn)
  });
}

export function normalizeRuleSet(rules: RuleSet): RuleSet {
  return {
    domain: normalizeDnsRules(rules.domain),
    domainSuffix: normalizeDnsRules(rules.domainSuffix),
    domainKeyword: normalizeTextRules(rules.domainKeyword),
    ipCidr: normalizeTextRules(rules.ipCidr),
    ipCidr6: normalizeTextRules(rules.ipCidr6),
    asn: normalizeAsnRules(rules.asn)
  };
}

export function subtractRuleSet(source: RuleSet, remove: RuleSet): RuleSet {
  const normalizedSource = normalizeRuleSet(source);
  const normalizedRemove = normalizeRuleSet(remove);

  return normalizeRuleSet({
    domain: removeValues(normalizedSource.domain, normalizedRemove.domain),
    domainSuffix: removeValues(normalizedSource.domainSuffix, normalizedRemove.domainSuffix),
    domainKeyword: removeValues(normalizedSource.domainKeyword, normalizedRemove.domainKeyword),
    ipCidr: removeValues(normalizedSource.ipCidr, normalizedRemove.ipCidr),
    ipCidr6: removeValues(normalizedSource.ipCidr6, normalizedRemove.ipCidr6),
    asn: removeValues(normalizedSource.asn, normalizedRemove.asn)
  });
}

export function pickRuleKeys(rules: RuleSet, keys: RuleKey[]): RuleSet {
  const picked = emptyRuleSet();

  for (const key of keys) {
    picked[key] = [...rules[key]] as never;
  }

  return normalizeRuleSet(picked);
}

export function removeCoveredDomains(ruleSets: RuleSet[]): RuleSet[] {
  const suffixes = mergeRuleSets(ruleSets).domainSuffix;

  return ruleSets.map((rules) =>
    normalizeRuleSet({
      ...rules,
      domain: rules.domain.filter(
        (domain) => !suffixes.some((suffix) => isDomainCoveredBySuffix(domain, suffix))
      )
    })
  );
}

export function compactRuleSet(rules: RuleSet): Partial<RuleSet> {
  const normalized = normalizeRuleSet(rules);
  const compacted: Partial<RuleSet> = {};

  for (const key of ruleKeys) {
    if (normalized[key].length > 0) {
      compacted[key] = normalized[key] as never;
    }
  }

  return compacted;
}

function isDomainCoveredBySuffix(domain: string, suffix: string): boolean {
  return domain === suffix || domain.endsWith(`.${suffix}`);
}

function normalizeDnsRules(values: string[]): string[] {
  return normalizeTextRules(values.map((value) => value.toLowerCase()));
}

function normalizeTextRules(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function normalizeAsnRules(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function removeValues<T>(source: T[], remove: T[]): T[] {
  const removeSet = new Set(remove);
  return source.filter((value) => !removeSet.has(value));
}
