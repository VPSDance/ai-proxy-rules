import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evaluateGuard, countRulesFromText } from "../scripts/checks/guard.js";
import { checkMetadata } from "../scripts/checks/metadata.js";
import { checkReadme, collectReadmeIds } from "../scripts/checks/readme.js";

describe("guard", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "guard-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("counts every rule type across all groups", () => {
    const text = `
provider: demo
name: Demo
groups:
  - name: Core
    rules:
      domain: [a.com, b.com]
      domainSuffix: [c.com]
      domainKeyword: [foo]
      domainRegex: ['^x$']
      ipCidr: [1.2.3.0/24]
      ipCidr6: ['2001:db8::/32']
      asn: [12345]
  - name: Other
    rules:
      domain: [d.com]
`;
    expect(countRulesFromText(text)).toBe(9);
  });

  it("returns ok=true when no provider crosses threshold", async () => {
    await writeFile(
      path.join(dir, "stable.yaml"),
      "provider: stable\nname: S\ngroups:\n  - name: Core\n    rules:\n      domainSuffix: [a.com, b.com, c.com]\n",
      "utf8"
    );
    const result = await evaluateGuard({
      input: dir,
      threshold: 30,
      ref: "HEAD",
      getFileAtRef: async () =>
        "provider: stable\nname: S\ngroups:\n  - name: Core\n    rules:\n      domainSuffix: [a.com, b.com, c.com]\n"
    });
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("flags provider losing more than threshold percent", async () => {
    await writeFile(
      path.join(dir, "shrunk.yaml"),
      "provider: shrunk\nname: S\ngroups:\n  - name: Core\n    rules:\n      domainSuffix: [only-one.com]\n",
      "utf8"
    );
    const result = await evaluateGuard({
      input: dir,
      threshold: 30,
      ref: "HEAD",
      getFileAtRef: async () =>
        "provider: shrunk\nname: S\ngroups:\n  - name: Core\n    rules:\n      domainSuffix: [a.com, b.com, c.com, d.com, e.com]\n"
    });
    expect(result.ok).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.oldCount).toBe(5);
    expect(result.failures[0]?.newCount).toBe(1);
    expect(result.failures[0]?.dropPct).toBeCloseTo(80, 0);
  });

  it("ignores provider yamls that did not exist in previous ref", async () => {
    await writeFile(
      path.join(dir, "brand-new.yaml"),
      "provider: brand-new\nname: N\ngroups:\n  - name: Core\n    rules:\n      domainSuffix: [a.com]\n",
      "utf8"
    );
    const result = await evaluateGuard({
      input: dir,
      threshold: 30,
      ref: "HEAD",
      getFileAtRef: async () => null
    });
    expect(result.ok).toBe(true);
    expect(result.inspected).toEqual([]);
  });

  it("flags dangerous broad domain suffixes", async () => {
    await writeFile(
      path.join(dir, "wide.yaml"),
      "provider: wide\nname: Wide\ngroups:\n  - name: Core\n    rules:\n      domainSuffix: [google.com]\n",
      "utf8"
    );
    const result = await evaluateGuard({
      input: dir,
      threshold: 30,
      ref: "HEAD",
      getFileAtRef: async () => null
    });

    expect(result.ok).toBe(false);
    expect(result.dangerousSuffixFailures).toHaveLength(1);
    expect(result.dangerousSuffixFailures[0]?.suffixes).toEqual(["google.com"]);
  });

  it("allows explicitly approved dangerous broad domain suffixes", async () => {
    await writeFile(
      path.join(dir, "wide.yaml"),
      "provider: wide\nname: Wide\nallowDangerousDomainSuffix: [google.com]\ngroups:\n  - name: Core\n    rules:\n      domainSuffix: [google.com]\n",
      "utf8"
    );
    const result = await evaluateGuard({
      input: dir,
      threshold: 30,
      ref: "HEAD",
      getFileAtRef: async () => null
    });

    expect(result.ok).toBe(true);
    expect(result.dangerousSuffixFailures).toEqual([]);
  });

  it("rejects invalid threshold", async () => {
    await expect(
      evaluateGuard({ input: dir, threshold: -1, ref: "HEAD", getFileAtRef: async () => null })
    ).rejects.toThrow(/Invalid threshold/);
  });
});

