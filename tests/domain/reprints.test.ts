import { describe, expect, it } from 'vitest'
import { isReprintSourceId, parseCardList } from '@/server/domain/catalog/parse-card-list'

/**
 * Reimpressao nao e variante.
 *
 * A fonte marca arte paralela com `_pN` e reimpressao com `_rN`. As duas viravam
 * `variant_type = 'Parallel'`, e o produto passava a dizer que a carta tinha uma
 * arte a mais do que tem (decisao 052).
 *
 * O que o parser tem de fazer aqui e distinguir os dois sufixos e nao decidir
 * mais nada: juntar a reimpressao a arte que ela reimprime e trabalho do
 * importador, porque a arte pode estar em outra pagina.
 */

/** Uma entrada da fonte, com o identificador e os sets que o teste quiser. */
function entrada(sourceId: string, sets: string): string {
  return `
    <dl class="modalCol" id="${sourceId}">
      <dt>
        <div class="infoCol"><span>EB01-012</span> | <span>SR</span> | <span>CHARACTER</span></div>
        <div class="cardName">Cavendish</div>
      </dt>
      <dd>
        <div class="backCol">
          <div class="cost"><h3>Cost</h3>4</div>
          <div class="power"><h3>Power</h3>5000</div>
          <div class="counter"><h3>Counter</h3>-</div>
          <div class="color"><h3>Color</h3>Green</div>
          <div class="feature"><h3>Type</h3>Teste</div>
          <div class="text"><h3>Effect</h3>-</div>
          <div class="getInfo"><h3>Card Set(s)</h3>${sets}</div>
        </div>
      </dd>
    </dl>`
}

describe('reconhecer o sufixo', () => {
  it('aceita _r seguido de numero', () => {
    expect(isReprintSourceId('EB01-012_r1')).toBe(true)
    expect(isReprintSourceId('OP09-056_r2')).toBe(true)
  })

  /** `_p` e arte paralela: outra ilustracao, e continua sendo variante. */
  it('recusa arte paralela e arte comum', () => {
    expect(isReprintSourceId('EB01-012_p1')).toBe(false)
    expect(isReprintSourceId('EB01-012')).toBe(false)
  })

  /**
   * O sufixo tem de terminar a cadeia e ter numero. Uma carta chamada `_rare`
   * ou um identificador futuro `_r` sem indice nao sao reimpressao — e na
   * duvida vale continuar variante, que e o comportamento antigo e visivel.
   */
  it('nao confunde com outros usos da letra', () => {
    expect(isReprintSourceId('EB01-012_r')).toBe(false)
    expect(isReprintSourceId('EB01-012_r1x')).toBe(false)
    expect(isReprintSourceId('EB01-012_rare')).toBe(false)
  })
})

describe('separar do resto da pagina', () => {
  const page = parseCardList(
    entrada('EB01-012', 'Extra Booster [EB-01]') +
      entrada('EB01-012_p1', 'Extra Booster [EB-01]') +
      entrada('EB01-012_r1', 'Premium Booster [PRB-02]'),
  )

  it('nao cria variante para a reimpressao', () => {
    expect(page.variants.map((v) => v.sourceId)).toEqual(['EB01-012', 'EB01-012_p1'])
  })

  it('devolve a reimpressao apontando para a arte comum', () => {
    expect(page.reprints).toEqual([
      {
        sourceId: 'EB01-012_r1',
        cardCode: 'EB01-012',
        reprintOfSourceId: 'EB01-012',
        printedInSetCodes: ['PRB-02'],
      },
    ])
  })

  /** O set da reimpressao e o unico dado que ela acrescenta, e ele tem de vir. */
  it('registra o set da reimpressao entre os sets da pagina', () => {
    expect(page.sets.map((s) => s.code)).toContain('PRB-02')
  })

  it('nao rejeita a entrada: ela e valida, so nao e variante', () => {
    expect(page.rejected).toEqual([])
  })
})

describe('reimpressao sozinha na pagina', () => {
  /**
   * O caso real: `EB01-012_r1` chega na pagina do PRB-02, onde a arte que ela
   * reimprime nao aparece. O parser nao tem como resolver isso, e nao tenta.
   */
  it('devolve a reimpressao mesmo sem a arte por perto', () => {
    const page = parseCardList(entrada('EB01-012_r1', 'Premium Booster [PRB-02]'))

    expect(page.variants).toEqual([])
    expect(page.reprints).toHaveLength(1)
    expect(page.reprints[0].reprintOfSourceId).toBe('EB01-012')
  })
})
