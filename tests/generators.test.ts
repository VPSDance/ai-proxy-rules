import { describe, expect, it } from "vitest";
import { aggregateProviders, aggregateProvidersByCategory, mergeRuleSets, providerToTarget } from "../scripts/data.js";
import { render } from "../scripts/generators/index.js";
import type { ProviderSource } from "../scripts/types.js";

const anthropic: ProviderSource = {
  provider: "anthropic",
  name: "Anthropic",
  categories: ["coding", "model"],
  aliases: [],
  allowDangerousDomainSuffix: [],
  groups: [
    {
      name: "Core",
      rules: {
        domain: ["api.anthropic.com"],
        domainSuffix: ["anthropic.com"],
        domainKeyword: ["claude"],
        domainRegex: [],
        ipCidr: [],
        ipCidr6: [],
        asn: []
      }
    },
    {
      name: "Network",
      rules: {
        domain: [],
        domainSuffix: [],
        domainKeyword: [],
        domainRegex: [],
        ipCidr: ["203.0.113.0/24"],
        ipCidr6: ["2001:db8::/32"],
        asn: [399358]
      }
    }
  ],
  rules: {
    domain: ["api.anthropic.com"],
    domainSuffix: ["anthropic.com"],
    domainKeyword: ["claude"],
    domainRegex: [],
    ipCidr: ["203.0.113.0/24"],
    ipCidr6: ["2001:db8::/32"],
    asn: [399358]
  }
};

const fixtureIde: ProviderSource = {
  provider: "fixture-ide",
  name: "Fixture IDE",
  categories: ["coding"],
  aliases: [],
  allowDangerousDomainSuffix: [],
  groups: [
    {
      name: "Core",
      rules: {
        domain: ["api.fixture-ide.test"],
        domainSuffix: ["fixture-ide.test"],
        domainKeyword: [],
        domainRegex: [],
        ipCidr: [],
        ipCidr6: [],
        asn: []
      }
    }
  ],
  rules: {
    domain: ["api.fixture-ide.test"],
    domainSuffix: ["fixture-ide.test"],
    domainKeyword: [],
    domainRegex: [],
    ipCidr: [],
    ipCidr6: [],
    asn: []
  }
};

