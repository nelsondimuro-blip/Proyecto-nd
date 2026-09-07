'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MAX_UPLOAD_BYTES, formatBytes, outboundPath } from '@/lib/uploads'

export default function Composer({
  conversationId,
  orgId,
  disabled,
}: {
  conversationId: string
  orgId: string
  disabled: boolean
}) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'sending'>('idle')
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const busy = phase !== 'idle'
  const preview = useMemo(
    () => (file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null),
    [file],
  )

  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const clearFile = () => {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const pickFile = (chosen: File | null) => {
    setError(null)

    if (chosen && chosen.size > MAX_UPLOAD_BYTES) {
      setError(`El archivo pesa ${formatBytes(chosen.size)}; el maximo es ${formatBytes(MAX_UPLOAD_BYTES)}.`)
      clearFile()
      return
    }

    setFile(chosen)
  }

  const send = async () => {
    const body = text.trim()
    if ((!body && !file) || busy || disabled) return

    setError(null)

    try {
      let media: { path: string; mime: string; filename: string } | undefined

      if (file) {
        setPhase('uploading')
        const path = outboundPath(orgId, conversationId, file)

        // El archivo va directo al bucket privado: no pasa por las funciones
        // de Next, asi que no lo limita el tamanio maximo de un request.
        const { error: uploadError } = await supabase.storage
          .from('whatsapp-media')
          .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })

        if (uploadError) throw new Error(`No se pudo subir el archivo: ${uploadError.message}`)

        media = { path, mime: file.type || 'application/octet-stream', filename: file.name }
      }

      setPhase('sending')

      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId, text: body || null, media }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'No se pudo enviar el mensaje')
      }

      setText('')
      clearFile()
      textareaRef.current?.focus()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPhase('idle')
    }
  }

  const buttonLabel =
    phase === 'uploading' ? 'Subiendo...' : phase === 'sending' ? 'Enviando...' : 'Enviar'

  return (
    <div>
      {error ? (
        <p className="alert" style={{ margin: '0 16px' }}>
          {error}
        </p>
      ) : null}

      {file ? (
        <div className="attachment-chip">
          {preview ? <img src={preview} alt="" /> : <span aria-hidden>📎</span>}
          <span className="attachment-name">{file.name}</span>
          <span className="muted">{formatBytes(file.size)}</span>
          <button type="button" className="chip" onClick={clearFile} disabled={busy} aria-label="Quitar adjunto">
            ✕
          </button>
        </div>
      ) : null}

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
        />

        <button
          type="button"
          className="btn btn-ghost"
          title="Adjuntar archivo"
          aria-label="Adjuntar archivo"
          disabled={disabled || busy}
          onClick={() => fileInputRef.current?.click()}
        >
          📎
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={
            disabled
              ? 'La cuenta de WhatsApp no esta conectada'
              : file
                ? 'Agrega un pie de foto (opcional)'
                : 'Escribe un mensaje'
          }
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter envia, Shift+Enter hace salto de linea.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }}
        />

        <button
          className="btn"
          type="submit"
          disabled={disabled || busy || (text.trim().length === 0 && !file)}
        >
          {buttonLabel}
        </button>
      </form>
    </div>
  )
}
