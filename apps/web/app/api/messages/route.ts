import { NextResponse } from 'next/server'
import { apiContext, errorResponse } from '@/lib/api'
import { callGateway } from '@/lib/gateway'

const MAX_LENGTH = 4096

/** Envia un mensaje de texto por la cuenta duenia de la conversacion. */
export async function POST(request: Request) {
  const ctx = await apiContext()
  if (!ctx.ok) return ctx.response

  try {
    const body = (await request.json()) as { conversationId?: unknown; text?: unknown }
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : ''
    const text = typeof body.text === 'string' ? body.text.trim() : ''

    if (!conversationId || !text) {
      return NextResponse.json({ error: 'Faltan la conversacion o el texto' }, { status: 400 })
    }

    if (text.length > MAX_LENGTH) {
      return NextResponse.json({ error: `El mensaje supera ${MAX_LENGTH} caracteres` }, { status: 400 })
    }

    // RLS ya limita a la organizacion del usuario; el filtro explicito lo deja claro.
    const { data: conversation } = await ctx.supabase
      .from('conversations')
      .select('id, chat_id, account_id')
      .eq('id', conversationId)
      .eq('org_id', ctx.membership.org_id)
      .maybeSingle()

    if (!conversation) {
      return NextResponse.json({ error: 'Conversacion no encontrada' }, { status: 404 })
    }

    const result = await callGateway<{ waMessageId: string; conversationId: string }>(
      `/accounts/${conversation.account_id}/messages`,
      { method: 'POST', body: { chatId: conversation.chat_id, text, sentBy: ctx.userId } },
    )

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
