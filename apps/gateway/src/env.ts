import path from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'

// El .env vive en la raiz del monorepo para compartirlo con la web.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })
dotenv.config()

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  GATEWAY_SHARED_SECRET: z.string().min(16, 'GATEWAY_SHARED_SECRET debe tener al menos 16 caracteres'),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.string().default('info'),
  WA_BROWSER_NAME: z.string().default('Proyecto ND Inbox'),
  MEDIA_BUCKET: z.string().default('whatsapp-media'),
  MAX_MEDIA_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const detalle = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(`Configuracion invalida del gateway:\n${detalle}`)
}

export const env = parsed.data
