import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@wopla-ai/shared'

let client: ReturnType<typeof createBrowserClient<Database>> | undefined

export function getSupabaseBrowserClient() {
  client ??= createBrowserClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
  )
  return client
}

/**
 * Hand Realtime the *user's* JWT before subscribing. `anon` has zero table
 * grants, so a socket that joins with only the anon apikey gets rejected
 * outright on `postgres_changes` filters — the join payload doesn't carry
 * the session token on its own.
 */
export async function authorizeRealtime() {
  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) await supabase.realtime.setAuth(token)
  return supabase
}
