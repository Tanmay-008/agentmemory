import type { ISdk } from "iii-sdk";
import type { StateKV } from "../state/kv.js";
import type { Memory } from "../types.js";
import { KV } from "../state/schema.js";
import { recordAudit } from "./audit.js";
import { logger } from "../logger.js";

const CONFIG_KEY = "concept-backfill-done";

export function registerConceptBackfillFunction(sdk: ISdk, kv: StateKV): void {
  sdk.registerFunction(
    "mem::concept-backfill",
    async () => {
      const flag = await kv.get<{ done: boolean }>(KV.config, CONFIG_KEY);
      if (flag?.done) {
        return { success: true, skipped: true, reason: "already completed" };
      }

      const memories = await kv.list<Memory>(KV.memories);
      const eligible = memories.filter(
        (m) => m.isLatest !== false && m.concepts && m.concepts.length >= 2,
      );

      let processed = 0;
      let errors = 0;
      const batchSize = 50;

      for (let i = 0; i < eligible.length; i += batchSize) {
        const batch = eligible.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((m) =>
            sdk.trigger({
              function_id: "mem::concept-edge-upsert",
              payload: { concepts: m.concepts },
            })
          ),
        );
        for (const res of results) {
          if (res.status === "rejected") errors++;
          else processed++;
        }
      }

      if (errors > 0) {
        throw new Error(`Concept backfill failed to process ${errors} items.`);
      }

      await kv.set(KV.config, CONFIG_KEY, { done: true, completedAt: new Date().toISOString() });

      try {
        await recordAudit(kv, "concept_backfill", "mem::concept-backfill", [], {
          memoriesProcessed: processed,
          totalMemories: memories.length,
        });
      } catch {}

      logger.info("Concept backfill completed", {
        processed,
        total: memories.length,
      });

      return { success: true, processed, total: memories.length };
    },
  );
}
