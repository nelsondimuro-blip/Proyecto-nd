import ConversationList from '@/components/ConversationList'
import Workspace from '@/components/Workspace'
import { requireMembership } from '@/lib/auth'
import { CONVERSATION_SELECT, withLabels } from '@/lib/labels'
import type { ConversationWithRelations, Label } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const { supabase, membership, userId } = await requireMembership()

  const [{ data }, { data: labels }] = await Promise.all([
    supabase
      .from('conversations')
      .select(CONVERSATION_SELECT)
      .eq('org_id', membership.org_id)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(200),
    supabase
      .from('labels')
      .select('id, org_id, name, color, created_by')
      .eq('org_id', membership.org_id)
      .order('name', { ascending: true }),
  ])

  return (
    <Workspace>
      <ConversationList
        initialConversations={(data ?? []).map(withLabels) as unknown as ConversationWithRelations[]}
        orgId={membership.org_id}
        userId={userId}
        labels={(labels ?? []) as Label[]}
      />
      {children}
    </Workspace>
  )
}
