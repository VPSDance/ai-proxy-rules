export const formats = [
  "surge",
  "mihomo",
  "sing-box",
  "quantumult-x",
  "loon"
] as const;

export type Format = (typeof formats)[number];

export interface RuleSet {
  domain: string[];
  domainSuffix: string[];
  domainKeyword: string[];
  ipCidr: string[];
  ipCidr6: string[];
  asn: number[];
}

export interface RuleGroup {
  name: string;
  rules: RuleSet;
}

export interface ProviderSource {
  provider: string;
  name: string;
  description?: string;
  groups: RuleGroup[];
  rules: RuleSet;
}

export interface RenderTarget {
  id: string;
  name: string;
  description?: string;
  groups: RuleGroup[];
  rules: RuleSet;
}

export interface RenderOptions {
  policy: string;
}

export interface RenderedFile {
  format: Format;
  extension: "list" | "yaml" | "json";
  content: string;
}
