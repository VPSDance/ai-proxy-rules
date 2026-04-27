import { parse } from "yaml";
import { emptyRuleSet, normalizeRuleSet } from "../rules.js";
import type { RuleSet } from "../types.js";

export type SourceParser = "classical" | "mihomo-yaml" | "domain-list-community";

export interface ParseSourceOptions {
  sourceUrl?: string;
  fetchText?: (url: string) => Promise<string>;
  followIncludes?: boolean;
}

export async function parseSourceRules(
  text: string,
  parser: SourceParser,
  options: ParseSourceOptions = {}
): Promise<RuleSet> {
  if (parser === "mihomo-yaml") {
    return parseMihomoYamlRules(text);
  }

  if (parser === "domain-list-community") {
    return parseDomainListCommunityRules(text, options);
  }

  return parseClassicalRules(text);
}

export function parseClassicalRules(text: string): RuleSet {
  const rules = emptyRuleSet();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = normalizeLine(rawLine);
    if (!line || line.startsWith("#") || /^payload\s*:/i.test(line)) {
      continue;
    }

    const [rawType, rawValue] = line.split(",");
    if (!rawType || !rawValue) {
      continue;
    }

    const type = rawType.trim().toUpperCase();
    const value = stripQuotes(rawValue.trim());

    switch (type) {
      case "DOMAIN":
      case "HOST":
        rules.domain.push(value);
        break;
      case "DOMAIN-SUFFIX":
      case "HOST-SUFFIX":
        rules.domainSuffix.push(value);
        break;
      case "DOMAIN-KEYWORD":
      case "HOST-KEYWORD":
        rules.domainKeyword.push(value);
        break;
      case "DOMAIN-REGEX":
      case "URL-REGEX":
      case "HOST-WILDCARD":
        rules.domainRegex.push(value);
        break;
      case "IP-CIDR":
        rules.ipCidr.push(value);
        break;
      case "IP-CIDR6":
      case "IP6-CIDR":
        rules.ipCidr6.push(value);
        break;
      case "IP-ASN": {
        const asn = Number.parseInt(value.replace(/^AS/i, ""), 10);
        if (Number.isInteger(asn) && asn > 0) {
          rules.asn.push(asn);
        }
        break;
      }
    }
  }

  return normalizeRuleSet(rules);
}

function parseMihomoYamlRules(text: string): RuleSet {
  const parsed = parse(text) as unknown;

  if (isPayloadObject(parsed)) {
    return parseClassicalRules(parsed.payload.join("\n"));
  }

  if (Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string")) {
    return parseClassicalRules(parsed.join("\n"));
  }

  throw new Error("Mihomo YAML source must contain a string payload list.");
}

export async function parseDomainListCommunityRules(
  text: string,
  options: ParseSourceOptions = {},
  visited: Set<string> = new Set()
): Promise<RuleSet> {
  const rules = emptyRuleSet();
  const baseUrl = options.sourceUrl ? new URL(".", options.sourceUrl).toString() : undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = normalizeDomainListLine(rawLine);
    if (!line || line.startsWith("#")) {
      continue;
    }

    if (line.startsWith("include:")) {
      if (options.followIncludes === false) {
        continue;
      }

      const includeName = line.slice("include:".length).trim();
      if (!includeName) {
        continue;
      }

      if (!options.fetchText) {
        throw new Error(`Cannot resolve include "${includeName}" without fetchText`);
      }

      if (!baseUrl) {
        throw new Error(`Cannot resolve include "${includeName}" without sourceUrl`);
      }

      const includeUrl = new URL(includeName, baseUrl).toString();
      if (visited.has(includeUrl)) {
        continue;
      }

      visited.add(includeUrl);
      const includeText = await options.fetchText(includeUrl);
      const included = await parseDomainListCommunityRules(includeText, {
        ...options,
        sourceUrl: includeUrl
      }, visited);
      mergeInto(rules, included);
      continue;
    }

    const [prefix, rawValue] = splitDomainListEntry(line);
    if (!rawValue) {
      continue;
    }

    if (!hasOnlyAllowedTags(rawValue)) {
      continue;
    }

    const value = stripTrailingTags(rawValue);

    switch (prefix) {
      case "full":
        rules.domain.push(value);
        break;
      case "keyword":
        rules.domainKeyword.push(value);
        break;
      case "regexp":
        rules.domainRegex.push(value);
        break;
      default:
        rules.domainSuffix.push(value);
        break;
    }
  }

  return normalizeRuleSet(rules);
}

function normalizeLine(line: string): string {
  return stripQuotes(line.trim().replace(/^-\s+/, ""));
}

function normalizeDomainListLine(line: string): string {
  return line.trim();
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}

function splitDomainListEntry(line: string): [string, string] {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) {
    return ["", line];
  }

  return [line.slice(0, colonIndex).trim().toLowerCase(), line.slice(colonIndex + 1).trim()];
}

const ALLOWED_TAGS = new Set(["!cn"]);

function stripTrailingTags(value: string): string {
  const [clean = ""] = value.split(/\s+@/);
  return clean.trim();
}

function hasOnlyAllowedTags(value: string): boolean {
  const parts = value.split(/\s+/).slice(1);
  return parts
    .filter((part) => part.startsWith("@"))
    .every((part) => ALLOWED_TAGS.has(part.slice(1).toLowerCase()));
}

function mergeInto(target: RuleSet, source: RuleSet): void {
  target.domain.push(...source.domain);
  target.domainSuffix.push(...source.domainSuffix);
  target.domainKeyword.push(...source.domainKeyword);
  target.domainRegex.push(...source.domainRegex);
  target.ipCidr.push(...source.ipCidr);
  target.ipCidr6.push(...source.ipCidr6);
  target.asn.push(...source.asn);
}

function isPayloadObject(value: unknown): value is { payload: string[] } {
  if (!value || typeof value !== "object" || !("payload" in value)) {
    return false;
  }

  const payload = (value as { payload: unknown }).payload;
  return Array.isArray(payload) && payload.every((item) => typeof item === "string");
}
