import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { providerCategories } from "../types.js";

const reservedIds = new Set(["all", ...providerCategories]);
const categorySet = new Set<string>(providerCategories);

export interface MetadataCheckResult {
  ok: boolean;
  sourceCount: number;
  errors: string[];
}

export async function checkMetadata(sourcesDir: string): Promise<MetadataCheckResult> {
  const errors: string[] = [];
  const entries = await readdir(sourcesDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => path.join(sourcesDir, entry.name))
    .sort();

  const providerIds = new Set<string>();
  const aliasOwners = new Map<string, string>();

  for (const file of files) {
    const relPath = file.replace(/\\/g, "/");
    const parsed = parse(await readFile(file, "utf8")) as {
      provider?: unknown;
      categories?: unknown;
      aliases?: unknown;
    } | null;

    if (!parsed || typeof parsed.provider !== "string" || parsed.provider.length === 0) {
      errors.push(`${relPath}: provider must be a non-empty string`);
      continue;
    }

    const id = parsed.provider;
    if (reservedIds.has(id)) {
      errors.push(`${relPath}: provider id "${id}" is reserved`);
    }
    if (providerIds.has(id)) {
      errors.push(`${relPath}: duplicate provider id "${id}"`);
    }
    providerIds.add(id);

    if (parsed.categories !== undefined) {
      if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) {
        errors.push(`${relPath}: categories must contain at least one category when present`);
      } else {
        const seenCategories = new Set<string>();
        for (const category of parsed.categories) {
          if (typeof category !== "string" || !categorySet.has(category)) {
            errors.push(`${relPath}: invalid category "${String(category)}"`);
            continue;
          }
          if (seenCategories.has(category)) {
            errors.push(`${relPath}: duplicate category "${category}"`);
          }
          seenCategories.add(category);
        }
      }
    }

    if (parsed.aliases !== undefined) {
      if (!Array.isArray(parsed.aliases)) {
        errors.push(`${relPath}: aliases must be an array when present`);
      } else {
        const seenAliases = new Set<string>();
        for (const alias of parsed.aliases) {
          if (typeof alias !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(alias)) {
            errors.push(`${relPath}: invalid alias "${String(alias)}"`);
            continue;
          }
          if (seenAliases.has(alias)) {
            errors.push(`${relPath}: duplicate alias "${alias}"`);
          }
          seenAliases.add(alias);
          if (reservedIds.has(alias)) {
            errors.push(`${relPath}: alias "${alias}" is reserved`);
          }
          if (alias === id) {
            errors.push(`${relPath}: alias "${alias}" duplicates provider id`);
          }

          const owner = aliasOwners.get(alias);
          if (owner && owner !== id) {
            errors.push(`${relPath}: alias "${alias}" is already used by provider "${owner}"`);
          } else {
            aliasOwners.set(alias, id);
          }
        }
      }
    }
  }

  for (const [alias, owner] of aliasOwners) {
    if (providerIds.has(alias)) {
      errors.push(`data/sources/${owner}.yaml: alias "${alias}" conflicts with provider id "${alias}"`);
    }
  }

  return {
    ok: errors.length === 0,
    sourceCount: files.length,
    errors
  };
}
