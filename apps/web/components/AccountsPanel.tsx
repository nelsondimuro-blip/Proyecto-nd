'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AccountStatus, WhatsAppAccount } from '@/lib/types'

const STATUS_LABEL: Record<AccountStatus, string> = {
  disconnected: 'Desconectado',
  connecting: 'Conectando...',
  qr: 'Esperando escaneo del QR',
  connected: 'Conectado',
  logged_out: 'Sesion cerrada',
  error: 'Error',
}

export default function AccountsPanel({
  initialAccounts,
  orgId,
  canManage,
}: {
  initialAccounts: WhatsAppAccount[]
  orgId: string
  canManage: boolean
}) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  // El QR y los cambios de estado los escribe el gateway: se ven por Realtime.
  useEffect(() => {
    const channel = supabase
      .channel(`accounts:${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_accounts', filter: `org_id=eq.${orgId}` },
        () => {
          void supabase
            .from('whatsapp_accounts')
            .select('*')
            .eq('org_id', orgId)
            .order('created_at', { ascending: true })
            .then(({ data }) => {
              if (data) setAccounts(data as WhatsAppAccount[])
            })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [orgId, supabase])

  const call = async (key: string, path: string, method: string, body?: unknown) => {
    setBusy(key)
    setError(null)

    try {
      const response = await fetch(path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? `La operacion fallo (${response.status})`)
      }

      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    } finally {
      setBusy(null)
    }
  }

  const createAccount = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = label.trim()
    if (!name) return

    if (await call('create', '/api/accounts', 'POST', { label: name })) setLabel('')
  }

  return (
    <div>
      {error ? <p className="alert">{error}</p> : null}

      {canManage ? (
        <form className="card" onSubmit={createAccount} style={{ marginBottom: 22 }}>
          <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label htmlFor="label">Agregar un numero</label>
              <input
                id="label"
                value={label}
                placeholder="Ej. Ventas, Soporte, Sucursal Centro"
                onChange={(event) => setLabel(event.target.value)}
              />
            </div>
            <button className="btn" type="submit" disabled={busy === 'create' || label.trim().length === 0}>
              {busy === 'create' ? 'Creando...' : 'Agregar'}
            </button>
          </div>
          <p className="muted" style={{ margin: '10px 0 0', fontSize: 12.5 }}>
            Al conectar se muestra un QR: escanealo desde WhatsApp &gt; Dispositivos vinculados.
          </p>
        </form>
      ) : null}

      {accounts.length === 0 ? (
        <p className="muted">Todavia no hay numeros cargados.</p>
      ) : (
        <div className="card-grid">
          {accounts.map((account) => (
            <article key={account.id} className="card">
              <div className="row-between">
                <div>
                  <strong>{account.label}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {account.phone_number ? `+${account.phone_number}` : 'Sin vincular'}
                  </div>
                </div>
                <span className="row" style={{ fontSize: 12.5 }}>
                  <span className="status-dot" data-status={account.status} />
                  {STATUS_LABEL[account.status]}
                </span>
              </div>

              {account.last_error ? (
                <p className="alert" style={{ marginTop: 12 }}>
                  {account.last_error}
                </p>
              ) : null}

              {account.status === 'qr' && account.qr_code ? (
                <div>
                  <div className="qr-frame">
                    <img src={account.qr_code} alt={`Codigo QR para vincular ${account.label}`} />
                  </div>
                  <p className="muted" style={{ textAlign: 'center', fontSize: 12.5 }}>
                    El codigo se renueva solo cada minuto hasta que lo escanees.
                  </p>
                </div>
              ) : null}

              {canManage ? (
                <div className="row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
                  {account.status !== 'connected' ? (
                    <button
                      className="btn"
                      type="button"
                      disabled={busy === account.id}
                      onClick={() => call(account.id, `/api/accounts/${account.id}/connect`, 'POST')}
                    >
                      {account.status === 'qr' ? 'Regenerar QR' : 'Conectar'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-ghost"
                      type="button"
                      disabled={busy === account.id}
                      onClick={() => call(account.id, `/api/accounts/${account.id}/disconnect`, 'POST')}
                    >
                      Pausar
                    </button>
                  )}

                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={busy === account.id}
                    onClick={() => call(account.id, `/api/accounts/${account.id}/logout`, 'POST')}
                  >
                    Desvincular
                  </button>

                  <button
                    className="btn btn-danger"
                    type="button"
                    disabled={busy === account.id}
                    onClick={() => {
                      if (confirm(`¿Eliminar "${account.label}" y todas sus conversaciones?`)) {
                        void call(account.id, `/api/accounts/${account.id}`, 'DELETE')
                      }
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
