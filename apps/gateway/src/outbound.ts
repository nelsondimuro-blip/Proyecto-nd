import type { AnyMessageContent } from '@whiskeysockets/baileys'
import { env } from './env'
import { supabase } from './supabase'

export interface OutboundMedia {
  path: string
  mime?: string | null
  filename?: string | null
}

export interface PreparedMedia {
  content: AnyMessageContent
  /** Tipo que se guarda en `messages.type`, con los mismos nombres que usa Baileys. */
  type: string
  mime: string
  filename: string | null
}

/**
 * Baja el adjunto que el navegador subio al bucket privado y arma el contenido
 * que espera Baileys segun el tipo de archivo.
 */
export async function prepareOutboundMedia(
  media: OutboundMedia,
  caption: string | null,
): Promise<PreparedMedia> {
  const { data, error } = await supabase.storage.from(env.MEDIA_BUCKET).download(media.path)

  if (error || !data) {
    throw new Error(`No se pudo leer el adjunto (${media.path}): ${error?.message ?? 'no encontrado'}`)
  }

  const buffer = Buffer.from(await data.arrayBuffer())

  if (buffer.byteLength > env.MAX_MEDIA_BYTES) {
    throw new Error('El adjunto supera el tamanio maximo permitido')
  }

  const mime = media.mime || data.type || 'application/octet-stream'
  const filename = media.filename || media.path.split('/').pop() || null
  const text = caption ?? undefined

  if (mime.startsWith('image/') && !mime.includes('svg')) {
    return { content: { image: buffer, mimetype: mime, caption: text }, type: 'imageMessage', mime, filename }
  }

  if (mime.startsWith('video/')) {
    return { content: { video: buffer, mimetype: mime, caption: text }, type: 'videoMessage', mime, filename }
  }

  if (mime.startsWith('audio/')) {
    return { content: { audio: buffer, mimetype: mime }, type: 'audioMessage', mime, filename }
  }

  return {
    content: {
      document: buffer,
      mimetype: mime,
      fileName: filename ?? 'archivo',
      caption: text,
    },
    type: 'documentMessage',
    mime,
    filename,
  }
}
