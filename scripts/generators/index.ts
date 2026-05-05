import type { Format, RenderedFile, RenderTarget, RuleSet } from "../types.js";

const REPO_URL = "https://github.com/VPSDance/ai-proxy-rules";

export function render(format: Format, target: RenderTarget): RenderedFile {
  switch (format) {
    case "surge":
      return {
        format,
        extension: "list",
        content: renderSurge(target)
      };
    case "clash":
      return {
        format,
        extension: "yaml",
        content: renderClash(target)
      };
    case "sing-box":
      return {
        format,
        extension: "json",
        content: renderSingBox(target)
      };
    case "quantumult-x":
      return {
        format,
        extension: "list",
        content: renderQuantumultX(target)
      };
    case "loon":
      return {
        format,
        extension: "list",
        content: renderLoon(target)
      };
    case "shadowrocket":
      return {
        format,
        extension: "list",
        content: renderShadowrocket(target)
      };
    case "stash":
      return {
        format,
        extension: "list",
        content: renderStash(target)
      };
    case "egern":
      return {
        format,
        extension: "yaml",
        content: renderEgern(target)
      };
  }
}

function renderSurge(target: RenderTarget): string {
  return withHeader(
    target,
    renderGroupedLines(target, (rules) => [
      ...rules.domain.map((value) => `DOMAIN,${value}`),
      ...rules.domainSuffix.map((value) => `DOMAIN-SUFFIX,${value}`),
      ...rules.domainKeyword.map((value) => `DOMAIN-KEYWORD,${value}`),
      ...rules.ipCidr.map((value) => `IP-CIDR,${value},no-resolve`),
      ...rules.ipCidr6.map((value) => `IP-CIDR6,${value},no-resolve`),
      ...rules.asn.map((value) => `IP-ASN,${value},no-resolve`)
    ])
  );
}

function renderClash(target: RenderTarget): string {
  const lines = renderGroupedLines(target, (rules) => [
    ...rules.domain.map((value) => `- DOMAIN,${value}`),
    ...rules.domainSuffix.map((value) => `- DOMAIN-SUFFIX,${value}`),
    ...rules.domainKeyword.map((value) => `- DOMAIN-KEYWORD,${value}`),
    ...rules.domainRegex.map((value) => `- DOMAIN-REGEX,${value}`),
    ...rules.ipCidr.map((value) => `- IP-CIDR,${value},no-resolve`),
    ...rules.ipCidr6.map((value) => `- IP-CIDR6,${value},no-resolve`),
    ...rules.asn.map((value) => `- IP-ASN,${value},no-resolve`)
  ]).map((line) => (line ? `  ${line}` : ""));

  return [...headerLines(target), "payload:", ...lines, ""].join("\n");
}

function renderSingBox(target: RenderTarget): string {
  const rule: Record<string, string[]> = {};

  assignIfAny(rule, "domain", target.rules.domain);
  assignIfAny(rule, "domain_suffix", target.rules.domainSuffix);
  assignIfAny(rule, "domain_keyword", target.rules.domainKeyword);
  assignIfAny(rule, "domain_regex", target.rules.domainRegex);
  assignIfAny(rule, "ip_cidr", [...target.rules.ipCidr, ...target.rules.ipCidr6]);

  return `${JSON.stringify({ version: 2, rules: [rule] }, null, 2)}\n`;
}

function renderQuantumultX(target: RenderTarget): string {
  return withHeader(
    target,
    renderGroupedLines(target, (rules) => [
      ...rules.domain.map((value) => `HOST,${value}`),
      ...rules.domainSuffix.map((value) => `HOST-SUFFIX,${value}`),
      ...rules.domainKeyword.map((value) => `HOST-KEYWORD,${value}`),
      ...rules.ipCidr.map((value) => `IP-CIDR,${value},no-resolve`),
      ...rules.ipCidr6.map((value) => `IP6-CIDR,${value},no-resolve`),
      ...rules.asn.map((value) => `IP-ASN,${value},no-resolve`)
    ])
  );
}

