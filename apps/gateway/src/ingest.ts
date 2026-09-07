import { getContentType, jidNormalizedUser, type WAMessage, type WASocket } from '@whiskeysockets/baileys'
import { logger } from './logger'
import { MEDIA_TYPES, storeMedia } from './media'
import { supabase } from './supabase'

export interface SessionContext {
  accountId: string
  orgId: string
  selfJid: () => string | undefined
}

const BROADCAST_JIDS = new Set(['status@broadcast'])

export const isGroupJid = (jid: string) => jid.endsWith('@g.us')

export function phoneFromJid(jid: string | null | undefined): string | null {
  if (!jid) return null
  const user = jid.split('@')[0]?.split(':')[0]
  return /^\d{5,20}$/.test(user ?? '') ? user : null
}

/** Texto legible del mensaje, cubriendo los tipos que aparecen en un chat de negocio. */
export function extractText(message: WAMessage['message']): string | null {
  if (!message) return null

  const m: any = message

  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    m.documentWithCaptionMessage?.message?.documentMessage?.caption ??
    m.buttonsResponseMessage?.selectedDisplayText ??
    m.listResponseMessage?.title ??
    m.templateButtonReplyMessage?.selectedDisplayText ??
    m.reactionMessage?.text ??
    m.ephemeralMessage?.message?.conversation ??
    m.ephemeralMessage?.message?.extendedTextMessage?.text ??
    null
  )
}

function timestampToIso(value: WAMessage['messageTimestamp']): string {
  const seconds = typeof value === 'number' ? value : Number(value ?? 0)
  if (!seconds) return new Date().toISOString()
  return new Date(seconds * 1000).toISOString()
}

async function upsertContact(
  orgId: string,
  jid: string,
  displayName: string | null,
): Promise<string | null> {
  const waId = jidNormalizedUser(jid)

  const { data: existing, error: selectError } = await supabase
    .from('contacts')
    .select('id, display_name')
    .eq('org_id', orgId)
    .eq('wa_id', waId)
    .maybeSingle()

  if (selectError) throw selectError

  if (existing) {
    // Solo completamos el nombre si aun no lo teniamos: no pisamos ediciones manuales.
    if (!existing.display_name && displayName) {
      await supabase.from('contacts').update({ display_name: displayName }).eq('id', existing.id)
    }
    return existing.id
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert({ org_id: orgId, wa_id: waId, phone: phoneFromJid(waId), display_name: displayName })
    .select('id')
    .single()

  if (error) {
    // Otra ingesta concurrente pudo crearlo primero.
    const { data: retry } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq('wa_id', waId)
      .maybeSingle()
    if (retry) return retry.id
    throw error
  }

  return data.id
}

export async function resolveConversation(
  ctx: SessionContext,
  sock: WASocket | undefined,
  chatId: string,
  hints: { pushName?: string | null } = {},
): Promise<{ id: string }> {
  const isGroup = isGroupJid(chatId)

  const { data: existing, error: selectError } = await supabase
    .from('conversations')
    .select('id, subject, contact_id')
    .eq('account_id', ctx.accountId)
    .eq('chat_id', chatId)
    .maybeSingle()

  if (selectError) throw selectError

  const contactId = isGroup ? null : await upsertContact(ctx.orgId, chatId, hints.pushName ?? null)

  if (existing) {
    const patch: Record<string, unknown> = {}
    if (!existing.contact_id && contactId) patch.contact_id = contactId
    if (!existing.subject && !isGroup && hints.pushName) patch.subject = hints.pushName
    if (Object.keys(patch).length > 0) {
      await supabase.from('conversations').update(patch).eq('id', existing.id)
    }
    return { id: existing.id }
  }

  let subject: string | null = isGroup ? null : hints.pushName ?? phoneFromJid(chatId)

  if (isGroup && sock) {
    try {
      const metadata = await sock.groupMetadata(chatId)
      subject = metadata?.subject ?? null
    } catch (err) {
      logger.debug({ err, chatId }, 'no se pudo leer el nombre del grupo')
    }
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      org_id: ctx.orgId,
      account_id: ctx.accountId,
      contact_id: contactId,
      chat_id: chatId,
      is_group: isGroup,
      subject,
    })
    .select('id')
    .single()

  if (error) {
    const { data: retry } = await supabase
      .from('conversations')
      .select('id')
      .eq('account_id', ctx.accountId)
      .eq('chat_id', chatId)
      .maybeSingle()
    if (retry) return retry
    throw error
  }

  return data
}

/**
 * Guarda un mensaje recibido (o el eco de uno propio enviado desde el telefono).
 * La unicidad (conversation_id, wa_message_id) hace que reintentos y ecos no dupliquen.
 */
export async function ingestMessage(ctx: SessionContext, sock: WASocket, msg: WAMessage): Promise<void> {
  const chatId = msg.key?.remoteJid
  const waMessageId = msg.key?.id

  if (!chatId || !waMessageId || BROADCAST_JIDS.has(chatId)) return
  if (!msg.message) return // recibos, protocolos y otros eventos sin contenido

  const type = getContentType(msg.message) ?? 'unknown'
  if (type === 'protocolMessage' || type === 'senderKeyDistributionMessage') return

  const fromMe = Boolean(msg.key.fromMe)
  const isGroup = isGroupJid(chatId)
  const conversation = await resolveConversation(ctx, sock, chatId, {
    pushName: fromMe ? null : msg.pushName ?? null,
  })

  const senderJid = fromMe ? ctx.selfJid() ?? null : isGroup ? msg.key.participant ?? null : chatId

  const isVoice = Boolean((msg.message as any)?.audioMessage?.ptt)

  const media = MEDIA_TYPES.has(type)
    ? await storeMedia(sock, msg, { orgId: ctx.orgId, accountId: ctx.accountId, messageKey: waMessageId })
    : null

  const { error } = await supabase.from('messages').upsert(
    {
      org_id: ctx.orgId,
      conversation_id: conversation.id,
      account_id: ctx.accountId,
      wa_message_id: waMessageId,
      direction: fromMe ? 'out' : 'in',
      sender_wa_id: senderJid ? jidNormalizedUser(senderJid) : null,
      sender_name: fromMe ? null : msg.pushName ?? null,
      type,
      body: extractText(msg.message),
      media_path: media?.path ?? null,
      media_mime: media?.mime ?? null,
      media_filename: media?.filename ?? null,
      is_voice: isVoice,
      status: fromMe ? 'sent' : 'delivered',
      sent_at: timestampToIso(msg.messageTimestamp),
    },
    { onConflict: 'conversation_id,wa_message_id', ignoreDuplicates: true },
  )

  if (error) throw error
}

const WA_STATUS_MAP: Record<number, 'pending' | 'sent' | 'delivered' | 'read'> = {
  0: 'pending',
  1: 'sent',
  2: 'delivered',
  3: 'read',
  4: 'read',
}

/** Actualiza el estado de entrega (los tildes) de un mensaje ya guardado. */
export async function updateMessageStatus(
  accountId: string,
  waMessageId: string,
  waStatus: number | null | undefined,
): Promise<void> {
  if (waStatus === null || waStatus === undefined) return
  const status = WA_STATUS_MAP[waStatus]
  if (!status) return

  const { error } = await supabase
    .from('messages')
    .update({ status })
    .eq('account_id', accountId)
    .eq('wa_message_id', waMessageId)

  if (error) logger.warn({ err: error, waMessageId }, 'no se pudo actualizar el estado del mensaje')
}
