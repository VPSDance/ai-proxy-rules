export const formats = [
  "surge",
  "clash",
  "sing-box",
  "quantumult-x",
  "loon",
  "shadowrocket",
  "stash"
] as const;

export type Format = (typeof formats)[number];

export interface RuleSet {
  domain: string[];
  domainSuffix: string[];
  domainKeyword: string[];
  domainRegex: string[];
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
  category?: ProviderCategory;
  aliases?: string[];
  allowDangerousDomainSuffix?: string[];
  groups: RuleGroup[];
  rules: RuleSet;
}

export interface RenderTarget {
  id: string;
  name: string;
  description?: string;
  category?: ProviderCategory;
  groups: RuleGroup[];
  rules: RuleSet;
}

export interface RenderedFile {
  format: Format;
  extension: "list" | "yaml" | "json";
  content: string;
}

export const providerCategories = [
  "assistant",
  "coding",
  "inference",
  "media",
  "search",
  "agent",
  "local",
  "productivity"
] as const;

export type ProviderCategory = (typeof providerCategories)[number];
