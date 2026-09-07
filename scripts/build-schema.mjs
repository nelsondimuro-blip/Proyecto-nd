#!/usr/bin/env node
// Junta todas las migraciones en supabase/schema.sql, para pegarlo de una sola
// vez en el SQL Editor de Supabase.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'supabase', 'migrations')

const files = readdirSync(dir)
  .filter((name) => name.endsWith('.sql'))
  .sort()

const rule = '='.repeat(73)

const header = `-- ${rule}
-- ARCHIVO GENERADO - no editar a mano.
--
-- Es la union de supabase/migrations/*.sql, en orden, para pegar de una sola
-- vez en el SQL Editor de Supabase, sobre una base nueva y vacia.
-- Se regenera con:  npm run build:schema
--
-- Sobre una base que ya tiene datos hay que usar las migraciones, una por una
-- o con "supabase db push".
-- ${rule}

`

const body = files
  .map((name) => {
    const sql = readFileSync(path.join(dir, name), 'utf8').trim()
    return `-- ${rule}\n-- ${name}\n-- ${rule}\n\n${sql}\n`
  })
  .join('\n')

writeFileSync(path.join(root, 'supabase', 'schema.sql'), `${header}${body}`)

console.log(`schema.sql generado a partir de ${files.length} migraciones.`)
