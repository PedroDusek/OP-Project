/**
 * Os líderes de evento selado (decisão 115).
 *
 * Camada: domain. Puro, sem I/O.
 *
 * A Bandai imprime, para pré-lançamento e evento selado, um líder Luffy com
 * **as seis cores**. Ele existe para quem abre pacotes na hora poder montar
 * deck com o que saiu, sem a trava de cor — e é por isso que o dono do produto
 * o quis aqui.
 *
 * ## Por que ele não entrou pelo caminho normal
 *
 * O nosso catálogo vem da lista de cartas da Bandai, e ela **não o publica**:
 * conferido no snapshot em 25/11, "Leader Pack" não aparece em lugar nenhum. A
 * lista oficial é organizada por número de carta, e este líder não tem número.
 *
 * Quem o publica é o TCGplayer — a nossa fonte de **preço** —, e lá ele vem sem
 * o campo `Number`, como os DON!!.
 *
 * ## O código é nosso, e é para sempre
 *
 * Mesmo raciocínio da decisão 112, e pelo mesmo motivo: toda carta do ColeXa é
 * identificada por `code`, e é por ele que se amarram variantes, alocações,
 * want list e decklists. Sem número na origem, o `productId` do TCGplayer é o
 * que resta — numérico, único no catálogo inteiro, estável, e já é a chave que
 * o nosso preço usa.
 *
 * **Este código vai parar na coleção das pessoas.** Trocá-lo depois exige
 * migração de dados, então ele é derivado de um id estável e não de nome,
 * posição ou ano do evento.
 *
 * ## O prefixo não é enfeite
 *
 * `SB-` vem de *Sealed Battle*, que é como a fonte nomeia a linha. Ele faz duas
 * coisas:
 *
 * 1. **Não se passa por código da Bandai.** `P-712746` pareceria um promo
 *    oficial e esconderia que o número é invenção nossa.
 * 2. **Mantém o link da Liga honesto.** `ligaEdition` só reconhece
 *    `LETRAS+DÍGITOS-`, então `SB-712746` não produz edição — e o "Ver na Liga"
 *    cai na busca **por nome**, como o DON!! já faz, em vez de montar um
 *    endereço direto para uma carta que a Liga não tem.
 *
 * ## Quais entram é escolha do dono do produto
 *
 * A fonte traz **quatro** líderes de seis cores: os dois de 2023 (vida 4), o
 * Sealed Battle 2024 Vol. 2 e o do 4º aniversário (vida 5). Em 25/11 o dono do
 * produto escolheu **só o do 4º aniversário** — é o mais recente, e é o que se
 * usa em pré-lançamento hoje. Os outros três são iguais o bastante para virarem
 * quatro Luffys indistinguíveis na busca de líder.
 *
 * Uma lista, e não uma regra que pesque "todo líder de seis cores": a escolha é
 * de produto, e uma regra traria sozinha o próximo que a fonte publicasse.
 */

import { PROMO_SET } from './types'

const PREFIX = 'SB-'

/**
 * Os produtos escolhidos, por `productId` do TCGplayer.
 *
 * Acrescentar um é uma linha — e é decisão do dono do produto, não nossa.
 */
export const SEALED_LEADER_PRODUCT_IDS: readonly number[] = [
  // Monkey.D.Luffy (4th Anniversary Leader Card) — vida 5, poder 5000.
  712746,
]

/** Onde eles moram: o set de promoções, que já existe (decisão 024). */
export const SEALED_LEADER_SET_CODE = PROMO_SET.code

/** `712746` → `SB-712746`. Cabe nos 20 caracteres de `cards.code`. */
export function sealedLeaderCardCode(productId: number | string): string {
  return `${PREFIX}${String(productId).trim()}`
}

/** Se um código é de líder selado, sem precisar ler nada no banco. */
export function isSealedLeaderCode(code: string): boolean {
  return code.trim().toUpperCase().startsWith(PREFIX)
}

/**
 * As seis cores do jogo.
 *
 * Existe para reconhecer "todas" sem contar linhas no banco. O jogo tem seis
 * desde o lançamento, e uma sétima seria notícia — não um dado que aparece
 * sozinho numa importação.
 */
export const TODAS_AS_CORES: readonly string[] = [
  'Red',
  'Green',
  'Blue',
  'Purple',
  'Black',
  'Yellow',
]

/**
 * Como escrever as cores de um líder.
 *
 * `Vermelho e Verde` cabe; as seis não. `leader.colors.join(' e ')` produziria
 * "Blue e Green e Purple e Red e Black e Yellow", que ocupa duas linhas no
 * celular e não diz nada que "todas as cores" não diga melhor.
 */
export function rotuloDeCores(colors: readonly string[]): string {
  const distintas = new Set(colors.map((cor) => cor.trim()))
  const todas = TODAS_AS_CORES.every((cor) => distintas.has(cor))

  return todas ? 'todas as cores' : [...colors].join(' e ')
}
