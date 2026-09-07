import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from '@whiskeysockets/baileys'
import { supabase } from './supabase'

const TABLE = 'whatsapp_auth_state'

/** Baileys guarda Buffers; BufferJSON los convierte a algo que jsonb acepta. */
const encode = (value: unknown) => JSON.parse(JSON.stringify(value, BufferJSON.replacer))
const decode = (value: unknown) => JSON.parse(JSON.stringify(value), BufferJSON.reviver)

export interface SupabaseAuthState {
  state: AuthenticationState
  saveCreds: () => Promise<void>
  clear: () => Promise<void>
}

/**
 * Equivalente a `useMultiFileAuthState` pero guardando las credenciales en
 * Postgres, para que el gateway pueda reiniciarse o escalar sin perder sesiones.
 */
export async function useSupabaseAuthState(accountId: string): Promise<SupabaseAuthState> {
  const readKey = async (key: string): Promise<any | null> => {
    const { data, error } = await supabase
      .from(TABLE)
      .select('value')
      .eq('account_id', accountId)
      .eq('key', key)
      .maybeSingle()

    if (error) throw error
    return data ? decode(data.value) : null
  }

  const writeKeys = async (entries: { key: string; value: unknown }[]) => {
    if (entries.length === 0) return
    const rows = entries.map((entry) => ({
      account_id: accountId,
      key: entry.key,
      value: encode(entry.value),
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'account_id,key' })
    if (error) throw error
  }

  const removeKeys = async (keys: string[]) => {
    if (keys.length === 0) return
    const { error } = await supabase.from(TABLE).delete().eq('account_id', accountId).in('key', keys)
    if (error) throw error
  }

  const creds: AuthenticationCreds = (await readKey('creds')) ?? initAuthCreds()

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const result: { [id: string]: any } = {}

          await Promise.all(
            ids.map(async (id) => {
              let value = await readKey(`${type}-${id}`)
              if (value && type === 'app-state-sync-key') {
                value = proto.Message.AppStateSyncKeyData.fromObject(value)
              }
              if (value) result[id] = value
            }),
          )

          return result as { [id: string]: SignalDataTypeMap[typeof type] }
        },
        set: async (data) => {
          const upserts: { key: string; value: unknown }[] = []
          const deletes: string[] = []

          for (const type of Object.keys(data)) {
            const bucket = (data as unknown as Record<string, Record<string, unknown>>)[type] ?? {}
            for (const id of Object.keys(bucket)) {
              const value = bucket[id]
              const key = `${type}-${id}`
              if (value) upserts.push({ key, value })
              else deletes.push(key)
            }
          }

          await Promise.all([writeKeys(upserts), removeKeys(deletes)])
        },
      },
    },
    saveCreds: () => writeKeys([{ key: 'creds', value: creds }]),
    clear: async () => {
      const { error } = await supabase.from(TABLE).delete().eq('account_id', accountId)
      if (error) throw error
    },
  }
}
