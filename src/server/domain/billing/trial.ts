/**
 * O teste grátis de 7 dias (decisão 102, mudança de 21/09).
 *
 * Camada: domain. Puro: quanto dura e quanto falta.
 *
 * ## Por que não há coluna nova
 *
 * `users.trial_started_at` existe desde a decisão 041 e nunca foi usada — foi
 * criada para este dia. O carimbo nela é a **única** trava: nulo quer dizer
 * "ainda não resgatou", e preenchido quer dizer "já foi, e não volta". O acesso
 * em si continua saindo de `premium_until`, como qualquer outro Premium, para
 * nenhuma trava do produto precisar saber que trial existe.
 *
 * ## O que esta trava não alcança
 *
 * Ela é por **conta**, não por pessoa. Quem criar outra conta com outro e-mail
 * ganha outros sete dias, e não há como impedir sem cartão ou documento — que o
 * dono do produto recusou de propósito, porque pedir cartão para um teste
 * grátis é o atrito que o teste existe para evitar. A exclusão de conta também
 * limpa o carimbo, e isso **não é descuido**: a anonimização troca o e-mail por
 * um sintético irreversível (`deleted+id@deleted.invalid`), então guardar o
 * carimbo não ligaria um cadastro novo à conta antiga de jeito nenhum. Decidido
 * em 21/09, com a brecha aceita por escrito.
 */

export const TRIAL_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Até quando vale o teste resgatado em `from`.
 *
 * Sete dias corridos, e não sete dias de calendário: o teste é curto, e contar
 * em milissegundos evita que um resgate às 23h59 do dia da mudança de horário
 * valha um dia a mais ou a menos que o de outra pessoa.
 */
export function trialEnd(from: Date): Date {
  return new Date(from.getTime() + TRIAL_DAYS * DAY_MS)
}

/**
 * Quantos dias faltam, arredondando para cima.
 *
 * Para cima porque é assim que se conta o que ainda se tem: faltando 30 horas,
 * a pessoa tem "2 dias", e não "1". Acabado, é zero — nunca negativo.
 */
export function trialDaysLeft(endsAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS))
}
