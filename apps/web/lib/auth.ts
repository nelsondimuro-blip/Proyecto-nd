import { redirect } from 'next/navigation'
import { isAdminRole } from '@/lib/roles'
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

  const readMembership = async () =>
    supabase
      .from('org_members')
      .select('org_id, role, organizations(id, name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

  let { data } = await readMembership()

  // Invitado antes de tener cuenta en el equipo: al entrar, la invitacion
  // pendiente para su correo lo suma automaticamente.
  if (!data) {
    const { data: accepted } = await supabase.rpc('accept_pending_invitations')
    if (typeof accepted === 'number' && accepted > 0) {
      data = (await readMembership()).data
    }
  }

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

export const isAdmin = isAdminRole
