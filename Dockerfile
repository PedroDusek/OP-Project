# syntax=docker/dockerfile:1
#
# A imagem do ColeXa na Fly.io (decisao 089).
#
# Tres estagios: dependencias, build e a imagem final, que so leva a saida
# `standalone` do Next — sem codigo-fonte, sem dependencias de desenvolvimento e
# sem nenhum `.env` (o `.dockerignore` os recusa). Segredos chegam em tempo de
# execucao, pelos *secrets* da Fly, e nunca pela imagem.
#
# Node 20, o mesmo da CI e do desenvolvimento. Subir para o 22 e pendencia
# registrada no handoff, e sobe junto nos tres lugares.

FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
# O que vai para o pacote do navegador precisa existir no build: o Next escreve
# o valor no JavaScript. Os tres sao publicos por natureza — a URL e a chave
# publicavel do Supabase, e a chave de site do Turnstile.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
# O `prisma.config.ts` exige DATABASE_URL ao carregar, ate no `generate`, que
# nem conecta. O valor e deliberadamente inutil, como no workflow de precos: o
# build nao deve alcancar banco nenhum.
ENV DATABASE_URL=postgresql://nao-usar:nao-usar@127.0.0.1:5432/nao-usar
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# O usuario `node` ja existe na imagem oficial: o servidor nao roda como root.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
