import type { PrismaClient } from '@prisma/client'
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
}

export async function resolveUser(
  prisma: PrismaClient,
  identity: ProviderIdentity,
): Promise<AuthenticatedUser | null> {
  const existing = await prisma.user.findUnique({
    where: { authUserId: identity.authUserId },
    select: { id: true, email: true, name: true, plan: true, deletedAt: true },
  })

  if (existing) {
    // Conta anonimizada nao autentica, mesmo com sessao valida no provedor.
    if (existing.deletedAt) return null
    return {
      id: existing.id,
      email: existing.email,
      name: existing.name,
      plan: existing.plan,
    }
  }

  return prisma.user.create({
    data: {
      authUserId: identity.authUserId,
      // Normalizado em minusculas: a unicidade de e-mail e por indice simples,
      // e enderecos que diferem so na caixa sao a mesma conta.
      email: identity.email.trim().toLowerCase(),
      name: identity.name?.trim() || identity.email.split('@')[0],
      collection: { create: { name: 'Minha Colecao' } },
    },
    select: { id: true, email: true, name: true, plan: true },
  })
}
