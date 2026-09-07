'use client'

import { useCallback, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isAdminRole } from '@/lib/roles'
import type { MemberRole } from '@/lib/types'

export interface TeamMemberRow {
  user_id: string
  role: MemberRole
  name: string
  email: string | null
}

export interface InvitationRow {
  id: string
  email: string
  role: MemberRole
  created_at: string
}

const ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  agent: 'Agente',
}

const ROLE_HINT: Record<MemberRole, string> = {
  owner: 'Control total, incluido nombrar otros propietarios.',
  admin: 'Gestiona numeros y equipo, ademas de responder.',
  agent: 'Responde conversaciones de la bandeja.',
}

export default function TeamManager({
  orgId,
  currentUserId,
  currentRole,
  initialMembers,
  initialInvitations,
}: {
  orgId: string
  currentUserId: string
  currentRole: MemberRole
  initialMembers: TeamMemberRow[]
  initialInvitations: InvitationRow[]
}) {
  const [members, setMembers] = useState(initialMembers)
  const [invitations, setInvitations] = useState(initialInvitations)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('agent')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const canManage = isAdminRole(currentRole)
  const isOwner = currentRole === 'owner'

  const refresh = useCallback(async () => {
    const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
      supabase
        .from('org_members')
        .select('user_id, role, created_at, profiles(email, full_name)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true }),
      supabase
        .from('org_invitations')
        .select('id, email, role, created_at')
        .eq('org_id', orgId)
        .is('accepted_at', null)
        .order('created_at', { ascending: true }),
    ])

    if (memberRows) {
      setMembers(
        memberRows.map((member: any) => {
          const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles
          return {
            user_id: member.user_id,
            role: member.role as MemberRole,
            name: profile?.full_name || profile?.email || member.user_id,
            email: profile?.email ?? null,
          }
        }),
      )
    }

    if (inviteRows) setInvitations(inviteRows as InvitationRow[])
  }, [orgId, supabase])

  /** Toda mutacion pasa por aca: un solo lugar donde mostrar el error de Postgres. */
  const run = async (key: string, action: () => Promise<{ error: { message: string } | null }>) => {
    setBusy(key)
    setError(null)
    setNotice(null)

    const { error: opError } = await action()

    if (opError) {
      setError(opError.message)
    } else {
      await refresh()
    }

    setBusy(null)
    return !opError
  }

  const invite = async (event: React.FormEvent) => {
    event.preventDefault()
    const address = email.trim().toLowerCase()
    if (!address) return

    const ok = await run('invite', async () =>
      supabase.from('org_invitations').insert({ org_id: orgId, email: address, role }),
    )

    if (ok) {
      setEmail('')
      setNotice(
        `Invitacion enviada a ${address}. Entra al equipo cuando inicie sesion con ese correo (o al registrarse).`,
      )
    }
  }

  return (
    <div>
      {error ? <p className="alert">{error}</p> : null}
      {notice ? (
        <p className="alert" data-tone="info">
          {notice}
        </p>
      ) : null}

      {canManage ? (
        <form className="card" onSubmit={invite} style={{ marginBottom: 22 }}>
          <div className="row" style={{ alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '2 1 240px', marginBottom: 0 }}>
              <label htmlFor="invite-email">Invitar por correo</label>
              <input
                id="invite-email"
                type="email"
                value={email}
                placeholder="persona@empresa.com"
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="field" style={{ flex: '1 1 160px', marginBottom: 0 }}>
              <label htmlFor="invite-role">Rol</label>
              <select
                id="invite-role"
                value={role}
                onChange={(event) => setRole(event.target.value as MemberRole)}
              >
                <option value="agent">{ROLE_LABEL.agent}</option>
                <option value="admin">{ROLE_LABEL.admin}</option>
                {isOwner ? <option value="owner">{ROLE_LABEL.owner}</option> : null}
              </select>
            </div>

            <button className="btn" type="submit" disabled={busy === 'invite' || email.trim().length === 0}>
              {busy === 'invite' ? 'Invitando...' : 'Invitar'}
            </button>
          </div>

          <p className="muted" style={{ margin: '10px 0 0', fontSize: 12.5 }}>
            {ROLE_HINT[role]}
          </p>
        </form>
      ) : null}

      <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Miembros ({members.length})</h2>

      <div className="card" style={{ marginBottom: 22 }}>
        {members.map((member) => {
          const isSelf = member.user_id === currentUserId
          // Un admin no toca a un propietario; eso lo repite el trigger en la base.
          const editable = canManage && (isOwner || member.role !== 'owner')

          return (
            <div key={member.user_id} className="row-between member-row">
              <div style={{ minWidth: 0 }}>
                <strong>{member.name}</strong>
                {isSelf ? <span className="muted"> (tu)</span> : null}
                {member.email && member.email !== member.name ? (
                  <div className="muted" style={{ fontSize: 13 }}>
                    {member.email}
                  </div>
                ) : null}
              </div>

              <div className="row">
                {editable ? (
                  <select
                    aria-label={`Rol de ${member.name}`}
                    className="chip"
                    value={member.role}
                    disabled={busy === member.user_id}
                    onChange={(event) =>
                      run(member.user_id, async () =>
                        supabase
                          .from('org_members')
                          .update({ role: event.target.value as MemberRole })
                          .eq('org_id', orgId)
                          .eq('user_id', member.user_id),
                      )
                    }
                  >
                    <option value="agent">{ROLE_LABEL.agent}</option>
                    <option value="admin">{ROLE_LABEL.admin}</option>
                    {isOwner ? <option value="owner">{ROLE_LABEL.owner}</option> : null}
                  </select>
                ) : (
                  <span className="tag-account">{ROLE_LABEL[member.role]}</span>
                )}

                {editable ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy === member.user_id}
                    onClick={() => {
                      const question = isSelf
                        ? '¿Salir del equipo? Perderas el acceso a la bandeja.'
                        : `¿Quitar a ${member.name} del equipo?`

                      if (confirm(question)) {
                        void run(member.user_id, async () =>
                          supabase
                            .from('org_members')
                            .delete()
                            .eq('org_id', orgId)
                            .eq('user_id', member.user_id),
                        )
                      }
                    }}
                  >
                    {isSelf ? 'Salir' : 'Quitar'}
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {canManage ? (
        <>
          <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Invitaciones pendientes ({invitations.length})</h2>

          <div className="card">
            {invitations.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No hay invitaciones sin aceptar.
              </p>
            ) : (
              invitations.map((invitation) => (
                <div key={invitation.id} className="row-between member-row">
                  <div>
                    <strong>{invitation.email}</strong>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Invitado como {ROLE_LABEL[invitation.role].toLowerCase()}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy === invitation.id}
                    onClick={() =>
                      run(invitation.id, async () =>
                        supabase.from('org_invitations').delete().eq('id', invitation.id),
                      )
                    }
                  >
                    Cancelar
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
