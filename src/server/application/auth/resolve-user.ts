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
  if (existing) return existing.deletedAt ? null : toAuthenticated(existing)

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
    if (!criada) throw error
    return criada.deletedAt ? null : toAuthenticated(criada)
  }
}

function findUser(prisma: PrismaClient, authUserId: string) {
  return prisma.user.findUnique({
    where: { authUserId },
    select: { id: true, email: true, name: true, plan: true, premiumUntil: true, deletedAt: true },
  })
}

/** Conta anonimizada nao autentica, mesmo com sessao valida no provedor: quem chama devolve `null`. */
function toAuthenticated(user: AuthenticatedUser & { deletedAt: Date | null }): AuthenticatedUser {
  return { id: user.id, email: user.email, name: user.name, plan: user.plan, premiumUntil: user.premiumUntil }
}
