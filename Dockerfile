FROM node:20-alpine

# better-sqlite3 needs build tools for native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies first (cache layer)
COPY server/package.json server/package-lock.json ./
RUN npm ci --production

# Copy server source
COPY server/server.js ./
COPY server/src/ ./src/

# Copy Angular showcase build output as static files
COPY showcase/dist/showcase-angular/browser/ ./public/

# Create data directory for SQLite persistent volume
RUN mkdir -p /data

ENV PORT=3847
ENV DB_PATH=/data/fsb-data.db
ENV NODE_ENV=production

EXPOSE 3847

CMD ["node", "server.js"]
