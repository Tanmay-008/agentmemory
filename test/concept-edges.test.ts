import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerConceptEdgesFunctions } from "../src/functions/concept-edges.js";
import { KV } from "../src/state/schema.js";
import { InMemoryKV } from "../src/mcp/in-memory-kv.js";

const mockSdk = {
  registerFunction: vi.fn(),
  trigger: vi.fn(),
};

describe("Concept Edges", () => {
  let kv: InMemoryKV;

  beforeEach(() => {
    kv = new InMemoryKV();
    vi.clearAllMocks();
    registerConceptEdgesFunctions(mockSdk as any, kv as any);
  });

  it("registers upsert function", () => {
    expect(mockSdk.registerFunction).toHaveBeenCalledWith(
      "mem::concept-edge-upsert",
      expect.any(Function),
    );
  });

  it("creates new edges for concepts", async () => {
    const handler = mockSdk.registerFunction.mock.calls[0][1];
    const result = await handler({ concepts: ["auth", "jwt", "security"] });
    expect(result.success).toBe(true);
    expect(result.created).toBe(3); // (auth, jwt), (auth, security), (jwt, security)
    expect(result.reinforced).toBe(0);

    const edges = await kv.list<any>(KV.conceptEdges);
    expect(edges).toHaveLength(3);
    edges.forEach((e) => {
      expect(e.strength).toBe(0.5);
      expect(e.reinforcements).toBe(0);
    });
  });

  it("reinforces existing edges", async () => {
    const handler = mockSdk.registerFunction.mock.calls[0][1];
    await handler({ concepts: ["auth", "jwt"] }); // creates 1 edge

    const result2 = await handler({ concepts: ["jwt", "auth"] }); // order shouldn't matter
    expect(result2.success).toBe(true);
    expect(result2.created).toBe(0);
    expect(result2.reinforced).toBe(1);

    const edges = await kv.list<any>(KV.conceptEdges);
    expect(edges).toHaveLength(1);
    expect(edges[0].strength).toBeCloseTo(0.55); // 0.5 + 0.1*(1 - 0.5)
    expect(edges[0].reinforcements).toBe(1);
  });

  it("requires at least 2 concepts", async () => {
    const handler = mockSdk.registerFunction.mock.calls[0][1];
    const result = await handler({ concepts: ["auth"] });
    expect(result.success).toBe(false);
    expect(result.error).toBe("at least 2 concepts required");
  });
});
