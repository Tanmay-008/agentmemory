# AAIF Project Proposal — draft for agentmemory

Paste the fields below into <https://github.com/aaif/project-proposals/issues/new?template=project-proposal.yml> when ready.

---

**Project Name**
agentmemory

**Project Description**
agentmemory is a persistent, local-first memory runtime for AI coding agents. It captures session observations via 12 auto-hooks, compresses them into semantic memories, and serves retrieval through a hybrid triple-stream (BM25 + vector + temporal knowledge graph) pipeline — with zero external databases. It ships as three npm packages: `@agentmemory/agentmemory` (the server), `@agentmemory/mcp` (a standalone MCP server), and `@agentmemory/fs-watcher` (a filesystem connector). It has first-party integrations for Claude Code, OpenClaw, Hermes, and Codex CLI, and is MCP-native so any Model Context Protocol client — Cursor, Claude Desktop, Gemini CLI, VS Code, Cline, Windsurf, OpenCode, Goose, Aider — works out of the box. The project was started in January 2026 and is currently at v0.9.0 with 1,786 GitHub stars, 173 forks, and 6 contributors.

**Alignment with AAIF Mission**
agentmemory advances "the public interest in agentic AI innovation" by removing the single biggest failure mode of today's coding agents: loss of context between sessions. It does so under Apache-2.0, without vendor lock-in, and without requiring developers to stand up Redis, Postgres, Qdrant, or Neo4j. All memory is stored locally on the user's machine by default. The project is a direct, neutral consumer of the AAIF-hosted Model Context Protocol — every agentmemory tool is available through the MCP surface — which is the exact category of foundational interoperability AAIF exists to steward.

**Relation to Existing AAIF Projects**
- **Model Context Protocol (MCP)** — agentmemory is a first-class MCP server. The `@agentmemory/mcp` package is a standalone stdio MCP server exposing 44 tools; the main package registers the same tools via in-process MCP. Both pass validation against the MCP reference test suite.
- **goose** — agentmemory works with goose via the same MCP configuration pattern documented for Claude Desktop and Cursor. We plan to ship a goose-specific integration guide in Q3 2026.
- **AGENTS.md** — agentmemory reads `AGENTS.md` at session start and treats its contents as high-confidence context, surfaced ahead of observation-derived memory in the recall pipeline.

**Example Use Cases and Evidence of Adoption**
Core use cases:
1. Cross-session context preservation — "what did I change in the retry logic last Tuesday?" surfaces commit, session, and file-level memories in a single recall call.
2. Team knowledge sharing — the mesh-sync feature pushes curated memories to peer nodes over authenticated HTTPS, enabling shared memory across a dev team.
3. Defect debugging — the session replay feature rehydrates a Claude Code JSONL transcript into full observation form, so a maintainer can re-enter the session that produced a bug.
4. Compliance trails — every structural deletion emits an audit row (scoped for user-initiated actions, batched for automatic sweeps) per the policy in `src/functions/audit.ts`.

