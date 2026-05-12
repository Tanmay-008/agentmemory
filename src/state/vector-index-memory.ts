import type { VectorBackend } from "./vector-index.js";

function float32ToBase64(arr: Float32Array): string {
  return Buffer.from(arr.buffer).toString("base64");
}

function base64ToFloat32(b64: string): Float32Array {
  const buf = Buffer.from(b64, "base64");
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export class MemoryVectorIndex implements VectorBackend {
  private vectors: Map<string, { embedding: Float32Array; sessionId: string }> =
    new Map();

  async add(
    obsId: string,
    sessionId: string,
    embedding: Float32Array,
  ): Promise<void> {
    this.vectors.set(obsId, { embedding, sessionId });
  }

  async remove(obsId: string): Promise<void> {
    this.vectors.delete(obsId);
  }

  async search(
    query: Float32Array,
    limit = 20,
  ): Promise<Array<{ obsId: string; sessionId: string; score: number }>> {
    const results: Array<{
      obsId: string;
      sessionId: string;
      score: number;
    }> = [];
    let minScore = -Infinity;

    for (const [obsId, entry] of this.vectors) {
      const score = cosineSimilarity(query, entry.embedding);
      if (results.length < limit) {
        results.push({ obsId, sessionId: entry.sessionId, score });
        if (results.length === limit) {
          results.sort((a, b) => a.score - b.score);
          minScore = results[0].score;
        }
      } else if (score > minScore) {
        results[0] = { obsId, sessionId: entry.sessionId, score };
        results.sort((a, b) => a.score - b.score);
        minScore = results[0].score;
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  get size(): number {
    return this.vectors.size;
  }

  async clear(): Promise<void> {
    this.vectors.clear();
  }

  async restoreFrom(serializedJson: string): Promise<void> {
    let data: unknown;
    try {
      data = JSON.parse(serializedJson);
    } catch {
      return;
    }
    if (!Array.isArray(data)) return;
    this.vectors.clear();
    for (const row of data) {
      try {
        if (!Array.isArray(row) || row.length < 2) continue;
        const [obsId, entry] = row;
        if (
          typeof obsId !== "string" ||
          typeof entry?.embedding !== "string" ||
          typeof entry?.sessionId !== "string"
        )
          continue;
        this.vectors.set(obsId, {
          embedding: base64ToFloat32(entry.embedding),
          sessionId: entry.sessionId,
        });
      } catch {
        continue;
      }
    }
  }

  async serialize(): Promise<string> {
    const data: Array<[string, { embedding: string; sessionId: string }]> = [];
    for (const [obsId, entry] of this.vectors) {
      data.push([
        obsId,
        {
          embedding: float32ToBase64(entry.embedding),
          sessionId: entry.sessionId,
        },
      ]);
    }
    return JSON.stringify(data);
  }
}
