import type { ISdk } from "iii-sdk";
import type {
  CompactSearchResult,
  CompressedObservation,
  HybridSearchResult,
  Memory,
} from "../types.js";
import { KV } from "../state/schema.js";
import { StateKV } from "../state/kv.js";
import { recordAccessBatch } from "./access-tracker.js";
import { logger } from "../logger.js";

export function registerSmartSearchFunction(
  sdk: ISdk,
  kv: StateKV,
  searchFn: (query: string, limit: number) => Promise<HybridSearchResult[]>,
): void {
  sdk.registerFunction("mem::smart-search", 
    async (data: {
      query?: string;
      expandIds?: Array<string | { obsId: string; sessionId: string }>;
      limit?: number;
      mode?: "graph";
    }) => {

      if (data.expandIds && data.expandIds.length > 0) {
        const raw = data.expandIds.slice(0, 20);
        const items = raw.map((entry) => {
          if (typeof entry === "string") return { obsId: entry, sessionId: undefined as string | undefined };
          if (entry && typeof entry === "object" && typeof (entry as any).obsId === "string") {
            return { obsId: (entry as any).obsId, sessionId: (entry as any).sessionId as string | undefined };
          }
          return null;
        }).filter((item): item is NonNullable<typeof item> => item !== null);

        const expanded: Array<{
          obsId: string;
          sessionId: string;
          observation: CompressedObservation;
        }> = [];

        const results = await Promise.all(
          items.map(({ obsId, sessionId }) =>
            findObservation(kv, obsId, sessionId).then((obs) =>
              obs ? { obsId, sessionId: obs.sessionId, observation: obs } : null,
            ),
          ),
        );
        for (const r of results) {
          if (r) expanded.push(r);
        }

        void recordAccessBatch(
          kv,
          expanded.map((e) => e.observation.id),
        );

        const truncated = data.expandIds.length > raw.length;
        logger.info("Smart search expanded", {
          requested: data.expandIds.length,
          attempted: raw.length,
          returned: expanded.length,
          truncated,
        });
        return { mode: "expanded", results: expanded, truncated };
      }

      if (!data.query || typeof data.query !== "string" || !data.query.trim()) {
        return { mode: "compact", results: [], error: "query is required" };
      }

      const limit = Math.max(1, Math.min(data.limit ?? 20, 100));
      const hybridResults = await searchFn(data.query, limit);

      const compact: CompactSearchResult[] = hybridResults.map((r) => ({
        obsId: r.observation.id,
        sessionId: r.sessionId,
        title: r.observation.title,
        type: r.observation.type,
        score: r.combinedScore,
        timestamp: r.observation.timestamp,
      }));

      void recordAccessBatch(
        kv,
        compact.map((r) => r.obsId),
      );

      if (data.mode === "graph") {
        try {
          const graphResult = await sdk.trigger<
            { concepts: string[]; depth: number; limit: number },
            { success: boolean; results?: Array<{ memoryId: string; score: number; matchedConcepts: string[] }> }
          >({
            function_id: "mem::concept-graph-search",
            payload: {
              concepts: data.query.split(/\s+/).filter((t) => t.length > 1),
              depth: 2,
              limit,
            },
          });

          if (graphResult.results && graphResult.results.length > 0) {
            const existingObsIds = new Set(compact.map((r) => r.obsId));
            const memories = await kv.list<Memory>(KV.memories);
            const memoryMap = new Map(memories.map((m) => [m.id, m]));

            for (const gr of graphResult.results) {
              const mem = memoryMap.get(gr.memoryId);
              if (!mem) continue;
              for (const obsId of mem.sourceObservationIds || []) {
                if (existingObsIds.has(obsId)) continue;
                existingObsIds.add(obsId);
                compact.push({
                  obsId,
                  sessionId: "",
                  title: mem.title,
                  type: mem.type as any,
                  score: gr.score * 0.8,
                  timestamp: mem.createdAt,
                });
              }
            }

            compact.sort((a, b) => b.score - a.score);
            compact.splice(limit);
          }
        } catch {}
      }

      logger.info("Smart search compact", {
        query: data.query,
        results: compact.length,
        mode: data.mode,
      });
      return { mode: data.mode === "graph" ? "graph" : "compact", results: compact };
    },
  );
}

async function findObservation(
  kv: StateKV,
  obsId: string,
  sessionIdHint?: string,
): Promise<CompressedObservation | null> {
  if (sessionIdHint) {
    const obs = await kv
      .get<CompressedObservation>(KV.observations(sessionIdHint), obsId)
      .catch(() => null);
    if (obs) return obs;
  }

  const sessions = await kv.list<{ id: string }>(KV.sessions);
  for (let i = 0; i < sessions.length; i += 5) {
    const batch = sessions.slice(i, i + 5);
    const results = await Promise.all(
      batch.map((s) =>
        kv.get<CompressedObservation>(KV.observations(s.id), obsId).catch(() => null),
      ),
    );
    const found = results.find((r) => r !== null);
    if (found) return found;
  }
  return null;
}
