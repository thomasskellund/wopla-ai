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
