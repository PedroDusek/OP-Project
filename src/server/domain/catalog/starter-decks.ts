/**
 * Quantas cópias de cada carta vêm num starter deck.
 *
 * Camada: domain. Puro: confere e ordena, não lê disco nem banco.
 *
 * ## Por que existe uma tabela
 *
 * O catálogo diz **quais** cartas saem em cada ST — é `variant_printings`. Não
 * diz **quantas de cada**, e isso não é descuido nosso: a Bandai publica, na
 * página do produto, o tamanho e as raridades, e nada mais. Conferido em 25/11
 * na própria fonte, para o ST-38:
 *
 *     Contents: Constructed Deck x 1 (51 cards), DON!! Cards x 10, ...
 *     Rarity:   Leader Card x 1, Super Rare x 2, Common x 14
 *     *Due to the nature of the product, multiples of one card may appear
 *
 * Ela diz que há repetição e nunca diz qual carta repete. Nenhuma fonte legível
 * publica isso: a única que tem responde 403 atrás de proteção anti-bot, e
 * contornar isso não está em questão.
 *
 * Então quem diz é gente, um deck por vez, e o que a pessoa diz mora aqui.
 *
 * ## Por que num arquivo, e não no banco
 *
 * Mesmo motivo da tabela da Liga e da dos DON!! (decisão 112): são centenas de
 * números feitos à mão, e eles precisam sobreviver a um banco recriado e chegar
 * a produção por PR. Não há backup do banco, e perder isto seria perder
 * trabalho que não se refaz sozinho.
 *
 * ## O líder não entra na tabela
 *
 * Ele é **derivado**: uma cópia de cada líder impresso no set. Isso dá 1 nos
 * decks normais e **3** no ST-10 e no ST-13 — que é exatamente o que a caixa
 * traz, conferido na Bandai: "Constructed Deck x1 (51 cards), Alternative
 * Leader Card x2".
 *
 * Guardá-lo na tabela seria pedir à pessoa um número que o catálogo já sabe, e
 * abrir espaço para os dois discordarem.
 */

/** As cartas do deck, sem o líder. É a conta que fecha em 50. */
export const STARTER_DECK_CARDS = 50

/** O teto por carta, a mesma regra do deck construído. */
export const MAX_COPIES_PER_CARD = 4

export interface StarterDeckCopies {
  /** O código da carta, como `ST01-002`. */
  carta: string
  copias: number
}

export interface StarterDeckEntry {
  /** O código do set, como a fonte publicou: `ST-01`, `ST13`. */
  deck: string
  cartas: StarterDeckCopies[]
}

/**
 * Confere a tabela inteira e devolve a versão ordenada.
 *
 * Recusa em vez de consertar, pelo mesmo motivo da tabela dos DON!!: um deck
 * repetido com listas diferentes não tem resposta certa, e escolher uma em
 * silêncio gravaria um número que ninguém conferiu (armadilha 5).
 *
 * **A soma tem de ser exatamente 50.** É o que faz esta tabela valer alguma
 * coisa: um erro de digitação que some 48 ou 52 descreve um produto que não
 * existe, e ele entraria na coleção de quem clicasse em "Adicionar ST". A
 * conferência é o único lugar onde esse erro ainda é barato.
 */
export function validateStarterDecks(entries: readonly StarterDeckEntry[]): StarterDeckEntry[] {
  const vistos = new Set<string>()

  for (const entry of entries) {
    const deck = entry.deck.trim()
    if (deck === '') throw new Error('Tabela dos starter decks: há uma entrada sem deck.')
    if (vistos.has(deck)) {
      throw new Error(`Tabela dos starter decks: o deck ${deck} aparece mais de uma vez.`)
    }
    vistos.add(deck)

    const cartas = new Set<string>()
    let total = 0

    for (const linha of entry.cartas) {
      const carta = linha.carta.trim()
      if (carta === '') {
        throw new Error(`Tabela dos starter decks: ${deck} tem uma linha sem carta.`)
      }
      if (cartas.has(carta)) {
        throw new Error(`Tabela dos starter decks: ${deck} repete a carta ${carta}.`)
      }
      cartas.add(carta)

      if (!Number.isInteger(linha.copias) || linha.copias < 1 || linha.copias > MAX_COPIES_PER_CARD) {
        throw new Error(
          `Tabela dos starter decks: ${deck} tem ${carta} com ${linha.copias} cópias; ` +
            `o válido é de 1 a ${MAX_COPIES_PER_CARD}.`,
        )
      }
      total += linha.copias
    }

    if (total !== STARTER_DECK_CARDS) {
      throw new Error(
        `Tabela dos starter decks: ${deck} soma ${total} cartas, e o deck tem ${STARTER_DECK_CARDS}.`,
      )
    }
  }

  return entries
    .map((entry) => ({
      deck: entry.deck.trim(),
      // Ordenado para o arquivo nao mudar de texto sem mudar de conteudo: ele
      // vai para PR, e diff de ordem esconde diff de valor.
      cartas: [...entry.cartas]
        .map((linha) => ({ carta: linha.carta.trim(), copias: linha.copias }))
        .sort((a, b) => a.carta.localeCompare(b.carta, 'en')),
    }))
    .sort((a, b) => a.deck.localeCompare(b.deck, 'en'))
}

/**
 * Quantas cópias faltam para o deck fechar. Negativo quer dizer que passou.
 *
 * Pede só `copias` porque é só o que ela lê: serve tanto à tabela quanto às
 * linhas da tela, que carregam o código da carta com outro nome.
 */
export function missingForDeck(cartas: readonly { copias: number }[]): number {
  const total = cartas.reduce((soma, linha) => soma + (linha.copias > 0 ? linha.copias : 0), 0)
  return STARTER_DECK_CARDS - total
}
