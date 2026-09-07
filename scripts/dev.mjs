#!/usr/bin/env node
// Levanta el gateway y la web juntos, con la salida etiquetada, para no tener
// que abrir dos terminales.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

if (!existsSync(path.join(root, '.env'))) {
  console.error('\nFalta el archivo .env.\n\nCorre primero:  npm run setup\n')
  process.exit(1)
}

const COLORS = { gateway: '\u001b[36m', web: '\u001b[35m' }
const RESET = '\u001b[0m'

const children = []
let shuttingDown = false

function start(name, workspace) {
  const child = spawn('npm', ['run', 'dev', '--workspace', workspace], {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const label = `${COLORS[name]}[${name}]${RESET}`

  // Se acumula por lineas para que la etiqueta no parta un mensaje al medio.
  const relay = (stream, target) => {
    let buffer = ''

    stream.on('data', (chunk) => {
      buffer += String(chunk)
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) target.write(`${label} ${line}\n`)
    })
  }

  relay(child.stdout, process.stdout)
  relay(child.stderr, process.stderr)

  child.on('exit', (code) => {
    if (shuttingDown) return
    console.error(`${label} termino con codigo ${code}. Se cierra todo.`)
    shutdown(code ?? 1)
  })

  children.push(child)
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of children) child.kill('SIGTERM')
  setTimeout(() => process.exit(code), 400)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log('\nLevantando la bandeja... el panel queda en http://localhost:3000\n')

start('gateway', 'apps/gateway')
start('web', 'apps/web')
