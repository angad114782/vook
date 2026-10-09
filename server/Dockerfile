# syntax=docker/dockerfile:1
FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
RUN useradd --system --uid 10001 vook && mkdir -p /app/uploads && chown vook /app/uploads
COPY --from=build --chown=vook /app/node_modules ./node_modules
COPY --from=build --chown=vook /app/dist ./dist
COPY --chown=vook package.json ./
USER vook
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
