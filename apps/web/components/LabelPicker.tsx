'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { chipStyle, nextColor } from '@/lib/labels'
import type { Label } from '@/lib/types'

/**
 * Etiquetas de la conversacion abierta: se agregan, se quitan y se pueden
 * crear sobre la marcha escribiendo un nombre que todavia no existe.
 */
export default function LabelPicker({
  conversationId,
  orgId,
  labels,
  allLabels,
  onChange,
}: {
  conversationId: string
  orgId: string
  labels: Label[]
  allLabels: Label[]
  onChange: (labels: Label[], catalog?: Label[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!open) return

    const onClickOutside = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)

    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  const applied = new Set(labels.map((label) => label.id))
  const needle = query.trim().toLowerCase()
  const matches = allLabels.filter((label) => label.name.toLowerCase().includes(needle))
  const exact = allLabels.some((label) => label.name.toLowerCase() === needle)

  const attach = async (label: Label) => {
    setBusy(true)
    setError(null)

    const { error: attachError } = await supabase
      .from('conversation_labels')
      .insert({ conversation_id: conversationId, label_id: label.id })

    if (attachError) setError(attachError.message)
    else onChange([...labels, label].sort((a, b) => a.name.localeCompare(b.name, 'es')))

    setBusy(false)
    setQuery('')
  }

  const detach = async (label: Label) => {
    setBusy(true)
    setError(null)

    const { error: detachError } = await supabase
      .from('conversation_labels')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('label_id', label.id)

    if (detachError) setError(detachError.message)
    else onChange(labels.filter((item) => item.id !== label.id))

    setBusy(false)
  }

  const createAndAttach = async () => {
    const name = query.trim()
    if (!name) return

    setBusy(true)
    setError(null)

    const { data, error: createError } = await supabase
      .from('labels')
      .insert({ org_id: orgId, name, color: nextColor(allLabels) })
      .select('id, org_id, name, color, created_by')
      .single()

    if (createError || !data) {
      setError(createError?.message ?? 'No se pudo crear la etiqueta')
      setBusy(false)
      return
    }

    const label = data as Label

    const { error: attachError } = await supabase
      .from('conversation_labels')
      .insert({ conversation_id: conversationId, label_id: label.id })

    if (attachError) setError(attachError.message)
    else {
      onChange(
        [...labels, label].sort((a, b) => a.name.localeCompare(b.name, 'es')),
        [...allLabels, label],
      )
    }

    setBusy(false)
    setQuery('')
  }

  return (
    <div className="label-picker" ref={boxRef}>
      <div className="label-strip">
        {labels.map((label) => (
          <button
            key={label.id}
            type="button"
            className="label-chip"
            style={chipStyle(label.color)}
            disabled={busy}
            title={`Quitar ${label.name}`}
            onClick={() => detach(label)}
          >
            {label.name} <span aria-hidden>✕</span>
          </button>
        ))}

        <button
          type="button"
          className="chip"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          + Etiqueta
        </button>
      </div>

      {open ? (
        <div className="label-menu">
          <input
            className="search"
            style={{ margin: '8px 10px' }}
            autoFocus
            value={query}
            placeholder="Buscar o crear"
            aria-label="Buscar o crear etiqueta"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && needle && !exact) {
                event.preventDefault()
                void createAndAttach()
              }
            }}
          />

          {error ? (
            <p className="alert" style={{ margin: '0 10px 8px' }}>
              {error}
            </p>
          ) : null}

          <div className="label-options">
            {matches.map((label) => (
              <button
                key={label.id}
                type="button"
                className="label-option"
                disabled={busy}
                onClick={() => (applied.has(label.id) ? detach(label) : attach(label))}
              >
                <span className="label-dot" style={{ background: label.color }} />
                <span className="grow">{label.name}</span>
                {applied.has(label.id) ? <span aria-hidden>✓</span> : null}
              </button>
            ))}

            {needle && !exact ? (
              <button type="button" className="label-option" disabled={busy} onClick={createAndAttach}>
                <span className="label-dot" style={{ background: nextColor(allLabels) }} />
                <span className="grow">
                  Crear <strong>{query.trim()}</strong>
                </span>
              </button>
            ) : null}

            {matches.length === 0 && !needle ? (
              <p className="muted" style={{ padding: '8px 12px', margin: 0, fontSize: 13 }}>
                Todavia no hay etiquetas. Escribi un nombre para crear la primera.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
