FROM node:20-alpine

WORKDIR /app

# Install server dependencies
COPY server/package*.json ./
RUN npm ci --production

# Copy server code
COPY server/ .

# Copy showcase as static files
COPY showcase/ ./public/

EXPOSE 3847

CMD ["node", "server.js"]
