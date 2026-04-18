# Security Policy

## Reporting a vulnerability

**Do not open a public GitHub issue for a suspected vulnerability.**

Use one of:

- **GitHub Security Advisories** — private report form at <https://github.com/rohitg00/agentmemory/security/advisories/new>. This is the preferred channel. GitHub routes the report to the Maintainers and assigns a GHSA identifier. You stay in a private thread with us until the fix ships.
- **Email** — `ghumare64@gmail.com` with subject `agentmemory security`. Please do not encrypt the mail unless you and we have already exchanged keys.

Include, at minimum:

- agentmemory version (`npm view @agentmemory/agentmemory version` against your install).
- The affected surface — REST endpoint, MCP tool, hook, CLI flag, or filesystem layout.
- A minimal reproduction — prefer one curl invocation or one MCP tool call plus the environment state required.
- Impact, in your own words.

## What we do with it

1. **Acknowledge** within 72 hours (target: 24).
2. **Triage** — confirm reproduction, assign a severity using CVSS 3.1, and give you a rough timeline.
3. **Fix** in a private branch. Draft a GitHub Security Advisory with the patched version, CWE, CVSS vector, affected versions, and attribution to you (unless you prefer anonymity).
4. **Coordinate disclosure** — we agree a disclosure date with you. Default window is 30 days from acknowledgment for straightforward vulnerabilities, up to 90 days for ones that need a deep refactor.
5. **Publish** — release the patched version on npm, publish the advisory, update `CHANGELOG.md` under a `### Security` section for the release, notify downstream scanners.

## Supported versions

| Version | Security fixes? |
|-|-|
| Latest minor (currently `0.9.x`) | Yes |
| Previous minor (currently `0.8.x`) | Critical / High severity only, for 90 days after a new minor releases |
| Older | No |

At v1.0 this policy switches to a stated LTS window per the roadmap.

## Scope

In scope:

- The `@agentmemory/agentmemory` server (REST + MCP surface, hook handlers, state store).
- The `@agentmemory/mcp` standalone MCP server.
- The `@agentmemory/fs-watcher` connector.
- First-party integrations under `integrations/` (`hermes/`, `openclaw/`, `filesystem-watcher/`).
- The Claude Code plugin under `plugin/`.

Out of scope:

- Third-party MCP clients consuming agentmemory — report to those projects.
- `iii-sdk` upstream — report to the iii project.
- The marketing site under `website/` unless the issue affects user security (XSS against visitors, credential leak in build output).

## Past advisories

See the [`.github/security-advisories/`](./.github/security-advisories) directory for advisory drafts. Published advisories (with assigned GHSA IDs) live at <https://github.com/rohitg00/agentmemory/security/advisories>.

## Safe harbor

Good-faith research, reported privately, does not get legal heat from the project. Research targeting third-party deployments of agentmemory is not covered — that's between you and the deployer.
