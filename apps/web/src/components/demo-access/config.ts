// See README.md in this folder — remove before production.

export const GATE_USERNAME = 'heyrobot'
export const GATE_PASSWORD = 'closebuy'
export const GATE_STORAGE_KEY = 'wopla-ai-demo-gate-unlocked'

export type QuickLoginUser = {
  label: string
  email: string
  password: string
}

export const QUICK_LOGIN_USERS: QuickLoginUser[] = [
  { label: 'Admin', email: 'admin@demo.wopla.dk', password: 'wopla-demo-1234' },
  { label: 'Vendor admin', email: 'vendor1@demo.wopla.dk', password: 'wopla-demo-1234' },
  { label: 'Heyrobot · admin', email: 'companyadmin1@demo.wopla.dk', password: 'wopla-demo-1234' },
  { label: 'Heyrobot · employee', email: 'employee1@demo.wopla.dk', password: 'wopla-demo-1234' },
  { label: 'Nordisk · admin', email: 'companyadmin2@demo.wopla.dk', password: 'wopla-demo-1234' },
  { label: 'Nordisk · employee', email: 'employee3@demo.wopla.dk', password: 'wopla-demo-1234' },
]
