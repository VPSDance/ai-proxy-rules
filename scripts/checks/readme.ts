import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

export interface ReadmeCheckResult {
  ok: boolean;
  sourceCount: number;
  missingInReadme: string[];
  staleInReadme: string[];
}

export async function checkReadme(sourcesDir: string, readmePath: string): Promise<ReadmeCheckResult> {
  const sourceIds = await collectSourceIds(sourcesDir);
  const readmeIds = collectReadmeIds(await readFile(readmePath, "utf8"));

  const missingInReadme = [...sourceIds].filter((id) => !readmeIds.has(id)).sort();
  const staleInReadme = [...readmeIds].filter((id) => !sourceIds.has(id)).sort();

  return {
    ok: missingInReadme.length === 0 && staleInReadme.length === 0,
    sourceCount: sourceIds.size,
    missingInReadme,
    staleInReadme
  };
}

export async function collectSourceIds(sourcesDir: string): Promise<Set<string>> {
  const entries = await readdir(sourcesDir, { withFileTypes: true });
  const yamlFiles = entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => path.join(sourcesDir, entry.name));

  const ids = new Set<string>();
  for (const file of yamlFiles) {
    const raw = await readFile(file, "utf8");
    const parsed = parse(raw) as { provider?: unknown };
    if (typeof parsed?.provider !== "string") {
      throw new Error(`Source file ${file} is missing a string "provider" field.`);
    }
    ids.add(parsed.provider);
  }
  return ids;
}

export function collectReadmeIds(text: string): Set<string> {
  const startMarker = "规则覆盖范围：";
  const endMarker = "支持的客户端格式：";
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error('Could not locate provider list section between "规则覆盖范围：" and "支持的客户端格式：" in README.');
  }

  const section = text.slice(startIdx + startMarker.length, endIdx);
  const ids = new Set<string>();
  for (const match of section.matchAll(/\(`([a-z0-9][a-z0-9-]*)`\)/g)) {
    ids.add(match[1]!);
  }
  return ids;
}
