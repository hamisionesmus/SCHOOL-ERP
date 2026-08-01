FROM node:20-alpine

# Prisma's query engine needs OpenSSL on Alpine.
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN npm run prisma:generate
RUN npm run build

EXPOSE 4000

# Applies any pending platform + tenant-schema migrations (idempotent, safe on every restart —
# see prisma/migrate-all-tenants.ts) before starting the server, so a redeploy is a single command.
ENTRYPOINT ["sh", "docker-entrypoint.sh"]
