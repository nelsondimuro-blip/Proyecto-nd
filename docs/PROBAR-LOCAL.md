# Probar la app en tu computadora

Guia para tener la bandeja andando de verdad, con un numero real vinculado.
Toma entre 15 y 20 minutos. No hace falta pagar nada: Supabase tiene plan gratis.

> **Usa un numero de prueba para el primer intento**, no el WhatsApp principal del
> negocio. La vinculacion por QR usa una libreria no oficial (Baileys) que incumple
> los Terminos de Servicio de Meta, y un numero puede terminar bloqueado.

---

## 1. Lo que necesitas antes de empezar

| Que | Como saber si lo tenes | Si no lo tenes |
| --- | --- | --- |
| **Node 20 o mayor** | `node -v` en la terminal | [nodejs.org](https://nodejs.org) (version LTS) |
| **Git** | `git -v` | [git-scm.com](https://git-scm.com) |
| **ffmpeg** (opcional) | `ffmpeg -version` | `brew install ffmpeg` / `sudo apt install ffmpeg` |
| **Un telefono con WhatsApp** | — | Para escanear el QR una vez |

Sin ffmpeg anda todo menos las notas de voz, que avisan con un error claro.

---

## 2. Crear la base de datos (Supabase)

1. Entra a [supabase.com](https://supabase.com), crea una cuenta y luego **New project**.
2. Elegi un nombre, una contrasenia para la base (guardala) y la region mas cercana.
3. Espera un minuto a que termine de crearse.

### Aplicar el esquema

**Opcion A — con la CLI** (una sola orden, pide la contrasenia de la base):

```bash
npx supabase login
npx supabase link --project-ref <ref-de-tu-proyecto>
npx supabase db push
```

El `project-ref` esta en la URL del panel: `supabase.com/dashboard/project/<ref>`.

**Opcion B — copiando y pegando**: abri **SQL Editor** en el panel de Supabase y
pega el contenido de cada archivo de `supabase/migrations/`, **en orden por nombre**,
ejecutando uno por uno:

1. `20260907000000_init.sql`
2. `20260907010000_outbound_media.sql`
3. `20260907020000_voice_notes.sql`
4. `20260907030000_team_management.sql`
5. `20260907040000_quick_replies.sql`
6. `20260907050000_labels.sql`

### Desactivar la confirmacion por correo (para probar)

En **Authentication › Sign In / Providers › Email**, apaga **Confirm email**. Si no,
Supabase te va a pedir confirmar la casilla antes de dejarte entrar. En produccion
conviene dejarlo prendido.

### Copiar las claves

En **Project Settings › API** vas a encontrar tres datos:

- **Project URL**
- **anon public** (clave publica, va al navegador)
- **service_role** (clave secreta, **solo** para el gateway)

---

## 3. Bajar el codigo y configurarlo

```bash
git clone https://github.com/nelsondimuro-blip/Proyecto-nd.git
cd Proyecto-nd
git checkout claude/whatsapp-group-connector-app-7ad2gf
cp .env.example .env
```

Abri el `.env` con cualquier editor y completa:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co     # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...           # anon public
SUPABASE_URL=https://xxxx.supabase.co                 # el mismo Project URL
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...               # service_role
GATEWAY_URL=http://localhost:8080
GATEWAY_SHARED_SECRET=...                             # ver abajo
```

Para el secreto compartido, genera uno largo al azar:

```bash
openssl rand -hex 32
```

(En Windows sin `openssl`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.)

---

## 4. Instalar y levantar

```bash
npm install
```

Despues, **dos terminales abiertas al mismo tiempo**, las dos paradas en la carpeta
del proyecto:

```bash
# terminal 1 — el que habla con WhatsApp
npm run dev:gateway
```

```bash
# terminal 2 — la web
npm run dev:web
```

La primera deberia decir `gateway escuchando` en el puerto 8080; la segunda, que la
web esta en `http://localhost:3000`.

---

## 5. Primer uso

1. Abri **http://localhost:3000** y **Registrarme** con tu correo y una contrasenia.
2. Poné el nombre del grupo de negocios: crea tu espacio de trabajo.
3. Vas a caer en **Numeros**. Toca **Agregar**, escribi un nombre para la linea
   (por ejemplo "Ventas") y despues **Conectar**.
4. Aparece el QR. En el telefono: **WhatsApp › Ajustes › Dispositivos vinculados ›
   Vincular un dispositivo**, y escanealo.
5. El estado pasa a **Conectado** solo, sin recargar la pagina.

### Probar que anda

- Desde **otro** telefono, mandale un mensaje al numero que vinculaste: tiene que
  aparecer en **Bandeja** en un par de segundos.
- Respondé desde el panel y fijate que llegue al telefono, con sus tildes.
- Mandá una foto con el clip, grabá una nota de voz con el microfono.
- Escribí `/` en el cuadro de mensaje (antes crea alguna en **Respuestas rapidas**).
- Etiquetá la conversacion con **+ Etiqueta** y despues filtra por esa etiqueta.

---

## Si algo no sale

| Sintoma | Que pasa |
| --- | --- |
| `Configuracion invalida del gateway` | Falta o esta mal algun dato del `.env`. El mensaje dice cual. |
| El QR no aparece | Mira la terminal del gateway: si dice `no autorizado`, el `GATEWAY_SHARED_SECRET` no es el mismo en los dos lados. |
| Entro y me manda de vuelta al login | Quedo prendida la confirmacion por correo en Supabase (paso 2). |
| El microfono no graba | Los navegadores solo lo permiten en `localhost` o con HTTPS. En `localhost` funciona. |
| Las notas de voz fallan | Falta `ffmpeg` en la maquina. |
| El numero se desconecta solo | Alguien lo desvinculo desde el telefono, o WhatsApp cerro la sesion. Volve a **Conectar** y escanea de nuevo. |

Si `npm install` o el arranque tiran un error de compilacion, copialo tal cual y
pasalo por el chat: el codigo todavia no se pudo compilar en un entorno con acceso
a npm, asi que puede quedar algun detalle por ajustar.

---

## Despues, para dejarlo funcionando de verdad

- La **web** va a Vercel sin configuracion especial (importar el repo y cargar las variables).
- El **gateway** necesita un servidor que quede prendido, porque mantiene los sockets
  abiertos: Railway, Fly.io, Render o una VM. Hay un `Dockerfile` listo en
  `apps/gateway/`, que ya incluye ffmpeg.
- En ese momento conviene volver a prender la confirmacion por correo en Supabase.
