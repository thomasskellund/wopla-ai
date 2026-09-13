import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@wopla-ai/shared'
import { getSupabaseBrowserClient } from '#/lib/supabase/client'

type Weekday = Database['public']['Enums']['weekday']

/** The caller's own company's (or vendor's) standing Lunch order, if any. RLS scopes this to "own" automatically. */
export function useMyOrder() {
  return useQuery({
    queryKey: ['my_order'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.from('orders').select('*').eq('module_id', 1).is('deleted_at', null).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** admin_managed_order isn't a JWT claim (it can change without a re-login), so it's read directly. */
export function useMyCompanyMode(companyId: string | null) {
  return useQuery({
    queryKey: ['my_company_mode', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('companies')
        .select('admin_managed_order')
        .eq('id', companyId as string)
        .single()
      if (error) throw error
      return data.admin_managed_order
    },
  })
}

export function useDishes(vendorId: string | null) {
  return useQuery({
    queryKey: ['dishes', vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('dishes')
        .select('*')
        .eq('vendor_id', vendorId as string)
        .eq('status', 'active')
        .is('deleted_at', null)
      if (error) throw error
      return data
    },
  })
}

export function useCreateDish() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.schema('api').rpc('create_dish', { p_name: name })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dishes'] }),
  })
}

/** Order-bootstrap picker: vendors aren't otherwise visible before a relationship exists. */
export function useAvailableVendors(enabled: boolean) {
  return useQuery({
    queryKey: ['available_vendors'],
    enabled,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.schema('api').rpc('list_available_vendors')
      if (error) throw error
      return data
    },
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { companyId: string; vendorId: string; fromDate: string }) => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.schema('api').rpc('create_order', {
        p_company_id: args.companyId,
        p_vendor_id: args.vendorId,
        p_from_date: args.fromDate,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my_order'] }),
  })
}

export function useMyWeek(orderId: string | null, weekStart: string) {
  return useQuery({
    queryKey: ['my_week', orderId, weekStart],
    enabled: !!orderId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .schema('api')
        .rpc('get_my_week', { p_order_id: orderId as string, p_week_start: weekStart })
      if (error) throw error
      return data
    },
  })
}

export function useSetMyWeeklyPreference(orderId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { weekday: Weekday; dishId: string | null }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('set_my_weekly_preference', {
        p_order_id: orderId as string,
        p_weekday: args.weekday,
        p_dish_id: args.dishId as string,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my_week'] }),
  })
}

export function useSetMyDailyChoice(orderId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { orderDate: string; dishId: string | null }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('set_my_daily_choice', {
        p_order_id: orderId as string,
        p_order_date: args.orderDate,
        p_dish_id: args.dishId as string,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my_week'] }),
  })
}

export function useStandingHeads(orderId: string | null) {
  return useQuery({
    queryKey: ['standing_heads', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.from('order_dish_heads').select('*').eq('order_id', orderId as string)
      if (error) throw error
      return data
    },
  })
}

export function useSaveOrderDishHeads(orderId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { dishId: string; weekdayHeads: Record<string, number> }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('save_order_dish_heads', {
        p_order_id: orderId as string,
        p_dish_id: args.dishId,
        p_weekday_heads: args.weekdayHeads,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['standing_heads', orderId] }),
  })
}

export function useCancelDailyOrder(orderId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { orderDate: string; note?: string }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('cancel_daily_order', {
        p_order_id: orderId as string,
        p_order_date: args.orderDate,
        p_note: args.note,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my_week'] }),
  })
}

export function useUncancelDailyOrder(orderId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderDate: string) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('uncancel_daily_order', {
        p_order_id: orderId as string,
        p_order_date: orderDate,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my_week'] }),
  })
}

export function useVendorHeadcount(vendorId: string | null, orderDate: string) {
  return useQuery({
    queryKey: ['vendor_headcount', vendorId, orderDate],
    enabled: !!vendorId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .schema('api')
        .rpc('get_vendor_headcount', { p_vendor_id: vendorId as string, p_order_date: orderDate })
      if (error) throw error
      return data
    },
  })
}

export function useRecordExtraHeads(vendorId: string | null, orderDate: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { dailyOrderId: string; dishId: string; extraHeads: number; note?: string }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('record_extra_heads', {
        p_daily_order_id: args.dailyOrderId,
        p_dish_id: args.dishId,
        p_extra_heads: args.extraHeads,
        p_note: args.note,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor_headcount', vendorId, orderDate] }),
  })
}
