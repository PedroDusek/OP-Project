import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseCardList } from '@/server/domain/catalog/parse-card-list'
import { KNOWN_MECHANICS, PROMO_SET } from '@/server/domain/catalog/types'

/** Monta uma entrada minima com o texto de efeito informado. */
function parseSingle(effectText: string) {
  const block = `
    <dl class="modalCol" id="TST-001">
      <dt>
        <div class="infoCol"><span>TST-001</span> | <span>C</span> | <span>CHARACTER</span></div>
        <div class="cardName">Carta de teste</div>
      </dt>
      <dd>
        <div class="backCol">
          <div class="cost"><h3>Cost</h3>1</div>
          <div class="attribute"><h3>Attribute</h3><i>Slash</i></div>
          <div class="power"><h3>Power</h3>1000</div>
          <div class="counter"><h3>Counter</h3>-</div>
          <div class="color"><h3>Color</h3>Red</div>
          <div class="block"><h3>Block icon</h3>5</div>
          <div class="feature"><h3>Type</h3>Teste</div>
          <div class="text"><h3>Effect</h3>${effectText}</div>
          <div class="getInfo"><h3>Card Set(s)</h3>TESTE [TST-01]</div>
        </div>
      </dd>
    </dl>`
  const parsed = parseCardList(block)
  expect(parsed.rejected).toEqual([])
  return parsed.cards[0]
}

/**
 * Teste puro: nao toca rede nem banco.
 *
 * O fixture e um recorte real da listagem oficial, com um Leader, um Event, um
 * Stage, um Character e um par carta base + arte paralela.
 */
const html = readFileSync(
  fileURLToPath(new URL('../fixtures/bandai-cardlist-sample.html', import.meta.url)),
  'utf8',
)

const page = parseCardList(html)

