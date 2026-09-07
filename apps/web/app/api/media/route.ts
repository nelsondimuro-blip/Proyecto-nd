import { NextResponse } from 'next/server'
import { apiContext, errorResponse } from '@/lib/api'

const SIGNED_URL_TTL_SECONDS = 300

/** Firma una URL temporal para un adjunto del bucket privado. */
export async function GET(request: Request) {
  const ctx = await apiContext()
  if (!ctx.ok) return ctx.response

  const path = new URL(request.url).searchParams.get('path')

  if (!path) return NextResponse.json({ error: 'Falta la ruta del adjunto' }, { status: 400 })

  // Las rutas son <org_id>/<account_id>/<archivo>: cortamos cualquier intento
  // de leer los adjuntos de otra organizacion.
  if (!path.startsWith(`${ctx.membership.org_id}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'Adjunto no disponible' }, { status: 403 })
  }

  try {
    const { data, error } = await ctx.supabase.storage
      .from('whatsapp-media')
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

    if (error || !data) {
      return NextResponse.json({ error: 'No se pudo firmar el adjunto' }, { status: 404 })
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (err) {
    return errorResponse(err)
  }
}
