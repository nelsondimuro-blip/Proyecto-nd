# Proyecto-ND — Fintech del metro cuadrado (Grupo TN)

Plataforma del **Grupo TN** que une toda la cadena del m² (Servicios, Constructora, Materiales, Inmobiliaria) detrás de un token interno respaldado por un commodity real: **TN TOUP**.

## TN TOUP

**1 TOUP = precio de mercado de 1 rollo de cable Trefilcon 1×2,5 mm² × 100 m.**

TN Materiales distribuye y respalda físicamente cada TOUP emitido. El peg se actualiza desde el back-office a partir del precio de mercado del rollo. Detalles en `/root/.claude/plans/quiero-crear-una-fintch-cryptic-turing.md`.

## Estructura

```
proyecto-nd/
├── apps/
│   └── web/                # Next.js 15 (App Router)
├── packages/
│   ├── shared/             # Tipos y schemas zod
│   ├── db/                 # Prisma schema + cliente + seed
│   ├── toup/               # Peg Trefilcon + ledger double-entry
│   ├── pricing/            # Motor cotización m² (preferencia grupo)
│   └── ai/                 # Agentes Claude (intake, advisor, inmobiliaria)
└── infra/
    └── docker-compose.yml  # Postgres 16 local
```

## Setup local

```bash
pnpm install
cp .env.example .env       # configurar DATABASE_URL y ANTHROPIC_API_KEY
pnpm db:up                 # levanta Postgres
pnpm --filter @tn/db migrate   # crea schema
pnpm --filter @tn/db seed      # carga empresas, catálogo, peg inicial
pnpm dev                   # http://localhost:3000
```

## Tests

```bash
pnpm -r test               # corre vitest en todos los paquetes
```

Cubren:
- Peg Trefilcon (último precio ≤ fecha, staleness, conversiones ARS/USD/TOUP).
- Ledger double-entry: mint, burn, transfer, invariantes (suma=0, emitido ≤ reservas).
- Motor de pricing: rubros, ahorro vs. mercado, preferencia de grupo, refacción.

## Rutas

| Ruta              | Descripción                                                       |
| ----------------- | ----------------------------------------------------------------- |
| `/`               | Landing del grupo                                                 |
| `/cotizar`        | Cotizador conversacional con IA + breakdown + asesor              |
| `/propiedades`    | Cartera de TN Inmobiliaria                                        |
| `/wallet`         | Saldo TOUP + peg Trefilcon vigente + historial                    |
| `/admin`          | Back-office: empresas, peg, wallets del sistema                   |
| `/api/quote`      | POST descripción libre → cotización                               |
| `/api/chat`       | POST quote + pregunta → advisor IA streaming                      |

## Branch

Trabajo en `claude/fintech-square-meter-pricing-pPuKP`.
