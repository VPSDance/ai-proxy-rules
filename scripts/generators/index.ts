import type { Format, RenderedFile, RenderOptions, RenderTarget, RuleSet } from "../types.js";

export function render(format: Format, target: RenderTarget, options: RenderOptions): RenderedFile {
  switch (format) {
    case "surge":
      return {
        format,
        extension: "list",
        content: renderSurge(target)
      };
    case "mihomo":
      return {
        format,
        extension: "yaml",
        content: renderMihomo(target)
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
        content: renderQuantumultX(target, options)
      };
    case "loon":
      return {
        format,
        extension: "list",
        content: renderLoon(target, options)
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
      ...rules.ipCidr6.map((value) => `IP-CIDR6,${value},no-resolve`)
    ])
  );
}

function renderMihomo(target: RenderTarget): string {
  const lines = renderGroupedLines(target, (rules) => [
    ...rules.domain.map((value) => `- DOMAIN,${value}`),
    ...rules.domainSuffix.map((value) => `- DOMAIN-SUFFIX,${value}`),
    ...rules.domainKeyword.map((value) => `- DOMAIN-KEYWORD,${value}`),
    ...rules.ipCidr.map((value) => `- IP-CIDR,${value},no-resolve`),
    ...rules.ipCidr6.map((value) => `- IP-CIDR6,${value},no-resolve`)
  ]).map((line) => (line ? `  ${line}` : ""));

  return ["payload:", ...lines, ""].join("\n");
}

function renderSingBox(target: RenderTarget): string {
  const rule: Record<string, string[]> = {};

  assignIfAny(rule, "domain", target.rules.domain);
  assignIfAny(rule, "domain_suffix", target.rules.domainSuffix);
  assignIfAny(rule, "domain_keyword", target.rules.domainKeyword);
  assignIfAny(rule, "ip_cidr", [...target.rules.ipCidr, ...target.rules.ipCidr6]);

  return `${JSON.stringify({ version: 3, rules: [rule] }, null, 2)}\n`;
}

function renderQuantumultX(target: RenderTarget, options: RenderOptions): string {
  return withHeader(
    target,
    renderGroupedLines(target, (rules) => [
      ...rules.domain.map((value) => `HOST,${value},${options.policy}`),
      ...rules.domainSuffix.map((value) => `HOST-SUFFIX,${value},${options.policy}`),
      ...rules.domainKeyword.map((value) => `HOST-KEYWORD,${value},${options.policy}`),
      ...rules.ipCidr.map((value) => `IP-CIDR,${value},${options.policy},no-resolve`),
      ...rules.ipCidr6.map((value) => `IP6-CIDR,${value},${options.policy},no-resolve`)
    ])
  );
}

function renderLoon(target: RenderTarget, options: RenderOptions): string {
  return withHeader(
    target,
    renderGroupedLines(target, (rules) => [
      ...rules.domain.map((value) => `DOMAIN,${value},${options.policy}`),
      ...rules.domainSuffix.map((value) => `DOMAIN-SUFFIX,${value},${options.policy}`),
      ...rules.domainKeyword.map((value) => `DOMAIN-KEYWORD,${value},${options.policy}`),
      ...rules.ipCidr.map((value) => `IP-CIDR,${value},${options.policy},no-resolve`),
      ...rules.ipCidr6.map((value) => `IP-CIDR6,${value},${options.policy},no-resolve`)
    ])
  );
}

function withHeader(target: RenderTarget, lines: string[]): string {
  return [`# ${target.name}`, `# ${target.id}`, ...lines, ""].join("\n");
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

function assignIfAny(target: Record<string, string[]>, key: string, values: string[]): void {
  if (values.length > 0) {
    target[key] = values;
  }
}
