import { stringify } from "yaml";
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
  return withHeader(target, [
    ...target.rules.domain.map((value) => `DOMAIN,${value}`),
    ...target.rules.domainSuffix.map((value) => `DOMAIN-SUFFIX,${value}`),
    ...target.rules.domainKeyword.map((value) => `DOMAIN-KEYWORD,${value}`),
    ...target.rules.ipCidr.map((value) => `IP-CIDR,${value},no-resolve`),
    ...target.rules.ipCidr6.map((value) => `IP-CIDR6,${value},no-resolve`)
  ]);
}

function renderMihomo(target: RenderTarget): string {
  const payload = [
    ...target.rules.domain.map((value) => `DOMAIN,${value}`),
    ...target.rules.domainSuffix.map((value) => `DOMAIN-SUFFIX,${value}`),
    ...target.rules.domainKeyword.map((value) => `DOMAIN-KEYWORD,${value}`),
    ...target.rules.ipCidr.map((value) => `IP-CIDR,${value},no-resolve`),
    ...target.rules.ipCidr6.map((value) => `IP-CIDR6,${value},no-resolve`)
  ];

  return stringify(
    {
      payload
    },
    { lineWidth: 0 }
  );
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
  return withHeader(target, [
    ...target.rules.domain.map((value) => `HOST,${value},${options.policy}`),
    ...target.rules.domainSuffix.map((value) => `HOST-SUFFIX,${value},${options.policy}`),
    ...target.rules.domainKeyword.map((value) => `HOST-KEYWORD,${value},${options.policy}`),
    ...target.rules.ipCidr.map((value) => `IP-CIDR,${value},${options.policy},no-resolve`),
    ...target.rules.ipCidr6.map((value) => `IP6-CIDR,${value},${options.policy},no-resolve`)
  ]);
}

function renderLoon(target: RenderTarget, options: RenderOptions): string {
  return withHeader(target, [
    ...target.rules.domain.map((value) => `DOMAIN,${value},${options.policy}`),
    ...target.rules.domainSuffix.map((value) => `DOMAIN-SUFFIX,${value},${options.policy}`),
    ...target.rules.domainKeyword.map((value) => `DOMAIN-KEYWORD,${value},${options.policy}`),
    ...target.rules.ipCidr.map((value) => `IP-CIDR,${value},${options.policy},no-resolve`),
    ...target.rules.ipCidr6.map((value) => `IP-CIDR6,${value},${options.policy},no-resolve`)
  ]);
}

function withHeader(target: RenderTarget, lines: string[]): string {
  return [`# ${target.name}`, `# ${target.id}`, ...lines, ""].join("\n");
}

function assignIfAny(target: Record<string, string[]>, key: string, values: string[]): void {
  if (values.length > 0) {
    target[key] = values;
  }
}
