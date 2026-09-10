import { Prisma, type PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { ConflictError, ValidationError } from '@/server/domain/errors'
import {
  canChangeUsername,
  normalizeUsername,
  USERNAME_PROBLEM_MESSAGE,
  usernameChangeAllowedAt,
  validateUsername,
} from '@/server/domain/social/username'

/**
 * Escolher e trocar o nome de usuário.
 *
 * Camada: application.
 *
 * ## A unicidade é do banco, não daqui
 *
 * Consultar antes e gravar depois deixa uma janela: duas pessoas pedindo o
 * mesmo nome ao mesmo tempo passam as duas pela consulta e só uma deveria
 * gravar. O índice único resolve isso, e o erro dele vira a mensagem — que é
 * mais trabalho de escrever e é o único jeito de a resposta ser sempre
 * verdadeira.
 *
 * ## Escolher não é trocar
 *
 * A primeira vez não gasta a cota semanal. Cobrar uma semana de espera de quem
 * acabou de chegar — e talvez errou uma letra — seria punir o começo.
 */

export interface SetUsernameResult {
  username: string
  /** Quando poderá trocar de novo, ou `null` se ainda não gastou a cota. */
  nextChangeAt: Date | null
}

export async function setUsername(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  raw: string,
  now: Date = new Date(),
): Promise<SetUsernameResult> {
  const problema = validateUsername(raw)
  if (problema) {
    throw new ValidationError(USERNAME_PROBLEM_MESSAGE[problema], {
      username: [USERNAME_PROBLEM_MESSAGE[problema]],
    })
  }

  const username = normalizeUsername(raw)

  const atual = await prisma.user.findUnique({
    where: { id: user.id },
    select: { username: true, usernameChangedAt: true },
  })

  // Pedir o nome que já se tem não é troca, e não gasta a cota. É o que
  // acontece quando alguém salva o formulário sem ter mexido nele.
  if (atual?.username === username) {
    return { username, nextChangeAt: usernameChangeAllowedAt(atual.usernameChangedAt) }
  }

  const primeiraEscolha = atual?.username == null

  if (!primeiraEscolha && !canChangeUsername(atual.usernameChangedAt, now)) {
    const quando = usernameChangeAllowedAt(atual.usernameChangedAt)
    throw new ConflictError(
      'TROCA_CEDO_DEMAIS',
      'O nome pode ser trocado uma vez por semana.',
      { nextChangeAt: quando?.toISOString() },
    )
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        username,
        // A primeira escolha não marca a data: ela não gastou nada.
        ...(primeiraEscolha ? {} : { usernameChangedAt: now }),
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError('NOME_EM_USO', 'Este nome já está em uso. Escolha outro.')
    }
    throw error
  }

  return {
    username,
    nextChangeAt: primeiraEscolha ? null : usernameChangeAllowedAt(now),
  }
}

export interface UsernameState {
  username: string | null
  /** Quando poderá trocar. `null` significa "pode agora". */
  nextChangeAt: Date | null
}

export async function getUsernameState(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<UsernameState> {
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { username: true, usernameChangedAt: true },
  })

  return {
    username: row?.username ?? null,
    nextChangeAt: usernameChangeAllowedAt(row?.usernameChangedAt ?? null),
  }
}
