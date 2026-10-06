# Single-image deployment: the API serves the built React app from the same origin.
# Node 24 ships npm 11, the version the lockfiles were created with (npm 10 rejects them).
FROM node:24-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --no-audit --no-fund || (echo 'npm ci failed, retrying with npm install' && npm install --no-audit --no-fund)
COPY client/ ./
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
COPY server/ ./
COPY --from=client /app/client/dist /app/client/dist
RUN mkdir -p uploads && chown -R node:node /app/server/uploads
USER node
EXPOSE 5050
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:${PORT:-5050}/api/health || exit 1
CMD ["node", "server.js"]