Adoption evidence:
- 1,786 GitHub stars, 173 forks, 6 commit contributors as of April 2026.
- Three npm packages published with provenance and downloaded regularly (`npm view @agentmemory/agentmemory`).
- Featured in the Claude Code plugin marketplace as `agentmemory@agentmemory`.
- The [design doc gist](https://gist.github.com/rohitg00/2067ab416f7bbe447c1977edaaa681e2) that seeded the project has 775 stars and 106 forks.
- 95.2% retrieval R@5 on the public LongMemEval-S benchmark, independently reproducible via the in-repo harness.

Production deployments in named organizations: we are compiling case studies now and will update this section as deployers opt in to being listed. The current installation base is primarily individual developers; enterprise case studies are a Q3 2026 roadmap item.

**Technical Committee Sponsor (if identified)**
Not yet identified. We would welcome an introduction.

**GitHub Repository URL**
<https://github.com/rohitg00/agentmemory>

**License**
Apache-2.0 (OSI-approved, permissive). <https://github.com/rohitg00/agentmemory/blob/main/LICENSE>

**Governance Model**
Documented in <https://github.com/rohitg00/agentmemory/blob/main/GOVERNANCE.md>. The model follows the Linux Foundation Minimum Viable Governance pattern, scoped to the project's current single-maintainer reality with a concrete plan (see `ROADMAP.md`) to add at least one additional Maintainer from a different organization during the current growth cycle.

**CI/CD & Release Workflow**
GitHub Actions:
- `.github/workflows/ci.yml` — runs TypeScript build + 777-test Vitest suite on every PR against Node 20 and Node 22.
- `.github/workflows/publish.yml` — triggers on GitHub Releases. Publishes `@agentmemory/agentmemory`, `@agentmemory/mcp`, and `@agentmemory/fs-watcher` to npm with provenance, in order, with registry-propagation wait gates between them. Also exposes `workflow_dispatch` for manual publishes.

Release cadence: minor releases every 2–4 weeks; patch releases as needed. Each release goes through a `release/vX.Y.Z` PR that bumps 8 in-repo version strings in lockstep (see `CONTRIBUTING.md#release-process`), is tagged `vX.Y.Z` on merge, and auto-publishes via the workflow.

**Public-Facing Contribution Process for Specifications**
<https://github.com/rohitg00/agentmemory/blob/main/CONTRIBUTING.md> documents the full PR flow, DCO sign-off requirement, coding style, subsystem layout, and the process for adding new MCP tools and auto-hooks. Non-code / policy changes follow the process in `GOVERNANCE.md#non-pr-decisions` — a `governance`-labeled issue with a 7-day public comment window.

**Publicly Accessible Issue Tracker**
<https://github.com/rohitg00/agentmemory/issues> — no gating, standard labels, issue template for bug reports in `.github/ISSUE_TEMPLATE/`.

**External Project Dependencies**
Runtime:
- `iii-sdk` (Apache-2.0) — three-primitive engine runtime.
- `@anthropic-ai/claude-agent-sdk` (MIT) — default LLM provider when a Claude subscription is detected.
- `@modelcontextprotocol/sdk` (MIT) — MCP server runtime.
- Optional: `@google/generative-ai` (Apache-2.0), `openai` (Apache-2.0), upstream minimax / openrouter — each behind a provider flag.

Build-time only:
- `tsdown` (MIT), `vitest` (MIT), `typescript` (Apache-2.0).

Full lockfile at <https://github.com/rohitg00/agentmemory/blob/main/package-lock.json>.

**Maintainers & Contributors**
Current Maintainers (from `MAINTAINERS.md`):
- Rohit Ghumare ([@rohitg00](https://github.com/rohitg00)) — Independent — project lead, all subsystems.

Named non-Maintainer contributors with merged PRs:
- [@Tanmay-008](https://github.com/Tanmay-008) — retention scoring, semantic eviction routing, multimodal image memory.
- [@JasonLandbridge](https://github.com/JasonLandbridge)
- [@Getty](https://github.com/Getty)
- [@eng-pf](https://github.com/eng-pf) — security fixes.
- [@Garygaoxiang](https://github.com/Garygaoxiang)

Full contributor graph: <https://github.com/rohitg00/agentmemory/graphs/contributors>. We transparently disclose that maintainership is currently single-organization; the Q2–Q3 2026 roadmap commits to changing this.

**Leadership Team & Decision Process**
See `GOVERNANCE.md#decision-making`. Lazy consensus on PRs, formal votes on governance items (simple majority of Maintainers with a 7-day public comment window during single-maintainer periods).

**Roadmap**
<https://github.com/rohitg00/agentmemory/blob/main/ROADMAP.md>. 12 months of planned work broken into four quarterly themes: Depth (Q2), Breadth (Q3), Trust (Q4), v1.0 (Q1 2027).

**Security**
- Security policy at <https://github.com/rohitg00/agentmemory/blob/main/SECURITY.md>.
- Six CVE-tracked v0.8.2 advisories published through GitHub Security Advisories, drafts archived under `.github/security-advisories/`.
- OpenSSF Best Practices Silver-or-better badge: not yet enrolled. Enrollment is a Q3 2026 roadmap item.

**Website URL**
Ships in-repo under [`website/`](https://github.com/rohitg00/agentmemory/tree/main/website) (Next.js 16 App Router, deployable to Vercel with Root Directory = `website/`). Primary documentation remains the repository README.

**Documented Governance Practices (optional)**
See `GOVERNANCE.md` above.

**Links to Social Media Accounts (optional)**
- Author X: <https://x.com/ghumare64>

**Details of Existing Financial Sponsorship (optional)**
None. The project is developed in-kind by the Maintainer.

**Infrastructure Needs or Requests (optional)**
- Continued GitHub Actions CI minutes (currently within the free tier for public repos).
- LF-hosted domain delegation if/when we move from `agentmemory.dev` to a foundation-owned hostname.
- Potential CI time for the LongMemEval-S benchmark harness (Q2 2026 roadmap item) — the harness pulls a ~200 MB dataset and runs under ~15 minutes per release.

**Additional Information**
Applying for **Growth Stage**. We do not currently meet the Impact Stage criterion of "a diverse group of maintainers, with multiple organizations represented"; the `ROADMAP.md` commits to addressing that during the Growth cycle.
