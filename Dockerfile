# Build do frontend
FROM node:22-slim AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# Imagem final: backend + build estático do frontend
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/ ./
COPY --from=web /app/web/dist /app/web/dist

# Banco SQLite: monte um volume em /data e o servidor usa automaticamente
ENV DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 4000
CMD ["node", "src/index.js"]
