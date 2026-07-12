import { neon } from '@neondatabase/serverless'

// Edge runtime: @neondatabase/serverless talks to Postgres over HTTPS
// (fetch), not a raw TCP socket, so it works without Node's `net` module.
export const config = { runtime: 'edge' }

const sql = neon(process.env.DATABASE_URL!)

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/**
 * Single-user personal app — there's no accounts system, so a sync code
 * plays the role Supabase's magic-link auth + RLS did: a client-generated
 * random secret, hashed before storage, that partitions rows instead of a
 * real user id. Whoever holds the code has full read/write access to that
 * partition (same trust model as a Wi-Fi password) — acceptable for a
 * single-user backup, not for a multi-tenant product.
 */
async function hashSyncCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method === 'GET') {
      const syncCode = new URL(req.url).searchParams.get('syncCode')
      if (!syncCode) return json({ error: 'syncCode required' }, 400)
      const hash = await hashSyncCode(syncCode)
      const rows = await sql`
        select id, text, created_at, tags, deleted_at, meta
        from memories
        where sync_key_hash = ${hash} and deleted_at is null
      `
      return json({ rows })
    }

    if (req.method === 'POST') {
      const body = (await req.json()) as { syncCode?: string; memory?: Record<string, unknown> }
      const { syncCode, memory } = body
      if (!syncCode || !memory?.id) return json({ error: 'syncCode and memory.id required' }, 400)
      const hash = await hashSyncCode(syncCode)
      await sql`
        insert into memories (id, sync_key_hash, text, created_at, tags, deleted_at, meta, updated_at)
        values (
          ${memory.id as string},
          ${hash},
          ${memory.text as string},
          ${memory.created_at as string},
          ${JSON.stringify(memory.tags ?? null)}::jsonb,
          ${(memory.deleted_at as string | null) ?? null},
          ${JSON.stringify(memory.meta ?? {})}::jsonb,
          now()
        )
        on conflict (id) do update set
          text = excluded.text,
          tags = excluded.tags,
          deleted_at = excluded.deleted_at,
          meta = excluded.meta,
          updated_at = now()
        where memories.sync_key_hash = ${hash}
      `
      return json({ ok: true })
    }

    return json({ error: 'method not allowed' }, 405)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
}
