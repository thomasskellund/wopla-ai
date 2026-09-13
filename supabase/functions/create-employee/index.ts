// Creates a login-capable account for a company_admin/employee (tied to a
// company) or an additional vendor_admin (tied to a vendor) — the one
// thing no `security definer` RPC can do, since it needs the service-role
// Auth Admin API. Matches legacy's own pattern (spec §1, confirmed):
// a system-generated temporary password, shown once to the caller, no
// automatic email.
//
// Deno, service-role keyed. Hand-verifies the caller's JWT and role, same
// convention as every other Edge Function in this project — there is no
// shared middleware.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

function randomPassword(length = 12) {
  return Array.from({ length }, () => PASSWORD_CHARS[Math.floor(Math.random() * PASSWORD_CHARS.length)]).join('')
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('missing authorization header')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
      error: callerErr,
    } = await callerClient.auth.getUser()
    if (callerErr || !caller) throw new Error('invalid session')

    const callerRole = caller.app_metadata?.wopla_role as string | undefined
    const callerCompanyId = caller.app_metadata?.company_id as string | undefined
    const callerVendorId = caller.app_metadata?.vendor_id as string | undefined

    const { email, fullName, role, companyId, vendorId } = await req.json()
    if (!email || !fullName || !role) throw new Error('email, fullName, and role are required')
    if (!['employee', 'company_admin', 'vendor_admin'].includes(role)) {
      throw new Error('role must be employee, company_admin, or vendor_admin')
    }
    if ((role === 'employee' || role === 'company_admin') && !companyId) {
      throw new Error('companyId is required for this role')
    }
    if (role === 'vendor_admin' && !vendorId) {
      throw new Error('vendorId is required for a vendor_admin')
    }

    const isAdmin = callerRole === 'admin'
    const isOwnCompanyAdmin =
      callerRole === 'company_admin' && (role === 'employee' || role === 'company_admin') && callerCompanyId === companyId
    const isOwnVendorAdmin = callerRole === 'vendor_admin' && role === 'vendor_admin' && callerVendorId === vendorId

    if (!isAdmin && !isOwnCompanyAdmin && !isOwnVendorAdmin) {
      return jsonResponse({ error: 'not allowed to create this account' }, 403)
    }

    const password = randomPassword()
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createErr || !created.user) throw new Error(createErr?.message ?? 'failed to create the account')

    const { error: profileErr } = await admin.from('profiles').insert({
      id: created.user.id,
      role,
      company_id: role === 'vendor_admin' ? null : companyId,
      vendor_id: role === 'vendor_admin' ? vendorId : null,
      full_name: fullName,
      language: 'da',
    })
    if (profileErr) {
      // Roll back the orphaned auth user rather than leave a login-capable
      // account with no profile row behind.
      await admin.auth.admin.deleteUser(created.user.id)
      throw new Error(profileErr.message)
    }

    return jsonResponse({ email, password })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 400)
  }
})
