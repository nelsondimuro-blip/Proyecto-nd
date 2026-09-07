import { NextResponse } from 'next/server'
import { apiContext, errorResponse } from '@/lib/api'
import { isAdmin } from '@/lib/auth'

/** Crea una cuenta (un numero) dentro de la organizacion. */
export async function POST(request: Request) {
  const ctx = await apiContext()
  if (!ctx.ok) return ctx.response

  if (!isAdmin(ctx.membership.role)) {
    return NextResponse.json({ error: 'Solo un administrador puede agregar numeros' }, { status: 403 })
  }

  try {
    const body = (await request.json()) as { label?: unknown }
    const label = typeof body.label === 'string' ? body.label.trim() : ''

    if (label.length < 1 || label.length > 80) {
      return NextResponse.json({ error: 'El nombre del numero es obligatorio' }, { status: 400 })
    }

    const { data, error } = await ctx.supabase
      .from('whatsapp_accounts')
      .insert({ org_id: ctx.membership.org_id, label })
      .select('id, label, status')
      .single()

    if (error) {
      const duplicated = error.code === '23505'
      return NextResponse.json(
        { error: duplicated ? 'Ya existe un numero con ese nombre' : error.message },
        { status: duplicated ? 409 : 400 },
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
