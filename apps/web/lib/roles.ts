import type { MemberRole } from '@/lib/types'

/** Sirve tanto en el servidor como en el navegador (a diferencia de lib/auth). */
export const isAdminRole = (role: MemberRole) => role === 'owner' || role === 'admin'
