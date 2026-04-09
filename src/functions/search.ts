import type { ISdk } from 'iii-sdk'
import { getContext } from 'iii-sdk'
import type { CompressedObservation, SearchResult, Session } from '../types.js'
import { KV } from '../state/schema.js'
import { StateKV } from '../state/kv.js'
import { SearchIndex } from '../state/search-index.js'

let index: SearchIndex | null = null

export function getSearchIndex(): SearchIndex {
  if (!index) index = new SearchIndex()
  return index
}

export async function rebuildIndex(kv: StateKV): Promise<number> {
  const idx = getSearchIndex()
  idx.clear()

  const sessions = await kv.list<Session>(KV.sessions)
  if (!sessions.length) return 0

  let count = 0
  const obsPerSession: CompressedObservation[][] = []
  const failedSessions: string[] = []
  for (let batch = 0; batch < sessions.length; batch += 10) {
    const chunk = sessions.slice(batch, batch + 10)
    const results = await Promise.all(
      chunk.map(async (s) => {
        try {
          return await kv.list<CompressedObservation>(KV.observations(s.id))
        } catch {
          failedSessions.push(s.id)
          return [] as CompressedObservation[]
        }
      })
    )
    obsPerSession.push(...results)
  }
  if (failedSessions.length > 0) {
    const ctx = getContext()
    ctx.logger.warn('rebuildIndex: failed to load observations for sessions', { failedSessions })
  }
  for (const observations of obsPerSession) {
    for (const obs of observations) {
      if (obs.title && obs.narrative) {
        idx.add(obs)
        count++
      }
    }
  }
  return count
}

export function registerSearchFunction(sdk: ISdk, kv: StateKV): void {
  sdk.registerFunction(
    { id: 'mem::search', description: 'Search observations by keyword' },
    async (data: { query: string; limit?: number; project?: string; cwd?: string }) => {
      const ctx = getContext()
      const idx = getSearchIndex()

      if (idx.size === 0) {
        const count = await rebuildIndex(kv)
        ctx.logger.info('Search index rebuilt', { entries: count })
      }

      const limit = data.limit || 20
      // When filtering by project/cwd, over-fetch from the index so the
      // post-filter still has a chance of returning `limit` results.
      const filtering = !!(data.project || data.cwd)
      const fetchLimit = filtering ? Math.max(limit * 10, 100) : limit
      const results = idx.search(data.query, fetchLimit)

      // Resolve session -> project/cwd once per sessionId we touch.
      const sessionCache = new Map<string, Session | null>()
      const loadSession = async (sessionId: string): Promise<Session | null> => {
        if (sessionCache.has(sessionId)) return sessionCache.get(sessionId)!
        const s = await kv.get<Session>(KV.sessions, sessionId)
        sessionCache.set(sessionId, s ?? null)
        return s ?? null
      }

      const enriched: SearchResult[] = []
      for (const r of results) {
        if (enriched.length >= limit) break
        if (filtering) {
          const s = await loadSession(r.sessionId)
          if (!s) continue
          if (data.project && s.project !== data.project) continue
          if (data.cwd && s.cwd !== data.cwd) continue
        }
        const obs = await kv.get<CompressedObservation>(KV.observations(r.sessionId), r.obsId)
        if (obs) {
          enriched.push({ observation: obs, score: r.score, sessionId: r.sessionId })
        }
      }

      ctx.logger.info('Search completed', {
        query: data.query,
        results: enriched.length,
        project: data.project,
        cwd: data.cwd,
      })
      return { results: enriched }
    }
  )
}