describe('parser da listagem de cartas', () => {
  it('nao descarta nenhuma entrada do fixture', () => {
    expect(page.rejected).toEqual([])
    expect(page.variants).toHaveLength(6)
  })

  it('trata cada arte como uma variante e usa o id da fonte como identidade', () => {
    const ids = page.variants.map((v) => v.sourceId)
    expect(ids).toContain('OP17-005')
    expect(ids).toContain('OP17-005_p1')
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('agrupa artes da mesma carta sob um unico codigo', () => {
    const forCard = page.variants.filter((v) => v.cardCode === 'OP17-005')
    expect(forCard).toHaveLength(2)
    // Duas artes, uma carta.
    expect(page.cards.filter((c) => c.code === 'OP17-005')).toHaveLength(1)
  })

  it('classifica a arte base como Normal e a sufixada como Parallel', () => {
    const base = page.variants.find((v) => v.sourceId === 'OP17-005')
    const parallel = page.variants.find((v) => v.sourceId === 'OP17-005_p1')
    expect(base?.variantType).toBe('Normal')
    expect(parallel?.variantType).toBe('Parallel')
  })

  it('le Life no Leader e Cost nos demais tipos', () => {
    // O Leader reusa a mesma div do custo, trocando so o rotulo do h3.
    const leader = page.cards.find((c) => c.type === 'Leader')
    expect(leader).toBeDefined()
    expect(leader?.life).not.toBeNull()
    expect(leader?.cost).toBeNull()

    const character = page.cards.find((c) => c.type === 'Character')
    expect(character?.cost).not.toBeNull()
    expect(character?.life).toBeNull()
  })

  it('converte o traco da fonte em ausencia de valor', () => {
    const event = page.cards.find((c) => c.type === 'Event')
    expect(event?.power).toBeNull()
    expect(event?.counter).toBeNull()
  })

  it('nao atribui atributo a Event e Stage', () => {
    // Event e Stage trazem a div de atributo vazia, com um traco.
    for (const type of ['Event', 'Stage'] as const) {
      const card = page.cards.find((c) => c.type === type)
      expect(card, `esperava uma carta do tipo ${type}`).toBeDefined()
      expect(card?.attributes).toEqual([])
    }
  })

  it('da cor e traits a toda carta', () => {
    for (const card of page.cards) {
      expect(card.colors.length, `${card.code} sem cor`).toBeGreaterThan(0)
      expect(card.traits.length, `${card.code} sem trait`).toBeGreaterThan(0)
    }
  })

  it('extrai apenas mecanicas do vocabulario conhecido', () => {
    const all = page.cards.flatMap((c) => c.mechanics)
    for (const mechanic of all) {
      expect(KNOWN_MECHANICS as readonly string[]).toContain(mechanic)
    }
    // Nomes de personagem entre colchetes nunca viram mecanica. O levantamento
    // sobre o catalogo completo achou 195 termos assim.
    expect(all).not.toContain('Shanks')
    expect(all).not.toContain('Edward.Newgate')
    expect(all).not.toContain('Nami')
  })

  it('ignora marcadores de custo e condicoes de fase nao aprovadas', () => {
    const card = parseSingle(
      '[DON!! x2] [Main] [Counter] [Your Turn] [Double Attack] [Banish] [Blocker]',
    )
    // Apenas Blocker esta no vocabulario aprovado.
    expect(card.mechanics).toEqual(['Blocker'])
  })

  it('reconhece os gatilhos de efeito aprovados na decisao 022', () => {
    const card = parseSingle(
      "[On K.O.] algo [On Block] algo [On Your Opponent's Attack] algo [End of Your Turn] algo",
    )
    expect(card.mechanics.sort()).toEqual(
      ['End of Your Turn', 'On Block', 'On K.O.', "On Your Opponent's Attack"].sort(),
    )
  })

  it('normaliza Rush: Character para Rush', () => {
    const card = parseSingle('Esta carta ganha [Rush: Character] ate o fim do turno.')
    expect(card.mechanics).toEqual(['Rush'])
  })

  it('resolve os sets pelo campo da fonte, nunca pelo prefixo do codigo', () => {
    expect(page.sets.length).toBeGreaterThan(0)
    for (const variant of page.variants) {
      expect(variant.printedInSetCodes.length).toBeGreaterThan(0)
      for (const code of variant.printedInSetCodes) {
        expect(page.sets.map((s) => s.code)).toContain(code)
      }
    }
    // O codigo do set da fonte nao coincide com o prefixo do codigo da carta,
    // que e exatamente por que derivar um do outro seria errado.
    expect(page.sets.map((s) => s.code)).toContain('OP-17')
    expect(page.variants.every((v) => v.cardCode.startsWith('OP17'))).toBe(true)
  })

  it('aponta as imagens para a origem, sem query de cache', () => {
    for (const variant of page.variants) {
      expect(variant.imageUrl).toMatch(
        /^https:\/\/en\.onepiece-cardgame\.com\/images\/cardlist\/card\/[A-Za-z0-9_-]+\.png$/,
      )
    }
    const parallel = page.variants.find((v) => v.sourceId === 'OP17-005_p1')
    expect(parallel?.imageUrl).toContain('OP17-005_p1.png')
  })

  it('devolve pagina vazia para HTML sem cartas, em vez de quebrar', () => {
    const empty = parseCardList('<html><body>nada aqui</body></html>')
    expect(empty.cards).toEqual([])
    expect(empty.variants).toEqual([])
    expect(empty.rejected).toEqual([])
  })
})

describe('produtos sem codigo de set', () => {
  it('registra o produto em vez de descarta-lo em silencio', () => {
    const block = `
      <dl class="modalCol" id="TST-002">
        <dt>
          <div class="infoCol"><span>TST-002</span> | <span>SR</span> | <span>CHARACTER</span></div>
          <div class="cardName">Promo de teste</div>
        </dt>
        <dd><div class="backCol">
          <div class="cost"><h3>Cost</h3>2</div>
          <div class="attribute"><h3>Attribute</h3><i>Slash</i></div>
          <div class="power"><h3>Power</h3>2000</div>
          <div class="counter"><h3>Counter</h3>-</div>
          <div class="color"><h3>Color</h3>Red</div>
          <div class="block"><h3>Block icon</h3>5</div>
          <div class="feature"><h3>Type</h3>Teste</div>
          <div class="text"><h3>Effect</h3>-</div>
          <div class="getInfo"><h3>Card Set(s)</h3>Tournament Pack Vol.4</div>
        </div></dd>
      </dl>`
    const parsed = parseCardList(block)

    // O produto vira o set promocional agregado, nao um set proprio.
    expect(parsed.cards).toHaveLength(1)
    expect(parsed.sets).toEqual([PROMO_SET])
    expect(parsed.variants[0].printedInSetCodes).toEqual([PROMO_SET.code])
    // E o nome original do produto nao se perde sem registro.
    expect(parsed.promotionalProductNames).toEqual(['Tournament Pack Vol.4'])
  })

  it('nao reporta produto promocional quando todos tem codigo', () => {
    expect(page.promotionalProductNames).toEqual([])
    expect(page.sets.map((s) => s.code)).not.toContain(PROMO_SET.code)
  })

  it('agrupa produtos promocionais diferentes no mesmo set', () => {
    const entry = (id: string, produto: string) => `
      <dl class="modalCol" id="${id}">
        <dt>
          <div class="infoCol"><span>${id}</span> | <span>SR</span> | <span>CHARACTER</span></div>
          <div class="cardName">Promo ${id}</div>
        </dt>
        <dd><div class="backCol">
          <div class="cost"><h3>Cost</h3>2</div>
          <div class="attribute"><h3>Attribute</h3><i>Slash</i></div>
          <div class="power"><h3>Power</h3>2000</div>
          <div class="counter"><h3>Counter</h3>-</div>
          <div class="color"><h3>Color</h3>Red</div>
          <div class="block"><h3>Block icon</h3>5</div>
          <div class="feature"><h3>Type</h3>Teste</div>
          <div class="text"><h3>Effect</h3>-</div>
          <div class="getInfo"><h3>Card Set(s)</h3>${produto}</div>
        </div></dd>
      </dl>`
    const parsed = parseCardList(
      entry('TST-010', 'Tournament Pack Vol.4') + entry('TST-011', 'Anime Expo 2023'),
    )

    // Um unico set, dois nomes de produto preservados no relatorio.
    expect(parsed.sets).toEqual([PROMO_SET])
    expect(parsed.promotionalProductNames.sort()).toEqual([
      'Anime Expo 2023',
      'Tournament Pack Vol.4',
    ])
    for (const variant of parsed.variants) {
      expect(variant.printedInSetCodes).toEqual([PROMO_SET.code])
    }
  })
})

describe('variantes que a fonte deixa sem set', () => {
  it('sinaliza a ausencia em vez de deixa-la invisivel', () => {
    // Entrada real da fonte: ST14-010_r1 nao traz o campo de sets.
    const block = `
      <dl class="modalCol" id="TST-020_r1">
        <dt>
          <div class="infoCol"><span>TST-020</span> | <span>C</span> | <span>CHARACTER</span></div>
          <div class="cardName">Sem set</div>
        </dt>
        <dd><div class="backCol">
          <div class="cost"><h3>Cost</h3>5</div>
          <div class="attribute"><h3>Attribute</h3><i>Slash</i></div>
          <div class="power"><h3>Power</h3>5000</div>
          <div class="counter"><h3>Counter</h3>-</div>
          <div class="color"><h3>Color</h3>Red</div>
          <div class="block"><h3>Block icon</h3>5</div>
          <div class="feature"><h3>Type</h3>Teste</div>
          <div class="text"><h3>Effect</h3>-</div>
        </div></dd>
      </dl>`
    const parsed = parseCardList(block)

    // A carta entra: a lacuna e do dado da fonte, nao motivo para descartar.
    expect(parsed.cards).toHaveLength(1)
    expect(parsed.variantsWithoutSet).toEqual(['TST-020_r1'])

    /*
     * `_r1` e reimpressao (decisao 052), entao nao vira variante. E uma
     * reimpressao sem set nao acrescenta nada: o set e o unico dado que ela
     * traz. Continua sinalizada, porque desaparecer em silencio e o que esta
     * secao existe para impedir.
     */
    expect(parsed.variants).toEqual([])
    expect(parsed.reprints[0].printedInSetCodes).toEqual([])
  })

  it('sinaliza tambem a arte paralela sem set', () => {
    const block = `
      <dl class="modalCol" id="TST-020_p1">
        <dt>
          <div class="infoCol"><span>TST-020</span> | <span>C</span> | <span>CHARACTER</span></div>
          <div class="cardName">Sem set</div>
        </dt>
        <dd><div class="backCol">
          <div class="cost"><h3>Cost</h3>5</div>
          <div class="power"><h3>Power</h3>5000</div>
          <div class="counter"><h3>Counter</h3>-</div>
          <div class="color"><h3>Color</h3>Red</div>
          <div class="feature"><h3>Type</h3>Teste</div>
          <div class="text"><h3>Effect</h3>-</div>
        </div></dd>
      </dl>`
    const parsed = parseCardList(block)

    expect(parsed.variants[0].printedInSetCodes).toEqual([])
    expect(parsed.variantsWithoutSet).toEqual(['TST-020_p1'])
  })

  it('nao sinaliza nada quando toda variante tem set', () => {
    expect(page.variantsWithoutSet).toEqual([])
  })
})
