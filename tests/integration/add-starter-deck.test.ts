import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  addStarterDeckToLocation,
  listStarterDeckOptions,
  readStarterDeckContents,
} from '@/server/application/storage/add-starter-deck'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  createCard,
  createStorage,
  createUser,
  createVariant,
  disconnect,
  resetDatabase,
  testPrisma,
} from '../helpers'

/**
 * Pôr num local o deck que vem na caixa de um starter deck (decisão 117).
 *
 * A composição vem da tabela conferida (decisão 116) e a gravação é a mesma de
 * "Adicionar cartas". O que se verifica aqui é a tradução entre as duas: qual
 * arte entra, quantas cópias, e o que acontece quando a tabela e o catálogo
 * discordam.
 *
 * A tabela vai para um arquivo temporário: o de verdade é trabalho conferido à
 * mão, e um teste não escreve nele.
 */

const pasta = mkdtempSync(join(tmpdir(), 'colexa-add-st-'))
const arquivo = join(pasta, 'starter-decks.json')

function tabela(decks: { deck: string; cartas: { carta: string; copias: number }[] }[]) {
  writeFileSync(arquivo, `${JSON.stringify({ decks }, null, 2)}\n`, 'utf8')
}

async function dono(): Promise<{ user: AuthenticatedUser; locationId: bigint }> {
  const created = await createUser('Dono')
  const local = await createStorage(created.id, 'BINDER', 'COLLECTION', 'Binder')
  return {
    user: {
      id: created.id,
      email: 'dono@example.test',
      name: 'Dono',
      plan: 'PREMIUM',
      premiumUntil: null,
    },
    locationId: local.id,
  }
}

/**
 * Um deck de teste: um líder e `cartas` personagens, todos impressos no set.
 *
 * Devolve também os códigos, porque a composição é por código — é assim que a
 * tabela conferida fala.
 */
async function criarDeck(code: string, cartas: number, lideres = 1) {
  const db = testPrisma()
  const set = await db.set.create({ data: { code, name: code } })
  const prefixo = code.replace('-', '')

  const codigosLider: string[] = []
  for (let i = 0; i < lideres; i += 1) {
    const codigo = `${prefixo}-00${i + 1}`
    const carta = await createCard('Leader', codigo)
    const variante = await createVariant(carta.id)
    await db.variantPrinting.create({ data: { cardVariantId: variante.id, setId: set.id } })
    codigosLider.push(codigo)
  }

  const codigos: string[] = []
  for (let i = 0; i < cartas; i += 1) {
    const codigo = `${prefixo}-1${String(i).padStart(2, '0')}`
    const carta = await createCard('Character', codigo)
    const variante = await createVariant(carta.id)
    await db.variantPrinting.create({ data: { cardVariantId: variante.id, setId: set.id } })
    codigos.push(codigo)
  }

  return { set, codigos, codigosLider }
}

/** Dez a 4 e cinco a 2, que fecha 50. */
const cinquenta = (codigos: string[]) =>
  codigos.slice(0, 15).map((carta, i) => ({ carta, copias: i < 10 ? 4 : 2 }))

beforeEach(async () => {
  await resetDatabase()
  tabela([])
})

afterAll(async () => {
  await disconnect()
})

describe('os decks oferecidos', () => {
  /*
   * Um ST sem composicao conferida nao aparece: mostra-lo e falhar no clique
   * seria pior que nao mostrar, e oferecer "adicionar" sem saber o que
   * adicionar e o que a decisao 116 existe para impedir.
   */
  it('traz só os que já foram conferidos', async () => {
    const a = await criarDeck('ST-01', 16)
    await criarDeck('ST-02', 16)
    tabela([{ deck: 'ST-01', cartas: cinquenta(a.codigos) }])

    const opcoes = await listStarterDeckOptions(testPrisma(), arquivo)

    expect(opcoes.map((o) => o.code)).toEqual(['ST-01'])
    expect(opcoes[0]).toMatchObject({ cards: 15, leaders: 1 })
  })

  it('diz quantos líderes o produto tem', async () => {
    const dez = await criarDeck('ST-10', 16, 3)
    tabela([{ deck: 'ST-10', cartas: cinquenta(dez.codigos) }])

    const opcoes = await listStarterDeckOptions(testPrisma(), arquivo)

    expect(opcoes[0].leaders).toBe(3)
  })

  it('tabela vazia devolve lista vazia, e não erro', async () => {
    await criarDeck('ST-01', 16)

    expect(await listStarterDeckOptions(testPrisma(), arquivo)).toEqual([])
  })
})

