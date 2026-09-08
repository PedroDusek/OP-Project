import { describe, expect, it } from 'vitest'
import {
  describeLocation,
  holdsTradeStock,
  isPurposeAllowed,
  isStoragePurpose,
  isStorageType,
  normalizePurpose,
  STORAGE_TYPE_LABEL,
} from '@/server/domain/storage/locations'
import {
  deducibleReduction,
  planReduction,
  roomFor,
  totalAllocated,
  unallocatedCopies,
  type Allocation,
} from '@/server/domain/storage/allocation'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, checkImage, detectImageType } from '@/server/domain/storage/image'

describe('tipo e finalidade', () => {
  /** Cenário obrigatório 5 da seção 7: caixa de troca é válida. */
  it('aceita caixa com finalidade de troca', () => {
    expect(isPurposeAllowed('BOX', 'TRADE')).toBe(true)
    expect(describeLocation('BOX', 'TRADE')).toBe('Caixa • Troca')
  })

  it('binder e caixa exigem finalidade', () => {
    expect(isPurposeAllowed('BINDER', null)).toBe(false)
    expect(isPurposeAllowed('BOX', null)).toBe(false)
  })

  it('deck nunca tem finalidade', () => {
    expect(isPurposeAllowed('DECK', 'COLLECTION')).toBe(false)
    expect(isPurposeAllowed('DECK', null)).toBe(true)
    expect(describeLocation('DECK', null)).toBe('Deck')
  })

  /**
   * Trocar de Binder para Deck no formulário deixa a finalidade marcada atrás
   * do campo desabilitado. Mandar isso ao banco quebraria o CHECK.
   */
  it('descarta a finalidade que sobrou ao virar deck', () => {
    expect(normalizePurpose('DECK', 'COLLECTION')).toBeNull()
    expect(normalizePurpose('BINDER', 'TRADE')).toBe('TRADE')
  })

  it('reconhece só os valores do banco', () => {
    expect(isStorageType('BINDER')).toBe(true)
    expect(isStorageType('Binder')).toBe(false)
    expect(isStoragePurpose('TRADE')).toBe(true)
    expect(isStoragePurpose('')).toBe(false)
  })

  it('rotula em português os três tipos', () => {
    expect(STORAGE_TYPE_LABEL).toEqual({ BINDER: 'Binder', BOX: 'Caixa', DECK: 'Deck' })
  })

  /** Deck guarda cartas montadas, não estoque de troca. */
  it('só local de troca abastece o trade binder', () => {
    expect(holdsTradeStock('BOX', 'TRADE')).toBe(true)
    expect(holdsTradeStock('BINDER', 'COLLECTION')).toBe(false)
    expect(holdsTradeStock('DECK', null)).toBe(false)
  })
})

describe('aritmética da alocação', () => {
  /**
   * Cenário obrigatório 4 da seção 7: possui 5 — binder 2, caixa de coleção 1,
   * caixa de troca 1, deck 1. Tudo alocado, e só uma cópia em local de troca.
   */
  it('soma as cópias guardadas e o que sobra solto', () => {
    const allocations: Allocation[] = [
      { storageLocationId: 'binder', quantity: 2 },
      { storageLocationId: 'caixa-colecao', quantity: 1 },
      { storageLocationId: 'caixa-troca', quantity: 1 },
      { storageLocationId: 'deck', quantity: 1 },
    ]

    expect(totalAllocated(allocations)).toBe(5)
    expect(unallocatedCopies(5, allocations)).toBe(0)
  })

  /** A soma pode ser menor que o possuído: cópia sem lugar é normal. */
  it('cópia sem local registrado não é erro', () => {
    expect(unallocatedCopies(4, [{ storageLocationId: 'a', quantity: 1 }])).toBe(3)
    expect(unallocatedCopies(4, [])).toBe(4)
  })

  it('nunca devolve negativo, mesmo com dado impossível', () => {
    expect(unallocatedCopies(2, [{ storageLocationId: 'a', quantity: 5 }])).toBe(0)
  })

  /** Cenário obrigatório 7: possui 4, binder 3 + caixa 2 é rejeitado. */
  it('o espaço num local desconta o que já está nos outros', () => {
    const allocations: Allocation[] = [{ storageLocationId: 'binder', quantity: 3 }]

    expect(roomFor(4, allocations, 'caixa')).toBe(1)
    expect(2).toBeGreaterThan(roomFor(4, allocations, 'caixa'))
  })

  /** Editar o próprio local reaproveita o espaço que ele já ocupa. */
  it('o espaço do próprio local inclui o que ele já tem', () => {
    const allocations: Allocation[] = [
      { storageLocationId: 'binder', quantity: 3 },
      { storageLocationId: 'caixa', quantity: 1 },
    ]

    expect(roomFor(4, allocations, 'binder')).toBe(3)
  })
})

