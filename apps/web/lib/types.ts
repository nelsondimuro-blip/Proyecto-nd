export type MemberRole = 'owner' | 'admin' | 'agent'
export type AccountStatus = 'disconnected' | 'connecting' | 'qr' | 'connected' | 'logged_out' | 'error'
export type ConversationStatus = 'open' | 'pending' | 'closed'
export type MessageDirection = 'in' | 'out'
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface Organization {
  id: string
  name: string
}

export interface Membership {
  org_id: string
  role: MemberRole
  organizations: Organization | null
}

export interface WhatsAppAccount {
  id: string
  org_id: string
  label: string
  phone_number: string | null
  status: AccountStatus
  qr_code: string | null
  qr_expires_at: string | null
  last_error: string | null
  connected_at: string | null
  created_at: string
}

export interface Conversation {
  id: string
  org_id: string
  account_id: string
  contact_id: string | null
  chat_id: string
  is_group: boolean
  subject: string | null
  status: ConversationStatus
  assigned_to: string | null
  unread_count: number
  last_message_at: string | null
  last_message_preview: string | null
}

export interface ConversationWithRelations extends Conversation {
  whatsapp_accounts: Pick<WhatsAppAccount, 'id' | 'label' | 'phone_number'> | null
  contacts: { id: string; display_name: string | null; phone: string | null } | null
}

export interface Message {
  id: string
  conversation_id: string
  account_id: string
  wa_message_id: string
  direction: MessageDirection
  sender_wa_id: string | null
  sender_name: string | null
  type: string
  body: string | null
  media_path: string | null
  media_mime: string | null
  media_filename: string | null
  is_voice: boolean
  status: MessageStatus
  sent_at: string
}
