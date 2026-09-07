import type { Conversation, ConversationWithRelations } from '@/lib/types'

const timeFormatter = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })
const dayFormatter = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short' })
const fullFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

export function formatTime(iso: string | null): string {
  if (!iso) return ''
  return timeFormatter.format(new Date(iso))
}

export function formatFull(iso: string | null): string {
  if (!iso) return ''
  return fullFormatter.format(new Date(iso))
}

/** Hora si es de hoy, dia y mes si es anterior: el formato tipico de una bandeja. */
export function formatListTimestamp(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  return sameDay ? timeFormatter.format(date) : dayFormatter.format(date)
}

export function phoneFromChatId(chatId: string): string {
  const user = chatId.split('@')[0]
  return /^\d+$/.test(user) ? `+${user}` : user
}

export function conversationTitle(conversation: Conversation | ConversationWithRelations): string {
  const withRelations = conversation as ConversationWithRelations
  return (
    conversation.subject ??
    withRelations.contacts?.display_name ??
    withRelations.contacts?.phone ??
    phoneFromChatId(conversation.chat_id)
  )
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '#'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}
