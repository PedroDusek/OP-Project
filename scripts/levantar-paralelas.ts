import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { commonArtByNumber, type SourceProduct } from '@/server/domain/prices/matching'
import { createPrisma } from '@/server/infrastructure/prisma'

/**
 * Levantamento para o mapeamento manual das artes paralelas.
 *
 * Diagnostico, nao rotina. Nao decide nada: junta o que o nosso catalogo tem e
 * o que a fonte oferece, lado a lado, para a conversa com o dono do produto ser
 * sobre casos concretos.
 *
 * A pergunta que ele quer responder: existe um padrao por colecao? Se numa
 * colecao toda carta com uma paralela corresponde a exatamente um tratamento
 * na fonte, o mapeamento daquela colecao e uma confirmacao, e nao um trabalho
 * carta a carta.
 *
 * Escreve dois arquivos: um resumo por set, para decidir por onde comecar, e o
 * detalhe carta a carta, para conferir os casos que nao fecham.
 */

const BASE = 'https://tcgcsv.com/tcgplayer'
const CATEGORY_ID = 68
const USER_AGENT = 'ColeXa/1.0 (+https://colexa.com.br)'

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return (await response.json()) as T
}

interface Group {
  groupId: number
  name: string
  abbreviation: string | null
}
interface Product {
  productId: number
  name: string
  extendedData?: { name: string; value: string }[]
}

/**
 * O vocabulario de tratamento de **arte** que a fonte usa.
 *
 * Proposta, nao verdade: separa "esta e outra arte da carta" de "esta e a mesma
 * arte reimpressa noutro produto". O que nao esta aqui cai no segundo balde —
 * falha fechado, e a lista cresce quando o dono do produto corrigir.
 *
 * Nomes de produto — `Dash Pack`, `Nami Deck`, `Premium Card Collection`,
 * torneios de aniversario — sao embalagem: a carta dentro e a mesma arte, e
 * conta-los como paralela e o que faz a contagem divergir da nossa.
 */
const ART_TREATMENTS = new Set([
  'alternate art',
  'super alternate art',
  'super leader alternate art',
  'red super alternate art',
  'parallel',
  'sp',
  'manga',
  'full art',
  'box topper',
  'jolly roger foil',
  'pirate foil',
  'wanted poster',
  'pandaman art',
  'gem',
  'gold',
  'silver',
  'tr',
])

/** O tratamento de um produto: o que sobra entre parenteses depois do numero. */
function treatment(product: SourceProduct, commonName: string | null): string {
  let rest = product.name
  if (commonName && rest.startsWith(commonName)) rest = rest.slice(commonName.length)

  const marks = [...rest.matchAll(/\(([^)]*)\)/g)].map((m) => m[1].trim())
  // Fora os tokens de numero, nas duas formas: `(069)` e `(P-029)`.
  const useful = marks.filter((m) => !/^\d+$/.test(m) && !/^[A-Z]{1,4}\d{0,2}-\d+$/i.test(m))
  return useful.join(' + ') || '(sem marca)'
}

/** Arte diferente, ou a mesma arte noutra embalagem? */
function isArtTreatment(label: string): boolean {
  const parts = label.split(' + ').map((p) => p.trim().toLowerCase())
  return parts.length > 0 && parts.every((p) => ART_TREATMENTS.has(p))
}

