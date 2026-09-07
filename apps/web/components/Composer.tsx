'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QuickReplyPicker from '@/components/QuickReplyPicker'
import { useVoiceRecorder, type VoiceRecording } from '@/components/useVoiceRecorder'
import { createClient } from '@/lib/supabase/client'
import { fillTemplate, searchReplies, type ReplyContext } from '@/lib/quickReplies'
import { formatDuration } from '@/lib/recorder'
import { MAX_UPLOAD_BYTES, formatBytes, outboundPath } from '@/lib/uploads'
import type { QuickReply } from '@/lib/types'

interface PendingAttachment {
  file: File
  isVoice: boolean
  seconds: number
}

export default function Composer({
  conversationId,
  orgId,
  disabled,
  replyContext,
}: {
  conversationId: string
  orgId: string
  disabled: boolean
  replyContext: ReplyContext
}) {
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'sending'>('idle')
  const [replies, setReplies] = useState<QuickReply[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const busy = phase !== 'idle'
  const file = attachment?.file ?? null

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  // La biblioteca es chica y se comparte: alcanza con leerla una vez.
  useEffect(() => {
    let active = true

    supabase
      .from('quick_replies')
      .select('id, org_id, shortcut, title, body, created_by, usage_count')
      .eq('org_id', orgId)
      .order('usage_count', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (active && data) setReplies(data as QuickReply[])
      })

    return () => {
      active = false
    }
  }, [orgId, supabase])

  // Escribir "/atajo" al principio del mensaje abre el listado filtrado.
  const slashQuery = text.startsWith('/') && !text.includes('\n') ? text.slice(1) : null
  const listOpen = (pickerOpen || slashQuery !== null) && !disabled
  const visibleReplies = useMemo(
    () => (listOpen ? searchReplies(replies, slashQuery ?? '') : []),
    [listOpen, replies, slashQuery],
  )

  const pickReply = useCallback(
    (reply: QuickReply) => {
      setText(fillTemplate(reply.body, replyContext))
      setPickerOpen(false)
      textareaRef.current?.focus()

      // El contador ordena el listado; si falla no rompe nada.
      void supabase.rpc('use_quick_reply', { p_id: reply.id }).then(() => {
        setReplies((current) =>
          current.map((item) =>
            item.id === reply.id ? { ...item, usage_count: item.usage_count + 1 } : item,
          ),
        )
      })
    },
    [replyContext, supabase],
  )

  const clearAttachment = () => {
    setAttachment(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const acceptFile = (chosen: File | null, meta: { isVoice: boolean; seconds: number }) => {
    setError(null)

    if (!chosen) {
      clearAttachment()
      return
    }

    if (chosen.size > MAX_UPLOAD_BYTES) {
      setError(`El archivo pesa ${formatBytes(chosen.size)}; el maximo es ${formatBytes(MAX_UPLOAD_BYTES)}.`)
      clearAttachment()
      return
    }

    setAttachment({ file: chosen, ...meta })
  }

  const recorder = useVoiceRecorder((recording: VoiceRecording) => {
    // La nota de voz reemplaza cualquier adjunto pendiente: se manda sola.
    acceptFile(recording.file, { isVoice: true, seconds: recording.seconds })
  })

  const send = async () => {
    const body = text.trim()
    const isVoice = attachment?.isVoice ?? false
    if ((!body && !file) || busy || disabled) return

    setError(null)

    try {
      let media: { path: string; mime: string; filename: string; voice: boolean } | undefined

      if (file) {
        setPhase('uploading')
        const path = outboundPath(orgId, conversationId, file)

        // El archivo va directo al bucket privado: no pasa por las funciones
        // de Next, asi que no lo limita el tamanio maximo de un request.
        const { error: uploadError } = await supabase.storage
          .from('whatsapp-media')
          .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })

        if (uploadError) throw new Error(`No se pudo subir el archivo: ${uploadError.message}`)

        media = {
          path,
          mime: file.type || 'application/octet-stream',
          filename: file.name,
          voice: isVoice,
        }
      }

      setPhase('sending')

      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Una nota de voz viaja sola: WhatsApp descarta el pie de texto.
        body: JSON.stringify({ conversationId, text: isVoice ? null : body || null, media }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'No se pudo enviar el mensaje')
      }

      if (!isVoice) setText('')
      clearAttachment()
      textareaRef.current?.focus()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPhase('idle')
    }
  }

  const buttonLabel =
    phase === 'uploading' ? 'Subiendo...' : phase === 'sending' ? 'Enviando...' : 'Enviar'
  const voicePending = attachment?.isVoice ?? false
  const problem = error ?? recorder.error

  return (
    <div>
      {problem ? (
        <p className="alert" style={{ margin: '0 16px' }}>
          {problem}
        </p>
      ) : null}

      {listOpen ? (
        <QuickReplyPicker
          replies={visibleReplies}
          onPick={pickReply}
          onClose={() => {
            setPickerOpen(false)
            if (slashQuery !== null) setText('')
          }}
        />
      ) : null}

      {recorder.recording ? (
        <div className="attachment-chip">
          <span className="recording-dot" aria-hidden />
          <span className="attachment-name">Grabando nota de voz... {formatDuration(recorder.seconds)}</span>
          <button type="button" className="chip" onClick={recorder.cancel}>
            Cancelar
          </button>
          <button type="button" className="btn" onClick={recorder.stop}>
            Listo
          </button>
        </div>
      ) : null}

      {attachment && !recorder.recording ? (
        <div className="attachment-chip">
          {voicePending ? (
            <>
              <span aria-hidden>🎤</span>
              <span className="attachment-name">Nota de voz · {formatDuration(attachment.seconds)}</span>
              {preview ? <audio src={preview} controls style={{ height: 32 }} /> : null}
            </>
          ) : (
            <>
              {preview && file?.type.startsWith('image/') ? <img src={preview} alt="" /> : <span aria-hidden>📎</span>}
              <span className="attachment-name">{file?.name}</span>
              <span className="muted">{file ? formatBytes(file.size) : ''}</span>
            </>
          )}
          <button
            type="button"
            className="chip"
            onClick={clearAttachment}
            disabled={busy}
            aria-label="Quitar adjunto"
          >
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
          onChange={(event) => acceptFile(event.target.files?.[0] ?? null, { isVoice: false, seconds: 0 })}
        />

        <button
          type="button"
          className="btn btn-ghost"
          title="Adjuntar archivo"
          aria-label="Adjuntar archivo"
          disabled={disabled || busy || recorder.recording || voicePending}
          onClick={() => fileInputRef.current?.click()}
        >
          📎
        </button>

        {replies.length > 0 ? (
          <button
            type="button"
            className="btn btn-ghost"
            title="Respuestas rapidas (o escribi / )"
            aria-label="Respuestas rapidas"
            aria-expanded={listOpen}
            disabled={disabled || busy || voicePending}
            onClick={() => setPickerOpen((open) => !open)}
          >
            ⚡
          </button>
        ) : null}

        {recorder.supported ? (
          <button
            type="button"
            className="btn btn-ghost"
            title="Grabar nota de voz"
            aria-label="Grabar nota de voz"
            data-recording={recorder.recording}
            disabled={disabled || busy || voicePending}
            onClick={() => (recorder.recording ? recorder.stop() : void recorder.start())}
          >
            🎤
          </button>
        ) : null}

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          disabled={disabled || voicePending}
          placeholder={
            disabled
              ? 'La cuenta de WhatsApp no esta conectada'
              : voicePending
                ? 'La nota de voz se envia sola'
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
          disabled={disabled || busy || recorder.recording || (text.trim().length === 0 && !file)}
        >
          {buttonLabel}
        </button>
      </form>
    </div>
  )
}
