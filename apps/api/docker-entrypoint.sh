#!/bin/sh
set -e

npx prisma migrate deploy --schema=prisma/platform/schema.prisma
npm run prisma:tenant:migrate:all

exec node dist/main.js
