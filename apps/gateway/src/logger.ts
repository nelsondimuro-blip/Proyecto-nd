import pino from 'pino'
import { env } from './env'

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ['req.headers["x-gateway-secret"]', 'creds', 'qr'],
    censor: '[oculto]',
  },
})

/** Baileys escribe mucho ruido en nivel debug; lo dejamos en warn salvo que se pida lo contrario. */
export const waLogger = logger.child({ mod: 'baileys' }, { level: env.LOG_LEVEL === 'debug' ? 'debug' : 'warn' })
