import type { CSSProperties } from 'react'
import type { ConversationWithRelations, Label } from '@/lib/types'

/** Colores sugeridos al crear una etiqueta; se puede escribir cualquier hex. */
export const LABEL_PALETTE = [
  '#21c063',
  '#53bdeb',
  '#f0b232',
  '#f15c6d',
  '#b07cf5',
  '#ff8a4c',
  '#4ec9b0',
  '#8696a0',
]

/** Va rotando la paleta para que dos etiquetas nuevas no salgan iguales. */
export function nextColor(existing: { color: string }[]): string {
  const used = new Set(existing.map((label) => label.color.toLowerCase()))
  return LABEL_PALETTE.find((color) => !used.has(color)) ?? LABEL_PALETTE[existing.length % LABEL_PALETTE.length]
}

/** Estilo del chip: el mismo color para el texto y, translucido, para el fondo. */
export function chipStyle(color: string): CSSProperties {
  return { color, background: `${color}1f`, borderColor: `${color}59` }
}

/** La consulta anida conversation_labels(labels(...)); aca queda una lista plana. */
export function withLabels<T extends { conversation_labels?: unknown }>(row: T): T & { labels: Label[] } {
  const nested = (row.conversation_labels ?? []) as { labels: Label | Label[] | null }[]

  const labels = nested
    .flatMap((entry) => (Array.isArray(entry.labels) ? entry.labels : entry.labels ? [entry.labels] : []))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return { ...row, labels }
}

const LABEL_EMBED = 'conversation_labels(labels(id, org_id, name, color, created_by))'

export const CONVERSATION_SELECT =
  `*, whatsapp_accounts(id, label, phone_number), contacts(id, display_name, phone), ${LABEL_EMBED}`

/** El hilo ademas necesita saber si la cuenta esta conectada para poder enviar. */
export const CONVERSATION_DETAIL_SELECT =
  `*, whatsapp_accounts(id, label, phone_number, status), contacts(id, display_name, phone), ${LABEL_EMBED}`

export function hasLabel(conversation: ConversationWithRelations, labelId: string): boolean {
  return conversation.labels.some((label) => label.id === labelId)
}
