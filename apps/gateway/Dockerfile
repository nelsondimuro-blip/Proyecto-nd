# El gateway mantiene sockets abiertos: necesita un host de larga duracion
# (Railway, Fly.io, Render, una VM). No funciona en entornos serverless.
FROM node:20-slim

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
