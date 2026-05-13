import type { ISdk } from "iii-sdk";
import type { StateKV } from "../state/kv.js";
import type { ConceptEdge } from "../types.js";
import { KV, fingerprintId } from "../state/schema.js";
import { recordAudit } from "./audit.js";

function reinforceEdge(edge: ConceptEdge): void {
  const now = new Date().toISOString();
  edge.reinforcements++;
  edge.strength = Math.min(
    1.0,
    edge.strength + 0.1 * (1 - edge.strength),
  );
  edge.lastSeenAt = now;
}

function generatePairs(concepts: string[]): Array<[string, string]> {
  const normalized = [...new Set(concepts.map((c) => c.toLowerCase().trim()).filter(Boolean))];
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const [a, b] = normalized[i] < normalized[j]
        ? [normalized[i], normalized[j]]
        : [normalized[j], normalized[i]];
      pairs.push([a, b]);
    }
  }
  return pairs;
}

export function registerConceptEdgesFunctions(sdk: ISdk, kv: StateKV): void {
  sdk.registerFunction(
    "mem::concept-edge-upsert",
    async (data: { concepts?: string[] }) => {
      if (!data.concepts || !Array.isArray(data.concepts) || data.concepts.length < 2) {
        return { success: false, error: "at least 2 concepts required" };
      }

      const pairs = generatePairs(data.concepts);
      if (pairs.length === 0) {
        return { success: true, created: 0, reinforced: 0 };
      }

      const now = new Date().toISOString();
      let created = 0;
      let reinforced = 0;

      const edgeOps = pairs.map(async ([from, to]) => {
        const id = fingerprintId("ce", `${from}|${to}`);
        const existing = await kv.get<ConceptEdge>(KV.conceptEdges, id);

        if (existing) {
          reinforceEdge(existing);
          await kv.set(KV.conceptEdges, id, existing);
          reinforced++;
        } else {
          const edge: ConceptEdge = {
            id,
            from,
            to,
            strength: 0.5,
            reinforcements: 0,
            lastSeenAt: now,
            createdAt: now,
          };
          await kv.set(KV.conceptEdges, id, edge);
          created++;
        }
      });

      await Promise.all(edgeOps);

      try {
        await recordAudit(kv, "concept_edge_upsert", "mem::concept-edge-upsert", [], {
          pairs: pairs.length,
          created,
          reinforced,
        });
      } catch {}

      return { success: true, created, reinforced };
    },
  );
}
