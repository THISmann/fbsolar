#!/bin/sh
set -eu

if [ -f prisma/schema.prisma ]; then
  pnpm exec prisma db push --skip-generate
fi

exec node dist/main.js
