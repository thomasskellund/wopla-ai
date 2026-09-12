export const DEMO_PASSWORD = 'wopla-demo-1234'

export const APP_ROLES = ['admin', 'vendor_admin', 'company_admin', 'employee'] as const
export type AppRole = (typeof APP_ROLES)[number]

export * from './database.types'
