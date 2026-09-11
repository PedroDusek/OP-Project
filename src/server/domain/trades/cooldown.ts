/**
 * A espera entre a última alteração e poder confirmar.
 *
 * Camada: domain. Puro, síncrono, sem I/O.
 *
 * ## Por que existir
 *
 * É a trava clássica das trocas de jogo. Sem ela, quem está do outro lado pode
 * mudar a oferta no instante exato em que você toca em confirmar — e você
 * confirma uma troca diferente da que leu. O golpe não depende de defeito
 * nenhum: depende só de os dois gestos caberem no mesmo instante.
 *
 * Cinco segundos não impedem alguém mal-intencionado de tentar. Impedem que a
 * tentativa funcione **sem que a pessoa veja**, que é o que importa: a alteração
 * aparece, o botão trava, e quem ia confirmar tem tempo de reler.
 *
 * ## Conta de qualquer um dos dois
 *
 * A alteração de quem quer que seja trava o botão dos **dois**. É o ponto todo:
 * a espera existe para dar tempo de ver o que o outro mexeu, e só funciona se a
 * mudança dele alcançar o seu botão.
 *
 * Travar a própria também é deliberado. A alternativa — "você sabe o que fez" —
 * abre a brecha de mexer na oferta e confirmar no mesmo instante, contando com o
 * atraso do outro para ele não ver.
 *
 * ## Quem aplica é o servidor
 *
 * O botão desabilitado é aparência. Quem recusa é o caso de uso, contra este
 * cálculo — sem isso a trava não existe, porque a ação pode ser chamada direto.
 */

/** Cinco segundos. O suficiente para ler o que mudou, e pouco para atrapalhar. */
export const CONFIRMATION_COOLDOWN_MS = 5_000

/**
 * A troca pode ser confirmada agora?
 *
 * `null` em `offerChangedAt` significa que ninguém mexeu na oferta ainda, e aí
 * não há o que esperar — travar uma troca em que nada aconteceu seria espera sem
 * assunto.
 */
export function canConfirmNow(offerChangedAt: Date | null, now: Date = new Date()): boolean {
  return millisUntilConfirm(offerChangedAt, now) === 0
}

/**
 * Quantos milissegundos ainda faltam. Zero quando já dá para confirmar.
 *
 * Nunca negativo: a tela usa este número para contar, e um negativo viraria um
 * "-3" na cara de quem está esperando.
 *
 * Um relógio adiantado do lado do cliente também não quebra nada — a tela pode
 * liberar o botão cedo, e o servidor recusa com a mesma conta. A aparência erra
 * por segundos; a regra, não.
 */
export function millisUntilConfirm(
  offerChangedAt: Date | null,
  now: Date = new Date(),
): number {
  if (!offerChangedAt) return 0

  const passados = now.getTime() - offerChangedAt.getTime()

  // Data no futuro (relogio destoando entre maquinas) trava o tempo inteiro, e
  // nao para sempre: o piso e a propria espera.
  if (passados < 0) return CONFIRMATION_COOLDOWN_MS

  return Math.max(0, CONFIRMATION_COOLDOWN_MS - passados)
}

/** Quantos segundos faltam, arredondados para cima. É o que a tela mostra. */
export function secondsUntilConfirm(
  offerChangedAt: Date | null,
  now: Date = new Date(),
): number {
  return Math.ceil(millisUntilConfirm(offerChangedAt, now) / 1000)
}
