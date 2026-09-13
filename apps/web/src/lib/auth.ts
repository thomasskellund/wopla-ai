import { createServerFn } from '@tanstack/react-start'
import type { AppRole } from '@wopla-ai/shared'
import { getSupabaseServerClient } from '#/lib/supabase/server'

export type SessionUser = {
  id: string
  email: string
  role: AppRole
  companyId: string | null
  vendorId: string | null
  fullName: string
  language: 'da' | 'en'
  tenantName: string | null
}

/** Reads the authenticated user + Wopla claims from the session cookie. */
export const fetchSessionUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const supabase = getSupabaseServerClient()
    const { data, error } = await supabase.auth.getUser()
    if (error) return null
    const meta = data.user.app_metadata as Record<string, string | undefined>
    const role = meta.wopla_role as AppRole | undefined
    if (!role) return null // no claims -> treat as unauthorised

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, language')
      .eq('id', data.user.id)
      .single()

    let tenantName: string | null = null
    if (meta.company_id) {
      const { data: company } = await supabase.from('companies').select('name').eq('id', meta.company_id).single()
      tenantName = company?.name ?? null
    } else if (meta.vendor_id) {
      const { data: vendor } = await supabase.from('vendors').select('name').eq('id', meta.vendor_id).single()
      tenantName = vendor?.name ?? null
    }

    return {
      id: data.user.id,
      email: data.user.email ?? '',
      role,
      companyId: meta.company_id ?? null,
      vendorId: meta.vendor_id ?? null,
      fullName: profile?.full_name ?? '',
      language: (profile?.language as 'da' | 'en' | undefined) ?? 'da',
      tenantName,
    }
  },
)

export const loginFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) return { error: error.message }
    return { error: null }
  })

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const supabase = getSupabaseServerClient()
  await supabase.auth.signOut()
  return { ok: true }
})
