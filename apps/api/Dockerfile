FROM node:20-alpine

# Prisma's query engine needs OpenSSL on Alpine. postgresql16-client provides pg_dump (matching the
# postgres:16-alpine version this connects to) — needed by prisma/backup-database.ts, called both
# from the manual "Run backup now" button and the hourly automated backup, both running inside this
# same container (no docker.sock/Docker CLI access here, so pg_dump must be a real local binary).
RUN apk add --no-cache openssl postgresql16-client

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
