# Bandeja unificada de WhatsApp — Proyecto ND

Todos los numeros de WhatsApp del grupo de negocios en una sola bandeja de entrada
compartida: los mensajes de cada numero llegan al mismo panel, el equipo responde
desde ahi y cada conversacion se puede asignar a un agente.

```
apps/web       Next.js 15 (App Router) + Supabase — interfaz y API
apps/gateway   Node.js + Baileys — una sesion de WhatsApp por numero
supabase/      Migraciones SQL (esquema, RLS, realtime, storage)
```

## Aviso importante sobre la conexion por QR

La vinculacion se hace escaneando un QR con **Baileys**, una libreria no oficial que
simula WhatsApp Web. Funciona sin tramites y con cualquier numero, pero:

- **Incumple los Terminos de Servicio de Meta.** Los numeros pueden ser bloqueados,
  sobre todo si se usan para envios masivos o mensajes no solicitados.
- No hay soporte ni garantias de Meta; un cambio del protocolo puede romper la conexion.

Para uso comercial intensivo, la via segura es la **WhatsApp Cloud API** oficial. El
codigo esta separado en una capa de proveedor (`apps/gateway`) justamente para poder
cambiar de motor sin tocar la web ni la base de datos: la app solo lee y escribe en las
tablas de Supabase.

## Que incluye

- **Bandeja unificada**: conversaciones de todos los numeros, en tiempo real (Supabase Realtime).
- **Multi-numero**: cada numero es una "cuenta" con su propio QR, estado y credenciales.
- **Chats individuales y de grupo**, con nombre del remitente en los grupos.
- **Adjuntos** (imagen, video, audio, documentos) guardados en un bucket privado,
  servidos con URLs firmadas de corta duracion.
- **Envio de texto** desde el panel, con estado de entrega (enviado / recibido / leido).
- **Trabajo en equipo**: asignacion de conversaciones, estados (abierta / pendiente / cerrada),
  contador de no leidos y filtros.
- **Aislamiento por organizacion** con Row Level Security en todas las tablas.

## Puesta en marcha

### 1. Base de datos (Supabase)

Crear un proyecto en [supabase.com](https://supabase.com) y aplicar la migracion:

```bash
supabase link --project-ref <ref-del-proyecto>
supabase db push
```

(O pegar el contenido de `supabase/migrations/20260907000000_init.sql` en el SQL Editor.)

La migracion crea el esquema, las politicas de RLS, el bucket privado `whatsapp-media`
y publica las tablas en Realtime.

### 2. Variables de entorno

```bash
cp .env.example .env
```

| Variable | Donde se usa | Notas |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web (navegador) | Publicas; protegidas por RLS |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | gateway | **Secretas.** Nunca en el navegador |
| `GATEWAY_URL` | web (servidor) | URL interna del gateway |
| `GATEWAY_SHARED_SECRET` | web + gateway | `openssl rand -hex 32` |

### 3. Instalar y levantar

```bash
npm install
npm run dev:gateway   # http://localhost:8080
npm run dev:web       # http://localhost:3000
```

### 4. Primer uso

1. Entrar a `http://localhost:3000`, crear una cuenta y luego el espacio de trabajo.
2. Ir a **Numeros** y agregar uno por cada linea del grupo (ej. "Ventas", "Soporte").
3. Pulsar **Conectar**: aparece el QR. Escanearlo desde el telefono en
   *WhatsApp > Ajustes > Dispositivos vinculados > Vincular un dispositivo*.
4. Al conectar, los mensajes empiezan a caer en **Bandeja**.

Para sumar companieros: que creen su cuenta en la app y luego agregar su `user_id` a la
tabla `org_members` con el rol correspondiente (`owner`, `admin` o `agent`).

## Arquitectura

```
WhatsApp  <--websocket-->  gateway (Baileys)  --service role-->  Supabase (Postgres + Storage)
                                 ^                                      |
                                 | HTTP + secreto compartido            | Realtime + RLS
                                 |                                      v
                              Next.js (server)  <----------------  Next.js (navegador)
```

- El **gateway** es el unico que habla con WhatsApp y el unico que escribe mensajes y
  credenciales (usa la service role key, omite RLS). Guarda las credenciales de cada
  sesion en `whatsapp_auth_state`, asi puede reiniciarse sin volver a escanear el QR.
- La **web** nunca ve el secreto del gateway desde el navegador: los botones llaman a
  route handlers de Next.js que verifican la membresia y recien ahi contactan al gateway.
- El **QR y los estados** viajan por la fila de `whatsapp_accounts` y llegan al navegador
  por Realtime, sin polling.
- Los **mensajes salientes** se guardan al enviarse; el eco que devuelve WhatsApp no
  duplica gracias a la unicidad `(conversation_id, wa_message_id)`.

### Modelo de datos

| Tabla | Para que |
| --- | --- |
| `organizations`, `org_members`, `profiles` | El grupo de negocios y su equipo |
| `whatsapp_accounts` | Un numero conectado (estado, QR, telefono) |
| `whatsapp_auth_state` | Credenciales de Baileys (solo service role) |
| `contacts` | Directorio unificado de la organizacion |
| `conversations` | Un chat por cuenta (individual o grupo) |
| `messages` | Historial, con direccion, tipo, adjunto y estado de entrega |

## API del gateway

Todas las rutas (salvo `/healthz`) exigen la cabecera `x-gateway-secret`.

| Metodo | Ruta | Que hace |
| --- | --- | --- |
| `GET` | `/healthz` | Verificacion de vida |
| `POST` | `/accounts/:id/connect` | Abre o reanuda la sesion (genera QR si hace falta) |
| `POST` | `/accounts/:id/disconnect` | Cierra el socket conservando las credenciales |
| `POST` | `/accounts/:id/logout` | Desvincula el dispositivo y borra credenciales |
| `GET` | `/accounts/:id/status` | Estado en base de datos y en memoria |
| `POST` | `/accounts/:id/messages` | Envia un texto (`chatId`, `text`) |
| `POST` | `/accounts/:id/check` | Comprueba si un numero tiene WhatsApp |

## Despliegue

- **Web**: Vercel u otro host de Next.js. Cargar las cuatro variables (`NEXT_PUBLIC_*`,
  `GATEWAY_URL`, `GATEWAY_SHARED_SECRET`).
- **Gateway**: necesita un proceso de larga duracion con sockets abiertos, asi que **no**
  va en serverless. `apps/gateway/Dockerfile` sirve para Railway, Fly.io, Render o una VM.
  Conviene dejarlo en una red privada o detras de una allowlist: su unica proteccion es
  el secreto compartido.
- Una sola instancia del gateway es duenia de sus sesiones. Para escalar horizontalmente
  hay que repartir las cuentas entre instancias (por ejemplo, por hash del `account_id`).

## Limitaciones conocidas

- Solo se envian **mensajes de texto** desde el panel; los adjuntos se reciben pero
  todavia no se envian.
- El historial previo a la vinculacion no se importa (`syncFullHistory` esta desactivado
  para no saturar la base).
- La gestion de miembros se hace por ahora desde Supabase, no desde la interfaz.
