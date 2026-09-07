import QuickRepliesManager from '@/components/QuickRepliesManager'
import { isAdmin, requireMembership } from '@/lib/auth'
import type { QuickReply } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Respuestas rapidas | Bandeja WhatsApp' }

export default async function QuickRepliesPage() {
  const { supabase, membership, userId } = await requireMembership()

  const { data } = await supabase
    .from('quick_replies')
    .select('id, org_id, shortcut, title, body, created_by, usage_count')
    .eq('org_id', membership.org_id)
    .order('usage_count', { ascending: false })

  return (
    <main className="page">
      <h1>Respuestas rapidas</h1>
      <p className="page-subtitle">
        Los textos que el equipo repite todos los dias. En el compositor se escriben con una barra
        (por ejemplo <code>/envio</code>) o se eligen con el boton del rayo.
      </p>

      <QuickRepliesManager
        orgId={membership.org_id}
        userId={userId}
        canManageAll={isAdmin(membership.role)}
        initialReplies={(data ?? []) as QuickReply[]}
      />
    </main>
  )
}
