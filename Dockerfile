# Imagen única: compila el front y sirve todo desde el servidor de Node
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY web/package*.json web/
COPY server/package*.json server/
RUN npm ci --omit=dev --prefix server && npm ci --prefix web

COPY . .
RUN npm --prefix web run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/server ./server
COPY --from=build /app/web/dist ./web/dist
COPY --from=build /app/package.json ./

# La base de datos vive en un volumen para que sobreviva a los despliegues
VOLUME ["/app/server/data"]
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=4s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

USER node
CMD ["node", "server/src/index.js"]
