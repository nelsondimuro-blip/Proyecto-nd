# Probar la app

Dos caminos. El primero no requiere instalar nada en tu computadora.
Los dos necesitan una base de datos gratis en Supabase (parte 1).

> **Usa un numero de prueba para el primer intento**, no el WhatsApp principal del
> negocio. La vinculacion por QR usa una libreria no oficial (Baileys) que incumple
> los Terminos de Servicio de Meta, y un numero puede terminar bloqueado.

---

## Parte 1 — La base de datos (igual para los dos caminos)

1. Entra a [supabase.com](https://supabase.com), crea una cuenta y luego **New project**.
   Elegi un nombre, una contrasenia para la base y la region mas cercana.
2. Cuando termine de crearse, abri **SQL Editor** y pega **todo** el contenido de
   [`supabase/schema.sql`](../supabase/schema.sql). Es un solo archivo con el esquema
   completo. Dale **Run**.
3. En **Authentication › Sign In / Providers › Email**, apaga **Confirm email**. Si no,
   Supabase te va a pedir confirmar la casilla antes de dejarte entrar. En produccion
   conviene volver a prenderlo.
4. Anda a **Project Settings › API** y deja a mano estos tres datos:
   - **Project URL**
   - **anon public** (clave publica)
   - **service_role** (clave secreta)

---

## Camino A — En el navegador, sin instalar nada (el mas facil)

GitHub Codespaces te da una computadora en la nube con todo puesto. Las cuentas
personales tienen 60 horas gratis por mes.

1. Entra al repositorio en GitHub y cambia a la rama
   `claude/whatsapp-group-connector-app-7ad2gf`.
2. Boton verde **Code › Codespaces › Create codespace on…**.
3. Espera unos minutos: solo instala Node, ffmpeg y las dependencias.
4. En la terminal que aparece abajo:

   ```bash
   npm run setup   # pega los tres datos de Supabase
   npm run dev
   ```

5. Va a saltar un aviso de que el puerto 3000 se abrio: **Open in Browser**.

La URL de Codespaces es HTTPS, asi que el microfono para las notas de voz funciona.
Al terminar, frena el codespace desde GitHub para no gastar horas.

---

## Camino B — En tu computadora

Necesitas **Node 20 o mayor** (`node -v`) y **Git** (`git -v`). Si no los tenes:
[nodejs.org](https://nodejs.org) (version LTS) y [git-scm.com](https://git-scm.com).

Para las notas de voz hace falta **ffmpeg** (`brew install ffmpeg` en Mac,
`sudo apt install ffmpeg` en Linux). Sin ffmpeg anda todo lo demas.

```bash
git clone https://github.com/nelsondimuro-blip/Proyecto-nd.git
cd Proyecto-nd
git checkout claude/whatsapp-group-connector-app-7ad2gf
npm install
npm run setup   # pega los tres datos de Supabase
npm run dev
```

`npm run setup` escribe el archivo `.env` por vos y genera solo el secreto interno.
`npm run dev` levanta las dos piezas juntas —la web y el gateway— con la salida
etiquetada, asi no tenes que abrir dos terminales.

El panel queda en **http://localhost:3000**.

---

## Primer uso

1. Abri el panel y **Registrarme** con tu correo y una contrasenia.
2. Poné el nombre del grupo de negocios: eso crea tu espacio de trabajo.
3. Vas a caer en **Numeros**. Toca **Agregar**, escribi un nombre para la linea
   (por ejemplo "Ventas") y despues **Conectar**.
4. Aparece el QR. En el telefono: **WhatsApp › Ajustes › Dispositivos vinculados ›
   Vincular un dispositivo**, y escanealo.
5. El estado pasa a **Conectado** solo, sin recargar la pagina.

### Probar que anda

- Desde **otro** telefono, mandale un mensaje al numero que vinculaste: tiene que
  aparecer en **Bandeja** en un par de segundos.
- Respondé desde el panel y fijate que llegue al telefono, con sus tildes.
- Mandá una foto con el clip y grabá una nota de voz con el microfono.
- Creá una respuesta en **Respuestas rapidas** y despues escribí `/` en el chat.
- Etiquetá la conversacion con **+ Etiqueta** y filtra la bandeja por esa etiqueta.

---

## Si algo no sale

| Sintoma | Que pasa |
| --- | --- |
| `Falta el archivo .env` | Corre `npm run setup` antes de `npm run dev`. |
| `Configuracion invalida del gateway` | Algun dato del `.env` quedo mal. El mensaje dice cual. |
| El QR no aparece | Mira la salida `[gateway]`: si dice `no autorizado`, volve a correr `npm run setup`. |
| Entro y me manda de vuelta al login | Quedo prendida la confirmacion por correo en Supabase (parte 1, paso 3). |
| El microfono no graba | Los navegadores solo lo permiten en `localhost` o con HTTPS. Codespaces ya es HTTPS. |
| Las notas de voz fallan | Falta `ffmpeg` en la maquina (en Codespaces ya viene). |
| El numero se desconecta solo | Alguien lo desvinculo desde el telefono, o WhatsApp cerro la sesion. Volve a **Conectar**. |

Si `npm install` o el arranque tiran un error de compilacion, copialo tal cual y
pasalo por el chat: el codigo todavia no se pudo compilar en un entorno con acceso
a npm, asi que puede quedar algun detalle por ajustar.

---

## Despues, para dejarlo funcionando de verdad

- La **web** va a Vercel sin configuracion especial (importar el repo y cargar las
  variables del `.env`).
- El **gateway** necesita un servidor que quede prendido, porque mantiene los sockets
  abiertos: Railway, Fly.io, Render o una VM. Hay un `Dockerfile` listo en
  `apps/gateway/`, que ya incluye ffmpeg.
- En ese momento conviene volver a prender la confirmacion por correo en Supabase, y
  aplicar los cambios de esquema con las migraciones (`supabase db push`) en vez de
  `schema.sql`.
