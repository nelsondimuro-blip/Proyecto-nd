#!/usr/bin/env node
// Asistente para crear el .env sin tener que copiar y pegar a mano.
import { createInterface } from 'node:readline/promises'
import { randomBytes } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { stdin as input, stdout as output } from 'node:process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = path.join(root, '.env')

const rl = createInterface({ input, output })

const ask = async (question, { validate } = {}) => {
  for (;;) {
    const answer = (await rl.question(question)).trim()

    if (!answer) {
      console.log('  -> Este dato es obligatorio.\n')
      continue
    }

    const problem = validate?.(answer)
    if (problem) {
      console.log(`  -> ${problem}\n`)
      continue
    }

    return answer
  }
}

const isUrl = (value) =>
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(value)
    ? null
    : 'Tiene que ser algo como https://abcdefgh.supabase.co'

const isKey = (value) =>
  value.length > 30 ? null : 'La clave parece incompleta: son varias lineas de letras y numeros.'

console.log(`
Configuracion de la bandeja de WhatsApp
=======================================

Necesitas tres datos del panel de Supabase, en Project Settings > API.
Dejalos a mano y pegalos aca.
`)

if (existsSync(envPath)) {
  const overwrite = await rl.question('Ya existe un archivo .env. Lo reemplazo? (s/N) ')

  if (overwrite.trim().toLowerCase() !== 's') {
    console.log('\nNo se toco nada. Podes editar el .env a mano.')
    rl.close()
    process.exit(0)
  }
}

const url = (await ask('1. Project URL: ', { validate: isUrl })).replace(/\/$/, '')
const anonKey = await ask('2. Clave anon public: ', { validate: isKey })
const serviceKey = await ask('3. Clave service_role (la secreta): ', { validate: isKey })

if (anonKey === serviceKey) {
  console.log('\nAviso: las dos claves son iguales. Fijate de no haber pegado dos veces la misma.\n')
}

const secret = randomBytes(32).toString('hex')

const env = `# Generado por: npm run setup
NEXT_PUBLIC_SUPABASE_URL=${url}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}

SUPABASE_URL=${url}
SUPABASE_SERVICE_ROLE_KEY=${serviceKey}

GATEWAY_URL=http://localhost:8080
GATEWAY_SHARED_SECRET=${secret}

PORT=8080
LOG_LEVEL=info
WA_BROWSER_NAME=Proyecto ND Inbox
`

// Permisos restrictivos: el archivo lleva la clave service_role.
writeFileSync(envPath, env, { mode: 0o600 })

console.log(`
Listo: se escribio .env (el secreto del gateway se genero solo).

Lo que sigue:

  1. Aplicar el esquema en Supabase: abri el SQL Editor y pega el contenido
     de supabase/schema.sql. Es un solo archivo.
  2. En Authentication > Sign In / Providers > Email, apaga "Confirm email"
     para poder entrar sin confirmar la casilla.
  3. npm run dev
`)

rl.close()
