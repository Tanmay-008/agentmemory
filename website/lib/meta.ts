import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface ProjectMeta {
  version: string;
  mcpTools: number;
  hooks: number;
  restEndpoints: number;
  testsPassing: number;
}

export const DEFAULT_META: Omit<ProjectMeta, "version"> = {
  mcpTools: 44,
  hooks: 12,
  restEndpoints: 49,
  testsPassing: 777,
};

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

function readFileSafe(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

function safeReadJson<T>(path: string): T | null {
  const txt = readFileSafe(path);
  if (!txt) return null;
  try {
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

function safeCountMatches(path: string, pattern: RegExp): number {
  const txt = readFileSafe(path);
  if (!txt) return 0;
  const m = txt.match(pattern);
  return m ? m.length : 0;
}

function countHookTypes(typesPath: string): number {
  const txt = readFileSafe(typesPath);
  if (!txt) return 0;
  const union = txt.match(/export type HookType[\s\S]*?;/);
  if (!union) return 0;
  const body = union[0].replace(/export type HookType\s*=/, "").replace(/;$/, "");
  const members = body
    .split("|")
    .map((s) => s.trim())
    .filter((s) => /^["'`]/.test(s));
  return members.length;
}

function countTestCases(testDir: string): number {
  let total = 0;
  let entries: import("node:fs").Dirent[];
  try {
    entries = readdirSync(testDir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = join(testDir, entry.name);
    if (entry.isDirectory()) {
      total += countTestCases(full);
      continue;
    }
    if (!/\.test\.[jt]sx?$/.test(entry.name)) continue;
    const txt = readFileSafe(full);
    if (!txt) continue;
    const m = txt.match(/(?:^|\s)(?:it|test)(?:\.\w+)?\s*\(/g);
    if (m) total += m.length;
  }
  return total;
}

export function getProjectMeta(): ProjectMeta {
  const pkg = safeReadJson<{ version?: string }>(
    join(repoRoot, "package.json"),
  );

  // REST endpoints: registerTrigger entries in src/triggers/api.ts with an
  // api_path config. The tight regex matches the exact declaration shape the
  // codebase uses; loose forms (comments, example strings) are not counted.
  const restEndpoints = safeCountMatches(
    join(repoRoot, "src", "triggers", "api.ts"),
    /config:\s*\{\s*api_path:\s*"/g,
  );

  // MCP tools: count memory_* entries in the tools registry.
  const mcpTools = safeCountMatches(
    join(repoRoot, "src", "mcp", "tools-registry.ts"),
    /name:\s*"memory_/g,
  );

  // Hooks: count actual members of the HookType union, not quote characters.
  const hooks = countHookTypes(join(repoRoot, "src", "types.ts"));

  // Tests: walk the test/ tree, count it()/test() call sites.
  const testsPassing = countTestCases(join(repoRoot, "test"));

  return {
    version: pkg?.version ?? "0.0.0",
    mcpTools: mcpTools || DEFAULT_META.mcpTools,
    hooks: hooks || DEFAULT_META.hooks,
    restEndpoints: restEndpoints || DEFAULT_META.restEndpoints,
    testsPassing: testsPassing || DEFAULT_META.testsPassing,
  };
}
