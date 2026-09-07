# El gateway mantiene sockets abiertos: necesita un host de larga duracion
# (Railway, Fly.io, Render, una VM). No funciona en entornos serverless.
FROM node:20-slim

# ffmpeg convierte las notas de voz a ogg/opus, el formato que WhatsApp
# exige para un PTT. Sin el, el resto de la app funciona igual.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Primero los manifiestos, para aprovechar la cache de capas.
COPY package.json ./
COPY apps/gateway/package.json ./apps/gateway/package.json
RUN npm install --workspace apps/gateway

COPY apps/gateway ./apps/gateway
RUN npm run build --workspace apps/gateway && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "apps/gateway/dist/index.js"]