async function main() {
  const prisma = createPrisma(process.env.DATABASE_URL!)

  /* As nossas paralelas, por codigo de carta. */
  const variants = await prisma.cardVariant.findMany({
    where: { variantType: 'Parallel' },
    select: {
      sourceId: true,
      rarity: true,
      card: { select: { code: true, name: true } },
      printings: { select: { set: { select: { code: true } } } },
    },
    orderBy: { sourceId: 'asc' },
  })

  const nomes = new Map(
    (await prisma.card.findMany({ select: { code: true, name: true } })).map((c) => [
      c.code.toUpperCase(),
      c.name,
    ]),
  )

  const nossas = new Map<string, { sourceId: string | null; rarity: string | null }[]>()
  const setDaCarta = new Map<string, string>()

  for (const v of variants) {
    const code = v.card.code.toUpperCase()
    const list = nossas.get(code)
    if (list) list.push({ sourceId: v.sourceId, rarity: v.rarity })
    else nossas.set(code, [{ sourceId: v.sourceId, rarity: v.rarity }])

    const set = v.printings[0]?.set.code
    if (set && !setDaCarta.has(code)) setDaCarta.set(code, set)
  }

  /* O que a fonte oferece, por numero. */
  const groups = await get<{ results: Group[] }>(`${BASE}/${CATEGORY_ID}/groups`)
  const tratamentos = new Map<string, string[]>()

  for (const group of groups.results) {
    const products = await get<{ results: Product[] }>(
      `${BASE}/${CATEGORY_ID}/${group.groupId}/products`,
    )

    const cartas: SourceProduct[] = []
    for (const p of products.results) {
      const number = p.extendedData?.find((f) => f.name === 'Number')?.value
      if (!number) continue
      cartas.push({ productId: p.productId, name: p.name, number })
    }

    const comuns = commonArtByNumber(cartas, nomes)
    const porNumero = new Map<string, SourceProduct[]>()
    for (const c of cartas) {
      const k = c.number.trim().toUpperCase()
      const l = porNumero.get(k)
      if (l) l.push(c)
      else porNumero.set(k, [c])
    }

    for (const [numero, lista] of porNumero) {
      const comum = comuns.get(numero)
      const outras = lista.filter((p) => p.productId !== comum?.productId)
      if (outras.length === 0) continue

      /*
       * Uniao entre grupos, e nao "o primeiro manda" como na importacao de
       * preco. A mesma carta aparece no set de origem e em cada produto que a
       * reimprime, e os grupos nao vem na ordem do set: ficar com o primeiro
       * fazia a `EB01-012` ser lida pelo LT-01, onde ela so existe como
       * `(Zoro Deck)`, e a `(Alternate Art)` do EB-01 sumia.
       */
      const acumulado = tratamentos.get(numero) ?? []
      for (const p of outras) {
        const label = treatment(p, comum?.name ?? null)
        if (!acumulado.includes(label)) acumulado.push(label)
      }
      tratamentos.set(numero, acumulado)
    }

    await new Promise((r) => setTimeout(r, 60))
  }

  /* Cruzamento, por set. */
  interface Linha {
    set: string
    code: string
    nossas: number
    nossasReimpressoes: number
    fonte: number
    rarities: string
    tratamentos: string
    reimpressoes: string
  }

  const linhas: Linha[] = []
  for (const [code, lista] of nossas) {
    const todos = tratamentos.get(code) ?? []
    const artes = todos.filter(isArtTreatment)
    const outras = todos.filter((t) => !isArtTreatment(t))

    // A Bandai marca a arte paralela com `_pN` e a reimpressao com `_rN`, e o
    // nosso importador gravou as duas como Parallel. Aqui contam so as `_p`,
    // que sao as que a fonte oferece como arte separada.
    const artesNossas = lista.filter((v) => /_p\d+$/.test(v.sourceId ?? ''))
    const reimpressoesNossas = lista.length - artesNossas.length

    linhas.push({
      set: setDaCarta.get(code) ?? '(sem set)',
      code,
      nossas: artesNossas.length,
      nossasReimpressoes: reimpressoesNossas,
      fonte: artes.length,
      rarities: artesNossas.map((v) => v.rarity ?? '?').join(' | '),
      tratamentos: artes.join(' | '),
      reimpressoes: [...new Set(outras)].join(' | '),
    })
  }
  linhas.sort((a, b) => a.set.localeCompare(b.set) || a.code.localeCompare(b.code))

  /* Resumo por set: onde o padrao fecha, e onde nao fecha. */
  const porSet = new Map<string, Linha[]>()
  for (const l of linhas) {
    const list = porSet.get(l.set)
    if (list) list.push(l)
    else porSet.set(l.set, [l])
  }

  const resumo: string[] = [
    'set\tcartas\tfecham\tnao fecham\tsem oferta\tvocabulario da fonte',
  ]
  let totalFecha = 0
  let totalNao = 0
  let totalSem = 0

  for (const [set, lista] of [...porSet].sort()) {
    const fecham = lista.filter((l) => l.fonte > 0 && l.fonte === l.nossas).length
    const semOferta = lista.filter((l) => l.fonte === 0).length
    const naoFecham = lista.length - fecham - semOferta

    totalFecha += fecham
    totalNao += naoFecham
    totalSem += semOferta

    const vocab = [...new Set(lista.flatMap((l) => l.tratamentos.split(' | ')))]
      .filter(Boolean)
      .sort()
    resumo.push(
      `${set}\t${lista.length}\t${fecham}\t${naoFecham}\t${semOferta}\t${vocab.join(', ')}`,
    )
  }

  const detalhe = [
    'set	carta	artes nossas	reimpressoes nossas	artes na fonte	' +
      'rarities	vocabulario	reimpressoes na fonte',
  ]
  for (const l of linhas) {
    detalhe.push(
      `${l.set}	${l.code}	${l.nossas}	${l.nossasReimpressoes}	${l.fonte}	` +
        `${l.rarities}	${l.tratamentos}	${l.reimpressoes}`,
    )
  }

  writeFileSync('paralelas-resumo.tsv', resumo.join('\n'), 'utf8')
  writeFileSync('paralelas-detalhe.tsv', detalhe.join('\n'), 'utf8')

  const total = linhas.length
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`
  console.log(`cartas com paralela no nosso catalogo: ${total}`)
  console.log(`  contagem bate com a fonte:  ${totalFecha} (${pct(totalFecha)})`)
  console.log(`  contagem diverge:           ${totalNao} (${pct(totalNao)})`)
  console.log(`  fonte nao oferece paralela: ${totalSem} (${pct(totalSem)})`)
  console.log('')
  console.log('escritos: paralelas-resumo.tsv, paralelas-detalhe.tsv')

  await prisma.$disconnect()
}

main().catch((e: unknown) => {
  console.error('FALHOU:', e)
  process.exit(1)
})
