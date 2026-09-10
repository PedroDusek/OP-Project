# ColeXa

App mobile-first de coleção do One Piece Card Game. Português em tudo: código,
comentários, commits, rotas e conversa.

## Leia isto primeiro, sempre

1. **`docs/handoff.md`** — o estado atual: o que existe, o que está pendente, o
   que espera resposta do dono do produto, e a lista de armadilhas já pagas.
   Comece por ele em toda sessão nova.
2. **`docs/decisions.md`** — as decisões numeradas, com o porquê de cada uma.
   Consulte antes de mudar qualquer coisa que já foi decidida.
3. **`docs/business-rules.md`** — as regras de negócio. Elas vencem a
   especificação visual quando divergirem.

Os outros: `architecture.md`, `database.md`, `integrations.md`,
`development.md`.

## O acordo de trabalho

Estas regras são do dono do produto e valem sobre qualquer instinto contrário:

- **Não invente regra de negócio.** Se a especificação não diz, pergunte.
- **Não altere decisão registrada** sem aprovação. Mudar é permitido; mudar em
  silêncio, não. Registre como mudança, não como acréscimo.
- **Não mude o modelo de dados sem aprovação.** Tabela ou coluna nova é
  conversa, não detalhe.
- **Na dúvida relevante, PARE.** Explique a dúvida, as opções e o impacto, e
  espere. Decisão puramente técnica você toma sozinho.
- **Uma branch e um PR por checkpoint.** Você abre, acompanha a CI e faz o merge
  quando estiver completo. **Pare antes de iniciar o próximo e espere
  autorização** (decisão 016).
- **Nunca peça para o dono colar segredo na conversa.**
- **Verifique em vez de supor.** Rode testes, lint, typecheck e build antes de
  dizer que terminou. Meça antes de afirmar número.

## Produção nunca é o alvo padrão

`DATABASE_URL` é sempre o banco local. Produção só é alcançada por
`npm run supabase <migrate|import|prices|status|storage>`, que imprime o destino
antes de agir. Não existe comando de reset para produção, de propósito.

**Rode `npm run supabase status` antes de qualquer publicação.** Ele compara as
migrations com o repositório. Produção já ficou atrás sem ninguém notar, e o
custo é a tela inteira, não só a parte nova.

## As duas armadilhas que mais custaram tempo

A lista inteira está em `docs/handoff.md`. Estas duas reapareceram:

- **Migration nova exige reiniciar o `next dev`.** O servidor guarda o cliente
  Prisma que carregou ao subir. O sintoma é `Cannot read properties of undefined
  (reading 'findFirst')` numa tabela que existe no banco e no schema — e os
  testes e o `build` passam, porque cada um gera o cliente antes de rodar.
- **Cabeçalho CORS só aparece quando a requisição manda `Origin`.** Conferir com
  `curl -I` sem ele diz "não tem CORS" sobre servidores que têm.

## Comandos

```
npm run dev          npm test           npm run test:e2e
npm run lint         npm run typecheck  npm run build
npm run db:migrate   npm run db:seed    npm run catalog:import
npm run prices:import
npm run supabase <migrate|import|prices|status|storage>
```

## Como o código está organizado

Camadas impostas por lint, e a fronteira é levada a sério:

- `domain` — puro, sem I/O. Regra e aritmética.
- `application` — casos de uso. A única camada que fala com `infrastructure`.
- `infrastructure` — Prisma, provedores externos.
- `http` — portas (contratos) e fronteira de sessão.
- `app` e `components` — **nunca** importam `infrastructure` nem
  `@prisma/client`.

Server Actions são finas: leem a sessão, chamam **um** caso de uso, traduzem o
resultado. O `user_id` vem da sessão e nunca do formulário.

## Como escrever aqui

Os comentários explicam **por que**, não o quê — e costumam registrar o que foi
tentado e não serviu, para ninguém tentar de novo. Siga a densidade e o tom do
arquivo em que estiver mexendo.

Teste que fica obsoleto por mudança de regra é **atualizado com honestidade**,
dizendo que a regra mudou — nunca afrouxado para passar.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
