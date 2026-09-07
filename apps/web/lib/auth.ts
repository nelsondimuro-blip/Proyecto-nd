import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Membership, MemberRole } from '@/lib/types'

/**
 * Membresia del usuario actual. Un usuario pertenece a una organizacion
 * (el grupo de negocios); si pertenece a varias se toma la primera.
 */
export async function getMembership(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string | null
  email: string | null
  membership: Membership | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { supabase, userId: null, email: null, membership: null }

  const { data } = await supabase
    .from('org_members')
    .select('org_id, role, organizations(id, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const membership = data
    ? ({
        org_id: data.org_id,
        role: data.role as MemberRole,
        organizations: Array.isArray(data.organizations)
          ? (data.organizations[0] ?? null)
          : (data.organizations ?? null),
      } satisfies Membership)
    : null

  return { supabase, userId: user.id, email: user.email ?? null, membership }
}

/** Igual que getMembership pero redirige: para usar en paginas. */
export async function requireMembership() {
  const result = await getMembership()

  if (!result.userId) redirect('/login')
  if (!result.membership) redirect('/onboarding')

  return {
    supabase: result.supabase,
    userId: result.userId,
    email: result.email,
    membership: result.membership,
  }
}

export const isAdmin = (role: MemberRole) => role === 'owner' || role === 'admin'
