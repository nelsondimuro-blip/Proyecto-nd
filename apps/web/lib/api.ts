import { NextResponse } from 'next/server'
import { getMembership } from '@/lib/auth'
import { GatewayError } from '@/lib/gateway'
import type { Membership } from '@/lib/types'

export type ApiContext =
  | { ok: true; supabase: Awaited<ReturnType<typeof getMembership>>['supabase']; userId: string; membership: Membership }
  | { ok: false; response: NextResponse }

/** Resuelve usuario + organizacion, o devuelve la respuesta de error adecuada. */
export async function apiContext(): Promise<ApiContext> {
  const { supabase, userId, membership } = await getMembership()

  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }

  if (!membership) {
    return { ok: false, response: NextResponse.json({ error: 'Sin organizacion' }, { status: 403 }) }
  }

  return { ok: true, supabase, userId, membership }
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof GatewayError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }

  return NextResponse.json({ error: (err as Error).message ?? 'Error inesperado' }, { status: 500 })
}
