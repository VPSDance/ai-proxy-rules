import { describe, expect, it } from "vitest";
import { parseClassicalRules, parseSourceRules } from "../scripts/sync/parsers.js";

describe("source sync parsers", () => {
  it("parses classical rules and ignores policy options", () => {
    const parsed = parseClassicalRules(`
      DOMAIN-SUFFIX,openai.com,AI
      IP-CIDR,24.199.123.28/32,AI,no-resolve
      IP-ASN,AS401518,no-resolve
    `);

    expect(parsed.domainSuffix).toEqual(["openai.com"]);
    expect(parsed.ipCidr).toEqual(["24.199.123.28/32"]);
    expect(parsed.asn).toEqual([401518]);
  });

  it("parses mihomo yaml payload rules", () => {
    const parsed = parseSourceRules(
      `
payload:
  - DOMAIN,browser-intake-datadoghq.com
  - DOMAIN-KEYWORD,openai
  - IP-ASN,20473
`,
      "mihomo-yaml"
    );

    expect(parsed.domain).toEqual(["browser-intake-datadoghq.com"]);
    expect(parsed.domainKeyword).toEqual(["openai"]);
    expect(parsed.asn).toEqual([20473]);
  });
});
