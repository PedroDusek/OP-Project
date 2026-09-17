import { ValidationError } from '@/server/domain/errors'

/**
 * Excluir a conta (decisões 015 e 091).
 *
 * Camada: domain. Puro: prazo, confirmação e o que a conta vira.
 *
 * ## Duas etapas
 *
 * 1. **O pedido.** A conta fica suspensa: não entra, não aparece na rede, e as
 *    trocas em andamento são canceladas na hora, porque a outra pessoa não pode
 *    esperar trinta dias por uma troca que talvez não aconteça.
 * 2. **A anonimização**, trinta dias depois, pela tarefa diária. Entrar de novo
 *    antes disso cancela o pedido — definido pelo dono do produto.
 */

/** Os dias para desistir, definidos pelo dono do produto. */
export const ACCOUNT_DELETION_GRACE_DAYS = 30

/** O que a pessoa digita para confirmar. Uma palavra, e não a senha: quem entra com Google não tem senha. */
export const ACCOUNT_DELETION_CONFIRMATION = 'EXCLUIR'

/** Como a conta aparece para quem conversou ou trocou com ela, depois de anonimizada. */
export const ANONYMIZED_NAME = 'Conta excluída'

const DAY_MS = 24 * 60 * 60 * 1000

/** Quando a conta pedida em `requestedAt` passa a ser anonimizada. */
export function deletionDueAt(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS)
}

/** A linha de corte da tarefa diária: quem pediu até aqui já venceu. */
export function deletionCutoff(now: Date): Date {
  return new Date(now.getTime() - ACCOUNT_DELETION_GRACE_DAYS * DAY_MS)
}

/**
 * Confere a palavra de confirmação.
 *
 * Sem distinguir maiúsculas nem espaços nas pontas: quem digitou "excluir" deixou
 * claro o que quer, e recusar por caixa seria atrito sem proteção nenhuma.
 */
export function assertDeletionConfirmed(typed: string | null | undefined): void {
  if ((typed ?? '').trim().toUpperCase() !== ACCOUNT_DELETION_CONFIRMATION) {
    throw new ValidationError(`Digite ${ACCOUNT_DELETION_CONFIRMATION} para confirmar.`, {
      confirmacao: [`Digite ${ACCOUNT_DELETION_CONFIRMATION} para confirmar.`],
    })
  }
}

/**
 * O e-mail que ocupa o lugar do real: não reversível, sem colisão no índice
 * único, e num domínio que não recebe e-mail (`.invalid`, RFC 2606).
 */
export function anonymizedEmail(userId: bigint): string {
  return `deleted+${userId}@deleted.invalid`
}
