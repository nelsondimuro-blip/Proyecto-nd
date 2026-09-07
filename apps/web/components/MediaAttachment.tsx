'use client'

import { useEffect, useState } from 'react'

/** Los adjuntos viven en un bucket privado: pedimos una URL firmada al servidor. */
export default function MediaAttachment({
  path,
  mime,
  filename,
}: {
  path: string
  mime: string | null
  filename: string | null
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true

    fetch(`/api/media?path=${encodeURIComponent(path)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('sin acceso'))))
      .then((payload: { url: string }) => {
        if (active) setUrl(payload.url)
      })
      .catch(() => {
        if (active) setFailed(true)
      })

    return () => {
      active = false
    }
  }, [path])

  if (failed) return <p className="muted">No se pudo cargar el adjunto.</p>
  if (!url) return <p className="muted">Cargando adjunto...</p>

  if (mime?.startsWith('image/')) {
    return <img className="bubble-media" src={url} alt={filename ?? 'Imagen recibida'} />
  }

  if (mime?.startsWith('video/')) {
    return <video className="bubble-media" src={url} controls />
  }

  if (mime?.startsWith('audio/')) {
    return <audio src={url} controls style={{ display: 'block', marginBottom: 4 }} />
  }

  return (
    <a href={url} target="_blank" rel="noreferrer">
      📎 {filename ?? 'Descargar archivo'}
    </a>
  )
}
