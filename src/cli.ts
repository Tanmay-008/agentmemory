#!/usr/bin/env node

import { spawn, execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
agentmemory — persistent memory for AI coding agents

Usage: agentmemory [command] [options]

Commands:
  (default)          Start agentmemory worker
  status             Show connection status, memory count, and health

Options:
  --help, -h         Show this help
  --tools all|core   Tool visibility (default: core = 7 tools)
  --no-engine        Skip auto-starting iii-engine
  --port <N>         Override REST port (default: 3111)

Quick start:
  npx @agentmemory/agentmemory          # start everything
  npx @agentmemory/agentmemory status   # check health
  npx agentmemory-mcp                   # standalone MCP (no engine)
`);
  process.exit(0);
}

const toolsIdx = args.indexOf("--tools");
if (toolsIdx !== -1 && args[toolsIdx + 1]) {
  process.env["AGENTMEMORY_TOOLS"] = args[toolsIdx + 1];
}

const portIdx = args.indexOf("--port");
if (portIdx !== -1 && args[portIdx + 1]) {
  process.env["III_REST_PORT"] = args[portIdx + 1];
}

const skipEngine = args.includes("--no-engine");

function getRestPort(): number {
  return parseInt(process.env["III_REST_PORT"] || "3111", 10) || 3111;
}

async function isEngineRunning(): Promise<boolean> {
  try {
    await fetch(`http://localhost:${getRestPort()}/`, {
      signal: AbortSignal.timeout(2000),
    });
    return true;
  } catch {
    return false;
  }
}

