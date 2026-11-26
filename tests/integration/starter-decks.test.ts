import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  readStarterDecksWorksheet,
  recordStarterDeck,
} from '@/server/application/catalog/starter-decks'
import { loadStarterDecks } from '@/server/infrastructure/catalog/starter-decks-file'
import { createCard, createVariant, disconnect, resetDatabase, testPrisma } from '../helpers'

/**
 * A conferência da composição dos starter decks (decisão 116).
 *
 * O arquivo é a verdade, e o banco só diz **quais** cartas existem em cada ST.
 * Aqui se verifica o que só o banco garante: que a tela oferece as cartas certas
 * e que a gravação recusa o que não está impressa naquele deck.
 *
 * A tabela vai para um arquivo temporário, e não para `data/starter-decks.json`:
 * o de verdade é trabalho conferido à mão, e um teste não escreve nele.
 */

const pasta = mkdtempSync(join(tmpdir(), 'colexa-st-'))
const arquivo = join(pasta, 'starter-decks.json')

function tabelaVazia() {
  writeFileSync(arquivo, '{\n  "decks": []\n}\n', 'utf8')
}

async function criarDeck(code: string, cartas: number, lideres = 1) {
  const db = testPrisma()
  const set = await db.set.create({ data: { code, name: code } })

  for (let i = 0; i < lideres; i += 1) {
    const carta = await createCard('Leader', `${code.replace('-', '')}-00${i + 1}`)
    const variante = await createVariant(carta.id)
    await db.variantPrinting.create({ data: { cardVariantId: variante.id, setId: set.id } })
  }

  const codigos: string[] = []
  for (let i = 0; i < cartas; i += 1) {
    const codigo = `${code.replace('-', '')}-1${String(i).padStart(2, '0')}`
    const carta = await createCard('Character', codigo)
    const variante = await createVariant(carta.id)
    await db.variantPrinting.create({ data: { cardVariantId: variante.id, setId: set.id } })
    codigos.push(codigo)
  }

  return { set, codigos }
}

/** Dez a 4 e cinco a 2, que fecha 50. */
function cinquenta(codigos: string[]) {
  return codigos.slice(0, 15).map((carta, i) => ({ carta, copias: i < 10 ? 4 : 2 }))
}

beforeEach(async () => {
  await resetDatabase()
  tabelaVazia()
})

afterAll(async () => {
  await disconnect()
})

describe('a planilha', () => {
  it('traz os starter decks, com os líderes separados das cartas', async () => {
    const { codigos } = await criarDeck('ST-01', 16)

    const { decks, total } = await readStarterDecksWorksheet(testPrisma(), arquivo)

    expect(total).toBe(1)
    expect(decks[0].code).toBe('ST-01')
    expect(decks[0].leaders.map((l) => l.cardCode)).toEqual(['ST01-001'])
    expect(decks[0].cards.map((c) => c.cardCode)).toEqual(codigos)
    // O lider nao entra na conta: ele e uma copia de cada, sempre.
    expect(decks[0].leaders[0].copias).toBe(1)
  })

  /**
   * O ST-10 e o ST-13 trazem **três** líderes — 1 no deck e 2 alternativos, como
   * a caixa diz. Nenhum deles se confere: todos são uma cópia.
   */
  it('um deck de três líderes traz os três, e nenhum na conta', async () => {
    await criarDeck('ST-10', 16, 3)

    const { decks } = await readStarterDecksWorksheet(testPrisma(), arquivo)

    expect(decks[0].leaders).toHaveLength(3)
    expect(decks[0].cards).toHaveLength(16)
  })

  it('sem conferência, falta o deck inteiro', async () => {
    await criarDeck('ST-01', 16)

    const { decks, faltam } = await readStarterDecksWorksheet(testPrisma(), arquivo)

    expect(decks[0].faltam).toBe(50)
    expect(decks[0].conferido).toBe(false)
    expect(faltam).toBe(1)
  })

  it('o que já foi conferido volta preenchido e marcado', async () => {
    const { codigos } = await criarDeck('ST-01', 16)
    await recordStarterDeck(testPrisma(), 'ST-01', cinquenta(codigos), arquivo)

    const { decks, faltam } = await readStarterDecksWorksheet(testPrisma(), arquivo)

    expect(decks[0].conferido).toBe(true)
    expect(decks[0].faltam).toBe(0)
    expect(decks[0].cards[0].copias).toBe(4)
    expect(faltam).toBe(0)
  })

  /* Booster não é starter deck, e não tem composição a conferir. */
  it('não traz coleções que não são ST', async () => {
    await criarDeck('ST-01', 16)
    await testPrisma().set.create({ data: { code: 'OP01', name: 'Romance Dawn' } })

    const { decks } = await readStarterDecksWorksheet(testPrisma(), arquivo)

    expect(decks.map((d) => d.code)).toEqual(['ST-01'])
  })
})

describe('gravar', () => {
  it('guarda o que foi conferido', async () => {
    const { codigos } = await criarDeck('ST-01', 16)

    await recordStarterDeck(testPrisma(), 'ST-01', cinquenta(codigos), arquivo)

    const tabela = loadStarterDecks(arquivo)
    expect(tabela).toHaveLength(1)
    expect(tabela[0].cartas.reduce((soma, l) => soma + l.copias, 0)).toBe(50)
  })

  /**
   * **A armadilha que isto fecha.** Um código digitado errado entraria na tabela
   * e só apareceria no dia em que alguém clicasse em "Adicionar ST" — e aí já
   * estaria na coleção de alguém. Medido em 25/11: de 31 listas trazidas de
   * fora, sete tinham blocos inteiros de códigos de outra impressão.
   */
  it('recusa carta que não está impressa neste deck', async () => {
    const { codigos } = await criarDeck('ST-01', 16)
    const intruso = [...cinquenta(codigos).slice(1), { carta: 'OP01-999', copias: 4 }]

    await expect(recordStarterDeck(testPrisma(), 'ST-01', intruso, arquivo)).rejects.toThrow(
      /OP01-999 não está impressa em ST-01/,
    )
  })

  it('recusa o líder: ele é uma cópia de cada, sempre', async () => {
    const { codigos } = await criarDeck('ST-01', 16)
    const comLider = [...cinquenta(codigos), { carta: 'ST01-001', copias: 1 }]

    await expect(recordStarterDeck(testPrisma(), 'ST-01', comLider, arquivo)).rejects.toThrow(
      /não entra na conta/,
    )
  })

  it('recusa um deck que não existe', async () => {
    await criarDeck('ST-01', 16)

    await expect(recordStarterDeck(testPrisma(), 'ST-99', [], arquivo)).rejects.toThrow(
      /não é um starter deck/,
    )
  })

  /* A soma vem do dominio, e vale tambem para quem chamar sem a tela. */
  it('recusa o que não soma 50, mesmo sem passar pela tela', async () => {
    const { codigos } = await criarDeck('ST-01', 16)
    const curto = cinquenta(codigos).slice(0, 5)

    await expect(recordStarterDeck(testPrisma(), 'ST-01', curto, arquivo)).rejects.toThrow(
      /soma 20/,
    )
  })

  /* Lista vazia é o "ainda não conferi" de volta, e não um deck de zero cartas. */
  it('lista vazia apaga a linha da tabela', async () => {
    const { codigos } = await criarDeck('ST-01', 16)
    await recordStarterDeck(testPrisma(), 'ST-01', cinquenta(codigos), arquivo)

    await recordStarterDeck(testPrisma(), 'ST-01', [], arquivo)

    expect(loadStarterDecks(arquivo)).toEqual([])
  })
})
