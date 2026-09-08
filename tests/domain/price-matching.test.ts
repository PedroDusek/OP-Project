import { describe, expect, it } from 'vitest'
import {
  commonArtByNumber,
  isCommonArt,
  pickCommonArt,
  withoutNumberToken,
  type SourceProduct,
} from '@/server/domain/prices/matching'

/**
 * Qual produto da fonte é a arte comum de uma carta.
 *
 * Todos os nomes aqui são **reais**, copiados do catálogo do tcgcsv. Não são
 * exemplos inventados para a regra passar: são os casos que a medição encontrou
 * e que fizeram a regra ser o que é.
 *
 * O que estes testes protegem, acima de tudo, é a falha fechada. Preço errado
 * num campo de dinheiro é pior que campo vazio — então "não sei" tem de
 * continuar sendo uma resposta possível quando a fonte mudar de nomenclatura.
 */

const produto = (productId: number, name: string, number: string): SourceProduct => ({
  productId,
  name,
  number,
})

describe('tirar o número do nome', () => {
  /** Sets antigos escrevem só os dígitos, com zeros à esquerda variando. */
  it('tira os dígitos entre parênteses, com ou sem zeros', () => {
    expect(withoutNumberToken('Trafalgar Law (069)', 'OP01-069')).toBe('Trafalgar Law')
    expect(withoutNumberToken('Kaido (003)', 'ST04-003')).toBe('Kaido')
  })

  /** Sets novos escrevem o código inteiro. */
  it('tira o código inteiro entre parênteses', () => {
    expect(withoutNumberToken('Loki (OP17-119)', 'OP17-119')).toBe('Loki')
  })

  /** E há os que não escrevem número nenhum. */
  it('devolve o nome intacto quando não há token', () => {
    expect(withoutNumberToken('Franky', 'OP01-021')).toBe('Franky')
  })

  /** O parêntese do nome não é token de número e tem de sobreviver. */
  it('preserva parêntese que faz parte do nome', () => {
    expect(withoutNumberToken('Mr.1 (Daz.Bonez)', 'OP01-083')).toBe('Mr.1 (Daz.Bonez)')
  })
})

describe('reconhecer arte comum', () => {
  it('aceita o produto sem tratamento, com e sem número no nome', () => {
    expect(isCommonArt(produto(1, 'Trafalgar Law (069)', 'OP01-069'))).toBe(true)
    expect(isCommonArt(produto(2, 'Franky', 'OP01-021'))).toBe(true)
    expect(isCommonArt(produto(3, 'Loki (OP17-119)', 'OP17-119'))).toBe(true)
  })

  it('recusa todo tratamento que a fonte marca entre parênteses', () => {
    const tratamentos = [
      'Shanks (020) (Alternate Art)',
      'Roronoa Zoro (OP01-001) (Parallel)',
      'Monkey.D.Luffy (021) (Box Topper)',
      'Roronoa Zoro (EB04-007) (SP)',
      'Buggy (Promo Reprint)',
      'Buggy (OP10 Release Event Winner)',
    ]

    for (const nome of tratamentos) {
      expect(isCommonArt(produto(9, nome, 'OP01-001')), nome).toBe(false)
    }
  })
})

describe('escolher entre os produtos de um número', () => {
  /** O caso comum: uma arte comum e as versões tratadas ao lado dela. */
  it('escolhe a única sem tratamento', () => {
    const escolhido = pickCommonArt([
      produto(1, 'Shanks (022)', 'OP17-022'),
      produto(2, 'Shanks (022) (Alternate Art)', 'OP17-022'),
    ])

    expect(escolhido?.productId).toBe(1)
  })

  it('não escolhe quando só há tratamento', () => {
    const escolhido = pickCommonArt([
      produto(1, 'Buggy (P-084) (SP)', 'P-084'),
      produto(2, 'Buggy (Promo Reprint)', 'P-084'),
      produto(3, 'Buggy (OP10 Release Event)', 'P-084'),
    ])

    expect(escolhido).toBeNull()
  })

  /**
   * Ambiguidade não vira palpite. A medição não achou nenhum caso destes hoje,
   * e é justamente por isso que o teste existe: quando a fonte mudar de
   * nomenclatura e passar a achar dois, a resposta tem de continuar "não sei".
   */
  it('não escolhe entre dois candidatos', () => {
    const escolhido = pickCommonArt([
      produto(1, 'Nami', 'OP01-016'),
      produto(2, 'Nami', 'OP01-016'),
    ])

    expect(escolhido).toBeNull()
  })
})