describe('resolução da decisão 007', () => {
  const allocations: Allocation[] = [
    { storageLocationId: 'binder', quantity: 3 },
    { storageLocationId: 'caixa', quantity: 1 },
  ]

  it('aceita a retirada que fecha a conta', () => {
    const plan = planReduction(2, allocations, [{ storageLocationId: 'binder', quantity: 2 }])

    expect(plan).toEqual({ ok: true, removals: [{ storageLocationId: 'binder', quantity: 2 }] })
  })

  it('diz quantas cópias ainda faltam quando retira de menos', () => {
    const plan = planReduction(2, allocations, [{ storageLocationId: 'binder', quantity: 1 }])

    expect(plan).toEqual({ ok: false, reason: 'INSUFICIENTE', missing: 1 })
  })

  /** Desalocar por vontade própria enquanto resolve é escolha legítima. */
  it('permite retirar mais do que o necessário', () => {
    const plan = planReduction(3, allocations, [
      { storageLocationId: 'binder', quantity: 3 },
      { storageLocationId: 'caixa', quantity: 1 },
    ])

    expect(plan.ok).toBe(true)
  })

  it('recusa retirar mais do que há naquele local', () => {
    const plan = planReduction(0, allocations, [{ storageLocationId: 'caixa', quantity: 2 }])

    expect(plan).toEqual({ ok: false, reason: 'ALEM_DO_ALOCADO' })
  })

  /** Duas linhas para o mesmo local somam antes de comparar. */
  it('soma retiradas repetidas do mesmo local', () => {
    const plan = planReduction(0, allocations, [
      { storageLocationId: 'binder', quantity: 2 },
      { storageLocationId: 'binder', quantity: 2 },
    ])

    expect(plan).toEqual({ ok: false, reason: 'ALEM_DO_ALOCADO' })
  })

  it('recusa local que não guarda esta carta', () => {
    const plan = planReduction(0, allocations, [{ storageLocationId: 'deck', quantity: 1 }])

    expect(plan).toEqual({ ok: false, reason: 'LOCAL_DESCONHECIDO' })
  })

  it('recusa retirada de zero ou negativa', () => {
    expect(planReduction(0, allocations, [{ storageLocationId: 'binder', quantity: 0 }])).toEqual({
      ok: false,
      reason: 'NEGATIVA',
    })
    expect(planReduction(0, allocations, [{ storageLocationId: 'binder', quantity: -1 }])).toEqual({
      ok: false,
      reason: 'NEGATIVA',
    })
  })

  /** Sem resolução, nada sai: nenhuma ordem de remoção é presumida. */
  it('sem retirada nenhuma, a redução não fecha', () => {
    expect(planReduction(1, allocations, [])).toEqual({
      ok: false,
      reason: 'INSUFICIENTE',
      missing: 3,
    })
  })
})