describe("check-readme", () => {
  let sourcesDir: string;
  let readmeFile: string;

  beforeEach(async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "check-readme-"));
    sourcesDir = path.join(root, "sources");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(sourcesDir));
    readmeFile = path.join(root, "README.md");
  });

  it("succeeds when README and sources match", async () => {
    await writeFile(path.join(sourcesDir, "alpha.yaml"), "provider: alpha\nname: A\ngroups: [{name: Core, include: {domainSuffix: [a.com]}}]\n", "utf8");
    await writeFile(path.join(sourcesDir, "beta.yaml"), "provider: beta\nname: B\ngroups: [{name: Core, include: {domainSuffix: [b.com]}}]\n", "utf8");
    await writeFile(
      readmeFile,
      `# Title\n\n规则覆盖范围：\n\n- Alpha (\`alpha\`)\n- Beta (\`beta\`)\n\n支持的客户端格式：\n\n- Surge\n`,
      "utf8"
    );

    const result = await checkReadme(sourcesDir, readmeFile);
    expect(result.ok).toBe(true);
    expect(result.sourceCount).toBe(2);
    expect(result.missingInReadme).toEqual([]);
    expect(result.staleInReadme).toEqual([]);
  });

  it("reports providers present in sources but missing from README", async () => {
    await writeFile(path.join(sourcesDir, "alpha.yaml"), "provider: alpha\nname: A\ngroups: [{name: Core, include: {domainSuffix: [a.com]}}]\n", "utf8");
    await writeFile(path.join(sourcesDir, "ghost.yaml"), "provider: ghost\nname: G\ngroups: [{name: Core, include: {domainSuffix: [g.com]}}]\n", "utf8");
    await writeFile(
      readmeFile,
      `规则覆盖范围：\n\n- Alpha (\`alpha\`)\n\n支持的客户端格式：\n\n- Surge\n`,
      "utf8"
    );

    const result = await checkReadme(sourcesDir, readmeFile);
    expect(result.ok).toBe(false);
    expect(result.missingInReadme).toEqual(["ghost"]);
  });

  it("reports stale README entries no longer in sources", async () => {
    await writeFile(path.join(sourcesDir, "alpha.yaml"), "provider: alpha\nname: A\ngroups: [{name: Core, include: {domainSuffix: [a.com]}}]\n", "utf8");
    await writeFile(
      readmeFile,
      `规则覆盖范围：\n\n- Alpha (\`alpha\`)\n- Removed (\`removed\`)\n\n支持的客户端格式：\n\n- Surge\n`,
      "utf8"
    );

    const result = await checkReadme(sourcesDir, readmeFile);
    expect(result.ok).toBe(false);
    expect(result.staleInReadme).toEqual(["removed"]);
  });

  it("collectReadmeIds extracts ids only from the provider section", () => {
    const text = `# Heading\n\nintro mentioning (\`fake\`)\n\n规则覆盖范围：\n\n- A (\`alpha\`)\n- B (\`beta-test\`)\n\n支持的客户端格式：\n\n- Surge (\`surge\`)\n`;
    const ids = collectReadmeIds(text);
    expect([...ids].sort()).toEqual(["alpha", "beta-test"]);
  });
});

describe("check-metadata", () => {
  let sourcesDir: string;

  beforeEach(async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "check-metadata-"));
    sourcesDir = path.join(root, "sources");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(sourcesDir));
  });

  it("accepts valid categories and aliases", async () => {
    await writeFile(
      path.join(sourcesDir, "openai.yaml"),
      "provider: openai\nname: OpenAI\ncategories: [coding, model]\naliases: [chatgpt, codex]\ngroups: [{name: Core, include: {domainSuffix: [openai.com]}}]\n",
      "utf8"
    );

    const result = await checkMetadata(sourcesDir);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("treats categories as optional but rejects unknown values", async () => {
    await writeFile(
      path.join(sourcesDir, "no-cat.yaml"),
      "provider: no-cat\nname: NoCat\ngroups: [{name: Core, include: {domainSuffix: [no-cat.example]}}]\n",
      "utf8"
    );
    await writeFile(
      path.join(sourcesDir, "wrong.yaml"),
      "provider: wrong\nname: Wrong\ncategories: [unknown]\ngroups: [{name: Core, include: {domainSuffix: [wrong.example]}}]\n",
      "utf8"
    );

    const result = await checkMetadata(sourcesDir);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).not.toContain("categories must contain at least one");
    expect(result.errors.join("\n")).toContain('invalid category "unknown"');
  });

  it("rejects duplicate aliases and alias collisions", async () => {
    await writeFile(
      path.join(sourcesDir, "alpha.yaml"),
      "provider: alpha\nname: Alpha\ncategories: [coding]\naliases: [same, same]\ngroups: [{name: Core, include: {domainSuffix: [alpha.example]}}]\n",
      "utf8"
    );
    await writeFile(
      path.join(sourcesDir, "beta.yaml"),
      "provider: beta\nname: Beta\ncategories: [coding]\naliases: [same]\ngroups: [{name: Core, include: {domainSuffix: [beta.example]}}]\n",
      "utf8"
    );

    const result = await checkMetadata(sourcesDir);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain('duplicate alias "same"');
    expect(result.errors.join("\n")).toContain('alias "same" is already used by provider "alpha"');
  });
});
