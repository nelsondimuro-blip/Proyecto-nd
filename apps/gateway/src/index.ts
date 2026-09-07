import crypto from 'node:crypto'
import express, { type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { env } from './env'
import { logger } from './logger'
import { sessionManager } from './manager'
import { supabase } from './supabase'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))

// ---------------------------------------------------------------------------
// Autenticacion: solo el backend de la web puede hablar con el gateway.
// ---------------------------------------------------------------------------
const expectedSecret = Buffer.from(env.GATEWAY_SHARED_SECRET)

function authenticate(req: Request, res: Response, next: NextFunction): void {
  const provided = Buffer.from(String(req.header('x-gateway-secret') ?? ''))

  if (provided.length !== expectedSecret.length || !crypto.timingSafeEqual(provided, expectedSecret)) {
    res.status(401).json({ error: 'no autorizado' })
    return
  }

  next()
}

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() })
})

app.use(authenticate)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
interface AccountRow {
  id: string
  org_id: string
  status: string
  phone_number: string | null
  qr_code: string | null
  last_error: string | null
}

async function loadAccount(accountId: string): Promise<AccountRow | null> {
  const { data, error } = await supabase
    .from('whatsapp_accounts')
    .select('id, org_id, status, phone_number, qr_code, last_error')
    .eq('id', accountId)
    .maybeSingle()

  if (error) throw error
  return data as AccountRow | null
}

const uuid = z.string().uuid()

/** Envuelve un handler async para que los rechazos lleguen al middleware de errores. */
const asyncRoute =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next)
  }

async function withAccount(
  req: Request,
  res: Response,
  handler: (account: AccountRow) => Promise<void>,
): Promise<void> {
  const parsed = uuid.safeParse(req.params.id)
  if (!parsed.success) {
    res.status(400).json({ error: 'id de cuenta invalido' })
    return
  }

  const account = await loadAccount(parsed.data)
  if (!account) {
    res.status(404).json({ error: 'cuenta no encontrada' })
    return
  }

  await handler(account)
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

/** Abre (o reanuda) la sesion. La web observa el QR por Realtime en la fila de la cuenta. */
app.post(
  '/accounts/:id/connect',
  asyncRoute(async (req, res) => {
    await withAccount(req, res, async (account) => {
      await sessionManager.open(account.id, account.org_id)
      res.json({ ok: true, accountId: account.id })
    })
  }),
)

app.post(
  '/accounts/:id/disconnect',
  asyncRoute(async (req, res) => {
    await withAccount(req, res, async (account) => {
      await sessionManager.close(account.id)
      res.json({ ok: true })
    })
  }),
)

app.post(
  '/accounts/:id/logout',
  asyncRoute(async (req, res) => {
    await withAccount(req, res, async (account) => {
      const session = sessionManager.get(account.id)
      if (session) {
        await sessionManager.logout(account.id)
      } else {
        // Sin sesion viva igual limpiamos credenciales para forzar un QR nuevo.
        await supabase.from('whatsapp_auth_state').delete().eq('account_id', account.id)
        await supabase
          .from('whatsapp_accounts')
          .update({ status: 'logged_out', qr_code: null, qr_expires_at: null, phone_number: null })
          .eq('id', account.id)
      }
      res.json({ ok: true })
    })
  }),
)

app.get(
  '/accounts/:id/status',
  asyncRoute(async (req, res) => {
    await withAccount(req, res, async (account) => {
      const session = sessionManager.get(account.id)
      res.json({
        accountId: account.id,
        status: account.status,
        phoneNumber: account.phone_number,
        lastError: account.last_error,
        live: session ? session.inMemoryStatus : null,
      })
    })
  }),
)

const sendSchema = z.object({
  chatId: z.string().min(5),
  text: z.string().min(1).max(4096),
  sentBy: z.string().uuid().nullish(),
})

app.post(
  '/accounts/:id/messages',
  asyncRoute(async (req, res) => {
    await withAccount(req, res, async (account) => {
      const parsed = sendSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'cuerpo invalido', detalle: parsed.error.flatten() })
        return
      }

      const session = sessionManager.get(account.id)
      if (!session) {
        res.status(409).json({ error: 'la cuenta no esta conectada' })
        return
      }

      const result = await session.sendText({
        chatId: parsed.data.chatId,
        text: parsed.data.text,
        sentBy: parsed.data.sentBy ?? null,
      })

      res.status(201).json(result)
    })
  }),
)

const checkSchema = z.object({ phone: z.string().min(5) })

app.post(
  '/accounts/:id/check',
  asyncRoute(async (req, res) => {
    await withAccount(req, res, async (account) => {
      const parsed = checkSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'cuerpo invalido' })
        return
      }

      const session = sessionManager.get(account.id)
      if (!session) {
        res.status(409).json({ error: 'la cuenta no esta conectada' })
        return
      }

      res.json(await session.checkNumber(parsed.data.phone))
    })
  }),
)

// ---------------------------------------------------------------------------
// Errores y arranque
// ---------------------------------------------------------------------------
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'error no controlado en el gateway')
  res.status(500).json({ error: err.message })
})

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'gateway escuchando')
  void sessionManager.restore()
})

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'cerrando gateway')
  server.close()
  await sessionManager.closeAll()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
