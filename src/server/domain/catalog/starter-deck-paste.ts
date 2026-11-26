import { MAX_COPIES_PER_CARD, type StarterDeckCopies } from './starter-decks'

/**
 * Lê uma lista de deck colada como texto (decisão 116).
 *
 * Camada: domain. Puro: lê texto e devolve números.
 *
 * ## Por que existe
 *
 * Nenhuma fonte legível publica quantas cópias de cada carta vêm num starter
 * deck, e a única que tem bloqueia leitura automatizada. O caminho que sobrou é
 * a pessoa trazer a lista de onde conseguir — de outro assistente, de um site
 * que não nos atende, da playsheet da caixa — e colar aqui.
 *
 * Digitar 16 números por deck, 36 vezes, é onde o erro mora. Colar e conferir
 * move o trabalho para onde ele é barato: **olhar**.
 *
 * ## Dois formatos, porque foi o que chegou
 *
 * Uma carta por linha, com a contagem no fim:
 *
 *     ST02-002  Vito  Personagem  Comum (C)  4x
 *
 * E **agrupado**, com a contagem uma vez e vários códigos na mesma linha:
 *
 *     * 4 cópias (4x): Koby (ST06-002), Jango (ST06-003), Tashigi (ST06-006)
 *
 * O segundo apareceu em 25/11, numa lista real que o dono do produto colou.
 * Exigir um formato devolveria à pessoa o trabalho de reformatar à mão, que é
 * exatamente o trabalho que esta tela existe para tirar.
 *
 * **A regra que separa os dois é onde o número está.** No agrupado ele vem
 * **antes** do primeiro código; na tabela, depois. Ler o número depois do
 * código numa linha agrupada pegaria o `003` do código seguinte.
 *
 * ## Qualquer set, e não só o ST
 *
 * Um starter deck traz cartas de outras coleções: medido em 25/11 no nosso
 * catálogo, o **ST-10** inclui `OP01-016` e `OP01-025`, e o **ST-11** traz dez
 * cartas da OP-02. Um leitor que só aceitasse `ST…` perderia dez das quinze
 * cartas do ST-11 em silêncio, e a soma nunca fecharia.
 *
 * O que ela **não** faz é decidir se os números estão certos. Isso é a
 * conferência, e é da pessoa.
 */

/**
 * `ST06-002`, `OP01-016`, `EB01-001`, `PRB01-004` — e `P-084`.
 *
 * A segunda forma não é enfeite: medido no catálogo em 25/11, **12 promos**
 * estão impressos em starter decks (ST-16, 17, 18, 25, 31, 34, 35 e 36). Sem
 * ela, o `P-084` do ST-25 sumiria em silêncio e a soma nunca fecharia.
 */
const CODIGO = /\b([A-Z]{1,4}\d{2}-\d{3}|P-\d{3})\b/gi

/**
 * A contagem declarada **antes** do primeiro código: a forma agrupada.
 *
 * `4 cópias`, `(4x)`, `x4`. O `4x` e o `x4` primeiro porque são inequívocos; o
 * número solto só vale se nada mais o explicar, e aí o último do prefixo é o
 * que está colado nos dois pontos.
 */
function copiasNoPrefixo(prefixo: string): number | null {
  const marcado = /(\d+)\s*x\b|\bx\s*(\d+)/i.exec(prefixo)
  if (marcado) return Number.parseInt(marcado[1] ?? marcado[2], 10)

  const copias = /(\d+)\s*c[óo]pias?/i.exec(prefixo)
  if (copias) return Number.parseInt(copias[1], 10)

  return null
}

/**
 * A contagem **depois** do código, numa linha de uma carta só.
 *
 * `4x` e `x4` primeiro; sem eles, o **último** número solto, porque nas tabelas
 * o código vem primeiro e a contagem por último. Pegar o primeiro traria o `02`
 * de `ST02-002`, e isso daria 2 cópias de tudo — um erro que ainda poderia
 * somar 50 por acidente e passar por toda checagem estrutural.
 */
function copiasNoSufixo(semCodigo: string): number | null {
  const marcado = /(?:^|\s)(\d+)\s*x(?:\s|$)|(?:^|\s)x\s*(\d+)(?:\s|$)/i.exec(semCodigo)
  if (marcado) return Number.parseInt(marcado[1] ?? marcado[2], 10)

  const soltos = semCodigo.match(/\b\d+\b/g)
  if (!soltos || soltos.length === 0) return null
  return Number.parseInt(soltos[soltos.length - 1], 10)
}

export interface StarterDeckPaste {
  cartas: StarterDeckCopies[]
  /** Linhas que tinham código e nenhum número utilizável. */
  semNumero: string[]
  /** Códigos citados duas vezes. A última vence, e a repetição é relatada. */
  repetidos: string[]
}

export function parseStarterDeckPaste(texto: string): StarterDeckPaste {
  const encontradas = new Map<string, number>()
  const semNumero: string[] = []
  const repetidos: string[] = []

  for (const linha of texto.split(/\r?\n/)) {
    CODIGO.lastIndex = 0
    const achados = [...linha.matchAll(CODIGO)]
    if (achados.length === 0) continue

    const primeiro = achados[0]
    const prefixo = linha.slice(0, primeiro.index)

    /*
     * Varios codigos na linha: a contagem so pode estar no prefixo, e sem ela
     * nao ha como repartir. Um codigo so: tenta o prefixo e cai no sufixo, que
     * e a forma da tabela.
     */
    const copias =
      achados.length > 1
        ? copiasNoPrefixo(prefixo)
        : (copiasNoPrefixo(prefixo) ?? copiasNoSufixo(linha.replace(primeiro[1], ' ')))

    if (copias === null || copias <= 0 || copias > MAX_COPIES_PER_CARD) {
      semNumero.push(linha.trim())
      continue
    }

    for (const achado of achados) {
      const carta = achado[1].toUpperCase()
      if (encontradas.has(carta)) repetidos.push(carta)
      encontradas.set(carta, copias)
    }
  }

  return {
    cartas: [...encontradas.entries()].map(([carta, copias]) => ({ carta, copias })),
    semNumero,
    repetidos,
  }
}
