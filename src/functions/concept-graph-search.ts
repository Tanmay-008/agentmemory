import type { ISdk } from "iii-sdk";
import type { StateKV } from "../state/kv.js";
import type { ConceptEdge, Memory } from "../types.js";
import { KV } from "../state/schema.js";

const MAX_BFS_DEPTH = 2;
const MAX_NEIGHBORS_PER_NODE = 10;

function decayedStrength(edge: ConceptEdge): number {
  const daysSinceLastSeen =
    (Date.now() - new Date(edge.lastSeenAt).getTime()) / (1000 * 60 * 60 * 24);
  const decay = edge.strength * 0.05 * (daysSinceLastSeen / 7);
  return Math.max(0.05, edge.strength - decay);
}

export function registerConceptGraphSearchFunction(sdk: ISdk, kv: StateKV): void {
  sdk.registerFunction(
    "mem::concept-graph-search",
    async (data: { concepts: string[]; depth?: number; limit?: number }) => {
      if (!data.concepts || data.concepts.length === 0) {
        return { success: false, error: "concepts array is required" };
      }

      const depth = data.depth ?? 2;
      if (depth > MAX_BFS_DEPTH) {
        return {
          success: false,
          error: "depth_out_of_range",
          message: `BFS depth ${depth} exceeds maximum of ${MAX_BFS_DEPTH}`,
        };
      }

      const limit = Math.max(1, Math.min(data.limit ?? 20, 100));
      const allEdges = await kv.list<ConceptEdge>(KV.conceptEdges);

      const adjacency = new Map<string, Array<{ concept: string; strength: number }>>();
      for (const edge of allEdges) {
        const strength = decayedStrength(edge);
        if (strength <= 0.05) continue;

        if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
        if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
        adjacency.get(edge.from)!.push({ concept: edge.to, strength });
        adjacency.get(edge.to)!.push({ concept: edge.from, strength });
      }

      const seedConcepts = data.concepts.map((c) => c.toLowerCase().trim());
      const visited = new Set<string>();
      const conceptScores = new Map<string, number>();

      let frontier = new Set<string>();
      for (const seed of seedConcepts) {
        visited.add(seed);
        conceptScores.set(seed, 1.0);
        frontier.add(seed);
      }

      for (let d = 0; d < depth; d++) {
        const nextFrontier = new Set<string>();
        for (const current of frontier) {
          const neighbors = adjacency.get(current) || [];
          const sorted = neighbors
            .filter((n) => !visited.has(n.concept))
            .sort((a, b) => b.strength - a.strength)
            .slice(0, MAX_NEIGHBORS_PER_NODE);

          for (const neighbor of sorted) {
            if (visited.has(neighbor.concept)) continue;
            visited.add(neighbor.concept);

            const parentScore = conceptScores.get(current) || 0;
            conceptScores.set(neighbor.concept, parentScore * neighbor.strength);
            nextFrontier.add(neighbor.concept);
          }
        }
        frontier = nextFrontier;
      }

      const expandedConcepts = [...conceptScores.keys()];

      const allMemories = await kv.list<Memory>(KV.memories);
      const results: Array<{ memoryId: string; score: number; matchedConcepts: string[] }> = [];

      for (const memory of allMemories) {
        if (memory.isLatest === false) continue;
        const memoryConcepts = memory.concepts.map((c) => c.toLowerCase());
        const matched = memoryConcepts.filter((c) => expandedConcepts.includes(c));
        if (matched.length === 0) continue;

        let score = 0;
        for (const mc of matched) {
          score += conceptScores.get(mc) || 0;
        }
        score = score / matched.length;

        results.push({
          memoryId: memory.id,
          score,
          matchedConcepts: matched,
        });
      }

      results.sort((a, b) => b.score - a.score);

      return {
        success: true,
        results: results.slice(0, limit),
        expandedConcepts,
        depth,
      };
    },
  );
}
