import { createClient } from '@supabase/supabase-js'
import { env } from './env'

/**
 * Cliente con service role: el gateway es el unico componente que escribe
 * mensajes y credenciales, y omite RLS a proposito. Nunca exponerlo al navegador.
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { 'x-application-name': 'proyecto-nd-gateway' } },
})