describe('o que vai entrar', () => {
  it('mostra o líder, as cartas e o total com o líder', async () => {
    const a = await criarDeck('ST-01', 16)
    tabela([{ deck: 'ST-01', cartas: cinquenta(a.codigos) }])

    const conteudo = await readStarterDeckContents(testPrisma(), 'ST-01', arquivo)

    expect(conteudo.leaders).toHaveLength(1)
    expect(conteudo.cards).toHaveLength(15)
    // 50 cartas mais o lider.
    expect(conteudo.totalCopies).toBe(51)
  })

  /** O ST-10 e o ST-13 trazem três líderes, e a caixa traz os três. */
  it('três líderes entram com uma cópia cada: 53 no total', async () => {
    const dez = await criarDeck('ST-10', 16, 3)
    tabela([{ deck: 'ST-10', cartas: cinquenta(dez.codigos) }])

    const conteudo = await readStarterDeckContents(testPrisma(), 'ST-10', arquivo)

    expect(conteudo.leaders).toHaveLength(3)
    expect(conteudo.leaders.every((l) => l.copies === 1)).toBe(true)
    expect(conteudo.totalCopies).toBe(53)
  })

  it('recusa um deck sem composição conferida', async () => {
    await criarDeck('ST-01', 16)

    await expect(readStarterDeckContents(testPrisma(), 'ST-01', arquivo)).rejects.toThrow(
      /ainda não foi conferida/,
    )
  })
})

