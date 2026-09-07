import { notFound } from 'next/navigation'
import MessageThread, { type TeamMember } from '@/components/MessageThread'
import { requireMembership } from '@/lib/auth'
import type { ConversationWithRelations, Message } from '@/lib/types'

export const dynamic = 'force-dynamic'

const MESSAGE_PAGE_SIZE = 200

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params
  const { supabase, membership, userId, email } = await requireMembership()

  const { data: conversation } = await supabase
    .from('conversations')
    .select('*, whatsapp_accounts(id, label, phone_number, status), contacts(id, display_name, phone)')
    .eq('id', conversationId)
    .eq('org_id', membership.org_id)
    .maybeSingle()

  if (!conversation) notFound()

  const [{ data: messages }, { data: members }] = await Promise.all([
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: false })
      .limit(MESSAGE_PAGE_SIZE),
    supabase.from('org_members').select('user_id, profiles(email, full_name)').eq('org_id', membership.org_id),
  ])

  const team: TeamMember[] = (members ?? []).map((member: any) => {
    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles
    return {
      user_id: member.user_id,
      name: profile?.full_name || profile?.email || 'Agente',
    }
  })

  const agentName = team.find((member) => member.user_id === userId)?.name ?? email ?? 'Agente'
  const account = (conversation as any).whatsapp_accounts
  // La consulta trae los ultimos N mensajes; el hilo se muestra en orden cronologico.
  const ordered = ((messages ?? []) as Message[]).slice().reverse()

  return (
    <MessageThread
      conversation={conversation as unknown as ConversationWithRelations}
      initialMessages={ordered}
      members={team}
      canSend={account?.status === 'connected'}
      agentName={agentName}
    />
  )
}
