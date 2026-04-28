import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { parse } from "yaml";

const exec = promisify(execFile);

export interface GuardResult {
  ok: boolean;
  failures: GuardEntry[];
  dangerousSuffixFailures: DangerousSuffixFailure[];
  inspected: GuardEntry[];
}

export interface GuardEntry {
  relPath: string;
  oldCount: number;
  newCount: number;
  dropPct: number;
}

export interface GuardParams {
  input: string;
  threshold: number;
  ref: string;
  getFileAtRef?: (ref: string, relPath: string) => Promise<string | null>;
}

export interface DangerousSuffixFailure {
  relPath: string;
  provider: string;
  suffixes: string[];
}

const dangerousDomainSuffixes = new Set([
  "adobe.com",
  "amazon.com",
  "amazonaws.com",
  "apple.com",
  "azure.com",
  "canva.com",
  "cloudflare.com",
  "facebook.com",
  "github.com",
  "google.com",
  "icloud.com",
  "live.com",
  "meta.com",
  "microsoft.com",
  "office.com",
  "vercel.app",
  "windows.net",
  "youtube.com"
]);

export async function evaluateGuard(params: GuardParams): Promise<GuardResult> {
  if (!Number.isFinite(params.threshold) || params.threshold <= 0 || params.threshold >= 100) {
    throw new Error(`Invalid threshold: ${params.threshold}`);
  }

  const fetchAtRef = params.getFileAtRef ?? defaultGetFileAtRef;
  const entries = await readdir(params.input, { withFileTypes: true });
  const yamlFiles = entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const failures: GuardEntry[] = [];
  const dangerousSuffixFailures: DangerousSuffixFailure[] = [];
  const inspected: GuardEntry[] = [];

  for (const fileName of yamlFiles) {
    const relPath = path.join(params.input, fileName).replace(/\\/g, "/");
    const raw = await readFile(relPath, "utf8");
    const dangerousSuffixFailure = findDangerousSuffixes(raw, relPath);
    if (dangerousSuffixFailure) {
      dangerousSuffixFailures.push(dangerousSuffixFailure);
    }

    const newCount = countRulesFromText(raw);
    const oldRaw = await fetchAtRef(params.ref, relPath);

    if (oldRaw === null) {
      continue;
    }

    const oldCount = countRulesFromText(oldRaw);
    if (oldCount === 0) {
      continue;
    }

    const dropPct = ((oldCount - newCount) / oldCount) * 100;
    const entry: GuardEntry = { relPath, oldCount, newCount, dropPct };
    inspected.push(entry);

    if (dropPct > params.threshold) {
      failures.push(entry);
    }
  }

  return {
    ok: failures.length === 0 && dangerousSuffixFailures.length === 0,
    failures,
    dangerousSuffixFailures,
    inspected
  };
}

async function defaultGetFileAtRef(ref: string, relPath: string): Promise<string | null> {
  try {
    const { stdout } = await exec("git", ["show", `${ref}:${relPath}`], { maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch {
    return null;
  }
}

export function countRulesFromText(text: string): number {
  const parsed = parse(text) as
    | {
        groups?: Array<{
          rules?: {
            domain?: unknown[];
            domainSuffix?: unknown[];
            domainKeyword?: unknown[];
            domainRegex?: unknown[];
            ipCidr?: unknown[];
            ipCidr6?: unknown[];
            asn?: unknown[];
          };
        }>;
      }
    | null
    | undefined;

  if (!parsed?.groups) {
    return 0;
  }

  let count = 0;
  for (const group of parsed.groups) {
    const rules = group.rules ?? {};
    count += rules.domain?.length ?? 0;
    count += rules.domainSuffix?.length ?? 0;
    count += rules.domainKeyword?.length ?? 0;
    count += rules.domainRegex?.length ?? 0;
    count += rules.ipCidr?.length ?? 0;
    count += rules.ipCidr6?.length ?? 0;
    count += rules.asn?.length ?? 0;
  }
  return count;
}

function findDangerousSuffixes(text: string, relPath: string): DangerousSuffixFailure | null {
  const parsed = parse(text) as
    | {
        provider?: string;
        allowDangerousDomainSuffix?: unknown[];
        groups?: Array<{
          rules?: {
            domainSuffix?: unknown[];
          };
        }>;
      }
    | null
    | undefined;

  const allowed = new Set(
    (parsed?.allowDangerousDomainSuffix ?? [])
      .filter((value): value is string => typeof value === "string")
      .map(normalizeDomain)
  );
  const suffixes = new Set<string>();

  for (const group of parsed?.groups ?? []) {
    for (const suffix of group.rules?.domainSuffix ?? []) {
      if (typeof suffix !== "string") {
        continue;
      }

      const normalized = normalizeDomain(suffix);
      if (dangerousDomainSuffixes.has(normalized) && !allowed.has(normalized)) {
        suffixes.add(normalized);
      }
    }
  }

  if (suffixes.size === 0) {
    return null;
  }

  return {
    relPath,
    provider: parsed?.provider ?? path.basename(relPath, path.extname(relPath)),
    suffixes: [...suffixes].sort()
  };
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^\.+/, "");
}
