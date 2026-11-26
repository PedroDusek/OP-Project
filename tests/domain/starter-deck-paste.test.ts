import { describe, expect, it } from 'vitest'
import { parseStarterDeckPaste } from '@/server/domain/catalog/starter-deck-paste'

/**
 * Ler uma lista colada (decisão 116).
 *
 * O texto vem de onde a pessoa conseguir — outro assistente, um site que não
 * nos atende, a playsheet da caixa — e cada um escreve de um jeito. O que todos
 * têm é um código e um número por linha.
 */

describe('a tabela com tabulação', () => {
  /* A forma que o dono do produto colou em 25/11, de um outro assistente. */
  const TABELA = `
Código	Carta	Tipo	Raridade	Cópias
ST02-002	Vito	Personagem	Comum (C)	4x
ST02-003	Urouge	Personagem	Comum (C)	2x
ST02-009	Trafalgar Law	Personagem	Super Rara (SR)	2x
`

  it('lê código e cópias de cada linha', () => {
    const { cartas } = parseStarterDeckPaste(TABELA)

    expect(cartas).toEqual([
      { carta: 'ST02-002', copias: 4 },
      { carta: 'ST02-003', copias: 2 },
      { carta: 'ST02-009', copias: 2 },
    ])
  })

  /**
   * A armadilha da linha: `ST02-002` tem um `02` e um `002` dentro. Pegar o
   * primeiro número solto daria 2 cópias de tudo, e a soma ainda poderia fechar
   * em 50 por acidente — erro que passaria por toda checagem estrutural.
   */
  it('não confunde o número do código com a contagem', () => {
    const { cartas } = parseStarterDeckPaste('ST02-002\tVito\tComum\t4x')

    expect(cartas).toEqual([{ carta: 'ST02-002', copias: 4 }])
  })
})

describe('as outras formas de escrever', () => {
  it('aceita `x4` além de `4x`', () => {
    expect(parseStarterDeckPaste('ST01-002 Usopp x4').cartas).toEqual([
      { carta: 'ST01-002', copias: 4 },
    ])
  })

  it('aceita o número solto no fim', () => {
    expect(parseStarterDeckPaste('ST01-002 | Usopp | Common | 4').cartas).toEqual([
      { carta: 'ST01-002', copias: 4 },
    ])
  })

  it('aceita markdown com barras', () => {
    const { cartas } = parseStarterDeckPaste('| ST04-017 | Onigashima Island | Stage | C | 4x |')

    expect(cartas).toEqual([{ carta: 'ST04-017', copias: 4 }])
  })

  it('não liga para maiúscula no código', () => {
    expect(parseStarterDeckPaste('st01-002 x2').cartas).toEqual([
      { carta: 'ST01-002', copias: 2 },
    ])
  })

  it('ignora o que não tem código de carta', () => {
    expect(parseStarterDeckPaste('Baralho Principal (50 cartas)\n\nCódigo\tCarta').cartas).toEqual([])
  })
})

describe('o que ela avisa em vez de engolir', () => {
  /**
   * A linha do líder vem como "1x Crocodile (ST03-001) — Líder" e **tem**
   * número. O que não pode é a linha com código e sem número virar zero em
   * silêncio: seria uma carta a menos no deck, e o contador diria "faltam 4"
   * sem dizer de quê.
   */
  it('linha com código e sem número vira aviso', () => {
    const { cartas, semNumero } = parseStarterDeckPaste('ST03-001 Crocodile — Líder')

    expect(cartas).toEqual([])
    expect(semNumero).toEqual(['ST03-001 Crocodile — Líder'])
  })

  it('número acima de quatro é aviso, e não um deck ilegal', () => {
    const { cartas, semNumero } = parseStarterDeckPaste('ST01-002 Usopp 9x')

    expect(cartas).toEqual([])
    expect(semNumero).toHaveLength(1)
  })

  it('código repetido fica com o último, e a repetição é relatada', () => {
    const { cartas, repetidos } = parseStarterDeckPaste('ST01-002 x2\nST01-002 x4')

    expect(cartas).toEqual([{ carta: 'ST01-002', copias: 4 }])
    expect(repetidos).toEqual(['ST01-002'])
  })
})

/**
 * A forma agrupada, que apareceu numa lista real em 25/11.
 *
 * Uma contagem, vários códigos na mesma linha. A diferença que decide tudo é
 * **onde o número está**: aqui ele vem antes do primeiro código, e lê-lo depois
 * pegaria os dígitos do código seguinte.
 */
describe('a lista agrupada', () => {
  it('aplica a contagem do prefixo a todos os códigos da linha', () => {
    const { cartas } = parseStarterDeckPaste(
      '* 4 cópias (4x): Koby (ST06-002), Jango (ST06-003), Tashigi (ST06-006)',
    )

    expect(cartas).toEqual([
      { carta: 'ST06-002', copias: 4 },
      { carta: 'ST06-003', copias: 4 },
      { carta: 'ST06-006', copias: 4 },
    ])
  })

  it('lê "2 cópias" sem o x', () => {
    const { cartas } = parseStarterDeckPaste('* 2 cópias: Smoker (ST06-004), Sengoku (ST06-005)')

    expect(cartas.map((c) => c.copias)).toEqual([2, 2])
  })

  /* O sufixo com SR não pode virar contagem: `(ST06-004 — SR)` não tem número. */
  it('não se confunde com a raridade escrita ao lado', () => {
    const { cartas } = parseStarterDeckPaste(
      '* 2 cópias (2x): Smoker (ST06-004 — SR), Monkey.D.Garp (ST06-012 — SR)',
    )

    expect(cartas).toEqual([
      { carta: 'ST06-004', copias: 2 },
      { carta: 'ST06-012', copias: 2 },
    ])
  })

  it('linha agrupada sem contagem no prefixo vira aviso', () => {
    const { cartas, semNumero } = parseStarterDeckPaste('Veja ST06-002, ST06-003 e ST06-006')

    expect(cartas).toEqual([])
    expect(semNumero).toHaveLength(1)
  })
})

/**
 * Um starter deck traz cartas de outras coleções. Medido no catálogo em 25/11:
 * o ST-10 inclui `OP01-016` e `OP01-025`, e o ST-11 traz **dez** cartas da
 * OP-02 — dois terços do deck. Um leitor que só aceitasse `ST…` as perderia em
 * silêncio, e a soma nunca fecharia.
 */
describe('cartas de outras coleções', () => {
  it('aceita qualquer prefixo de set', () => {
    const { cartas } = parseStarterDeckPaste(
      '* 4 cópias (4x): Nami (OP01-016), Zoro (OP01-025), Sanji (ST10-004)',
    )

    expect(cartas.map((c) => c.carta)).toEqual(['OP01-016', 'OP01-025', 'ST10-004'])
  })

  /* 12 promos estão impressos em starter decks: o P-084 é do ST-25. */
  it('aceita o código de promo', () => {
    expect(parseStarterDeckPaste('* 4x: Buggy (P-084), Cabaji (ST25-002)').cartas).toEqual([
      { carta: 'P-084', copias: 4 },
      { carta: 'ST25-002', copias: 4 },
    ])
  })

  it('aceita o código de três letras das coletâneas', () => {
    expect(parseStarterDeckPaste('* 4x: Carta (PRB01-004)').cartas).toEqual([
      { carta: 'PRB01-004', copias: 4 },
    ])
  })
})
