import type { PrismaClient } from '@prisma/client'

/**
 * Este e-mail já pertence a outra conta do ColeXa? (decisão 097)
 *
 * Camada: application.
 *
 * O Supabase junta sozinho as formas de entrar de um mesmo e-mail verificado, e
 * nesse caso a identidade é a mesma e não há conflito nenhum. Isto é a rede para
 * quando ele **não** junta — e aí nasceria uma segunda conta de provedor para o
 * mesmo endereço, que o índice único de `users.email` recusaria com uma tela de
 * erro no meio do login.
 *
 * Conta anonimizada não conta: o e-mail dela já é `deleted+<id>@deleted.invalid`.
 */
export async function emailBelongsToAnotherAccount(
  prisma: PrismaClient,
  authUserId: string,
  email: string,
): Promise<boolean> {
  const endereco = email.trim().toLowerCase()
  if (!endereco) return false

  const dona = await prisma.user.findUnique({
    where: { email: endereco },
    select: { authUserId: true, deletedAt: true },
  })
  return dona !== null && dona.deletedAt === null && dona.authUserId !== authUserId
}