function renderLoon(target: RenderTarget): string {
  return withHeader(
    target,
    renderGroupedLines(target, (rules) => [
      ...rules.domain.map((value) => `DOMAIN,${value}`),
      ...rules.domainSuffix.map((value) => `DOMAIN-SUFFIX,${value}`),
      ...rules.domainKeyword.map((value) => `DOMAIN-KEYWORD,${value}`),
      ...rules.ipCidr.map((value) => `IP-CIDR,${value},no-resolve`),
      ...rules.ipCidr6.map((value) => `IP-CIDR6,${value},no-resolve`),
      ...rules.asn.map((value) => `IP-ASN,${value},no-resolve`)
    ])
  );
}

function renderShadowrocket(target: RenderTarget): string {
  return withHeader(
    target,
    renderGroupedLines(target, (rules) => [
      ...rules.domain.map((value) => `DOMAIN,${value}`),
      ...rules.domainSuffix.map((value) => `DOMAIN-SUFFIX,${value}`),
      ...rules.domainKeyword.map((value) => `DOMAIN-KEYWORD,${value}`),
      ...rules.ipCidr.map((value) => `IP-CIDR,${value},no-resolve`),
      ...rules.ipCidr6.map((value) => `IP-CIDR6,${value},no-resolve`),
      ...rules.asn.map((value) => `IP-ASN,${value},no-resolve`)
    ])
  );
}

function renderStash(target: RenderTarget): string {
  return withHeader(
    target,
    renderGroupedLines(target, (rules) => [
      ...rules.domain.map((value) => `DOMAIN,${value}`),
      ...rules.domainSuffix.map((value) => `DOMAIN-SUFFIX,${value}`),
      ...rules.domainKeyword.map((value) => `DOMAIN-KEYWORD,${value}`),
      ...rules.ipCidr.map((value) => `IP-CIDR,${value},no-resolve`),
      ...rules.ipCidr6.map((value) => `IP-CIDR6,${value},no-resolve`),
      ...rules.asn.map((value) => `IP-ASN,${value},no-resolve`)
    ])
  );
}

function renderEgern(target: RenderTarget): string {
  const rule: Record<string, Array<string | number>> = {};
  const hasIpRules =
    target.rules.ipCidr.length > 0 || target.rules.ipCidr6.length > 0 || target.rules.asn.length > 0;

  assignIfAny(rule, "domain_set", target.rules.domain);
  assignIfAny(rule, "domain_suffix_set", target.rules.domainSuffix);
  assignIfAny(rule, "domain_keyword_set", target.rules.domainKeyword);
  assignIfAny(rule, "domain_regex_set", target.rules.domainRegex);
  assignIfAny(rule, "ip_cidr_set", target.rules.ipCidr);
  assignIfAny(rule, "ip_cidr6_set", target.rules.ipCidr6);
  assignIfAny(
    rule,
    "asn_set",
    target.rules.asn.map((value) => `AS${value}`)
  );

  return [
    ...headerLines(target),
    ...(hasIpRules ? ["no_resolve: true"] : []),
    ...renderYamlMap(rule),
    ""
  ].join("\n");
}

function withHeader(target: RenderTarget, lines: string[]): string {
  return [...headerLines(target), ...lines, ""].join("\n");
}

function headerLines(target: RenderTarget): string[] {
  const lines = [`# AI Proxy Rules - ${target.name}`];
  if (target.description) {
    lines.push(`# ${target.description}`);
  }
  lines.push(`# ${REPO_URL}`, "");
  return lines;
}

function renderGroupedLines(
  target: RenderTarget,
  renderRules: (rules: RuleSet) => string[]
): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const group of target.groups) {
    const groupLines = renderRules(group.rules).filter((line) => {
      if (seen.has(line)) {
        return false;
      }

      seen.add(line);
      return true;
    });

    if (groupLines.length > 0) {
      if (lines.length > 0) {
        lines.push("");
      }

      lines.push(`# ${group.name}`, ...groupLines);
    }
  }

  return lines;
}

function assignIfAny<T extends string | number>(
  target: Record<string, T[]>,
  key: string,
  values: T[]
): void {
  if (values.length > 0) {
    target[key] = values;
  }
}

function renderYamlMap(rule: Record<string, Array<string | number>>): string[] {
  const lines: string[] = [];

  for (const [key, values] of Object.entries(rule)) {
    lines.push(`${key}:`);
    for (const value of values) {
      lines.push(`  - ${quoteYamlValue(value)}`);
    }
  }

  return lines;
}

function quoteYamlValue(value: string | number): string {
  if (typeof value === "number") {
    return String(value);
  }

  return JSON.stringify(value);
}
