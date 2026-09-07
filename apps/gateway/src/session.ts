import makeWASocket, {
  DisconnectReason,
  type AnyMessageContent,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  type WASocket,
} from '@whiskeysockets/baileys'
import QRCode from 'qrcode'
import { useSupabaseAuthState, type SupabaseAuthState } from './authState'
import { env } from './env'
import { logger, waLogger } from './logger'
import { ingestMessage, phoneFromJid, resolveConversation, updateMessageStatus, type SessionContext } from './ingest'
import { prepareOutboundMedia, type OutboundMedia } from './outbound'
import { supabase } from './supabase'

export type AccountStatus = 'disconnected' | 'connecting' | 'qr' | 'connected' | 'logged_out' | 'error'

const QR_TTL_MS = 60_000
const MAX_RECONNECT_DELAY_MS = 60_000

/** Acepta tanto un jid completo como un numero suelto escrito por el agente. */
export function normalizeChatId(input: string): string {
  const value = input.trim()
  if (value.includes('@')) return jidNormalizedUser(value)

  const digits = value.replace(/\D/g, '')
  if (digits.length < 7) throw new Error(`Destinatario invalido: ${input}`)
  return `${digits}@s.whatsapp.net`
}

export class WhatsAppSession {
  private sock?: WASocket
  private auth?: SupabaseAuthState
  private reconnectTimer?: NodeJS.Timeout
  private reconnectAttempts = 0
  private stopped = false
  private starting?: Promise<void>

  readonly log

  constructor(
    readonly accountId: string,
    readonly orgId: string,
  ) {
    this.log = logger.child({ accountId })
  }

  get socket(): WASocket | undefined {
    return this.sock
  }

  private get context(): SessionContext {
    return {
      accountId: this.accountId,
      orgId: this.orgId,
      selfJid: () => (this.sock?.user?.id ? jidNormalizedUser(this.sock.user.id) : undefined),
    }
  }

  private async updateAccount(patch: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from('whatsapp_accounts').update(patch).eq('id', this.accountId)
    if (error) this.log.error({ err: error }, 'no se pudo actualizar la cuenta')
  }

  /** Idempotente: si ya hay un arranque en curso se espera a ese. */
  async start(): Promise<void> {
    if (this.starting) return this.starting
    if (this.sock) return

    this.stopped = false
    this.starting = this.connect().finally(() => {
      this.starting = undefined
    })

    return this.starting
  }

  private async connect(): Promise<void> {
    await this.updateAccount({ status: 'connecting', last_error: null })

    try {
      this.auth = await useSupabaseAuthState(this.accountId)
      const { version } = await fetchLatestBaileysVersion()

      const sock = makeWASocket({
        version,
        logger: waLogger as any,
        auth: {
          creds: this.auth.state.creds,
          keys: makeCacheableSignalKeyStore(this.auth.state.keys, waLogger as any),
        },
        browser: [env.WA_BROWSER_NAME, 'Chrome', '120.0.0'],
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
      })

      this.sock = sock
      this.bindEvents(sock)
    } catch (err) {
      this.log.error({ err }, 'fallo al iniciar la sesion')
      await this.updateAccount({ status: 'error', last_error: (err as Error).message })
      this.scheduleReconnect()
    }
  }

