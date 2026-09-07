import LabelsManager from '@/components/LabelsManager'
import { isAdmin, requireMembership } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Etiquetas | Bandeja WhatsApp' }

export default async function LabelsPage() {
  const { supabase, membership, userId } = await requireMembership()

  const { data } = await supabase
    .from('labels')
    .select('id, org_id, name, color, created_by, conversation_labels(count)')
    .eq('org_id', membership.org_id)
    .order('name', { ascending: true })

  const labels = (data ?? []).map((row: any) => ({
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    color: row.color,
    created_by: row.created_by,
    uses: row.conversation_labels?.[0]?.count ?? 0,
  }))

  return (
    <main className="page">
      <h1>Etiquetas</h1>
      <p className="page-subtitle">
        Para clasificar las conversaciones de la bandeja: “Presupuesto”, “Reclamo”, “Mayorista”, lo
        que le sirva al negocio. Una conversacion puede llevar varias, y en la bandeja se filtra por
        etiqueta.
      </p>

      <LabelsManager
        orgId={membership.org_id}
        userId={userId}
        canManageAll={isAdmin(membership.role)}
        initialLabels={labels}
      />
    </main>
  )
}
