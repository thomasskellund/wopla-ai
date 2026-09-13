import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '#/lib/supabase/client'

// ------------------------------------------------------------- companies
export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.from('companies').select('*').is('deleted_at', null).order('name')
      if (error) throw error
      return data
    },
  })
}

export function useCreateCompany() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { name: string; address?: string; city?: string; zip?: string; vatNumber?: string }) => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('companies')
        .insert({ name: args.name, address: args.address, city: args.city, zip: args.zip, vat_number: args.vatNumber })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  })
}

export function useUpdateCompany(companyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { name: string; address?: string; city?: string; zip?: string; vatNumber?: string }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .from('companies')
        .update({ name: args.name, address: args.address, city: args.city, zip: args.zip, vat_number: args.vatNumber })
        .eq('id', companyId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  })
}

// ---------------------------------------------------------------- vendors
export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.from('vendors').select('*').is('deleted_at', null).order('name')
      if (error) throw error
      return data
    },
  })
}

export function useCreateVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { name: string; address?: string; city?: string; zip?: string; vatNumber?: string }) => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('vendors')
        .insert({ name: args.name, address: args.address, city: args.city, zip: args.zip, vat_number: args.vatNumber })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
  })
}

export function useUpdateVendor(vendorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { name: string; address?: string; city?: string; zip?: string; vatNumber?: string }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .from('vendors')
        .update({ name: args.name, address: args.address, city: args.city, zip: args.zip, vat_number: args.vatNumber })
        .eq('id', vendorId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
  })
}

// -------------------------------------------------------------- employees
export function useCompanyEmployees(companyId: string | null) {
  return useQuery({
    queryKey: ['company_employees', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', companyId as string)
        .is('deleted_at', null)
        .order('full_name')
      if (error) throw error
      return data
    },
  })
}

export function useVendorStaff(vendorId: string | null) {
  return useQuery({
    queryKey: ['vendor_staff', vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('vendor_id', vendorId as string)
        .is('deleted_at', null)
        .order('full_name')
      if (error) throw error
      return data
    },
  })
}

type CreateAccountRole = 'employee' | 'company_admin' | 'vendor_admin'

/** Creates a real login-capable account (Edge Function — the one thing no RPC can do). */
export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      email: string
      fullName: string
      role: CreateAccountRole
      companyId?: string
      vendorId?: string
    }) => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.functions.invoke<{ email: string; password: string; error?: string }>(
        'create-employee',
        {
          body: { email: args.email, fullName: args.fullName, role: args.role, companyId: args.companyId, vendorId: args.vendorId },
        },
      )
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data as { email: string; password: string }
    },
    onSuccess: (_data, args) => {
      if (args.companyId) queryClient.invalidateQueries({ queryKey: ['company_employees', args.companyId] })
      if (args.vendorId) queryClient.invalidateQueries({ queryKey: ['vendor_staff', args.vendorId] })
    },
  })
}

export function useSetEmployeeStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { profileId: string; status: 'active' | 'inactive'; companyId?: string; vendorId?: string }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.from('profiles').update({ status: args.status }).eq('id', args.profileId)
      if (error) throw error
    },
    onSuccess: (_data, args) => {
      if (args.companyId) queryClient.invalidateQueries({ queryKey: ['company_employees', args.companyId] })
      if (args.vendorId) queryClient.invalidateQueries({ queryKey: ['vendor_staff', args.vendorId] })
    },
  })
}

// --------------------------------------------------------- working days
export function useCompanyWorkingDays(companyId: string | null) {
  return useQuery({
    queryKey: ['company_working_days', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('company_working_days')
        .select('*')
        .eq('company_id', companyId as string)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useSetCompanyWorkingDays(companyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      mon: boolean
      tue: boolean
      wed: boolean
      thu: boolean
      fri: boolean
      sat: boolean
      sun: boolean
    }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('set_company_working_days', {
        p_company_id: companyId,
        p_mon: args.mon,
        p_tue: args.tue,
        p_wed: args.wed,
        p_thu: args.thu,
        p_fri: args.fri,
        p_sat: args.sat,
        p_sun: args.sun,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company_working_days', companyId] }),
  })
}

// ------------------------------------------------------------- holidays
export function usePublicHolidays() {
  return useQuery({
    queryKey: ['public_holidays'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.from('public_holidays').select('*').order('holiday_date')
      if (error) throw error
      return data
    },
  })
}

export function useCreatePublicHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { name: string; holidayDate: string }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .schema('api')
        .rpc('create_public_holiday', { p_name: args.name, p_holiday_date: args.holidayDate })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public_holidays'] }),
  })
}

export function useDeletePublicHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('delete_public_holiday', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public_holidays'] }),
  })
}

export function useCompanyHolidays(companyId: string | null) {
  return useQuery({
    queryKey: ['company_holidays', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('company_holidays')
        .select('*')
        .eq('company_id', companyId as string)
        .order('holiday_date')
      if (error) throw error
      return data
    },
  })
}

export function useCreateCompanyHoliday(companyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (holidayDate: string) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .schema('api')
        .rpc('create_company_holiday', { p_company_id: companyId, p_holiday_date: holidayDate })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company_holidays', companyId] }),
  })
}

export function useDeleteCompanyHoliday(companyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('delete_company_holiday', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company_holidays', companyId] }),
  })
}

export function useEmployeeAbsences(profileId: string | null) {
  return useQuery({
    queryKey: ['employee_absences', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('employee_absences')
        .select('*')
        .eq('profile_id', profileId as string)
        .order('absence_date')
      if (error) throw error
      return data
    },
  })
}

export function useCreateEmployeeAbsence(profileId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (absenceDate: string) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .schema('api')
        .rpc('create_employee_absence', { p_profile_id: profileId, p_absence_date: absenceDate })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employee_absences', profileId] }),
  })
}

export function useDeleteEmployeeAbsence(profileId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('delete_employee_absence', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employee_absences', profileId] }),
  })
}

// --------------------------------------------------------- grace period
export function useGracePeriod(companyId: string | null, moduleId = 1) {
  return useQuery({
    queryKey: ['company_grace_period', companyId, moduleId],
    enabled: !!companyId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('grace_periods')
        .select('*')
        .eq('company_id', companyId as string)
        .eq('module_id', moduleId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useSetGracePeriod(companyId: string, moduleId = 1) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      minorUpdateDays: number
      minorUpdateTime: string
      majorUpdateDays: number
      majorUpdateTime: string
      cancellationDays: number
      cancellationTime: string
      cancelGracePeriod: boolean
      threshold: number
    }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('set_grace_period', {
        p_company_id: companyId,
        p_module_id: moduleId,
        p_minor_update_days: args.minorUpdateDays,
        p_minor_update_time: args.minorUpdateTime,
        p_major_update_days: args.majorUpdateDays,
        p_major_update_time: args.majorUpdateTime,
        p_cancellation_days: args.cancellationDays,
        p_cancellation_time: args.cancellationTime,
        p_cancel_grace_period: args.cancelGracePeriod,
        p_threshold: args.threshold,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company_grace_period', companyId, moduleId] }),
  })
}
