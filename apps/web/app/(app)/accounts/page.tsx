import AccountsPanel from '@/components/AccountsPanel'
import { isAdmin, requireMembership } from '@/lib/auth'
import type { WhatsAppAccount } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Numeros | Bandeja WhatsApp' }

export default async function AccountsPage() {
  const { supabase, membership } = await requireMembership()

  const { data } = await supabase
    .from('whatsapp_accounts')
    .select('*')
    .eq('org_id', membership.org_id)
    .order('created_at', { ascending: true })

  return (
    <main className="page">
      <h1>Numeros de WhatsApp</h1>
      <p className="page-subtitle">
        Cada numero del grupo se vincula escaneando un QR, igual que WhatsApp Web. Las conversaciones de todos
        los numeros caen en la misma bandeja.
      </p>

      <p className="alert" data-tone="info">
        La vinculacion por QR usa una libreria no oficial (Baileys). Funciona sin tramites, pero incumple los
        Terminos de Servicio de Meta y los numeros pueden ser bloqueados, sobre todo con envios masivos. Para
        uso comercial intensivo conviene migrar a la API oficial de WhatsApp Cloud.
      </p>

      <AccountsPanel
        initialAccounts={(data ?? []) as WhatsAppAccount[]}
        orgId={membership.org_id}
        canManage={isAdmin(membership.role)}
      />
    </main>
  )
}
