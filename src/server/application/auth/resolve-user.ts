import { Prisma, type PrismaClient } from '@prisma/client'
import type { ProviderIdentity } from '@/server/http/session-provider'

/**
 * Traduz a identidade do provedor externo no usuario da aplicacao.
 *
 * Camada: application. Fica aqui, e nao em `http/`, porque criar a conta e a
 * colecao e regra de negocio: a especificacao diz que todo usuario tem
 * exatamente uma colecao e que ela nasce vazia.
 */

export interface AuthenticatedUser {
  /** Chave primaria interna. E este id que as demais tabelas referenciam. */
  id: bigint
  email: string
  name: string
  plan: string
  /** Ate quando o acesso Premium vale. Nulo significa sem prazo. */
  premiumUntil: Date | null
}

/**
 * A conta de quem esta na sessao, criada no primeiro acesso.
 *
 * ## O primeiro acesso chega em paralelo
 *
 * Relatado pelo dono do produto: toda conta nova via uma tela de erro no primeiro
 * login, e recarregar resolvia. Logo depois de entrar, a pagina e as rotas que
 * ela chama (o sino, `/api/me/notificacoes`) resolvem a mesma sessao ao mesmo
 * tempo, e todas acham que a conta nao existe. A primeira cria; as outras batem
 * no indice unico de `auth_user_id` (P2002). O banco guardava o rastro: um id
 * pulado a cada conta nova, a sequencia gasta pela insercao que falhou.
 *
 * Quem perde a corrida le a conta que a outra criou. Se ainda assim nao houver
 * conta com esse `auth_user_id`, o conflito era de outra coisa (o e-mail ja
 * pertence a outra identidade), e o erro sobe como antes.
 */
export async function resolveUser(
  prisma: PrismaClient,
  identity: ProviderIdentity,
): Promise<AuthenticatedUser | null> {
  const existing = await findUser(prisma, identity.authUserId)
  if (existing) return unavailable(existing) ? null : toAuthenticated(existing)

  try {
    return await prisma.user.create({
      data: {
        authUserId: identity.authUserId,
        // Normalizado em minusculas: a unicidade de e-mail e por indice simples,
        // e enderecos que diferem so na caixa sao a mesma conta.
        email: identity.email.trim().toLowerCase(),
        name: identity.name?.trim() || identity.email.split('@')[0],
        collection: { create: { name: 'Minha Colecao' } },
      },
      select: { id: true, email: true, name: true, plan: true, premiumUntil: true },
    })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
    const criada = await findUser(prisma, identity.authUserId)
    if (criada) return unavailable(criada) ? null : toAuthenticated(criada)

    /*
     * O conflito foi o e-mail: ele já é de outra conta, criada por outra forma
     * de entrar. O login já recusa isso com a mensagem da decisão 097; se uma
     * sessão assim chegar até aqui mesmo assim (um cookie de antes da regra), a
     * página trata como quem não entrou, em vez de cair numa tela de erro.
     */
    console.warn('[auth] e-mail ja pertence a outra conta', { authUserId: identity.authUserId })
    return null
  }
}

function findUser(prisma: PrismaClient, authUserId: string) {
  return prisma.user.findUnique({
    where: { authUserId },
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      premiumUntil: true,
      deletedAt: true,
      deletionRequestedAt: true,
    },
  })
}

/**
 * Conta que nao autentica, mesmo com sessao valida no provedor: anonimizada, ou
 * com pedido de exclusao pendente (decisao 091). A suspensa volta entrando de
 * novo — o login cancela o pedido antes de chegar aqui.
 */
function unavailable(user: { deletedAt: Date | null; deletionRequestedAt: Date | null }): boolean {
  return user.deletedAt !== null || user.deletionRequestedAt !== null
}

function toAuthenticated(user: AuthenticatedUser): AuthenticatedUser {
  return { id: user.id, email: user.email, name: user.name, plan: user.plan, premiumUntil: user.premiumUntil }
}