describe('adicionar ao local', () => {
  it('põe o líder e as 50 na coleção e no local', async () => {
    const { user, locationId } = await dono()
    const a = await criarDeck('ST-01', 16)
    tabela([{ deck: 'ST-01', cartas: cinquenta(a.codigos) }])

    const resultado = await addStarterDeckToLocation(testPrisma(), user, locationId, 'ST-01', 1, arquivo)

    // 16 artes distintas: o lider e as 15 cartas.
    expect(resultado).toMatchObject({ cards: 16, copies: 51, times: 1 })

    const guardadas = await testPrisma().collectionItemLocation.aggregate({
      where: { storageLocationId: locationId },
      _sum: { quantity: true },
    })
    expect(guardadas._sum.quantity).toBe(51)
  })

  /* Quem comprou duas caixas tem dois decks — e dois lideres. */
  it('entra mais de uma vez, e o líder acompanha', async () => {
    const { user, locationId } = await dono()
    const a = await criarDeck('ST-01', 16)
    tabela([{ deck: 'ST-01', cartas: cinquenta(a.codigos) }])

    const resultado = await addStarterDeckToLocation(testPrisma(), user, locationId, 'ST-01', 3, arquivo)

    expect(resultado).toMatchObject({ copies: 153, times: 3 })

    const lider = await testPrisma().cardVariant.findFirst({
      where: { card: { code: a.codigosLider[0] } },
      select: { id: true },
    })
    const doLider = await testPrisma().collectionItem.findFirst({
      where: { cardVariantId: lider!.id },
      select: { quantity: true },
    })
    expect(doLider!.quantity).toBe(3)
  })

  it('somar de novo não substitui o que já estava lá', async () => {
    const { user, locationId } = await dono()
    const a = await criarDeck('ST-01', 16)
    tabela([{ deck: 'ST-01', cartas: cinquenta(a.codigos) }])

    await addStarterDeckToLocation(testPrisma(), user, locationId, 'ST-01', 1, arquivo)
    await addStarterDeckToLocation(testPrisma(), user, locationId, 'ST-01', 1, arquivo)

    const guardadas = await testPrisma().collectionItemLocation.aggregate({
      where: { storageLocationId: locationId },
      _sum: { quantity: true },
    })
    expect(guardadas._sum.quantity).toBe(102)
  })

  it('recusa vezes fora da faixa', async () => {
    const { user, locationId } = await dono()
    const a = await criarDeck('ST-01', 16)
    tabela([{ deck: 'ST-01', cartas: cinquenta(a.codigos) }])

    await expect(
      addStarterDeckToLocation(testPrisma(), user, locationId, 'ST-01', 0, arquivo),
    ).rejects.toThrow(/de 1 a 12/)
    await expect(
      addStarterDeckToLocation(testPrisma(), user, locationId, 'ST-01', 13, arquivo),
    ).rejects.toThrow(/de 1 a 12/)
  })

  /*
   * O local e de quem pede: `bulkAddToLocation` escopa pelo dono, e isto guarda
   * que o caminho novo nao abriu uma porta por fora.
   */
  it('não põe nada no local de outra pessoa', async () => {
    const { user } = await dono()
    const outra = await dono()
    const a = await criarDeck('ST-01', 16)
    tabela([{ deck: 'ST-01', cartas: cinquenta(a.codigos) }])

    await expect(
      addStarterDeckToLocation(testPrisma(), user, outra.locationId, 'ST-01', 1, arquivo),
    ).rejects.toThrow(/Local não encontrado/)
  })

  /**
   * A tabela e o catálogo podem discordar: a carta pode deixar de estar
   * impressa no set numa reimportação. Recusa em vez de pular — um deck que
   * entra incompleto sem ninguém ver é pior que um erro na cara.
   */
  it('recusa quando a tabela cita carta que não está mais no set', async () => {
    const { user, locationId } = await dono()
    const a = await criarDeck('ST-01', 16)
    tabela([
      {
        deck: 'ST-01',
        cartas: [...cinquenta(a.codigos).slice(1), { carta: 'ST01-999', copias: 4 }],
      },
    ])

    await expect(
      addStarterDeckToLocation(testPrisma(), user, locationId, 'ST-01', 1, arquivo),
    ).rejects.toThrow(/ST01-999 não está mais impressa/)
  })
})

/**
 * Líderes **distintos**, e não impressões (achado em 25/11, no navegador).
 *
 * Um líder pode ter arte paralela impressa no mesmo set. Contando impressões, a
 * lista dizia "2 líderes" no ST-21, ST-22, ST-29 e ST-30 — que têm um só — e
 * discordava da prévia, que já contava certo. A caixa traz uma carta; a segunda
 * arte é tratamento.
 */
describe('o líder com arte paralela no mesmo set', () => {
  it('conta uma vez na lista, e entra uma vez', async () => {
    const db = testPrisma()
    const { user, locationId } = await dono()
    const a = await criarDeck('ST-21', 16)

    // A arte paralela do mesmo lider, impressa no mesmo set.
    const lider = await db.card.findUnique({ where: { code: a.codigosLider[0] }, select: { id: true } })
    const paralela = await createVariant(lider!.id, 'Parallel')
    await db.variantPrinting.create({ data: { cardVariantId: paralela.id, setId: a.set.id } })

    tabela([{ deck: 'ST-21', cartas: cinquenta(a.codigos) }])

    const opcoes = await listStarterDeckOptions(db, arquivo)
    expect(opcoes[0].leaders).toBe(1)

    const conteudo = await readStarterDeckContents(db, 'ST-21', arquivo)
    expect(conteudo.leaders).toHaveLength(1)
    expect(conteudo.totalCopies).toBe(51)

    const resultado = await addStarterDeckToLocation(db, user, locationId, 'ST-21', 1, arquivo)
    expect(resultado.copies).toBe(51)
  })
})
