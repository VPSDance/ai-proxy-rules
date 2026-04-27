import { describe, expect, it } from "vitest";
import { aggregateProviders, mergeRuleSets, providerToTarget } from "../scripts/data.js";
import { render } from "../scripts/generators/index.js";
import type { ProviderSource } from "../scripts/types.js";

const anthropic: ProviderSource = {
  provider: "anthropic",
  name: "Anthropic",
  groups: [
    {
      name: "Core",
      rules: {
        domain: ["api.anthropic.com"],
        domainSuffix: ["anthropic.com"],
        domainKeyword: ["claude"],
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
    ipCidr: ["203.0.113.0/24"],
    ipCidr6: ["2001:db8::/32"],
    asn: [399358]
  }
};

const cursor: ProviderSource = {
  provider: "cursor",
  name: "Cursor",
  groups: [
    {
      name: "Core",
      rules: {
        domain: ["api2.cursor.sh"],
        domainSuffix: ["cursor.sh"],
        domainKeyword: [],
        ipCidr: [],
        ipCidr6: [],
        asn: []
      }
    }
  ],
  rules: {
    domain: ["api2.cursor.sh"],
    domainSuffix: ["cursor.sh"],
    domainKeyword: [],
    ipCidr: [],
    ipCidr6: [],
    asn: []
  }
};

describe("generators", () => {
  it("renders mihomo payload rules", () => {
    const rendered = render("mihomo", providerToTarget(anthropic));

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

  it("aggregates providers into all", () => {
    const target = aggregateProviders([anthropic, cursor]);
    const rendered = render("surge", target);

    expect(target.id).toBe("all");
    expect(rendered.content).toContain("# Anthropic / Core");
    expect(rendered.content).toContain("# Cursor / Core");
    expect(rendered.content).toContain("DOMAIN,api.anthropic.com");
    expect(rendered.content).toContain("DOMAIN,api2.cursor.sh");
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
        domain: ["API.Anthropic.com", "api2.cursor.sh"],
        domainSuffix: [],
        domainKeyword: [],
        ipCidr: [],
        ipCidr6: [],
        asn: []
      }
    ]);

    expect(merged.domain).toEqual(["api.anthropic.com", "api2.cursor.sh"]);
  });
});
