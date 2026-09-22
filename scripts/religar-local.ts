import 'dotenv/config'
import { createPrisma } from '@/server/infrastructure/prisma'

/**
 * Religa as contas do banco **local** as identidades que o Supabase tem hoje.
 *
 *   npm run religar-local                      religa todas as que der
 *   npm run religar-local -- <email>           religa so uma
 *
 * ## Por que isto existe (armadilha 85)
 *
 * No `next dev`, os dados sao locais e o **login e o de producao**:
 * `DATABASE_URL` aponta para o Postgres da maquina, e
 * `NEXT_PUBLIC_SUPABASE_URL` para o projeto hospedado. As duas metades da conta
 * moram em lugares diferentes.
 *
 * Entao apagar contas em producao — `npm run supabase -- limpar-contas
 * --confirmar` — apaga tambem os usuarios do Supabase Auth, e os
 * `auth_user_id` guardados no banco local viram orfaos. Entrar de novo cria uma
 * identidade nova, com id novo, que nao bate com a linha antiga: a trava da
 * decisao 097 recusa o login com "este e-mail ja tem uma conta no ColeXa".
 *
 * Parece defeito do login, e nao e. Este script conserta **sem apagar nada**:
 * ele so troca o `auth_user_id` da linha local pelo id que o Supabase tem
 * agora, preservando colecao, want list, binders e plano.
 *
 * ## So local, e por construcao
 *
 * Ele recusa rodar se `DATABASE_URL` nao for da propria maquina — o espelho da
 * trava que `scripts/supabase.ts` tem ao contrario. Do Supabase, so le.
 */

function bancoLocal(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL nao esta definida.')

  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error('DATABASE_URL nao e uma URL valida.')
  }

  // O contrario da trava de `supabase.ts`: la producao nunca pode ser local,
  // aqui o alvo nunca pode ser producao. Este script escreve, e escrever na
  // conta de outra pessoa por engano seria o pior resultado possivel.
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
    throw new Error(`DATABASE_URL aponta para ${host}. Este script so mexe no banco da propria maquina.`)
  }
  return url
}

interface Identidade {
  id: string
  email?: string
}

async function identidadesDoSupabase(): Promise<Identidade[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SECRET_KEY
  if (!url || !chave) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar no .env.')
  }

  const resposta = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: chave, Authorization: `Bearer ${chave}` },
  })
  if (!resposta.ok) throw new Error(`Supabase respondeu ${resposta.status} ao listar identidades.`)

  const corpo = (await resposta.json()) as { users?: Identidade[] }
  return corpo.users ?? []
}

async function main(): Promise<void> {
  const url = bancoLocal()
  const alvo = process.argv[2]?.trim().toLowerCase()

  const identidades = await identidadesDoSupabase()
  const porEmail = new Map(
    identidades.filter((i) => i.email).map((i) => [i.email!.toLowerCase(), i.id]),
  )

  const prisma = createPrisma(url, { max: 2 })
  try {
    const contas = await prisma.user.findMany({
      where: { deletedAt: null, ...(alvo ? { email: alvo } : {}) },
      orderBy: { id: 'asc' },
      select: { id: true, email: true, authUserId: true },
    })

    if (contas.length === 0) {
      console.log(alvo ? `[local] nenhuma conta com ${alvo}.` : '[local] nenhuma conta no banco local.')
      return
    }

    let religadas = 0
    for (const conta of contas) {
      const identidade = porEmail.get(conta.email.toLowerCase())

      if (!identidade) {
        console.log(`[local] ${conta.email}: sem identidade no Supabase. Entre uma vez e rode de novo.`)
        continue
      }
      if (identidade === conta.authUserId) {
        console.log(`[local] ${conta.email}: ja esta certa.`)
        continue
      }

      await prisma.user.update({ where: { id: conta.id }, data: { authUserId: identidade } })
      console.log(`[local] ${conta.email}: ${conta.authUserId ?? 'nenhum'} -> ${identidade}`)
      religadas++
    }

    console.log(`[local] ${religadas} conta(s) religada(s). Nada foi apagado.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro)
  process.exit(1)
})