describe('desempate pelo nome do nosso catálogo', () => {
  /**
   * O motivo de o desempate existir: sem ele, os agentes da Baroque Works
   * ficavam sem preço porque o nome de verdade tem parênteses.
   */
  it('resolve carta cujo nome tem parênteses de verdade', () => {
    const escolhido = pickCommonArt(
      [
        produto(1, 'Mr.1 (Daz.Bonez)', 'OP01-083'),
        produto(2, 'Mr.1 (Daz.Bonez) (Alternate Art)', 'OP01-083'),
      ],
      'Mr.1(Daz.Bonez)',
    )

    expect(escolhido?.productId).toBe(1)
  })

  /** A fonte escreve o espaço antes do parêntese de um jeito em cada set. */
  it('ignora espaço e caixa na comparação', () => {
    const escolhido = pickCommonArt(
      [produto(1, 'Mr.2.Bon.Kurei (Bentham)', 'ST30-013')],
      'mr.2.bon.kurei(bentham)',
    )

    expect(escolhido?.productId).toBe(1)
  })

  /** Igualdade, não semelhança: tratamento continua fora mesmo com o nome. */
  it('não aceita tratamento só por conter o nosso nome', () => {
    const escolhido = pickCommonArt(
      [
        produto(1, 'Mr.3(Galdino) (Full Art)', 'ST30-014'),
        produto(2, 'Mr.3(Galdino) - OP09-056 (Reprint)', 'ST30-014'),
      ],
      'Mr.3(Galdino)',
    )

    expect(escolhido).toBeNull()
  })

  /** Desempate, não atalho: quem já decidiu não volta atrás. */
  it('não muda a escolha que a regra dos parênteses já fez', () => {
    const escolhido = pickCommonArt(
      [produto(1, 'Zephyr(Navy)', 'OP12-046'), produto(2, 'Zephyr', 'OP12-046')],
      'Zephyr(Navy)',
    )

    expect(escolhido?.productId).toBe(2)
  })
})

describe('agrupar por número', () => {
  it('decide cada número separadamente e omite quem não tem resposta', () => {
    const escolhidos = commonArtByNumber([
      produto(1, 'Shanks (022)', 'OP17-022'),
      produto(2, 'Shanks (022) (Alternate Art)', 'OP17-022'),
      produto(3, 'Buggy (P-084) (SP)', 'P-084'),
      produto(4, 'Franky', 'OP01-021'),
    ])

    expect([...escolhidos.keys()].sort()).toEqual(['OP01-021', 'OP17-022'])
    expect(escolhidos.get('OP17-022')?.productId).toBe(1)
  })

  it('normaliza o número para maiúsculas e sem espaço', () => {
    const escolhidos = commonArtByNumber([produto(1, 'Franky', ' op01-021 ')])

    expect(escolhidos.has('OP01-021')).toBe(true)
  })

  it('usa o nome do catálogo do número certo', () => {
    const escolhidos = commonArtByNumber(
      [
        produto(1, 'Mr.1 (Daz.Bonez)', 'OP01-083'),
        produto(2, 'Mr.1 (Daz.Bonez) (Alternate Art)', 'OP01-083'),
      ],
      new Map([['OP01-083', 'Mr.1(Daz.Bonez)']]),
    )

    expect(escolhidos.get('OP01-083')?.productId).toBe(1)
  })

  it('ignora produto sem número: booster, caixa, playmat', () => {
    const escolhidos = commonArtByNumber([produto(1, 'Romance Dawn Booster Box', '')])

    expect(escolhidos.size).toBe(0)
  })
})
