'use client'

import { useCallback, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LABEL_PALETTE, chipStyle, nextColor } from '@/lib/labels'
import type { Label } from '@/lib/types'

interface LabelWithUse extends Label {
  uses: number
}

export default function LabelsManager({
  orgId,
  userId,
  canManageAll,
  initialLabels,
}: {
  orgId: string
  userId: string
  canManageAll: boolean
  initialLabels: LabelWithUse[]
}) {
  const [labels, setLabels] = useState(initialLabels)
  const [name, setName] = useState('')
  const [color, setColor] = useState(() => nextColor(initialLabels))
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('labels')
      .select('id, org_id, name, color, created_by, conversation_labels(count)')
      .eq('org_id', orgId)
      .order('name', { ascending: true })

    if (!data) return

    setLabels(
      data.map((row: any) => ({
        id: row.id,
        org_id: row.org_id,
        name: row.name,
        color: row.color,
        created_by: row.created_by,
        uses: row.conversation_labels?.[0]?.count ?? 0,
      })),
    )
  }, [orgId, supabase])

  const reset = () => {
    setEditing(null)
    setName('')
    setColor(nextColor(labels))
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()

    const clean = name.trim()
    if (!clean) return

    setBusy(true)
    setError(null)

    const { error: saveError } = editing
      ? await supabase.from('labels').update({ name: clean, color }).eq('id', editing)
      : await supabase.from('labels').insert({ org_id: orgId, name: clean, color })

    if (saveError) {
      setError(
        saveError.code === '23505' ? `Ya existe una etiqueta llamada "${clean}".` : saveError.message,
      )
    } else {
      reset()
      await refresh()
    }

    setBusy(false)
  }

  const remove = async (label: LabelWithUse) => {
    const question = label.uses
      ? `¿Borrar "${label.name}"? Se va a quitar de ${label.uses} conversacion${label.uses === 1 ? '' : 'es'}.`
      : `¿Borrar la etiqueta "${label.name}"?`

    if (!confirm(question)) return

    setBusy(true)
    const { error: deleteError } = await supabase.from('labels').delete().eq('id', label.id)

    if (deleteError) setError(deleteError.message)
    else {
      if (editing === label.id) reset()
      await refresh()
    }

    setBusy(false)
  }

  return (
    <div>
      {error ? <p className="alert">{error}</p> : null}

      <form className="card" onSubmit={save} style={{ marginBottom: 24 }}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 220px', marginBottom: 0 }}>
            <label htmlFor="label-name">Nombre</label>
            <input
              id="label-name"
              value={name}
              placeholder="Presupuesto enviado"
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="label-color">Color</label>
            <div className="row" id="label-color" style={{ gap: 6 }}>
              {LABEL_PALETTE.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="color-dot"
                  data-active={color === option}
                  style={{ background: option }}
                  aria-label={`Color ${option}`}
                  aria-pressed={color === option}
                  onClick={() => setColor(option)}
                />
              ))}
            </div>
          </div>

          <button className="btn" type="submit" disabled={busy || name.trim().length === 0}>
            {busy ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear etiqueta'}
          </button>

          {editing ? (
            <button type="button" className="btn btn-ghost" onClick={reset}>
              Cancelar
            </button>
          ) : null}
        </div>

        <p className="muted" style={{ margin: '12px 0 0', fontSize: 12.5 }}>
          Vista previa:{' '}
          <span className="label-chip is-static" style={chipStyle(color)}>
            {name.trim() || 'Etiqueta'}
          </span>
        </p>
      </form>

      {labels.length === 0 ? (
        <p className="muted">
          Todavia no hay etiquetas. Tambien se pueden crear desde la conversacion, con “+ Etiqueta”.
        </p>
      ) : (
        <div className="rows-card">
          {labels.map((label) => {
            const editable = canManageAll || label.created_by === userId

            return (
              <div key={label.id} className="row-between member-row">
                <div className="row" style={{ gap: 10 }}>
                  <span className="label-chip is-static" style={chipStyle(label.color)}>
                    {label.name}
                  </span>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {label.uses === 0
                      ? 'sin usar'
                      : `en ${label.uses} conversacion${label.uses === 1 ? '' : 'es'}`}
                  </span>
                </div>

                {editable ? (
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setEditing(label.id)
                        setName(label.name)
                        setColor(label.color)
                      }}
                    >
                      Editar
                    </button>
                    <button type="button" className="btn btn-danger" onClick={() => remove(label)}>
                      Borrar
                    </button>
                  </div>
                ) : (
                  <span className="muted" style={{ fontSize: 12 }}>
                    de otro agente
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
