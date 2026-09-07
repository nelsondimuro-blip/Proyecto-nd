'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Composer from '@/components/Composer'
import MediaAttachment from '@/components/MediaAttachment'
import { createClient } from '@/lib/supabase/client'
import { conversationTitle, formatTime, initials, phoneFromChatId } from '@/lib/format'
import type { ConversationWithRelations, Message, MessageStatus } from '@/lib/types'

const STATUS_ICON: Record<MessageStatus, string> = {
  pending: '🕐',
  sent: '✓',
  delivered: '✓✓',
  read: '✓✓',
  failed: '⚠',
}

const dayFormatter = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' })

export interface TeamMember {
  user_id: string
  name: string
}

export default function MessageThread({
  conversation,
  initialMessages,
  members,
  canSend,
  agentName,
}: {
  conversation: ConversationWithRelations
  initialMessages: Message[]
  members: TeamMember[]
  canSend: boolean
  agentName: string
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [assignedTo, setAssignedTo] = useState(conversation.assigned_to ?? '')
  const [status, setStatus] = useState(conversation.status)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const markRead = useCallback(() => {
    void supabase.rpc('mark_conversation_read', { p_conversation: conversation.id })
  }, [conversation.id, supabase])

  useEffect(() => {
    setMessages(initialMessages)
    setAssignedTo(conversation.assigned_to ?? '')
    setStatus(conversation.status)
  }, [conversation.assigned_to, conversation.id, conversation.status, initialMessages])

  useEffect(() => {
    markRead()
  }, [markRead])

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const row = payload.new as Message

          setMessages((current) => {
            const index = current.findIndex((message) => message.id === row.id)
            if (index === -1) return [...current, row]

            const next = [...current]
            next[index] = row
            return next
          })

          if (payload.eventType === 'INSERT' && row.direction === 'in') markRead()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversation.id, markRead, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const updateConversation = async (patch: Record<string, unknown>) => {
    await supabase.from('conversations').update(patch).eq('id', conversation.id)
  }

  const title = conversationTitle(conversation)
  const grouped = groupByDay(messages)

  // Valores con los que se completan las variables de una respuesta rapida.
  // Memorizado: el compositor lo usa como dependencia.
  const replyContext = useMemo(
    () => ({
      nombre: title,
      numero: conversation.contacts?.phone
        ? `+${conversation.contacts.phone}`
        : phoneFromChatId(conversation.chat_id),
      cuenta: conversation.whatsapp_accounts?.label ?? '',
      agente: agentName,
    }),
    [agentName, conversation.chat_id, conversation.contacts?.phone, conversation.whatsapp_accounts?.label, title],
  )

  return (
    <section className="thread" aria-label={`Conversacion con ${title}`}>
      <header className="thread-header">
        <Link href="/inbox" className="btn-ghost btn" style={{ padding: '6px 10px' }} aria-label="Volver">
          ←
        </Link>

        <span className="avatar" aria-hidden>
          {conversation.is_group ? '#' : initials(title)}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {conversation.whatsapp_accounts?.label ?? 'Cuenta'}
            {conversation.whatsapp_accounts?.phone_number ? ` · +${conversation.whatsapp_accounts.phone_number}` : ''}
            {conversation.is_group ? ' · Grupo' : ''}
          </div>
        </div>

        <select
          aria-label="Agente asignado"
          className="chip"
          value={assignedTo}
          onChange={(event) => {
            const value = event.target.value
            setAssignedTo(value)
            void updateConversation({ assigned_to: value || null })
          }}
        >
          <option value="">Sin asignar</option>
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Estado de la conversacion"
          className="chip"
          value={status}
          onChange={(event) => {
            const value = event.target.value as typeof status
            setStatus(value)
            void updateConversation({ status: value })
          }}
        >
          <option value="open">Abierta</option>
          <option value="pending">Pendiente</option>
          <option value="closed">Cerrada</option>
        </select>
      </header>

      <div className="thread-messages">
        {messages.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center' }}>
            Todavia no hay mensajes en esta conversacion.
          </p>
        ) : (
          grouped.map(([day, dayMessages]) => (
            <div key={day} style={{ display: 'contents' }}>
              <div className="day-separator">{day}</div>
              {dayMessages.map((message) => (
                <MessageBubble key={message.id} message={message} isGroup={conversation.is_group} />
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <Composer
        conversationId={conversation.id}
        orgId={conversation.org_id}
        disabled={!canSend}
        replyContext={replyContext}
      />
    </section>
  )
}

function MessageBubble({ message, isGroup }: { message: Message; isGroup: boolean }) {
  return (
    <div className="bubble" data-direction={message.direction}>
      {isGroup && message.direction === 'in' && message.sender_name ? (
        <div className="bubble-author">{message.sender_name}</div>
      ) : null}

      {message.is_voice ? (
        <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>
          🎤 Nota de voz
        </div>
      ) : null}

      {message.media_path ? (
        <MediaAttachment
          path={message.media_path}
          mime={message.media_mime}
          filename={message.media_filename}
        />
      ) : null}

      {message.body ? <span>{message.body}</span> : null}

      {!message.body && !message.media_path ? (
        <span className="muted">[{message.type}]</span>
      ) : null}

      <div className="bubble-meta">
        <span>{formatTime(message.sent_at)}</span>
        {message.direction === 'out' ? (
          <span title={message.status} style={{ color: message.status === 'read' ? '#53bdeb' : undefined }}>
            {STATUS_ICON[message.status]}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function groupByDay(messages: Message[]): [string, Message[]][] {
  const groups = new Map<string, Message[]>()

  for (const message of messages) {
    const key = dayFormatter.format(new Date(message.sent_at))
    const bucket = groups.get(key)
    if (bucket) bucket.push(message)
    else groups.set(key, [message])
  }

  return [...groups.entries()]
}
