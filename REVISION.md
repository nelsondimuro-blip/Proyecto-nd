# Revisión del repositorio — Proyecto-ND

Fecha: 2026-07-27
Alcance revisado: `main` (solo README) y el commit `55f5d98`, que es el código real
del MVP y está abierto en dos pull requests.

---

## 1. Problemas de organización del repo

### 1.1 Dos PRs abiertos con exactamente el mismo commit

| PR | Rama | Head |
|----|------|------|
| [#1](https://github.com/nelsondimuro-blip/Proyecto-nd/pull/1) — *Bootstrap fintech del m² del Grupo TN con TN TOUP* | `claude/fintech-square-meter-pricing-pPuKP` | `55f5d98` |
| [#2](https://github.com/nelsondimuro-blip/Proyecto-nd/pull/2) — *Initial MVP: Grupo TN fintech platform with TN TOUP token* | `claude/desktop-app-startup-jmpbxa` | `55f5d98` |

No son dos versiones distintas: **apuntan al mismo commit**. Hay que cerrar uno de
los dos (mergear ambos no aporta nada y el segundo quedaría vacío). Recomendación:
quedarse con el #1 (descripción en español, más detallada) y cerrar el #2.

Mientras tanto `main` sigue teniendo únicamente el `README.md` — o sea, **el
proyecto todavía no está mergeado**.

### 1.2 Falta `pnpm-lock.yaml`

`package.json` fija `"packageManager": "pnpm@10.33.0"`, pero el lockfile no está
versionado. Sin él las instalaciones no son reproducibles y CI no puede usar
`pnpm install --frozen-lockfile`. Hay que generarlo y commitearlo.

---

## 2. Problemas que rompen los comandos del proyecto

> Nota: la política de red de este entorno bloquea `registry.npmjs.org`
> (`ERR_PNPM_FETCH_403`), así que **no pude instalar dependencias ni ejecutar
> `build` / `test` / `typecheck`**. Lo que sigue sale de leer el código y las
> configuraciones, no de una corrida real.

### 2.1 `pnpm test` falla seguro (3 paquetes)

`package.json` raíz define `"test": "pnpm -r test"`. Tres paquetes declaran un
script `test` que no puede terminar bien:

| Paquete | Script | Tiene tests | Tiene `vitest` | Resultado |
|---------|--------|-------------|----------------|-----------|
| `@tn/shared` | `vitest run` | no | **no** | `vitest: command not found` |
| `@tn/db` | `vitest run` | no | **no** | `vitest: command not found` |
| `@tn/ai` | `vitest run` | no | sí | exit 1 — *No test files found* |

Solo `@tn/toup` y `@tn/pricing` tienen tests de verdad
(`ledger.test.ts`, `peg.test.ts`, `quote.test.ts`).

**Arreglo mínimo** — sacar el script `test` de los tres paquetes sin tests:

```diff
   "scripts": {
     "build": "tsc -p tsconfig.json",
     "typecheck": "tsc -p tsconfig.json --noEmit",
-    "test": "vitest run",
     "lint": "tsc -p tsconfig.json --noEmit"
   },
```

(en `packages/shared/package.json`, `packages/db/package.json` y
`packages/ai/package.json`)

**Alternativa** si querés dejar el script preparado para tests futuros: usar
`vitest run --passWithNoTests` **y** agregar `"vitest": "^2.1.5"` a las
`devDependencies` de `@tn/shared` y `@tn/db`.

### 2.2 Los `dist/` que se generan no los usa nadie

Los paquetes tienen `"main": "./src/index.ts"` y `"types": "./src/index.ts"`, y
`apps/web` los consume vía `transpilePackages` de Next. Pero `build` corre
`tsc -p tsconfig.json` con `outDir: "dist"`, o sea genera una salida que ningún
import resuelve. Además el `include: ["src/**/*.ts"]` mete los `*.test.ts` dentro
de `dist/`.

No rompe nada, pero `pnpm build` está haciendo trabajo muerto. O se apunta
`main`/`types` a `dist/index.js` + `dist/index.d.ts`, o se cambia el `build` de
esos paquetes por un `typecheck` y listo.

---

## 3. Dependencias desactualizadas

### 3.1 `@anthropic-ai/sdk ^0.32.1` con modelos de 2025/2026

`packages/ai` y `apps/web` fijan `@anthropic-ai/sdk ^0.32.1` (fines de 2024),
mientras `packages/ai/src/client.ts` apunta a modelos muy posteriores a esa
versión del SDK. Conviene subir el SDK y usar los IDs actuales sin sufijo de fecha:

```diff
 export const MODELS = {
-  intake: "claude-haiku-4-5-20251001",
-  procurement: "claude-haiku-4-5-20251001",
-  inmobiliaria: "claude-haiku-4-5-20251001",
-  advisor: "claude-opus-4-7",
+  intake: "claude-haiku-4-5",
+  procurement: "claude-haiku-4-5",
+  inmobiliaria: "claude-haiku-4-5",
+  advisor: "claude-opus-5",
 } as const;
```

Y en `packages/ai/package.json` + `apps/web/package.json`, subir
`"@anthropic-ai/sdk"` a la última versión.

Detalles menores del mismo archivo:

- `MODELS.procurement` y `MODELS.inmobiliaria` no se usan en ningún lado
  (`inmobiliaria.ts` es un matcher determinístico, no llama a la API).
- `apps/web` declara `@anthropic-ai/sdk` como dependencia directa pero no lo
  importa nunca — lo usa a través de `@tn/ai`. Se puede sacar.

---

## 4. Bugs en la lógica de negocio

### 4.1 `/api/quote` inventa un tipo de cambio si no hay datos (alto)

`apps/web/app/api/quote/route.ts:58`

```ts
const usdARS = usdSerie[0] ? Number(usdSerie[0].usdARS) : 1000;
```

Si la tabla `PriceIndex` está vacía, la cotización se calcula igual con un
dólar a **1000 ARS inventado**, y el cliente recibe totales en USD que no
significan nada — sin ninguna advertencia. En una app de cotizaciones esto es
plata mal calculada.

Debería devolver un error (`503` / `409`) o al menos marcar el resultado como
no confiable, igual que se hace con el peg.

### 4.2 El endpoint ignora `peg.stale` (medio)

`packages/toup/src/peg.ts` calcula `stale` y `diasAntiguedad` justamente para
avisar que el precio de Trefilcon está viejo. `/api/quote` los mete dentro de
`pegInfo` pero **no corta ni advierte**: si el último precio tiene 6 meses, la
cotización sale igual como si fuera de hoy.

### 4.3 `validateInvariants` no valida el invariante que documenta (medio)

`packages/toup/src/ledger.ts:161-186`

El comentario declara tres invariantes, pero la función solo chequea el 1 y el 3:

```
 *   1) sumaWallets() === 0                                  ✅ verificado
 *   2) totalEmitido = -reserveWallet.balance                 ❌ NO verificado
 *   3) totalEmitido (TOUP) ≤ reservaTotalRollos()            ✅ verificado
```

El invariante 2 (lo emitido tiene que coincidir con el saldo negativo de la
wallet de reserva) es el que detecta un mint que se registró sin su contrapartida.
O se implementa, o se saca del comentario para que no dé falsa seguridad.

### 4.4 `matchPropiedades` puntúa de más con ubicación vacía (bajo)

`packages/ai/src/inmobiliaria.ts:55`

```ts
if (p.ubicacion.toLowerCase().includes(ubicacionLower.split(",")[0]!.trim())) {
```

`ObraInputSchema` valida `ubicacion: z.string().min(2)`, así que `"  "` (dos
espacios) pasa la validación. En ese caso `.split(",")[0].trim()` da `""`, y
`"loquesea".includes("")` es siempre `true`: **todas** las propiedades reciben
los +20 puntos de "ubicación coincide". Conviene usar `.trim().min(2)` en el
schema, o saltear el bloque cuando el término queda vacío.

---

## 5. Resumen priorizado

| # | Problema | Severidad | Dónde |
|---|----------|-----------|-------|
| 4.1 | Tipo de cambio USD inventado (1000) sin avisar | **Alta** | `apps/web/app/api/quote/route.ts:58` |
| 2.1 | `pnpm test` falla en 3 paquetes | **Alta** | `packages/{shared,db,ai}/package.json` |
| 1.1 | Dos PRs duplicados del mismo commit | Alta | GitHub |
| 4.2 | Se ignora `peg.stale` al cotizar | Media | `apps/web/app/api/quote/route.ts` |
| 4.3 | Invariante 2 del ledger documentado pero no verificado | Media | `packages/toup/src/ledger.ts:161` |
| 3.1 | SDK de Anthropic 2 años desactualizado | Media | `packages/ai`, `apps/web` |
| 1.2 | Falta `pnpm-lock.yaml` | Media | raíz |
| 4.4 | Ubicación vacía puntúa todas las propiedades | Baja | `packages/ai/src/inmobiliaria.ts:55` |
| 2.2 | `dist/` generado que nadie consume | Baja | `packages/*/tsconfig.json` |

---

## 6. Lanzador de sesiones (`scripts/Mis_sesiones_TN.cmd`)

El `.cmd` original del escritorio tenía tres fallas que explican que "no aparezcan
las sesiones":

1. `cd /d "C:\Users\PCTN_03\Desktop\TN TU OP"` — si esa carpeta no existe (por
   ejemplo porque el Escritorio está redirigido a OneDrive, o se llama
   "Escritorio"), **`cd` falla pero el script sigue igual** y Claude arranca en
   otra carpeta. Como Claude Code guarda las sesiones **por carpeta**, `--resume`
   no muestra nada aunque las sesiones existan.
2. Usuario `PCTN_03` hardcodeado — no funciona en otra máquina o usuario.
3. Sin `pause`: si algo falla, la ventana se cierra al instante y no se puede leer
   el error.

La versión corregida en `scripts/Mis_sesiones_TN.cmd` busca la carpeta en las
cuatro ubicaciones posibles (Desktop/Escritorio × perfil local/OneDrive), busca
`claude.exe` en el perfil y en el `PATH`, verifica cada paso antes de seguir, y
deja la ventana abierta con un mensaje claro si algo sale mal.

**Para usarla:** copiá `scripts/Mis_sesiones_TN.cmd` al escritorio reemplazando el
`.cmd` actual.
