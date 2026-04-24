# Stage 1: Build phase
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN (npm ci --omit=dev || npm install --omit=dev) && \
  npm cache clean --force && \
  rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Stage 2: Run
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3001
CMD ["node", "src/server.js"]

# Install specific versions to mitigate vulnerabilities
RUN npm install cross-spawn@7.0.5 glob@10.5.0 minimatch@9.0.7 --omit=dev && npm cache clean --force
