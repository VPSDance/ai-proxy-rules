import { parse } from "yaml";
import { emptyRuleSet, normalizeRuleSet } from "../rules.js";
import type { RuleSet } from "../types.js";

export type SourceParser = "classical" | "mihomo-yaml";

export function parseSourceRules(text: string, parser: SourceParser): RuleSet {
  if (parser === "mihomo-yaml") {
    return parseMihomoYamlRules(text);
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

function normalizeLine(line: string): string {
  return stripQuotes(line.trim().replace(/^-\s+/, ""));
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}

function isPayloadObject(value: unknown): value is { payload: string[] } {
  if (!value || typeof value !== "object" || !("payload" in value)) {
    return false;
  }

  const payload = (value as { payload: unknown }).payload;
  return Array.isArray(payload) && payload.every((item) => typeof item === "string");
}
