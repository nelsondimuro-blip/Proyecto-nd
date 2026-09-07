/** Limite de subida, alineado con MAX_MEDIA_BYTES del gateway. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export interface UploadedMedia {
  path: string
  mime: string
  filename: string
}

const EXTENSION_FALLBACK: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function extensionFor(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop() : null
  if (fromName && /^[a-z0-9]{1,8}$/i.test(fromName)) return fromName.toLowerCase()
  return EXTENSION_FALLBACK[file.type] ?? 'bin'
}

/**
 * Ruta del adjunto saliente. El segundo segmento debe ser "outbox": es lo que
 * habilita la politica de subida del bucket y separa lo enviado de lo recibido.
 */
export function outboundPath(orgId: string, conversationId: string, file: File): string {
  const unique =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return `${orgId}/outbox/${conversationId}/${unique}.${extensionFor(file)}`
}
