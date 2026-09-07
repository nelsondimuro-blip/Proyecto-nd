import { downloadMediaMessage, type WAMessage, type WASocket } from '@whiskeysockets/baileys'
import { env } from './env'
import { logger, waLogger } from './logger'
import { supabase } from './supabase'

export const MEDIA_TYPES = new Set([
  'imageMessage',
  'videoMessage',
  'audioMessage',
  'documentMessage',
  'documentWithCaptionMessage',
  'stickerMessage',
])

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'application/pdf': 'pdf',
}

export interface StoredMedia {
  path: string
  mime: string | null
  filename: string | null
}

function describeMedia(message: WAMessage['message']): { mime: string | null; filename: string | null } {
  const content: any =
    message?.imageMessage ??
    message?.videoMessage ??
    message?.audioMessage ??
    message?.documentMessage ??
    message?.documentWithCaptionMessage?.message?.documentMessage ??
    message?.stickerMessage

  return {
    mime: content?.mimetype ?? null,
    filename: content?.fileName ?? null,
  }
}

function extensionFor(mime: string | null, filename: string | null): string {
  if (filename && filename.includes('.')) return filename.split('.').pop()!.slice(0, 8)
  if (!mime) return 'bin'
  const base = mime.split(';')[0].trim()
  return EXTENSION_BY_MIME[base] ?? base.split('/')[1]?.replace(/[^a-z0-9]/gi, '').slice(0, 8) ?? 'bin'
}

/**
 * Descarga el adjunto y lo sube al bucket privado. Es "best effort": si falla,
 * el mensaje se guarda igual sin adjunto para no perder la conversacion.
 */
export async function storeMedia(
  sock: WASocket,
  msg: WAMessage,
  opts: { orgId: string; accountId: string; messageKey: string },
): Promise<StoredMedia | null> {
  try {
    const buffer = (await downloadMediaMessage(
      msg,
      'buffer',
      {},
      { logger: waLogger as any, reuploadRequest: sock.updateMediaMessage },
    )) as Buffer

    if (buffer.byteLength > env.MAX_MEDIA_BYTES) {
      logger.warn(
        { accountId: opts.accountId, bytes: buffer.byteLength },
        'adjunto descartado por superar MAX_MEDIA_BYTES',
      )
      return null
    }

    const { mime, filename } = describeMedia(msg.message)
    const safeKey = opts.messageKey.replace(/[^a-zA-Z0-9_-]/g, '')
    const path = `${opts.orgId}/${opts.accountId}/${safeKey}.${extensionFor(mime, filename)}`

    const { error } = await supabase.storage.from(env.MEDIA_BUCKET).upload(path, buffer, {
      contentType: mime ?? 'application/octet-stream',
      upsert: true,
    })

    if (error) throw error

    return { path, mime, filename }
  } catch (err) {
    logger.warn({ err, accountId: opts.accountId }, 'no se pudo guardar el adjunto')
    return null
  }
}
