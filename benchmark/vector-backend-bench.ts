import { MemoryVectorIndex } from "../src/state/vector-index-memory.js";
import { VectorIndex } from "../src/state/vector-index.js";

function randomEmbedding(dims: number): Float32Array {
  const arr = new Float32Array(dims);
  for (let i = 0; i < dims; i++) arr[i] = Math.random() - 0.5;
  const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0));
  if (norm > 0) for (let i = 0; i < dims; i++) arr[i] /= norm;
  return arr;
}

async function benchBackend(
  name: string,
  createIndex: () => VectorIndex,
  vectorCount: number,
  dims: number,
  searchIters: number,
): Promise<{
  name: string;
  vectors: number;
  insertMs: number;
  insertPerVecUs: number;
  searchAvgMs: number;
  searchP50Ms: number;
  searchP99Ms: number;
  memoryMb: number;
}> {
  const index = createIndex();

  const heapBefore = process.memoryUsage().heapUsed;

  const insertStart = performance.now();
  for (let i = 0; i < vectorCount; i++) {
    await index.add(`obs_${i}`, `ses_${i % 100}`, randomEmbedding(dims));
  }
  const insertMs = performance.now() - insertStart;

  const heapAfter = process.memoryUsage().heapUsed;

  const queryVec = randomEmbedding(dims);
  const latencies: number[] = [];

  for (let i = 0; i < 5; i++) {
    await index.search(queryVec, 20);
  }

  for (let i = 0; i < searchIters; i++) {
    const start = performance.now();
    await index.search(queryVec, 20);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const avgMs = latencies.reduce((s, v) => s + v, 0) / latencies.length;
  const p50Ms = latencies[Math.floor(latencies.length * 0.5)];
  const p99Ms = latencies[Math.floor(latencies.length * 0.99)];

  return {
    name,
    vectors: vectorCount,
    insertMs: Math.round(insertMs),
    insertPerVecUs: Math.round((insertMs / vectorCount) * 1000),
    searchAvgMs: +avgMs.toFixed(3),
    searchP50Ms: +p50Ms.toFixed(3),
    searchP99Ms: +p99Ms.toFixed(3),
    memoryMb: Math.round((heapAfter - heapBefore) / 1024 / 1024),
  };
}

async function main() {
  const dims = 384;
  const searchIters = 100;
  const scales = [1_000, 10_000, 50_000, 100_000];

  console.log("=== Vector Backend Benchmark ===\n");
  console.log(`Dimensions: ${dims}, Search iterations: ${searchIters}\n`);

  const results: Array<ReturnType<typeof benchBackend> extends Promise<infer T> ? T : never> = [];

  for (const count of scales) {
    console.log(`--- ${count.toLocaleString()} vectors ---`);

    global.gc?.();
    const memResult = await benchBackend(
      "MemoryVectorIndex",
      () => new VectorIndex(new MemoryVectorIndex()),
      count,
      dims,
      searchIters,
    );
    results.push(memResult);
    console.log(
      `  Memory: insert=${memResult.insertMs}ms, search avg=${memResult.searchAvgMs}ms p50=${memResult.searchP50Ms}ms p99=${memResult.searchP99Ms}ms, heap=${memResult.memoryMb}MB`,
    );

    console.log("");
  }

  console.log("\n=== Summary Table ===\n");
  console.log(
    "| Backend | Vectors | Insert (ms) | Insert/vec (µs) | Search avg (ms) | Search p50 (ms) | Search p99 (ms) | Heap (MB) |",
  );
  console.log(
    "|---------|---------|------------|-----------------|----------------|----------------|----------------|-----------|",
  );
  for (const r of results) {
    console.log(
      `| ${r.name} | ${r.vectors.toLocaleString()} | ${r.insertMs} | ${r.insertPerVecUs} | ${r.searchAvgMs} | ${r.searchP50Ms} | ${r.searchP99Ms} | ${r.memoryMb} |`,
    );
  }

  console.log("\n--- Notes ---");
  console.log("- MemoryVectorIndex: pure JS cosine similarity (O(n) scan)");
  console.log("- SqliteVectorIndex: requires better-sqlite3 + sqlite-vec installed");
  console.log("- To benchmark sqlite-vec, install deps and set VECTOR_BACKEND=sqlite-vec");
}

main().catch(console.error);
