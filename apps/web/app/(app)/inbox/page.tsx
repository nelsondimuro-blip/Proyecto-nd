import Link from 'next/link'
import { requireMembership } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const { supabase, membership } = await requireMembership()

  const { count } = await supabase
    .from('whatsapp_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', membership.org_id)
    .eq('status', 'connected')

  return (
    <section className="empty-state">
      <span style={{ fontSize: 42 }} aria-hidden>
        💬
      </span>
      <h2 style={{ margin: 0 }}>Elige una conversacion</h2>

      {count && count > 0 ? (
        <p style={{ margin: 0 }}>
          Los mensajes de los {count} numero{count === 1 ? '' : 's'} conectado{count === 1 ? '' : 's'} llegan aqui
          en tiempo real.
        </p>
      ) : (
        <p style={{ margin: 0 }}>
          Todavia no hay numeros conectados. <Link href="/accounts">Conecta el primero</Link> escaneando su QR.
        </p>
      )}
    </section>
  )
}
