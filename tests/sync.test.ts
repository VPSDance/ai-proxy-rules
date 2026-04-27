import { describe, expect, it } from "vitest";
import { buildProviderData } from "../scripts/sync/build.js";
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
regexp:^chatgpt-async-webps-prod-\\S+\\.example\\.com$
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
    expect(parsed.domainRegex).toEqual([
      "^chatgpt-async-webps-prod-\\S+\\.example\\.com$"
    ]);
  });

  it("skips include directives when followIncludes is false", async () => {
    const parsed = await parseDomainListCommunityRules(
      `
include:facebook
include:instagram

llama.com
meta.ai
meta.com
`,
      {
        sourceUrl: "https://raw.githubusercontent.com/v2fly/domain-list-community/master/data/meta",
        followIncludes: false,
        fetchText: async () => {
          throw new Error("fetchText must not be called when followIncludes is false");
        }
      }
    );

    expect(parsed.domainSuffix).toEqual(["llama.com", "meta.ai", "meta.com"]);
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

describe("buildProviderData", () => {
  it("removes patch.remove entries from explicit includes and source rules", async () => {
    const data = await buildProviderData(
      {
        provider: "demo",
        name: "Demo",
        sources: [],
        groups: [
          {
            name: "Core",
            include: {
              domain: [],
              domainSuffix: ["keep.example.com", "drop.example.com"],
              domainKeyword: [],
              domainRegex: [],
              ipCidr: [],
              ipCidr6: [],
              asn: []
            },
            fromSource: false
          }
        ],
        patch: {
          remove: {
            domain: [],
            domainSuffix: ["drop.example.com"],
            domainKeyword: [],
            domainRegex: [],
            ipCidr: [],
            ipCidr6: [],
            asn: []
          }
        }
      },
      "."
    );

    expect(data.groups).toHaveLength(1);
    expect(data.groups[0]?.rules.domainSuffix).toEqual(["keep.example.com"]);
  });

  it("removes patch.remove entries that come only from upstream sources", async () => {
    const data = await buildProviderData(
      {
        provider: "demo",
        name: "Demo",
        sources: [],
        groups: [
          {
            name: "Core",
            include: {
              domain: [],
              domainSuffix: ["alpha.example.com", "noisy.example.com", "beta.example.com"],
              domainKeyword: [],
              domainRegex: [],
              ipCidr: [],
              ipCidr6: [],
              asn: []
            },
            fromSource: false
          }
        ],
        patch: {
          remove: {
            domain: [],
            domainSuffix: ["noisy.example.com"],
            domainKeyword: [],
            domainRegex: [],
            ipCidr: [],
            ipCidr6: [],
            asn: []
          }
        }
      },
      "."
    );

    expect(data.groups[0]?.rules.domainSuffix).toEqual([
      "alpha.example.com",
      "beta.example.com"
    ]);
    expect(data.groups[0]?.rules.domainSuffix).not.toContain("noisy.example.com");
  });
});
