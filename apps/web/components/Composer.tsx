'use client'

import { useRef, useState } from 'react'

export default function Composer({
  conversationId,
  disabled,
}: {
  conversationId: string
  disabled: boolean
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const send = async () => {
    const body = text.trim()
    if (!body || sending || disabled) return

    setSending(true)
    setError(null)

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId, text: body }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'No se pudo enviar el mensaje')
      }

      setText('')
      textareaRef.current?.focus()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      {error ? (
        <p className="alert" style={{ margin: '0 16px' }}>
          {error}
        </p>
      ) : null}

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={disabled ? 'La cuenta de WhatsApp no esta conectada' : 'Escribe un mensaje'}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter envia, Shift+Enter hace salto de linea.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }}
        />

        <button className="btn" type="submit" disabled={disabled || sending || text.trim().length === 0}>
          {sending ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </div>
  )
}
