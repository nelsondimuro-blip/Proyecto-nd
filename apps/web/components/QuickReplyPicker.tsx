'use client'

import { useEffect, useRef, useState } from 'react'
import type { QuickReply } from '@/lib/types'

/**
 * Listado que aparece sobre el compositor al escribir "/" o al tocar el rayo.
 * Se maneja con flechas y Enter, o con el mouse.
 */
export default function QuickReplyPicker({
  replies,
  onPick,
  onClose,
}: {
  replies: QuickReply[]
  onPick: (reply: QuickReply) => void
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIndex(0)
  }, [replies])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (replies.length === 0) return

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setIndex((current) => {
          const next = event.key === 'ArrowDown' ? current + 1 : current - 1
          return (next + replies.length) % replies.length
        })
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        // Corta la propagacion para que el compositor no envie el mensaje.
        event.stopPropagation()
        const chosen = replies[index]
        if (chosen) onPick(chosen)
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }

    // En captura: el textarea tambien escucha Enter para enviar.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [index, onClose, onPick, replies])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [index])

  return (
    <div className="reply-picker" role="listbox" aria-label="Respuestas rapidas" ref={listRef}>
      {replies.length === 0 ? (
        <p className="muted" style={{ margin: 0, padding: '10px 14px', fontSize: 13 }}>
          No hay respuestas guardadas que coincidan.
        </p>
      ) : (
        replies.map((reply, position) => (
          <button
            key={reply.id}
            type="button"
            role="option"
            aria-selected={position === index}
            data-active={position === index}
            className="reply-option"
            onMouseEnter={() => setIndex(position)}
            onClick={() => onPick(reply)}
          >
            <span className="reply-shortcut">/{reply.shortcut}</span>
            <span className="reply-body">
              {reply.title ? <strong>{reply.title}</strong> : null}
              <span className="reply-preview">{reply.body}</span>
            </span>
            {reply.usage_count > 0 ? <span className="reply-uses">{reply.usage_count}</span> : null}
          </button>
        ))
      )}
    </div>
  )
}
