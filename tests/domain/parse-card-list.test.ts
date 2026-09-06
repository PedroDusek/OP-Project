import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseCardList } from '@/server/domain/catalog/parse-card-list'

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
    const allowed = [
      'Rush',
      'Blocker',
      'On Play',
      'When Attacking',
      'Activate: Main',
      'Once Per Turn',
    ]
    for (const mechanic of all) {
      expect(allowed).toContain(mechanic)
    }
    // Nomes de personagem entre colchetes nunca viram mecanica.
    expect(all).not.toContain('Shanks')
    expect(all).not.toContain('Edward.Newgate')
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
