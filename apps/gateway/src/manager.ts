import { logger } from './logger'
import { supabase } from './supabase'
import { WhatsAppSession } from './session'

/**
 * Registro en memoria de las sesiones activas. Una instancia del gateway es
 * duenia de las cuentas que arranca; para escalar horizontalmente habria que
 * repartir las cuentas por instancia (p.ej. hash del account_id).
 */
class SessionManager {
  private sessions = new Map<string, WhatsAppSession>()

  get(accountId: string): WhatsAppSession | undefined {
    return this.sessions.get(accountId)
  }

  async open(accountId: string, orgId: string): Promise<WhatsAppSession> {
    let session = this.sessions.get(accountId)

    if (!session) {
      session = new WhatsAppSession(accountId, orgId)
      this.sessions.set(accountId, session)
    }

    await session.start()
    return session
  }

  async close(accountId: string): Promise<void> {
    const session = this.sessions.get(accountId)
    if (!session) return
    await session.stop()
    this.sessions.delete(accountId)
  }

  async logout(accountId: string): Promise<void> {
    const session = this.sessions.get(accountId)
    if (!session) return
    await session.logout()
    this.sessions.delete(accountId)
  }

  async closeAll(): Promise<void> {
    await Promise.allSettled([...this.sessions.values()].map((session) => session.stop()))
    this.sessions.clear()
  }

  /** Al arrancar el proceso reabre las cuentas que estaban vinculadas. */
  async restore(): Promise<void> {
    const { data, error } = await supabase
      .from('whatsapp_accounts')
      .select('id, org_id, status')
      .in('status', ['connected', 'connecting', 'qr'])

    if (error) {
      logger.error({ err: error }, 'no se pudieron listar las cuentas para restaurar')
      return
    }

    for (const account of data ?? []) {
      try {
        await this.open(account.id, account.org_id)
        logger.info({ accountId: account.id }, 'sesion restaurada')
      } catch (err) {
        logger.error({ err, accountId: account.id }, 'no se pudo restaurar la sesion')
      }
    }
  }
}

export const sessionManager = new SessionManager()
