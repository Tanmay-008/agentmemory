import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerConceptGraphSearchFunction } from "../src/functions/concept-graph-search.js";
import { KV } from "../src/state/schema.js";
import { InMemoryKV } from "../src/mcp/in-memory-kv.js";

const mockSdk = {
  registerFunction: vi.fn(),
  trigger: vi.fn(),
};

describe("Concept Graph Search", () => {
  let kv: InMemoryKV;

  beforeEach(() => {
    kv = new InMemoryKV();
    vi.clearAllMocks();
    registerConceptGraphSearchFunction(mockSdk as any, kv as any);
  });

  it("registers search function", () => {
    expect(mockSdk.registerFunction).toHaveBeenCalledWith(
      "mem::concept-graph-search",
      expect.any(Function),
    );
  });

  it("refuses depth > 2", async () => {
    const handler = mockSdk.registerFunction.mock.calls[0][1];
    const result = await handler({ concepts: ["auth"], depth: 3 });
    expect(result.success).toBe(false);
    expect(result.error).toBe("depth_out_of_range");
  });

  it("expands concepts and finds related memories", async () => {
    // Setup edges
    const now = new Date().toISOString();
    await kv.set(KV.conceptEdges, "ce1", {
      id: "ce1",
      from: "auth",
      to: "jwt",
      strength: 0.8,
      lastSeenAt: now,
    });
    await kv.set(KV.conceptEdges, "ce2", {
      id: "ce2",
      from: "jwt",
      to: "token",
      strength: 0.7,
      lastSeenAt: now,
    });

    // Setup memories
    await kv.set(KV.memories, "m1", {
      id: "m1",
      concepts: ["token", "security"],
      isLatest: true,
      createdAt: now,
    });

    const handler = mockSdk.registerFunction.mock.calls[0][1];
    const result = await handler({ concepts: ["auth"], depth: 2 });
    
    expect(result.success).toBe(true);
    expect(result.expandedConcepts).toContain("auth");
    expect(result.expandedConcepts).toContain("jwt");
    expect(result.expandedConcepts).toContain("token");
    
    expect(result.results).toHaveLength(1);
    expect(result.results[0].memoryId).toBe("m1");
    // Initial score = 1.0 (auth)
    // auth -> jwt score = 1.0 * 0.8 = 0.8
    // jwt -> token score = 0.8 * 0.7 = 0.56
    expect(result.results[0].score).toBeCloseTo(0.56);
  });
});
