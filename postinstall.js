#!/usr/bin/env node

const deps = [
  { name: "better-sqlite3", label: "SQLite engine" },
  { name: "sqlite-vec", label: "Vector extension" },
];

const results = [];

for (const dep of deps) {
  try {
    require.resolve(dep.name);
    results.push({ ...dep, ok: true });
  } catch {
    results.push({ ...dep, ok: false });
  }
}

const allOk = results.every((r) => r.ok);
const sqliteAvailable = results[0].ok && results[1].ok;

if (sqliteAvailable) {
  console.log(
    "[agentmemory] sqlite-vec backend available (better-sqlite3 + sqlite-vec installed)",
  );
} else {
  const missing = results.filter((r) => !r.ok).map((r) => r.name);
  console.log(
    `[agentmemory] sqlite-vec backend not available (missing: ${missing.join(", ")})`,
  );
  console.log(
    "[agentmemory] This is OK — the in-memory vector backend will be used instead.",
  );
  console.log(
    "[agentmemory] To enable sqlite-vec, ensure a C compiler is available and run: npm install better-sqlite3 sqlite-vec",
  );
}
