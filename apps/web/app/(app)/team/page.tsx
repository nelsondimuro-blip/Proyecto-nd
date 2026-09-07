import TeamManager, { type InvitationRow, type TeamMemberRow } from '@/components/TeamManager'
import { requireMembership } from '@/lib/auth'
import type { MemberRole } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Equipo | Bandeja WhatsApp' }

export default async function TeamPage() {
  const { supabase, membership, userId } = await requireMembership()

  const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
    supabase
      .from('org_members')
      .select('user_id, role, created_at, profiles(email, full_name)')
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: true }),
    supabase
      .from('org_invitations')
      .select('id, email, role, created_at')
      .eq('org_id', membership.org_id)
      .is('accepted_at', null)
      .order('created_at', { ascending: true }),
  ])

  const members: TeamMemberRow[] = (memberRows ?? []).map((member: any) => {
    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles

    return {
      user_id: member.user_id,
      role: member.role as MemberRole,
      name: profile?.full_name || profile?.email || member.user_id,
      email: profile?.email ?? null,
    }
  })

  return (
    <main className="page">
      <h1>Equipo de {membership.organizations?.name}</h1>
      <p className="page-subtitle">
        Todos los miembros ven la misma bandeja; las conversaciones se pueden asignar a un agente para evitar
        respuestas duplicadas.
      </p>

      <TeamManager
        orgId={membership.org_id}
        currentUserId={userId}
        currentRole={membership.role}
        initialMembers={members}
        initialInvitations={(inviteRows ?? []) as InvitationRow[]}
      />
    </main>
  )
}
