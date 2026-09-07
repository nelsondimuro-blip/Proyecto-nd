import ConversationList from '@/components/ConversationList'
import Workspace from '@/components/Workspace'
import { requireMembership } from '@/lib/auth'
import type { ConversationWithRelations } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const { supabase, membership, userId } = await requireMembership()

  const { data } = await supabase
    .from('conversations')
    .select('*, whatsapp_accounts(id, label, phone_number), contacts(id, display_name, phone)')
    .eq('org_id', membership.org_id)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(200)

  return (
    <Workspace>
      <ConversationList
        initialConversations={(data ?? []) as unknown as ConversationWithRelations[]}
        orgId={membership.org_id}
        userId={userId}
      />
      {children}
    </Workspace>
  )
}