function findIiiConfig(): string {
  const candidates = [
    join(__dirname, "iii-config.yaml"),
    join(__dirname, "..", "iii-config.yaml"),
    join(process.cwd(), "iii-config.yaml"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return "";
}

function whichBinary(name: string): string | null {
  const cmd = process.platform === "win32" ? "where" : "which";
  try {
    return execFileSync(cmd, [name], { encoding: "utf-8" }).trim().split("\n")[0];
  } catch {
    return null;
  }
}

async function installIii(): Promise<boolean> {
  if (process.platform === "win32") {
    p.log.warn("Automatic iii-engine install is not supported on Windows.");
    p.log.info("Install manually: https://iii.dev/docs");
    return false;
  }

  const curlBin = whichBinary("curl");
  if (!curlBin) {
    p.log.warn("curl not found — cannot auto-install iii-engine.");
    return false;
  }

  const shouldInstall = await p.confirm({
    message: "iii-engine is not installed. Install it now?",
    initialValue: true,
  });

  if (p.isCancel(shouldInstall) || !shouldInstall) {
    return false;
  }

  const s = p.spinner();
  s.start("Installing iii-engine...");

  try {
    execSync("curl -fsSL https://install.iii.dev/iii/main/install.sh | sh", {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000,
    });

    const installed = whichBinary("iii");
    if (installed) {
      s.stop("iii-engine installed successfully");
      return true;
    }

    s.stop("Installation completed but iii not found in PATH");
    p.log.warn("You may need to restart your shell or add iii to your PATH.");

    const iiiPaths = [
      join(process.env["HOME"] || "", ".local", "bin", "iii"),
      "/usr/local/bin/iii",
    ];
    for (const iiiPath of iiiPaths) {
      if (existsSync(iiiPath)) {
        p.log.info(`Found iii at: ${iiiPath}`);
        process.env["PATH"] = `${dirname(iiiPath)}:${process.env["PATH"]}`;
        return true;
      }
    }

    return false;
  } catch (err) {
    s.stop("Failed to install iii-engine");
    p.log.error(err instanceof Error ? err.message : String(err));
    return false;
  }
}

async function startEngine(): Promise<boolean> {
  const configPath = findIiiConfig();
  let iiiBin = whichBinary("iii");

  if (!iiiBin) {
    const installed = await installIii();
    if (installed) {
      iiiBin = whichBinary("iii");
    }
  }

  if (iiiBin && configPath) {
    const s = p.spinner();
    s.start(`Starting iii-engine: ${iiiBin}`);
    const child = spawn(iiiBin, ["--config", configPath], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    s.stop("iii-engine process started");
    return true;
  }

  const dockerBin = whichBinary("docker");
  const dockerCompose = join(__dirname, "..", "docker-compose.yml");
  const dcExists = existsSync(dockerCompose) || existsSync(join(process.cwd(), "docker-compose.yml"));

  if (dockerBin && dcExists) {
    const composeFile = existsSync(dockerCompose) ? dockerCompose : join(process.cwd(), "docker-compose.yml");
    const s = p.spinner();
    s.start("Starting iii-engine via Docker...");
    const child = spawn(dockerBin, ["compose", "-f", composeFile, "up", "-d"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    s.stop("Docker compose started");
    return true;
  }

  return false;
}

async function waitForEngine(timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isEngineRunning()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  p.intro("agentmemory");

  if (skipEngine) {
    p.log.info("Skipping engine check (--no-engine)");
    await import("./index.js");
    return;
  }

  if (await isEngineRunning()) {
    p.log.success("iii-engine is running");
    await import("./index.js");
    return;
  }

  const started = await startEngine();
  if (!started) {
    p.log.error("Could not start iii-engine.");
    p.note(
      [
        "Install iii-engine (pick one):",
        "  curl -fsSL https://install.iii.dev/iii/main/install.sh | sh",
        "  cargo install iii-engine",
        "",
        "Or use Docker:",
        "  docker pull iiidev/iii:latest",
        "",
        "Docs: https://iii.dev/docs",
        "",
        "Or skip with: agentmemory --no-engine",
      ].join("\n"),
      "Setup required",
    );
    process.exit(1);
  }

  const s = p.spinner();
  s.start("Waiting for iii-engine to be ready...");

  const ready = await waitForEngine(15000);
  if (!ready) {
    const port = getRestPort();
    s.stop("iii-engine did not become ready within 15s");
    p.log.error(`Check that ports ${port}, ${port + 1}, 49134 are available.`);
    process.exit(1);
  }

  s.stop("iii-engine is ready");
  await import("./index.js");
}

async function runStatus() {
  const port = getRestPort();
  const base = `http://localhost:${port}`;
  p.intro("agentmemory status");

  const up = await isEngineRunning();
  if (!up) {
    p.log.error(`Not running — no response on port ${port}`);
    p.log.info("Start with: npx @agentmemory/agentmemory");
    process.exit(1);
  }

  try {
    const [healthRes, sessionsRes, graphRes] = await Promise.all([
      fetch(`${base}/agentmemory/health`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json()).catch(() => null),
      fetch(`${base}/agentmemory/sessions`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json()).catch(() => null),
      fetch(`${base}/agentmemory/graph/stats`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json()).catch(() => null),
    ]);

    const h = healthRes?.health;
    const status = healthRes?.status || "unknown";
    const version = healthRes?.version || "?";
    const sessions = Array.isArray(sessionsRes?.sessions) ? sessionsRes.sessions.length : 0;
    const memories = h?.workers?.[0]?.function_count || 0;
    const nodes = graphRes?.nodes || 0;
    const edges = graphRes?.edges || 0;
    const cb = healthRes?.circuitBreaker?.state || "closed";
    const heapMB = h?.memory ? Math.round(h.memory.heapUsed / 1048576) : 0;
    const uptime = h?.uptimeSeconds ? Math.round(h.uptimeSeconds) : 0;

    p.log.success(`Connected — v${version} on port ${port}`);

    const lines = [
      `Health:     ${status === "healthy" ? "healthy" : status}`,
      `Sessions:   ${sessions}`,
      `Graph:      ${nodes} nodes, ${edges} edges`,
      `Circuit:    ${cb}`,
      `Heap:       ${heapMB} MB`,
      `Uptime:     ${uptime}s`,
      `Viewer:     http://localhost:${port + 2}`,
    ];
    p.note(lines.join("\n"), "agentmemory");
  } catch (err) {
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

if (args[0] === "status") {
  runStatus().catch((err) => {
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
} else {
  main().catch((err) => {
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