  private bindEvents(sock: WASocket): void {
    sock.ev.on('creds.update', () => {
      this.auth?.saveCreds().catch((err) => this.log.error({ err }, 'no se pudieron guardar las credenciales'))
    })

    sock.ev.on('connection.update', (update) => {
      void this.onConnectionUpdate(update).catch((err) =>
        this.log.error({ err }, 'error procesando connection.update'),
      )
    })

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return

      void (async () => {
        for (const msg of messages) {
          try {
            await ingestMessage(this.context, sock, msg)
          } catch (err) {
            this.log.error({ err, key: msg.key }, 'no se pudo guardar el mensaje')
          }
        }
      })()
    })

    sock.ev.on('messages.update', (updates) => {
      void (async () => {
        for (const update of updates) {
          if (!update.key?.id) continue
          await updateMessageStatus(this.accountId, update.key.id, update.update?.status as number | undefined)
        }
      })()
    })

    sock.ev.on('groups.update', (updates) => {
      void (async () => {
        for (const update of updates) {
          if (!update.id || !update.subject) continue
          await supabase
            .from('conversations')
            .update({ subject: update.subject })
            .eq('account_id', this.accountId)
            .eq('chat_id', update.id)
        }
      })()
    })
  }

  private async onConnectionUpdate(update: {
    connection?: string
    lastDisconnect?: { error?: Error | unknown } | undefined
    qr?: string
  }): Promise<void> {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      const dataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 })
      await this.updateAccount({
        status: 'qr',
        qr_code: dataUrl,
        qr_expires_at: new Date(Date.now() + QR_TTL_MS).toISOString(),
        last_error: null,
      })
      this.log.info('QR generado, esperando escaneo')
    }

    if (connection === 'open') {
      this.reconnectAttempts = 0
      const jid = this.sock?.user?.id ? jidNormalizedUser(this.sock.user.id) : null
      await this.updateAccount({
        status: 'connected',
        phone_number: phoneFromJid(jid),
        qr_code: null,
        qr_expires_at: null,
        last_error: null,
        connected_at: new Date().toISOString(),
      })
      this.log.info({ jid }, 'sesion conectada')
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode as number | undefined
      this.sock = undefined

      if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession) {
        this.log.warn({ statusCode }, 'sesion cerrada desde el telefono, se descartan credenciales')
        await this.auth?.clear()
        await this.updateAccount({
          status: 'logged_out',
          qr_code: null,
          qr_expires_at: null,
          phone_number: null,
          connected_at: null,
        })
        this.stopped = true
        return
      }

      if (this.stopped) {
        await this.updateAccount({ status: 'disconnected', qr_code: null, qr_expires_at: null })
        return
      }

      this.log.warn({ statusCode }, 'conexion cerrada, reintentando')
      await this.updateAccount({ status: 'connecting' })
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return

    this.reconnectAttempts += 1
    const delay = Math.min(2_000 * 2 ** (this.reconnectAttempts - 1), MAX_RECONNECT_DELAY_MS)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      void this.connect()
    }, delay)

    this.log.info({ delay, intento: this.reconnectAttempts }, 'reconexion programada')
  }

  /** Cierra el socket sin borrar credenciales: se puede reanudar sin volver a escanear. */
  async stop(): Promise<void> {
    this.stopped = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }

    try {
      this.sock?.end(undefined)
    } catch (err) {
      this.log.debug({ err }, 'error cerrando el socket')
    }

    this.sock = undefined
    await this.updateAccount({ status: 'disconnected', qr_code: null, qr_expires_at: null })
  }

  /** Desvincula el dispositivo en WhatsApp y borra las credenciales. */
  async logout(): Promise<void> {
    this.stopped = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }

    try {
      await this.sock?.logout()
    } catch (err) {
      this.log.warn({ err }, 'logout remoto fallido, se limpia igualmente')
    }

    try {
      this.sock?.end(undefined)
    } catch {
      /* el socket ya estaba cerrado */
    }

    this.sock = undefined
    await this.auth?.clear()
    await this.updateAccount({
      status: 'logged_out',
      qr_code: null,
      qr_expires_at: null,
      phone_number: null,
      connected_at: null,
    })
  }

  /**
   * Envia un mensaje de texto, un adjunto, o un adjunto con pie de foto.
   * El adjunto ya vive en el bucket privado: aqui se baja y se reenvia.
   */
  async send(input: {
    chatId: string
    text?: string | null
    media?: OutboundMedia | null
    sentBy?: string | null
  }): Promise<{ waMessageId: string; conversationId: string }> {
    const sock = this.sock
    if (!sock) throw new Error('La cuenta no esta conectada')

    const text = input.text?.trim() ? input.text : null

    if (!text && !input.media) throw new Error('El mensaje no tiene texto ni adjunto')

    const prepared = input.media ? await prepareOutboundMedia(input.media, text) : null
    const content: AnyMessageContent = prepared ? prepared.content : { text: text! }

    const jid = normalizeChatId(input.chatId)
    const sent = await sock.sendMessage(jid, content)
    const waMessageId = sent?.key?.id

    if (!waMessageId) throw new Error('WhatsApp no devolvio un identificador de mensaje')

    const conversation = await resolveConversation(this.context, sock, jid)

    // Se guarda al vuelo para que el agente vea su mensaje sin esperar al eco del socket.
    const { error } = await supabase.from('messages').upsert(
      {
        org_id: this.orgId,
        conversation_id: conversation.id,
        account_id: this.accountId,
        wa_message_id: waMessageId,
        direction: 'out',
        sender_wa_id: this.context.selfJid() ?? null,
        type: prepared?.type ?? 'conversation',
        body: text,
        media_path: input.media?.path ?? null,
        media_mime: prepared?.mime ?? null,
        media_filename: prepared?.filename ?? null,
        status: 'pending',
        sent_by: input.sentBy ?? null,
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'conversation_id,wa_message_id', ignoreDuplicates: true },
    )

    if (error) throw error

    return { waMessageId, conversationId: conversation.id }
  }

  /** Comprueba si un numero tiene WhatsApp antes de abrir una conversacion nueva. */
  async checkNumber(phone: string): Promise<{ exists: boolean; jid: string | null }> {
    const sock = this.sock
    if (!sock) throw new Error('La cuenta no esta conectada')

    const digits = phone.replace(/\D/g, '')
    const [result] = await sock.onWhatsApp(digits)

    return { exists: Boolean(result?.exists), jid: result?.jid ?? null }
  }

  get inMemoryStatus(): AccountStatus {
    if (this.sock?.user) return 'connected'
    if (this.sock) return 'connecting'
    return this.stopped ? 'disconnected' : 'connecting'
  }
}
