import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@wopla-ai/shared'
import { getSupabaseBrowserClient } from '#/lib/supabase/client'

type InvoiceType = Database['public']['Enums']['invoice_type']

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('invoices')
        .select('*, companies(name), vendors(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useInvoice(invoiceId: string | null) {
  return useQuery({
    queryKey: ['invoice', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.schema('api').rpc('get_invoice', { p_invoice_id: invoiceId as string })
      if (error) throw error
      return data
    },
  })
}

export function useInvoiceLineItems(invoiceId: string | null) {
  return useQuery({
    queryKey: ['invoice_line_items', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoiceId as string)
        .order('period_start', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data
    },
  })
}

export function useInvoiceCreditNotes(invoiceId: string | null) {
  return useQuery({
    queryKey: ['invoice_credit_notes', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.from('invoice_credit_notes').select('*').eq('invoice_id', invoiceId as string)
      if (error) throw error
      return data
    },
  })
}

/** Admin-only picker source: every standing order, with company/vendor names for display. */
export function useOrdersForBilling() {
  return useQuery({
    queryKey: ['orders_for_billing'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.from('orders').select('*, companies(name), vendors(name)').is('deleted_at', null)
      if (error) throw error
      return data
    },
  })
}

export function useCompanies() {
  return useQuery({
    queryKey: ['companies_for_billing'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.from('companies').select('id, name').is('deleted_at', null)
      if (error) throw error
      return data
    },
  })
}

export function useVendorsForBilling() {
  return useQuery({
    queryKey: ['vendors_for_billing'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.from('vendors').select('id, name').is('deleted_at', null)
      if (error) throw error
      return data
    },
  })
}

export function useCurrentBillingRate(orderId: string | null) {
  return useQuery({
    queryKey: ['current_billing_rate', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.schema('api').rpc('get_current_billing_rate', { p_order_id: orderId as string })
      if (error) throw error
      return data
    },
  })
}

export function useSetBillingRate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      orderId: string
      vendorPerHeadPrice: number
      companyPerHeadPrice: number
      kickbackPercentage: number
      fromDate: string
      toDate?: string
    }) => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.schema('api').rpc('set_billing_rate', {
        p_order_id: args.orderId,
        p_vendor_per_head_price: args.vendorPerHeadPrice,
        p_company_per_head_price: args.companyPerHeadPrice,
        p_kickback_percentage: args.kickbackPercentage,
        p_from_date: args.fromDate,
        p_to_date: args.toDate,
      })
      if (error) throw error
      return data
    },
    onSuccess: (_data, args) => {
      queryClient.invalidateQueries({ queryKey: ['current_billing_rate', args.orderId] })
    },
  })
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { type: InvoiceType; counterpartyId: string; fromDate: string; toDate: string }) => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.schema('api').rpc('create_invoice', {
        p_type: args.type,
        p_counterparty_id: args.counterpartyId,
        p_from_date: args.fromDate,
        p_to_date: args.toDate,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

function invalidateInvoice(queryClient: ReturnType<typeof useQueryClient>, invoiceId: string) {
  queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
  queryClient.invalidateQueries({ queryKey: ['invoice_line_items', invoiceId] })
  queryClient.invalidateQueries({ queryKey: ['invoice_credit_notes', invoiceId] })
  queryClient.invalidateQueries({ queryKey: ['invoices'] })
}

export function useAddManualLineItem(invoiceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { description: string; quantity: number; unitPrice: number }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('add_manual_line_item', {
        p_invoice_id: invoiceId,
        p_description: args.description,
        p_quantity: args.quantity,
        p_unit_price: args.unitPrice,
      })
      if (error) throw error
    },
    onSuccess: () => invalidateInvoice(queryClient, invoiceId),
  })
}

export function useSubmitInvoice(invoiceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('submit_invoice', { p_invoice_id: invoiceId })
      if (error) throw error
    },
    onSuccess: () => invalidateInvoice(queryClient, invoiceId),
  })
}

export function useMarkInvoicePaid(invoiceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('mark_invoice_paid', { p_invoice_id: invoiceId })
      if (error) throw error
    },
    onSuccess: () => invalidateInvoice(queryClient, invoiceId),
  })
}

export function useRejectInvoice(invoiceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { rejectionReason: string; creditNoteReason: string; creditNoteAmount: number }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('reject_invoice', {
        p_invoice_id: invoiceId,
        p_rejection_reason: args.rejectionReason,
        p_credit_note_reason: args.creditNoteReason,
        p_credit_note_amount: args.creditNoteAmount,
      })
      if (error) throw error
    },
    onSuccess: () => invalidateInvoice(queryClient, invoiceId),
  })
}
