'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { conversationTitle, formatListTimestamp, initials } from '@/lib/format'
import type { ConversationWithRelations } from '@/lib/types'

const SELECT =
  '*, whatsapp_accounts(id, label, phone_number), contacts(id, display_name, phone)'

type Filter = 'todas' | 'no_leidas' | 'mias'

export default function ConversationList({
  initialConversations,
  orgId,
  userId,
}: {
  initialConversations: ConversationWithRelations[]
  orgId: string
  userId: string
}) {
  const [conversations, setConversations] = useState(initialConversations)
  const [filter, setFilter] = useState<Filter>('todas')
  const [query, setQuery] = useState('')
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('conversations')
      .select(SELECT)
      .eq('org_id', orgId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(200)

    if (data) setConversations(data as unknown as ConversationWithRelations[])
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
      if (!needle) return true

      const haystack = [
        conversationTitle(conversation),
        conversation.chat_id,
        conversation.last_message_preview ?? '',
        conversation.whatsapp_accounts?.label ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(needle)
    })
  }, [conversations, filter, query, userId])

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
