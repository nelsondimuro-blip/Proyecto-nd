import { NextResponse } from 'next/server'
import { apiContext, errorResponse } from '@/lib/api'
import { isAdmin } from '@/lib/auth'
import { callGateway } from '@/lib/gateway'

/** Elimina el numero y, en cascada, sus conversaciones, mensajes y credenciales. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await apiContext()
  if (!ctx.ok) return ctx.response

  if (!isAdmin(ctx.membership.role)) {
    return NextResponse.json({ error: 'Solo un administrador puede eliminar numeros' }, { status: 403 })
  }

  const { data: account } = await ctx.supabase
    .from('whatsapp_accounts')
    .select('id')
    .eq('id', id)
    .eq('org_id', ctx.membership.org_id)
    .maybeSingle()

  if (!account) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

  try {
    // Se cierra la sesion viva antes de borrar; si el gateway no responde,
    // igual continuamos: la fila y sus credenciales dejan de existir.
    await callGateway(`/accounts/${id}/disconnect`, { method: 'POST' }).catch(() => undefined)

    const { error } = await ctx.supabase.from('whatsapp_accounts').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
