'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { conversationTitle, formatListTimestamp, initials } from '@/lib/format'
import { CONVERSATION_SELECT, chipStyle, withLabels } from '@/lib/labels'
import type { ConversationWithRelations, Label } from '@/lib/types'

type Filter = 'todas' | 'no_leidas' | 'mias'

export default function ConversationList({
  initialConversations,
  orgId,
  userId,
  labels,
}: {
  initialConversations: ConversationWithRelations[]
  orgId: string
  userId: string
  labels: Label[]
}) {
  const [conversations, setConversations] = useState(initialConversations)
  const [filter, setFilter] = useState<Filter>('todas')
  const [labelFilter, setLabelFilter] = useState('')
  const [query, setQuery] = useState('')
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('conversations')
      .select(CONVERSATION_SELECT)
      .eq('org_id', orgId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(200)

    if (data) setConversations(data.map(withLabels) as unknown as ConversationWithRelations[])
  }, [orgId, supabase])

  // Realtime: cualquier cambio en las conversaciones de la organizacion
  // (mensaje nuevo, asignacion, lectura) recarga la lista.
  useEffect(() => {
    const channel = supabase
      .channel(`conversations:${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `org_id=eq.${orgId}` },
        () => {
          void refresh()
        },
      )
      // Etiquetar no toca la fila de la conversacion: hay que escuchar aparte.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_labels', filter: `org_id=eq.${orgId}` },
        () => {
          void refresh()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [orgId, refresh, supabase])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return conversations.filter((conversation) => {
      if (filter === 'no_leidas' && conversation.unread_count === 0) return false
      if (filter === 'mias' && conversation.assigned_to !== userId) return false
      if (labelFilter && !conversation.labels.some((label) => label.id === labelFilter)) return false
      if (!needle) return true

      const haystack = [
        conversationTitle(conversation),
        conversation.chat_id,
        conversation.last_message_preview ?? '',
        conversation.whatsapp_accounts?.label ?? '',
        conversation.labels.map((label) => label.name).join(' '),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(needle)
    })
  }, [conversations, filter, labelFilter, query, userId])

  return (
    <section className="conversation-panel" aria-label="Conversaciones">
      <div className="panel-header">
        <h2 className="panel-title">Bandeja</h2>
        <span className="muted" style={{ fontSize: 12 }}>
          {visible.length} chat{visible.length === 1 ? '' : 's'}
        </span>
      </div>

      <div style={{ padding: '10px 12px' }}>
        <input
          className="search-input"
          placeholder="Buscar por nombre, numero o texto"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Buscar conversaciones"
        />
      </div>

      <div className="filters">
        {(
          [
            ['todas', 'Todas'],
            ['no_leidas', 'No leidas'],
            ['mias', 'Asignadas a mi'],
          ] as [Filter, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="chip"
            data-active={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}

        {labels.length > 0 ? (
          <select
            className="chip"
            aria-label="Filtrar por etiqueta"
            value={labelFilter}
            data-active={Boolean(labelFilter)}
            onChange={(event) => setLabelFilter(event.target.value)}
          >
            <option value="">Toda etiqueta</option>
            {labels.map((label) => (
              <option key={label.id} value={label.id}>
                {label.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="panel-body">
        {visible.length === 0 ? (
          <p className="muted" style={{ padding: '24px 16px', textAlign: 'center' }}>
            No hay conversaciones que coincidan.
          </p>
        ) : (
          visible.map((conversation) => {
            const title = conversationTitle(conversation)

            return (
              <Link
                key={conversation.id}
                href={`/inbox/${conversation.id}`}
                className="conversation-item"
                data-active={pathname === `/inbox/${conversation.id}`}
              >
                <span className="avatar" aria-hidden>
                  {conversation.is_group ? '#' : initials(title)}
                </span>

                <span className="conversation-main">
                  <span className="conversation-name">{title}</span>
                  <span className="conversation-preview">
                    {conversation.last_message_preview ?? 'Sin mensajes todavia'}
                  </span>
                  {conversation.labels.length > 0 ? (
                    <span className="conversation-labels">
                      {conversation.labels.slice(0, 3).map((label) => (
                        <span key={label.id} className="label-chip is-static" style={chipStyle(label.color)}>
                          {label.name}
                        </span>
                      ))}
                      {conversation.labels.length > 3 ? (
                        <span className="muted" style={{ fontSize: 11 }}>
                          +{conversation.labels.length - 3}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </span>

                <span className="conversation-meta">
                  <span>{formatListTimestamp(conversation.last_message_at)}</span>
                  {conversation.unread_count > 0 ? (
                    <span className="badge-unread">{conversation.unread_count}</span>
                  ) : null}
                  {conversation.whatsapp_accounts?.label ? (
                    <span className="tag-account">{conversation.whatsapp_accounts.label}</span>
                  ) : null}
                </span>
              </Link>
            )
          })
        )}
      </div>
    </section>
  )
}
