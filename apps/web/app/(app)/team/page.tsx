import { requireMembership } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Equipo | Bandeja WhatsApp' }

const ROLE_LABEL: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  agent: 'Agente',
}

export default async function TeamPage() {
  const { supabase, membership, userId } = await requireMembership()

  const { data } = await supabase
    .from('org_members')
    .select('user_id, role, created_at, profiles(email, full_name)')
    .eq('org_id', membership.org_id)
    .order('created_at', { ascending: true })

  return (
    <main className="page">
      <h1>Equipo de {membership.organizations?.name}</h1>
      <p className="page-subtitle">
        Todos los miembros ven la misma bandeja; las conversaciones se pueden asignar a un agente para evitar
        respuestas duplicadas.
      </p>

      <div className="card">
        {(data ?? []).map((member: any) => {
          const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles

          return (
            <div key={member.user_id} className="row-between" style={{ padding: '10px 0' }}>
              <div>
                <strong>{profile?.full_name || profile?.email || member.user_id}</strong>
                {member.user_id === userId ? <span className="muted"> (tu)</span> : null}
                {profile?.full_name && profile?.email ? (
                  <div className="muted" style={{ fontSize: 13 }}>
                    {profile.email}
                  </div>
                ) : null}
              </div>
              <span className="tag-account">{ROLE_LABEL[member.role] ?? member.role}</span>
            </div>
          )
        })}
      </div>

      <p className="muted" style={{ marginTop: 18, fontSize: 13 }}>
        Para sumar a alguien: que cree su cuenta en esta app y luego un administrador agrega su usuario a la
        organizacion (tabla <code>org_members</code> en Supabase).
      </p>
    </main>
  )
}