describe('imagem enviada', () => {
  const png = (extra = 0) => bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], extra)
  const jpeg = (extra = 0) => bytes([0xff, 0xd8, 0xff, 0xe0], extra)

  it('reconhece PNG e JPEG pela assinatura', () => {
    expect(detectImageType(png())).toBe('image/png')
    expect(detectImageType(jpeg())).toBe('image/jpeg')
    expect(ACCEPTED_IMAGE_TYPES).toEqual(['image/png', 'image/jpeg'])
  })

  /**
   * O `Content-Type` do upload é escolhido por quem envia. Um HTML com rótulo
   * de imagem passaria numa checagem de tipo declarado e seria servido de volta
   * para outros navegadores.
   */
  it('recusa arquivo que só se diz imagem', () => {
    const html = new TextEncoder().encode('<html><script>alert(1)</script></html>')

    expect(checkImage(html)).toEqual({ ok: false, reason: 'FORMATO_NAO_ACEITO' })
  })

  /** SVG fica de fora de propósito: é XML, e pode carregar script. */
  it('recusa SVG', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')

    expect(checkImage(svg).ok).toBe(false)
  })

  it('recusa arquivo vazio', () => {
    expect(checkImage(new Uint8Array(0))).toEqual({ ok: false, reason: 'VAZIO' })
  })

  it('recusa acima de 5 MB', () => {
    const grande = new Uint8Array(MAX_IMAGE_BYTES + 1)
    grande.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    expect(checkImage(grande)).toEqual({ ok: false, reason: 'GRANDE_DEMAIS' })
  })

  it('aceita exatamente 5 MB', () => {
    const limite = new Uint8Array(MAX_IMAGE_BYTES)
    limite.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    expect(checkImage(limite)).toEqual({ ok: true, type: 'image/png', extension: 'png' })
  })

  it('devolve a extensão que o arquivo vai ter', () => {
    expect(checkImage(png(10))).toMatchObject({ extension: 'png' })
    expect(checkImage(jpeg(10))).toMatchObject({ extension: 'jpg' })
  })

  /** Um arquivo menor que a assinatura não pode ser lido como imagem. */
  it('recusa arquivo truncado antes da assinatura', () => {
    expect(checkImage(new Uint8Array([0x89, 0x50])).ok).toBe(false)
  })
})

function bytes(signature: number[], extra: number): Uint8Array {
  const buffer = new Uint8Array(signature.length + extra)
  buffer.set(signature)
  return buffer
}

/**
 * O que nao precisa ser perguntado.
 *
 * A regra 3.3 existe para nao presumir de onde as copias saem — e presumir so
 * faz sentido quando ha mais de uma resposta. Em dois casos nao ha.
 */
describe('reducao deduzivel', () => {
  const doisLocais: Allocation[] = [
    { storageLocationId: 'binder', quantity: 3 },
    { storageLocationId: 'caixa', quantity: 1 },
  ]

  /**
   * Foi o defeito relatado: pedir para remover da colecao e receber uma
   * pergunta sobre de onde tirar, sendo que sai tudo.
   */
  it('sair da colecao leva todas as alocacoes', () => {
    expect(deducibleReduction(0, doisLocais)).toEqual([
      { storageLocationId: 'binder', quantity: 3 },
      { storageLocationId: 'caixa', quantity: 1 },
    ])
  })

  it('com um local so, a retirada sai dele', () => {
    expect(deducibleReduction(2, [{ storageLocationId: 'binder', quantity: 4 }])).toEqual([
      { storageLocationId: 'binder', quantity: 2 },
    ])
  })

  /** Tirar duas do binder ou uma de cada sao resultados diferentes. */
  it('com dois locais e reducao parcial, ha escolha real', () => {
    expect(deducibleReduction(2, doisLocais)).toBeNull()
  })

  it('nada a retirar quando o guardado ja cabe', () => {
    expect(deducibleReduction(4, doisLocais)).toEqual([])
    expect(deducibleReduction(5, doisLocais)).toEqual([])
  })

  it('local vazio nao conta como segundo local', () => {
    const comVazio: Allocation[] = [
      { storageLocationId: 'binder', quantity: 4 },
      { storageLocationId: 'caixa', quantity: 0 },
    ]

    expect(deducibleReduction(1, comVazio)).toEqual([
      { storageLocationId: 'binder', quantity: 3 },
    ])
  })

  it('sem alocacao nenhuma, nao ha o que retirar', () => {
    expect(deducibleReduction(0, [])).toEqual([])
  })
})
