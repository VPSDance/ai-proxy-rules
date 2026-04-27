import { describe, expect, it } from "vitest";
import {
  parseClassicalRules,
  parseDomainListCommunityRules,
  parseSourceRules
} from "../scripts/sync/parsers.js";

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

  it("parses mihomo yaml payload rules", async () => {
    const parsed = await parseSourceRules(
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

  it("parses domain-list-community rules with include recursion", async () => {
    const parsed = await parseDomainListCommunityRules(
      `
include:child
full:api.example.com
keyword:openai
chat.example.com
regexp:^ignored$
`,
      {
        sourceUrl: "https://raw.githubusercontent.com/v2fly/domain-list-community/master/data/openai",
        fetchText: async (url) => {
          expect(url).toBe(
            "https://raw.githubusercontent.com/v2fly/domain-list-community/master/data/child"
          );
          return `
githubcopilot.com
full:copilot.microsoft.com
`;
        }
      }
    );

    expect(parsed.domain).toEqual(["api.example.com", "copilot.microsoft.com"]);
    expect(parsed.domainKeyword).toEqual(["openai"]);
    expect(parsed.domainSuffix).toEqual(["chat.example.com", "githubcopilot.com"]);
  });

  it("keeps only untagged or @!cn domain-list-community entries", async () => {
    const parsed = await parseDomainListCommunityRules(
      `
ads.example.com @ads
cn-only.example.com @cn
unknown.example.com @geosite
keep.example.com @!cn
plain.example.com
full:exact.example.com @ads
`
    );

    expect(parsed.domainSuffix).toEqual(["keep.example.com", "plain.example.com"]);
    expect(parsed.domain).toEqual([]);
  });
});