describe("generators", () => {
  it("renders clash payload rules", () => {
    const rendered = render("clash", providerToTarget(anthropic));

    expect(rendered.extension).toBe("yaml");
    expect(rendered.content).toContain("DOMAIN,api.anthropic.com");
    expect(rendered.content).toContain("DOMAIN-SUFFIX,anthropic.com");
    expect(rendered.content).toContain("IP-CIDR,203.0.113.0/24,no-resolve");
    expect(rendered.content).toContain("IP-ASN,399358,no-resolve");
  });

  it("renders sing-box source rule set json without unsupported ASN rules", () => {
    const rendered = render("sing-box", providerToTarget(anthropic));
    const parsed = JSON.parse(rendered.content);

    expect(parsed.version).toBe(3);
    expect(parsed.rules[0].domain).toEqual(["api.anthropic.com"]);
    expect(parsed.rules[0].domain_suffix).toEqual(["anthropic.com"]);
    expect(parsed.rules[0].ip_cidr).toEqual(["203.0.113.0/24", "2001:db8::/32"]);
    expect(parsed.rules[0]).not.toHaveProperty("asn");
    expect(parsed.rules[0]).not.toHaveProperty("ip_asn");
  });

  it("renders quantumult x without per-line policy", () => {
    const rendered = render("quantumult-x", providerToTarget(anthropic));

    expect(rendered.content).toContain("HOST,api.anthropic.com\n");
    expect(rendered.content).toContain("HOST-SUFFIX,anthropic.com\n");
    expect(rendered.content).toContain("IP-CIDR,203.0.113.0/24,no-resolve");
    expect(rendered.content).toContain("IP-ASN,399358,no-resolve");
    expect(rendered.content).not.toMatch(/,AI(\s|$)/);
  });

  it("renders shadowrocket without per-line policy", () => {
    const rendered = render("shadowrocket", providerToTarget(anthropic));

    expect(rendered.extension).toBe("list");
    expect(rendered.content).toContain("DOMAIN,api.anthropic.com\n");
    expect(rendered.content).toContain("DOMAIN-SUFFIX,anthropic.com\n");
    expect(rendered.content).toContain("IP-CIDR,203.0.113.0/24,no-resolve");
    expect(rendered.content).toContain("IP-CIDR6,2001:db8::/32,no-resolve");
    expect(rendered.content).toContain("IP-ASN,399358,no-resolve");
  });

  it("renders loon without per-line policy", () => {
    const rendered = render("loon", providerToTarget(anthropic));

    expect(rendered.content).toContain("DOMAIN,api.anthropic.com\n");
    expect(rendered.content).toContain("DOMAIN-SUFFIX,anthropic.com\n");
    expect(rendered.content).toContain("IP-CIDR,203.0.113.0/24,no-resolve");
  });

  it("renders stash like surge (without per-line policy)", () => {
    const rendered = render("stash", providerToTarget(anthropic));

    expect(rendered.extension).toBe("list");
    expect(rendered.content).toContain("DOMAIN,api.anthropic.com\n");
    expect(rendered.content).toContain("DOMAIN-SUFFIX,anthropic.com\n");
    expect(rendered.content).toContain("IP-CIDR,203.0.113.0/24,no-resolve");
    expect(rendered.content).toContain("IP-ASN,399358,no-resolve");
  });

  it("emits domain-regex only in formats with first-class regex support", () => {
    const provider: ProviderSource = {
      provider: "regex-test",
      name: "Regex Test",
      groups: [
        {
          name: "Core",
          rules: {
            domain: [],
            domainSuffix: [],
            domainKeyword: [],
            domainRegex: ["^example-\\d+\\.foo\\.com$"],
            ipCidr: [],
            ipCidr6: [],
            asn: []
          }
        }
      ],
      rules: {
        domain: [],
        domainSuffix: [],
        domainKeyword: [],
        domainRegex: ["^example-\\d+\\.foo\\.com$"],
        ipCidr: [],
        ipCidr6: [],
        asn: []
      }
    };
    const target = providerToTarget(provider);

    expect(render("clash", target).content).toContain("DOMAIN-REGEX,^example-\\d+\\.foo\\.com$");
    const singBox = JSON.parse(render("sing-box", target).content);
    expect(singBox.rules[0].domain_regex).toEqual(["^example-\\d+\\.foo\\.com$"]);

    for (const format of ["surge", "loon", "shadowrocket", "stash", "quantumult-x"] as const) {
      expect(render(format, target).content).not.toContain("REGEX");
    }
  });

  it("aggregates providers into all", () => {
    const target = aggregateProviders([anthropic, fixtureIde]);
    const rendered = render("surge", target);

    expect(target.id).toBe("all");
    expect(rendered.content).toContain("# Anthropic / Core");
    expect(rendered.content).toContain("# Fixture IDE / Core");
    expect(rendered.content).toContain("DOMAIN,api.anthropic.com");
    expect(rendered.content).toContain("DOMAIN,api.fixture-ide.test");
  });

  it("aggregates providers by category", () => {
    const targets = aggregateProvidersByCategory([anthropic, fixtureIde]);

    expect(targets.map((target) => target.id)).toEqual(["coding", "model"]);
    expect(render("surge", targets[0]!).content).toContain("DOMAIN,api.fixture-ide.test");
    expect(render("surge", targets[1]!).content).toContain("DOMAIN,api.anthropic.com");
  });

  it("deduplicates rendered all rules across provider groups", () => {
    const duplicated: ProviderSource = {
      provider: "duplicated",
      name: "Duplicated",
      groups: [
        {
          name: "Third-Party",
          rules: {
            domain: ["api.anthropic.com"],
            domainSuffix: [],
            domainKeyword: [],
            domainRegex: [],
            ipCidr: [],
            ipCidr6: [],
            asn: []
          }
        }
      ],
      rules: {
        domain: ["api.anthropic.com"],
        domainSuffix: [],
        domainKeyword: [],
        domainRegex: [],
        ipCidr: [],
        ipCidr6: [],
        asn: []
      }
    };
    const target = aggregateProviders([anthropic, duplicated]);
    const rendered = render("surge", target);

    expect(rendered.content.match(/DOMAIN,api\.anthropic\.com/g)).toHaveLength(1);
  });

  it("deduplicates and sorts merged rules", () => {
    const merged = mergeRuleSets([
      anthropic.rules,
      {
        domain: ["API.Anthropic.com", "api.fixture-ide.test"],
        domainSuffix: [],
        domainKeyword: [],
        domainRegex: [],
        ipCidr: [],
        ipCidr6: [],
        asn: []
      }
    ]);

    expect(merged.domain).toEqual(["api.anthropic.com", "api.fixture-ide.test"]);
  });
});
