import { createServerClient } from '@supabase/ssr'
import { getCookies, setCookie } from '@tanstack/react-start/server'
import type { Database } from '@wopla-ai/shared'

export function getSupabaseServerClient() {
  return createServerClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll(): { name: string; value: string }[] {
          return Object.entries(getCookies()).map(([name, value]) => ({ name, value }))
        },
        setAll(cookies: { name: string; value: string; options?: object }[]) {
          for (const { name, value, options } of cookies) {
            setCookie(name, value, options)
          }
        },
      },
    },
  )
}
