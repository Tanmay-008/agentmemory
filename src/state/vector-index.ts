export interface VectorBackend {
  add(obsId: string, sessionId: string, embedding: Float32Array): Promise<void>;
  remove(obsId: string): Promise<void>;
  search(
    query: Float32Array,
    limit?: number,
  ): Promise<Array<{ obsId: string; sessionId: string; score: number }>>;
  readonly size: number;
  clear(): Promise<void>;
  restoreFrom(serializedJson: string): Promise<void>;
  serialize(): Promise<string>;
}

export class VectorIndex {
  constructor(private backend: VectorBackend) {}

  async add(
    obsId: string,
    sessionId: string,
    embedding: Float32Array,
  ): Promise<void> {
    return this.backend.add(obsId, sessionId, embedding);
  }

  async remove(obsId: string): Promise<void> {
    return this.backend.remove(obsId);
  }

  async search(
    query: Float32Array,
    limit = 20,
  ): Promise<Array<{ obsId: string; sessionId: string; score: number }>> {
    return this.backend.search(query, limit);
  }

  get size(): number {
    return this.backend.size;
  }

  async clear(): Promise<void> {
    return this.backend.clear();
  }

  async restoreFrom(serializedJson: string): Promise<void> {
    return this.backend.restoreFrom(serializedJson);
  }

  async serialize(): Promise<string> {
    return this.backend.serialize();
  }
}
