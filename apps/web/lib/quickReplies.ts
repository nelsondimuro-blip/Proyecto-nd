import type { QuickReply } from '@/lib/types'

export interface ReplyContext {
  nombre: string
  numero: string
  cuenta: string
  agente: string
}

export const PLACEHOLDERS: { key: keyof ReplyContext; help: string }[] = [
  { key: 'nombre', help: 'Nombre del contacto o del grupo' },
  { key: 'numero', help: 'Numero del contacto' },
  { key: 'cuenta', help: 'Numero del negocio que responde' },
  { key: 'agente', help: 'Quien esta respondiendo' },
]

/** Reemplaza {{variable}} por su valor; lo que no reconoce queda tal cual. */
export function fillTemplate(body: string, context: ReplyContext): string {
  return body.replace(/\{\{\s*([a-z]+)\s*\}\}/gi, (match, name: string) => {
    const value = context[name.toLowerCase() as keyof ReplyContext]
    return value ? value : match
  })
}

/** Filtra por atajo, titulo o contenido; las mas usadas primero. */
export function searchReplies(replies: QuickReply[], query: string): QuickReply[] {
  const needle = query.trim().toLowerCase()

  const matches = needle
    ? replies.filter((reply) =>
        [reply.shortcut, reply.title ?? '', reply.body].join(' ').toLowerCase().includes(needle),
      )
    : replies

  return [...matches].sort((a, b) => {
    // Un atajo que empieza igual que lo escrito gana sobre una coincidencia suelta.
    if (needle) {
      const aStarts = a.shortcut.startsWith(needle)
      const bStarts = b.shortcut.startsWith(needle)
      if (aStarts !== bStarts) return aStarts ? -1 : 1
    }
    return b.usage_count - a.usage_count
  })
}
