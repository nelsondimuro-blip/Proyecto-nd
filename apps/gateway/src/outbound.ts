import type { AnyMessageContent } from '@whiskeysockets/baileys'
import { PTT_MIME, toVoiceNote } from './audio'
import { env } from './env'
import { supabase } from './supabase'

export interface OutboundMedia {
  path: string
  mime?: string | null
  filename?: string | null
  /** true cuando el agente grabo una nota de voz: se manda como PTT. */
  voice?: boolean | null
}

export interface PreparedMedia {
  content: AnyMessageContent
  /** Tipo que se guarda en `messages.type`, con los mismos nombres que usa Baileys. */
  type: string
  mime: string
  filename: string | null
  isVoice: boolean
}

const OPUS_MIME_RE = /^audio\/ogg\b.*opus/i

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

  if (media.voice) {
    // El navegador graba en webm/opus (Chrome) o mp4 (Safari); solo el
    // ogg/opus que ya viene bien se puede mandar sin pasar por ffmpeg.
    const ready = OPUS_MIME_RE.test(mime)
    const { buffer: audio, seconds } = ready ? { buffer, seconds: 0 } : await toVoiceNote(buffer)

    return {
      content: { audio, mimetype: PTT_MIME, ptt: true, ...(seconds > 0 ? { seconds } : {}) },
      type: 'audioMessage',
      mime: PTT_MIME,
      filename: null,
      isVoice: true,
    }
  }

  if (mime.startsWith('image/') && !mime.includes('svg')) {
    return {
      content: { image: buffer, mimetype: mime, caption: text },
      type: 'imageMessage',
      mime,
      filename,
      isVoice: false,
    }
  }

  if (mime.startsWith('video/')) {
    return {
      content: { video: buffer, mimetype: mime, caption: text },
      type: 'videoMessage',
      mime,
      filename,
      isVoice: false,
    }
  }

  if (mime.startsWith('audio/')) {
    return { content: { audio: buffer, mimetype: mime }, type: 'audioMessage', mime, filename, isVoice: false }
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
    isVoice: false,
  }
}
