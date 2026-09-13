import { useMutation } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '#/lib/supabase/client'

/** Changes the current user's password after re-verifying the current one. */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (args: { email: string; currentPassword: string; newPassword: string }) => {
      const supabase = getSupabaseBrowserClient()
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: args.email,
        password: args.currentPassword,
      })
      if (verifyError) throw new Error('Current password is incorrect')

      const { error } = await supabase.auth.updateUser({ password: args.newPassword })
      if (error) throw error
    },
  })
}

/** Requests a password-reset email for a logged-out user. */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
    },
  })
}

/** Completes a password reset from the emailed recovery link's session. */
export function useCompletePasswordReset() {
  return useMutation({
    mutationFn: async (newPassword: string) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
    },
  })
}

export function useSetMyLanguage() {
  return useMutation({
    mutationFn: async (args: { profileId: string; language: 'da' | 'en' }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .from('profiles')
        .update({ language: args.language })
        .eq('id', args.profileId)
      if (error) throw error
    },
  })
}
