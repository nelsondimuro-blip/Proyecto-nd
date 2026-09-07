'use client'

import { useCallback, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PLACEHOLDERS } from '@/lib/quickReplies'
import type { QuickReply } from '@/lib/types'

interface Draft {
  id: string | null
  shortcut: string
  title: string
  body: string
}

const EMPTY: Draft = { id: null, shortcut: '', title: '', body: '' }

export default function QuickRepliesManager({
  orgId,
  userId,
  canManageAll,
  initialReplies,
}: {
  orgId: string
  userId: string
  canManageAll: boolean
  initialReplies: QuickReply[]
}) {
  const [replies, setReplies] = useState(initialReplies)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('quick_replies')
      .select('id, org_id, shortcut, title, body, created_by, usage_count')
      .eq('org_id', orgId)
      .order('usage_count', { ascending: false })

    if (data) setReplies(data as QuickReply[])
  }, [orgId, supabase])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()

    const shortcut = draft.shortcut.trim().toLowerCase()
    const body = draft.body.trim()

    if (!/^[a-z0-9][a-z0-9_-]{0,30}$/.test(shortcut)) {
      setError('El atajo va sin espacios ni acentos: letras, numeros, guion o guion bajo.')
      return
    }

    if (!body) {
      setError('Escribi el texto de la respuesta.')
      return
    }

    setBusy(true)
    setError(null)

    const payload = { org_id: orgId, shortcut, title: draft.title.trim() || null, body }

    const { error: saveError } = draft.id
      ? await supabase.from('quick_replies').update(payload).eq('id', draft.id)
      : await supabase.from('quick_replies').insert(payload)

    if (saveError) {
      setError(
        saveError.code === '23505'
          ? `Ya existe una respuesta con el atajo /${shortcut}.`
          : saveError.message,
      )
    } else {
      setDraft(EMPTY)
      await refresh()
    }

    setBusy(false)
  }

  const remove = async (reply: QuickReply) => {
    if (!confirm(`¿Borrar la respuesta /${reply.shortcut}?`)) return

    setBusy(true)
    const { error: deleteError } = await supabase.from('quick_replies').delete().eq('id', reply.id)

    if (deleteError) setError(deleteError.message)
    else {
      if (draft.id === reply.id) setDraft(EMPTY)
      await refresh()
    }

    setBusy(false)
  }

  return (
    <div>
      {error ? <p className="alert">{error}</p> : null}

      <form className="card" onSubmit={save} style={{ marginBottom: 24 }}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 150px' }}>
            <label htmlFor="shortcut">Atajo</label>
            <input
              id="shortcut"
              value={draft.shortcut}
              placeholder="envio"
              onChange={(event) => setDraft({ ...draft, shortcut: event.target.value })}
              required
            />
          </div>

          <div className="field" style={{ flex: '2 1 240px' }}>
            <label htmlFor="title">Nombre (opcional)</label>
            <input
              id="title"
              value={draft.title}
              placeholder="Costo de envio"
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="body">Texto</label>
          <textarea
            id="body"
            rows={4}
            className="reply-textarea"
            value={draft.body}
            placeholder="Hola {{nombre}}, el envio a tu zona sale $4.500 y llega en 48 h."
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            required
          />
        </div>

        <p className="muted" style={{ margin: '0 0 14px', fontSize: 12.5 }}>
          Variables disponibles:{' '}
          {PLACEHOLDERS.map((placeholder, index) => (
            <span key={placeholder.key}>
              {index > 0 ? ' · ' : ''}
              <code title={placeholder.help}>{`{{${placeholder.key}}}`}</code>
            </span>
          ))}
        </p>

        <div className="row">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Guardando...' : draft.id ? 'Guardar cambios' : 'Crear respuesta'}
          </button>

          {draft.id ? (
            <button type="button" className="btn btn-ghost" onClick={() => setDraft(EMPTY)}>
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      {replies.length === 0 ? (
        <p className="muted">
          Todavia no hay respuestas guardadas. La primera te va a aparecer en el compositor al escribir /.
        </p>
      ) : (
        <div className="rows-card">
          {replies.map((reply) => {
            const editable = canManageAll || reply.created_by === userId

            return (
              <article key={reply.id} className="reply-row">
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="reply-shortcut">/{reply.shortcut}</span>
                    {reply.title ? <strong>{reply.title}</strong> : null}
                    <span className="muted" style={{ fontSize: 12 }}>
                      {reply.usage_count === 0
                        ? 'sin usar'
                        : `${reply.usage_count} uso${reply.usage_count === 1 ? '' : 's'}`}
                    </span>
                  </div>
                  <p className="reply-text">{reply.body}</p>
                </div>

                {editable ? (
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        setDraft({
                          id: reply.id,
                          shortcut: reply.shortcut,
                          title: reply.title ?? '',
                          body: reply.body,
                        })
                      }
                    >
                      Editar
                    </button>
                    <button type="button" className="btn btn-danger" onClick={() => remove(reply)}>
                      Borrar
                    </button>
                  </div>
                ) : (
                  <span className="muted" style={{ fontSize: 12 }}>
                    de otro agente
                  </span>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
