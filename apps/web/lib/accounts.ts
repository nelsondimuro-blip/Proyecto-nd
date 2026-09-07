import { NextResponse } from 'next/server'
import { apiContext, errorResponse } from '@/lib/api'
import { isAdmin } from '@/lib/auth'
import { callGateway } from '@/lib/gateway'

/**
 * Verifica que la cuenta pertenezca a la organizacion del usuario y que este
 * pueda administrarla antes de reenviar la orden al gateway.
 */
export async function forwardAccountAction(
  accountId: string,
  action: 'connect' | 'disconnect' | 'logout',
): Promise<NextResponse> {
  const ctx = await apiContext()
  if (!ctx.ok) return ctx.response

  if (!isAdmin(ctx.membership.role)) {
    return NextResponse.json({ error: 'Solo un administrador puede gestionar los numeros' }, { status: 403 })
  }

  const { data: account } = await ctx.supabase
    .from('whatsapp_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('org_id', ctx.membership.org_id)
    .maybeSingle()

  if (!account) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

  try {
    await callGateway(`/accounts/${accountId}/${action}`, { method: 'POST' })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
