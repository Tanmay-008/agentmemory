import type { VectorBackend } from "./vector-index.js";

async function loadNativeDeps(): Promise<{ Database: any; sqliteVec: any } | null> {
  try {
    const Database = (await import("better-sqlite3")).default;
    const sqliteVec = await import("sqlite-vec");
    return { Database, sqliteVec };
  } catch {
    return null;
  }
}

export class SqliteVectorIndex implements VectorBackend {
  private db: any = null;
  private dimensions: number;
  private dbPath: string;
  private initialized = false;

  constructor(dbPath: string, dimensions: number) {
    this.dbPath = dbPath;
    this.dimensions = dimensions;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const deps = await loadNativeDeps();
    if (!deps) {
      throw new Error(
        "[agentmemory] better-sqlite3/sqlite-vec not installed. Run: npm install better-sqlite3 sqlite-vec",
      );
    }

    const { Database, sqliteVec } = deps;
    this.db = new Database(this.dbPath);
    sqliteVec.load(this.db);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vec_meta (
        rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        obs_id TEXT UNIQUE NOT NULL,
        session_id TEXT NOT NULL
      )
    `);

    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_data USING vec0(
        rowid INTEGER PRIMARY KEY,
        embedding float[${this.dimensions}]
      )
    `);

    this.initialized = true;
  }

  async add(
    obsId: string,
    sessionId: string,
    embedding: Float32Array,
  ): Promise<void> {
    await this.ensureInitialized();

    const insert = this.db.transaction(() => {
      const info = this.db
        .prepare("INSERT OR REPLACE INTO vec_meta (obs_id, session_id) VALUES (?, ?)")
        .run(obsId, sessionId);
      this.db
        .prepare("INSERT OR REPLACE INTO vec_data (rowid, embedding) VALUES (?, ?)")
        .run(info.lastInsertRowid, Buffer.from(embedding.buffer));
    });

    insert();
  }

  async remove(obsId: string): Promise<void> {
    await this.ensureInitialized();

    const remove = this.db.transaction(() => {
      const row = this.db
        .prepare("SELECT rowid FROM vec_meta WHERE obs_id = ?")
        .get(obsId) as { rowid: number } | undefined;
      if (!row) return;
      this.db.prepare("DELETE FROM vec_data WHERE rowid = ?").run(row.rowid);
      this.db.prepare("DELETE FROM vec_meta WHERE rowid = ?").run(row.rowid);
    });

    remove();
  }

  async search(
    query: Float32Array,
    limit = 20,
  ): Promise<Array<{ obsId: string; sessionId: string; score: number }>> {
    await this.ensureInitialized();

    const rows = this.db
      .prepare(
        `SELECT v.rowid, v.distance, m.obs_id, m.session_id
         FROM vec_data v
         INNER JOIN vec_meta m ON m.rowid = v.rowid
         WHERE v.embedding MATCH ?
         ORDER BY v.distance
         LIMIT ?`,
      )
      .all(Buffer.from(query.buffer), limit) as Array<{
      rowid: number;
      distance: number;
      obs_id: string;
      session_id: string;
    }>;

    return rows.map((row) => ({
      obsId: row.obs_id,
      sessionId: row.session_id,
      score: 1 - row.distance,
    }));
  }

  get size(): number {
    if (!this.initialized || !this.db) return 0;
    const row = this.db.prepare("SELECT COUNT(*) as cnt FROM vec_meta").get() as {
      cnt: number;
    };
    return row.cnt;
  }

  async clear(): Promise<void> {
    await this.ensureInitialized();
    this.db.exec("DELETE FROM vec_data");
    this.db.exec("DELETE FROM vec_meta");
  }

  async restoreFrom(serializedJson: string): Promise<void> {
    await this.ensureInitialized();

    let data: unknown;
    try {
      data = JSON.parse(serializedJson);
    } catch {
      return;
    }
    if (!Array.isArray(data)) return;

    const insertTx = this.db.transaction(() => {
      for (const row of data as unknown[]) {
        try {
          if (!Array.isArray(row) || row.length < 2) continue;
          const [obsId, entry] = row;
          if (
            typeof obsId !== "string" ||
            typeof entry?.embedding !== "string" ||
            typeof entry?.sessionId !== "string"
          )
            continue;
          const embedding = new Float32Array(
            Buffer.from(entry.embedding, "base64").buffer,
          );
          const info = this.db
            .prepare(
              "INSERT OR REPLACE INTO vec_meta (obs_id, session_id) VALUES (?, ?)",
            )
            .run(obsId, entry.sessionId);
          this.db
            .prepare(
              "INSERT OR REPLACE INTO vec_data (rowid, embedding) VALUES (?, ?)",
            )
            .run(info.lastInsertRowid, Buffer.from(embedding.buffer));
        } catch {
          continue;
        }
      }
    });

    insertTx();
  }

  async serialize(): Promise<string> {
    return "[]";
  }
}
